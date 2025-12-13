#!/usr/bin/env node
/**
 * Migration script to fix forex invoice outstanding amounts
 * Run with: node scripts/migrate-forex-outstanding.js
 *
 * Problem: Older forex invoices have outstandingAmount stored in foreign currency
 * Fix: Convert outstandingAmount to INR using exchangeRate
 */

const admin = require('firebase-admin');
const path = require('path');
const fs = require('fs');

// Initialize Firebase Admin
const serviceAccountPath = path.join(__dirname, '../firebase-service-account.json');

if (!fs.existsSync(serviceAccountPath)) {
  console.error('❌ Error: firebase-service-account.json not found');
  console.error('Please download it from Firebase Console → Project Settings → Service Accounts');
  console.error('Place it in the project root directory');
  process.exit(1);
}

const serviceAccount = require(serviceAccountPath);

admin.initializeApp({
  credential: admin.credential.cert(serviceAccount),
  databaseURL: `https://${serviceAccount.project_id}.firebaseio.com`,
});

const db = admin.firestore();

async function migrateForexInvoices() {
  try {
    console.log('Starting forex invoice migration...\n');

    // Get all customer invoices
    const invoicesSnapshot = await db
      .collection('transactions')
      .where('type', '==', 'CUSTOMER_INVOICE')
      .get();

    console.log(`Found ${invoicesSnapshot.size} invoices to check\n`);

    let updated = 0;
    let skipped = 0;
    let alreadyCorrect = 0;

    for (const doc of invoicesSnapshot.docs) {
      const invoice = doc.data();

      // Skip INR invoices
      const currency = invoice.currency || 'INR';
      if (currency === 'INR') {
        skipped++;
        continue;
      }

      const totalAmount = invoice.totalAmount || 0;
      const exchangeRate = invoice.exchangeRate || 1;
      const paidAmount = invoice.paidAmount || 0;

      // Calculate correct INR values
      const correctBaseAmountINR = totalAmount * exchangeRate;
      const paidAmountINR = paidAmount * exchangeRate;
      const correctOutstandingINR = correctBaseAmountINR - paidAmountINR;

      // Check if outstandingAmount needs fixing
      // If outstandingAmount equals totalAmount, it was stored in foreign currency
      const currentOutstanding = invoice.outstandingAmount || 0;

      if (currentOutstanding === totalAmount && currentOutstanding !== correctOutstandingINR) {
        // Needs migration - outstandingAmount is in foreign currency
        const updates = {
          baseAmount: correctBaseAmountINR,
          outstandingAmount: correctOutstandingINR,
          _forexMigratedAt: admin.firestore.Timestamp.now(),
          _forexMigrationNote: `Fixed: ${currency} ${totalAmount} @ ${exchangeRate} = INR ${correctOutstandingINR.toFixed(2)}`,
        };

        await doc.ref.update(updates);

        console.log(
          `✓ Updated ${invoice.transactionNumber}: ${currency} ${totalAmount} → ₹${correctOutstandingINR.toFixed(2)} (rate: ${exchangeRate})`
        );
        updated++;
      } else {
        // Check if baseAmount is missing but outstandingAmount is correct
        if (!invoice.baseAmount && exchangeRate > 1) {
          await doc.ref.update({
            baseAmount: correctBaseAmountINR,
          });
          console.log(
            `✓ Added baseAmount to ${invoice.transactionNumber}: ₹${correctBaseAmountINR.toFixed(2)}`
          );
          updated++;
        } else {
          alreadyCorrect++;
        }
      }
    }

    console.log(`\n✅ Migration complete!`);
    console.log(`   Updated: ${updated}`);
    console.log(`   Already correct: ${alreadyCorrect}`);
    console.log(`   Skipped (INR): ${skipped}`);
    console.log(`   Total checked: ${invoicesSnapshot.size}`);
  } catch (error) {
    console.error('❌ Migration failed:', error);
    process.exit(1);
  }

  process.exit(0);
}

migrateForexInvoices();
