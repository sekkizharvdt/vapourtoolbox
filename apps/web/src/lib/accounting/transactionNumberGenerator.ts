/**
 * Transaction Number Generator
 * Generates sequential transaction numbers for different transaction types
 * Format: PREFIX-NNNN (e.g., INV-0001, BILL-0042, JE-0123)
 *
 * Uses atomic Firestore transactions with counter documents to prevent
 * race conditions when multiple users create transactions simultaneously.
 */

import { doc, runTransaction, Timestamp } from 'firebase/firestore';
import { getFirebase } from '@/lib/firebase';
import { COLLECTIONS } from '@vapour/firebase';
import { createLogger } from '@vapour/logger';
import type { TransactionType } from '@vapour/types';

const logger = createLogger({ context: 'transactionNumberGenerator' });

// Prefixes for different transaction types
const TRANSACTION_PREFIXES: Record<TransactionType, string> = {
  CUSTOMER_INVOICE: 'INV',
  CUSTOMER_PAYMENT: 'RCPT',
  VENDOR_BILL: 'BILL',
  VENDOR_PAYMENT: 'VPAY',
  JOURNAL_ENTRY: 'JE',
  BANK_TRANSFER: 'TRF',
  EXPENSE_CLAIM: 'EXP',
};

/**
 * Generate next transaction number for a given type
 * Uses atomic transaction with counter document to prevent duplicates
 *
 * @param type - Transaction type
 * @returns Promise with generated transaction number
 */
export async function generateTransactionNumber(type: TransactionType): Promise<string> {
  const prefix = TRANSACTION_PREFIXES[type];

  try {
    const { db } = getFirebase();

    // Use a counter document per transaction type per year/month to ensure uniqueness
    const now = new Date();
    const year = now.getFullYear();
    const month = String(now.getMonth() + 1).padStart(2, '0');
    const counterKey = `transaction-${type.toLowerCase()}-${year}-${month}`;
    const counterRef = doc(db, COLLECTIONS.COUNTERS, counterKey);

    // Use Firestore transaction for atomic read-modify-write
    const transactionNumber = await runTransaction(db, async (transaction) => {
      const counterDoc = await transaction.get(counterRef);

      let sequence = 1;
      if (counterDoc.exists()) {
        const data = counterDoc.data();
        sequence = (data.value || 0) + 1;
        transaction.update(counterRef, {
          value: sequence,
          updatedAt: Timestamp.now(),
        });
      } else {
        // Initialize counter for this type/month
        transaction.set(counterRef, {
          type: `accounting_${type.toLowerCase()}`,
          year,
          month: parseInt(month, 10),
          value: sequence,
          createdAt: Timestamp.now(),
          updatedAt: Timestamp.now(),
        });
      }

      // Format number with leading zeros (4 digits)
      const formattedNumber = sequence.toString().padStart(4, '0');
      return `${prefix}-${formattedNumber}`;
    });

    return transactionNumber;
  } catch (error) {
    logger.error('generateTransactionNumber failed', { type, error });
    // Fallback to timestamp-based number with random suffix for uniqueness
    const timestamp = Date.now().toString().slice(-4);
    const randomSuffix = Math.random().toString(36).slice(-2).toUpperCase();
    return `${prefix}-${timestamp}${randomSuffix}`;
  }
}

/**
 * Parse transaction number to extract prefix and sequence number
 * @param transactionNumber - Transaction number to parse
 * @returns Object with prefix and number, or null if invalid
 */
export function parseTransactionNumber(
  transactionNumber: string
): { prefix: string; number: number } | null {
  const match = transactionNumber.match(/^([A-Z]+)-(\d+)$/);

  if (!match) {
    return null;
  }

  return {
    prefix: match[1]!,
    number: parseInt(match[2]!, 10),
  };
}

/**
 * Validate transaction number format
 * @param transactionNumber - Transaction number to validate
 * @returns True if valid format
 */
export function isValidTransactionNumber(transactionNumber: string): boolean {
  return /^[A-Z]+-\d{4}$/.test(transactionNumber);
}
