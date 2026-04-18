/**
 * Shared Procurement Number Generator
 *
 * Generates unique sequential numbers for procurement documents
 * using atomic Firestore transactions to prevent race conditions.
 *
 * Supports two formats (selectable per config):
 * - monthly:  PREFIX/YYYY/MM/XXXX  (default; counter rolls over every month)
 * - yearly:   PREFIX/YYYY/XXX      (counter rolls over every year, 3-digit seq)
 */

import { doc, Timestamp, runTransaction } from 'firebase/firestore';
import { getFirebase } from '@/lib/firebase';
import { COLLECTIONS } from '@vapour/firebase';

export interface ProcurementNumberConfig {
  /** Prefix for the counter document key (e.g. 'po', 'gr') */
  counterPrefix: string;
  /** Prefix for the displayed number (e.g. 'PO', 'GR') */
  displayPrefix: string;
  /** Counter type stored in the document (e.g. 'purchase_order') */
  counterType: string;
  /**
   * Number granularity:
   * - 'monthly' (default) → counter per month, sequence padded to 4 digits
   * - 'yearly'            → counter per year,  sequence padded to 3 digits
   */
  granularity?: 'monthly' | 'yearly';
}

export const PROCUREMENT_NUMBER_CONFIGS = {
  PURCHASE_ORDER: {
    counterPrefix: 'po',
    displayPrefix: 'PO',
    counterType: 'purchase_order',
    granularity: 'yearly',
  },
  GOODS_RECEIPT: {
    counterPrefix: 'gr',
    displayPrefix: 'GR',
    counterType: 'goods_receipt',
  },
  WORK_COMPLETION: {
    counterPrefix: 'wcc',
    displayPrefix: 'WCC',
    counterType: 'work_completion_certificate',
  },
  PACKING_LIST: {
    counterPrefix: 'pl',
    displayPrefix: 'PL',
    counterType: 'packing_list',
  },
} as const satisfies Record<string, ProcurementNumberConfig>;

/**
 * Generate a procurement number using an atomic Firestore transaction.
 *
 * @returns A formatted number like "PO/2026/001" (yearly) or "GR/2026/04/0001" (monthly)
 */
export async function generateProcurementNumber(config: ProcurementNumberConfig): Promise<string> {
  const { db } = getFirebase();

  const now = new Date();
  const year = now.getFullYear();
  const month = String(now.getMonth() + 1).padStart(2, '0');
  const granularity = config.granularity ?? 'monthly';

  const counterKey =
    granularity === 'yearly'
      ? `${config.counterPrefix}-${year}`
      : `${config.counterPrefix}-${year}-${month}`;

  const counterRef = doc(db, COLLECTIONS.COUNTERS, counterKey);

  const number = await runTransaction(db, async (transaction) => {
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
      transaction.set(counterRef, {
        type: config.counterType,
        year,
        ...(granularity === 'monthly' && { month: parseInt(month, 10) }),
        value: sequence,
        createdAt: Timestamp.now(),
        updatedAt: Timestamp.now(),
      });
    }

    if (granularity === 'yearly') {
      const sequenceStr = String(sequence).padStart(3, '0');
      return `${config.displayPrefix}/${year}/${sequenceStr}`;
    }
    const sequenceStr = String(sequence).padStart(4, '0');
    return `${config.displayPrefix}/${year}/${month}/${sequenceStr}`;
  });

  return number;
}
