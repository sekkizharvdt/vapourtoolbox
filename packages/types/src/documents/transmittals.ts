/**
 * Document Management - Transmittal Types
 *
 * Bulk document submissions to clients
 */

import type { Timestamp } from 'firebase/firestore';
import type { MasterDocumentStatus } from './masterDocumentList';

// ============================================================================
// DOCUMENT TRANSMITTAL SYSTEM
// ============================================================================

/**
 * Document Transmittal Status
 */
export type TransmittalStatus = 'DRAFT' | 'GENERATED' | 'SENT' | 'ACKNOWLEDGED';

/**
 * Document Transmittal
 * Tracks bulk document submissions to clients
 */
export interface DocumentTransmittal {
  id: string;
  projectId: string;
  projectName: string;

  // Transmittal Info
  transmittalNumber: string; // Auto-generated (e.g., TR-001)
  transmittalDate: Timestamp;
  status: TransmittalStatus;

  // Recipient
  clientName: string;
  clientContact?: string;
  recipientEmail?: string;

  // Documents Included
  documentIds: string[]; // MasterDocument IDs
  documentCount: number;

  // Cover Notes
  subject?: string;
  coverNotes?: string;
  purposeOfIssue?: string;

  // Files
  transmittalPdfUrl?: string; // Generated PDF location
  transmittalPdfId?: string; // DocumentRecord ID
  zipFileUrl?: string; // ZIP file location
  zipFileSize?: number;

  // Acknowledgment
  acknowledgedBy?: string;
  acknowledgedByName?: string;
  acknowledgedAt?: Timestamp;
  acknowledgmentNotes?: string;

  // Audit
  createdBy: string;
  createdByName: string;
  createdAt: Timestamp;
  updatedAt: Timestamp;
  sentAt?: Timestamp;
}

/**
 * Transmittal Document Entry
 * Individual document in a transmittal
 */
export interface TransmittalDocumentEntry {
  masterDocumentId: string;
  documentNumber: string;
  documentTitle: string;
  disciplineCode: string;
  revision: string;
  submissionDate: Timestamp;
  status: MasterDocumentStatus;
  purposeOfIssue?: string;
  remarks?: string;

  // File references
  submissionId?: string;
  documentFileUrl?: string;
  crtFileUrl?: string;
}
