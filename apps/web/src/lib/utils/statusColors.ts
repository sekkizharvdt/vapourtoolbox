/**
 * Centralized Status Color Helpers
 *
 * Provides consistent status-to-color mappings across all modules.
 * Use these helpers instead of defining local getStatusColor functions.
 */

/**
 * MUI Chip color type for type safety
 */
export type ChipColor =
  | 'default'
  | 'primary'
  | 'secondary'
  | 'error'
  | 'info'
  | 'success'
  | 'warning';

// ============================================================================
// Generic Status Colors
// ============================================================================

/**
 * Common workflow status colors
 * Used for generic DRAFT/PENDING/APPROVED/etc statuses
 */
export const WORKFLOW_STATUS_COLORS: Record<string, ChipColor> = {
  // Draft/Initial states
  DRAFT: 'default',
  NEW: 'default',
  CREATED: 'default',

  // Pending/In Progress states
  PENDING: 'warning',
  PENDING_APPROVAL: 'warning',
  IN_PROGRESS: 'info',
  UNDER_REVIEW: 'info',
  PROCESSING: 'info',
  EXECUTING: 'info',

  // Approved/Success states
  APPROVED: 'success',
  COMPLETED: 'success',
  ACTIVE: 'success',
  PAID: 'success',
  DELIVERED: 'success',
  RESOLVED: 'success',

  // Rejected/Error states
  REJECTED: 'error',
  CANCELLED: 'error',
  FAILED: 'error',
  OVERDUE: 'error',

  // Partial states
  PARTIALLY_PAID: 'warning',
  PARTIALLY_COMPLETED: 'warning',

  // Info states
  POSTED: 'info',
  ISSUED: 'info',
  ACKNOWLEDGED: 'info',
};

/**
 * Get color for generic workflow status
 */
export function getWorkflowStatusColor(status: string): ChipColor {
  return WORKFLOW_STATUS_COLORS[status] || 'default';
}

// ============================================================================
// Transaction Status Colors
// ============================================================================

/**
 * Transaction/Accounting status colors
 */
export const TRANSACTION_STATUS_COLORS: Record<string, ChipColor> = {
  DRAFT: 'default',
  PENDING_APPROVAL: 'warning',
  APPROVED: 'success',
  POSTED: 'info',
  PAID: 'success',
  PARTIALLY_PAID: 'warning',
  VOID: 'error',
  CANCELLED: 'error',
};

/**
 * Get color for transaction status
 */
export function getTransactionStatusColor(status: string): ChipColor {
  return TRANSACTION_STATUS_COLORS[status] || 'default';
}

// ============================================================================
// Project Status Colors
// ============================================================================

/**
 * Project status colors
 */
export const PROJECT_STATUS_COLORS: Record<string, ChipColor> = {
  DRAFT: 'default',
  PROPOSED: 'info',
  ACTIVE: 'success',
  ON_HOLD: 'warning',
  COMPLETED: 'success',
  CANCELLED: 'error',
  ARCHIVED: 'default',
};

/**
 * Get color for project status
 */
export function getProjectStatusColor(status: string): ChipColor {
  return PROJECT_STATUS_COLORS[status] || 'default';
}

// ============================================================================
// Procurement Status Colors
// ============================================================================

/**
 * Purchase Order status colors
 */
export const PO_STATUS_COLORS: Record<string, ChipColor> = {
  DRAFT: 'default',
  PENDING_APPROVAL: 'warning',
  APPROVED: 'info',
  REJECTED: 'error',
  ISSUED: 'primary',
  ACKNOWLEDGED: 'info',
  IN_PROGRESS: 'info',
  DELIVERED: 'success',
  COMPLETED: 'success',
  CANCELLED: 'error',
  AMENDED: 'warning',
};

/**
 * Get color for PO status
 */
export function getPOStatusColor(status: string): ChipColor {
  return PO_STATUS_COLORS[status] || 'default';
}

/**
 * RFQ status colors
 */
export const RFQ_STATUS_COLORS: Record<string, ChipColor> = {
  DRAFT: 'default',
  SENT: 'info',
  PARTIALLY_RECEIVED: 'warning',
  ALL_RECEIVED: 'success',
  EVALUATING: 'info',
  COMPLETED: 'success',
  CANCELLED: 'error',
};

/**
 * Get color for RFQ status
 */
export function getRFQStatusColor(status: string): ChipColor {
  return RFQ_STATUS_COLORS[status] || 'default';
}

/**
 * Purchase Request status colors
 */
export const PR_STATUS_COLORS: Record<string, ChipColor> = {
  DRAFT: 'default',
  SUBMITTED: 'warning',
  UNDER_REVIEW: 'info',
  APPROVED: 'success',
  REJECTED: 'error',
  CONVERTED_TO_RFQ: 'success',
  CANCELLED: 'error',
};

/**
 * Get color for PR status
 */
export function getPRStatusColor(status: string): ChipColor {
  return PR_STATUS_COLORS[status] || 'default';
}

// ============================================================================
// HR Status Colors
// ============================================================================

/**
 * Leave request status colors
 */
export const LEAVE_STATUS_COLORS: Record<string, ChipColor> = {
  DRAFT: 'default',
  PENDING: 'warning',
  APPROVED: 'success',
  REJECTED: 'error',
  CANCELLED: 'error',
  WITHDRAWN: 'default',
};

/**
 * Get color for leave request status
 */
export function getLeaveStatusColor(status: string): ChipColor {
  return LEAVE_STATUS_COLORS[status] || 'default';
}

/**
 * Travel expense status colors
 */
export const TRAVEL_EXPENSE_STATUS_COLORS: Record<string, ChipColor> = {
  DRAFT: 'default',
  SUBMITTED: 'warning',
  UNDER_REVIEW: 'info',
  APPROVED: 'success',
  REJECTED: 'error',
  REIMBURSED: 'success',
  CANCELLED: 'error',
};

/**
 * Get color for travel expense status
 */
export function getTravelExpenseStatusColor(status: string): ChipColor {
  return TRAVEL_EXPENSE_STATUS_COLORS[status] || 'default';
}

// ============================================================================
// Document Status Colors
// ============================================================================

/**
 * Document/Transmittal status colors
 */
export const DOCUMENT_STATUS_COLORS: Record<string, ChipColor> = {
  DRAFT: 'default',
  ISSUED: 'info',
  SUBMITTED: 'warning',
  UNDER_REVIEW: 'info',
  APPROVED: 'success',
  REJECTED: 'error',
  SUPERSEDED: 'default',
};

/**
 * Get color for document status
 */
export function getDocumentStatusColor(status: string): ChipColor {
  return DOCUMENT_STATUS_COLORS[status] || 'default';
}

// ============================================================================
// Proposal Status Colors
// ============================================================================

/**
 * Proposal status colors
 */
export const PROPOSAL_STATUS_COLORS: Record<string, ChipColor> = {
  DRAFT: 'default',
  IN_REVIEW: 'info',
  SUBMITTED: 'warning',
  WON: 'success',
  LOST: 'error',
  CANCELLED: 'error',
  ON_HOLD: 'warning',
};

/**
 * Get color for proposal status
 */
export function getProposalStatusColor(status: string): ChipColor {
  return PROPOSAL_STATUS_COLORS[status] || 'default';
}

// ============================================================================
// Payment Batch Status Colors
// ============================================================================

/**
 * Payment batch status colors
 */
export const PAYMENT_BATCH_STATUS_COLORS: Record<string, ChipColor> = {
  DRAFT: 'default',
  PENDING_APPROVAL: 'warning',
  APPROVED: 'info',
  EXECUTING: 'info',
  COMPLETED: 'success',
  REJECTED: 'error',
  CANCELLED: 'error',
};

/**
 * Get color for payment batch status
 */
export function getPaymentBatchStatusColor(status: string): ChipColor {
  return PAYMENT_BATCH_STATUS_COLORS[status] || 'default';
}

// ============================================================================
// User Status Colors
// ============================================================================

/**
 * User status colors
 */
export const USER_STATUS_COLORS: Record<string, ChipColor> = {
  active: 'success',
  inactive: 'default',
  suspended: 'error',
  pending: 'warning',
};

/**
 * Get color for user status
 */
export function getUserStatusColor(status: string): ChipColor {
  return USER_STATUS_COLORS[status] || 'default';
}

// ============================================================================
// Generic Helper
// ============================================================================

/**
 * Universal status color getter
 * Falls back through common patterns to find appropriate color
 */
export function getStatusColor(status: string): ChipColor {
  // Check all status mappings
  return (
    WORKFLOW_STATUS_COLORS[status] ||
    TRANSACTION_STATUS_COLORS[status] ||
    PROJECT_STATUS_COLORS[status] ||
    PO_STATUS_COLORS[status] ||
    PR_STATUS_COLORS[status] ||
    LEAVE_STATUS_COLORS[status] ||
    DOCUMENT_STATUS_COLORS[status] ||
    PROPOSAL_STATUS_COLORS[status] ||
    'default'
  );
}
