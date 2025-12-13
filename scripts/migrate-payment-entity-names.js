#!/usr/bin/env node
/**
 * Migration script to populate entityName on payments
 * Run with: node scripts/migrate-payment-entity-names.js
 *
 * Problem: Older payments don't have entityName field
 * Fix: Look up entity by entityId and add entityName
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

async function migratePaymentEntityNames() {
  try {
    console.log('Starting payment entity name migration...\n');

    // First, build a map of entity IDs to names
    console.log('Loading entities...');
    const entitiesSnapshot = await db.collection('entities').get();
    const entityMap = new Map();

    entitiesSnapshot.forEach((doc) => {
      const data = doc.data();
      entityMap.set(doc.id, data.name || data.legalName || 'Unknown');
    });

    console.log(`Loaded ${entityMap.size} entities\n`);

    // Get all payments
    const paymentsSnapshot = await db
      .collection('transactions')
      .where('type', 'in', ['CUSTOMER_PAYMENT', 'VENDOR_PAYMENT'])
      .get();

    console.log(`Found ${paymentsSnapshot.size} payments to check\n`);

    let updated = 0;
    let skipped = 0;
    let notFound = 0;

    for (const doc of paymentsSnapshot.docs) {
      const payment = doc.data();

      // Skip if already has entityName
      if (payment.entityName) {
        skipped++;
        continue;
      }

      // Look up entity name
      const entityId = payment.entityId;
      if (!entityId) {
        console.log(`⚠️  ${payment.transactionNumber}: No entityId`);
        notFound++;
        continue;
      }

      const entityName = entityMap.get(entityId);
      if (!entityName) {
        console.log(`⚠️  ${payment.transactionNumber}: Entity ${entityId} not found`);
        notFound++;
        continue;
      }

      // Update payment with entityName
      await doc.ref.update({
        entityName,
        updatedAt: admin.firestore.Timestamp.now(),
      });

      console.log(`✓ Updated ${payment.transactionNumber}: ${entityName}`);
      updated++;
    }

    console.log(`\n✅ Migration complete!`);
    console.log(`   Updated: ${updated}`);
    console.log(`   Already had name: ${skipped}`);
    console.log(`   Entity not found: ${notFound}`);
    console.log(`   Total checked: ${paymentsSnapshot.size}`);
  } catch (error) {
    console.error('❌ Migration failed:', error);
    process.exit(1);
  }

  process.exit(0);
}

migratePaymentEntityNames();
