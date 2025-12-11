/**
 * Vendor Bill Approval Workflow Service
 *
 * Manages bill status transitions, approvals, and rejections.
 * Bills must be approved before payment can be made.
 */

import { doc, updateDoc, getDoc, Timestamp, type Firestore } from 'firebase/firestore';
import { COLLECTIONS } from '@vapour/firebase';
import { createLogger } from '@vapour/logger';
import type { VendorBill, TransactionStatus } from '@vapour/types';
import { createTaskNotification } from '@/lib/tasks/taskNotificationService';

const logger = createLogger({ context: 'billApproval' });

/**
 * Approval record for audit trail
 */
export interface BillApprovalRecord {
  action: 'SUBMITTED' | 'APPROVED' | 'REJECTED' | 'REQUESTED_CHANGES';
  userId: string;
  userName: string;
  timestamp: Date;
  comments?: string;
}

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
  try {
    const billRef = doc(db, COLLECTIONS.TRANSACTIONS, billId);
    const billSnap = await getDoc(billRef);

    if (!billSnap.exists()) {
      throw new Error('Bill not found');
    }

    const bill = billSnap.data() as VendorBill;

    if (bill.status !== 'DRAFT') {
      throw new Error(`Cannot submit bill with status: ${bill.status}`);
    }

    const approvalRecord: BillApprovalRecord = {
      action: 'SUBMITTED',
      userId,
      userName,
      timestamp: new Date(),
      ...(comments ? { comments } : {}),
    };

    await updateDoc(billRef, {
      status: 'PENDING_APPROVAL' as TransactionStatus,
      submittedAt: Timestamp.now(),
      submittedByUserId: userId,
      submittedByUserName: userName,
      assignedApproverId: approverId,
      assignedApproverName: approverName,
      approvalHistory: [
        ...((bill as unknown as { approvalHistory?: BillApprovalRecord[] }).approvalHistory || []),
        approvalRecord,
      ],
      updatedAt: Timestamp.now(),
      updatedBy: userId,
    });

    // Create actionable task for the designated approver
    await createTaskNotification({
      type: 'actionable',
      category: 'BILL_SUBMITTED',
      userId: approverId,
      assignedBy: userId,
      assignedByName: userName,
      title: `Review Bill ${bill.vendorInvoiceNumber || bill.transactionNumber}`,
      message: comments
        ? `${userName} submitted bill from ${bill.entityName || 'vendor'} for your review: ${comments}`
        : `${userName} submitted bill from ${bill.entityName || 'vendor'} for your review`,
      entityType: 'BILL',
      entityId: billId,
      linkUrl: `/accounting/bills`,
      priority: 'HIGH',
      autoCompletable: true,
    });

    logger.info('Bill submitted for approval', {
      billId,
      userId,
      approverId,
      billNumber: bill.vendorInvoiceNumber || bill.transactionNumber,
    });
  } catch (error) {
    logger.error('Error submitting bill for approval', { billId, error });
    throw error;
  }
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
  try {
    const billRef = doc(db, COLLECTIONS.TRANSACTIONS, billId);
    const billSnap = await getDoc(billRef);

    if (!billSnap.exists()) {
      throw new Error('Bill not found');
    }

    const bill = billSnap.data() as VendorBill;

    if (bill.status !== 'PENDING_APPROVAL') {
      throw new Error(`Cannot approve bill with status: ${bill.status}`);
    }

    const approvalRecord: BillApprovalRecord = {
      action: 'APPROVED',
      userId,
      userName,
      timestamp: new Date(),
      ...(comments ? { comments } : {}),
    };

    await updateDoc(billRef, {
      status: 'APPROVED' as TransactionStatus,
      approvedBy: userId,
      approvedAt: Timestamp.now(),
      approvalHistory: [
        ...((bill as unknown as { approvalHistory?: BillApprovalRecord[] }).approvalHistory || []),
        approvalRecord,
      ],
      updatedAt: Timestamp.now(),
      updatedBy: userId,
    });

    // Notify the submitter that their bill was approved
    const submittedBy = (bill as unknown as { submittedByUserId?: string }).submittedByUserId;
    if (submittedBy) {
      try {
        await createTaskNotification({
          type: 'informational',
          category: 'BILL_APPROVED',
          userId: submittedBy,
          assignedBy: userId,
          assignedByName: userName,
          title: `Bill ${bill.vendorInvoiceNumber || bill.transactionNumber} Approved`,
          message: comments
            ? `Your bill was approved by ${userName}: ${comments}`
            : `Your bill from ${bill.entityName || 'vendor'} was approved by ${userName}`,
          entityType: 'BILL',
          entityId: billId,
          linkUrl: `/accounting/bills`,
          priority: 'MEDIUM',
        });
      } catch (notificationError) {
        // Log but don't fail the approval if notification fails
        logger.warn('Failed to send approval notification', {
          billId,
          submittedBy,
          notificationError,
        });
      }
    }

    logger.info('Bill approved', {
      billId,
      userId,
      billNumber: bill.vendorInvoiceNumber || bill.transactionNumber,
    });
  } catch (error) {
    logger.error('Error approving bill', { billId, error });
    throw error;
  }
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
  try {
    const billRef = doc(db, COLLECTIONS.TRANSACTIONS, billId);
    const billSnap = await getDoc(billRef);

    if (!billSnap.exists()) {
      throw new Error('Bill not found');
    }

    const bill = billSnap.data() as VendorBill;

    if (bill.status !== 'PENDING_APPROVAL') {
      throw new Error(`Cannot reject bill with status: ${bill.status}`);
    }

    const approvalRecord: BillApprovalRecord = {
      action: 'REJECTED',
      userId,
      userName,
      timestamp: new Date(),
      comments,
    };

    await updateDoc(billRef, {
      status: 'DRAFT' as TransactionStatus,
      rejectionReason: comments,
      approvalHistory: [
        ...((bill as unknown as { approvalHistory?: BillApprovalRecord[] }).approvalHistory || []),
        approvalRecord,
      ],
      updatedAt: Timestamp.now(),
      updatedBy: userId,
    });

    // Notify the submitter that their bill was rejected
    const submittedBy = (bill as unknown as { submittedByUserId?: string }).submittedByUserId;
    if (submittedBy) {
      try {
        await createTaskNotification({
          type: 'informational',
          category: 'BILL_REJECTED',
          userId: submittedBy,
          assignedBy: userId,
          assignedByName: userName,
          title: `Bill ${bill.vendorInvoiceNumber || bill.transactionNumber} Rejected`,
          message: `Your bill was rejected by ${userName}: ${comments}`,
          entityType: 'BILL',
          entityId: billId,
          linkUrl: `/accounting/bills`,
          priority: 'HIGH',
        });
      } catch (notificationError) {
        // Log but don't fail the rejection if notification fails
        logger.warn('Failed to send rejection notification', {
          billId,
          submittedBy,
          notificationError,
        });
      }
    }

    logger.info('Bill rejected', {
      billId,
      userId,
      billNumber: bill.vendorInvoiceNumber || bill.transactionNumber,
    });
  } catch (error) {
    logger.error('Error rejecting bill', { billId, error });
    throw error;
  }
}

/**
 * Get available actions based on bill status and user permissions
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
  const isApprover =
    isAssignedApprover || (assignedApproverId && assignedApproverId === currentUserId);

  return {
    canEdit: canManage && status === 'DRAFT',
    canSubmitForApproval: canManage && status === 'DRAFT',
    canApprove: canManage && status === 'PENDING_APPROVAL' && !!isApprover,
    canReject: canManage && status === 'PENDING_APPROVAL' && !!isApprover,
    canDelete: canManage && status === 'DRAFT',
    canRecordPayment: canManage && status === 'APPROVED',
  };
}
