const admin = require('firebase-admin');

// Initialize Firebase Admin
admin.initializeApp({
  projectId: 'vapour-toolbox',
});

const db = admin.firestore();

async function updateAllUsersDomain() {
  try {
    console.log('\n' + '='.repeat(60));
    console.log('Updating all users to trigger domain field population');
    console.log('='.repeat(60) + '\n');

    // Get all users
    const usersSnapshot = await db.collection('users').get();

    console.log(`Found ${usersSnapshot.size} users to update\n`);

    let successCount = 0;
    let errorCount = 0;

    for (const userDoc of usersSnapshot.docs) {
      const userData = userDoc.data();
      try {
        // Simply update the updatedAt timestamp, which will trigger the Cloud Function
        await db.collection('users').doc(userDoc.id).update({
          updatedAt: admin.firestore.FieldValue.serverTimestamp(),
        });

        console.log(`✅ Triggered update for: ${userData.email}`);
        successCount++;

        // Wait a bit between updates to avoid overwhelming the function
        await new Promise(resolve => setTimeout(resolve, 500));
      } catch (error) {
        console.error(`❌ Error updating ${userData.email}:`, error.message);
        errorCount++;
      }
    }

    console.log('\n' + '='.repeat(60));
    console.log(`Summary:`);
    console.log(`  ✅ Success: ${successCount}`);
    console.log(`  ❌ Errors: ${errorCount}`);
    console.log('='.repeat(60));
    console.log('\n⏳ Wait 5-10 seconds for Cloud Function to process all updates');
    console.log('   Then refresh your browser and try creating a project again.\n');

  } catch (error) {
    console.error('\n❌ Fatal error:', error);
  }
}

updateAllUsersDomain()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error('Fatal error:', error);
    process.exit(1);
  });
