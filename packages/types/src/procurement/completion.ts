/**
 * Work Completion Certificate Type Definitions
 *
 * Types for work completion certificates in procurement workflow.
 */

import type { Timestamp } from 'firebase/firestore';

// ============================================================================
// WORK COMPLETION CERTIFICATE TYPES
// ============================================================================

export interface WorkCompletionCertificate {
  id: string;
  number: string; // WCC/YYYY/MM/XXXX

  // Purchase Order reference
  purchaseOrderId: string;
  poNumber: string; // Denormalized

  // Vendor
  vendorId: string;
  vendorName: string; // Denormalized

  // Project
  projectId: string;
  projectName: string; // Denormalized

  // Completion details
  workDescription: string;
  completionDate: Timestamp;

  // Deliverables
  allItemsDelivered: boolean;
  allItemsAccepted: boolean;
  allPaymentsCompleted: boolean;

  // Certificate details
  certificateText: string;
  remarks?: string;

  // Documents
  pdfUrl?: string;

  // Workflow
  issuedBy: string;
  issuedByName: string; // Denormalized
  issuedAt: Timestamp;

  // Timestamps
  createdAt: Timestamp;
  updatedAt: Timestamp;
}
