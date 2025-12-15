/**
 * Payment Helper Functions
 *
 * Utilities for managing payment allocations and updating invoice/bill statuses
 */

import {
  doc,
  getDoc,
  updateDoc,
  Timestamp,
  query,
  collection,
  where,
  getDocs,
  writeBatch,
  type Firestore,
  type DocumentData,
} from 'firebase/firestore';
import { COLLECTIONS } from '@vapour/firebase';
import type { PaymentAllocation, TransactionStatus } from '@vapour/types';
import {
  generateCustomerPaymentGLEntries,
  generateVendorPaymentGLEntries,
  type PaymentGLInput,
} from './glEntry';

/**
 * Update invoice/bill status based on payment allocations
 *
 * Status logic:
 * - UNPAID: No payments received
 * - PARTIALLY_PAID: Some payment received, but not full amount
 * - PAID: Full amount received
 */
export async function updateTransactionStatusAfterPayment(
  db: Firestore,
  transactionId: string,
  paidAmount: number
): Promise<void> {
  try {
    const transactionRef = doc(db, COLLECTIONS.TRANSACTIONS, transactionId);
    const transactionDoc = await getDoc(transactionRef);

    if (!transactionDoc.exists()) {
      console.error(`[updateTransactionStatusAfterPayment] Transaction ${transactionId} not found`);
      return;
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

    await updateDoc(transactionRef, {
      status: newStatus,
      amountPaid: newTotalPaid,
      updatedAt: Timestamp.now(),
    });
  } catch (error) {
    console.error(
      '[updateTransactionStatusAfterPayment] Error updating transaction status:',
      error
    );
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
    console.error('[getOutstandingAmount] Error calculating outstanding amount:', error);
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

    // 2. Create the payment document with GL entries
    const paymentRef = doc(collection(db, COLLECTIONS.TRANSACTIONS));
    const paymentDataWithGL = {
      ...paymentData,
      entries: glResult.entries,
      glGeneratedAt: Timestamp.now(),
    };
    batch.set(paymentRef, paymentDataWithGL);

    // 3. Update each invoice/bill status in the same batch
    for (const allocation of allocations) {
      if (allocation.allocatedAmount <= 0) continue;

      // Get current invoice data to calculate new status
      const invoiceRef = doc(db, COLLECTIONS.TRANSACTIONS, allocation.invoiceId);
      const invoiceDoc = await getDoc(invoiceRef);

      if (!invoiceDoc.exists()) {
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
        updatedAt: Timestamp.now(),
      });
    }

    // 4. Commit all operations atomically
    await batch.commit();

    return paymentRef.id;
  } catch (error) {
    console.error(
      '[createPaymentWithAllocationsAtomic] Atomic operation failed, rolling back:',
      error
    );
    throw error; // Batch automatically rolls back on error
  }
}

/**
 * Atomically update an existing payment and recalculate invoice/bill statuses
 * Also regenerates GL entries for the updated payment
 */
export async function updatePaymentWithAllocationsAtomic(
  db: Firestore,
  paymentId: string,
  paymentData: DocumentData,
  oldAllocations: PaymentAllocation[],
  newAllocations: PaymentAllocation[]
): Promise<void> {
  const batch = writeBatch(db);

  try {
    // 1. Generate GL entries for the updated payment
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

    // 2. Update the payment document with new GL entries
    const paymentRef = doc(db, COLLECTIONS.TRANSACTIONS, paymentId);
    const paymentDataWithGL = {
      ...paymentData,
      entries: glResult.entries,
      glGeneratedAt: Timestamp.now(),
    };
    batch.update(paymentRef, paymentDataWithGL);

    // 3. Revert old allocations
    for (const allocation of oldAllocations) {
      if (allocation.allocatedAmount <= 0) continue;

      const invoiceRef = doc(db, COLLECTIONS.TRANSACTIONS, allocation.invoiceId);
      const invoiceDoc = await getDoc(invoiceRef);

      if (invoiceDoc.exists()) {
        const invoiceData = invoiceDoc.data();
        const totalAmount = invoiceData.totalAmount || 0;
        const previouslyPaid = (invoiceData.amountPaid || 0) - allocation.allocatedAmount;

        let newStatus: TransactionStatus;
        if (previouslyPaid >= totalAmount) {
          newStatus = 'PAID';
        } else if (previouslyPaid > 0) {
          newStatus = 'PARTIALLY_PAID';
        } else {
          newStatus = 'UNPAID';
        }

        batch.update(invoiceRef, {
          status: newStatus,
          amountPaid: previouslyPaid,
          updatedAt: Timestamp.now(),
        });
      }
    }

    // 4. Apply new allocations
    for (const allocation of newAllocations) {
      if (allocation.allocatedAmount <= 0) continue;

      const invoiceRef = doc(db, COLLECTIONS.TRANSACTIONS, allocation.invoiceId);
      const invoiceDoc = await getDoc(invoiceRef);

      if (!invoiceDoc.exists()) {
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
        updatedAt: Timestamp.now(),
      });
    }

    // 5. Commit all operations atomically
    await batch.commit();
  } catch (error) {
    console.error(
      '[updatePaymentWithAllocationsAtomic] Atomic operation failed, rolling back:',
      error
    );
    throw error;
  }
}
