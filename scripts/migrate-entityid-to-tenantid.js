#!/usr/bin/env node
/**
 * Migration script: Rename entityId → tenantId on tenant-scoped collections.
 *
 * This renames the Firestore document field `entityId` to `tenantId` on all
 * tenant-scoped collections. The `entityId` field on transactions (counterparty
 * reference) is NOT touched.
 *
 * What it does for each document:
 *   1. Copies entityId value to tenantId
 *   2. Deletes the entityId field
 *
 * Safe to run multiple times — skips documents that already have tenantId.
 *
 * Usage:
 *   node scripts/migrate-entityid-to-tenantid.js [--dry-run]
 */

const admin = require('firebase-admin');
const path = require('path');

const serviceAccountPath = path.resolve(
  __dirname,
  '../mcp-servers/firebase-feedback/service-account-key.json'
);

admin.initializeApp({
  credential: admin.credential.cert(require(serviceAccountPath)),
});

const db = admin.firestore();
const FieldValue = admin.firestore.FieldValue;

const DRY_RUN = process.argv.includes('--dry-run');

// Tenant-scoped collections where entityId is a tenant marker
const TENANT_COLLECTIONS = [
  'accounts',
  'boms',
  'bought_out_items',
  'costConfigurations',
  'enquiries',
  'fixedAssets',
  'goodsReceipts',
  'hrLeaveRequests',
  'hrLeaveBalances',
  'hrLeaveTypes',
  'hrTravelExpenses',
  'manualTasks',
  'meetings',
  'offers',
  'onDutyRecords',
  'paymentBatches',
  'projects',
  'proposals',
  'proposalTemplates',
  'purchaseOrders',
  'purchaseRequests',
  'recurringTransactions',
  'rfqs',
  'services',
  'users', // users also have entityId as tenant marker
];

async function migrateCollection(collectionName) {
  const ref = db.collection(collectionName);
  const snapshot = await ref.get();

  if (snapshot.empty) {
    console.log(`  ${collectionName}: empty — skipping`);
    return { migrated: 0, skipped: 0, total: 0 };
  }

  let migrated = 0;
  let skipped = 0;
  const batches = [];
  let currentBatch = db.batch();
  let batchCount = 0;

  for (const doc of snapshot.docs) {
    const data = doc.data();

    // Skip if already has tenantId (already migrated)
    if (data.tenantId !== undefined) {
      skipped++;
      continue;
    }

    // Skip if no entityId to migrate
    if (data.entityId === undefined) {
      skipped++;
      continue;
    }

    if (!DRY_RUN) {
      currentBatch.update(doc.ref, {
        tenantId: data.entityId,
        entityId: FieldValue.delete(),
      });

      batchCount++;

      // Firestore batch limit is 500
      if (batchCount >= 500) {
        batches.push(currentBatch);
        currentBatch = db.batch();
        batchCount = 0;
      }
    }

    migrated++;
  }

  // Commit remaining batch
  if (batchCount > 0) {
    batches.push(currentBatch);
  }

  if (!DRY_RUN) {
    for (const batch of batches) {
      await batch.commit();
    }
  }

  const total = snapshot.size;
  const prefix = DRY_RUN ? '[DRY RUN] ' : '';
  console.log(
    `  ${prefix}${collectionName}: ${migrated} migrated, ${skipped} skipped (${total} total)`
  );

  return { migrated, skipped, total };
}

async function main() {
  console.log(DRY_RUN ? '=== DRY RUN ===' : '=== MIGRATING ===');
  console.log(`Renaming entityId → tenantId on ${TENANT_COLLECTIONS.length} collections\n`);

  let totalMigrated = 0;
  let totalSkipped = 0;

  for (const collection of TENANT_COLLECTIONS) {
    try {
      const result = await migrateCollection(collection);
      totalMigrated += result.migrated;
      totalSkipped += result.skipped;
    } catch (error) {
      console.error(`  ERROR on ${collection}:`, error.message);
    }
  }

  console.log(`\n=== DONE ===`);
  console.log(`Total migrated: ${totalMigrated}`);
  console.log(`Total skipped: ${totalSkipped}`);

  if (DRY_RUN) {
    console.log('\nThis was a dry run. Run without --dry-run to apply changes.');
  }
}

main().catch(console.error);
