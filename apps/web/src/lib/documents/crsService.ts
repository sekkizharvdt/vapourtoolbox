/**
 * Comment Resolution Sheet Service
 *
 * Handles uploading and managing Comment Resolution Sheets from clients.
 * CRS files are uploaded by users and can contain client feedback that
 * is manually entered as comments (or parsed by AI in the future).
 */

import type { Firestore } from 'firebase/firestore';
import {
  collection,
  addDoc,
  doc,
  getDoc,
  getDocs,
  query,
  where,
  orderBy,
  updateDoc,
  Timestamp,
} from 'firebase/firestore';
import { getStorage, ref, uploadBytesResumable, getDownloadURL } from 'firebase/storage';
import type {
  CommentResolutionSheet,
  MasterDocumentEntry,
  DocumentSubmission,
} from '@vapour/types';
import { createLogger } from '@vapour/logger';

const logger = createLogger({ context: 'crsService' });

export interface UploadCRSRequest {
  projectId: string;
  masterDocument: MasterDocumentEntry;
  submission: DocumentSubmission;
  file: File;
  uploadedBy: string;
  uploadedByName: string;
  onProgress?: (progress: number) => void;
}

export interface UploadCRSResult {
  crsId: string;
  fileUrl: string;
  storagePath: string;
}

/**
 * Upload a Comment Resolution Sheet for a document submission
 */
export async function uploadCommentResolutionSheet(
  db: Firestore,
  request: UploadCRSRequest
): Promise<UploadCRSResult> {
  const { projectId, masterDocument, submission, file, uploadedBy, uploadedByName, onProgress } =
    request;

  // Validate file
  if (!file) {
    throw new Error('No file provided');
  }

  const maxSize = 50 * 1024 * 1024; // 50MB
  if (file.size > maxSize) {
    throw new Error('File size exceeds 50MB limit');
  }

  // 1. Upload file to storage
  const storage = getStorage();
  const timestamp = Date.now();
  const sanitizedFileName = file.name.replace(/[^a-zA-Z0-9.-]/g, '_');
  const storagePath = `projects/${projectId}/documents/${masterDocument.id}/crs/${timestamp}_${sanitizedFileName}`;
  const storageRef = ref(storage, storagePath);

  const uploadTask = uploadBytesResumable(storageRef, file);

  // Track upload progress
  const fileUrl = await new Promise<string>((resolve, reject) => {
    uploadTask.on(
      'state_changed',
      (snapshot) => {
        const progress = (snapshot.bytesTransferred / snapshot.totalBytes) * 100;
        onProgress?.(progress);
      },
      (error) => {
        logger.error('CRS upload failed', {
          error,
          projectId,
          masterDocumentId: masterDocument.id,
        });
        reject(new Error(`Upload failed: ${error.message}`));
      },
      async () => {
        try {
          const url = await getDownloadURL(uploadTask.snapshot.ref);
          resolve(url);
        } catch (error) {
          reject(error);
        }
      }
    );
  });

  // 2. Create CRS record in Firestore
  const now = Timestamp.now();

  const crsData: Omit<CommentResolutionSheet, 'id'> = {
    projectId,
    masterDocumentId: masterDocument.id,
    submissionId: submission.id,

    // Denormalized document info
    documentNumber: masterDocument.documentNumber,
    documentTitle: masterDocument.documentTitle,
    revision: submission.revision,

    // File info
    fileName: file.name,
    fileUrl,
    storagePath,
    fileSize: file.size,
    mimeType: file.type || 'application/octet-stream',

    // Status
    status: 'PENDING',
    commentsExtracted: 0,

    // Upload info
    uploadedBy,
    uploadedByName,
    uploadedAt: now,

    // Audit
    createdAt: now,
    updatedAt: now,
  };

  const crsRef = collection(db, 'projects', projectId, 'commentResolutionSheets');
  const docRef = await addDoc(crsRef, crsData);

  return {
    crsId: docRef.id,
    fileUrl,
    storagePath,
  };
}

/**
 * Get all CRS for a master document
 */
export async function getCRSByMasterDocument(
  db: Firestore,
  projectId: string,
  masterDocumentId: string
): Promise<CommentResolutionSheet[]> {
  const crsRef = collection(db, 'projects', projectId, 'commentResolutionSheets');
  const q = query(
    crsRef,
    where('masterDocumentId', '==', masterDocumentId),
    orderBy('uploadedAt', 'desc')
  );

  const snapshot = await getDocs(q);
  const results: CommentResolutionSheet[] = [];

  snapshot.forEach((docSnap) => {
    const crs: CommentResolutionSheet = {
      id: docSnap.id,
      ...(docSnap.data() as Omit<CommentResolutionSheet, 'id'>),
    };
    results.push(crs);
  });

  return results;
}

/**
 * Get all CRS for a specific submission
 */
export async function getCRSBySubmission(
  db: Firestore,
  projectId: string,
  submissionId: string
): Promise<CommentResolutionSheet[]> {
  const crsRef = collection(db, 'projects', projectId, 'commentResolutionSheets');
  const q = query(crsRef, where('submissionId', '==', submissionId), orderBy('uploadedAt', 'desc'));

  const snapshot = await getDocs(q);
  const results: CommentResolutionSheet[] = [];

  snapshot.forEach((docSnap) => {
    const crs: CommentResolutionSheet = {
      id: docSnap.id,
      ...(docSnap.data() as Omit<CommentResolutionSheet, 'id'>),
    };
    results.push(crs);
  });

  return results;
}

/**
 * Get a single CRS by ID
 */
export async function getCRSById(
  db: Firestore,
  projectId: string,
  crsId: string
): Promise<CommentResolutionSheet | null> {
  const crsRef = doc(db, 'projects', projectId, 'commentResolutionSheets', crsId);
  const snapshot = await getDoc(crsRef);

  if (!snapshot.exists()) {
    return null;
  }

  const crs: CommentResolutionSheet = {
    id: snapshot.id,
    ...(snapshot.data() as Omit<CommentResolutionSheet, 'id'>),
  };
  return crs;
}

/**
 * Update CRS status
 */
export async function updateCRSStatus(
  db: Firestore,
  projectId: string,
  crsId: string,
  status: CommentResolutionSheet['status'],
  commentsExtracted?: number
): Promise<void> {
  const crsRef = doc(db, 'projects', projectId, 'commentResolutionSheets', crsId);
  const now = Timestamp.now();

  const updateData: Partial<CommentResolutionSheet> = {
    status,
    updatedAt: now,
  };

  if (commentsExtracted !== undefined) {
    updateData.commentsExtracted = commentsExtracted;
  }

  await updateDoc(crsRef, updateData);
}

/**
 * Mark CRS as completed (all comments extracted)
 */
export async function completeCRS(
  db: Firestore,
  projectId: string,
  crsId: string,
  commentsExtracted: number,
  processedBy: string,
  processingNotes?: string
): Promise<void> {
  const crsRef = doc(db, 'projects', projectId, 'commentResolutionSheets', crsId);
  const now = Timestamp.now();

  await updateDoc(crsRef, {
    status: 'COMPLETED',
    commentsExtracted,
    processedAt: now,
    processedBy,
    processingNotes,
    updatedAt: now,
  });
}
