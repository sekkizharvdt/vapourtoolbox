/**
 * Account Balance Cloud Functions
 *
 * Automatically updates account balances when transactions are created, updated, or deleted.
 * Maintains running balances for all GL accounts based on ledger entries.
 *
 * Architecture:
 * - Firestore trigger on `transactions` collection
 * - Uses FieldValue.increment() for atomic, race-condition-safe balance updates
 * - All balance math lives in accountBalanceLogic.ts (pure, unit-tested);
 *   this file only wires it to Firestore
 * - Soft-deleted transactions contribute nothing: soft delete reverses the
 *   entries, restore re-applies them (CLAUDE.md rule 3)
 */

import { onDocumentWritten } from 'firebase-functions/v2/firestore';
import { onCall, HttpsError } from 'firebase-functions/v2/https';
import type { FirestoreEvent, Change } from 'firebase-functions/v2/firestore';
import type { DocumentSnapshot } from 'firebase-admin/firestore';
import { FieldValue } from 'firebase-admin/firestore';
import * as admin from 'firebase-admin';
import * as logger from 'firebase-functions/logger';
import { enforceRateLimit, writeRateLimiter, RateLimitError } from './utils/rateLimiter';
import {
  resolveBalanceUpdate,
  aggregateBalanceChanges,
  type BalanceChange,
  type TransactionLike,
} from './accountBalanceLogic';

// Field names MUST match packages/constants/src/fields.ts (ACCOUNT_FIELD_*)
// and the Account type in packages/types. If renaming, update all three locations.

const db = admin.firestore();

/**
 * Apply balance changes to account documents using atomic FieldValue.increment().
 *
 * FieldValue.increment() is:
 * - Atomic: no read needed, so no stale data
 * - Additive in batches: multiple increments on the same doc are summed, not overwritten
 * - Race-condition safe: concurrent triggers produce correct results
 */
function applyBalanceChanges(
  changes: Map<string, BalanceChange>,
  batch: FirebaseFirestore.WriteBatch
): void {
  const accountsRef = db.collection('accounts');

  // rule20-exempt: bounded by the caller's transaction entries (one txn = < 20 GL accounts).
  for (const [accountId, change] of changes) {
    const accountRef = accountsRef.doc(accountId);
    batch.update(accountRef, {
      debit: FieldValue.increment(change.debit),
      credit: FieldValue.increment(change.credit),
      currentBalance: FieldValue.increment(change.debit - change.credit),
      lastUpdated: FieldValue.serverTimestamp(),
    });

    logger.info(
      `Applied account ${accountId}: debit ${change.debit >= 0 ? '+' : ''}${change.debit}, ` +
        `credit ${change.credit >= 0 ? '+' : ''}${change.credit}`
    );
  }
}

/**
 * Firestore trigger: Update account balances when transactions are created, updated, or deleted.
 *
 * All create/update/delete/soft-delete/restore semantics are encoded in
 * resolveBalanceUpdate (see accountBalanceLogic.ts): the delta is always
 * "effective entries after minus effective entries before", where a missing or
 * soft-deleted transaction has no effective entries.
 */
export const onTransactionWrite = onDocumentWritten(
  'transactions/{transactionId}',
  async (
    event: FirestoreEvent<Change<DocumentSnapshot> | undefined, { transactionId: string }>
  ) => {
    const transactionId = event.params.transactionId;
    const change = event.data;

    try {
      const beforeData =
        change && change.before && change.before.exists
          ? (change.before.data() as TransactionLike)
          : null;
      const afterData =
        change && change.after && change.after.exists
          ? (change.after.data() as TransactionLike)
          : null;

      const delta = resolveBalanceUpdate(beforeData, afterData);

      if (delta.size === 0) {
        logger.info(`Transaction ${transactionId}: no balance change, skipping`);
        return;
      }

      const kind = !beforeData ? 'created' : !afterData ? 'deleted' : 'updated';
      logger.info(
        `Transaction ${transactionId} ${kind} - applying balance delta to ${delta.size} account(s)`
      );

      const batch = db.batch();
      applyBalanceChanges(delta, batch);
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
      const transactions = transactionsSnapshot.docs.map((doc) => doc.data() as TransactionLike);
      const skippedDeleted = transactions.filter((t) => t.isDeleted).length;

      const aggregatedChanges = aggregateBalanceChanges(transactions);

      // Step 3: Apply aggregated changes directly (no read needed — accounts are at zero)
      const accountsRef = db.collection('accounts');
      const entries = Array.from(aggregatedChanges.entries());

      for (let i = 0; i < entries.length; i += BATCH_LIMIT) {
        const chunk = entries.slice(i, i + BATCH_LIMIT);
        const updateBatch = db.batch();

        for (const [accountId, change] of chunk) {
          const accountRef = accountsRef.doc(accountId);
          updateBatch.set(
            accountRef,
            {
              debit: change.debit,
              credit: change.credit,
              currentBalance: Math.round((change.debit - change.credit) * 100) / 100,
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
