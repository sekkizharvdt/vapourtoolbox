/**
 * Purchase Order Attachment Service
 *
 * Buyer-uploaded supporting documents (drawings, specs, certificates, service
 * reports) stored against a PO. The metadata lives in an `attachments` array
 * on the PO document itself — no separate collection or rules needed, since the
 * PO rules already gate updates on MANAGE_PROCUREMENT.
 *
 * Storage path: procurement/purchaseOrder/{poId}/attachments/{timestamp}_{filename}
 */

import { doc, collection, runTransaction, Timestamp } from 'firebase/firestore';
import { ref, uploadBytes, deleteObject, getDownloadURL } from 'firebase/storage';
import { getFirebase } from '@/lib/firebase';
import { COLLECTIONS } from '@vapour/firebase';
import { PERMISSION_FLAGS } from '@vapour/constants';
import { requirePermission } from '@/lib/auth';
import { createLogger } from '@vapour/logger';
import type { POAttachment } from '@vapour/types';

const logger = createLogger({ context: 'poAttachmentService' });

/** Maximum file size: 25MB */
const MAX_FILE_SIZE = 25 * 1024 * 1024;

/**
 * Upload a file and append it to the PO's attachments array.
 * Returns the created attachment record.
 */
export async function addPOAttachment(
  poId: string,
  file: File,
  userId: string,
  userPermissions: number
): Promise<POAttachment> {
  requirePermission(
    userPermissions,
    PERMISSION_FLAGS.MANAGE_PROCUREMENT,
    userId,
    'upload PO attachment'
  );

  if (file.size > MAX_FILE_SIZE) {
    throw new Error('File size exceeds limit. Maximum allowed: 25MB');
  }

  const { db, storage } = getFirebase();
  const poRef = doc(db, COLLECTIONS.PURCHASE_ORDERS, poId);

  // Upload to storage first; sanitise the filename for the path.
  const safeName = file.name.replace(/[^a-zA-Z0-9._-]/g, '_');
  const storagePath = `procurement/purchaseOrder/${poId}/attachments/${Timestamp.now().toMillis()}_${safeName}`;
  const storageRef = ref(storage, storagePath);
  await uploadBytes(storageRef, file, { contentType: file.type });
  const fileUrl = await getDownloadURL(storageRef);

  const attachment: POAttachment = {
    id: doc(collection(db, COLLECTIONS.PURCHASE_ORDERS)).id,
    fileName: file.name,
    fileUrl,
    fileSize: file.size,
    storagePath,
    uploadedAt: Timestamp.now(),
    uploadedBy: userId,
  };

  // Append atomically so concurrent uploads don't clobber each other (rule 19).
  await runTransaction(db, async (tx) => {
    const snap = await tx.get(poRef);
    if (!snap.exists()) {
      throw new Error('Purchase Order not found');
    }
    const existing = (snap.data().attachments as POAttachment[] | undefined) ?? [];
    tx.update(poRef, {
      attachments: [...existing, attachment],
      updatedAt: Timestamp.now(),
      updatedBy: userId,
    });
  });

  logger.info('Added PO attachment', { poId, attachmentId: attachment.id });
  return attachment;
}

/**
 * Remove an attachment from the PO and delete the underlying storage file.
 */
export async function removePOAttachment(
  poId: string,
  attachmentId: string,
  userId: string,
  userPermissions: number
): Promise<void> {
  requirePermission(
    userPermissions,
    PERMISSION_FLAGS.MANAGE_PROCUREMENT,
    userId,
    'delete PO attachment'
  );

  const { db, storage } = getFirebase();
  const poRef = doc(db, COLLECTIONS.PURCHASE_ORDERS, poId);

  let removed: POAttachment | undefined;
  await runTransaction(db, async (tx) => {
    const snap = await tx.get(poRef);
    if (!snap.exists()) {
      throw new Error('Purchase Order not found');
    }
    const existing = (snap.data().attachments as POAttachment[] | undefined) ?? [];
    removed = existing.find((a) => a.id === attachmentId);
    tx.update(poRef, {
      attachments: existing.filter((a) => a.id !== attachmentId),
      updatedAt: Timestamp.now(),
      updatedBy: userId,
    });
  });

  // Best-effort storage cleanup — the Firestore record is already gone.
  if (removed?.storagePath) {
    try {
      await deleteObject(ref(storage, removed.storagePath));
    } catch (storageError) {
      // File may already be gone; the metadata removal is what matters.
      logger.warn('Failed to delete PO attachment file from storage', {
        poId,
        attachmentId,
        storagePath: removed.storagePath,
        error: storageError instanceof Error ? storageError.message : String(storageError),
      });
    }
  }

  logger.info('Removed PO attachment', { poId, attachmentId });
}
