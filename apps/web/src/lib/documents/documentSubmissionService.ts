/**
 * Document Submission Service
 *
 * Manages document submissions to clients
 * Tracks revision history and client review status
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
import type { DocumentSubmission, ClientReviewStatus } from '@vapour/types';

/**
 * Submit document to client
 */
export async function submitDocumentToClient(
  data: Omit<
    DocumentSubmission,
    'id' | 'createdAt' | 'updatedAt' | 'submissionNumber'
  >
): Promise<string> {
  // Get submission number (count existing submissions + 1)
  const existing = await getSubmissionsByMasterDocument(data.projectId, data.masterDocumentId);
  const submissionNumber = existing.length + 1;

  const now = Timestamp.now();

  const submissionData: Omit<DocumentSubmission, 'id'> = {
    ...data,
    submissionNumber,
    createdAt: now,
    updatedAt: now,
  };

  const docRef = await addDoc(
    collection(db, 'projects', data.projectId, 'documentSubmissions'),
    submissionData
  );

  // Update master document submission tracking
  await updateDoc(
    doc(db, 'projects', data.projectId, 'masterDocuments', data.masterDocumentId),
    {
      submissionCount: submissionNumber,
      lastSubmissionId: docRef.id,
      lastSubmissionDate: now,
      status: 'SUBMITTED',
      updatedAt: now,
    }
  );

  return docRef.id;
}

/**
 * Record client review
 */
export async function recordClientReview(
  projectId: string,
  submissionId: string,
  reviewData: {
    clientStatus: ClientReviewStatus;
    clientReviewedBy: string;
    clientReviewedByName: string;
    clientRemarks?: string;
  }
): Promise<void> {
  const docRef = doc(db, 'projects', projectId, 'documentSubmissions', submissionId);

  await updateDoc(docRef, {
    ...reviewData,
    clientReviewedAt: Timestamp.now(),
    updatedAt: Timestamp.now(),
  });
}

/**
 * Create resubmission
 */
export async function createResubmission(
  projectId: string,
  previousSubmissionId: string,
  newDocumentId: string,
  newRevision: string,
  submittedBy: string,
  submittedByName: string
): Promise<string> {
  const previousSubmission = await getSubmissionById(projectId, previousSubmissionId);

  if (!previousSubmission) {
    throw new Error('Previous submission not found');
  }

  const newSubmissionId = await submitDocumentToClient({
    projectId,
    masterDocumentId: previousSubmission.masterDocumentId,
    documentNumber: previousSubmission.documentNumber,
    documentTitle: previousSubmission.documentTitle,
    revision: newRevision,
    documentId: newDocumentId,
    submittedBy,
    submittedByName,
    clientStatus: 'PENDING',
    commentCount: 0,
    openCommentCount: 0,
    resolvedCommentCount: 0,
    closedCommentCount: 0,
    crtGenerated: false,
    requiresResubmission: false,
    previousSubmissionId,
  });

  // Link previous submission to new one
  await updateDoc(
    doc(db, 'projects', projectId, 'documentSubmissions', previousSubmissionId),
    {
      nextSubmissionId: newSubmissionId,
      updatedAt: Timestamp.now(),
    }
  );

  return newSubmissionId;
}

/**
 * Get submission by ID
 */
export async function getSubmissionById(
  projectId: string,
  submissionId: string
): Promise<DocumentSubmission | null> {
  const docRef = doc(db, 'projects', projectId, 'documentSubmissions', submissionId);
  const docSnap = await getDoc(docRef);

  if (!docSnap.exists()) {
    return null;
  }

  return {
    id: docSnap.id,
    ...docSnap.data(),
  } as DocumentSubmission;
}

/**
 * Get all submissions for a master document
 */
export async function getSubmissionsByMasterDocument(
  projectId: string,
  masterDocumentId: string
): Promise<DocumentSubmission[]> {
  const q = query(
    collection(db, 'projects', projectId, 'documentSubmissions'),
    where('masterDocumentId', '==', masterDocumentId),
    orderBy('submissionNumber', 'desc')
  );

  const querySnapshot = await getDocs(q);

  return querySnapshot.docs.map((doc) => ({
    id: doc.id,
    ...doc.data(),
  })) as DocumentSubmission[];
}

/**
 * Get submission history (full chain)
 */
export async function getSubmissionHistory(
  projectId: string,
  masterDocumentId: string
): Promise<DocumentSubmission[]> {
  return await getSubmissionsByMasterDocument(projectId, masterDocumentId);
}

/**
 * Update comment counts
 */
export async function updateCommentCounts(
  projectId: string,
  submissionId: string,
  counts: {
    commentCount: number;
    openCommentCount: number;
    resolvedCommentCount: number;
    closedCommentCount: number;
  }
): Promise<void> {
  await updateDoc(
    doc(db, 'projects', projectId, 'documentSubmissions', submissionId),
    {
      ...counts,
      updatedAt: Timestamp.now(),
    }
  );
}
