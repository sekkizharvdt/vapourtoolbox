/**
 * Shared Counter-Backed Document Number Generator
 *
 * Generates unique sequential numbers for documents using atomic Firestore
 * transactions on counter documents to prevent race conditions.
 *
 * `generateCounterBackedNumber` is the single canonical engine (rule 32) —
 * every document-number generator in the app (procurement, enquiry, proposal,
 * project, three-way match, services, bought-out items, ...) is a thin wrapper
 * that supplies a counter key, a pure format function, and (for document types
 * that historically used query-max numbering) a seed function so existing
 * sequences continue without collision or reset.
 *
 * Procurement documents use the higher-level `generateProcurementNumber`
 * with two formats (selectable per config):
 * - monthly:  PREFIX/YYYY/MM/XXXX  (default; counter rolls over every month)
 * - yearly:   PREFIX/YYYY/XXX      (counter rolls over every year, 3-digit seq)
 */

import { doc, getDoc, Timestamp, runTransaction } from 'firebase/firestore';
import { getFirebase } from '@/lib/firebase';
import { COLLECTIONS } from '@vapour/firebase';

export interface CounterBackedNumberOptions {
  /** Counter document id in the `counters` collection (e.g. 'pr-2026'). */
  counterKey: string;
  /** `type` field stored on the counter document (e.g. 'purchase_request'). */
  counterType: string;
  /** Pure formatter from sequence number to display number. */
  format: (sequence: number) => string;
  /**
   * Optional: compute the current max sequence when the counter document does
   * not exist yet (first use for this key). The next number will be seed + 1,
   * so sequences started under the old query-max generators continue without
   * collision or reset. Runs OUTSIDE the transaction (the client SDK cannot
   * run queries inside a transaction); the transaction re-checks existence,
   * and concurrent first-users serialize on the counter-doc create.
   */
  seed?: () => Promise<number>;
  /** Extra metadata fields stored on the counter document at creation. */
  counterMeta?: Record<string, unknown>;
}

/**
 * Generate the next document number for a counter key using an atomic
 * Firestore transaction. See module docs — this is the single canonical
 * counter engine; do not add parallel implementations.
 */
export async function generateCounterBackedNumber(
  options: CounterBackedNumberOptions
): Promise<string> {
  const { db } = getFirebase();
  const counterRef = doc(db, COLLECTIONS.COUNTERS, options.counterKey);

  // Seed lookup only when the counter doc doesn't exist yet (first use).
  let seedValue = 0;
  if (options.seed) {
    const existing = await getDoc(counterRef);
    if (!existing.exists()) {
      seedValue = await options.seed();
    }
  }

  return runTransaction(db, async (transaction) => {
    const counterDoc = await transaction.get(counterRef);

    let sequence: number;
    if (counterDoc.exists()) {
      sequence = (counterDoc.data().value || 0) + 1;
      transaction.update(counterRef, {
        value: sequence,
        updatedAt: Timestamp.now(),
      });
    } else {
      sequence = seedValue + 1;
      transaction.set(counterRef, {
        type: options.counterType,
        ...options.counterMeta,
        value: sequence,
        createdAt: Timestamp.now(),
        updatedAt: Timestamp.now(),
      });
    }

    return options.format(sequence);
  });
}

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
  const now = new Date();
  const year = now.getFullYear();
  const month = String(now.getMonth() + 1).padStart(2, '0');
  const granularity = config.granularity ?? 'monthly';

  return generateCounterBackedNumber({
    counterKey:
      granularity === 'yearly'
        ? `${config.counterPrefix}-${year}`
        : `${config.counterPrefix}-${year}-${month}`,
    counterType: config.counterType,
    counterMeta: {
      year,
      ...(granularity === 'monthly' && { month: parseInt(month, 10) }),
    },
    format: (sequence) => formatProcurementNumber(config.displayPrefix, granularity, sequence, now),
  });
}

/**
 * Pure formatter for procurement numbers — exported so tests can pin the
 * byte-exact format without touching Firestore.
 */
export function formatProcurementNumber(
  displayPrefix: string,
  granularity: 'monthly' | 'yearly',
  sequence: number,
  date: Date = new Date()
): string {
  const year = date.getFullYear();
  if (granularity === 'yearly') {
    return `${displayPrefix}/${year}/${String(sequence).padStart(3, '0')}`;
  }
  const month = String(date.getMonth() + 1).padStart(2, '0');
  return `${displayPrefix}/${year}/${month}/${String(sequence).padStart(4, '0')}`;
}
