/**
 * Data Wipe Utility - Pre-Production Cleanup
 *
 * This script wipes ALL data from Firestore (except user accounts and company settings).
 * Use this after accountant testing is complete, before going to production.
 *
 * DANGER: This is irreversible! All transactions, entities, and test data will be deleted.
 *
 * Usage:
 *   node scripts/data-wipe/wipe-all-data.js --confirm
 *
 * Safety features:
 *   - Requires --confirm flag
 *   - Requires environment confirmation
 *   - Creates backup before deletion
 *   - Shows summary of what will be deleted
 */

const admin = require('firebase-admin');
const readline = require('readline');
const fs = require('fs');
const path = require('path');

// Initialize Firebase Admin
const serviceAccountPath = process.env.FIREBASE_SERVICE_ACCOUNT ||
  path.join(__dirname, '../../firebase-service-account.json');

if (!fs.existsSync(serviceAccountPath)) {
  console.error('❌ Firebase service account key not found!');
  console.error(`   Expected at: ${serviceAccountPath}`);
  console.error('   Set FIREBASE_SERVICE_ACCOUNT environment variable or place key in project root');
  process.exit(1);
}

admin.initializeApp({
  credential: admin.credential.cert(serviceAccountPath),
  projectId: 'vapour-toolbox'
});

const db = admin.firestore();

// Collections to wipe (in order)
const COLLECTIONS_TO_WIPE = [
  'transactions',
  'payments',
  'entities',
  'projects',
  'accounts', // Chart of Accounts - will be regenerated
  'journals',
  'allocations',
  'bankTransactions',
  'reconciliations',
];

// Collections to PRESERVE (never delete)
const PROTECTED_COLLECTIONS = [
  'users',
  'company', // Company settings
  'roles',
  'permissions',
];

/**
 * Count documents in a collection
 */
async function countDocuments(collectionName) {
  const snapshot = await db.collection(collectionName).count().get();
  return snapshot.data().count;
}

/**
 * Get summary of all collections
 */
async function getDataSummary() {
  console.log('\n📊 Current Data Summary:\n');

  const summary = {};

  for (const collection of COLLECTIONS_TO_WIPE) {
    try {
      const count = await countDocuments(collection);
      summary[collection] = count;
      console.log(`   ${collection.padEnd(20)} : ${count} documents`);
    } catch (error) {
      summary[collection] = 0;
      console.log(`   ${collection.padEnd(20)} : 0 documents`);
    }
  }

  console.log('\n🔒 Protected Collections (will NOT be deleted):\n');
  for (const collection of PROTECTED_COLLECTIONS) {
    try {
      const count = await countDocuments(collection);
      console.log(`   ${collection.padEnd(20)} : ${count} documents`);
    } catch (error) {
      console.log(`   ${collection.padEnd(20)} : 0 documents`);
    }
  }

  return summary;
}

/**
 * Create backup of data
 */
async function createBackup(collectionName) {
  const backupDir = path.join(__dirname, '../../backups');
  if (!fs.existsSync(backupDir)) {
    fs.mkdirSync(backupDir, { recursive: true });
  }

  const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
  const backupFile = path.join(backupDir, `${collectionName}_${timestamp}.json`);

  const snapshot = await db.collection(collectionName).get();
  const data = [];

  snapshot.forEach(doc => {
    data.push({
      id: doc.id,
      data: doc.data()
    });
  });

  fs.writeFileSync(backupFile, JSON.stringify(data, null, 2));
  console.log(`   ✓ Backed up ${data.length} documents to ${path.basename(backupFile)}`);

  return data.length;
}

/**
 * Delete all documents in a collection
 */
async function wipeCollection(collectionName) {
  const batchSize = 500;
  let totalDeleted = 0;

  while (true) {
    const snapshot = await db.collection(collectionName).limit(batchSize).get();

    if (snapshot.empty) {
      break;
    }

    const batch = db.batch();
    snapshot.docs.forEach(doc => {
      batch.delete(doc.ref);
    });

    await batch.commit();
    totalDeleted += snapshot.size;

    if (snapshot.size < batchSize) {
      break;
    }
  }

  return totalDeleted;
}

/**
 * Confirm with user
 */
function confirm(question) {
  const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout
  });

  return new Promise(resolve => {
    rl.question(question, answer => {
      rl.close();
      resolve(answer.toLowerCase() === 'yes');
    });
  });
}

/**
 * Main execution
 */
async function main() {
  console.log('═══════════════════════════════════════════════════════════');
  console.log('   🗑️  DATA WIPE UTILITY - PRE-PRODUCTION CLEANUP');
  console.log('═══════════════════════════════════════════════════════════\n');

  // Check for --confirm flag
  if (!process.argv.includes('--confirm')) {
    console.error('❌ Safety check: --confirm flag required\n');
    console.log('Usage: node scripts/data-wipe/wipe-all-data.js --confirm\n');
    process.exit(1);
  }

  // Get current environment
  console.log('🔍 Environment Check:\n');
  console.log(`   Project ID: vapour-toolbox`);
  console.log(`   Service Account: ${path.basename(serviceAccountPath)}\n`);

  // Get data summary
  const summary = await getDataSummary();

  const totalDocs = Object.values(summary).reduce((sum, count) => sum + count, 0);

  if (totalDocs === 0) {
    console.log('\n✅ Database is already empty. Nothing to delete.\n');
    process.exit(0);
  }

  // Final confirmation
  console.log('\n⚠️  WARNING: This action is IRREVERSIBLE!\n');
  console.log(`   You are about to delete ${totalDocs} documents.`);
  console.log('   Backups will be created before deletion.\n');

  const confirmed = await confirm('Type "yes" to proceed with data wipe: ');

  if (!confirmed) {
    console.log('\n❌ Operation cancelled by user.\n');
    process.exit(0);
  }

  console.log('\n🔄 Starting data wipe...\n');

  // Create backups and wipe collections
  let totalBackedUp = 0;
  let totalDeleted = 0;

  for (const collection of COLLECTIONS_TO_WIPE) {
    if (summary[collection] === 0) {
      console.log(`⏭️  Skipping ${collection} (empty)`);
      continue;
    }

    console.log(`\n📦 Processing ${collection}...`);

    // Create backup
    const backedUp = await createBackup(collection);
    totalBackedUp += backedUp;

    // Delete documents
    const deleted = await wipeCollection(collection);
    totalDeleted += deleted;
    console.log(`   ✓ Deleted ${deleted} documents`);
  }

  console.log('\n═══════════════════════════════════════════════════════════');
  console.log('   ✅ DATA WIPE COMPLETED SUCCESSFULLY');
  console.log('═══════════════════════════════════════════════════════════\n');
  console.log(`   📦 Backed up: ${totalBackedUp} documents`);
  console.log(`   🗑️  Deleted: ${totalDeleted} documents`);
  console.log(`   🔒 Protected: ${PROTECTED_COLLECTIONS.length} collections\n`);
  console.log('   Backups saved to: scripts/data-wipe/../../backups/\n');
  console.log('   Next steps:');
  console.log('   1. Initialize Chart of Accounts (if needed)');
  console.log('   2. Verify production data is clean');
  console.log('   3. Deploy to production\n');

  process.exit(0);
}

// Run
main().catch(error => {
  console.error('\n❌ Error during data wipe:', error);
  process.exit(1);
});
