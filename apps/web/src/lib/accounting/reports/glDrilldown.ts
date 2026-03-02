/**
 * GL Drill-down Utility
 *
 * Fetches GL entries for a specific account from all transaction documents.
 * GL entries are embedded in transactions (not a separate collection), so this
 * requires fetching all transactions and filtering client-side.
 */

import { collection, getDocs } from 'firebase/firestore';
import type { Firestore } from 'firebase/firestore';
import { COLLECTIONS } from '@vapour/firebase';

export interface GLDrilldownEntry {
  transactionId: string;
  transactionNumber: string;
  transactionType: string;
  date: Date;
  description: string;
  debit: number;
  credit: number;
  route: string;
}

/**
 * Maps a transaction type to the list page where it can be viewed and edited.
 */
export function getTransactionRoute(type: string): string {
  switch (type) {
    case 'CUSTOMER_INVOICE':
      return '/accounting/invoices';
    case 'VENDOR_BILL':
      return '/accounting/bills';
    case 'CUSTOMER_PAYMENT':
    case 'VENDOR_PAYMENT':
    case 'DIRECT_PAYMENT':
      return '/accounting/payments';
    case 'JOURNAL_ENTRY':
      return '/accounting/journal-entries';
    default:
      return '/accounting';
  }
}

/**
 * Returns a human-readable label for a transaction type.
 */
export function getTransactionTypeLabel(type: string): string {
  switch (type) {
    case 'CUSTOMER_INVOICE':
      return 'Invoice';
    case 'VENDOR_BILL':
      return 'Bill';
    case 'CUSTOMER_PAYMENT':
      return 'Receipt';
    case 'VENDOR_PAYMENT':
      return 'Payment';
    case 'DIRECT_PAYMENT':
      return 'Direct Payment';
    case 'JOURNAL_ENTRY':
      return 'Journal Entry';
    default:
      return type;
  }
}

/**
 * Fetches all GL entries for a specific account ID across all transactions.
 * Returns entries sorted by date descending.
 */
export async function fetchAccountGLEntries(
  db: Firestore,
  accountId: string
): Promise<GLDrilldownEntry[]> {
  const transactionsRef = collection(db, COLLECTIONS.TRANSACTIONS);
  const snapshot = await getDocs(transactionsRef);

  const results: GLDrilldownEntry[] = [];

  snapshot.forEach((doc) => {
    const data = doc.data();

    // Skip soft-deleted transactions
    if (data.isDeleted) return;

    const entries: Array<{
      accountId?: string;
      debit?: number;
      credit?: number;
      description?: string;
    }> = data.entries || [];

    // Find all GL lines for this account within this transaction
    for (const entry of entries) {
      if (entry.accountId !== accountId) continue;

      const rawDate = data.date ?? data.paymentDate ?? data.billDate ?? data.entryDate;
      let date: Date;
      if (rawDate && typeof rawDate === 'object' && 'toDate' in rawDate) {
        date = (rawDate as { toDate: () => Date }).toDate();
      } else if (rawDate instanceof Date) {
        date = rawDate;
      } else if (rawDate) {
        date = new Date(rawDate as string);
      } else {
        date = new Date(0);
      }

      results.push({
        transactionId: doc.id,
        transactionNumber: data.transactionNumber || data.entryNumber || doc.id,
        transactionType: data.type || '',
        date,
        description: entry.description || data.description || data.narration || '',
        debit: entry.debit || 0,
        credit: entry.credit || 0,
        route: getTransactionRoute(data.type || ''),
      });
    }
  });

  // Sort by date descending
  results.sort((a, b) => b.date.getTime() - a.date.getTime());

  return results;
}
