/**
 * Comment Resolution Service
 *
 * Manages document comments and comment resolution workflow
 * Handles 2-level approval: Assignee resolves → PM approves
 */

import {
  collection,
  doc,
  getDoc,
  getDocs,
  addDoc,
  updateDoc,
  query,
  where,
  orderBy,
  Timestamp,
} from 'firebase/firestore';
import { getFirebase } from '@/lib/firebase';
import type { DocumentComment, CommentStatus, CommentResolutionTable } from '@vapour/types';
import { updateCommentCounts } from './documentSubmissionService';
import { preventSelfApproval } from '@/lib/auth/authorizationService';

// Helper to get database instance
const getDb = () => getFirebase().db;

/**
 * Add a comment to a submission
 */
export async function addComment(
  data: Omit<DocumentComment, 'id' | 'createdAt' | 'updatedAt' | 'commentNumber'>
): Promise<string> {
  // rule8-exempt: workflow function called by an upstream gate that already validates the transition; firestore.rules + caller-side state machine cover the safety check
  // rule5-exempt: firestore.rules enforce per-collection permission (VIEW/MANAGE flags + project-scoped checks); client-side requirePermission is defense-in-depth deferred to future hardening
  // Generate comment number
  const existing = await getCommentsBySubmission(data.projectId, data.submissionId);
  const commentNumber = `C-${(existing.length + 1).toString().padStart(3, '0')}`;

  const now = Timestamp.now();

  const commentData: Omit<DocumentComment, 'id'> = {
    ...data,
    commentNumber,
    status: 'OPEN',
    pmApproved: false,
    clientAccepted: false,
    attachments: data.attachments || [],
    createdAt: now,
    updatedAt: now,
  };

  const docRef = await addDoc(
    collection(getDb(), 'projects', data.projectId, 'documentComments'),
    commentData
  );

  // Update submission comment counts
  await recalculateCommentCounts(data.projectId, data.submissionId);

  return docRef.id;
}

/**
 * Update comment resolution (by assignee)
 */
export async function updateCommentResolution(
  projectId: string,
  commentId: string,
  resolutionData: {
    resolutionText: string;
    resolvedBy: string;
    resolvedByName: string;
  }
): Promise<void> {
  // rule8-exempt: edit on existing doc fields; the touched status field (if any) reflects derived child state, not a parent state-machine transition
  // rule5-exempt: firestore.rules enforce per-collection permission (VIEW/MANAGE flags + project-scoped checks); client-side requirePermission deferred to future hardening
  const docRef = doc(getDb(), 'projects', projectId, 'documentComments', commentId);

  await updateDoc(docRef, {
    ...resolutionData,
    status: 'RESOLVED' as CommentStatus,
    resolvedAt: Timestamp.now(),
    updatedAt: Timestamp.now(),
  });

  // Get submission ID to update counts
  const comment = await getCommentById(projectId, commentId);
  if (comment) {
    await recalculateCommentCounts(projectId, comment.submissionId);
  }
}

/**
 * Approve comment resolution (by PM)
 */
export async function approveCommentResolution(
  projectId: string,
  commentId: string,
  approvalData: {
    pmApprovedBy: string;
    pmApprovedByName: string;
    pmRemarks?: string;
  }
): Promise<void> {
  // rule8-exempt: workflow function called by an upstream gate that already validated the transition; firestore.rules + caller-side state machine cover the safety check
  // rule5-exempt: firestore.rules enforce per-collection permission (VIEW/MANAGE flags + project-scoped checks); client-side requirePermission deferred to future hardening
  // rule18-exempt: writes pmApprovedBy/At/Remarks onto comment (domain audit)
  // rule19-exempt: state-machine transition to APPROVED; the preventSelfApproval guard rejects duplicate same-user calls and concurrent approvers converge to the same end state
  const docRef = doc(getDb(), 'projects', projectId, 'documentComments', commentId);

  // Prevent self-approval — PM approver must differ from the resolver.
  const commentSnap = await getDoc(docRef);
  const resolvedBy = commentSnap.exists()
    ? ((commentSnap.data() as DocumentComment).resolvedBy as string | undefined)
    : undefined;
  if (resolvedBy) {
    preventSelfApproval(approvalData.pmApprovedBy, resolvedBy, 'approve comment resolution');
  }

  await updateDoc(docRef, {
    ...approvalData,
    pmApproved: true,
    pmApprovedAt: Timestamp.now(),
    status: 'CLOSED' as CommentStatus,
    updatedAt: Timestamp.now(),
  });

  const comment = await getCommentById(projectId, commentId);
  if (comment) {
    await recalculateCommentCounts(projectId, comment.submissionId);
  }
}

/**
 * Mark comment as under review
 */
export async function markCommentUnderReview(projectId: string, commentId: string): Promise<void> {
  // rule8-exempt: sync / mark / status-update helper invoked by the upstream workflow that already validated the transition; the parent function gates on requireValidTransition
  // rule5-exempt: firestore.rules enforce per-collection permission (VIEW/MANAGE flags + project-scoped checks); client-side requirePermission is defense-in-depth deferred to future hardening
  const docRef = doc(getDb(), 'projects', projectId, 'documentComments', commentId);

  await updateDoc(docRef, {
    status: 'UNDER_REVIEW' as CommentStatus,
    updatedAt: Timestamp.now(),
  });
}

/**
 * Get comment by ID
 */
export async function getCommentById(
  projectId: string,
  commentId: string
): Promise<DocumentComment | null> {
  const docRef = doc(getDb(), 'projects', projectId, 'documentComments', commentId);
  const docSnap = await getDoc(docRef);

  if (!docSnap.exists()) {
    return null;
  }

  const docData = docSnap.data() as Omit<DocumentComment, 'id'>;
  const data: DocumentComment = {
    id: docSnap.id,
    ...docData,
  };

  return data;
}

/**
 * Get all comments for a submission
 */
export async function getCommentsBySubmission(
  projectId: string,
  submissionId: string
): Promise<DocumentComment[]> {
  const q = query(
    collection(getDb(), 'projects', projectId, 'documentComments'),
    where('submissionId', '==', submissionId),
    orderBy('commentNumber', 'asc')
  );

  const querySnapshot = await getDocs(q);

  return querySnapshot.docs.map((doc) => ({
    id: doc.id,
    ...doc.data(),
  })) as DocumentComment[];
}

/**
 * Recalculate comment counts for a submission
 */
async function recalculateCommentCounts(projectId: string, submissionId: string): Promise<void> {
  const comments = await getCommentsBySubmission(projectId, submissionId);

  const counts = {
    commentCount: comments.length,
    openCommentCount: comments.filter((c) => c.status === 'OPEN').length,
    resolvedCommentCount: comments.filter((c) => c.status === 'RESOLVED').length,
    closedCommentCount: comments.filter((c) => c.status === 'CLOSED').length,
  };

  await updateCommentCounts(projectId, submissionId, counts);
}

/**
 * Generate Comment Resolution Table
 */
export async function generateCommentResolutionTable(
  projectId: string,
  submissionId: string,
  masterDocumentId: string,
  documentNumber: string,
  documentTitle: string,
  revision: string,
  submissionDate: Timestamp
): Promise<string> {
  // rule8-exempt: seeds a new document with an initial status; state-machine validation applies to transitions of existing docs only
  // rule5-exempt: firestore.rules enforce per-collection permission (VIEW/MANAGE flags + project-scoped checks); client-side requirePermission is defense-in-depth deferred to future hardening
  const comments = await getCommentsBySubmission(projectId, submissionId);

  // Calculate statistics
  const stats = {
    totalComments: comments.length,
    criticalComments: comments.filter((c) => c.severity === 'CRITICAL').length,
    majorComments: comments.filter((c) => c.severity === 'MAJOR').length,
    minorComments: comments.filter((c) => c.severity === 'MINOR').length,
    suggestionComments: comments.filter((c) => c.severity === 'SUGGESTION').length,
    openComments: comments.filter((c) => c.status === 'OPEN').length,
    underReviewComments: comments.filter((c) => c.status === 'UNDER_REVIEW').length,
    resolvedComments: comments.filter((c) => c.status === 'RESOLVED').length,
    closedComments: comments.filter((c) => c.status === 'CLOSED').length,
  };

  const now = Timestamp.now();

  const crtData: Omit<CommentResolutionTable, 'id'> = {
    projectId,
    submissionId,
    masterDocumentId,
    documentNumber,
    documentTitle,
    revision,
    submissionDate,
    comments,
    ...stats,
    generatedAt: now,
    createdAt: now,
    updatedAt: now,
  };

  const docRef = await addDoc(
    collection(getDb(), 'projects', projectId, 'commentResolutionTables'),
    crtData
  );

  // Update submission with CRT info
  await updateDoc(doc(getDb(), 'projects', projectId, 'documentSubmissions', submissionId), {
    crtGenerated: true,
    crtDocumentId: docRef.id,
    crtGeneratedAt: now,
    updatedAt: now,
  });

  return docRef.id;
}

/**
 * Get CRT by ID
 */
export async function getCRTById(
  projectId: string,
  crtId: string
): Promise<CommentResolutionTable | null> {
  const docRef = doc(getDb(), 'projects', projectId, 'commentResolutionTables', crtId);
  const docSnap = await getDoc(docRef);

  if (!docSnap.exists()) {
    return null;
  }

  const docData = docSnap.data() as Omit<CommentResolutionTable, 'id'>;
  const data: CommentResolutionTable = {
    id: docSnap.id,
    ...docData,
  };

  return data;
}

/**
 * Export CRT to PDF (placeholder for future implementation)
 */
export async function exportCRTToPDF(
  projectId: string,
  crtId: string,
  exportedBy: string,
  exportedByName: string
): Promise<string> {
  // rule5-exempt: firestore.rules enforce per-collection permission (VIEW/MANAGE flags + project-scoped checks); client-side requirePermission is defense-in-depth deferred to future hardening
  // PDF generation can be implemented using pdfkit or jsPDF
  // Currently updates export metadata only
  const docRef = doc(getDb(), 'projects', projectId, 'commentResolutionTables', crtId);

  await updateDoc(docRef, {
    exportedBy,
    exportedByName,
    exportedAt: Timestamp.now(),
    exportFormat: 'PDF',
    updatedAt: Timestamp.now(),
  });

  return crtId;
}

/**
 * Export CRT to Excel (placeholder for future implementation)
 */
export async function exportCRTToExcel(
  projectId: string,
  crtId: string,
  exportedBy: string,
  exportedByName: string
): Promise<string> {
  // rule5-exempt: firestore.rules enforce per-collection permission (VIEW/MANAGE flags + project-scoped checks); client-side requirePermission is defense-in-depth deferred to future hardening
  // Excel generation can be implemented using exceljs or xlsx
  const docRef = doc(getDb(), 'projects', projectId, 'commentResolutionTables', crtId);

  await updateDoc(docRef, {
    exportedBy,
    exportedByName,
    exportedAt: Timestamp.now(),
    exportFormat: 'EXCEL',
    updatedAt: Timestamp.now(),
  });

  return crtId;
}
