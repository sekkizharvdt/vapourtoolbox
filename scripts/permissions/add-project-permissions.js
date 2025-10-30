const admin = require('firebase-admin');

// Initialize Firebase Admin
admin.initializeApp({
  projectId: 'vapour-toolbox',
});

const db = admin.firestore();

// Permission flags
const VIEW_PROJECTS = 16;
const MANAGE_PROJECTS = 8;

function hasPermission(permissions, flag) {
  return (permissions & flag) === flag;
}

async function addProjectPermissionsToAllUsers() {
  try {
    console.log('\n' + '='.repeat(80));
    console.log('Adding VIEW_PROJECTS Permission to All Active Internal Users');
    console.log('='.repeat(80) + '\n');

    // Get all active internal users
    const usersSnapshot = await db.collection('users')
      .where('domain', '==', 'internal')
      .where('isActive', '==', true)
      .get();

    if (usersSnapshot.empty) {
      console.log('❌ No active internal users found!\n');
      return;
    }

    console.log(`Found ${usersSnapshot.size} active internal users\n`);

    let updatedCount = 0;
    let alreadyHadCount = 0;

    for (const userDoc of usersSnapshot.docs) {
      const userData = userDoc.data();
      const currentPermissions = userData.permissions || 0;

      // Check if user already has VIEW_PROJECTS permission
      if (hasPermission(currentPermissions, VIEW_PROJECTS)) {
        console.log(`✓ ${userData.email} - already has VIEW_PROJECTS`);
        alreadyHadCount++;
        continue;
      }

      // Add VIEW_PROJECTS permission
      const newPermissions = currentPermissions | VIEW_PROJECTS;

      await db.collection('users').doc(userDoc.id).update({
        permissions: newPermissions,
        updatedAt: admin.firestore.FieldValue.serverTimestamp(),
      });

      console.log(`✅ ${userData.email}`);
      console.log(`   Before: ${currentPermissions} (binary: ${currentPermissions.toString(2).padStart(10, '0')})`);
      console.log(`   After:  ${newPermissions} (binary: ${newPermissions.toString(2).padStart(10, '0')})`);
      console.log(`   Added: VIEW_PROJECTS (16)\n`);
      updatedCount++;
    }

    console.log('='.repeat(80));
    console.log('SUMMARY:');
    console.log(`  ✅ Updated: ${updatedCount}`);
    console.log(`  ✓ Already Had Permission: ${alreadyHadCount}`);
    console.log('='.repeat(80));

    if (updatedCount > 0) {
      console.log('\n💡 NEXT STEPS:');
      console.log('   1. Cloud Function will sync these permissions to Auth claims');
      console.log('   2. Users must SIGN OUT and SIGN BACK IN to see the changes');
      console.log('   3. After signing back in, users can view projects\n');
    }

  } catch (error) {
    console.error('\n❌ Error:', error);
    process.exit(1);
  }
}

addProjectPermissionsToAllUsers()
  .then(() => {
    console.log('✅ Script completed successfully\n');
    process.exit(0);
  })
  .catch((error) => {
    console.error('❌ Script failed:', error);
    process.exit(1);
  });
