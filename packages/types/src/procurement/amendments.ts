/**
 * Purchase Order Amendment Type Definitions
 *
 * Types for PO amendments, version history, and approval workflow.
 */

import type { Timestamp } from 'firebase/firestore';
import type { PurchaseOrder, PurchaseOrderItem } from './purchaseOrder';

// ============================================================================
// PO AMENDMENT TYPES
// ============================================================================

/**
 * Amendment workflow status. Centralised here so the state machine
 * (stateMachines.ts) and UI helpers reference one source of truth.
 */
export type AmendmentStatus = 'DRAFT' | 'PENDING_APPROVAL' | 'APPROVED' | 'REJECTED';

/**
 * Purchase Order Amendment
 * Tracks changes to an approved purchase order with full version history
 */
export interface PurchaseOrderAmendment {
  id: string;
  purchaseOrderId: string;
  purchaseOrderNumber: string; // Denormalized
  amendmentNumber: number; // 1, 2, 3... (sequential)
  amendmentDate: Timestamp;

  // Tenant scoping (rule #1) — required for tenant isolation.
  tenantId?: string;

  // Amendment type
  amendmentType:
    | 'QUANTITY_CHANGE'
    | 'PRICE_CHANGE'
    | 'TERMS_CHANGE'
    | 'DELIVERY_CHANGE'
    | 'GENERAL';

  // Reason for amendment
  reason: string;
  requestedBy: string;
  requestedByName: string;

  // Changes (structured diff)
  changes: PurchaseOrderChange[];

  // Financial impact
  previousGrandTotal: number;
  newGrandTotal: number;
  totalChange: number; // Can be positive or negative

  // Approval workflow
  status: AmendmentStatus;

  // Designated approver assigned at submit time. Without this the amendment has
  // no one to approve it (the requester is blocked by separation-of-duties),
  // which is what left amendments stuck in PENDING_APPROVAL.
  approverId?: string;
  approverName?: string;

  submittedForApprovalAt?: Timestamp;
  submittedBy?: string;

  approvedBy?: string;
  approvedByName?: string;
  approvedAt?: Timestamp;
  approvalComments?: string;

  rejectedBy?: string;
  rejectedByName?: string;
  rejectedAt?: Timestamp;
  rejectionReason?: string;

  // Documents
  amendmentPdfUrl?: string;
  supportingDocuments?: string[]; // URLs

  // Applied status
  applied: boolean; // Once approved, amendment is applied to PO
  appliedAt?: Timestamp;
  appliedBy?: string;

  // Metadata
  createdAt: Timestamp;
  updatedAt: Timestamp;
  createdBy: string;
  updatedBy: string;
}

/**
 * Individual change within an amendment
 * Captures field-level changes with before/after values
 */
export interface PurchaseOrderChange {
  field: string; // e.g., 'subtotal', 'deliveryDate', 'items[0].quantity'
  fieldLabel: string; // Human-readable: 'Subtotal', 'Delivery Date', 'Item 1 Quantity'

  oldValue: any;
  newValue: any;

  // For displaying formatted values
  oldValueDisplay?: string;
  newValueDisplay?: string;

  // Impact category
  category: 'FINANCIAL' | 'SCHEDULE' | 'SCOPE' | 'TERMS';
}

/**
 * Purchase Order Version Snapshot
 * Complete snapshot of PO state at a specific point in time
 */
export interface PurchaseOrderVersion {
  id: string;
  purchaseOrderId: string;
  versionNumber: number; // 1 (original), 2 (after amendment 1), 3 (after amendment 2)...

  // Trigger
  createdByAmendmentId?: string; // null for original version
  amendmentNumber?: number;

  // Snapshot of PO data at this version
  snapshot: Partial<PurchaseOrder>; // Full PO state
  snapshotItems: PurchaseOrderItem[]; // Line items at this version

  // Metadata
  createdAt: Timestamp;
  createdBy: string;
  notes?: string;
}

/**
 * Amendment Approval History
 * Tracks all approval actions for audit trail
 */
export interface AmendmentApprovalHistory {
  id: string;
  amendmentId: string;
  purchaseOrderId: string;

  action: 'SUBMITTED' | 'APPROVED' | 'REJECTED' | 'RECALLED';
  actionDate: Timestamp;
  actionBy: string;
  actionByName: string;

  comments?: string;
  previousStatus: 'DRAFT' | 'PENDING_APPROVAL' | 'APPROVED' | 'REJECTED';
  newStatus: 'DRAFT' | 'PENDING_APPROVAL' | 'APPROVED' | 'REJECTED';

  // IP and device info for audit
  ipAddress?: string;
  userAgent?: string;
}
