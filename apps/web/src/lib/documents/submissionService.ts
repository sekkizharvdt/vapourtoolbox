/**
 * Document Submission Service
 *
 * Handles document submission operations:
 * - File upload to Firebase Storage
 * - Creating DocumentRecord entries
 * - Creating DocumentSubmission entries
 * - Updating MasterDocumentEntry metadata
 */

import {
  collection,
  doc,
  addDoc,
  updateDoc,
  getDocs,
  query,
  where,
  orderBy,
  Timestamp,
  type Firestore,
} from 'firebase/firestore';
import { ref, uploadBytes, getDownloadURL, type FirebaseStorage } from 'firebase/storage';
import type { DocumentRecord, DocumentSubmission, MasterDocumentEntry } from '@vapour/types';

/**
 * Submit a new document revision
 */
export interface SubmitDocumentRequest {
  projectId: string;
  masterDocumentId: string;
  masterDocument: MasterDocumentEntry;
  file: File;
  revision: string;
  submissionNotes?: string;
  clientVisible: boolean;
  submittedBy: string;
  submittedByName: string;
  reviewerId?: string;
}

/**
 * Upload file to Firebase Storage
 */
async function uploadDocumentFile(
  storage: FirebaseStorage,
  projectId: string,
  documentNumber: string,
  revision: string,
  file: File
): Promise<{ downloadUrl: string; filePath: string; fileSize: number }> {
  // Construct storage path: projects/{projectId}/documents/{documentNumber}/{revision}/{filename}
  const sanitizedDocNumber = documentNumber.replace(/\//g, '-');
  const timestamp = Date.now();
  const fileName = `${timestamp}_${file.name}`;
  const filePath = `projects/${projectId}/documents/${sanitizedDocNumber}/${revision}/${fileName}`;

  const storageRef = ref(storage, filePath);
  const snapshot = await uploadBytes(storageRef, file, {
    contentType: file.type,
    customMetadata: {
      originalName: file.name,
      documentNumber: documentNumber,
      revision: revision,
      uploadedAt: new Date().toISOString(),
    },
  });

  const downloadUrl = await getDownloadURL(snapshot.ref);

  return {
    downloadUrl,
    filePath,
    fileSize: file.size,
  };
}

/**
 * Create DocumentRecord entry
 */
async function createDocumentRecord(
  db: Firestore,
  data: {
    projectId: string;
    documentNumber: string;
    documentTitle: string;
    revision: string;
    downloadUrl: string;
    filePath: string;
    fileName: string;
    fileSize: number;
    fileType: string;
    submittedBy: string;
    submittedByName: string;
  }
): Promise<string> {
  // Extract file extension from file name
  const fileExtension = data.fileName.split('.').pop()?.toLowerCase() || 'pdf';

  const documentRecord: Omit<DocumentRecord, 'id'> = {
    // File information
    fileName: data.fileName,
    fileUrl: data.downloadUrl,
    storageRef: data.filePath,
    fileSize: data.fileSize,
    mimeType: data.fileType || 'application/octet-stream',
    fileExtension,

    // Categorization
    module: 'PROJECTS' as const,
    documentType: 'TECHNICAL_DRAWING' as const,

    // Multi-level linking
    projectId: data.projectId,
    // projectName and projectCode omitted - will be denormalized later if needed

    // Primary entity linkage
    entityType: 'PROJECT' as const,
    entityId: data.projectId,
    // entityNumber omitted

    // Version control
    version: parseInt(data.revision.replace('R', ''), 10) || 0,
    isLatest: true,
    revisionNotes: `Submission ${data.revision}`,

    // Metadata
    title: data.documentTitle,
    // description omitted
    tags: [],

    // Status
    status: 'ACTIVE' as const,

    // Access control
    visibility: 'PROJECT_TEAM' as const,

    // Download tracking
    downloadCount: 0,

    // Workflow
    uploadedBy: data.submittedBy,
    uploadedByName: data.submittedByName,
    uploadedAt: Timestamp.now(),

    // Timestamps
    createdAt: Timestamp.now(),
    updatedAt: Timestamp.now(),
  };

  const docRef = await addDoc(collection(db, 'documents'), documentRecord);
  return docRef.id;
}

/**
 * Get next submission number
 */
async function getNextSubmissionNumber(
  db: Firestore,
  projectId: string,
  masterDocumentId: string
): Promise<number> {
  const submissionsRef = collection(db, 'projects', projectId, 'documentSubmissions');
  const q = query(
    submissionsRef,
    where('masterDocumentId', '==', masterDocumentId),
    orderBy('submissionNumber', 'desc')
  );

  const snapshot = await getDocs(q);

  if (snapshot.empty) {
    return 1;
  }

  const lastSubmission = snapshot.docs[0]?.data() as DocumentSubmission | undefined;
  if (!lastSubmission) {
    return 1;
  }

  return lastSubmission.submissionNumber + 1;
}

/**
 * Create DocumentSubmission entry
 */
async function createDocumentSubmission(
  db: Firestore,
  data: {
    projectId: string;
    masterDocumentId: string;
    documentNumber: string;
    documentTitle: string;
    submissionNumber: number;
    revision: string;
    documentId: string;
    submittedBy: string;
    submittedByName: string;
    submissionNotes?: string;
  }
): Promise<string> {
  const submission: Omit<DocumentSubmission, 'id'> = {
    projectId: data.projectId,
    masterDocumentId: data.masterDocumentId,
    documentNumber: data.documentNumber,
    documentTitle: data.documentTitle,

    // Submission Info
    submissionNumber: data.submissionNumber,
    revision: data.revision,
    documentId: data.documentId,

    // Submission
    submittedBy: data.submittedBy,
    submittedByName: data.submittedByName,
    submittedAt: Timestamp.now(),
    submissionNotes: data.submissionNotes,

    // Client Response
    clientStatus: 'PENDING' as const,

    // Comments
    commentCount: 0,
    openCommentCount: 0,
    resolvedCommentCount: 0,
    closedCommentCount: 0,

    // Comment Resolution Table
    crtGenerated: false,

    // Next Actions
    requiresResubmission: false,

    // Timestamps
    createdAt: Timestamp.now(),
    updatedAt: Timestamp.now(),
  };

  const submissionsRef = collection(db, 'projects', data.projectId, 'documentSubmissions');
  const docRef = await addDoc(submissionsRef, submission);
  return docRef.id;
}

/**
 * Update MasterDocumentEntry with new submission
 */
async function updateMasterDocument(
  db: Firestore,
  projectId: string,
  masterDocumentId: string,
  revision: string,
  submissionCount: number
): Promise<void> {
  const masterDocRef = doc(db, 'projects', projectId, 'masterDocuments', masterDocumentId);

  await updateDoc(masterDocRef, {
    currentRevision: revision,
    submissionCount: submissionCount,
    status: 'SUBMITTED',
    updatedAt: Timestamp.now(),
  });
}

/**
 * Main submission function
 * Orchestrates the entire submission process
 */
export async function submitDocument(
  db: Firestore,
  storage: FirebaseStorage,
  request: SubmitDocumentRequest
): Promise<{ submissionId: string; documentId: string }> {
  try {
    // 1. Upload file to Firebase Storage
    const { downloadUrl, filePath, fileSize } = await uploadDocumentFile(
      storage,
      request.projectId,
      request.masterDocument.documentNumber,
      request.revision,
      request.file
    );

    // 2. Create DocumentRecord
    const documentId = await createDocumentRecord(db, {
      projectId: request.projectId,
      documentNumber: request.masterDocument.documentNumber,
      documentTitle: request.masterDocument.documentTitle,
      revision: request.revision,
      downloadUrl,
      filePath,
      fileName: request.file.name,
      fileSize,
      fileType: request.file.type || 'application/octet-stream',
      submittedBy: request.submittedBy,
      submittedByName: request.submittedByName,
    });

    // 3. Get next submission number
    const submissionNumber = await getNextSubmissionNumber(
      db,
      request.projectId,
      request.masterDocumentId
    );

    // 4. Create DocumentSubmission
    const submissionId = await createDocumentSubmission(db, {
      projectId: request.projectId,
      masterDocumentId: request.masterDocumentId,
      documentNumber: request.masterDocument.documentNumber,
      documentTitle: request.masterDocument.documentTitle,
      submissionNumber,
      revision: request.revision,
      documentId,
      submittedBy: request.submittedBy,
      submittedByName: request.submittedByName,
      submissionNotes: request.submissionNotes,
    });

    // 5. Update MasterDocumentEntry
    await updateMasterDocument(
      db,
      request.projectId,
      request.masterDocumentId,
      request.revision,
      submissionNumber
    );

    // 6. Create task notification for assigned reviewer
    if (request.reviewerId) {
      try {
        const { createTaskNotification } = await import('@/lib/tasks/taskNotificationService');
        await createTaskNotification({
          type: 'actionable',
          category: 'DOCUMENT_INTERNAL_REVIEW',
          userId: request.reviewerId,
          assignedBy: request.submittedBy,
          assignedByName: request.submittedByName,
          title: `Review Document: ${request.masterDocument.documentNumber}`,
          message: `${request.submittedByName} submitted ${request.masterDocument.documentTitle} (${request.revision}) for your review`,
          entityType: 'DOCUMENT',
          entityId: request.masterDocumentId,
          linkUrl: `/documents/${request.masterDocumentId}?tab=submit`,
          priority: 'MEDIUM',
          autoCompletable: true,
          projectId: request.projectId,
        });
      } catch (notificationError) {
        console.error(
          '[SubmissionService] Error creating reviewer notification:',
          notificationError
        );
        // Don't fail the submission if notification fails
      }
    }

    return { submissionId, documentId };
  } catch (error) {
    console.error('[SubmissionService] Error submitting document:', error);
    throw new Error(
      error instanceof Error
        ? `Failed to submit document: ${error.message}`
        : 'Failed to submit document'
    );
  }
}

/**
 * Get submissions for a master document
 */
export async function getDocumentSubmissions(
  db: Firestore,
  projectId: string,
  masterDocumentId: string
): Promise<DocumentSubmission[]> {
  const submissionsRef = collection(db, 'projects', projectId, 'documentSubmissions');
  const q = query(
    submissionsRef,
    where('masterDocumentId', '==', masterDocumentId),
    orderBy('submissionNumber', 'desc')
  );

  const snapshot = await getDocs(q);
  const submissions: DocumentSubmission[] = [];

  snapshot.forEach((doc) => {
    submissions.push({ id: doc.id, ...doc.data() } as DocumentSubmission);
  });

  return submissions;
}
