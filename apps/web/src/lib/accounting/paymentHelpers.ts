/**
 * Payment Helper Functions
 *
 * Utilities for managing payment allocations and updating invoice/bill statuses
 */

import {
  doc,
  getDoc,
  Timestamp,
  query,
  collection,
  where,
  getDocs,
  writeBatch,
  runTransaction,
  type Firestore,
  type DocumentData,
} from 'firebase/firestore';
import { COLLECTIONS } from '@vapour/firebase';
import { createLogger } from '@vapour/logger';
import type { PaymentAllocation, PaymentStatus } from '@vapour/types';
import {
  generateCustomerPaymentGLEntries,
  generateVendorPaymentGLEntries,
  type PaymentGLInput,
} from './glEntry';
import { enforceDoubleEntry, saveTransactionBatch } from './transactionService';

const logger = createLogger({ context: 'paymentHelpers' });

/**
 * Sentinel ID used for allocations against an entity's opening balance
 * (prior-year receivables/payables that don't have invoice/bill documents).
 */
export const OPENING_BALANCE_ALLOCATION_ID = '__opening_balance__';

/** Check if an allocation targets the opening balance rather than a real document */
export function isOpeningBalanceAllocation(allocation: PaymentAllocation): boolean {
  return allocation.invoiceId === OPENING_BALANCE_ALLOCATION_ID;
}

// Maximum values for financial validation
const MAX_PAYMENT_AMOUNT = 1_000_000_000_000; // 1 trillion (covers large enterprise transactions)
const MAX_ALLOCATIONS = 100; // Maximum invoices per payment

/**
 * Validate payment amount
 * Ensures amount is a positive number within acceptable range
 */
function validatePaymentAmount(amount: unknown, fieldName: string): void {
  if (typeof amount !== 'number' || !Number.isFinite(amount)) {
    throw new Error(`${fieldName} must be a valid number`);
  }
  if (amount < 0) {
    throw new Error(`${fieldName} cannot be negative`);
  }
  if (amount > MAX_PAYMENT_AMOUNT) {
    throw new Error(`${fieldName} exceeds maximum allowed value`);
  }
}

/**
 * Validate payment allocations array
 * Checks for valid structure, amounts, and prevents duplicates
 */
function validateAllocations(allocations: PaymentAllocation[], paymentAmount: number): void {
  if (!Array.isArray(allocations)) {
    throw new Error('Allocations must be an array');
  }
  if (allocations.length > MAX_ALLOCATIONS) {
    throw new Error(`Cannot have more than ${MAX_ALLOCATIONS} allocations per payment`);
  }

  const seenInvoiceIds = new Set<string>();
  let totalAllocated = 0;

  for (const allocation of allocations) {
    // Validate invoice ID
    if (!allocation.invoiceId || typeof allocation.invoiceId !== 'string') {
      throw new Error('Each allocation must have a valid invoice ID');
    }
    if (allocation.invoiceId.length > 100) {
      throw new Error('Invoice ID exceeds maximum length');
    }

    // Check for duplicates
    if (seenInvoiceIds.has(allocation.invoiceId)) {
      throw new Error(`Duplicate allocation for invoice: ${allocation.invoiceId}`);
    }
    seenInvoiceIds.add(allocation.invoiceId);

    // Validate amount
    validatePaymentAmount(allocation.allocatedAmount, 'Allocation amount');
    totalAllocated += allocation.allocatedAmount;
  }

  // Validate total doesn't exceed payment amount (with small tolerance for floating point)
  if (totalAllocated > paymentAmount + 0.01) {
    throw new Error(
      `Total allocations (${totalAllocated.toFixed(2)}) exceed payment amount (${paymentAmount.toFixed(2)})`
    );
  }
}

/**
 * Validate payment data structure
 */
function validatePaymentData(paymentData: DocumentData): void {
  // Validate payment type
  const validTypes = ['CUSTOMER_PAYMENT', 'VENDOR_PAYMENT'];
  if (!validTypes.includes(paymentData.type)) {
    throw new Error(`Invalid payment type: ${paymentData.type}`);
  }

  // Validate amount
  validatePaymentAmount(paymentData.amount, 'Payment amount');

  // Validate currency if provided
  if (paymentData.currency && typeof paymentData.currency !== 'string') {
    throw new Error('Currency must be a string');
  }
  if (paymentData.currency && paymentData.currency.length > 10) {
    throw new Error('Currency code exceeds maximum length');
  }

  // Validate entity ID
  if (!paymentData.entityId || typeof paymentData.entityId !== 'string') {
    throw new Error('Entity ID is required');
  }
  if (paymentData.entityId.length > 100) {
    throw new Error('Entity ID exceeds maximum length');
  }

  // Validate description length if provided
  if (paymentData.description && typeof paymentData.description === 'string') {
    if (paymentData.description.length > 5000) {
      throw new Error('Description exceeds maximum length of 5000 characters');
    }
  }
}

/**
 * Update invoice/bill status based on payment allocations
 *
 * Status logic:
 * - UNPAID: No payments received
 * - PARTIALLY_PAID: Some payment received, but not full amount
 * - PAID: Full amount received
 *
 * SECURITY: Uses Firestore transaction to prevent race conditions
 * when multiple payments are processed concurrently for the same invoice.
 */
export async function updateTransactionStatusAfterPayment(
  db: Firestore,
  transactionId: string,
  paidAmount: number
): Promise<void> {
  try {
    const transactionRef = doc(db, COLLECTIONS.TRANSACTIONS, transactionId);

    // Use transaction to ensure atomic read-modify-write
    await runTransaction(db, async (transaction) => {
      const transactionDoc = await transaction.get(transactionRef);

      if (!transactionDoc.exists()) {
        logger.error('Transaction not found when updating status after payment', { transactionId });
        throw new Error(`Transaction ${transactionId} not found`);
      }

      const transactionData = transactionDoc.data();
      // Use baseAmount (INR) for forex invoices, fall back to totalAmount for INR invoices
      // This ensures outstanding is always tracked in INR for consistent payment allocation
      const totalAmountINR = transactionData.baseAmount || transactionData.totalAmount || 0;
      const previouslyPaid = transactionData.amountPaid || 0;
      const newTotalPaid = previouslyPaid + paidAmount;

      let newPaymentStatus: PaymentStatus;
      if (newTotalPaid >= totalAmountINR) {
        newPaymentStatus = 'PAID';
      } else if (newTotalPaid > 0) {
        newPaymentStatus = 'PARTIALLY_PAID';
      } else {
        newPaymentStatus = 'UNPAID';
      }

      transaction.update(transactionRef, {
        paymentStatus: newPaymentStatus,
        amountPaid: newTotalPaid,
        outstandingAmount: Math.max(0, totalAmountINR - newTotalPaid),
        updatedAt: Timestamp.now(),
      });
    });
  } catch (error) {
    logger.error('Error updating transaction status after payment', {
      error,
      transactionId,
      paidAmount,
    });
    throw error;
  }
}

/**
 * Process payment allocations and update invoice/bill statuses.
 *
 * Uses a single Firestore transaction to read all target invoices/bills,
 * compute updated payment statuses, and write atomically. This prevents
 * race conditions when two concurrent payments target the same invoice.
 */
export async function processPaymentAllocations(
  db: Firestore,
  allocations: PaymentAllocation[]
): Promise<void> {
  const validAllocations = allocations.filter((a) => a.allocatedAmount > 0);
  if (validAllocations.length === 0) return;

  // Group allocations by invoice ID so multiple allocations to the same
  // invoice are summed correctly within one atomic transaction.
  const allocationsByInvoice = new Map<string, number>();
  for (const allocation of validAllocations) {
    const current = allocationsByInvoice.get(allocation.invoiceId) ?? 0;
    allocationsByInvoice.set(allocation.invoiceId, current + allocation.allocatedAmount);
  }

  await runTransaction(db, async (transaction) => {
    // Read all target transaction docs
    const reads = await Promise.all(
      Array.from(allocationsByInvoice.keys()).map(async (txnId) => {
        const ref = doc(db, COLLECTIONS.TRANSACTIONS, txnId);
        const snap = await transaction.get(ref);
        return { txnId, ref, snap };
      })
    );

    // Compute and write updates
    for (const { txnId, ref, snap } of reads) {
      if (!snap.exists()) {
        logger.error('Transaction not found when updating status after payment', {
          transactionId: txnId,
        });
        throw new Error(`Transaction ${txnId} not found`);
      }

      const data = snap.data();
      const totalAmountINR = data.baseAmount || data.totalAmount || 0;
      const previouslyPaid = data.amountPaid || 0;
      const newTotalPaid = previouslyPaid + allocationsByInvoice.get(txnId)!;

      let newPaymentStatus: PaymentStatus;
      if (newTotalPaid >= totalAmountINR) {
        newPaymentStatus = 'PAID';
      } else if (newTotalPaid > 0) {
        newPaymentStatus = 'PARTIALLY_PAID';
      } else {
        newPaymentStatus = 'UNPAID';
      }

      transaction.update(ref, {
        paymentStatus: newPaymentStatus,
        amountPaid: newTotalPaid,
        outstandingAmount: Math.max(0, totalAmountINR - newTotalPaid),
        updatedAt: Timestamp.now(),
      });
    }
  });
}

/**
 * Calculate outstanding amount for an invoice/bill
 * Queries all payments allocated to this transaction
 */
export async function getOutstandingAmount(
  db: Firestore,
  transactionId: string,
  transactionType: 'CUSTOMER_INVOICE' | 'VENDOR_BILL'
): Promise<{ totalAmount: number; amountPaid: number; outstanding: number }> {
  try {
    // Get the invoice/bill
    const transactionRef = doc(db, COLLECTIONS.TRANSACTIONS, transactionId);
    const transactionDoc = await getDoc(transactionRef);

    if (!transactionDoc.exists()) {
      throw new Error(`Transaction ${transactionId} not found`);
    }

    const transactionData = transactionDoc.data();
    const totalAmount = transactionData.totalAmount || 0;

    // Query all payments for this invoice/bill
    const paymentsRef = collection(db, COLLECTIONS.TRANSACTIONS);
    const paymentType =
      transactionType === 'CUSTOMER_INVOICE' ? 'CUSTOMER_PAYMENT' : 'VENDOR_PAYMENT';
    const q = query(paymentsRef, where('type', '==', paymentType), where('status', '==', 'POSTED'));

    const paymentsSnapshot = await getDocs(q);
    let totalPaid = 0;

    paymentsSnapshot.forEach((doc) => {
      const paymentData = doc.data();

      // Skip soft-deleted payments
      if (paymentData.isDeleted) return;

      const allocationsField =
        transactionType === 'CUSTOMER_INVOICE' ? 'invoiceAllocations' : 'billAllocations';
      const allocations = paymentData[allocationsField] || [];

      // Find allocations for this specific transaction
      allocations.forEach((allocation: PaymentAllocation) => {
        if (allocation.invoiceId === transactionId) {
          totalPaid += allocation.allocatedAmount || 0;
        }
      });
    });

    return {
      totalAmount,
      amountPaid: totalPaid,
      outstanding: totalAmount - totalPaid,
    };
  } catch (error) {
    logger.error('Error calculating outstanding amount', { error, transactionId, transactionType });
    throw error;
  }
}

/**
 * Validate payment allocation doesn't exceed invoice/bill amount
 */
export async function validatePaymentAllocation(
  db: Firestore,
  transactionId: string,
  newAllocation: number,
  transactionType: 'CUSTOMER_INVOICE' | 'VENDOR_BILL'
): Promise<{ valid: boolean; error?: string }> {
  try {
    const { outstanding } = await getOutstandingAmount(db, transactionId, transactionType);

    if (newAllocation > outstanding) {
      return {
        valid: false,
        error: `Payment allocation (${newAllocation}) exceeds outstanding amount (${outstanding})`,
      };
    }

    if (newAllocation < 0) {
      return {
        valid: false,
        error: 'Payment allocation cannot be negative',
      };
    }

    return { valid: true };
  } catch (error) {
    return {
      valid: false,
      error: error instanceof Error ? error.message : 'Unknown error',
    };
  }
}

/**
 * Atomically create a payment and update invoice/bill statuses using batch writes
 * This ensures either all operations succeed or all fail (no partial updates)
 * Also generates GL entries for the payment
 */
export async function createPaymentWithAllocationsAtomic(
  db: Firestore,
  paymentData: DocumentData,
  allocations: PaymentAllocation[]
): Promise<string> {
  // Validate inputs before any database operations
  validatePaymentData(paymentData);
  validateAllocations(allocations, paymentData.amount || 0);

  // AC-7: Validate each allocation against actual outstanding amounts
  const paymentType = paymentData.type as 'CUSTOMER_PAYMENT' | 'VENDOR_PAYMENT';
  const invoiceType = paymentType === 'CUSTOMER_PAYMENT' ? 'CUSTOMER_INVOICE' : 'VENDOR_BILL';
  const validAllocationsForCheck = allocations.filter((a) => a.allocatedAmount > 0);
  for (const allocation of validAllocationsForCheck) {
    const result = await validatePaymentAllocation(
      db,
      allocation.invoiceId,
      allocation.allocatedAmount,
      invoiceType
    );
    if (!result.valid) {
      throw new Error(`Invalid allocation for ${allocation.invoiceId}: ${result.error}`);
    }
  }

  const batch = writeBatch(db);

  try {
    // 1. Generate GL entries for the payment
    const glInput: PaymentGLInput = {
      transactionId: '', // Will be set after payment creation
      transactionNumber: paymentData.transactionNumber || '',
      transactionDate: paymentData.transactionDate || Timestamp.now(),
      amount: paymentData.amount || 0,
      currency: paymentData.currency || 'INR',
      paymentMethod: paymentData.paymentMethod || 'BANK_TRANSFER',
      bankAccountId: paymentData.bankAccountId,
      description: paymentData.description || '',
      entityId: paymentData.entityId || '',
      projectId: paymentData.projectId,
    };

    let glResult;
    if (paymentType === 'CUSTOMER_PAYMENT') {
      glResult = await generateCustomerPaymentGLEntries(db, glInput);
    } else if (paymentType === 'VENDOR_PAYMENT') {
      glResult = await generateVendorPaymentGLEntries(db, glInput);
    } else {
      throw new Error(`Invalid payment type: ${paymentType}`);
    }

    if (!glResult.success) {
      throw new Error(`GL entry generation failed: ${glResult.errors.join(', ')}`);
    }

    // 2. Enforce double-entry validation before creating the payment
    enforceDoubleEntry(glResult.entries);

    // 3. Create the payment document with GL entries using the validated helper
    const paymentDataWithGL = {
      ...paymentData,
      type: paymentType, // Ensure type is set for transaction service
      entries: glResult.entries,
      glGeneratedAt: Timestamp.now(),
    };
    const paymentRef = saveTransactionBatch(batch, db, paymentDataWithGL);

    // 4. Fetch all invoices in parallel (avoid N+1 queries)
    const validAllocations = allocations.filter((a) => a.allocatedAmount > 0);
    const invoiceRefs = validAllocations.map((a) => doc(db, COLLECTIONS.TRANSACTIONS, a.invoiceId));
    const invoiceDocs = await Promise.all(invoiceRefs.map((ref) => getDoc(ref)));

    // 5. Update each invoice/bill status in the same batch
    validAllocations.forEach((allocation, index) => {
      const invoiceDoc = invoiceDocs[index];
      const invoiceRef = invoiceRefs[index];

      if (!invoiceDoc || !invoiceDoc.exists() || !invoiceRef) {
        const label = allocation.invoiceNumber || allocation.invoiceId;
        throw new Error(
          `Bill/invoice ${label} no longer exists. Please remove it from your allocations and try again.`
        );
      }

      const invoiceData = invoiceDoc.data();
      // Use baseAmount (INR) for forex invoices, fall back to totalAmount for INR invoices
      const totalAmountINR = invoiceData.baseAmount || invoiceData.totalAmount || 0;
      const previouslyPaid = invoiceData.amountPaid || 0;
      const newTotalPaid = previouslyPaid + allocation.allocatedAmount;

      let newPaymentStatus: PaymentStatus;
      if (newTotalPaid >= totalAmountINR) {
        newPaymentStatus = 'PAID';
      } else if (newTotalPaid > 0) {
        newPaymentStatus = 'PARTIALLY_PAID';
      } else {
        newPaymentStatus = 'UNPAID';
      }

      batch.update(invoiceRef, {
        paymentStatus: newPaymentStatus,
        amountPaid: newTotalPaid,
        outstandingAmount: Math.max(0, totalAmountINR - newTotalPaid),
        updatedAt: Timestamp.now(),
      });
    });

    // 6. Commit all operations atomically
    await batch.commit();

    return paymentRef.id;
  } catch (error) {
    logger.error('Atomic payment creation failed, rolling back', {
      error,
      allocationsCount: allocations.length,
    });
    throw error; // Batch automatically rolls back on error
  }
}

/**
 * Atomically update an existing payment and recalculate invoice/bill statuses
 * Also regenerates GL entries for the updated payment
 *
 * Uses runTransaction to ensure reads and writes are atomic - prevents race
 * conditions where invoice amounts change between read and update.
 */
export async function updatePaymentWithAllocationsAtomic(
  db: Firestore,
  paymentId: string,
  paymentData: DocumentData,
  oldAllocations: PaymentAllocation[],
  newAllocations: PaymentAllocation[]
): Promise<void> {
  // Validate inputs before any operations
  if (!paymentId || typeof paymentId !== 'string' || paymentId.length > 100) {
    throw new Error('Invalid payment ID');
  }
  validatePaymentData(paymentData);
  validateAllocations(newAllocations, paymentData.amount || 0);

  // Generate GL entries outside transaction (they don't modify state)
  const paymentType = paymentData.type as 'CUSTOMER_PAYMENT' | 'VENDOR_PAYMENT';
  const glInput: PaymentGLInput = {
    transactionId: paymentId,
    transactionNumber: paymentData.transactionNumber || '',
    transactionDate: paymentData.transactionDate || Timestamp.now(),
    amount: paymentData.amount || 0,
    currency: paymentData.currency || 'INR',
    paymentMethod: paymentData.paymentMethod || 'BANK_TRANSFER',
    bankAccountId: paymentData.bankAccountId,
    description: paymentData.description || '',
    entityId: paymentData.entityId || '',
    projectId: paymentData.projectId,
  };

  let glResult;
  if (paymentType === 'CUSTOMER_PAYMENT') {
    glResult = await generateCustomerPaymentGLEntries(db, glInput);
  } else if (paymentType === 'VENDOR_PAYMENT') {
    glResult = await generateVendorPaymentGLEntries(db, glInput);
  } else {
    throw new Error(`Invalid payment type: ${paymentType}`);
  }

  if (!glResult.success) {
    throw new Error(`GL entry generation failed: ${glResult.errors.join(', ')}`);
  }

  // Use transaction to ensure consistent reads and writes
  await runTransaction(db, async (transaction) => {
    const now = Timestamp.now();

    // Read all affected invoices within transaction
    const allInvoiceIds = new Set([
      ...oldAllocations.filter((a) => a.allocatedAmount > 0).map((a) => a.invoiceId),
      ...newAllocations.filter((a) => a.allocatedAmount > 0).map((a) => a.invoiceId),
    ]);

    const invoiceRefs = Array.from(allInvoiceIds).map((id) =>
      doc(db, COLLECTIONS.TRANSACTIONS, id)
    );
    const invoiceDocs = await Promise.all(invoiceRefs.map((ref) => transaction.get(ref)));

    // Build map of current invoice data
    const invoiceDataMap = new Map<string, DocumentData>();
    invoiceDocs.forEach((docSnap, index) => {
      if (docSnap.exists()) {
        invoiceDataMap.set(invoiceRefs[index]!.id, docSnap.data());
      }
    });

    // Update the payment document with new GL entries
    const paymentRef = doc(db, COLLECTIONS.TRANSACTIONS, paymentId);
    const paymentDataWithGL = {
      ...paymentData,
      entries: glResult.entries,
      glGeneratedAt: now,
    };
    transaction.update(paymentRef, paymentDataWithGL);

    // Calculate net change per invoice
    const invoiceChanges = new Map<string, number>();

    // Subtract old allocations
    for (const allocation of oldAllocations) {
      if (allocation.allocatedAmount <= 0) continue;
      const current = invoiceChanges.get(allocation.invoiceId) || 0;
      invoiceChanges.set(allocation.invoiceId, current - allocation.allocatedAmount);
    }

    // Add new allocations
    for (const allocation of newAllocations) {
      if (allocation.allocatedAmount <= 0) continue;
      const current = invoiceChanges.get(allocation.invoiceId) || 0;
      invoiceChanges.set(allocation.invoiceId, current + allocation.allocatedAmount);
    }

    // Build lookup for friendly invoice/bill numbers
    const allAllocations = [...oldAllocations, ...newAllocations];
    const invoiceNumberMap = new Map<string, string>();
    for (const a of allAllocations) {
      if (a.invoiceNumber) invoiceNumberMap.set(a.invoiceId, a.invoiceNumber);
    }

    // Build set of new allocation invoice IDs for validation
    const newAllocationIds = new Set(
      newAllocations.filter((a) => a.allocatedAmount > 0).map((a) => a.invoiceId)
    );

    // Apply changes to each invoice
    for (const [invoiceId, netChange] of invoiceChanges) {
      if (netChange === 0) continue;

      const invoiceData = invoiceDataMap.get(invoiceId);
      if (!invoiceData) {
        // If this invoice is only in old allocations (being removed), skip it —
        // the document was deleted so there's nothing to reverse
        if (!newAllocationIds.has(invoiceId)) {
          logger.warn('Skipping missing invoice from old allocations', { invoiceId, netChange });
          continue;
        }
        const label = invoiceNumberMap.get(invoiceId) || invoiceId;
        throw new Error(
          `Bill/invoice ${label} no longer exists. Please remove it from your allocations and try again.`
        );
      }

      // Use baseAmount (INR) for forex invoices, fall back to totalAmount for INR invoices
      const totalAmountINR = invoiceData.baseAmount || invoiceData.totalAmount || 0;
      const previouslyPaid = invoiceData.amountPaid || 0;
      const newTotalPaid = Math.max(0, previouslyPaid + netChange);

      let newPaymentStatus: PaymentStatus;
      if (newTotalPaid >= totalAmountINR) {
        newPaymentStatus = 'PAID';
      } else if (newTotalPaid > 0) {
        newPaymentStatus = 'PARTIALLY_PAID';
      } else {
        newPaymentStatus = 'UNPAID';
      }

      const invoiceRef = doc(db, COLLECTIONS.TRANSACTIONS, invoiceId);
      transaction.update(invoiceRef, {
        paymentStatus: newPaymentStatus,
        amountPaid: newTotalPaid,
        outstandingAmount: Math.max(0, totalAmountINR - newTotalPaid),
        updatedAt: now,
      });
    }
  });

  logger.info('Payment updated atomically', { paymentId, allocationsCount: newAllocations.length });
}
