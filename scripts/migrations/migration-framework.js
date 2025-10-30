#!/usr/bin/env node

/**
 * Migration Framework
 *
 * Provides a robust framework for running and tracking database migrations.
 *
 * Features:
 * - Migration tracking in Firestore
 * - Dry-run mode for testing
 * - Batch processing for large collections
 * - Progress reporting
 * - Rollback capability (if migration supports it)
 * - Error handling and recovery
 *
 * Usage:
 *   node scripts/migrations/migration-framework.js <migration-name> [--dry-run] [--batch-size=500]
 *
 * Example:
 *   node scripts/migrations/migration-framework.js add-isDeleted-field --dry-run
 */

const admin = require('firebase-admin');

// Initialize Firebase Admin
if (!admin.apps.length) {
  try {
    admin.initializeApp({
      projectId: 'vapour-toolbox',
    });
  } catch (error) {
    console.error('Failed to initialize Firebase Admin:', error.message);
    console.log('\n💡 Make sure you are authenticated with Firebase:');
    console.log('   Run: firebase login');
    process.exit(1);
  }
}

const db = admin.firestore();
const MIGRATIONS_COLLECTION = 'system_migrations';

/**
 * Migration Registry
 * Add your migrations here
 */
const MIGRATIONS = {
  'add-isDeleted-field': require('./migrations/add-isDeleted-field'),
  // Add more migrations as needed
};

/**
 * Check if migration has already been run
 */
async function isMigrationComplete(migrationName) {
  const migrationDoc = await db.collection(MIGRATIONS_COLLECTION).doc(migrationName).get();
  return migrationDoc.exists && migrationDoc.data().status === 'completed';
}

/**
 * Record migration start
 */
async function recordMigrationStart(migrationName, dryRun) {
  await db.collection(MIGRATIONS_COLLECTION).doc(migrationName).set({
    name: migrationName,
    status: dryRun ? 'dry-run' : 'running',
    startedAt: admin.firestore.Timestamp.now(),
    dryRun,
  });
}

/**
 * Record migration completion
 */
async function recordMigrationComplete(migrationName, stats, dryRun) {
  await db.collection(MIGRATIONS_COLLECTION).doc(migrationName).update({
    status: dryRun ? 'dry-run-complete' : 'completed',
    completedAt: admin.firestore.Timestamp.now(),
    stats,
  });
}

/**
 * Record migration failure
 */
async function recordMigrationFailure(migrationName, error) {
  await db.collection(MIGRATIONS_COLLECTION).doc(migrationName).update({
    status: 'failed',
    failedAt: admin.firestore.Timestamp.now(),
    error: error.message,
    stack: error.stack,
  });
}

/**
 * Run a migration
 */
async function runMigration(migrationName, options = {}) {
  const dryRun = options.dryRun || false;
  const batchSize = options.batchSize || 500;

  console.log('═'.repeat(75));
  console.log(`  MIGRATION: ${migrationName}`);
  if (dryRun) {
    console.log('  MODE: DRY RUN (no changes will be made)');
  }
  console.log('═'.repeat(75));
  console.log();

  // Check if migration exists
  const migration = MIGRATIONS[migrationName];
  if (!migration) {
    console.error(`❌ Migration not found: ${migrationName}`);
    console.log('\nAvailable migrations:');
    Object.keys(MIGRATIONS).forEach(name => {
      console.log(`  - ${name}`);
    });
    process.exit(1);
  }

  // Check if already completed
  if (!dryRun && await isMigrationComplete(migrationName)) {
    console.log(`⚠️  Migration "${migrationName}" has already been completed.`);
    console.log('\nTo re-run, delete the migration document from Firestore:');
    console.log(`  Collection: ${MIGRATIONS_COLLECTION}`);
    console.log(`  Document: ${migrationName}`);
    console.log();
    process.exit(0);
  }

  try {
    // Record migration start
    await recordMigrationStart(migrationName, dryRun);

    // Run migration
    console.log(`🚀 Starting migration...\n`);

    const startTime = Date.now();
    const stats = await migration.run(db, { dryRun, batchSize });
    const duration = ((Date.now() - startTime) / 1000).toFixed(2);

    // Record completion
    await recordMigrationComplete(migrationName, stats, dryRun);

    // Print results
    console.log('\n' + '═'.repeat(75));
    console.log('  MIGRATION COMPLETE');
    console.log('═'.repeat(75));
    console.log();
    console.log(`Duration: ${duration}s`);
    console.log(`Dry Run: ${dryRun}`);
    console.log();
    console.log('Statistics:');
    Object.entries(stats).forEach(([key, value]) => {
      console.log(`  ${key}: ${value}`);
    });
    console.log();

    if (dryRun) {
      console.log('✨ Dry run complete - no changes were made');
      console.log('💡 Run without --dry-run to apply changes\n');
    } else {
      console.log('✅ Migration completed successfully\n');
    }

    process.exit(0);

  } catch (error) {
    console.error('\n❌ Migration failed:', error.message);
    console.error(error.stack);

    if (!dryRun) {
      await recordMigrationFailure(migrationName, error);
    }

    process.exit(1);
  }
}

/**
 * List all migrations
 */
async function listMigrations() {
  console.log('═'.repeat(75));
  console.log('  AVAILABLE MIGRATIONS');
  console.log('═'.repeat(75));
  console.log();

  // Get migration status from Firestore
  const migrationsSnapshot = await db.collection(MIGRATIONS_COLLECTION).get();
  const migrationStatus = {};

  migrationsSnapshot.forEach(doc => {
    migrationStatus[doc.id] = doc.data();
  });

  // List all migrations
  Object.keys(MIGRATIONS).forEach(name => {
    const status = migrationStatus[name];

    if (!status) {
      console.log(`⚪ ${name} - Not run`);
    } else if (status.status === 'completed') {
      const date = status.completedAt.toDate().toLocaleString();
      console.log(`✅ ${name} - Completed (${date})`);
    } else if (status.status === 'failed') {
      const date = status.failedAt.toDate().toLocaleString();
      console.log(`❌ ${name} - Failed (${date})`);
    } else if (status.status === 'running') {
      const date = status.startedAt.toDate().toLocaleString();
      console.log(`🔄 ${name} - Running (${date})`);
    }
  });

  console.log();
}

// Parse command line arguments
const args = process.argv.slice(2);
const migrationName = args.find(arg => !arg.startsWith('--'));
const dryRun = args.includes('--dry-run');
const batchSizeArg = args.find(arg => arg.startsWith('--batch-size='));
const batchSize = batchSizeArg ? parseInt(batchSizeArg.split('=')[1]) : 500;

// Handle commands
if (!migrationName || migrationName === 'list') {
  listMigrations().then(() => process.exit(0));
} else {
  runMigration(migrationName, { dryRun, batchSize });
}
