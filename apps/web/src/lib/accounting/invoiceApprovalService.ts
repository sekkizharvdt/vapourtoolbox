/**
 * Invoice Approval Workflow Service
 *
 * Wrapper around the generic transaction approval service for invoices.
 * Maintained for backward compatibility.
 *
 * @deprecated Use transactionApprovalService directly for new code.
 */

import type { Firestore } from 'firebase/firestore';
import type { TransactionStatus, TransactionApprovalRecord } from '@vapour/types';
import {
  submitTransactionForApproval,
  approveTransaction,
  rejectTransaction,
  getTransactionAvailableActions,
} from './transactionApprovalService';

/**
 * Approval record for audit trail
 * @deprecated Use TransactionApprovalRecord from @vapour/types instead
 */
export type InvoiceApprovalRecord = TransactionApprovalRecord;

/**
 * Submit invoice for approval
 *
 * Changes status from DRAFT → PENDING_APPROVAL
 * Creates an actionable task for the designated approver
 */
export async function submitInvoiceForApproval(
  db: Firestore,
  invoiceId: string,
  approverId: string,
  approverName: string,
  userId: string,
  userName: string,
  comments?: string
): Promise<void> {
  return submitTransactionForApproval(
    db,
    'CUSTOMER_INVOICE',
    invoiceId,
    approverId,
    approverName,
    userId,
    userName,
    comments
  );
}

/**
 * Approve invoice
 *
 * Changes status from PENDING_APPROVAL → APPROVED
 */
export async function approveInvoice(
  db: Firestore,
  invoiceId: string,
  userId: string,
  userName: string,
  comments?: string
): Promise<void> {
  return approveTransaction(db, 'CUSTOMER_INVOICE', invoiceId, userId, userName, comments);
}

/**
 * Reject invoice
 *
 * Changes status from PENDING_APPROVAL → DRAFT (returned for revision)
 */
export async function rejectInvoice(
  db: Firestore,
  invoiceId: string,
  userId: string,
  userName: string,
  comments: string
): Promise<void> {
  return rejectTransaction(db, 'CUSTOMER_INVOICE', invoiceId, userId, userName, comments);
}

/**
 * Get available actions based on invoice status and user permissions
 *
 * TESTING PHASE: Edit is allowed for DRAFT and PENDING_APPROVAL statuses
 * TODO: Remove PENDING_APPROVAL from canEdit after testing phase
 */
export function getInvoiceAvailableActions(
  status: TransactionStatus,
  canManage: boolean,
  isAssignedApprover: boolean,
  currentUserId: string,
  assignedApproverId?: string
): {
  canEdit: boolean;
  canSubmitForApproval: boolean;
  canApprove: boolean;
  canReject: boolean;
  canDelete: boolean;
} {
  const result = getTransactionAvailableActions(
    'CUSTOMER_INVOICE',
    status,
    canManage,
    isAssignedApprover,
    currentUserId,
    assignedApproverId
  );
  // Return without canRecordPayment for invoice compatibility
  return {
    canEdit: result.canEdit,
    canSubmitForApproval: result.canSubmitForApproval,
    canApprove: result.canApprove,
    canReject: result.canReject,
    canDelete: result.canDelete,
  };
}
