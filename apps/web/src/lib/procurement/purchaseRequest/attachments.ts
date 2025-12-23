/**
 * Purchase Request Attachment Service
 *
 * Handles file upload, deletion, and retrieval for PR attachments.
 * Attachments can be linked to the entire PR or specific line items.
 *
 * Storage path: procurement/pr/{prId}/attachments/{timestamp}_{filename}
 * Firestore collection: purchaseRequestAttachments
 */

import {
  collection,
  doc,
  addDoc,
  deleteDoc,
  getDocs,
  query,
  where,
  orderBy,
  Timestamp,
} from 'firebase/firestore';
import { ref, uploadBytes, deleteObject, getDownloadURL } from 'firebase/storage';
import { getFirebase } from '@/lib/firebase';
import { COLLECTIONS } from '@vapour/firebase';
import { createLogger } from '@vapour/logger';
import type { PurchaseRequestAttachment, PurchaseRequestAttachmentType } from '@vapour/types';
import { incrementAttachmentCount } from './crud';

const logger = createLogger({ context: 'prAttachmentService' });

/** Maximum file size: 25MB */
const MAX_FILE_SIZE = 25 * 1024 * 1024;

/** Allowed MIME types for attachments */
const ALLOWED_MIME_TYPES = [
  'application/pdf',
  'image/jpeg',
  'image/png',
  'image/webp',
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet', // xlsx
  'application/vnd.ms-excel', // xls
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document', // docx
  'application/msword', // doc
  'application/vnd.dwg', // AutoCAD
  'image/vnd.dwg', // AutoCAD alternate
  'application/acad', // AutoCAD
  'application/x-dwg', // AutoCAD
];

/**
 * Validate file before upload
 */
function validateFile(file: File): void {
  if (file.size > MAX_FILE_SIZE) {
    throw new Error(`File size exceeds limit. Maximum allowed: 25MB`);
  }

  // Allow common document types - be lenient for engineering files
  if (
    !ALLOWED_MIME_TYPES.includes(file.type) &&
    !file.type.startsWith('image/') &&
    !file.name.endsWith('.dwg') &&
    !file.name.endsWith('.dxf')
  ) {
    throw new Error(`File type not allowed. Supported: PDF, images, Excel, Word, CAD files`);
  }
}

/**
 * Generate storage path for attachment
 */
function getStoragePath(prId: string, fileName: string): string {
  const timestamp = Date.now();
  const sanitizedName = fileName.replace(/[^a-zA-Z0-9._-]/g, '_');
  return `procurement/pr/${prId}/attachments/${timestamp}_${sanitizedName}`;
}

/**
 * Upload a file attachment to a Purchase Request
 *
 * @param prId - Purchase Request ID
 * @param file - File to upload
 * @param attachmentType - Type classification of the attachment
 * @param userId - ID of the user uploading
 * @param userName - Name of the user uploading
 * @param itemId - Optional: Link to specific PR line item
 * @param description - Optional: Description of the attachment
 */
export async function uploadPRAttachment(
  prId: string,
  file: File,
  attachmentType: PurchaseRequestAttachmentType,
  userId: string,
  userName: string,
  itemId?: string,
  description?: string
): Promise<PurchaseRequestAttachment> {
  const { db, storage } = getFirebase();

  // Validate file
  validateFile(file);

  const storagePath = getStoragePath(prId, file.name);
  const storageRef = ref(storage, storagePath);

  try {
    logger.info('Uploading PR attachment', {
      prId,
      fileName: file.name,
      fileSize: file.size,
      type: attachmentType,
    });

    // Upload to Storage
    const snapshot = await uploadBytes(storageRef, file, {
      contentType: file.type,
      customMetadata: {
        purchaseRequestId: prId,
        attachmentType,
        uploadedBy: userId,
      },
    });

    // Get the gs:// URL
    const fileUrl = `gs://${snapshot.ref.bucket}/${snapshot.ref.fullPath}`;

    // Create Firestore document - only include fields with values
    const attachmentData: Record<string, unknown> = {
      purchaseRequestId: prId,
      fileName: file.name,
      fileUrl,
      storagePath,
      fileSize: file.size,
      mimeType: file.type,
      attachmentType,
      uploadedBy: userId,
      uploadedByName: userName,
      uploadedAt: Timestamp.now(),
    };

    // Add optional fields only if they have values
    if (itemId) {
      attachmentData.purchaseRequestItemId = itemId;
    }
    if (description) {
      attachmentData.description = description;
    }

    const docRef = await addDoc(
      collection(db, COLLECTIONS.PURCHASE_REQUEST_ATTACHMENTS),
      attachmentData
    );

    // Increment attachment count on PR item if linked
    if (itemId) {
      await incrementAttachmentCount(itemId);
    }

    logger.info('PR attachment uploaded successfully', {
      attachmentId: docRef.id,
      prId,
    });

    return {
      id: docRef.id,
      purchaseRequestId: prId,
      purchaseRequestItemId: itemId,
      fileName: file.name,
      fileUrl,
      storagePath,
      fileSize: file.size,
      mimeType: file.type,
      attachmentType,
      description,
      uploadedBy: userId,
      uploadedByName: userName,
      uploadedAt: Timestamp.now(),
    };
  } catch (error) {
    logger.error('Failed to upload PR attachment', { prId, error });
    throw new Error('Failed to upload attachment. Please try again.');
  }
}

/**
 * Delete a PR attachment
 *
 * @param attachmentId - Firestore document ID of the attachment
 * @param storagePath - Storage path of the file
 */
export async function deletePRAttachment(attachmentId: string, storagePath: string): Promise<void> {
  const { db, storage } = getFirebase();

  try {
    logger.info('Deleting PR attachment', { attachmentId, storagePath });

    // Delete from Storage
    const storageRef = ref(storage, storagePath);
    try {
      await deleteObject(storageRef);
    } catch (storageError) {
      // Log but continue - file might already be deleted
      logger.warn('Storage file not found during deletion', {
        storagePath,
        error: storageError,
      });
    }

    // Delete Firestore document
    await deleteDoc(doc(db, COLLECTIONS.PURCHASE_REQUEST_ATTACHMENTS, attachmentId));

    logger.info('PR attachment deleted successfully', { attachmentId });
  } catch (error) {
    logger.error('Failed to delete PR attachment', { attachmentId, error });
    throw new Error('Failed to delete attachment. Please try again.');
  }
}

/**
 * Get all attachments for a Purchase Request
 *
 * @param prId - Purchase Request ID
 * @returns List of attachments ordered by upload date (newest first)
 */
export async function getPRAttachments(prId: string): Promise<PurchaseRequestAttachment[]> {
  const { db } = getFirebase();

  try {
    const q = query(
      collection(db, COLLECTIONS.PURCHASE_REQUEST_ATTACHMENTS),
      where('purchaseRequestId', '==', prId),
      orderBy('uploadedAt', 'desc')
    );

    const snapshot = await getDocs(q);

    return snapshot.docs.map((docSnap) => ({
      id: docSnap.id,
      ...docSnap.data(),
    })) as PurchaseRequestAttachment[];
  } catch (error) {
    logger.error('Failed to get PR attachments', { prId, error });
    throw new Error('Failed to load attachments');
  }
}

/**
 * Get attachments for a specific PR line item
 *
 * @param prId - Purchase Request ID
 * @param itemId - PR line item ID
 * @returns List of attachments for the item
 */
export async function getPRItemAttachments(
  prId: string,
  itemId: string
): Promise<PurchaseRequestAttachment[]> {
  const { db } = getFirebase();

  try {
    const q = query(
      collection(db, COLLECTIONS.PURCHASE_REQUEST_ATTACHMENTS),
      where('purchaseRequestId', '==', prId),
      where('purchaseRequestItemId', '==', itemId),
      orderBy('uploadedAt', 'desc')
    );

    const snapshot = await getDocs(q);

    return snapshot.docs.map((docSnap) => ({
      id: docSnap.id,
      ...docSnap.data(),
    })) as PurchaseRequestAttachment[];
  } catch (error) {
    logger.error('Failed to get PR item attachments', { prId, itemId, error });
    throw new Error('Failed to load attachments');
  }
}

/**
 * Get a signed download URL for an attachment
 *
 * @param storagePath - Storage path of the file
 * @returns Signed URL valid for download
 */
export async function getAttachmentDownloadUrl(storagePath: string): Promise<string> {
  const { storage } = getFirebase();

  try {
    const storageRef = ref(storage, storagePath);
    return await getDownloadURL(storageRef);
  } catch (error) {
    logger.error('Failed to get attachment download URL', {
      storagePath,
      error,
    });
    throw new Error('Failed to get download link');
  }
}
