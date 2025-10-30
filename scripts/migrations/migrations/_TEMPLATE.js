/**
 * Migration Template
 *
 * Copy this file and rename it to create a new migration.
 * Naming convention: <action>-<what>-<where>.js
 * Examples:
 *   - add-status-field-to-projects.js
 *   - migrate-contacts-to-array.js
 *   - remove-deprecated-fields.js
 *
 * Then add it to migration-framework.js MIGRATIONS registry.
 */

const admin = require('firebase-admin');

module.exports = {
  // Migration metadata
  name: 'your-migration-name',
  description: 'Brief description of what this migration does',
  collection: 'collection_name',  // Primary collection being migrated

  /**
   * Run the migration
   *
   * @param {admin.firestore.Firestore} db - Firestore database instance
   * @param {Object} options - Migration options
   * @param {boolean} options.dryRun - If true, don't make actual changes
   * @param {number} options.batchSize - Number of documents to process per batch
   * @returns {Object} stats - Statistics about the migration
   */
  async run(db, options = {}) {
    const { dryRun = false, batchSize = 500 } = options;

    console.log(`Migrating collection: ${this.collection}`);
    console.log(`Batch size: ${batchSize}`);
    console.log();

    // Initialize statistics
    const stats = {
      total: 0,
      updated: 0,
      skipped: 0,
      errors: 0,
    };

    try {
      // Step 1: Get all documents from collection
      const snapshot = await db.collection(this.collection).get();
      stats.total = snapshot.size;

      if (snapshot.empty) {
        console.log(`No documents found in ${this.collection}.`);
        return stats;
      }

      console.log(`Found ${stats.total} documents\n`);

      // Step 2: Process documents in batches
      const batch = db.batch();
      let batchCount = 0;

      for (const doc of snapshot.docs) {
        const data = doc.data();
        const docId = doc.id;

        try {
          // Step 3: Determine if document needs migration
          const needsMigration = false; // TODO: Add your logic here

          if (needsMigration) {
            // Step 4: Prepare update data
            const updateData = {
              // TODO: Define what fields to update
              // fieldName: newValue,
              updatedAt: admin.firestore.Timestamp.now()
            };

            if (!dryRun) {
              batch.update(doc.ref, updateData);
              batchCount++;

              // Commit batch if it reaches batch size
              if (batchCount >= batchSize) {
                await batch.commit();
                console.log(`  Committed batch of ${batchCount} updates`);
                batchCount = 0;
              }
            }

            console.log(`✅ ${dryRun ? '[DRY RUN] Would update' : 'Updated'} document: ${docId}`);
            stats.updated++;
          } else {
            console.log(`⏭️  Skipped document: ${docId} (no migration needed)`);
            stats.skipped++;
          }
        } catch (error) {
          console.error(`❌ Error processing document ${docId}:`, error.message);
          stats.errors++;
        }
      }

      // Step 5: Commit remaining batch
      if (batchCount > 0 && !dryRun) {
        await batch.commit();
        console.log(`  Committed final batch of ${batchCount} updates`);
      }

      return stats;

    } catch (error) {
      console.error('Migration failed:', error);
      throw error;
    }
  },

  /**
   * Rollback the migration (optional)
   *
   * Implement this if your migration is reversible.
   * If not reversible, explain what manual steps are needed.
   *
   * @param {admin.firestore.Firestore} db - Firestore database instance
   */
  async rollback(db) {
    console.log('Rollback not implemented for this migration');
    console.log('Manual rollback instructions:');
    console.log('  1. TODO: Add manual rollback steps');
    console.log('  2. ...');
  }
};

/**
 * Migration Checklist:
 *
 * Before running:
 * [ ] 1. Test in development environment first
 * [ ] 2. Run with --dry-run flag to verify changes
 * [ ] 3. Backup production database
 * [ ] 4. Update schema-registry.js if adding new fields
 * [ ] 5. Update types if changing field structure
 * [ ] 6. Check that queries handle both old and new schema
 *
 * After running:
 * [ ] 1. Verify migration completed successfully
 * [ ] 2. Check application still works with migrated data
 * [ ] 3. Monitor error logs for issues
 * [ ] 4. Document migration in changelog
 */
