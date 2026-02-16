/**
 * Scheduled Backup Cloud Function
 *
 * Exports all Firestore collections to a Google Cloud Storage bucket
 * as JSON files. Runs weekly on Sundays at 2:00 AM IST (Saturday 8:30 PM UTC).
 *
 * Bucket: vapour-toolbox-backups
 * Structure: backups/YYYY-MM-DD_HHmmss/<collection>.json + manifest.json
 *
 * Also provides a callable function for manual backup from the admin UI.
 */

import { onSchedule } from 'firebase-functions/v2/scheduler';
import { onCall, HttpsError } from 'firebase-functions/v2/https';
import { logger } from 'firebase-functions/v2';
import * as admin from 'firebase-admin';
import { sendNotificationEmail, gmailAppPassword } from '../email/sendEmail';

const BACKUP_BUCKET = 'vapour-toolbox-backups';

/**
 * Collections to back up. These are the top-level collections
 * that contain business-critical data.
 */
const BACKUP_COLLECTIONS = [
  // Core
  'users',
  'companies',
  'entities',
  'entity_contacts',
  'projects',
  'invitations',

  // Procurement
  'purchaseRequests',
  'purchaseRequestItems',
  'rfqs',
  'rfqItems',
  'offers',
  'offerItems',
  'purchaseOrders',
  'purchaseOrderItems',
  'goodsReceipts',
  'packingLists',

  // Accounting
  'accounts',
  'transactions',
  'costCentres',
  'recurringTransactions',
  'paymentBatches',
  'exchangeRates',

  // HR
  'hrLeaveRequests',
  'hrLeaveBalances',
  'hrLeaveTypes',
  'hrHolidays',
  'hrTravelExpenses',

  // Estimation & Materials
  'materials',
  'proposals',
  'estimates',
  'boms',
  'enquiries',

  // System
  'auditLogs',
  'feedback',
  'notificationSettings',
];

interface BackupResult {
  collection: string;
  documentCount: number;
  sizeBytes: number;
  error?: string;
}

/**
 * Run the backup process — exports each collection to GCS as JSON.
 */
async function runBackup(triggeredBy: string): Promise<{
  backupPath: string;
  results: BackupResult[];
  totalDocuments: number;
  totalSizeBytes: number;
  durationMs: number;
}> {
  const startTime = Date.now();
  const db = admin.firestore();
  const bucket = admin.storage().bucket(BACKUP_BUCKET);

  // Create timestamped folder
  const now = new Date();
  const timestamp = now.toISOString().replace(/[:.]/g, '-').slice(0, 19);
  const backupPath = `backups/${timestamp}`;

  const results: BackupResult[] = [];
  let totalDocuments = 0;
  let totalSizeBytes = 0;

  for (const collectionName of BACKUP_COLLECTIONS) {
    try {
      const snapshot = await db.collection(collectionName).get();

      if (snapshot.empty) {
        results.push({
          collection: collectionName,
          documentCount: 0,
          sizeBytes: 0,
        });
        continue;
      }

      const docs = snapshot.docs.map((doc) => ({
        _id: doc.id,
        ...doc.data(),
      }));

      const jsonData = JSON.stringify(docs, null, 2);
      const sizeBytes = Buffer.byteLength(jsonData, 'utf-8');

      // Upload to GCS
      const file = bucket.file(`${backupPath}/${collectionName}.json`);
      await file.save(jsonData, {
        contentType: 'application/json',
        metadata: {
          documentCount: String(snapshot.size),
          backupTimestamp: now.toISOString(),
        },
      });

      totalDocuments += snapshot.size;
      totalSizeBytes += sizeBytes;

      results.push({
        collection: collectionName,
        documentCount: snapshot.size,
        sizeBytes,
      });

      logger.info(`Backed up ${collectionName}: ${snapshot.size} docs (${sizeBytes} bytes)`);
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : String(err);
      logger.error(`Failed to backup ${collectionName}: ${errorMessage}`);
      results.push({
        collection: collectionName,
        documentCount: 0,
        sizeBytes: 0,
        error: errorMessage,
      });
    }
  }

  const durationMs = Date.now() - startTime;

  // Write manifest
  const manifest = {
    timestamp: now.toISOString(),
    triggeredBy,
    backupPath,
    totalCollections: BACKUP_COLLECTIONS.length,
    totalDocuments,
    totalSizeBytes,
    durationMs,
    results,
  };

  const manifestJson = JSON.stringify(manifest, null, 2);
  const manifestFile = bucket.file(`${backupPath}/manifest.json`);
  await manifestFile.save(manifestJson, { contentType: 'application/json' });

  // Record backup metadata in Firestore
  await db.collection('backups').add({
    timestamp: admin.firestore.FieldValue.serverTimestamp(),
    triggeredBy,
    backupPath,
    totalCollections: BACKUP_COLLECTIONS.length,
    totalDocuments,
    totalSizeBytes,
    durationMs,
    successCount: results.filter((r) => !r.error).length,
    errorCount: results.filter((r) => r.error).length,
    status: results.some((r) => r.error) ? 'COMPLETED_WITH_ERRORS' : 'COMPLETED',
  });

  logger.info(
    `Backup complete: ${totalDocuments} docs across ${results.filter((r) => !r.error).length} collections in ${durationMs}ms`
  );

  // Send backup_completed notification
  try {
    const errorCount = results.filter((r) => r.error).length;
    await sendNotificationEmail({
      eventId: 'backup_completed',
      subject: `Backup Complete — ${totalDocuments} documents`,
      templateData: {
        title: 'Data Backup Completed',
        message: `Weekly backup finished${errorCount > 0 ? ` with ${errorCount} error(s)` : ' successfully'}.`,
        details: [
          { label: 'Documents', value: String(totalDocuments) },
          { label: 'Collections', value: String(results.filter((r) => !r.error).length) },
          { label: 'Size', value: `${(totalSizeBytes / 1024 / 1024).toFixed(1)} MB` },
          { label: 'Duration', value: `${(durationMs / 1000).toFixed(1)}s` },
          { label: 'Triggered By', value: triggeredBy },
        ],
        linkUrl: 'https://toolbox.vapourdesal.com/admin/backup',
      },
    });
  } catch (emailErr) {
    logger.warn('Failed to send backup notification email:', emailErr);
  }

  return { backupPath, results, totalDocuments, totalSizeBytes, durationMs };
}

/**
 * Scheduled weekly backup — runs every Sunday at 2:00 AM IST (Saturday 8:30 PM UTC)
 */
export const scheduledBackup = onSchedule(
  {
    schedule: '30 20 * * 6', // Saturday 8:30 PM UTC = Sunday 2:00 AM IST
    timeZone: 'UTC',
    region: 'us-central1',
    memory: '1GiB',
    timeoutSeconds: 540, // 9 minutes (max for scheduled)
    maxInstances: 1,
    secrets: [gmailAppPassword],
  },
  async () => {
    logger.info('Starting scheduled weekly backup');
    await runBackup('scheduled');
  }
);

/**
 * Manual backup trigger — callable from admin UI
 */
export const manualBackup = onCall(
  {
    region: 'us-central1',
    memory: '1GiB',
    timeoutSeconds: 540,
    secrets: [gmailAppPassword],
  },
  async (request) => {
    // Require authentication
    if (!request.auth) {
      throw new HttpsError('unauthenticated', 'User must be authenticated');
    }

    // Check admin permission (MANAGE_USERS = bit 0 = 1)
    const permissions = request.auth.token.permissions as number | undefined;
    if (!permissions || Math.floor(permissions / 1) % 2 !== 1) {
      throw new HttpsError('permission-denied', 'Only admins can trigger backups');
    }

    logger.info(`Manual backup triggered by ${request.auth.uid}`);

    const result = await runBackup(`manual:${request.auth.uid}`);

    return {
      success: true,
      backupPath: result.backupPath,
      totalDocuments: result.totalDocuments,
      totalSizeBytes: result.totalSizeBytes,
      durationMs: result.durationMs,
      collections: result.results.length,
      errors: result.results.filter((r) => r.error).length,
    };
  }
);
