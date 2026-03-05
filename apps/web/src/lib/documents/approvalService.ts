/**
 * Document Approval Service
 *
 * Handles uploading client approval letters and bulk-approving
 * the master documents they cover. One approval letter can
 * approve multiple documents at once.
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
  writeBatch,
  Timestamp,
} from 'firebase/firestore';
import { getStorage, ref, uploadBytesResumable, getDownloadURL } from 'firebase/storage';
import type {
  ClientApprovalLetter,
  MasterDocumentEntry,
  MasterDocumentStatus,
} from '@vapour/types';
import { createLogger } from '@vapour/logger';
import { masterDocumentStateMachine } from '@/lib/workflow/stateMachines';

const logger = createLogger({ context: 'approvalService' });

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface UploadApprovalLetterRequest {
  projectId: string;
  file: File;
  approvedDocumentIds: string[];
  letterReference?: string;
  letterDate: Date;
  subject?: string;
  notes?: string;
  uploadedBy: string;
  uploadedByName: string;
  onProgress?: (progress: number) => void;
}

export interface UploadApprovalLetterResult {
  letterId: string;
  fileUrl: string;
  documentsApproved: number;
  documentsSkipped: number;
}

// ---------------------------------------------------------------------------
// Upload & Approve
// ---------------------------------------------------------------------------

/**
 * Upload a client approval letter and mark selected documents as APPROVED.
 *
 * Uses the state machine to validate transitions — only documents that can
 * transition to APPROVED will be updated. Documents already in APPROVED,
 * ACCEPTED, or CANCELLED are skipped.
 */
export async function uploadApprovalLetter(
  db: Firestore,
  request: UploadApprovalLetterRequest
): Promise<UploadApprovalLetterResult> {
  const {
    projectId,
    file,
    approvedDocumentIds,
    letterReference,
    letterDate,
    subject,
    notes,
    uploadedBy,
    uploadedByName,
    onProgress,
  } = request;

  if (!file) throw new Error('No file provided');
  if (approvedDocumentIds.length === 0) throw new Error('No documents selected for approval');

  const maxSize = 25 * 1024 * 1024; // 25MB
  if (file.size > maxSize) throw new Error('File size exceeds 25MB limit');

  // 1. Upload file to Storage
  const storage = getStorage();
  const timestamp = Date.now();
  const sanitizedFileName = file.name.replace(/[^a-zA-Z0-9.-]/g, '_');
  const storagePath = `projects/${projectId}/documents/approvals/${timestamp}_${sanitizedFileName}`;
  const storageRef = ref(storage, storagePath);

  const uploadTask = uploadBytesResumable(storageRef, file);

  const fileUrl = await new Promise<string>((resolve, reject) => {
    uploadTask.on(
      'state_changed',
      (snapshot) => {
        const progress = (snapshot.bytesTransferred / snapshot.totalBytes) * 100;
        onProgress?.(progress);
      },
      (error) => {
        logger.error('Approval letter upload failed', { error, projectId });
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

  // 2. Create approval letter record
  const now = Timestamp.now();

  const letterData: Omit<ClientApprovalLetter, 'id'> = {
    projectId,
    ...(letterReference !== undefined && { letterReference }),
    letterDate: Timestamp.fromDate(letterDate),
    ...(subject !== undefined && { subject }),
    fileName: file.name,
    fileUrl,
    storagePath,
    fileSize: file.size,
    mimeType: file.type || 'application/octet-stream',
    approvedDocumentIds,
    approvedDocumentCount: approvedDocumentIds.length,
    uploadedBy,
    uploadedByName,
    uploadedAt: now,
    ...(notes !== undefined && { notes }),
    createdAt: now,
    updatedAt: now,
  };

  const letterRef = collection(db, 'projects', projectId, 'approvalLetters');
  const docRef = await addDoc(letterRef, letterData);

  // 3. Bulk-approve documents using batch write
  let documentsApproved = 0;
  let documentsSkipped = 0;

  for (let i = 0; i < approvedDocumentIds.length; i += 500) {
    const chunk = approvedDocumentIds.slice(i, i + 500);
    const batch = writeBatch(db);
    let batchHasWrites = false;

    for (const docId of chunk) {
      const masterDocRef = doc(db, 'projects', projectId, 'masterDocuments', docId);
      const snap = await getDoc(masterDocRef);

      if (!snap.exists()) {
        documentsSkipped++;
        continue;
      }

      const data = snap.data() as MasterDocumentEntry;
      const currentStatus = data.status as MasterDocumentStatus;

      if (masterDocumentStateMachine.canTransitionTo(currentStatus, 'APPROVED')) {
        batch.update(masterDocRef, {
          status: 'APPROVED',
          approvalLetterUrl: fileUrl,
          approvedAt: now,
          updatedAt: now,
        });
        documentsApproved++;
        batchHasWrites = true;
      } else {
        documentsSkipped++;
      }
    }

    if (batchHasWrites) {
      await batch.commit();
    }
  }

  return {
    letterId: docRef.id,
    fileUrl,
    documentsApproved,
    documentsSkipped,
  };
}

// ---------------------------------------------------------------------------
// Query
// ---------------------------------------------------------------------------

/**
 * Get all approval letters for a project
 */
export async function getApprovalLetters(
  db: Firestore,
  projectId: string
): Promise<ClientApprovalLetter[]> {
  const lettersRef = collection(db, 'projects', projectId, 'approvalLetters');
  const q = query(lettersRef, orderBy('uploadedAt', 'desc'));
  const snapshot = await getDocs(q);

  const letters: ClientApprovalLetter[] = [];
  snapshot.forEach((docSnap) => {
    letters.push({
      id: docSnap.id,
      ...(docSnap.data() as Omit<ClientApprovalLetter, 'id'>),
    });
  });

  return letters;
}

/**
 * Get approval letters that cover a specific document
 */
export async function getApprovalLettersForDocument(
  db: Firestore,
  projectId: string,
  masterDocumentId: string
): Promise<ClientApprovalLetter[]> {
  const lettersRef = collection(db, 'projects', projectId, 'approvalLetters');
  const q = query(
    lettersRef,
    where('approvedDocumentIds', 'array-contains', masterDocumentId),
    orderBy('uploadedAt', 'desc')
  );
  const snapshot = await getDocs(q);

  const letters: ClientApprovalLetter[] = [];
  snapshot.forEach((docSnap) => {
    letters.push({
      id: docSnap.id,
      ...(docSnap.data() as Omit<ClientApprovalLetter, 'id'>),
    });
  });

  return letters;
}
