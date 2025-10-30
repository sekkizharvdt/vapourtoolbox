const admin = require('firebase-admin');

// Initialize Firebase Admin
admin.initializeApp({
  projectId: 'vapour-toolbox',
});

const db = admin.firestore();

/**
 * Determine user domain based on email
 */
function getUserDomain(email) {
  return email.endsWith('@vapourdesal.com') ? 'internal' : 'external';
}

/**
 * Comprehensive user data migration
 * Ensures all users have required fields:
 * - domain: 'internal' | 'external'
 * - assignedProjects: string[]
 * - permissions: number
 */
async function migrateAllUsers() {
  try {
    console.log('\n' + '='.repeat(80));
    console.log('🔄 COMPREHENSIVE USER DATA MIGRATION');
    console.log('='.repeat(80) + '\n');

    console.log('📋 Checking for users with incomplete data...\n');

    // Get all users
    const usersSnapshot = await db.collection('users').get();

    if (usersSnapshot.empty) {
      console.log('❌ No users found in database!\n');
      return;
    }

    console.log(`Found ${usersSnapshot.size} total users\n`);

    let migratedCount = 0;
    let alreadyCompleteCount = 0;
    let errorCount = 0;

    for (const userDoc of usersSnapshot.docs) {
      const userData = userDoc.data();
      const updates = {};
      const issues = [];

      // Check domain field
      if (!userData.domain || !['internal', 'external'].includes(userData.domain)) {
        const correctDomain = getUserDomain(userData.email);
        updates.domain = correctDomain;
        issues.push(`missing/invalid domain → setting to "${correctDomain}"`);
      }

      // Check assignedProjects field
      if (!Array.isArray(userData.assignedProjects)) {
        updates.assignedProjects = [];
        issues.push('missing assignedProjects → setting to []');
      }

      // Check permissions field
      if (typeof userData.permissions !== 'number') {
        updates.permissions = 0;
        issues.push('missing permissions → setting to 0');
      }

      // If no updates needed, user data is complete
      if (Object.keys(updates).length === 0) {
        console.log(`✅ ${userData.email} - data already complete`);
        alreadyCompleteCount++;
        continue;
      }

      // Apply migration
      try {
        // Add updatedAt timestamp to all migrations
        updates.updatedAt = admin.firestore.FieldValue.serverTimestamp();

        await db.collection('users').doc(userDoc.id).update(updates);

        console.log(`🔧 ${userData.email}`);
        issues.forEach(issue => console.log(`   └─ ${issue}`));
        migratedCount++;

      } catch (error) {
        console.error(`❌ ${userData.email} - MIGRATION FAILED`);
        console.error(`   Error: ${error.message}`);
        errorCount++;
      }
    }

    // Summary
    console.log('\n' + '='.repeat(80));
    console.log('📊 MIGRATION SUMMARY');
    console.log('='.repeat(80));
    console.log(`  Total Users:       ${usersSnapshot.size}`);
    console.log(`  ✅ Already Complete: ${alreadyCompleteCount}`);
    console.log(`  🔧 Migrated:         ${migratedCount}`);
    console.log(`  ❌ Errors:           ${errorCount}`);
    console.log('='.repeat(80));

    if (migratedCount > 0) {
      console.log('\n💡 NEXT STEPS:');
      console.log('   1. Cloud Function will automatically sync these changes to Auth claims');
      console.log('   2. Affected users should sign out and sign back in to see updates');
      console.log('   3. You can verify the migration using: node check-all-users-data.js\n');
    } else {
      console.log('\n✅ All users already have complete data. No migration needed!\n');
    }

  } catch (error) {
    console.error('\n❌ FATAL ERROR:', error);
    process.exit(1);
  }
}

// Run migration
migrateAllUsers()
  .then(() => {
    console.log('✅ Migration script completed successfully\n');
    process.exit(0);
  })
  .catch((error) => {
    console.error('❌ Migration script failed:', error);
    process.exit(1);
  });
