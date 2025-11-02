/**
 * Account Balance Cloud Functions
 *
 * Automatically updates account balances when transactions are created, updated, or deleted.
 * Maintains running balances for all GL accounts based on ledger entries.
 *
 * Architecture:
 * - Firestore trigger on `transactions` collection
 * - Processes ledger entries (debits and credits)
 * - Updates account documents with new balances
 * - Handles both new/updated transactions and deletions
 */

import { onDocumentWritten } from 'firebase-functions/v2/firestore';
import { onCall, HttpsError } from 'firebase-functions/v2/https';
import type { FirestoreEvent, Change } from 'firebase-functions/v2/firestore';
import type { DocumentSnapshot } from 'firebase-admin/firestore';
import * as admin from 'firebase-admin';
import * as logger from 'firebase-functions/logger';
import { FieldValue } from 'firebase-admin/firestore';

const db = admin.firestore();

interface LedgerEntry {
  accountId: string;
  debit: number;
  credit: number;
  description?: string;
  costCentreId?: string;
  accountCode?: string;
  accountName?: string;
}

interface Transaction {
  id?: string;
  type: string;
  entries: LedgerEntry[];
  status: string;
  date: FirebaseFirestore.Timestamp;
  [key: string]: any;
}

/**
 * Calculate balance changes from ledger entries
 */
function calculateBalanceChanges(
  entries: LedgerEntry[]
): Map<string, { debit: number; credit: number }> {
  const changes = new Map<string, { debit: number; credit: number }>();

  for (const entry of entries) {
    if (!entry.accountId) continue;

    const current = changes.get(entry.accountId) || { debit: 0, credit: 0 };
    changes.set(entry.accountId, {
      debit: current.debit + (entry.debit || 0),
      credit: current.credit + (entry.credit || 0),
    });
  }

  return changes;
}

/**
 * Update account balances based on ledger entries
 */
async function updateAccountBalances(
  changes: Map<string, { debit: number; credit: number }>,
  batch: FirebaseFirestore.WriteBatch,
  reverse = false
): Promise<void> {
  const accountsRef = db.collection('accounts');

  for (const [accountId, change] of changes) {
    const accountRef = accountsRef.doc(accountId);

    // Get current account data
    const accountDoc = await accountRef.get();
    if (!accountDoc.exists) {
      logger.warn(`Account ${accountId} not found - skipping balance update`);
      continue;
    }

    const accountData = accountDoc.data();
    const currentDebit = accountData?.debit || 0;
    const currentCredit = accountData?.credit || 0;

    // Calculate new balances
    let newDebit, newCredit;
    if (reverse) {
      // Reverse the transaction - subtract the changes
      newDebit = currentDebit - change.debit;
      newCredit = currentCredit - change.credit;
    } else {
      // Apply the transaction - add the changes
      newDebit = currentDebit + change.debit;
      newCredit = currentCredit + change.credit;
    }

    // Ensure no negative balances (sanity check)
    newDebit = Math.max(0, newDebit);
    newCredit = Math.max(0, newCredit);

    // Calculate net balance
    const netBalance = newDebit - newCredit;

    // Update account document
    batch.update(accountRef, {
      debit: newDebit,
      credit: newCredit,
      balance: netBalance,
      lastUpdated: FieldValue.serverTimestamp(),
    });

    logger.info(
      `${reverse ? 'Reversed' : 'Updated'} account ${accountId}: ` +
        `debit ${currentDebit} -> ${newDebit}, ` +
        `credit ${currentCredit} -> ${newCredit}, ` +
        `balance ${netBalance}`
    );
  }
}

/**
 * Firestore trigger: Update account balances when transactions are created or updated
 */
export const onTransactionWrite = onDocumentWritten(
  'transactions/{transactionId}',
  async (
    event: FirestoreEvent<Change<DocumentSnapshot> | undefined, { transactionId: string }>
  ) => {
    const transactionId = event.params.transactionId;
    const change = event.data;
    const batch = db.batch();

    try {
      // Get before and after data
      const beforeData =
        change && change.before && change.before.exists
          ? (change.before.data() as Transaction)
          : null;
      const afterData =
        change && change.after && change.after.exists ? (change.after.data() as Transaction) : null;

      // Case 1: Transaction deleted
      if (beforeData && !afterData) {
        logger.info(`Transaction ${transactionId} deleted - reversing entries`);

        if (beforeData.entries && Array.isArray(beforeData.entries)) {
          const changes = calculateBalanceChanges(beforeData.entries);
          await updateAccountBalances(changes, batch, true); // reverse = true
        }
      }
      // Case 2: Transaction created
      else if (!beforeData && afterData) {
        logger.info(`Transaction ${transactionId} created - applying entries`);

        if (afterData.entries && Array.isArray(afterData.entries)) {
          const changes = calculateBalanceChanges(afterData.entries);
          await updateAccountBalances(changes, batch, false); // reverse = false
        }
      }
      // Case 3: Transaction updated
      else if (beforeData && afterData) {
        logger.info(`Transaction ${transactionId} updated - recalculating entries`);

        // Reverse old entries
        if (beforeData.entries && Array.isArray(beforeData.entries)) {
          const oldChanges = calculateBalanceChanges(beforeData.entries);
          await updateAccountBalances(oldChanges, batch, true);
        }

        // Apply new entries
        if (afterData.entries && Array.isArray(afterData.entries)) {
          const newChanges = calculateBalanceChanges(afterData.entries);
          await updateAccountBalances(newChanges, batch, false);
        }
      }

      // Commit all changes
      await batch.commit();
      logger.info(`Successfully updated account balances for transaction ${transactionId}`);
    } catch (error) {
      logger.error(`Error updating account balances for transaction ${transactionId}:`, error);
      throw error; // Re-throw to trigger Cloud Functions retry
    }
  }
);

/**
 * HTTP function: Recalculate all account balances from scratch
 * Use this for manual reconciliation or after data migration
 *
 * POST /recalculateAccountBalances
 * Headers: Authorization: Bearer <firebase-token>
 */
export const recalculateAccountBalances = onCall(async (request) => {
  // Require authentication
  if (!request.auth) {
    throw new HttpsError('unauthenticated', 'User must be authenticated');
  }

  // Require admin role
  const userDoc = await db.collection('users').doc(request.auth.uid).get();
  const userRole = userDoc.data()?.role;
  if (userRole !== 'admin' && userRole !== 'accountant') {
    throw new HttpsError(
      'permission-denied',
      'Only admins and accountants can recalculate balances'
    );
  }

  try {
    logger.info('Starting full account balance recalculation');

    // Step 1: Reset all account balances to zero
    const accountsSnapshot = await db.collection('accounts').get();
    const resetBatch = db.batch();

    accountsSnapshot.docs.forEach((doc) => {
      resetBatch.update(doc.ref, {
        debit: 0,
        credit: 0,
        balance: 0,
        lastUpdated: FieldValue.serverTimestamp(),
      });
    });

    await resetBatch.commit();
    logger.info(`Reset ${accountsSnapshot.size} account balances to zero`);

    // Step 2: Recalculate from all transactions
    const transactionsSnapshot = await db.collection('transactions').get();
    const updateBatch = db.batch();

    // Aggregate all changes by account
    const aggregatedChanges = new Map<string, { debit: number; credit: number }>();

    transactionsSnapshot.docs.forEach((doc) => {
      const transaction = doc.data() as Transaction;

      if (transaction.entries && Array.isArray(transaction.entries)) {
        for (const entry of transaction.entries) {
          if (!entry.accountId) continue;

          const current = aggregatedChanges.get(entry.accountId) || { debit: 0, credit: 0 };
          aggregatedChanges.set(entry.accountId, {
            debit: current.debit + (entry.debit || 0),
            credit: current.credit + (entry.credit || 0),
          });
        }
      }
    });

    // Apply all changes
    await updateAccountBalances(aggregatedChanges, updateBatch, false);
    await updateBatch.commit();

    logger.info(
      `Recalculated balances for ${aggregatedChanges.size} accounts from ${transactionsSnapshot.size} transactions`
    );

    return {
      success: true,
      accountsUpdated: aggregatedChanges.size,
      transactionsProcessed: transactionsSnapshot.size,
    };
  } catch (error) {
    logger.error('Error recalculating account balances:', error);
    throw new HttpsError('internal', 'Failed to recalculate account balances');
  }
});
