import { onCall, HttpsError } from 'firebase-functions/v2/https';
import { getFirestore } from 'firebase-admin/firestore';
import { logger } from 'firebase-functions/v2';

interface BackfillResult {
  total: number;
  updated: number;
  skipped: number;
  errors: number;
}

/**
 * Migration: Backfill totalAmount on JOURNAL_ENTRY transactions.
 *
 * Journal entries were created without a `totalAmount` field. This migration
 * calculates it from the debit side of the `entries[]` array (sum of all
 * debit amounts) and writes it to `totalAmount` and `baseAmount` (if also missing).
 *
 * This migration is idempotent — documents that already have a non-zero
 * `totalAmount` are skipped.
 */
export const backfillJournalEntryTotalAmount = onCall<void, Promise<BackfillResult>>(
  {
    region: 'us-central1',
    timeoutSeconds: 540,
    memory: '512MiB',
  },
  async (request) => {
    if (!request.auth) {
      throw new HttpsError('unauthenticated', 'User must be authenticated to run migrations');
    }

    const db = getFirestore();
    const result: BackfillResult = { total: 0, updated: 0, skipped: 0, errors: 0 };

    logger.info('Starting backfillJournalEntryTotalAmount migration');

    try {
      const snapshot = await db
        .collection('transactions')
        .where('type', '==', 'JOURNAL_ENTRY')
        .get();

      result.total = snapshot.size;
      logger.info(`Found ${result.total} JOURNAL_ENTRY documents`);

      const BATCH_SIZE = 500;
      let batchDocs: Array<{
        ref: FirebaseFirestore.DocumentReference;
        update: Record<string, unknown>;
      }> = [];

      for (const doc of snapshot.docs) {
        const data = doc.data();

        // Skip if totalAmount already exists and is non-zero
        if (data.totalAmount && data.totalAmount > 0) {
          result.skipped++;
          continue;
        }

        try {
          // Calculate totalAmount from entries (sum of debit amounts)
          let totalDebits = 0;
          const entries = data.entries as Array<{ debit?: number; credit?: number }> | undefined;

          if (entries && Array.isArray(entries)) {
            for (const entry of entries) {
              totalDebits += entry.debit ?? 0;
            }
          }

          // Fallback: use existing amount field if entries don't yield a value
          const calculatedAmount = totalDebits > 0 ? totalDebits : (data.amount as number) || 0;

          if (calculatedAmount === 0) {
            logger.warn(
              `Document ${doc.id} (${data.transactionNumber}): no amount could be derived`
            );
            result.skipped++;
            continue;
          }

          const update: Record<string, unknown> = {
            totalAmount: calculatedAmount,
          };

          // Also backfill baseAmount if missing
          if (!data.baseAmount || data.baseAmount === 0) {
            update.baseAmount = calculatedAmount;
          }

          // Also backfill amount if missing
          if (!data.amount || data.amount === 0) {
            update.amount = calculatedAmount;
          }

          batchDocs.push({ ref: doc.ref, update });

          if (batchDocs.length >= BATCH_SIZE) {
            const batch = db.batch();
            for (const item of batchDocs) {
              batch.update(item.ref, item.update);
            }
            await batch.commit();
            result.updated += batchDocs.length;
            logger.info(`Committed batch of ${batchDocs.length} updates`);
            batchDocs = [];
          }
        } catch (docError) {
          logger.error(`Error processing document ${doc.id}`, docError);
          result.errors++;
        }
      }

      // Commit remaining
      if (batchDocs.length > 0) {
        try {
          const batch = db.batch();
          for (const item of batchDocs) {
            batch.update(item.ref, item.update);
          }
          await batch.commit();
          result.updated += batchDocs.length;
          logger.info(`Committed final batch of ${batchDocs.length} updates`);
        } catch (batchError) {
          logger.error('Error committing final batch', batchError);
          result.errors += batchDocs.length;
        }
      }

      logger.info('backfillJournalEntryTotalAmount migration completed', result);
      return result;
    } catch (error) {
      logger.error('Error running backfillJournalEntryTotalAmount migration', error);
      throw new HttpsError(
        'internal',
        `Migration failed: ${error instanceof Error ? error.message : String(error)}`
      );
    }
  }
);
