const admin = require('firebase-admin');

// Initialize Firebase Admin
admin.initializeApp({
  projectId: 'vapour-toolbox',
});

const db = admin.firestore();

async function resetPermissionsToRoles() {
  try {
    console.log('\n' + '='.repeat(80));
    console.log('RESETTING PERMISSIONS - Will Be Recalculated from Roles');
    console.log('='.repeat(80) + '\n');

    const usersSnapshot = await db.collection('users').get();

    console.log(`Found ${usersSnapshot.size} users\n`);

    const batch = db.batch();
    let count = 0;

    for (const userDoc of usersSnapshot.docs) {
      const userData = userDoc.data();

      // Delete the permissions field - Cloud Function will recalculate from roles
      batch.update(userDoc.ref, {
        permissions: admin.firestore.FieldValue.delete(),
        updatedAt: admin.firestore.FieldValue.serverTimestamp(),
      });

      console.log(`✅ ${userData.email} - permissions field will be removed`);
      count++;
    }

    await batch.commit();

    console.log('\n' + '='.repeat(80));
    console.log(`SUMMARY: Cleared permissions field for ${count} users`);
    console.log('='.repeat(80));
    console.log('\n💡 NEXT STEP:');
    console.log('   Run trigger-permission-sync.js to recalculate permissions from roles\n');

  } catch (error) {
    console.error('\n❌ Error:', error);
    process.exit(1);
  }
}

resetPermissionsToRoles()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error('Fatal error:', error);
    process.exit(1);
  });
