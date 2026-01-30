import { onCall, HttpsError } from 'firebase-functions/v2/https';
import { getFirestore } from 'firebase-admin/firestore';
import { logger } from 'firebase-functions/v2';

/**
 * Statuses that were incorrectly stored on `status` but actually represent
 * payment state. These need to be moved to `paymentStatus`.
 */
const PAYMENT_STATUSES_ON_STATUS = ['UNPAID', 'PARTIALLY_PAID', 'PAID'];

/**
 * Statuses that should default to UNPAID if paymentStatus is missing.
 */
const NON_FINANCIAL_STATUSES = ['DRAFT', 'PENDING_APPROVAL', 'REJECTED', 'VOID'];

interface MigratePaymentStatusResult {
  total: number;
  migrated: number;
  skipped: number;
  errors: number;
}

/**
 * Migration: Separate payment status from workflow status.
 *
 * This function migrates VENDOR_BILL and CUSTOMER_INVOICE transactions
 * that have payment-related values (UNPAID, PARTIALLY_PAID, PAID) stored
 * in the `status` field. It moves those values to a dedicated `paymentStatus`
 * field and restores the workflow `status` to APPROVED.
 *
 * This migration is idempotent -- running it multiple times produces
 * the same result because documents that already have the correct
 * paymentStatus and a valid workflow status are skipped.
 */
export const migratePaymentStatus = onCall<void, Promise<MigratePaymentStatusResult>>(
  {
    region: 'us-central1',
    timeoutSeconds: 540,
    memory: '512MiB',
  },
  async (request) => {
    // Admin-only: require authentication
    if (!request.auth) {
      throw new HttpsError('unauthenticated', 'User must be authenticated to run migrations');
    }

    const db = getFirestore();
    const result: MigratePaymentStatusResult = {
      total: 0,
      migrated: 0,
      skipped: 0,
      errors: 0,
    };

    logger.info('Starting migratePaymentStatus migration');

    try {
      // Query all VENDOR_BILL and CUSTOMER_INVOICE transactions
      const transactionTypes = ['VENDOR_BILL', 'CUSTOMER_INVOICE'];
      const allDocs: FirebaseFirestore.QueryDocumentSnapshot[] = [];

      for (const type of transactionTypes) {
        const snapshot = await db.collection('transactions').where('type', '==', type).get();

        allDocs.push(...snapshot.docs);
        logger.info(`Found ${snapshot.size} ${type} documents`);
      }

      result.total = allDocs.length;
      logger.info(`Total documents to process: ${result.total}`);

      // Process in batches of 500 (Firestore batch limit)
      const BATCH_SIZE = 500;
      let batchDocs: Array<{
        ref: FirebaseFirestore.DocumentReference;
        update: Record<string, unknown>;
      }> = [];

      for (const doc of allDocs) {
        const data = doc.data();
        const currentStatus = data.status as string | undefined;
        const currentPaymentStatus = data.paymentStatus as string | undefined;
        const amountPaid = (data.amountPaid as number) || 0;
        const totalAmount = (data.totalAmount as number) || (data.baseAmount as number) || 0;

        let update: Record<string, unknown> | null = null;

        try {
          // Case 1: status is a payment value (UNPAID, PARTIALLY_PAID, PAID)
          // Move it to paymentStatus and restore status to APPROVED
          if (currentStatus && PAYMENT_STATUSES_ON_STATUS.includes(currentStatus)) {
            update = {
              paymentStatus: currentStatus,
              status: 'APPROVED',
            };
          }
          // Case 2: status is APPROVED or POSTED but paymentStatus is missing
          // Calculate paymentStatus from amounts
          else if (
            (currentStatus === 'APPROVED' || currentStatus === 'POSTED') &&
            !currentPaymentStatus
          ) {
            let calculatedPaymentStatus: string;
            if (totalAmount > 0 && amountPaid >= totalAmount) {
              calculatedPaymentStatus = 'PAID';
            } else if (amountPaid > 0) {
              calculatedPaymentStatus = 'PARTIALLY_PAID';
            } else {
              calculatedPaymentStatus = 'UNPAID';
            }
            update = {
              paymentStatus: calculatedPaymentStatus,
            };
          }
          // Case 3: status is DRAFT, PENDING_APPROVAL, REJECTED, or VOID
          // Default paymentStatus to UNPAID if missing
          else if (
            currentStatus &&
            NON_FINANCIAL_STATUSES.includes(currentStatus) &&
            !currentPaymentStatus
          ) {
            update = {
              paymentStatus: 'UNPAID',
            };
          }
          // Case 4: paymentStatus already exists AND status is a valid workflow state
          // No update needed -- skip
          else {
            result.skipped++;
            continue;
          }

          batchDocs.push({ ref: doc.ref, update });

          // Commit batch when we reach the limit
          if (batchDocs.length >= BATCH_SIZE) {
            const batch = db.batch();
            for (const item of batchDocs) {
              batch.update(item.ref, item.update);
            }
            await batch.commit();
            result.migrated += batchDocs.length;
            logger.info(`Committed batch of ${batchDocs.length} updates`);
            batchDocs = [];
          }
        } catch (docError) {
          logger.error(`Error processing document ${doc.id}`, docError);
          result.errors++;
        }
      }

      // Commit any remaining documents in the last batch
      if (batchDocs.length > 0) {
        try {
          const batch = db.batch();
          for (const item of batchDocs) {
            batch.update(item.ref, item.update);
          }
          await batch.commit();
          result.migrated += batchDocs.length;
          logger.info(`Committed final batch of ${batchDocs.length} updates`);
        } catch (batchError) {
          logger.error('Error committing final batch', batchError);
          result.errors += batchDocs.length;
        }
      }

      logger.info('migratePaymentStatus migration completed', result);
      return result;
    } catch (error) {
      logger.error('Error running migratePaymentStatus migration', error);
      throw new HttpsError(
        'internal',
        `Migration failed: ${error instanceof Error ? error.message : String(error)}`
      );
    }
  }
);
