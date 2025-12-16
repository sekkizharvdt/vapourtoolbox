/**
 * Transaction Number Generator
 * Generates sequential transaction numbers for different transaction types
 * Format: PREFIX-NNNN (e.g., INV-0001, BILL-0042, JE-0123)
 */

import { collection, query, where, orderBy, limit, getDocs } from 'firebase/firestore';
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
 * @param type - Transaction type
 * @returns Promise with generated transaction number
 */
export async function generateTransactionNumber(type: TransactionType): Promise<string> {
  const prefix = TRANSACTION_PREFIXES[type];

  try {
    const { db } = getFirebase();
    const transactionsRef = collection(db, COLLECTIONS.TRANSACTIONS);

    // Query for last transaction of this type
    const q = query(
      transactionsRef,
      where('type', '==', type),
      orderBy('transactionNumber', 'desc'),
      limit(1)
    );

    const snapshot = await getDocs(q);

    let nextNumber = 1;

    if (!snapshot.empty) {
      const lastTransaction = snapshot.docs[0]?.data();
      const lastNumber = lastTransaction?.transactionNumber;

      if (lastNumber && typeof lastNumber === 'string') {
        // Extract number from last transaction number (e.g., "INV-0042" -> 42)
        const match = lastNumber.match(/-(\d+)$/);
        if (match && match[1]) {
          nextNumber = parseInt(match[1], 10) + 1;
        }
      }
    }

    // Format number with leading zeros (4 digits)
    const formattedNumber = nextNumber.toString().padStart(4, '0');

    return `${prefix}-${formattedNumber}`;
  } catch (error) {
    logger.error('generateTransactionNumber failed', { type, error });
    // Fallback to timestamp-based number
    const timestamp = Date.now().toString().slice(-4);
    return `${prefix}-${timestamp}`;
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
