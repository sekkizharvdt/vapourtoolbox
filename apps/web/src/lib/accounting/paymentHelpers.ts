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
import type { PaymentAllocation, TransactionStatus } from '@vapour/types';
import {
  generateCustomerPaymentGLEntries,
  generateVendorPaymentGLEntries,
  type PaymentGLInput,
} from './glEntry';
import { enforceDoubleEntry, saveTransactionBatch } from './transactionService';

const logger = createLogger({ context: 'paymentHelpers' });

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
      const totalAmount = transactionData.totalAmount || 0;
      const previouslyPaid = transactionData.amountPaid || 0;
      const newTotalPaid = previouslyPaid + paidAmount;

      let newStatus: TransactionStatus;
      if (newTotalPaid >= totalAmount) {
        newStatus = 'PAID';
      } else if (newTotalPaid > 0) {
        newStatus = 'PARTIALLY_PAID';
      } else {
        newStatus = 'UNPAID';
      }

      transaction.update(transactionRef, {
        status: newStatus,
        amountPaid: newTotalPaid,
        outstandingAmount: Math.max(0, totalAmount - newTotalPaid),
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
 * Process payment allocations and update invoice/bill statuses
 */
export async function processPaymentAllocations(
  db: Firestore,
  allocations: PaymentAllocation[]
): Promise<void> {
  const updatePromises = allocations
    .filter((allocation) => allocation.allocatedAmount > 0)
    .map((allocation) =>
      updateTransactionStatusAfterPayment(db, allocation.invoiceId, allocation.allocatedAmount)
    );

  await Promise.all(updatePromises);
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

  const batch = writeBatch(db);

  try {
    // 1. Generate GL entries for the payment
    const paymentType = paymentData.type as 'CUSTOMER_PAYMENT' | 'VENDOR_PAYMENT';
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
        throw new Error(`Invoice ${allocation.invoiceId} not found`);
      }

      const invoiceData = invoiceDoc.data();
      const totalAmount = invoiceData.totalAmount || 0;
      const previouslyPaid = invoiceData.amountPaid || 0;
      const newTotalPaid = previouslyPaid + allocation.allocatedAmount;

      let newStatus: TransactionStatus;
      if (newTotalPaid >= totalAmount) {
        newStatus = 'PAID';
      } else if (newTotalPaid > 0) {
        newStatus = 'PARTIALLY_PAID';
      } else {
        newStatus = 'UNPAID';
      }

      batch.update(invoiceRef, {
        status: newStatus,
        amountPaid: newTotalPaid,
        outstandingAmount: Math.max(0, totalAmount - newTotalPaid),
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

    // Apply changes to each invoice
    for (const [invoiceId, netChange] of invoiceChanges) {
      if (netChange === 0) continue;

      const invoiceData = invoiceDataMap.get(invoiceId);
      if (!invoiceData) {
        throw new Error(`Invoice ${invoiceId} not found`);
      }

      const totalAmount = invoiceData.totalAmount || 0;
      const previouslyPaid = invoiceData.amountPaid || 0;
      const newTotalPaid = Math.max(0, previouslyPaid + netChange);

      let newStatus: TransactionStatus;
      if (newTotalPaid >= totalAmount) {
        newStatus = 'PAID';
      } else if (newTotalPaid > 0) {
        newStatus = 'PARTIALLY_PAID';
      } else {
        newStatus = 'UNPAID';
      }

      const invoiceRef = doc(db, COLLECTIONS.TRANSACTIONS, invoiceId);
      transaction.update(invoiceRef, {
        status: newStatus,
        amountPaid: newTotalPaid,
        outstandingAmount: Math.max(0, totalAmount - newTotalPaid),
        updatedAt: now,
      });
    }
  });

  logger.info('Payment updated atomically', { paymentId, allocationsCount: newAllocations.length });
}
