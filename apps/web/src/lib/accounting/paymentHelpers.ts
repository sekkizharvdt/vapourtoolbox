/**
 * Payment Helper Functions
 *
 * Utilities for managing payment allocations and updating invoice/bill statuses
 */

import { doc, getDoc, updateDoc, Timestamp, query, collection, where, getDocs } from 'firebase/firestore';
import { COLLECTIONS } from '@vapour/firebase';
import type { PaymentAllocation, TransactionStatus } from '@vapour/types';

/**
 * Update invoice/bill status based on payment allocations
 *
 * Status logic:
 * - UNPAID: No payments received
 * - PARTIALLY_PAID: Some payment received, but not full amount
 * - PAID: Full amount received
 */
export async function updateTransactionStatusAfterPayment(
  db: any,
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

    console.log(`[updateTransactionStatusAfterPayment] Updated ${transactionId} to ${newStatus} (paid: ${newTotalPaid}/${totalAmount})`);
  } catch (error) {
    console.error('[updateTransactionStatusAfterPayment] Error updating transaction status:', error);
    throw error;
  }
}

/**
 * Process payment allocations and update invoice/bill statuses
 */
export async function processPaymentAllocations(
  db: any,
  allocations: PaymentAllocation[]
): Promise<void> {
  const updatePromises = allocations
    .filter(allocation => allocation.allocatedAmount > 0)
    .map(allocation =>
      updateTransactionStatusAfterPayment(
        db,
        allocation.invoiceId,
        allocation.allocatedAmount
      )
    );

  await Promise.all(updatePromises);
}

/**
 * Calculate outstanding amount for an invoice/bill
 * Queries all payments allocated to this transaction
 */
export async function getOutstandingAmount(
  db: any,
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
    const paymentType = transactionType === 'CUSTOMER_INVOICE' ? 'CUSTOMER_PAYMENT' : 'VENDOR_PAYMENT';
    const q = query(
      paymentsRef,
      where('type', '==', paymentType),
      where('status', '==', 'POSTED')
    );

    const paymentsSnapshot = await getDocs(q);
    let totalPaid = 0;

    paymentsSnapshot.forEach((doc) => {
      const paymentData = doc.data();
      const allocationsField = transactionType === 'CUSTOMER_INVOICE'
        ? 'invoiceAllocations'
        : 'billAllocations';
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
  db: any,
  transactionId: string,
  newAllocation: number,
  transactionType: 'CUSTOMER_INVOICE' | 'VENDOR_BILL'
): Promise<{ valid: boolean; error?: string }> {
  try {
    const { outstanding } = await getOutstandingAmount(
      db,
      transactionId,
      transactionType
    );

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
