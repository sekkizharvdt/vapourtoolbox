/**
 * Proposal Attachment Service
 *
 * Handles uploading and managing attachments for proposals.
 * Supports multi-file upload with different file types (drawings, specs, datasheets, etc.)
 */

import { Firestore, Timestamp, doc, updateDoc, arrayUnion, arrayRemove } from 'firebase/firestore';
import {
  getStorage,
  ref,
  uploadBytesResumable,
  getDownloadURL,
  deleteObject,
} from 'firebase/storage';
import type { ProposalAttachment, ProposalAttachmentType, Proposal } from '@vapour/types';
import { createLogger } from '@vapour/logger';

const logger = createLogger({ context: 'proposalAttachmentService' });

export interface UploadAttachmentRequest {
  proposalId: string;
  entityId: string;
  file: File;
  fileType: ProposalAttachmentType;
  description?: string;
  uploadedBy: string;
  uploadedByName: string;
  onProgress?: (progress: number) => void;
}

export interface UploadAttachmentResult {
  attachment: ProposalAttachment;
}

const MAX_FILE_SIZE = 50 * 1024 * 1024; // 50MB

/**
 * Detect file type based on extension
 */
export function detectAttachmentType(fileName: string): ProposalAttachmentType {
  const ext = fileName.split('.').pop()?.toLowerCase();

  // Drawings
  if (['dwg', 'dxf', 'dwf'].includes(ext || '')) return 'DRAWING';

  // Data sheets - typically PDF
  if (ext === 'pdf') return 'DATASHEET';

  // Specifications - Word docs
  if (['doc', 'docx'].includes(ext || '')) return 'SPECIFICATION';

  // Other supporting files
  return 'SUPPORTING';
}

/**
 * Upload an attachment to a proposal
 */
export async function uploadProposalAttachment(
  db: Firestore,
  request: UploadAttachmentRequest
): Promise<UploadAttachmentResult> {
  const {
    proposalId,
    entityId,
    file,
    fileType,
    description,
    uploadedBy,
    uploadedByName,
    onProgress,
  } = request;

  logger.info('Uploading proposal attachment', {
    proposalId,
    fileName: file.name,
    fileType,
    fileSize: file.size,
  });

  // Validate file
  if (!file) {
    throw new Error('No file provided');
  }

  if (file.size > MAX_FILE_SIZE) {
    throw new Error('File size exceeds 50MB limit');
  }

  // Generate unique ID for this attachment
  const attachmentId = crypto.randomUUID();

  // 1. Upload file to storage
  const storage = getStorage();
  const timestamp = Date.now();
  const sanitizedFileName = file.name.replace(/[^a-zA-Z0-9.-]/g, '_');
  const storagePath = `entities/${entityId}/proposals/${proposalId}/attachments/${timestamp}_${sanitizedFileName}`;
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
        logger.error('Upload error', { error });
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

  // 2. Create attachment object
  const now = Timestamp.now();

  const attachment: ProposalAttachment = {
    id: attachmentId,
    fileName: file.name,
    fileUrl,
    storagePath,
    fileSize: file.size,
    mimeType: file.type || 'application/octet-stream',
    fileType,
    description,
    uploadedAt: now,
    uploadedBy,
    uploadedByName,
  };

  // 3. Update proposal with new attachment
  const proposalRef = doc(db, 'proposals', proposalId);
  await updateDoc(proposalRef, {
    attachments: arrayUnion(attachment),
    updatedAt: now,
  });

  logger.info('Attachment uploaded successfully', { attachmentId, proposalId });

  return { attachment };
}

/**
 * Upload multiple attachments to a proposal
 */
export async function uploadMultipleAttachments(
  db: Firestore,
  proposalId: string,
  entityId: string,
  files: Array<{
    file: File;
    fileType: ProposalAttachmentType;
    description?: string;
  }>,
  uploadedBy: string,
  uploadedByName: string,
  onProgress?: (fileIndex: number, progress: number) => void
): Promise<ProposalAttachment[]> {
  const attachments: ProposalAttachment[] = [];

  for (let i = 0; i < files.length; i++) {
    const { file, fileType, description } = files[i]!;

    const result = await uploadProposalAttachment(db, {
      proposalId,
      entityId,
      file,
      fileType,
      description,
      uploadedBy,
      uploadedByName,
      onProgress: (progress) => onProgress?.(i, progress),
    });

    attachments.push(result.attachment);
  }

  return attachments;
}

/**
 * Remove an attachment from a proposal
 */
export async function removeProposalAttachment(
  db: Firestore,
  proposalId: string,
  attachment: ProposalAttachment
): Promise<void> {
  logger.info('Removing proposal attachment', {
    proposalId,
    attachmentId: attachment.id,
    fileName: attachment.fileName,
  });

  try {
    // 1. Delete from storage
    const storage = getStorage();
    const storageRef = ref(storage, attachment.storagePath);
    await deleteObject(storageRef);
  } catch (error) {
    // Log but don't fail if storage deletion fails
    logger.warn('Failed to delete attachment from storage', {
      error,
      storagePath: attachment.storagePath,
    });
  }

  // 2. Remove from proposal document
  const proposalRef = doc(db, 'proposals', proposalId);
  await updateDoc(proposalRef, {
    attachments: arrayRemove(attachment),
    updatedAt: Timestamp.now(),
  });

  logger.info('Attachment removed successfully', { attachmentId: attachment.id });
}

/**
 * Get all attachments for a proposal
 * Note: Attachments are stored inline in the proposal document,
 * so this just returns them from the proposal
 */
export function getProposalAttachments(proposal: Proposal): ProposalAttachment[] {
  return proposal.attachments || [];
}

/**
 * Format file size for display
 */
export function formatFileSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}
