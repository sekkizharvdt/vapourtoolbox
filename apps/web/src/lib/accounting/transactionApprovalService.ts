/**
 * Generic Transaction Approval Workflow Service
 *
 * Manages approval workflows for both invoices and bills.
 * Consolidates common approval logic for:
 * - Submit for approval
 * - Approve
 * - Reject
 * - Get available actions
 */

import { doc, updateDoc, getDoc, Timestamp, type Firestore } from 'firebase/firestore';
import { COLLECTIONS } from '@vapour/firebase';
import { createLogger } from '@vapour/logger';
import type {
  TransactionStatus,
  TransactionApprovalRecord,
  TaskNotificationCategory,
} from '@vapour/types';
import {
  createTaskNotification,
  completeTaskNotificationsByEntity,
} from '@/lib/tasks/taskNotificationService';

// Validation constants
const MAX_COMMENT_LENGTH = 2000;
const MAX_ID_LENGTH = 100;
const MAX_NAME_LENGTH = 200;

/**
 * Transaction type configuration for approval workflows
 */
export type ApprovableTransactionType = 'CUSTOMER_INVOICE' | 'VENDOR_BILL';

export interface TransactionTypeConfig {
  type: ApprovableTransactionType;
  entityType: 'INVOICE' | 'BILL';
  entityLabel: string;
  entityLabelLower: string;
  counterpartyLabel: string;
  counterpartyLabelLower: string;
  linkUrl: string;
  getDisplayNumber: (data: Record<string, unknown>) => string;
  submittedCategory: TaskNotificationCategory;
  approvedCategory: TaskNotificationCategory;
  rejectedCategory: TaskNotificationCategory;
}

export const TRANSACTION_CONFIGS: Record<ApprovableTransactionType, TransactionTypeConfig> = {
  CUSTOMER_INVOICE: {
    type: 'CUSTOMER_INVOICE',
    entityType: 'INVOICE',
    entityLabel: 'Invoice',
    entityLabelLower: 'invoice',
    counterpartyLabel: 'Customer',
    counterpartyLabelLower: 'customer',
    linkUrl: '/accounting/invoices',
    getDisplayNumber: (data) => data.transactionNumber as string,
    submittedCategory: 'INVOICE_SUBMITTED',
    approvedCategory: 'INVOICE_APPROVED',
    rejectedCategory: 'INVOICE_REJECTED',
  },
  VENDOR_BILL: {
    type: 'VENDOR_BILL',
    entityType: 'BILL',
    entityLabel: 'Bill',
    entityLabelLower: 'bill',
    counterpartyLabel: 'Vendor',
    counterpartyLabelLower: 'vendor',
    linkUrl: '/accounting/bills',
    getDisplayNumber: (data) =>
      (data.vendorInvoiceNumber as string) || (data.transactionNumber as string),
    submittedCategory: 'BILL_SUBMITTED',
    approvedCategory: 'BILL_APPROVED',
    rejectedCategory: 'BILL_REJECTED',
  },
};

const logger = createLogger({ context: 'transactionApproval' });

/**
 * Validate required string ID
 */
function validateRequiredId(value: string, fieldName: string): void {
  if (!value || typeof value !== 'string') {
    throw new Error(`${fieldName} is required`);
  }
  if (value.trim().length === 0) {
    throw new Error(`${fieldName} cannot be empty`);
  }
  if (value.length > MAX_ID_LENGTH) {
    throw new Error(`${fieldName} exceeds maximum length of ${MAX_ID_LENGTH} characters`);
  }
}

/**
 * Validate user name
 */
function validateUserName(value: string, fieldName: string): void {
  if (!value || typeof value !== 'string') {
    throw new Error(`${fieldName} is required`);
  }
  if (value.trim().length === 0) {
    throw new Error(`${fieldName} cannot be empty`);
  }
  if (value.length > MAX_NAME_LENGTH) {
    throw new Error(`${fieldName} exceeds maximum length of ${MAX_NAME_LENGTH} characters`);
  }
}

/**
 * Validate optional comment
 */
function validateComment(value: string | undefined, required: boolean = false): void {
  if (required && (!value || value.trim().length === 0)) {
    throw new Error('Comment is required');
  }
  if (value && value.length > MAX_COMMENT_LENGTH) {
    throw new Error(`Comment exceeds maximum length of ${MAX_COMMENT_LENGTH} characters`);
  }
}

/**
 * Submit transaction for approval
 *
 * Changes status from DRAFT → PENDING_APPROVAL
 * Creates an actionable task for the designated approver
 */
export async function submitTransactionForApproval(
  db: Firestore,
  transactionType: ApprovableTransactionType,
  transactionId: string,
  approverId: string,
  approverName: string,
  userId: string,
  userName: string,
  comments?: string
): Promise<void> {
  const config = TRANSACTION_CONFIGS[transactionType];

  // Validate all inputs
  validateRequiredId(transactionId, `${config.entityLabel} ID`);
  validateRequiredId(approverId, 'Approver ID');
  validateUserName(approverName, 'Approver name');
  validateRequiredId(userId, 'User ID');
  validateUserName(userName, 'User name');
  validateComment(comments);

  try {
    const transactionRef = doc(db, COLLECTIONS.TRANSACTIONS, transactionId);
    const transactionSnap = await getDoc(transactionRef);

    if (!transactionSnap.exists()) {
      throw new Error(`${config.entityLabel} not found`);
    }

    const transaction = transactionSnap.data() as Record<string, unknown>;

    if (transaction.status !== 'DRAFT') {
      throw new Error(
        `Cannot submit ${config.entityLabelLower} with status: ${transaction.status}`
      );
    }

    const approvalRecord: TransactionApprovalRecord = {
      action: 'SUBMITTED',
      userId,
      userName,
      timestamp: new Date(),
      ...(comments ? { comments } : {}),
    };

    await updateDoc(transactionRef, {
      status: 'PENDING_APPROVAL' as TransactionStatus,
      submittedAt: Timestamp.now(),
      submittedByUserId: userId,
      submittedByUserName: userName,
      assignedApproverId: approverId,
      assignedApproverName: approverName,
      approvalHistory: [
        ...((transaction.approvalHistory as TransactionApprovalRecord[]) || []),
        approvalRecord,
      ],
      updatedAt: Timestamp.now(),
      updatedBy: userId,
    });

    const displayNumber = config.getDisplayNumber(transaction);
    const entityName = (transaction.entityName as string) || config.counterpartyLabelLower;

    // Create actionable task for the designated approver
    await createTaskNotification({
      type: 'actionable',
      category: config.submittedCategory,
      userId: approverId,
      assignedBy: userId,
      assignedByName: userName,
      title: `Review ${config.entityLabel} ${displayNumber}`,
      message: comments
        ? `${userName} submitted ${config.entityLabelLower} for ${entityName} for your review: ${comments}`
        : `${userName} submitted ${config.entityLabelLower} for ${entityName} for your review`,
      entityType: config.entityType,
      entityId: transactionId,
      linkUrl: config.linkUrl,
      priority: 'HIGH',
      autoCompletable: true,
    });

    logger.info(`${config.entityLabel} submitted for approval`, {
      transactionId,
      userId,
      approverId,
      displayNumber,
    });
  } catch (error) {
    logger.error(`Error submitting ${config.entityLabelLower} for approval`, {
      transactionId,
      error,
    });
    throw error;
  }
}

/**
 * Approve transaction
 *
 * Changes status from PENDING_APPROVAL → APPROVED
 */
export async function approveTransaction(
  db: Firestore,
  transactionType: ApprovableTransactionType,
  transactionId: string,
  userId: string,
  userName: string,
  comments?: string
): Promise<void> {
  const config = TRANSACTION_CONFIGS[transactionType];

  // Validate all inputs
  validateRequiredId(transactionId, `${config.entityLabel} ID`);
  validateRequiredId(userId, 'User ID');
  validateUserName(userName, 'User name');
  validateComment(comments);

  try {
    const transactionRef = doc(db, COLLECTIONS.TRANSACTIONS, transactionId);
    const transactionSnap = await getDoc(transactionRef);

    if (!transactionSnap.exists()) {
      throw new Error(`${config.entityLabel} not found`);
    }

    const transaction = transactionSnap.data() as Record<string, unknown>;

    if (transaction.status !== 'PENDING_APPROVAL') {
      throw new Error(
        `Cannot approve ${config.entityLabelLower} with status: ${transaction.status}`
      );
    }

    const approvalRecord: TransactionApprovalRecord = {
      action: 'APPROVED',
      userId,
      userName,
      timestamp: new Date(),
      ...(comments ? { comments } : {}),
    };

    await updateDoc(transactionRef, {
      status: 'APPROVED' as TransactionStatus,
      approvedBy: userId,
      approvedAt: Timestamp.now(),
      approvalHistory: [
        ...((transaction.approvalHistory as TransactionApprovalRecord[]) || []),
        approvalRecord,
      ],
      updatedAt: Timestamp.now(),
      updatedBy: userId,
    });

    // Complete the approval task notification
    await completeTaskNotificationsByEntity(config.entityType, transactionId, userId);

    const displayNumber = config.getDisplayNumber(transaction);
    const entityName = (transaction.entityName as string) || config.counterpartyLabelLower;

    // Notify the submitter that their transaction was approved
    const submittedBy = transaction.submittedByUserId as string | undefined;
    if (submittedBy) {
      try {
        await createTaskNotification({
          type: 'informational',
          category: config.approvedCategory,
          userId: submittedBy,
          assignedBy: userId,
          assignedByName: userName,
          title: `${config.entityLabel} ${displayNumber} Approved`,
          message: comments
            ? `Your ${config.entityLabelLower} was approved by ${userName}: ${comments}`
            : `Your ${config.entityLabelLower} for ${entityName} was approved by ${userName}`,
          entityType: config.entityType,
          entityId: transactionId,
          linkUrl: config.linkUrl,
          priority: 'MEDIUM',
        });
      } catch (notificationError) {
        // Log but don't fail the approval if notification fails
        logger.warn('Failed to send approval notification', {
          transactionId,
          submittedBy,
          notificationError,
        });
      }
    }

    logger.info(`${config.entityLabel} approved`, {
      transactionId,
      userId,
      displayNumber,
    });
  } catch (error) {
    logger.error(`Error approving ${config.entityLabelLower}`, { transactionId, error });
    throw error;
  }
}

/**
 * Reject transaction
 *
 * Changes status from PENDING_APPROVAL → DRAFT (returned for revision)
 */
export async function rejectTransaction(
  db: Firestore,
  transactionType: ApprovableTransactionType,
  transactionId: string,
  userId: string,
  userName: string,
  comments: string
): Promise<void> {
  const config = TRANSACTION_CONFIGS[transactionType];

  // Validate all inputs - comments are required for rejections
  validateRequiredId(transactionId, `${config.entityLabel} ID`);
  validateRequiredId(userId, 'User ID');
  validateUserName(userName, 'User name');
  validateComment(comments, true); // Required for rejection

  try {
    const transactionRef = doc(db, COLLECTIONS.TRANSACTIONS, transactionId);
    const transactionSnap = await getDoc(transactionRef);

    if (!transactionSnap.exists()) {
      throw new Error(`${config.entityLabel} not found`);
    }

    const transaction = transactionSnap.data() as Record<string, unknown>;

    if (transaction.status !== 'PENDING_APPROVAL') {
      throw new Error(
        `Cannot reject ${config.entityLabelLower} with status: ${transaction.status}`
      );
    }

    const approvalRecord: TransactionApprovalRecord = {
      action: 'REJECTED',
      userId,
      userName,
      timestamp: new Date(),
      comments,
    };

    await updateDoc(transactionRef, {
      status: 'DRAFT' as TransactionStatus,
      rejectionReason: comments,
      approvalHistory: [
        ...((transaction.approvalHistory as TransactionApprovalRecord[]) || []),
        approvalRecord,
      ],
      updatedAt: Timestamp.now(),
      updatedBy: userId,
    });

    // Complete the approval task notification
    await completeTaskNotificationsByEntity(config.entityType, transactionId, userId);

    const displayNumber = config.getDisplayNumber(transaction);

    // Notify the submitter that their transaction was rejected
    const submittedBy = transaction.submittedByUserId as string | undefined;
    if (submittedBy) {
      try {
        await createTaskNotification({
          type: 'informational',
          category: config.rejectedCategory,
          userId: submittedBy,
          assignedBy: userId,
          assignedByName: userName,
          title: `${config.entityLabel} ${displayNumber} Rejected`,
          message: `Your ${config.entityLabelLower} was rejected by ${userName}: ${comments}`,
          entityType: config.entityType,
          entityId: transactionId,
          linkUrl: config.linkUrl,
          priority: 'HIGH',
        });
      } catch (notificationError) {
        // Log but don't fail the rejection if notification fails
        logger.warn('Failed to send rejection notification', {
          transactionId,
          submittedBy,
          notificationError,
        });
      }
    }

    logger.info(`${config.entityLabel} rejected`, {
      transactionId,
      userId,
      displayNumber,
    });
  } catch (error) {
    logger.error(`Error rejecting ${config.entityLabelLower}`, { transactionId, error });
    throw error;
  }
}

/**
 * Get available actions based on transaction status and user permissions
 *
 * TESTING PHASE: Edit is allowed for DRAFT and PENDING_APPROVAL statuses
 * TODO: Remove PENDING_APPROVAL from canEdit after testing phase
 */
export function getTransactionAvailableActions(
  transactionType: ApprovableTransactionType,
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
  const canApproveOrReject = canManage && status === 'PENDING_APPROVAL' && !!isApprover;

  // TESTING PHASE: Allow editing in PENDING_APPROVAL status
  const editableStatuses: TransactionStatus[] = ['DRAFT', 'PENDING_APPROVAL'];

  const baseActions = {
    canEdit: canManage && editableStatuses.includes(status),
    canSubmitForApproval: canManage && status === 'DRAFT',
    canApprove: canApproveOrReject,
    canReject: canApproveOrReject,
    canDelete: canManage && (status === 'DRAFT' || status === 'PENDING_APPROVAL'),
    canRecordPayment: false,
  };

  // Bills have additional payment action
  if (transactionType === 'VENDOR_BILL') {
    baseActions.canRecordPayment = canManage && status === 'APPROVED';
  }

  return baseActions;
}

// Re-export for backward compatibility
export {
  submitTransactionForApproval as submitForApproval,
  approveTransaction as approve,
  rejectTransaction as reject,
};
