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
import { db } from '@/lib/firebase/firebase';
import type {
  DocumentComment,
  CommentStatus,
  CommentSeverity,
  CommentCategory,
  CommentResolutionTable,
} from '@vapour/types';
import { updateCommentCounts } from './documentSubmissionService';

/**
 * Add a comment to a submission
 */
export async function addComment(
  data: Omit<DocumentComment, 'id' | 'createdAt' | 'updatedAt' | 'commentNumber'>
): Promise<string> {
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
    collection(db, 'projects', data.projectId, 'documentComments'),
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
  const docRef = doc(db, 'projects', projectId, 'documentComments', commentId);

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
  const docRef = doc(db, 'projects', projectId, 'documentComments', commentId);

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
export async function markCommentUnderReview(
  projectId: string,
  commentId: string
): Promise<void> {
  const docRef = doc(db, 'projects', projectId, 'documentComments', commentId);

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
  const docRef = doc(db, 'projects', projectId, 'documentComments', commentId);
  const docSnap = await getDoc(docRef);

  if (!docSnap.exists()) {
    return null;
  }

  return {
    id: docSnap.id,
    ...docSnap.data(),
  } as DocumentComment;
}

/**
 * Get all comments for a submission
 */
export async function getCommentsBySubmission(
  projectId: string,
  submissionId: string
): Promise<DocumentComment[]> {
  const q = query(
    collection(db, 'projects', projectId, 'documentComments'),
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
async function recalculateCommentCounts(
  projectId: string,
  submissionId: string
): Promise<void> {
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
    collection(db, 'projects', projectId, 'commentResolutionTables'),
    crtData
  );

  // Update submission with CRT info
  await updateDoc(
    doc(db, 'projects', projectId, 'documentSubmissions', submissionId),
    {
      crtGenerated: true,
      crtDocumentId: docRef.id,
      crtGeneratedAt: now,
      updatedAt: now,
    }
  );

  return docRef.id;
}

/**
 * Get CRT by ID
 */
export async function getCRTById(
  projectId: string,
  crtId: string
): Promise<CommentResolutionTable | null> {
  const docRef = doc(db, 'projects', projectId, 'commentResolutionTables', crtId);
  const docSnap = await getDoc(docRef);

  if (!docSnap.exists()) {
    return null;
  }

  return {
    id: docSnap.id,
    ...docSnap.data(),
  } as CommentResolutionTable;
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
  // TODO: Implement PDF generation using pdfkit or jsPDF
  // For now, just update the export info
  const docRef = doc(db, 'projects', projectId, 'commentResolutionTables', crtId);

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
  // TODO: Implement Excel generation using exceljs or xlsx
  const docRef = doc(db, 'projects', projectId, 'commentResolutionTables', crtId);

  await updateDoc(docRef, {
    exportedBy,
    exportedByName,
    exportedAt: Timestamp.now(),
    exportFormat: 'EXCEL',
    updatedAt: Timestamp.now(),
  });

  return crtId;
}
