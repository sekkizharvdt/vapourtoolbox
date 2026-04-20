/**
 * Transaction Number Generator
 * Generates sequential transaction numbers for different transaction types.
 *
 * Format: PREFIX-YYNN-NNNN (e.g., INV-2526-0001, BILL-2526-0042, JE-2526-0123)
 *   - PREFIX: transaction type (INV, BILL, JE, VPAY, RCPT, etc.)
 *   - YYNN: fiscal year shorthand (2526 = FY 2025-26, April start)
 *   - NNNN: sequential number, resets to 0001 each fiscal year
 *
 * Uses atomic Firestore transactions with counter documents to prevent
 * race conditions when multiple users create transactions simultaneously.
 *
 * Counter key: transaction-{type}-FY{yynn}  (one global counter per type per FY)
 */

import { doc, runTransaction, getDoc, Timestamp } from 'firebase/firestore';
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
  DIRECT_PAYMENT: 'DPAY',
  DIRECT_RECEIPT: 'DRCPT',
};

/** Default fiscal year start month (April for India) */
const DEFAULT_FY_START_MONTH = 4;

/**
 * Compute the fiscal year short code for a given date.
 *
 * For a fiscal year starting in April:
 *   - 2025-04-01 to 2026-03-31 → "2526"
 *   - 2026-04-01 to 2027-03-31 → "2627"
 *
 * For calendar year (Jan start):
 *   - 2026-01-01 to 2026-12-31 → "26"
 */
export function getFiscalYearCode(
  date: Date = new Date(),
  fyStartMonth: number = DEFAULT_FY_START_MONTH
): string {
  const month = date.getMonth() + 1; // 1-based
  const year = date.getFullYear();

  if (fyStartMonth === 1) {
    // Calendar year — just use 2-digit year
    return String(year).slice(2);
  }

  // Fiscal year: if current month < start month, we're in the FY that started previous year
  const fyStartYear = month < fyStartMonth ? year - 1 : year;
  const fyEndYear = fyStartYear + 1;
  return `${String(fyStartYear).slice(2)}${String(fyEndYear).slice(2)}`;
}

/**
 * Load the fiscal year start month from company settings.
 * Falls back to April (4) if not configured.
 */
async function loadFYStartMonth(): Promise<number> {
  try {
    const { db } = getFirebase();
    const settingsDoc = await getDoc(doc(db, 'company', 'settings'));
    if (settingsDoc.exists()) {
      return settingsDoc.data().fiscalYearStartMonth || DEFAULT_FY_START_MONTH;
    }
  } catch (error) {
    logger.warn('loadFYStartMonth failed, falling back to default', {
      error: error instanceof Error ? error.message : String(error),
      defaultMonth: DEFAULT_FY_START_MONTH,
    });
  }
  return DEFAULT_FY_START_MONTH;
}

/**
 * Generate next transaction number for a given type.
 * Uses atomic transaction with counter document to prevent duplicates.
 *
 * Counter key: transaction-{type}-FY{yynn}
 * One counter per type per fiscal year — no monthly reset, globally unique within FY.
 *
 * @param type - Transaction type
 * @returns Promise with generated transaction number (e.g. "BILL-2526-0042")
 */
export async function generateTransactionNumber(type: TransactionType): Promise<string> {
  const prefix = TRANSACTION_PREFIXES[type];

  try {
    const { db } = getFirebase();

    const fyStartMonth = await loadFYStartMonth();
    const fyCode = getFiscalYearCode(new Date(), fyStartMonth);
    const counterKey = `transaction-${type.toLowerCase()}-FY${fyCode}`;
    const counterRef = doc(db, COLLECTIONS.COUNTERS, counterKey);

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
        // Initialize counter for this type/FY
        transaction.set(counterRef, {
          type: `accounting_${type.toLowerCase()}`,
          fiscalYear: fyCode,
          value: sequence,
          createdAt: Timestamp.now(),
          updatedAt: Timestamp.now(),
        });
      }

      const formattedNumber = sequence.toString().padStart(4, '0');
      return `${prefix}-${fyCode}-${formattedNumber}`;
    });

    return transactionNumber;
  } catch (error) {
    logger.error('generateTransactionNumber failed', { type, error });
    // Fallback: use prefix + timestamp + random to guarantee uniqueness
    const timestamp = Date.now().toString().slice(-6);
    const randomSuffix = Math.random().toString(36).slice(-2).toUpperCase();
    return `${prefix}-ERR-${timestamp}${randomSuffix}`;
  }
}

/**
 * Parse transaction number to extract prefix and sequence number.
 * Supports both formats:
 *   - New: PREFIX-YYNN-NNNN (e.g., BILL-2526-0042)
 *   - Legacy: PREFIX-NNNN (e.g., BILL-0042)
 *
 * @param transactionNumber - Transaction number to parse
 * @returns Object with prefix and number, or null if invalid
 */
export function parseTransactionNumber(
  transactionNumber: string
): { prefix: string; fiscalYear?: string; number: number } | null {
  // Try new format first: PREFIX-YYNN-NNNN
  const newMatch = transactionNumber.match(/^([A-Z]+)-(\d{2,4})-(\d+)$/);
  if (newMatch) {
    return {
      prefix: newMatch[1]!,
      fiscalYear: newMatch[2]!,
      number: parseInt(newMatch[3]!, 10),
    };
  }

  // Legacy format: PREFIX-NNNN
  const legacyMatch = transactionNumber.match(/^([A-Z]+)-(\d+)$/);
  if (legacyMatch) {
    return {
      prefix: legacyMatch[1]!,
      number: parseInt(legacyMatch[2]!, 10),
    };
  }

  return null;
}

/**
 * Validate transaction number format.
 * Accepts both new (PREFIX-YYNN-NNNN) and legacy (PREFIX-NNNN) formats.
 *
 * @param transactionNumber - Transaction number to validate
 * @returns True if valid format
 */
export function isValidTransactionNumber(transactionNumber: string): boolean {
  return (
    /^[A-Z]+-\d{2,4}-\d{4,}$/.test(transactionNumber) || /^[A-Z]+-\d{4,}$/.test(transactionNumber)
  );
}
