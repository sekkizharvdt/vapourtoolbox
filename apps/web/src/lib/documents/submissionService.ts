/**
 * Document Submission Service
 *
 * Handles document submission operations:
 * - Multi-file upload to Firebase Storage
 * - Creating DocumentRecord entries
 * - Creating DocumentSubmission entries with file array
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
import { docToTyped } from '@/lib/firebase/typeHelpers';
import { createLogger } from '@vapour/logger';
import type {
  DocumentRecord,
  DocumentSubmission,
  MasterDocumentEntry,
  SubmissionFile,
  SubmissionFileType,
} from '@vapour/types';

const logger = createLogger({ context: 'submissionService' });

/**
 * File data for submission
 */
export interface SubmissionFileData {
  file: File;
  fileType: SubmissionFileType;
  isPrimary: boolean;
}

/**
 * Submit a new document revision (multi-file support)
 */
export interface SubmitDocumentRequest {
  projectId: string;
  masterDocumentId: string;
  masterDocument: MasterDocumentEntry;
  files: SubmissionFileData[];
  revision: string;
  submissionNotes?: string;
  clientVisible: boolean;
  submittedBy: string;
  submittedByName: string;
  reviewerId?: string;
}

/**
 * Legacy single-file request (backward compatibility)
 */
export interface SubmitDocumentRequestLegacy {
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
  file: File,
  fileType: SubmissionFileType
): Promise<{ downloadUrl: string; filePath: string; fileSize: number }> {
  // Construct storage path: projects/{projectId}/documents/{documentNumber}/{revision}/{fileType}/{filename}
  const sanitizedDocNumber = documentNumber.replace(/\//g, '-');
  const timestamp = Date.now();
  const fileName = `${timestamp}_${file.name}`;
  const filePath = `projects/${projectId}/documents/${sanitizedDocNumber}/${revision}/${fileType.toLowerCase()}/${fileName}`;

  const storageRef = ref(storage, filePath);
  const snapshot = await uploadBytes(storageRef, file, {
    contentType: file.type,
    customMetadata: {
      originalName: file.name,
      documentNumber: documentNumber,
      revision: revision,
      fileType: fileType,
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
 * Create DocumentSubmission entry with multiple files
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
    primaryDocumentId: string;
    files: SubmissionFile[];
    submittedBy: string;
    submittedByName: string;
    submissionNotes?: string;
  }
): Promise<string> {
  const primaryFile = data.files.find((f) => f.isPrimary);

  const submission: Omit<DocumentSubmission, 'id'> = {
    projectId: data.projectId,
    masterDocumentId: data.masterDocumentId,
    documentNumber: data.documentNumber,
    documentTitle: data.documentTitle,

    // Submission Info
    submissionNumber: data.submissionNumber,
    revision: data.revision,
    documentId: data.primaryDocumentId, // Backward compatibility

    // Multiple files
    files: data.files,
    primaryFileId: primaryFile?.id,

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
 * Generate unique file ID
 */
function generateFileId(): string {
  return `file_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`;
}

/**
 * Main submission function (multi-file support)
 * Orchestrates the entire submission process
 */
export async function submitDocument(
  db: Firestore,
  storage: FirebaseStorage,
  request: SubmitDocumentRequest
): Promise<{ submissionId: string; documentId: string; fileIds: string[] }> {
  try {
    const uploadedFiles: SubmissionFile[] = [];
    let primaryDocumentId = '';
    const fileIds: string[] = [];

    // 1. Upload all files to Firebase Storage
    for (const fileData of request.files) {
      const { downloadUrl, filePath, fileSize } = await uploadDocumentFile(
        storage,
        request.projectId,
        request.masterDocument.documentNumber,
        request.revision,
        fileData.file,
        fileData.fileType
      );

      // 2. Create DocumentRecord for primary file (backward compat)
      let documentRecordId: string | undefined;
      if (fileData.isPrimary) {
        documentRecordId = await createDocumentRecord(db, {
          projectId: request.projectId,
          documentNumber: request.masterDocument.documentNumber,
          documentTitle: request.masterDocument.documentTitle,
          revision: request.revision,
          downloadUrl,
          filePath,
          fileName: fileData.file.name,
          fileSize,
          fileType: fileData.file.type || 'application/octet-stream',
          submittedBy: request.submittedBy,
          submittedByName: request.submittedByName,
        });
        primaryDocumentId = documentRecordId;
      }

      const fileId = generateFileId();
      fileIds.push(fileId);

      uploadedFiles.push({
        id: fileId,
        fileType: fileData.fileType,
        fileName: fileData.file.name,
        fileUrl: downloadUrl,
        storagePath: filePath,
        fileSize: fileSize,
        mimeType: fileData.file.type || 'application/octet-stream',
        isPrimary: fileData.isPrimary,
        documentRecordId,
        uploadedAt: Timestamp.now(),
      });
    }

    // Ensure we have a primary document ID
    if (!primaryDocumentId && uploadedFiles.length > 0) {
      // Create DocumentRecord for first file if no primary was set
      const firstFile = uploadedFiles[0]!;
      primaryDocumentId = await createDocumentRecord(db, {
        projectId: request.projectId,
        documentNumber: request.masterDocument.documentNumber,
        documentTitle: request.masterDocument.documentTitle,
        revision: request.revision,
        downloadUrl: firstFile.fileUrl,
        filePath: firstFile.storagePath,
        fileName: firstFile.fileName,
        fileSize: firstFile.fileSize,
        fileType: firstFile.mimeType,
        submittedBy: request.submittedBy,
        submittedByName: request.submittedByName,
      });
      firstFile.documentRecordId = primaryDocumentId;
      firstFile.isPrimary = true;
    }

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
      primaryDocumentId,
      files: uploadedFiles,
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
        logger.error('Error creating reviewer notification', {
          masterDocumentId: request.masterDocumentId,
          reviewerId: request.reviewerId,
          error: notificationError,
        });
        // Don't fail the submission if notification fails
      }
    }

    return { submissionId, documentId: primaryDocumentId, fileIds };
  } catch (error) {
    logger.error('Error submitting document', {
      masterDocumentId: request.masterDocumentId,
      revision: request.revision,
      error,
    });
    throw new Error(
      error instanceof Error
        ? `Failed to submit document: ${error.message}`
        : 'Failed to submit document'
    );
  }
}

/**
 * Legacy submission function (single file)
 * Converts to multi-file format for backward compatibility
 */
export async function submitDocumentLegacy(
  db: Firestore,
  storage: FirebaseStorage,
  request: SubmitDocumentRequestLegacy
): Promise<{ submissionId: string; documentId: string }> {
  const multiFileRequest: SubmitDocumentRequest = {
    ...request,
    files: [
      {
        file: request.file,
        fileType: request.file.type === 'application/pdf' ? 'PDF' : 'NATIVE',
        isPrimary: true,
      },
    ],
  };

  const result = await submitDocument(db, storage, multiFileRequest);
  return { submissionId: result.submissionId, documentId: result.documentId };
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
    submissions.push(docToTyped<DocumentSubmission>(doc.id, doc.data()));
  });

  return submissions;
}
