/**
 * Migration Script: Add isDeleted field to existing entities
 *
 * This script adds the isDeleted field to all entities that don't have it.
 * This is necessary for the new soft-delete functionality to work correctly.
 *
 * Usage: node scripts/migrations/add-isDeleted-to-entities.js
 */

const admin = require('firebase-admin');

// Initialize Firebase Admin using Application Default Credentials
// or service account key from environment variable
if (!admin.apps.length) {
  try {
    admin.initializeApp({
      projectId: 'vapour-toolbox',
    });
  } catch (error) {
    console.error('Failed to initialize Firebase Admin:', error.message);
    console.log('\n💡 Make sure you are authenticated with Firebase:');
    console.log('   Run: firebase login');
    console.log('   Or set GOOGLE_APPLICATION_CREDENTIALS environment variable');
    process.exit(1);
  }
}

const db = admin.firestore();
const ENTITIES_COLLECTION = 'entities';

async function migrateEntities() {
  console.log('🔄 Starting entity migration...\n');

  try {
    // Get ALL entities (no filters)
    const snapshot = await db.collection(ENTITIES_COLLECTION).get();

    if (snapshot.empty) {
      console.log('✅ No entities found in the database.');
      return;
    }

    console.log(`📊 Found ${snapshot.size} total entities\n`);

    let updatedCount = 0;
    let skippedCount = 0;
    let errorCount = 0;

    // Process each entity
    for (const doc of snapshot.docs) {
      const data = doc.data();
      const entityId = doc.id;

      try {
        // Check if isDeleted field exists
        if (data.isDeleted === undefined || data.isDeleted === null) {
          // Field is missing - add it
          await db.collection(ENTITIES_COLLECTION).doc(entityId).update({
            isDeleted: false,
            updatedAt: admin.firestore.Timestamp.now()
          });

          console.log(`✅ Updated entity: ${data.code || entityId} (${data.name || 'Unknown'})`);
          updatedCount++;
        } else {
          // Field already exists
          console.log(`⏭️  Skipped entity: ${data.code || entityId} (already has isDeleted: ${data.isDeleted})`);
          skippedCount++;
        }
      } catch (error) {
        console.error(`❌ Error updating entity ${entityId}:`, error.message);
        errorCount++;
      }
    }

    // Summary
    console.log('\n' + '='.repeat(60));
    console.log('📈 Migration Summary:');
    console.log('='.repeat(60));
    console.log(`✅ Updated:  ${updatedCount} entities`);
    console.log(`⏭️  Skipped:  ${skippedCount} entities (already have isDeleted field)`);
    console.log(`❌ Errors:   ${errorCount} entities`);
    console.log('='.repeat(60));

    if (updatedCount > 0) {
      console.log('\n✨ Migration completed successfully!');
      console.log('💡 You can now refresh your entities page to see the results.');
    } else if (skippedCount > 0) {
      console.log('\n✅ All entities already have the isDeleted field.');
    }

  } catch (error) {
    console.error('\n❌ Migration failed:', error);
    process.exit(1);
  }
}

// Run the migration
migrateEntities()
  .then(() => {
    console.log('\n👋 Migration script finished.');
    process.exit(0);
  })
  .catch((error) => {
    console.error('\n💥 Fatal error:', error);
    process.exit(1);
  });
