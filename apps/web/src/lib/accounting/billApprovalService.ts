/**
 * Vendor Bill Approval Workflow Service
 *
 * Wrapper around the generic transaction approval service for bills.
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
export type BillApprovalRecord = TransactionApprovalRecord;

/**
 * Submit bill for approval
 *
 * Changes status from DRAFT → PENDING_APPROVAL
 * Creates an actionable task for the designated approver
 */
export async function submitBillForApproval(
  db: Firestore,
  billId: string,
  approverId: string,
  approverName: string,
  userId: string,
  userName: string,
  comments?: string
): Promise<void> {
  return submitTransactionForApproval(
    db,
    'VENDOR_BILL',
    billId,
    approverId,
    approverName,
    userId,
    userName,
    comments
  );
}

/**
 * Approve bill
 *
 * Changes status from PENDING_APPROVAL → APPROVED
 */
export async function approveBill(
  db: Firestore,
  billId: string,
  userId: string,
  userName: string,
  comments?: string
): Promise<void> {
  return approveTransaction(db, 'VENDOR_BILL', billId, userId, userName, comments);
}

/**
 * Reject bill
 *
 * Changes status from PENDING_APPROVAL → DRAFT (returned for revision)
 */
export async function rejectBill(
  db: Firestore,
  billId: string,
  userId: string,
  userName: string,
  comments: string
): Promise<void> {
  return rejectTransaction(db, 'VENDOR_BILL', billId, userId, userName, comments);
}

/**
 * Get available actions based on bill status and user permissions
 *
 * TESTING PHASE: Edit is allowed for DRAFT and PENDING_APPROVAL statuses
 * TODO: Remove PENDING_APPROVAL from canEdit after testing phase
 *
 * Approval Logic:
 * - Only the assigned approver can approve/reject bills
 * - User must also have MANAGE_ACCOUNTING permission
 */
export function getBillAvailableActions(
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
  canRecordPayment: boolean;
} {
  return getTransactionAvailableActions(
    'VENDOR_BILL',
    status,
    canManage,
    isAssignedApprover,
    currentUserId,
    assignedApproverId
  );
}
