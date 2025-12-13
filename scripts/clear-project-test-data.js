#!/usr/bin/env node
/**
 * Clear test data for a specific project
 * Run with: node scripts/clear-project-test-data.js --project "PRJ-001/24-25" --confirm
 *
 * Clears:
 * - Master documents and related data (submissions, comments, supply items, work items)
 * - SSOT process data (streams, equipment, lines, instruments, valves, pipeTable)
 * - Uploaded files from Firebase Storage
 */

const admin = require('firebase-admin');
const path = require('path');
const fs = require('fs');

// Parse command line arguments
const args = process.argv.slice(2);
const projectCodeArg = args.find(
  (arg) => arg.startsWith('--project=') || arg.startsWith('--project ')
);
const projectCode = projectCodeArg
  ? projectCodeArg.replace('--project=', '').replace('--project ', '')
  : args[args.indexOf('--project') + 1];
const confirmFlag = args.includes('--confirm');
const dryRun = args.includes('--dry-run');

if (!projectCode) {
  console.error(
    'Usage: node scripts/clear-project-test-data.js --project "PRJ-001/24-25" --confirm'
  );
  console.error('       Add --dry-run to see what would be deleted without actually deleting');
  process.exit(1);
}

if (!confirmFlag && !dryRun) {
  console.error('⚠️  This will permanently delete data!');
  console.error('    Add --confirm to proceed or --dry-run to preview');
  process.exit(1);
}

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
  storageBucket: `${serviceAccount.project_id}.appspot.com`,
});

const db = admin.firestore();
const storage = admin.storage().bucket();

// Collections to clear under projects/{projectId}/
const PROJECT_SUBCOLLECTIONS = [
  'masterDocuments',
  'documentSubmissions',
  'documentComments',
  'supplyItems',
  'workItems',
  'documentActivities',
  'transmittals',
  // SSOT collections
  'streams',
  'equipment',
  'lines',
  'instruments',
  'valves',
  'pipeTable',
];

async function deleteCollection(collectionRef, batchSize = 500) {
  const snapshot = await collectionRef.limit(batchSize).get();

  if (snapshot.empty) {
    return 0;
  }

  let deleted = 0;
  const batch = db.batch();

  snapshot.docs.forEach((doc) => {
    batch.delete(doc.ref);
    deleted++;
  });

  if (!dryRun) {
    await batch.commit();
  }

  // Recurse if there might be more documents
  if (snapshot.size === batchSize) {
    const moreDeleted = await deleteCollection(collectionRef, batchSize);
    return deleted + moreDeleted;
  }

  return deleted;
}

async function deleteStorageFolder(prefix) {
  try {
    const [files] = await storage.getFiles({ prefix });

    if (files.length === 0) {
      return 0;
    }

    console.log(`  Found ${files.length} files in storage at ${prefix}`);

    if (!dryRun) {
      for (const file of files) {
        await file.delete();
        console.log(`  Deleted: ${file.name}`);
      }
    }

    return files.length;
  } catch (error) {
    console.warn(`  Warning: Could not access storage path ${prefix}: ${error.message}`);
    return 0;
  }
}

async function clearProjectData() {
  try {
    console.log(
      `\n${dryRun ? '🔍 DRY RUN - ' : ''}Clearing test data for project: ${projectCode}\n`
    );

    // Find the project by code
    const projectsSnapshot = await db.collection('projects').where('code', '==', projectCode).get();

    if (projectsSnapshot.empty) {
      console.error(`❌ Project with code "${projectCode}" not found`);
      process.exit(1);
    }

    const projectDoc = projectsSnapshot.docs[0];
    const projectId = projectDoc.id;
    const projectData = projectDoc.data();

    console.log(`Found project: ${projectData.name || projectCode}`);
    console.log(`Project ID: ${projectId}\n`);

    const stats = {
      collections: {},
      storageFiles: 0,
      total: 0,
    };

    // Clear each subcollection
    for (const collectionName of PROJECT_SUBCOLLECTIONS) {
      const collectionRef = db.collection(`projects/${projectId}/${collectionName}`);
      const count = await deleteCollection(collectionRef);
      stats.collections[collectionName] = count;
      stats.total += count;

      if (count > 0) {
        console.log(
          `${dryRun ? '  Would delete' : '✓ Deleted'} ${count} documents from ${collectionName}`
        );
      }
    }

    // Clear global documents collection linked to this project
    const documentsQuery = db.collection('documents').where('projectId', '==', projectId);
    const documentsSnapshot = await documentsQuery.get();

    if (!documentsSnapshot.empty) {
      const docCount = documentsSnapshot.size;
      stats.collections['documents (global)'] = docCount;
      stats.total += docCount;

      if (!dryRun) {
        const batch = db.batch();
        documentsSnapshot.docs.forEach((doc) => {
          batch.delete(doc.ref);
        });
        await batch.commit();
      }

      console.log(
        `${dryRun ? '  Would delete' : '✓ Deleted'} ${docCount} documents from global documents collection`
      );
    }

    // Clear storage files
    const storagePaths = [`projects/${projectId}/`, `documents/${projectId}/`];

    for (const storagePath of storagePaths) {
      const filesDeleted = await deleteStorageFolder(storagePath);
      stats.storageFiles += filesDeleted;
    }

    if (stats.storageFiles > 0) {
      console.log(
        `${dryRun ? '  Would delete' : '✓ Deleted'} ${stats.storageFiles} files from storage`
      );
    }

    // Summary
    console.log(`\n${dryRun ? '📋 DRY RUN SUMMARY' : '✅ DELETION COMPLETE'}`);
    console.log('─'.repeat(40));
    console.log(`Project: ${projectCode} (${projectId})`);
    console.log(`Total documents ${dryRun ? 'to delete' : 'deleted'}: ${stats.total}`);
    console.log(`Storage files ${dryRun ? 'to delete' : 'deleted'}: ${stats.storageFiles}`);
    console.log('\nBreakdown by collection:');
    for (const [collection, count] of Object.entries(stats.collections)) {
      if (count > 0) {
        console.log(`  ${collection}: ${count}`);
      }
    }

    if (dryRun) {
      console.log('\n💡 Run with --confirm (without --dry-run) to actually delete the data');
    }
  } catch (error) {
    console.error('❌ Error clearing project data:', error);
    process.exit(1);
  }

  process.exit(0);
}

clearProjectData();
