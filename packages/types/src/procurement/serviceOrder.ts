/**
 * Service Order Types
 *
 * Tracks the execution of procured services (lab tests, consulting, calibration, etc.).
 * Parallel to Goods Receipts for materials — links to a PO and tracks service-specific lifecycle.
 */

import { Timestamp } from 'firebase/firestore';

export type ServiceOrderStatus =
  | 'DRAFT'
  | 'SAMPLE_SENT'
  | 'IN_PROGRESS'
  | 'RESULTS_RECEIVED'
  | 'UNDER_REVIEW'
  | 'COMPLETED'
  | 'CANCELLED';

export const SERVICE_ORDER_STATUS_LABELS: Record<ServiceOrderStatus, string> = {
  DRAFT: 'Draft',
  SAMPLE_SENT: 'Sample Sent',
  IN_PROGRESS: 'In Progress',
  RESULTS_RECEIVED: 'Results Received',
  UNDER_REVIEW: 'Under Review',
  COMPLETED: 'Completed',
  CANCELLED: 'Cancelled',
};

export const SERVICE_ORDER_STATUS_COLORS: Record<ServiceOrderStatus, string> = {
  DRAFT: 'default',
  SAMPLE_SENT: 'info',
  IN_PROGRESS: 'warning',
  RESULTS_RECEIVED: 'info',
  UNDER_REVIEW: 'warning',
  COMPLETED: 'success',
  CANCELLED: 'error',
};

export interface ServiceOrder {
  id: string;
  number: string; // Format: SO/YYYY/MM/XXXX

  // Source linkage
  purchaseOrderId: string;
  poNumber: string; // Denormalized
  purchaseOrderItemId?: string; // Specific PO line item

  // Vendor/lab
  vendorId: string;
  vendorName: string;

  // Project
  projectId?: string;
  projectName?: string;

  // Service details (from catalog or manual entry)
  serviceId?: string; // Link to services catalog
  serviceCode?: string;
  serviceName: string;
  serviceCategory?: string;
  description?: string;

  // Sample tracking (for lab tests)
  sampleDetails?: {
    sampleId?: string;
    sampleDescription?: string;
    sentDate?: Timestamp;
    receivedByVendorDate?: Timestamp;
  };

  // Timeline
  estimatedTurnaroundDays?: number;
  expectedCompletionDate?: Timestamp;
  actualCompletionDate?: Timestamp;

  // Status
  status: ServiceOrderStatus;

  // Results
  resultSummary?: string;
  reportFileUrls?: string[];
  certificateFileUrls?: string[];
  remarks?: string;

  // Audit
  createdBy: string;
  createdByName: string;
  completedBy?: string;
  completedByName?: string;
  completedAt?: Timestamp;
  createdAt: Timestamp;
  updatedAt: Timestamp;
  updatedBy: string;
}
