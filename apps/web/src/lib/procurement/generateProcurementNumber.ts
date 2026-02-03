/**
 * Shared Procurement Number Generator
 *
 * Generates unique sequential numbers for procurement documents
 * using atomic Firestore transactions to prevent race conditions.
 *
 * Format: PREFIX/YYYY/MM/XXXX
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
}

export const PROCUREMENT_NUMBER_CONFIGS = {
  PURCHASE_ORDER: {
    counterPrefix: 'po',
    displayPrefix: 'PO',
    counterType: 'purchase_order',
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
 * Uses a monthly counter document to ensure unique sequential numbers.
 *
 * @returns A formatted number like "PO/2025/01/0001"
 */
export async function generateProcurementNumber(config: ProcurementNumberConfig): Promise<string> {
  const { db } = getFirebase();

  const now = new Date();
  const year = now.getFullYear();
  const month = String(now.getMonth() + 1).padStart(2, '0');
  const counterKey = `${config.counterPrefix}-${year}-${month}`;

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
        month: parseInt(month, 10),
        value: sequence,
        createdAt: Timestamp.now(),
        updatedAt: Timestamp.now(),
      });
    }

    const sequenceStr = String(sequence).padStart(4, '0');
    return `${config.displayPrefix}/${year}/${month}/${sequenceStr}`;
  });

  return number;
}
