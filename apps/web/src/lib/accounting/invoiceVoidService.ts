/**
 * Customer Invoice Void Service
 *
 * Manages voiding customer invoices and the "void and recreate" workflow
 * for correcting customer selection or invoice mistakes.
 *
 * When an invoice is voided:
 * 1. Status changes to VOID
 * 2. Reversing GL entries are created to cancel the original entries
 * 3. The invoice is marked with void metadata (reason, linked recreation)
 *
 * The "void and recreate" workflow allows users to:
 * 1. Void the incorrect invoice
 * 2. Automatically create a new invoice with the correct customer
 * 3. Both invoices are linked for audit trail
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
import type { CustomerInvoice, TransactionStatus, LedgerEntry } from '@vapour/types';
import { generateTransactionNumber } from './transactionNumberGenerator';
import { logAuditEvent, createAuditContext } from '@/lib/audit';

const logger = createLogger({ context: 'invoiceVoidService' });

/**
 * Safely convert Firestore document data to CustomerInvoice
 */
function docToCustomerInvoice(id: string, data: Record<string, unknown>): CustomerInvoice {
  // eslint-disable-next-line @typescript-eslint/consistent-type-assertions
  return { ...data, id } as CustomerInvoice;
}

export interface VoidInvoiceInput {
  invoiceId: string;
  reason: string;
  userId: string;
  userName: string;
}

export interface VoidAndRecreateInvoiceInput extends VoidInvoiceInput {
  newCustomerId: string;
  newCustomerName: string;
}

export interface VoidInvoiceResult {
  success: boolean;
  voidedInvoiceId: string;
  error?: string;
}

export interface VoidAndRecreateInvoiceResult {
  success: boolean;
  voidedInvoiceId: string;
  newInvoiceId?: string;
  newTransactionNumber?: string;
  error?: string;
}

/**
 * Check if an invoice can be voided
 */
export function canVoidInvoice(invoice: CustomerInvoice): { canVoid: boolean; reason?: string } {
  // Cannot void already voided invoices
  if (invoice.status === 'VOID') {
    return { canVoid: false, reason: 'Invoice is already voided' };
  }

  // Cannot void paid or partially paid invoices
  if (invoice.paymentStatus === 'PAID') {
    return { canVoid: false, reason: 'Cannot void an invoice that has been fully paid' };
  }

  if (invoice.paymentStatus === 'PARTIALLY_PAID') {
    return {
      canVoid: false,
      reason: 'Cannot void an invoice with partial payments. Reverse payments first.',
    };
  }

  // Can void draft, pending approval, approved, rejected, or unpaid invoices
  return { canVoid: true };
}

/**
 * Generate reversing GL entries for a voided invoice
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
 * Void a customer invoice
 *
 * Changes status to VOID and creates reversing GL entries
 */
export async function voidInvoice(
  db: Firestore,
  input: VoidInvoiceInput
): Promise<VoidInvoiceResult> {
  const { invoiceId, reason, userId, userName } = input;

  try {
    const invoiceRef = doc(db, COLLECTIONS.TRANSACTIONS, invoiceId);
    const invoiceSnap = await getDoc(invoiceRef);

    if (!invoiceSnap.exists()) {
      return { success: false, voidedInvoiceId: invoiceId, error: 'Invoice not found' };
    }

    const invoice = docToCustomerInvoice(
      invoiceSnap.id,
      invoiceSnap.data() as Record<string, unknown>
    );

    // Check if invoice can be voided
    const voidCheck = canVoidInvoice(invoice);
    if (!voidCheck.canVoid) {
      return { success: false, voidedInvoiceId: invoiceId, error: voidCheck.reason };
    }

    const voidDate = new Date();

    // Generate reversing entries if invoice has GL entries
    const reversingEntries = invoice.entries
      ? generateReversingEntries(invoice.entries, voidDate)
      : [];

    // Update invoice to voided status
    await updateDoc(invoiceRef, {
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
        'INVOICE_CANCELLED',
        'INVOICE',
        invoiceId,
        `Voided invoice ${invoice.transactionNumber}: ${reason}`,
        {
          entityName: invoice.transactionNumber,
          severity: 'WARNING',
          metadata: {
            transactionType: 'CUSTOMER_INVOICE',
            originalCustomer: invoice.entityName,
            originalAmount: invoice.totalAmount,
            voidReason: reason,
          },
        }
      );
    } catch (auditError) {
      logger.warn('Failed to write audit log for invoice void', { auditError, invoiceId });
    }

    logger.info('Invoice voided successfully', {
      invoiceId,
      invoiceNumber: invoice.transactionNumber,
      reason,
    });

    return { success: true, voidedInvoiceId: invoiceId };
  } catch (error) {
    logger.error('Error voiding invoice', { invoiceId, error });
    return {
      success: false,
      voidedInvoiceId: invoiceId,
      error: error instanceof Error ? error.message : 'Unknown error',
    };
  }
}

/**
 * Void an invoice and create a new one with a different customer
 *
 * This is an atomic operation that:
 * 1. Voids the original invoice
 * 2. Creates a new invoice with the same line items but different customer
 * 3. Links both invoices for audit trail
 */
export async function voidAndRecreateInvoice(
  db: Firestore,
  input: VoidAndRecreateInvoiceInput
): Promise<VoidAndRecreateInvoiceResult> {
  const { invoiceId, reason, userId, userName, newCustomerId, newCustomerName } = input;

  try {
    return await runTransaction(db, async (transaction) => {
      const invoiceRef = doc(db, COLLECTIONS.TRANSACTIONS, invoiceId);
      const invoiceSnap = await transaction.get(invoiceRef);

      if (!invoiceSnap.exists()) {
        throw new Error('Invoice not found');
      }

      const invoice = docToCustomerInvoice(
        invoiceSnap.id,
        invoiceSnap.data() as Record<string, unknown>
      );

      // Check if invoice can be voided
      const voidCheck = canVoidInvoice(invoice);
      if (!voidCheck.canVoid) {
        throw new Error(voidCheck.reason);
      }

      const voidDate = new Date();
      const newTransactionNumber = await generateTransactionNumber('CUSTOMER_INVOICE');

      // Generate reversing entries
      const reversingEntries = invoice.entries
        ? generateReversingEntries(invoice.entries, voidDate)
        : [];

      // Create the new invoice data (copy from original with new customer)
      const newInvoiceData = {
        // Copy all original data
        type: 'CUSTOMER_INVOICE' as const,
        date: invoice.date,
        invoiceDate: invoice.invoiceDate,
        dueDate: invoice.dueDate,
        paymentTerms: invoice.paymentTerms,
        description: invoice.description,
        reference: invoice.reference,
        projectId: invoice.projectId,
        costCentreId: invoice.costCentreId,
        lineItems: invoice.lineItems,
        subtotal: invoice.subtotal,
        taxAmount: invoice.taxAmount,
        gstDetails: invoice.gstDetails,
        totalAmount: invoice.totalAmount,
        amount: invoice.amount,
        baseAmount: invoice.baseAmount,
        currency: invoice.currency || 'INR',
        attachments: invoice.attachments || [],

        // New customer information
        entityId: newCustomerId,
        entityName: newCustomerName,

        // New transaction number
        transactionNumber: newTransactionNumber,

        // Reset status to draft for review
        status: 'DRAFT' as TransactionStatus,

        // Payment tracking reset
        paidAmount: 0,
        outstandingAmount: invoice.totalAmount,
        paymentStatus: 'UNPAID' as const,

        // Link to voided invoice
        voidedOriginalInvoiceId: invoiceId,
        voidedOriginalInvoiceNumber: invoice.transactionNumber,
        recreationNote: `Recreated from voided invoice ${invoice.transactionNumber}. Reason: ${reason}`,

        // GL entries will need to be regenerated when approved
        entries: [],

        // Metadata
        createdAt: Timestamp.now(),
        createdBy: userId,
        updatedAt: Timestamp.now(),
        updatedBy: userId,
      };

      // Create the new invoice
      const newInvoiceRef = doc(collection(db, COLLECTIONS.TRANSACTIONS));

      // Update original invoice to voided status
      transaction.update(invoiceRef, {
        status: 'VOID' as TransactionStatus,
        voidedAt: Timestamp.fromDate(voidDate),
        voidedBy: userId,
        voidedByName: userName,
        voidReason: `Customer correction: Changed from "${invoice.entityName}" to "${newCustomerName}"`,
        reversalEntries: reversingEntries,
        recreatedInvoiceId: newInvoiceRef.id,
        recreatedInvoiceNumber: newTransactionNumber,
        updatedAt: Timestamp.now(),
        updatedBy: userId,
      });

      // Remove undefined values before sending to Firestore
      const cleanedNewInvoiceData = Object.fromEntries(
        Object.entries(newInvoiceData).filter(([, value]) => value !== undefined)
      );

      // Create the new invoice
      transaction.set(newInvoiceRef, cleanedNewInvoiceData);

      return {
        success: true,
        voidedInvoiceId: invoiceId,
        newInvoiceId: newInvoiceRef.id,
        newTransactionNumber,
      };
    });
  } catch (error) {
    logger.error('Error in void and recreate invoice', { invoiceId, error });
    return {
      success: false,
      voidedInvoiceId: invoiceId,
      error: error instanceof Error ? error.message : 'Unknown error',
    };
  }
}

/**
 * Get available actions based on invoice status for void operations
 */
export function getVoidInvoiceAvailableActions(
  invoice: CustomerInvoice,
  canManage: boolean
): {
  canVoid: boolean;
  canVoidAndRecreate: boolean;
  voidReason?: string;
} {
  if (!canManage) {
    return { canVoid: false, canVoidAndRecreate: false, voidReason: 'Insufficient permissions' };
  }

  const voidCheck = canVoidInvoice(invoice);

  return {
    canVoid: voidCheck.canVoid,
    canVoidAndRecreate: voidCheck.canVoid,
    voidReason: voidCheck.reason,
  };
}
