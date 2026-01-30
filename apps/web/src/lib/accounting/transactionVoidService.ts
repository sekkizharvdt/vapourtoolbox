/**
 * Generic Transaction Void Service
 *
 * Manages voiding transactions (invoices and bills) and the "void and recreate" workflow
 * for correcting customer/vendor selection mistakes.
 *
 * When a transaction is voided:
 * 1. Status changes to VOID
 * 2. Reversing GL entries are created to cancel the original entries
 * 3. The transaction is marked with void metadata (reason, linked recreation)
 *
 * The "void and recreate" workflow allows users to:
 * 1. Void the incorrect transaction
 * 2. Automatically create a new transaction with the correct entity
 * 3. Both transactions are linked for audit trail
 */

import {
  doc,
  getDoc,
  updateDoc,
  collection,
  Timestamp,
  runTransaction,
  type Firestore,
} from 'firebase/firestore';
import { COLLECTIONS } from '@vapour/firebase';
import { createLogger } from '@vapour/logger';
import type { TransactionStatus, LedgerEntry, AuditAction, AuditEntityType } from '@vapour/types';
import { generateTransactionNumber } from './transactionNumberGenerator';
import { logAuditEvent, createAuditContext } from '@/lib/audit';

const logger = createLogger({ context: 'transactionVoidService' });

/**
 * Transaction type for void operations
 */
export type VoidableTransactionType = 'CUSTOMER_INVOICE' | 'VENDOR_BILL';

interface VoidableTransactionConfig {
  type: VoidableTransactionType;
  entityLabel: string;
  entityLabelLower: string;
  counterpartyLabel: string;
  counterpartyLabelLower: string;
  auditEventType: AuditAction;
  auditEntityType: AuditEntityType;
  getDisplayNumber: (data: Record<string, unknown>) => string;
  voidedOriginalIdField: string;
  voidedOriginalNumberField: string;
  recreatedIdField: string;
  recreatedNumberField: string;
}

const VOID_CONFIGS: Record<VoidableTransactionType, VoidableTransactionConfig> = {
  CUSTOMER_INVOICE: {
    type: 'CUSTOMER_INVOICE',
    entityLabel: 'Invoice',
    entityLabelLower: 'invoice',
    counterpartyLabel: 'Customer',
    counterpartyLabelLower: 'customer',
    auditEventType: 'INVOICE_CANCELLED',
    auditEntityType: 'INVOICE',
    getDisplayNumber: (data) => data.transactionNumber as string,
    voidedOriginalIdField: 'voidedOriginalInvoiceId',
    voidedOriginalNumberField: 'voidedOriginalInvoiceNumber',
    recreatedIdField: 'recreatedInvoiceId',
    recreatedNumberField: 'recreatedInvoiceNumber',
  },
  VENDOR_BILL: {
    type: 'VENDOR_BILL',
    entityLabel: 'Bill',
    entityLabelLower: 'bill',
    counterpartyLabel: 'Vendor',
    counterpartyLabelLower: 'vendor',
    auditEventType: 'TRANSACTION_VOIDED',
    auditEntityType: 'TRANSACTION',
    getDisplayNumber: (data) =>
      (data.vendorInvoiceNumber as string) || (data.transactionNumber as string),
    voidedOriginalIdField: 'voidedOriginalBillId',
    voidedOriginalNumberField: 'voidedOriginalBillNumber',
    recreatedIdField: 'recreatedBillId',
    recreatedNumberField: 'recreatedBillNumber',
  },
};

export interface VoidTransactionInput {
  transactionId: string;
  reason: string;
  userId: string;
  userName: string;
}

export interface VoidAndRecreateInput extends VoidTransactionInput {
  newEntityId: string;
  newEntityName: string;
}

export interface VoidResult {
  success: boolean;
  voidedTransactionId: string;
  error?: string;
}

export interface VoidAndRecreateResult {
  success: boolean;
  voidedTransactionId: string;
  newTransactionId?: string;
  newTransactionNumber?: string;
  error?: string;
}

/**
 * Generate reversing GL entries for a voided transaction
 * Each debit becomes a credit and vice versa
 */
function generateReversingEntries(originalEntries: LedgerEntry[], voidDate: Date): LedgerEntry[] {
  return originalEntries.map((entry) => ({
    ...entry,
    debit: entry.credit,
    credit: entry.debit,
    date: voidDate,
    description: `[REVERSAL] ${entry.description || ''}`,
  }));
}

/**
 * Check if a transaction can be voided
 */
export function canVoidTransaction(
  transactionType: VoidableTransactionType,
  transaction: { status?: TransactionStatus; paymentStatus?: string }
): { canVoid: boolean; reason?: string } {
  const config = VOID_CONFIGS[transactionType];

  // Cannot void already voided transactions
  if (transaction.status === 'VOID') {
    return { canVoid: false, reason: `${config.entityLabel} is already voided` };
  }

  // Cannot void paid or partially paid transactions
  if (transaction.paymentStatus === 'PAID') {
    return {
      canVoid: false,
      reason: `Cannot void ${config.entityLabelLower === 'invoice' ? 'an' : 'a'} ${config.entityLabelLower} that has been fully paid`,
    };
  }

  if (transaction.paymentStatus === 'PARTIALLY_PAID') {
    return {
      canVoid: false,
      reason: `Cannot void ${config.entityLabelLower === 'invoice' ? 'an' : 'a'} ${config.entityLabelLower} with partial payments. Reverse payments first.`,
    };
  }

  // Can void draft, pending approval, approved, rejected, or unpaid transactions
  return { canVoid: true };
}

/**
 * Void a transaction
 *
 * Changes status to VOID and creates reversing GL entries
 */
export async function voidTransaction(
  db: Firestore,
  transactionType: VoidableTransactionType,
  input: VoidTransactionInput
): Promise<VoidResult> {
  const config = VOID_CONFIGS[transactionType];
  const { transactionId, reason, userId, userName } = input;

  try {
    const transactionRef = doc(db, COLLECTIONS.TRANSACTIONS, transactionId);
    const transactionSnap = await getDoc(transactionRef);

    if (!transactionSnap.exists()) {
      return {
        success: false,
        voidedTransactionId: transactionId,
        error: `${config.entityLabel} not found`,
      };
    }

    const transaction = transactionSnap.data() as Record<string, unknown>;

    // Check if transaction can be voided
    const voidCheck = canVoidTransaction(transactionType, {
      status: transaction.status as TransactionStatus,
      paymentStatus: transaction.paymentStatus as string | undefined,
    });
    if (!voidCheck.canVoid) {
      return { success: false, voidedTransactionId: transactionId, error: voidCheck.reason };
    }

    const voidDate = new Date();

    // Generate reversing entries if transaction has GL entries
    const entries = transaction.entries as LedgerEntry[] | undefined;
    const reversingEntries = entries ? generateReversingEntries(entries, voidDate) : [];

    // Update transaction to voided status
    await updateDoc(transactionRef, {
      status: 'VOID' as TransactionStatus,
      voidedAt: Timestamp.fromDate(voidDate),
      voidedBy: userId,
      voidedByName: userName,
      voidReason: reason,
      reversalEntries: reversingEntries,
      updatedAt: Timestamp.now(),
      updatedBy: userId,
    });

    const displayNumber = config.getDisplayNumber(transaction);
    const entityName = transaction.entityName as string;

    // Audit log
    const auditContext = createAuditContext(userId, '', userName);
    try {
      await logAuditEvent(
        db,
        auditContext,
        config.auditEventType,
        config.auditEntityType,
        transactionId,
        `Voided ${config.entityLabelLower} ${displayNumber}: ${reason}`,
        {
          entityName: displayNumber,
          severity: 'WARNING',
          metadata: {
            transactionType,
            [`original${config.counterpartyLabel}`]: entityName,
            originalAmount: transaction.totalAmount,
            voidReason: reason,
          },
        }
      );
    } catch (auditError) {
      logger.warn(`Failed to write audit log for ${config.entityLabelLower} void`, {
        auditError,
        transactionId,
      });
    }

    logger.info(`${config.entityLabel} voided successfully`, {
      transactionId,
      displayNumber,
      reason,
    });

    return { success: true, voidedTransactionId: transactionId };
  } catch (error) {
    logger.error(`Error voiding ${config.entityLabelLower}`, { transactionId, error });
    return {
      success: false,
      voidedTransactionId: transactionId,
      error: error instanceof Error ? error.message : 'Unknown error',
    };
  }
}

/**
 * Void a transaction and create a new one with a different entity
 *
 * This is an atomic operation that:
 * 1. Voids the original transaction
 * 2. Creates a new transaction with the same line items but different entity
 * 3. Links both transactions for audit trail
 */
export async function voidAndRecreateTransaction(
  db: Firestore,
  transactionType: VoidableTransactionType,
  input: VoidAndRecreateInput
): Promise<VoidAndRecreateResult> {
  const config = VOID_CONFIGS[transactionType];
  const { transactionId, reason, userId, userName, newEntityId, newEntityName } = input;

  try {
    return await runTransaction(db, async (firestoreTransaction) => {
      const transactionRef = doc(db, COLLECTIONS.TRANSACTIONS, transactionId);
      const transactionSnap = await firestoreTransaction.get(transactionRef);

      if (!transactionSnap.exists()) {
        throw new Error(`${config.entityLabel} not found`);
      }

      const transaction = transactionSnap.data() as Record<string, unknown>;

      // Check if transaction can be voided
      const voidCheck = canVoidTransaction(transactionType, {
        status: transaction.status as TransactionStatus,
        paymentStatus: transaction.paymentStatus as string | undefined,
      });
      if (!voidCheck.canVoid) {
        throw new Error(voidCheck.reason);
      }

      const voidDate = new Date();
      const newTransactionNumber = await generateTransactionNumber(transactionType);

      // Generate reversing entries
      const entries = transaction.entries as LedgerEntry[] | undefined;
      const reversingEntries = entries ? generateReversingEntries(entries, voidDate) : [];

      const oldEntityName = transaction.entityName as string;
      const displayNumber = config.getDisplayNumber(transaction);

      // Build new transaction data based on type
      const baseNewData = {
        type: transactionType,
        date: transaction.date,
        dueDate: transaction.dueDate,
        description: transaction.description,
        reference: transaction.reference,
        projectId: transaction.projectId,
        costCentreId: transaction.costCentreId,
        lineItems: transaction.lineItems,
        subtotal: transaction.subtotal,
        gstDetails: transaction.gstDetails,
        totalAmount: transaction.totalAmount,
        amount: transaction.amount,
        baseAmount: transaction.baseAmount,
        currency: transaction.currency || 'INR',
        attachments: transaction.attachments || [],

        // New entity information
        entityId: newEntityId,
        entityName: newEntityName,

        // New transaction number
        transactionNumber: newTransactionNumber,

        // Reset status to draft for review
        status: 'DRAFT' as TransactionStatus,

        // Payment tracking reset
        paidAmount: 0,
        outstandingAmount: transaction.totalAmount,
        paymentStatus: 'UNPAID' as const,

        // Link to voided transaction
        [config.voidedOriginalIdField]: transactionId,
        [config.voidedOriginalNumberField]: transaction.transactionNumber,
        recreationNote: `Recreated from voided ${config.entityLabelLower} ${transaction.transactionNumber}. Reason: ${reason}`,

        // GL entries will need to be regenerated when approved
        entries: [],

        // Metadata
        createdAt: Timestamp.now(),
        createdBy: userId,
        updatedAt: Timestamp.now(),
        updatedBy: userId,
      };

      // Add type-specific fields
      let newTransactionData: Record<string, unknown>;
      if (transactionType === 'CUSTOMER_INVOICE') {
        newTransactionData = {
          ...baseNewData,
          invoiceDate: transaction.invoiceDate,
          paymentTerms: transaction.paymentTerms,
          taxAmount: transaction.taxAmount,
        };
      } else {
        // VENDOR_BILL
        newTransactionData = {
          ...baseNewData,
          vendorInvoiceNumber: transaction.vendorInvoiceNumber,
          tdsDeducted: transaction.tdsDeducted,
          tdsDetails: transaction.tdsDetails,
          tdsAmount: transaction.tdsAmount,
        };
      }

      // Create the new transaction
      const newTransactionRef = doc(collection(db, COLLECTIONS.TRANSACTIONS));

      // Update original transaction to voided status
      firestoreTransaction.update(transactionRef, {
        status: 'VOID' as TransactionStatus,
        voidedAt: Timestamp.fromDate(voidDate),
        voidedBy: userId,
        voidedByName: userName,
        voidReason: `${config.counterpartyLabel} correction: Changed from "${oldEntityName}" to "${newEntityName}"`,
        reversalEntries: reversingEntries,
        [config.recreatedIdField]: newTransactionRef.id,
        [config.recreatedNumberField]: newTransactionNumber,
        updatedAt: Timestamp.now(),
        updatedBy: userId,
      });

      // Remove undefined values before sending to Firestore
      const cleanedNewTransactionData = Object.fromEntries(
        Object.entries(newTransactionData).filter(([, value]) => value !== undefined)
      );

      // Create the new transaction
      firestoreTransaction.set(newTransactionRef, cleanedNewTransactionData);

      logger.info(`${config.entityLabel} voided and recreated`, {
        originalId: transactionId,
        newId: newTransactionRef.id,
        displayNumber,
        newTransactionNumber,
      });

      return {
        success: true,
        voidedTransactionId: transactionId,
        newTransactionId: newTransactionRef.id,
        newTransactionNumber,
      };
    });
  } catch (error) {
    logger.error(`Error in void and recreate ${config.entityLabelLower}`, { transactionId, error });
    return {
      success: false,
      voidedTransactionId: transactionId,
      error: error instanceof Error ? error.message : 'Unknown error',
    };
  }
}

/**
 * Get available actions based on transaction status for void operations
 */
export function getVoidAvailableActions(
  transactionType: VoidableTransactionType,
  transaction: { status?: TransactionStatus; paymentStatus?: string },
  canManage: boolean
): {
  canVoid: boolean;
  canVoidAndRecreate: boolean;
  voidReason?: string;
} {
  if (!canManage) {
    return { canVoid: false, canVoidAndRecreate: false, voidReason: 'Insufficient permissions' };
  }

  const voidCheck = canVoidTransaction(transactionType, transaction);

  return {
    canVoid: voidCheck.canVoid,
    canVoidAndRecreate: voidCheck.canVoid,
    voidReason: voidCheck.reason,
  };
}

// Export helpers for specific types (backward compatibility)
export function canVoidInvoice(invoice: { status?: TransactionStatus }) {
  return canVoidTransaction('CUSTOMER_INVOICE', invoice);
}

export function canVoidBill(bill: { status?: TransactionStatus }) {
  return canVoidTransaction('VENDOR_BILL', bill);
}

export async function voidInvoice(db: Firestore, input: VoidTransactionInput) {
  return voidTransaction(db, 'CUSTOMER_INVOICE', input);
}

export async function voidBill(db: Firestore, input: VoidTransactionInput) {
  return voidTransaction(db, 'VENDOR_BILL', input);
}

export async function voidAndRecreateInvoice(db: Firestore, input: VoidAndRecreateInput) {
  return voidAndRecreateTransaction(db, 'CUSTOMER_INVOICE', input);
}

export async function voidAndRecreateBill(db: Firestore, input: VoidAndRecreateInput) {
  return voidAndRecreateTransaction(db, 'VENDOR_BILL', input);
}
