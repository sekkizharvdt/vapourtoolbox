const admin = require('firebase-admin');

// Initialize Firebase Admin
admin.initializeApp({
  projectId: 'vapour-toolbox',
});

const db = admin.firestore();

function getUserDomain(email) {
  return email.endsWith('@vapourdesal.com') ? 'internal' : 'external';
}

async function fixAllUsersDomain() {
  try {
    console.log('\n' + '='.repeat(70));
    console.log('Fixing domain field for ALL users');
    console.log('='.repeat(70) + '\n');

    // Get all users
    const usersSnapshot = await db.collection('users').get();

    console.log(`Found ${usersSnapshot.size} users to fix\n`);

    let successCount = 0;
    let errorCount = 0;
    let alreadySetCount = 0;

    for (const userDoc of usersSnapshot.docs) {
      const userData = userDoc.data();
      const correctDomain = getUserDomain(userData.email);

      try {
        // Check if domain already set correctly
        if (userData.domain === correctDomain) {
          console.log(`⏭️  Skipping ${userData.email} - domain already set to "${correctDomain}"`);
          alreadySetCount++;
          continue;
        }

        // Update the domain field directly
        await db.collection('users').doc(userDoc.id).update({
          domain: correctDomain,
          updatedAt: admin.firestore.FieldValue.serverTimestamp(),
        });

        console.log(`✅ Updated ${userData.email} - domain set to "${correctDomain}"`);
        successCount++;

      } catch (error) {
        console.error(`❌ Error updating ${userData.email}:`, error.message);
        errorCount++;
      }
    }

    console.log('\n' + '='.repeat(70));
    console.log(`Summary:`);
    console.log(`  ✅ Updated: ${successCount}`);
    console.log(`  ⏭️  Already Set: ${alreadySetCount}`);
    console.log(`  ❌ Errors: ${errorCount}`);
    console.log('='.repeat(70));
    console.log('\n✅ Done! Refresh your browser and try creating a project again.\n');

  } catch (error) {
    console.error('\n❌ Fatal error:', error);
  }
}

fixAllUsersDomain()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error('Fatal error:', error);
    process.exit(1);
  });
