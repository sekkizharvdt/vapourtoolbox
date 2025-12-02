/**
 * Invoice Approval Workflow Service
 *
 * Manages invoice status transitions, approvals, and rejections.
 * Supports selecting a specific approver when submitting for approval.
 */

import { doc, updateDoc, getDoc, Timestamp, type Firestore } from 'firebase/firestore';
import { COLLECTIONS } from '@vapour/firebase';
import { createLogger } from '@vapour/logger';
import type { CustomerInvoice, TransactionStatus } from '@vapour/types';
import { createTaskNotification } from '@/lib/tasks/taskNotificationService';

const logger = createLogger({ context: 'invoiceApproval' });

/**
 * Approval record for audit trail
 */
export interface InvoiceApprovalRecord {
  action: 'SUBMITTED' | 'APPROVED' | 'REJECTED' | 'REQUESTED_CHANGES';
  userId: string;
  userName: string;
  timestamp: Date;
  comments?: string;
}

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
  try {
    const invoiceRef = doc(db, COLLECTIONS.TRANSACTIONS, invoiceId);
    const invoiceSnap = await getDoc(invoiceRef);

    if (!invoiceSnap.exists()) {
      throw new Error('Invoice not found');
    }

    const invoice = invoiceSnap.data() as CustomerInvoice;

    if (invoice.status !== 'DRAFT') {
      throw new Error(`Cannot submit invoice with status: ${invoice.status}`);
    }

    const approvalRecord: InvoiceApprovalRecord = {
      action: 'SUBMITTED',
      userId,
      userName,
      timestamp: new Date(),
      ...(comments ? { comments } : {}),
    };

    await updateDoc(invoiceRef, {
      status: 'PENDING_APPROVAL' as TransactionStatus,
      submittedAt: Timestamp.now(),
      submittedByUserId: userId,
      submittedByUserName: userName,
      assignedApproverId: approverId,
      assignedApproverName: approverName,
      approvalHistory: [
        ...((invoice as unknown as { approvalHistory?: InvoiceApprovalRecord[] }).approvalHistory ||
          []),
        approvalRecord,
      ],
      updatedAt: Timestamp.now(),
      updatedBy: userId,
    });

    // Create actionable task for the designated approver
    await createTaskNotification({
      type: 'actionable',
      category: 'INVOICE_SUBMITTED',
      userId: approverId,
      assignedBy: userId,
      assignedByName: userName,
      title: `Review Invoice ${invoice.transactionNumber}`,
      message: comments
        ? `${userName} submitted invoice for ${invoice.entityName || 'customer'} for your review: ${comments}`
        : `${userName} submitted invoice for ${invoice.entityName || 'customer'} for your review`,
      entityType: 'INVOICE',
      entityId: invoiceId,
      linkUrl: `/accounting/invoices`,
      priority: 'HIGH',
      autoCompletable: true,
    });

    logger.info('Invoice submitted for approval', {
      invoiceId,
      userId,
      approverId,
      invoiceNumber: invoice.transactionNumber,
    });
  } catch (error) {
    logger.error('Error submitting invoice for approval', { invoiceId, error });
    throw error;
  }
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
  try {
    const invoiceRef = doc(db, COLLECTIONS.TRANSACTIONS, invoiceId);
    const invoiceSnap = await getDoc(invoiceRef);

    if (!invoiceSnap.exists()) {
      throw new Error('Invoice not found');
    }

    const invoice = invoiceSnap.data() as CustomerInvoice;

    if (invoice.status !== 'PENDING_APPROVAL') {
      throw new Error(`Cannot approve invoice with status: ${invoice.status}`);
    }

    const approvalRecord: InvoiceApprovalRecord = {
      action: 'APPROVED',
      userId,
      userName,
      timestamp: new Date(),
      ...(comments ? { comments } : {}),
    };

    await updateDoc(invoiceRef, {
      status: 'APPROVED' as TransactionStatus,
      approvedBy: userId,
      approvedAt: Timestamp.now(),
      approvalHistory: [
        ...((invoice as unknown as { approvalHistory?: InvoiceApprovalRecord[] }).approvalHistory ||
          []),
        approvalRecord,
      ],
      updatedAt: Timestamp.now(),
      updatedBy: userId,
    });

    // Notify the submitter that their invoice was approved
    const submittedBy = (invoice as unknown as { submittedByUserId?: string }).submittedByUserId;
    if (submittedBy) {
      await createTaskNotification({
        type: 'informational',
        category: 'INVOICE_APPROVED',
        userId: submittedBy,
        assignedBy: userId,
        assignedByName: userName,
        title: `Invoice ${invoice.transactionNumber} Approved`,
        message: comments
          ? `Your invoice was approved by ${userName}: ${comments}`
          : `Your invoice for ${invoice.entityName || 'customer'} was approved by ${userName}`,
        entityType: 'INVOICE',
        entityId: invoiceId,
        linkUrl: `/accounting/invoices`,
        priority: 'MEDIUM',
      });
    }

    logger.info('Invoice approved', {
      invoiceId,
      userId,
      invoiceNumber: invoice.transactionNumber,
    });
  } catch (error) {
    logger.error('Error approving invoice', { invoiceId, error });
    throw error;
  }
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
  try {
    const invoiceRef = doc(db, COLLECTIONS.TRANSACTIONS, invoiceId);
    const invoiceSnap = await getDoc(invoiceRef);

    if (!invoiceSnap.exists()) {
      throw new Error('Invoice not found');
    }

    const invoice = invoiceSnap.data() as CustomerInvoice;

    if (invoice.status !== 'PENDING_APPROVAL') {
      throw new Error(`Cannot reject invoice with status: ${invoice.status}`);
    }

    const approvalRecord: InvoiceApprovalRecord = {
      action: 'REJECTED',
      userId,
      userName,
      timestamp: new Date(),
      comments,
    };

    await updateDoc(invoiceRef, {
      status: 'DRAFT' as TransactionStatus,
      rejectionReason: comments,
      approvalHistory: [
        ...((invoice as unknown as { approvalHistory?: InvoiceApprovalRecord[] }).approvalHistory ||
          []),
        approvalRecord,
      ],
      updatedAt: Timestamp.now(),
      updatedBy: userId,
    });

    // Notify the submitter that their invoice was rejected
    const submittedBy = (invoice as unknown as { submittedByUserId?: string }).submittedByUserId;
    if (submittedBy) {
      await createTaskNotification({
        type: 'informational',
        category: 'INVOICE_REJECTED',
        userId: submittedBy,
        assignedBy: userId,
        assignedByName: userName,
        title: `Invoice ${invoice.transactionNumber} Rejected`,
        message: `Your invoice was rejected by ${userName}: ${comments}`,
        entityType: 'INVOICE',
        entityId: invoiceId,
        linkUrl: `/accounting/invoices`,
        priority: 'HIGH',
      });
    }

    logger.info('Invoice rejected', {
      invoiceId,
      userId,
      invoiceNumber: invoice.transactionNumber,
    });
  } catch (error) {
    logger.error('Error rejecting invoice', { invoiceId, error });
    throw error;
  }
}

/**
 * Get available actions based on invoice status and user permissions
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
  const isApprover =
    isAssignedApprover || (assignedApproverId && assignedApproverId === currentUserId);

  return {
    canEdit: canManage && status === 'DRAFT',
    canSubmitForApproval: canManage && status === 'DRAFT',
    canApprove: canManage && status === 'PENDING_APPROVAL' && !!isApprover,
    canReject: canManage && status === 'PENDING_APPROVAL' && !!isApprover,
    canDelete: canManage && status === 'DRAFT',
  };
}
