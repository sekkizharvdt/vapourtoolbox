#!/usr/bin/env node
/**
 * Exchange Rate Reseed Script
 *
 * Deletes all existing exchange rate records and seeds fresh data with
 * the correct format:
 *   fromCurrency: 'USD', toCurrency: 'INR', rate: 83.25
 *   This means: 1 USD = 83.25 INR
 *
 * Usage:
 *   node scripts/reseed-exchange-rates.js [--dry-run]
 *
 * Options:
 *   --dry-run    Preview changes without modifying data
 */

const admin = require('firebase-admin');
const path = require('path');

// Initialize Firebase Admin SDK using service account
const serviceAccountPath = path.join(__dirname, '..', 'firebase-service-account.json');
let serviceAccount;

try {
  serviceAccount = require(serviceAccountPath);
} catch {
  console.error('Error: Could not load firebase-service-account.json');
  console.error('Please ensure the service account file exists at:', serviceAccountPath);
  process.exit(1);
}

if (!admin.apps.length) {
  admin.initializeApp({
    credential: admin.credential.cert(serviceAccount),
    projectId: serviceAccount.project_id || 'vapour-toolbox',
  });
}

const db = admin.firestore();
const COLLECTION = 'exchangeRates';

// Sample exchange rates (approximate as of late 2024)
// Format: { currency: rate } where rate is "1 [currency] = [rate] INR"
const EXCHANGE_RATES = {
  USD: 83.25, // 1 USD = 83.25 INR
  EUR: 90.5, // 1 EUR = 90.50 INR
  GBP: 105.75, // 1 GBP = 105.75 INR
  SGD: 61.8, // 1 SGD = 61.80 INR
  AED: 22.67, // 1 AED = 22.67 INR
  SAR: 22.2, // 1 SAR = 22.20 INR
  QAR: 22.86, // 1 QAR = 22.86 INR
  KWD: 270.5, // 1 KWD = 270.50 INR
  OMR: 216.25, // 1 OMR = 216.25 INR
  BHD: 220.75, // 1 BHD = 220.75 INR
};

async function reseedExchangeRates(dryRun = false) {
  console.log('='.repeat(60));
  console.log('Exchange Rate Reseed Script');
  console.log('='.repeat(60));
  console.log(`Mode: ${dryRun ? 'DRY RUN (no changes will be made)' : 'LIVE'}`);
  console.log('');

  try {
    // Step 1: Get all existing exchange rate records
    console.log('Step 1: Analyzing existing data...');
    console.log('-'.repeat(40));

    const snapshot = await db.collection(COLLECTION).get();
    console.log(`Found ${snapshot.size} existing exchange rate records\n`);

    if (snapshot.size > 0) {
      console.log('Existing records to be deleted:');
      snapshot.forEach((doc) => {
        const data = doc.data();
        console.log(`  [${doc.id}] ${data.fromCurrency} → ${data.toCurrency} @ ${data.rate}`);
      });
      console.log('');
    }

    // Step 2: Delete all existing records
    if (!dryRun && snapshot.size > 0) {
      console.log('Step 2: Deleting existing records...');
      console.log('-'.repeat(40));

      // Delete in batches of 400 (Firestore limit is 500)
      const batchSize = 400;
      const docs = snapshot.docs;

      for (let i = 0; i < docs.length; i += batchSize) {
        const batch = db.batch();
        const chunk = docs.slice(i, i + batchSize);

        chunk.forEach((doc) => {
          batch.delete(doc.ref);
        });

        await batch.commit();
        console.log(`  Deleted batch ${Math.floor(i / batchSize) + 1} (${chunk.length} records)`);
      }

      console.log(`✓ Deleted ${snapshot.size} records\n`);
    } else if (dryRun && snapshot.size > 0) {
      console.log('Step 2: DRY RUN - Would delete existing records\n');
    } else {
      console.log('Step 2: No existing records to delete\n');
    }

    // Step 3: Seed fresh data
    console.log('Step 3: Seeding fresh exchange rate data...');
    console.log('-'.repeat(40));

    const now = admin.firestore.Timestamp.now();
    const newRecords = [];

    for (const [currency, rate] of Object.entries(EXCHANGE_RATES)) {
      const record = {
        fromCurrency: currency, // USD, EUR, etc.
        toCurrency: 'INR', // Always convert TO INR
        baseCurrency: 'INR',
        rate, // 1 USD = 83.25 INR
        inverseRate: 1 / rate, // 1 INR = 0.012 USD
        effectiveFrom: now,
        status: 'ACTIVE',
        source: 'MANUAL',
        sourceReference: 'Seed Data',
        notes: `Reseeded exchange rate. Created on ${new Date().toISOString()}`,
        createdBy: 'reseed-script',
        createdAt: now,
        updatedAt: now,
      };

      newRecords.push(record);
      console.log(`  ${currency} → INR @ ${rate} (inverse: ${(1 / rate).toFixed(6)})`);
    }

    console.log('');

    if (!dryRun) {
      // Add all new records
      const batch = db.batch();

      newRecords.forEach((record) => {
        const docRef = db.collection(COLLECTION).doc();
        batch.set(docRef, record);
      });

      await batch.commit();
      console.log(`✓ Created ${newRecords.length} new exchange rate records\n`);
    } else {
      console.log(`DRY RUN: Would create ${newRecords.length} new records\n`);
    }

    // Summary
    console.log('='.repeat(60));
    console.log('Reseed Summary');
    console.log('='.repeat(60));
    console.log(`  Deleted:  ${dryRun ? '0 (dry run)' : snapshot.size}`);
    console.log(`  Created:  ${dryRun ? '0 (dry run)' : newRecords.length}`);
    console.log('');

    if (dryRun) {
      console.log('DRY RUN: No changes made. Run without --dry-run to apply.\n');
    }

    // Verify the new data
    if (!dryRun) {
      console.log('Verification - New records:');
      console.log('-'.repeat(40));

      const verifySnapshot = await db.collection(COLLECTION).get();
      verifySnapshot.forEach((doc) => {
        const data = doc.data();
        console.log(`  [${doc.id}] ${data.fromCurrency} → ${data.toCurrency} @ ${data.rate}`);
      });
      console.log('');
    }

    return {
      success: true,
      deleted: dryRun ? 0 : snapshot.size,
      created: dryRun ? 0 : newRecords.length,
    };
  } catch (error) {
    console.error('Reseed failed:', error);
    return {
      success: false,
      error: error.message,
    };
  }
}

// Main execution
const args = process.argv.slice(2);
const dryRun = args.includes('--dry-run');

reseedExchangeRates(dryRun)
  .then((result) => {
    if (result.success) {
      console.log('Reseed completed successfully.');
      process.exit(0);
    } else {
      console.error('Reseed failed:', result.error);
      process.exit(1);
    }
  })
  .catch((error) => {
    console.error('Unexpected error:', error);
    process.exit(1);
  });
