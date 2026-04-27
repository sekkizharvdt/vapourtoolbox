/**
 * Account Balance Cloud Functions
 *
 * Automatically updates account balances when transactions are created, updated, or deleted.
 * Maintains running balances for all GL accounts based on ledger entries.
 *
 * Architecture:
 * - Firestore trigger on `transactions` collection
 * - Uses FieldValue.increment() for atomic, race-condition-safe balance updates
 * - Handles create, update (delta-based), and delete operations
 */

import { onDocumentWritten } from 'firebase-functions/v2/firestore';
import { onCall, HttpsError } from 'firebase-functions/v2/https';
import type { FirestoreEvent, Change } from 'firebase-functions/v2/firestore';
import type { DocumentSnapshot } from 'firebase-admin/firestore';
import { FieldValue } from 'firebase-admin/firestore';
import * as admin from 'firebase-admin';
import * as logger from 'firebase-functions/logger';
import { enforceRateLimit, writeRateLimiter, RateLimitError } from './utils/rateLimiter';

// Field names MUST match packages/constants/src/fields.ts (ACCOUNT_FIELD_*)
// and the Account type in packages/types. If renaming, update all three locations.

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
  isDeleted?: boolean;
  // Allow additional fields from Firestore document (description, reference, etc.)
  [key: string]: unknown;
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
 * Apply balance changes to account documents using atomic FieldValue.increment().
 *
 * Unlike the previous read-then-write approach, FieldValue.increment() is:
 * - Atomic: no read needed, so no stale data
 * - Additive in batches: multiple increments on the same doc are summed, not overwritten
 * - Race-condition safe: concurrent triggers produce correct results
 */
function applyBalanceChanges(
  changes: Map<string, { debit: number; credit: number }>,
  batch: FirebaseFirestore.WriteBatch,
  reverse = false
): void {
  const accountsRef = db.collection('accounts');
  const multiplier = reverse ? -1 : 1;

  // rule20-exempt: bounded by the caller's transaction entries (one txn = < 20 GL accounts).
  for (const [accountId, change] of changes) {
    // Skip zero-change accounts (common in updates where entries didn't change)
    if (change.debit === 0 && change.credit === 0) continue;

    const accountRef = accountsRef.doc(accountId);
    batch.update(accountRef, {
      debit: FieldValue.increment(multiplier * change.debit),
      credit: FieldValue.increment(multiplier * change.credit),
      currentBalance: FieldValue.increment(multiplier * (change.debit - change.credit)),
      lastUpdated: FieldValue.serverTimestamp(),
    });

    logger.info(
      `${reverse ? 'Reversed' : 'Applied'} account ${accountId}: ` +
        `debit ${reverse ? '-' : '+'}${change.debit}, ` +
        `credit ${reverse ? '-' : '+'}${change.credit}`
    );
  }
}

/**
 * Calculate net delta between old and new entries for a transaction update.
 * Returns a map of accountId -> { debit: delta, credit: delta } where
 * positive values mean increment and negative values mean decrement.
 */
function calculateDelta(
  oldEntries: LedgerEntry[],
  newEntries: LedgerEntry[]
): Map<string, { debit: number; credit: number }> {
  const delta = new Map<string, { debit: number; credit: number }>();

  // Subtract old entries
  const oldChanges = calculateBalanceChanges(oldEntries);
  for (const [accountId, change] of oldChanges) {
    const current = delta.get(accountId) || { debit: 0, credit: 0 };
    delta.set(accountId, {
      debit: current.debit - change.debit,
      credit: current.credit - change.credit,
    });
  }

  // Add new entries
  const newChanges = calculateBalanceChanges(newEntries);
  for (const [accountId, change] of newChanges) {
    const current = delta.get(accountId) || { debit: 0, credit: 0 };
    delta.set(accountId, {
      debit: current.debit + change.debit,
      credit: current.credit + change.credit,
    });
  }

  return delta;
}

/**
 * Firestore trigger: Update account balances when transactions are created, updated, or deleted.
 *
 * Uses FieldValue.increment() for atomic updates — no read-then-write, no race conditions.
 * For updates, calculates net delta to avoid the batch overwrite bug.
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
          applyBalanceChanges(changes, batch, true);
        }
      }
      // Case 2: Transaction created
      else if (!beforeData && afterData) {
        logger.info(`Transaction ${transactionId} created - applying entries`);

        if (afterData.entries && Array.isArray(afterData.entries)) {
          const changes = calculateBalanceChanges(afterData.entries);
          applyBalanceChanges(changes, batch, false);
        }
      }
      // Case 3: Transaction updated — use delta calculation
      else if (beforeData && afterData) {
        logger.info(`Transaction ${transactionId} updated - applying delta`);

        const oldEntries =
          beforeData.entries && Array.isArray(beforeData.entries) ? beforeData.entries : [];
        const newEntries =
          afterData.entries && Array.isArray(afterData.entries) ? afterData.entries : [];

        const delta = calculateDelta(oldEntries, newEntries);

        // Apply delta using FieldValue.increment (handles both positive and negative)
        applyBalanceChanges(delta, batch, false);
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
 * Resets all account debit/credit/balance counters to zero, then rebuilds
 * from all non-deleted transaction GL entries.
 */
export const recalculateAccountBalances = onCall(
  { timeoutSeconds: 300, memory: '1GiB' },
  async (request) => {
    // Require authentication
    if (!request.auth) {
      throw new HttpsError('unauthenticated', 'User must be authenticated');
    }

    // Rate limiting check
    try {
      enforceRateLimit(writeRateLimiter, request.auth.uid);
    } catch (error) {
      if (error instanceof RateLimitError) {
        throw new HttpsError('resource-exhausted', error.message);
      }
      throw error;
    }

    // Require MANAGE_ACCOUNTING permission via custom claims
    const permissions = request.auth.token.permissions as number | undefined;
    const MANAGE_ACCOUNTING = 1 << 14; // 16384, matches PERMISSION_FLAGS.MANAGE_ACCOUNTING
    if (!permissions || (permissions & MANAGE_ACCOUNTING) === 0) {
      throw new HttpsError(
        'permission-denied',
        'Only users with accounting management permissions can recalculate balances'
      );
    }

    const BATCH_LIMIT = 450; // Firestore batch limit is 500, leave headroom

    try {
      logger.info('Starting full account balance recalculation');

      // Step 1: Reset all account balances to zero (chunked for large CoAs)
      const accountsSnapshot = await db.collection('accounts').get();
      const accountDocs = accountsSnapshot.docs;

      for (let i = 0; i < accountDocs.length; i += BATCH_LIMIT) {
        const chunk = accountDocs.slice(i, i + BATCH_LIMIT);
        const resetBatch = db.batch();
        chunk.forEach((doc) => {
          resetBatch.update(doc.ref, {
            debit: 0,
            credit: 0,
            currentBalance: 0,
            lastUpdated: FieldValue.serverTimestamp(),
          });
        });
        await resetBatch.commit();
      }

      logger.info(`Reset ${accountsSnapshot.size} account balances to zero`);

      // Step 2: Recalculate from all non-deleted transactions
      const transactionsSnapshot = await db.collection('transactions').get();

      // Aggregate all changes by account, skipping soft-deleted transactions
      const aggregatedChanges = new Map<string, { debit: number; credit: number }>();
      let skippedDeleted = 0;

      transactionsSnapshot.docs.forEach((doc) => {
        const transaction = doc.data() as Transaction;

        // Skip soft-deleted transactions
        if (transaction.isDeleted) {
          skippedDeleted++;
          return;
        }

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

      // Step 3: Apply aggregated changes directly (no read needed — accounts are at zero)
      const accountsRef = db.collection('accounts');
      const entries = Array.from(aggregatedChanges.entries());

      for (let i = 0; i < entries.length; i += BATCH_LIMIT) {
        const chunk = entries.slice(i, i + BATCH_LIMIT);
        const updateBatch = db.batch();

        for (const [accountId, change] of chunk) {
          const accountRef = accountsRef.doc(accountId);
          const debit = Math.round(change.debit * 100) / 100;
          const credit = Math.round(change.credit * 100) / 100;
          updateBatch.set(
            accountRef,
            {
              debit,
              credit,
              currentBalance: Math.round((debit - credit) * 100) / 100,
              lastUpdated: FieldValue.serverTimestamp(),
            },
            { merge: true }
          );
        }

        await updateBatch.commit();
      }

      logger.info(
        `Recalculated balances for ${aggregatedChanges.size} accounts ` +
          `from ${transactionsSnapshot.size - skippedDeleted} transactions ` +
          `(${skippedDeleted} soft-deleted skipped)`
      );

      return {
        success: true,
        accountsReset: accountsSnapshot.size,
        accountsUpdated: aggregatedChanges.size,
        transactionsProcessed: transactionsSnapshot.size - skippedDeleted,
        transactionsSkipped: skippedDeleted,
      };
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      const errorStack = error instanceof Error ? error.stack : undefined;
      logger.error('Error recalculating account balances:', { errorMessage, errorStack, error });
      throw new HttpsError('internal', `Failed to recalculate account balances: ${errorMessage}`);
    }
  }
);
