/**
 * RFQ (Request for Quotation) Type Definitions
 *
 * Types for the vendor quotation request phase of procurement workflow.
 */

import type { Timestamp } from 'firebase/firestore';

// ============================================================================
// RFQ (REQUEST FOR QUOTATION) TYPES
// ============================================================================

export type RFQStatus =
  | 'DRAFT'
  | 'ISSUED'
  | 'OFFERS_RECEIVED'
  | 'UNDER_EVALUATION'
  | 'COMPLETED'
  | 'CANCELLED';

export interface RFQ {
  id: string;
  number: string; // RFQ/YYYY/MM/XXXX

  // Source PRs
  purchaseRequestIds: string[];

  // Project linkage (can span multiple projects)
  projectIds: string[];
  projectNames: string[]; // Denormalized

  // Header
  title: string;
  description: string;

  // Vendors invited
  vendorIds: string[];
  vendorNames: string[]; // Denormalized

  // Terms and conditions
  paymentTerms?: string;
  deliveryTerms?: string;
  warrantyTerms?: string;
  otherTerms?: string[];

  // Item-specific conditions
  itemConditions?: Record<string, string>; // itemId -> condition text

  // Timeline
  issueDate?: Timestamp;
  dueDate: Timestamp;
  validityPeriod?: number; // Days

  // Status
  status: RFQStatus;

  // Document management
  pdfVersion: number; // 1, 2, 3... (for revisions)
  latestPdfUrl?: string;
  sentToVendorsAt?: Timestamp; // Manual tracking
  sentBy?: string;

  // Offers tracking
  offersReceived: number;
  offersEvaluated: number;

  // Workflow
  createdBy: string;
  createdByName: string; // Denormalized
  createdAt: Timestamp;
  updatedAt: Timestamp;
  updatedBy: string;

  // Completion
  completedAt?: Timestamp;
  selectedOfferId?: string;
  completionNotes?: string;
}

export interface RFQItem {
  id: string;
  rfqId: string;

  // Source PR item
  purchaseRequestId: string;
  purchaseRequestItemId: string;

  // Item details (copied from PR item)
  lineNumber: number;
  description: string;
  specification?: string;

  quantity: number;
  unit: string;

  // Equipment linkage
  projectId?: string;
  equipmentId?: string;
  equipmentCode?: string;

  // Technical requirements
  technicalSpec?: string;
  drawingNumbers?: string[];
  makeModel?: string;

  // Delivery requirements
  requiredBy?: Timestamp;
  deliveryLocation?: string;

  // Item-specific conditions
  conditions?: string;

  // Timestamps
  createdAt: Timestamp;
  updatedAt: Timestamp;
}
