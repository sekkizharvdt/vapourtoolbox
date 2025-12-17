#!/usr/bin/env node
/**
 * Exchange Rate Data Migration Script
 *
 * Fixes incorrectly stored exchange rates in production where the currency
 * direction was inverted (fromCurrency: 'INR' instead of fromCurrency: 'USD')
 *
 * The correct format is:
 *   fromCurrency: 'USD', toCurrency: 'INR', rate: 83.25
 *   This means: 1 USD = 83.25 INR
 *
 * Usage:
 *   node scripts/migrate-exchange-rates.js [--dry-run]
 *
 * Options:
 *   --dry-run    Preview changes without modifying data
 */

const admin = require('firebase-admin');

// Initialize Firebase Admin SDK
// Uses GOOGLE_APPLICATION_CREDENTIALS environment variable or default service account
if (!admin.apps.length) {
  admin.initializeApp({
    projectId: process.env.GCLOUD_PROJECT || 'vapour-toolbox',
  });
}

const db = admin.firestore();
const COLLECTION = 'exchangeRates';

// Expected currencies that should be fromCurrency (not INR)
const FOREIGN_CURRENCIES = ['USD', 'EUR', 'GBP', 'SGD', 'AED'];

async function migrateExchangeRates(dryRun = false) {
  console.log('='.repeat(60));
  console.log('Exchange Rate Migration Script');
  console.log('='.repeat(60));
  console.log(`Mode: ${dryRun ? 'DRY RUN (no changes will be made)' : 'LIVE'}`);
  console.log('');

  try {
    // Query all exchange rates
    const snapshot = await db.collection(COLLECTION).get();

    console.log(`Found ${snapshot.size} exchange rate records\n`);

    const toFix = [];
    const alreadyCorrect = [];
    const unknown = [];

    snapshot.forEach((doc) => {
      const data = doc.data();
      const { fromCurrency, toCurrency, rate } = data;

      // Check if this is an inverted record (fromCurrency is INR, but should be foreign)
      if (fromCurrency === 'INR' && FOREIGN_CURRENCIES.includes(toCurrency)) {
        // This record is inverted - needs fixing
        toFix.push({
          id: doc.id,
          current: { fromCurrency, toCurrency, rate },
          fixed: {
            fromCurrency: toCurrency, // USD
            toCurrency: fromCurrency, // INR
            rate: 1 / rate, // Invert the rate
            inverseRate: rate, // Original rate becomes inverse
          },
        });
      } else if (FOREIGN_CURRENCIES.includes(fromCurrency) && toCurrency === 'INR') {
        // Already correct format
        alreadyCorrect.push({
          id: doc.id,
          fromCurrency,
          toCurrency,
          rate,
        });
      } else {
        // Unknown format - log for review
        unknown.push({
          id: doc.id,
          fromCurrency,
          toCurrency,
          rate,
        });
      }
    });

    // Report findings
    console.log('Analysis Results:');
    console.log('-'.repeat(40));
    console.log(`  Records to fix:     ${toFix.length}`);
    console.log(`  Already correct:    ${alreadyCorrect.length}`);
    console.log(`  Unknown format:     ${unknown.length}`);
    console.log('');

    // Show records that need fixing
    if (toFix.length > 0) {
      console.log('Records to be corrected:');
      console.log('-'.repeat(40));
      toFix.forEach(({ id, current, fixed }) => {
        console.log(`  [${id}]`);
        console.log(
          `    Current: ${current.fromCurrency} → ${current.toCurrency} @ ${current.rate}`
        );
        console.log(
          `    Fixed:   ${fixed.fromCurrency} → ${fixed.toCurrency} @ ${fixed.rate.toFixed(4)}`
        );
        console.log('');
      });
    }

    // Show already correct records
    if (alreadyCorrect.length > 0) {
      console.log('Already correct (no changes needed):');
      console.log('-'.repeat(40));
      alreadyCorrect.forEach(({ id, fromCurrency, toCurrency, rate }) => {
        console.log(`  [${id}] ${fromCurrency} → ${toCurrency} @ ${rate}`);
      });
      console.log('');
    }

    // Show unknown format records
    if (unknown.length > 0) {
      console.log('Unknown format (skipped - review manually):');
      console.log('-'.repeat(40));
      unknown.forEach(({ id, fromCurrency, toCurrency, rate }) => {
        console.log(`  [${id}] ${fromCurrency} → ${toCurrency} @ ${rate}`);
      });
      console.log('');
    }

    // Apply fixes if not dry run
    if (toFix.length > 0 && !dryRun) {
      console.log('Applying fixes...');
      console.log('-'.repeat(40));

      const batch = db.batch();
      const now = admin.firestore.Timestamp.now();

      toFix.forEach(({ id, fixed }) => {
        const docRef = db.collection(COLLECTION).doc(id);
        batch.update(docRef, {
          fromCurrency: fixed.fromCurrency,
          toCurrency: fixed.toCurrency,
          rate: fixed.rate,
          inverseRate: fixed.inverseRate,
          // Keep baseCurrency as INR (this is correct)
          updatedAt: now,
          migrationNote: `Fixed currency direction on ${new Date().toISOString()}`,
        });
      });

      await batch.commit();
      console.log(`✓ Successfully updated ${toFix.length} records\n`);
    } else if (toFix.length > 0 && dryRun) {
      console.log('DRY RUN: No changes made. Run without --dry-run to apply fixes.\n');
    } else {
      console.log('No records need fixing.\n');
    }

    // Summary
    console.log('='.repeat(60));
    console.log('Migration Summary');
    console.log('='.repeat(60));
    console.log(`  Total records:      ${snapshot.size}`);
    console.log(`  Fixed:              ${dryRun ? '0 (dry run)' : toFix.length}`);
    console.log(`  Already correct:    ${alreadyCorrect.length}`);
    console.log(`  Skipped (unknown):  ${unknown.length}`);
    console.log('');

    return {
      success: true,
      fixed: dryRun ? 0 : toFix.length,
      alreadyCorrect: alreadyCorrect.length,
      unknown: unknown.length,
    };
  } catch (error) {
    console.error('Migration failed:', error);
    return {
      success: false,
      error: error.message,
    };
  }
}

// Main execution
const args = process.argv.slice(2);
const dryRun = args.includes('--dry-run');

migrateExchangeRates(dryRun)
  .then((result) => {
    if (result.success) {
      console.log('Migration completed successfully.');
      process.exit(0);
    } else {
      console.error('Migration failed:', result.error);
      process.exit(1);
    }
  })
  .catch((error) => {
    console.error('Unexpected error:', error);
    process.exit(1);
  });
