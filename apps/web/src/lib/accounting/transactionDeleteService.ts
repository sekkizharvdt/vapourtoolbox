/**
 * Transaction Delete Service
 *
 * Manages soft delete, restore, and hard delete for accounting transactions.
 *
 * Workflow:
 * 1. Soft Delete: Marks transaction as deleted (isDeleted=true), hidden from main lists
 * 2. Restore: Clears soft-delete fields, restores to original state
 * 3. Hard Delete: Archives to DELETED_TRANSACTIONS collection, then permanently removes
 */

import {
  doc,
  getDoc,
  setDoc,
  updateDoc,
  deleteDoc,
  deleteField,
  Timestamp,
  type Firestore,
} from 'firebase/firestore';
import { COLLECTIONS } from '@vapour/firebase';
import { createLogger } from '@vapour/logger';
import type { TransactionStatus, TransactionType } from '@vapour/types';
import { logAuditEvent, createAuditContext } from '@/lib/audit';
import { PERMISSION_FLAGS } from '@vapour/constants';
import { requirePermission } from '@/lib/auth/authorizationService';

const logger = createLogger({ context: 'transactionDeleteService' });

// --- Types ---

export interface SoftDeleteInput {
  transactionId: string;
  reason: string;
  userId: string;
  userName: string;
  userPermissions?: number;
}

export interface SoftDeleteResult {
  success: boolean;
  transactionId: string;
  error?: string;
}

export interface RestoreInput {
  transactionId: string;
  userId: string;
  userName: string;
  userPermissions?: number;
}

export interface RestoreResult {
  success: boolean;
  transactionId: string;
  error?: string;
}

export interface HardDeleteInput {
  transactionId: string;
  userId: string;
  userName: string;
  userPermissions?: number;
}

export interface HardDeleteResult {
  success: boolean;
  transactionId: string;
  archivedDocId?: string;
  error?: string;
}

// --- Validation ---

/**
 * Check if a transaction can be soft deleted
 */
export function canSoftDelete(transaction: { status?: TransactionStatus; isDeleted?: boolean }): {
  canDelete: boolean;
  reason?: string;
} {
  if (transaction.isDeleted) {
    return { canDelete: false, reason: 'Transaction is already deleted' };
  }

  if (transaction.status === 'VOID') {
    return {
      canDelete: false,
      reason: 'Cannot delete a voided transaction',
    };
  }

  return { canDelete: true };
}

// --- Soft Delete ---

/**
 * Soft delete a transaction
 *
 * Sets isDeleted=true and records metadata. The transaction remains in the
 * TRANSACTIONS collection but is hidden from main list pages and visible
 * only on the Trash page.
 */
export async function softDeleteTransaction(
  db: Firestore,
  input: SoftDeleteInput
): Promise<SoftDeleteResult> {
  const { transactionId, reason, userId, userName, userPermissions } = input;

  // Authorization check
  if (userPermissions !== undefined) {
    requirePermission(
      userPermissions,
      PERMISSION_FLAGS.MANAGE_ACCOUNTING,
      userId,
      'delete transaction'
    );
  }

  try {
    const txnRef = doc(db, COLLECTIONS.TRANSACTIONS, transactionId);
    const txnSnap = await getDoc(txnRef);

    if (!txnSnap.exists()) {
      return { success: false, transactionId, error: 'Transaction not found' };
    }

    const data = txnSnap.data();

    // Validate
    const check = canSoftDelete({
      status: data.status as TransactionStatus | undefined,
      isDeleted: data.isDeleted as boolean | undefined,
    });
    if (!check.canDelete) {
      return { success: false, transactionId, error: check.reason };
    }

    // Soft delete
    await updateDoc(txnRef, {
      isDeleted: true,
      deletedAt: Timestamp.now(),
      deletedBy: userId,
      deletionReason: reason,
      updatedAt: Timestamp.now(),
      updatedBy: userId,
    });

    // Audit log
    const auditContext = createAuditContext(userId, '', userName);
    try {
      await logAuditEvent(
        db,
        auditContext,
        'TRANSACTION_SOFT_DELETED',
        'TRANSACTION',
        transactionId,
        `Moved to trash: ${data.transactionNumber || transactionId}. Reason: ${reason}`,
        {
          entityName: data.transactionNumber as string,
          severity: 'CRITICAL',
          metadata: {
            transactionType: data.type,
            entityName: data.entityName,
            amount: data.totalAmount || data.amount,
            deletionReason: reason,
          },
        }
      );
    } catch (auditError) {
      logger.warn('Failed to write audit log for soft delete', { auditError, transactionId });
    }

    logger.info('Transaction soft deleted', {
      transactionId,
      transactionNumber: data.transactionNumber,
      reason,
    });

    return { success: true, transactionId };
  } catch (error) {
    logger.error('Error soft deleting transaction', { transactionId, error });
    return {
      success: false,
      transactionId,
      error: error instanceof Error ? error.message : 'Unknown error',
    };
  }
}

// --- Restore ---

/**
 * Restore a soft-deleted transaction
 *
 * Clears all soft-delete fields, making the transaction visible again
 * on its original list page.
 */
export async function restoreTransaction(
  db: Firestore,
  input: RestoreInput
): Promise<RestoreResult> {
  const { transactionId, userId, userName, userPermissions } = input;

  // Authorization check
  if (userPermissions !== undefined) {
    requirePermission(
      userPermissions,
      PERMISSION_FLAGS.MANAGE_ACCOUNTING,
      userId,
      'restore transaction'
    );
  }

  try {
    const txnRef = doc(db, COLLECTIONS.TRANSACTIONS, transactionId);
    const txnSnap = await getDoc(txnRef);

    if (!txnSnap.exists()) {
      return { success: false, transactionId, error: 'Transaction not found' };
    }

    const data = txnSnap.data();

    if (!data.isDeleted) {
      return { success: false, transactionId, error: 'Transaction is not deleted' };
    }

    // Restore by clearing soft-delete fields
    await updateDoc(txnRef, {
      isDeleted: deleteField(),
      deletedAt: deleteField(),
      deletedBy: deleteField(),
      deletionReason: deleteField(),
      updatedAt: Timestamp.now(),
      updatedBy: userId,
    });

    // Audit log
    const auditContext = createAuditContext(userId, '', userName);
    try {
      await logAuditEvent(
        db,
        auditContext,
        'TRANSACTION_RESTORED',
        'TRANSACTION',
        transactionId,
        `Restored from trash: ${data.transactionNumber || transactionId}`,
        {
          entityName: data.transactionNumber as string,
          severity: 'INFO',
          metadata: {
            transactionType: data.type,
            entityName: data.entityName,
            previousDeletionReason: data.deletionReason,
          },
        }
      );
    } catch (auditError) {
      logger.warn('Failed to write audit log for restore', { auditError, transactionId });
    }

    logger.info('Transaction restored', {
      transactionId,
      transactionNumber: data.transactionNumber,
    });

    return { success: true, transactionId };
  } catch (error) {
    logger.error('Error restoring transaction', { transactionId, error });
    return {
      success: false,
      transactionId,
      error: error instanceof Error ? error.message : 'Unknown error',
    };
  }
}

// --- Hard Delete ---

/**
 * Permanently delete a transaction
 *
 * Archives the full document to DELETED_TRANSACTIONS collection for audit
 * purposes, then permanently removes it from TRANSACTIONS.
 * Only soft-deleted transactions can be hard deleted.
 */
export async function hardDeleteTransaction(
  db: Firestore,
  input: HardDeleteInput
): Promise<HardDeleteResult> {
  const { transactionId, userId, userName, userPermissions } = input;

  // Authorization check
  if (userPermissions !== undefined) {
    requirePermission(
      userPermissions,
      PERMISSION_FLAGS.MANAGE_ACCOUNTING,
      userId,
      'permanently delete transaction'
    );
  }

  try {
    const txnRef = doc(db, COLLECTIONS.TRANSACTIONS, transactionId);
    const txnSnap = await getDoc(txnRef);

    if (!txnSnap.exists()) {
      return { success: false, transactionId, error: 'Transaction not found' };
    }

    const data = txnSnap.data();

    if (!data.isDeleted) {
      return {
        success: false,
        transactionId,
        error: 'Only soft-deleted transactions can be permanently deleted',
      };
    }

    // Archive to DELETED_TRANSACTIONS
    const archiveRef = doc(db, COLLECTIONS.DELETED_TRANSACTIONS, transactionId);
    await setDoc(archiveRef, {
      ...data,
      hardDeletedAt: Timestamp.now(),
      hardDeletedBy: userId,
      hardDeletedByName: userName,
      originalId: transactionId,
    });

    // Permanently delete from TRANSACTIONS
    await deleteDoc(txnRef);

    // Audit log
    const auditContext = createAuditContext(userId, '', userName);
    try {
      await logAuditEvent(
        db,
        auditContext,
        'TRANSACTION_HARD_DELETED',
        'TRANSACTION',
        transactionId,
        `Permanently deleted: ${data.transactionNumber || transactionId}`,
        {
          entityName: data.transactionNumber as string,
          severity: 'CRITICAL',
          metadata: {
            transactionType: data.type,
            entityName: data.entityName,
            amount: data.totalAmount || data.amount,
            archivedDocId: transactionId,
          },
        }
      );
    } catch (auditError) {
      logger.warn('Failed to write audit log for hard delete', { auditError, transactionId });
    }

    logger.info('Transaction permanently deleted', {
      transactionId,
      transactionNumber: data.transactionNumber,
      archivedDocId: transactionId,
    });

    return { success: true, transactionId, archivedDocId: transactionId };
  } catch (error) {
    logger.error('Error hard deleting transaction', { transactionId, error });
    return {
      success: false,
      transactionId,
      error: error instanceof Error ? error.message : 'Unknown error',
    };
  }
}

// --- Helpers ---

const TRANSACTION_TYPE_LABELS: Record<string, string> = {
  CUSTOMER_INVOICE: 'Invoice',
  VENDOR_BILL: 'Bill',
  JOURNAL_ENTRY: 'Journal Entry',
  CUSTOMER_PAYMENT: 'Customer Payment',
  VENDOR_PAYMENT: 'Vendor Payment',
  DIRECT_PAYMENT: 'Direct Payment',
  BANK_TRANSFER: 'Bank Transfer',
  EXPENSE_CLAIM: 'Expense Claim',
};

/**
 * Get a human-readable label for a transaction type
 */
export function getTransactionTypeLabel(type: TransactionType | string): string {
  return TRANSACTION_TYPE_LABELS[type] || type;
}
