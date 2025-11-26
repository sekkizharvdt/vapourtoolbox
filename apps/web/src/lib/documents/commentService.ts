/**
 * Document Comment Service
 *
 * Handles document comment operations:
 * - Creating comments
 * - Resolving comments (2-level workflow)
 * - PM approval/rejection
 * - Comment number generation
 * - Comment counts and statistics
 */

import {
  collection,
  doc,
  getDoc,
  addDoc,
  updateDoc,
  getDocs,
  query,
  where,
  orderBy,
  Timestamp,
  type Firestore,
  increment,
} from 'firebase/firestore';
import type {
  DocumentComment,
  CommentSeverity,
  CommentCategory,
  CommentStatus,
} from '@vapour/types';

/**
 * Generate next comment number for a document
 * Format: C-001, C-002, etc.
 */
async function generateCommentNumber(
  db: Firestore,
  projectId: string,
  masterDocumentId: string
): Promise<string> {
  const commentsRef = collection(db, 'projects', projectId, 'documentComments');
  const q = query(
    commentsRef,
    where('masterDocumentId', '==', masterDocumentId),
    orderBy('commentNumber', 'desc')
  );

  const snapshot = await getDocs(q);

  if (snapshot.empty) {
    return 'C-001';
  }

  const lastComment = snapshot.docs[0]?.data() as DocumentComment | undefined;
  if (!lastComment) {
    return 'C-001';
  }

  // Extract number and increment
  const match = lastComment.commentNumber.match(/C-(\d+)/);
  if (!match || !match[1]) {
    return 'C-001';
  }

  const nextNumber = parseInt(match[1], 10) + 1;
  return `C-${nextNumber.toString().padStart(3, '0')}`;
}

/**
 * Create a new comment
 */
export interface CreateCommentRequest {
  projectId: string;
  masterDocumentId: string;
  submissionId: string;
  commentText: string;
  severity: CommentSeverity;
  category: CommentCategory;
  pageNumber?: number;
  section?: string;
  lineItem?: string;
  commentedBy: string;
  commentedByName: string;
}

export async function createComment(db: Firestore, request: CreateCommentRequest): Promise<string> {
  // Generate comment number
  const commentNumber = await generateCommentNumber(
    db,
    request.projectId,
    request.masterDocumentId
  );

  const comment: Omit<DocumentComment, 'id'> = {
    projectId: request.projectId,
    submissionId: request.submissionId,
    masterDocumentId: request.masterDocumentId,

    // Comment Identification
    commentNumber,
    commentText: request.commentText,

    // Classification
    severity: request.severity,
    category: request.category,

    // Location in Document
    pageNumber: request.pageNumber,
    section: request.section,
    lineItem: request.lineItem,

    // Client Info
    commentedBy: request.commentedBy,
    commentedByName: request.commentedByName,
    commentedAt: Timestamp.now(),

    // Resolution Workflow
    status: 'OPEN' as CommentStatus,

    // PM Approval
    pmApproved: false,

    // Client Acceptance
    clientAccepted: false,

    // Attachments
    attachments: [],

    // Audit
    createdAt: Timestamp.now(),
    updatedAt: Timestamp.now(),
  };

  const commentsRef = collection(db, 'projects', request.projectId, 'documentComments');
  const docRef = await addDoc(commentsRef, comment);

  // Update submission comment counts
  await updateSubmissionCommentCounts(db, request.projectId, request.submissionId, {
    commentCount: increment(1),
    openCommentCount: increment(1),
  });

  return docRef.id;
}

/**
 * Resolve a comment (Level 1: Assignee)
 */
export interface ResolveCommentRequest {
  projectId: string;
  submissionId: string;
  commentId: string;
  resolutionText: string;
  resolvedBy: string;
  resolvedByName: string;
}

export async function resolveComment(db: Firestore, request: ResolveCommentRequest): Promise<void> {
  const commentRef = doc(db, 'projects', request.projectId, 'documentComments', request.commentId);

  // Get current comment to check previous status
  const commentSnapshot = await getDoc(commentRef);
  const currentComment = commentSnapshot.data() as DocumentComment;
  const previousStatus = currentComment.status;

  await updateDoc(commentRef, {
    status: 'RESOLVED',
    resolutionText: request.resolutionText,
    resolvedBy: request.resolvedBy,
    resolvedByName: request.resolvedByName,
    resolvedAt: Timestamp.now(),
    updatedAt: Timestamp.now(),
  });

  // Update submission comment counts
  const updates: Record<string, unknown> = {
    resolvedCommentCount: increment(1),
  };

  if (previousStatus === 'OPEN') {
    updates.openCommentCount = increment(-1);
  } else if (previousStatus === 'UNDER_REVIEW') {
    // Decrement under review count if needed
    // For now, we're just incrementing resolved
  }

  await updateSubmissionCommentCounts(db, request.projectId, request.submissionId, updates);
}

/**
 * Approve comment resolution (Level 2: PM)
 */
export interface ApproveResolutionRequest {
  projectId: string;
  submissionId: string;
  commentId: string;
  pmApprovedBy: string;
  pmApprovedByName: string;
  pmRemarks?: string;
}

export async function approveCommentResolution(
  db: Firestore,
  request: ApproveResolutionRequest
): Promise<void> {
  const commentRef = doc(db, 'projects', request.projectId, 'documentComments', request.commentId);

  await updateDoc(commentRef, {
    status: 'CLOSED',
    pmApproved: true,
    pmApprovedBy: request.pmApprovedBy,
    pmApprovedByName: request.pmApprovedByName,
    pmApprovedAt: Timestamp.now(),
    pmRemarks: request.pmRemarks,
    updatedAt: Timestamp.now(),
  });

  // Update submission comment counts
  await updateSubmissionCommentCounts(db, request.projectId, request.submissionId, {
    resolvedCommentCount: increment(-1),
    closedCommentCount: increment(1),
  });
}

/**
 * Reject comment resolution (PM sends back to assignee)
 */
export interface RejectResolutionRequest {
  projectId: string;
  submissionId: string;
  commentId: string;
  pmRemarks: string;
}

export async function rejectCommentResolution(
  db: Firestore,
  request: RejectResolutionRequest
): Promise<void> {
  const commentRef = doc(db, 'projects', request.projectId, 'documentComments', request.commentId);

  await updateDoc(commentRef, {
    status: 'UNDER_REVIEW', // Send back to under review
    pmRemarks: request.pmRemarks,
    updatedAt: Timestamp.now(),
  });

  // Update submission comment counts
  await updateSubmissionCommentCounts(db, request.projectId, request.submissionId, {
    resolvedCommentCount: increment(-1),
    // Note: Not incrementing any other count as we're just moving to under_review
  });
}

/**
 * Mark comment as under review (assignee has started working)
 */
export async function markCommentUnderReview(
  db: Firestore,
  projectId: string,
  submissionId: string,
  commentId: string
): Promise<void> {
  const commentRef = doc(db, 'projects', projectId, 'documentComments', commentId);

  await updateDoc(commentRef, {
    status: 'UNDER_REVIEW',
    updatedAt: Timestamp.now(),
  });

  // Update submission comment counts
  await updateSubmissionCommentCounts(db, projectId, submissionId, {
    openCommentCount: increment(-1),
    // Note: Not tracking under_review count in submission for simplicity
  });
}

/**
 * Helper: Update submission comment counts
 */
async function updateSubmissionCommentCounts(
  db: Firestore,
  projectId: string,
  submissionId: string,
  updates: Record<string, unknown>
): Promise<void> {
  const submissionRef = doc(db, 'projects', projectId, 'documentSubmissions', submissionId);

  await updateDoc(submissionRef, {
    ...updates,
    updatedAt: Timestamp.now(),
  });
}

/**
 * Get comments for a document
 */
export async function getDocumentComments(
  db: Firestore,
  projectId: string,
  masterDocumentId: string,
  status?: CommentStatus
): Promise<DocumentComment[]> {
  const commentsRef = collection(db, 'projects', projectId, 'documentComments');

  let q;
  if (status) {
    q = query(
      commentsRef,
      where('masterDocumentId', '==', masterDocumentId),
      where('status', '==', status),
      orderBy('commentNumber', 'asc')
    );
  } else {
    q = query(
      commentsRef,
      where('masterDocumentId', '==', masterDocumentId),
      orderBy('commentNumber', 'asc')
    );
  }

  const snapshot = await getDocs(q);
  const comments: DocumentComment[] = [];

  snapshot.forEach((doc) => {
    comments.push({ id: doc.id, ...doc.data() } as DocumentComment);
  });

  return comments;
}

/**
 * Get comments for a specific submission
 */
export async function getSubmissionComments(
  db: Firestore,
  projectId: string,
  submissionId: string
): Promise<DocumentComment[]> {
  const commentsRef = collection(db, 'projects', projectId, 'documentComments');
  const q = query(
    commentsRef,
    where('submissionId', '==', submissionId),
    orderBy('commentNumber', 'asc')
  );

  const snapshot = await getDocs(q);
  const comments: DocumentComment[] = [];

  snapshot.forEach((doc) => {
    comments.push({ id: doc.id, ...doc.data() } as DocumentComment);
  });

  return comments;
}
