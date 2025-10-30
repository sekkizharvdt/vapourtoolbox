/**
 * Migration: Add isDeleted Field to Entities
 *
 * Adds the isDeleted field to all entities that don't have it.
 * Sets default value to false.
 */

module.exports = {
  name: 'add-isDeleted-field',
  description: 'Add isDeleted field to entities collection',
  collection: 'entities',

  async run(db, options = {}) {
    const { dryRun = false, batchSize = 500 } = options;

    console.log(`Migrating collection: entities`);
    console.log(`Batch size: ${batchSize}`);
    console.log();

    const stats = {
      total: 0,
      updated: 0,
      skipped: 0,
      errors: 0,
    };

    try {
      // Get all entities
      const snapshot = await db.collection('entities').get();
      stats.total = snapshot.size;

      if (snapshot.empty) {
        console.log('No entities found.');
        return stats;
      }

      console.log(`Found ${stats.total} entities\n`);

      // Process in batches
      const batch = db.batch();
      let batchCount = 0;

      for (const doc of snapshot.docs) {
        const data = doc.data();

        try {
          // Check if isDeleted field exists
          if (data.isDeleted === undefined || data.isDeleted === null) {
            if (!dryRun) {
              batch.update(doc.ref, {
                isDeleted: false,
                updatedAt: admin.firestore.Timestamp.now()
              });
              batchCount++;

              // Commit batch if it reaches batch size
              if (batchCount >= batchSize) {
                await batch.commit();
                batchCount = 0;
              }
            }

            console.log(`✅ ${dryRun ? '[DRY RUN] Would update' : 'Updated'} entity: ${doc.id} (${data.name || 'Unknown'})`);
            stats.updated++;
          } else {
            console.log(`⏭️  Skipped entity: ${doc.id} (already has isDeleted: ${data.isDeleted})`);
            stats.skipped++;
          }
        } catch (error) {
          console.error(`❌ Error processing entity ${doc.id}:`, error.message);
          stats.errors++;
        }
      }

      // Commit remaining batch
      if (batchCount > 0 && !dryRun) {
        await batch.commit();
      }

      return stats;

    } catch (error) {
      console.error('Migration failed:', error);
      throw error;
    }
  },

  /**
   * Rollback (optional - if migration is reversible)
   */
  async rollback(db) {
    console.log('Rollback not implemented for this migration');
    console.log('To rollback manually, remove isDeleted field from entities');
  }
};
