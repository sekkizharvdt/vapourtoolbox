#!/usr/bin/env node
/**
 * Migration script: Add tenantId to HR collection documents that are missing it.
 *
 * Sets `tenantId: 'default-entity'` on all documents in HR collections that
 * don't already have a tenantId field. This is a single-tenant system so all
 * documents get the same value.
 *
 * Collections covered:
 *   - hrLeaveRequests
 *   - hrLeaveBalances
 *   - hrLeaveTypes
 *   - hrTravelExpenses
 *   - onDutyRecords
 *
 * Safe to run multiple times — skips documents that already have tenantId.
 *
 * Usage:
 *   node scripts/migrate-leave-tenantid.js [--dry-run]
 */

const admin = require('firebase-admin');
const path = require('path');
const fs = require('fs');

// ── Resolve service account ────────────────────────────────────────────
const candidates = [
  path.join(__dirname, '../mcp-servers/firebase-feedback/service-account-key.json'),
  path.join(__dirname, '../firebase-service-account.json'),
  path.join(__dirname, '../mcp-servers/accounting-audit/service-account-key.json'),
];

let serviceAccountPath = null;
for (const p of candidates) {
  if (fs.existsSync(p)) {
    serviceAccountPath = p;
    break;
  }
}

if (!serviceAccountPath) {
  console.error('Error: No service account key found.');
  console.error('Looked in:');
  candidates.forEach((p) => console.error(`  - ${p}`));
  process.exit(1);
}

console.log(`Using service account: ${path.relative(process.cwd(), serviceAccountPath)}\n`);

const serviceAccount = require(serviceAccountPath);

admin.initializeApp({
  credential: admin.credential.cert(serviceAccount),
  databaseURL: `https://${serviceAccount.project_id}.firebaseio.com`,
});

const db = admin.firestore();
const DRY_RUN = process.argv.includes('--dry-run');

// HR collections that need tenantId
const HR_COLLECTIONS = [
  'hrLeaveRequests',
  'hrLeaveBalances',
  'hrLeaveTypes',
  'hrTravelExpenses',
  'onDutyRecords',
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

    // Skip if already has tenantId
    if (data.tenantId !== undefined) {
      skipped++;
      continue;
    }

    if (DRY_RUN) {
      console.log(`    [DRY RUN] Would add tenantId to ${collectionName}/${doc.id}`);
    } else {
      currentBatch.update(doc.ref, {
        tenantId: 'default-entity',
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
    `  ${prefix}${collectionName}: ${migrated} need tenantId, ${skipped} already have it (${total} total)`
  );

  return { migrated, skipped, total };
}

async function main() {
  console.log(DRY_RUN ? '=== DRY RUN ===' : '=== MIGRATING ===');
  console.log(`Adding tenantId: 'default-entity' to ${HR_COLLECTIONS.length} HR collections\n`);

  let totalMigrated = 0;
  let totalSkipped = 0;
  let totalDocs = 0;

  for (const collection of HR_COLLECTIONS) {
    try {
      const result = await migrateCollection(collection);
      totalMigrated += result.migrated;
      totalSkipped += result.skipped;
      totalDocs += result.total;
    } catch (error) {
      console.error(`  ERROR on ${collection}:`, error.message);
    }
  }

  console.log(`\n=== DONE ===`);
  console.log(`Total documents:  ${totalDocs}`);
  console.log(`Total migrated:   ${totalMigrated}`);
  console.log(`Total skipped:    ${totalSkipped}`);

  if (DRY_RUN && totalMigrated > 0) {
    console.log('\nThis was a dry run. Run without --dry-run to apply changes.');
  } else if (totalMigrated === 0) {
    console.log('\nNo changes needed — all documents already have tenantId.');
  } else {
    console.log('\nAll changes committed to Firestore.');
  }
}

main()
  .then(() => process.exit(0))
  .catch((err) => {
    console.error('\nMigration failed:', err);
    process.exit(1);
  });
