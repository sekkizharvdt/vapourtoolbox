/**
 * Vendor Bill Void Service
 *
 * Manages voiding vendor bills and the "void and recreate" workflow
 * for correcting vendor selection mistakes.
 *
 * When a bill is voided:
 * 1. Status changes to VOID
 * 2. Reversing GL entries are created to cancel the original entries
 * 3. The bill is marked with void metadata (reason, linked recreation)
 *
 * The "void and recreate" workflow allows users to:
 * 1. Void the incorrect bill
 * 2. Automatically create a new bill with the correct vendor
 * 3. Both bills are linked for audit trail
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
import type { VendorBill, TransactionStatus, LedgerEntry } from '@vapour/types';
import { generateTransactionNumber } from './transactionNumberGenerator';
import { logAuditEvent, createAuditContext } from '@/lib/audit';

const logger = createLogger({ context: 'billVoidService' });

export interface VoidBillInput {
  billId: string;
  reason: string;
  userId: string;
  userName: string;
}

export interface VoidAndRecreateInput extends VoidBillInput {
  newVendorId: string;
  newVendorName: string;
}

export interface VoidBillResult {
  success: boolean;
  voidedBillId: string;
  error?: string;
}

export interface VoidAndRecreateResult {
  success: boolean;
  voidedBillId: string;
  newBillId?: string;
  newTransactionNumber?: string;
  error?: string;
}

/**
 * Check if a bill can be voided
 */
export function canVoidBill(bill: VendorBill): { canVoid: boolean; reason?: string } {
  // Cannot void already voided bills
  if (bill.status === 'VOID') {
    return { canVoid: false, reason: 'Bill is already voided' };
  }

  // Cannot void paid or partially paid bills
  if (bill.status === 'PAID') {
    return { canVoid: false, reason: 'Cannot void a bill that has been fully paid' };
  }

  if (bill.status === 'PARTIALLY_PAID') {
    return {
      canVoid: false,
      reason: 'Cannot void a bill with partial payments. Reverse payments first.',
    };
  }

  // Can void draft, pending approval, approved, rejected, or unpaid bills
  return { canVoid: true };
}

/**
 * Generate reversing GL entries for a voided bill
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
 * Void a vendor bill
 *
 * Changes status to VOID and creates reversing GL entries
 */
export async function voidBill(db: Firestore, input: VoidBillInput): Promise<VoidBillResult> {
  const { billId, reason, userId, userName } = input;

  try {
    const billRef = doc(db, COLLECTIONS.TRANSACTIONS, billId);
    const billSnap = await getDoc(billRef);

    if (!billSnap.exists()) {
      return { success: false, voidedBillId: billId, error: 'Bill not found' };
    }

    const bill = { ...billSnap.data(), id: billSnap.id } as unknown as VendorBill;

    // Check if bill can be voided
    const voidCheck = canVoidBill(bill);
    if (!voidCheck.canVoid) {
      return { success: false, voidedBillId: billId, error: voidCheck.reason };
    }

    const voidDate = new Date();

    // Generate reversing entries if bill has GL entries
    const reversingEntries = bill.entries ? generateReversingEntries(bill.entries, voidDate) : [];

    // Update bill to voided status
    await updateDoc(billRef, {
      status: 'VOID' as TransactionStatus,
      voidedAt: Timestamp.fromDate(voidDate),
      voidedBy: userId,
      voidedByName: userName,
      voidReason: reason,
      reversalEntries: reversingEntries,
      updatedAt: Timestamp.now(),
      updatedBy: userId,
    });

    // Audit log
    const auditContext = createAuditContext(userId, '', userName);
    try {
      await logAuditEvent(
        db,
        auditContext,
        'TRANSACTION_VOIDED',
        'TRANSACTION',
        billId,
        `Voided bill ${bill.vendorInvoiceNumber || bill.transactionNumber}: ${reason}`,
        {
          entityName: bill.vendorInvoiceNumber || bill.transactionNumber,
          severity: 'WARNING',
          metadata: {
            transactionType: 'VENDOR_BILL',
            originalVendor: bill.entityName,
            originalAmount: bill.totalAmount,
            voidReason: reason,
          },
        }
      );
    } catch (auditError) {
      logger.warn('Failed to write audit log for bill void', { auditError, billId });
    }

    logger.info('Bill voided successfully', {
      billId,
      billNumber: bill.vendorInvoiceNumber || bill.transactionNumber,
      reason,
    });

    return { success: true, voidedBillId: billId };
  } catch (error) {
    logger.error('Error voiding bill', { billId, error });
    return {
      success: false,
      voidedBillId: billId,
      error: error instanceof Error ? error.message : 'Unknown error',
    };
  }
}

/**
 * Void a bill and create a new one with a different vendor
 *
 * This is an atomic operation that:
 * 1. Voids the original bill
 * 2. Creates a new bill with the same line items but different vendor
 * 3. Links both bills for audit trail
 */
export async function voidAndRecreateBill(
  db: Firestore,
  input: VoidAndRecreateInput
): Promise<VoidAndRecreateResult> {
  const { billId, reason, userId, userName, newVendorId, newVendorName } = input;

  try {
    return await runTransaction(db, async (transaction) => {
      const billRef = doc(db, COLLECTIONS.TRANSACTIONS, billId);
      const billSnap = await transaction.get(billRef);

      if (!billSnap.exists()) {
        throw new Error('Bill not found');
      }

      const bill = { ...billSnap.data(), id: billSnap.id } as unknown as VendorBill;

      // Check if bill can be voided
      const voidCheck = canVoidBill(bill);
      if (!voidCheck.canVoid) {
        throw new Error(voidCheck.reason);
      }

      const voidDate = new Date();
      const newTransactionNumber = await generateTransactionNumber('VENDOR_BILL');

      // Generate reversing entries
      const reversingEntries = bill.entries ? generateReversingEntries(bill.entries, voidDate) : [];

      // Create the new bill data (copy from original with new vendor)
      const newBillData = {
        // Copy all original data
        type: 'VENDOR_BILL' as const,
        date: bill.date,
        dueDate: bill.dueDate,
        description: bill.description,
        reference: bill.reference,
        projectId: bill.projectId,
        costCentreId: bill.costCentreId,
        lineItems: bill.lineItems,
        subtotal: bill.subtotal,
        gstDetails: bill.gstDetails,
        tdsDeducted: bill.tdsDeducted,
        tdsDetails: bill.tdsDetails,
        tdsAmount: bill.tdsAmount,
        totalAmount: bill.totalAmount,
        amount: bill.amount,
        baseAmount: bill.baseAmount,
        currency: bill.currency || 'INR',
        attachments: bill.attachments || [],

        // New vendor information
        entityId: newVendorId,
        entityName: newVendorName,

        // New transaction number
        transactionNumber: newTransactionNumber,
        vendorInvoiceNumber: bill.vendorInvoiceNumber, // Keep same vendor invoice number

        // Reset status to draft for review
        status: 'DRAFT' as TransactionStatus,

        // Payment tracking reset
        paidAmount: 0,
        outstandingAmount: bill.totalAmount,
        paymentStatus: 'UNPAID' as const,

        // Link to voided bill
        voidedOriginalBillId: billId,
        voidedOriginalBillNumber: bill.transactionNumber,
        recreationNote: `Recreated from voided bill ${bill.transactionNumber}. Reason: ${reason}`,

        // GL entries will need to be regenerated when approved
        entries: [],

        // Metadata
        createdAt: Timestamp.now(),
        createdBy: userId,
        updatedAt: Timestamp.now(),
        updatedBy: userId,
      };

      // Create the new bill
      const newBillRef = doc(collection(db, COLLECTIONS.TRANSACTIONS));

      // Update original bill to voided status
      transaction.update(billRef, {
        status: 'VOID' as TransactionStatus,
        voidedAt: Timestamp.fromDate(voidDate),
        voidedBy: userId,
        voidedByName: userName,
        voidReason: `Vendor correction: Changed from "${bill.entityName}" to "${newVendorName}"`,
        reversalEntries: reversingEntries,
        recreatedBillId: newBillRef.id,
        recreatedBillNumber: newTransactionNumber,
        updatedAt: Timestamp.now(),
        updatedBy: userId,
      });

      // Create the new bill
      transaction.set(newBillRef, newBillData);

      return {
        success: true,
        voidedBillId: billId,
        newBillId: newBillRef.id,
        newTransactionNumber,
      };
    });
  } catch (error) {
    logger.error('Error in void and recreate bill', { billId, error });
    return {
      success: false,
      voidedBillId: billId,
      error: error instanceof Error ? error.message : 'Unknown error',
    };
  }
}

/**
 * Get available actions based on bill status for void operations
 */
export function getVoidAvailableActions(
  bill: VendorBill,
  canManage: boolean
): {
  canVoid: boolean;
  canVoidAndRecreate: boolean;
  voidReason?: string;
} {
  if (!canManage) {
    return { canVoid: false, canVoidAndRecreate: false, voidReason: 'Insufficient permissions' };
  }

  const voidCheck = canVoidBill(bill);

  return {
    canVoid: voidCheck.canVoid,
    canVoidAndRecreate: voidCheck.canVoid,
    voidReason: voidCheck.reason,
  };
}
