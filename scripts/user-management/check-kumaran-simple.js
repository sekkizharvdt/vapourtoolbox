const admin = require('firebase-admin');

// Initialize Firebase Admin
admin.initializeApp({
  projectId: 'vapour-toolbox',
});

const db = admin.firestore();

// Permission flags
const PERMISSION_FLAGS = {
  VIEW_ENTITIES: 32,
  CREATE_ENTITIES: 64,
  EDIT_ENTITIES: 128,
  DELETE_ENTITIES: 256,
};

function hasPermission(permissions, flag) {
  return (permissions & flag) === flag;
}

async function checkKumaran() {
  try {
    console.log('\n' + '='.repeat(70));
    console.log('Checking Kumaran\'s permissions');
    console.log('='.repeat(70) + '\n');

    // Query for Kumaran's user document
    const usersSnapshot = await db.collection('users')
      .where('email', '==', 'kumaran@vapourdesal.com')
      .limit(1)
      .get();

    if (usersSnapshot.empty) {
      console.log('❌ User not found');
      return;
    }

    const userDoc = usersSnapshot.docs[0];
    const userData = userDoc.data();
    const permissions = userData.permissions || 0;

    console.log(`📄 User: ${userData.displayName} (${userData.email})`);
    console.log(`   Roles: ${(userData.roles || []).join(', ')}`);
    console.log(`   Permissions Value: ${permissions}`);
    console.log(`   Permissions in Binary: ${permissions.toString(2).padStart(12, '0')}\n`);

    console.log(`🔐 Entity Permissions:`);
    console.log(`   VIEW_ENTITIES (32):   ${hasPermission(permissions, 32) ? '✅ YES' : '❌ NO'}`);
    console.log(`   CREATE_ENTITIES (64): ${hasPermission(permissions, 64) ? '✅ YES - Can see Add button' : '❌ NO - MISSING!'}`);
    console.log(`   EDIT_ENTITIES (128):  ${hasPermission(permissions, 128) ? '✅ YES' : '❌ NO'}`);
    console.log(`   DELETE_ENTITIES (256):${hasPermission(permissions, 256) ? '✅ YES' : '❌ NO'}`);

    if (!hasPermission(permissions, 64)) {
      console.log(`\n⚠️  PROBLEM FOUND:`);
      console.log(`   Kumaran is missing CREATE_ENTITIES (64) permission!`);
      console.log(`   This is why the "Add Entity" button is not visible.\n`);
      console.log(`💡 SOLUTION:`);
      console.log(`   1. Go to User Management`);
      console.log(`   2. Click Edit on Kumaran`);
      console.log(`   3. In the Entities row, check the "Manage" checkbox`);
      console.log(`   4. Click Save Changes\n`);
    }

    console.log('='.repeat(70) + '\n');

  } catch (error) {
    console.error('\n❌ Error:', error.message);
  }
}

checkKumaran()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error('Fatal error:', error);
    process.exit(1);
  });
