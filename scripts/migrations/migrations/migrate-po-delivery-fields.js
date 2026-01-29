/**
 * Migration: migrate-po-delivery-fields
 *
 * Migrates PO commercial terms from the deprecated `deliveryWeeks` field
 * to the new `deliveryPeriod` + `deliveryUnit` fields.
 *
 * This migration handles:
 * 1. PurchaseOrders with commercialTerms.deliveryWeeks
 * 2. Sets deliveryPeriod = deliveryWeeks value
 * 3. Sets deliveryUnit = 'WEEKS' (default)
 * 4. Preserves deliveryWeeks for backward compatibility
 *
 * Usage:
 *   node scripts/migrations/migration-framework.js migrate-po-delivery-fields --dry-run
 *   node scripts/migrations/migration-framework.js migrate-po-delivery-fields
 *
 * Created: 2026-01-29
 * Related to: PODeliveryUnit type addition in packages/types/src/procurement/purchaseOrder.ts
 */

const COLLECTION = 'purchaseOrders';

/**
 * Run the migration
 * @param {FirebaseFirestore.Firestore} db - Firestore instance
 * @param {Object} options - Migration options
 * @param {boolean} options.dryRun - If true, don't make actual changes
 * @param {number} options.batchSize - Number of documents to process at once
 */
async function run(db, options = {}) {
  const { dryRun, batchSize = 500 } = options;

  const stats = {
    totalScanned: 0,
    alreadyMigrated: 0,
    migrated: 0,
    noCommercialTerms: 0,
    errors: 0,
  };

  console.log(`📊 Scanning ${COLLECTION} collection...`);
  console.log(`   Batch size: ${batchSize}`);
  console.log();

  // Query all POs
  let lastDoc = null;
  let hasMore = true;

  while (hasMore) {
    let query = db.collection(COLLECTION).orderBy('createdAt').limit(batchSize);

    if (lastDoc) {
      query = query.startAfter(lastDoc);
    }

    const snapshot = await query.get();

    if (snapshot.empty) {
      hasMore = false;
      break;
    }

    const batch = db.batch();
    let batchCount = 0;

    for (const doc of snapshot.docs) {
      stats.totalScanned++;
      lastDoc = doc;

      const data = doc.data();
      const poNumber = data.number || doc.id;

      // Check if PO has commercialTerms
      if (!data.commercialTerms) {
        stats.noCommercialTerms++;
        continue;
      }

      const terms = data.commercialTerms;

      // Check if already migrated (has deliveryPeriod and deliveryUnit)
      if (terms.deliveryPeriod !== undefined && terms.deliveryUnit !== undefined) {
        stats.alreadyMigrated++;
        continue;
      }

      // Check if has old deliveryWeeks field
      if (terms.deliveryWeeks === undefined) {
        // No deliveryWeeks to migrate, set defaults
        const updatedTerms = {
          ...terms,
          deliveryPeriod: 8, // Default value
          deliveryUnit: 'WEEKS',
        };

        if (!dryRun) {
          batch.update(doc.ref, { commercialTerms: updatedTerms });
          batchCount++;
        }

        console.log(`📝 ${poNumber}: Setting defaults (deliveryPeriod=8, deliveryUnit=WEEKS)`);
        stats.migrated++;
        continue;
      }

      // Migrate deliveryWeeks to deliveryPeriod/deliveryUnit
      const updatedTerms = {
        ...terms,
        deliveryPeriod: terms.deliveryWeeks,
        deliveryUnit: 'WEEKS',
        // Keep deliveryWeeks for backward compatibility (marked as deprecated)
      };

      if (!dryRun) {
        batch.update(doc.ref, { commercialTerms: updatedTerms });
        batchCount++;
      }

      console.log(
        `✅ ${poNumber}: Migrated deliveryWeeks=${terms.deliveryWeeks} → deliveryPeriod=${terms.deliveryWeeks}, deliveryUnit=WEEKS`
      );
      stats.migrated++;
    }

    // Commit batch
    if (batchCount > 0 && !dryRun) {
      await batch.commit();
      console.log(`   💾 Committed batch of ${batchCount} documents`);
    }

    // Check if more documents exist
    hasMore = snapshot.docs.length === batchSize;
  }

  // Summary
  console.log('\n' + '─'.repeat(50));
  console.log('Migration Summary:');
  console.log(`  Total POs scanned: ${stats.totalScanned}`);
  console.log(`  Already migrated: ${stats.alreadyMigrated}`);
  console.log(`  Newly migrated: ${stats.migrated}`);
  console.log(`  No commercial terms: ${stats.noCommercialTerms}`);
  console.log(`  Errors: ${stats.errors}`);
  console.log('─'.repeat(50));

  return stats;
}

module.exports = { run };
