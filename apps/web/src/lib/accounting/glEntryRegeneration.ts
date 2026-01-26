/**
 * GL Entry Regeneration Service
 *
 * Functions for regenerating GL entries for existing transactions
 * that are missing them or have incorrect entries.
 */

import { doc, getDoc, updateDoc, Timestamp } from 'firebase/firestore';
import type { Firestore } from 'firebase/firestore';
import { COLLECTIONS } from '@vapour/firebase';
import type { CustomerPayment, VendorPayment, LedgerEntry } from '@vapour/types';
import {
  generateCustomerPaymentGLEntries,
  generateVendorPaymentGLEntries,
} from './glEntry/generators';
import type { PaymentGLInput } from './glEntry/types';

interface RegenerationResult {
  success: boolean;
  entries: LedgerEntry[];
  error?: string;
}

/**
 * Regenerate GL entries for a customer payment
 */
export async function regenerateCustomerPaymentGL(
  db: Firestore,
  paymentId: string
): Promise<RegenerationResult> {
  try {
    // Fetch the payment
    const paymentRef = doc(db, COLLECTIONS.TRANSACTIONS, paymentId);
    const paymentSnap = await getDoc(paymentRef);

    if (!paymentSnap.exists()) {
      return { success: false, entries: [], error: 'Payment not found' };
    }

    const payment = paymentSnap.data() as CustomerPayment;

    if (payment.type !== 'CUSTOMER_PAYMENT') {
      return { success: false, entries: [], error: 'Transaction is not a customer payment' };
    }

    // Check if bank account is specified
    const bankAccountId = payment.bankAccountId || payment.depositedToBankAccountId;
    if (!bankAccountId) {
      return {
        success: false,
        entries: [],
        error: 'No bank account specified. Please edit the payment to add a bank account.',
      };
    }

    // Prepare input for GL generation
    const glInput: PaymentGLInput = {
      amount: payment.totalAmount || payment.amount || 0,
      bankAccountId: bankAccountId,
      projectId: payment.projectId || payment.costCentreId,
    };

    // Generate GL entries
    const result = await generateCustomerPaymentGLEntries(db, glInput);

    if (!result.success) {
      return {
        success: false,
        entries: [],
        error: result.errors.join('; '),
      };
    }

    // Update the payment with new GL entries
    await updateDoc(paymentRef, {
      entries: result.entries,
      updatedAt: Timestamp.now(),
    });

    return { success: true, entries: result.entries };
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    return { success: false, entries: [], error: errorMessage };
  }
}

/**
 * Regenerate GL entries for a vendor payment
 */
export async function regenerateVendorPaymentGL(
  db: Firestore,
  paymentId: string
): Promise<RegenerationResult> {
  try {
    // Fetch the payment
    const paymentRef = doc(db, COLLECTIONS.TRANSACTIONS, paymentId);
    const paymentSnap = await getDoc(paymentRef);

    if (!paymentSnap.exists()) {
      return { success: false, entries: [], error: 'Payment not found' };
    }

    const payment = paymentSnap.data() as VendorPayment;

    if (payment.type !== 'VENDOR_PAYMENT') {
      return { success: false, entries: [], error: 'Transaction is not a vendor payment' };
    }

    // Check if bank account is specified
    const bankAccountId = payment.bankAccountId;
    if (!bankAccountId) {
      return {
        success: false,
        entries: [],
        error: 'No bank account specified. Please edit the payment to add a bank account.',
      };
    }

    // Prepare input for GL generation
    const glInput: PaymentGLInput = {
      amount: payment.totalAmount || payment.amount || 0,
      bankAccountId: bankAccountId,
      projectId: payment.projectId || payment.costCentreId,
    };

    // Generate GL entries
    const result = await generateVendorPaymentGLEntries(db, glInput);

    if (!result.success) {
      return {
        success: false,
        entries: [],
        error: result.errors.join('; '),
      };
    }

    // Update the payment with new GL entries
    await updateDoc(paymentRef, {
      entries: result.entries,
      updatedAt: Timestamp.now(),
    });

    return { success: true, entries: result.entries };
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    return { success: false, entries: [], error: errorMessage };
  }
}

/**
 * Regenerate GL entries for any payment type
 */
export async function regeneratePaymentGL(
  db: Firestore,
  paymentId: string,
  paymentType: 'CUSTOMER_PAYMENT' | 'VENDOR_PAYMENT'
): Promise<RegenerationResult> {
  if (paymentType === 'CUSTOMER_PAYMENT') {
    return regenerateCustomerPaymentGL(db, paymentId);
  } else {
    return regenerateVendorPaymentGL(db, paymentId);
  }
}
