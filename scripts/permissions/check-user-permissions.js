const admin = require('firebase-admin');

// Initialize Firebase Admin
admin.initializeApp({
  projectId: 'vapour-toolbox',
});

const db = admin.firestore();

// Permission flags - must match the codebase
const PERMISSION_FLAGS = {
  MANAGE_USERS: 1,
  VIEW_ANALYTICS: 2,
  MANAGE_SETTINGS: 4,
  VIEW_PROJECTS: 16,
  MANAGE_PROJECTS: 8,
  VIEW_ENTITIES: 32,
  CREATE_ENTITIES: 64,
  EDIT_ENTITIES: 128,
  DELETE_ENTITIES: 256,
  VIEW_REPORTS: 8192,
  // ... more permissions
};

function hasPermission(permissions, flag) {
  return (permissions & flag) === flag;
}

function listPermissions(permissions) {
  const activePermissions = [];
  for (const [name, flag] of Object.entries(PERMISSION_FLAGS)) {
    if (hasPermission(permissions, flag)) {
      activePermissions.push(`${name} (${flag})`);
    }
  }
  return activePermissions;
}

async function checkUserPermissions(email) {
  try {
    console.log(`\n${'='.repeat(70)}`);
    console.log(`Checking permissions for: ${email}`);
    console.log('='.repeat(70) + '\n');

    // Get user by email
    const userRecord = await admin.auth().getUserByEmail(email);
    console.log(`Found in Auth: ${userRecord.uid}\n`);

    // Get user document from Firestore
    const userDoc = await db.collection('users').doc(userRecord.uid).get();

    if (!userDoc.exists) {
      console.log(`❌ ERROR: User document not found in Firestore`);
      return;
    }

    const userData = userDoc.data();
    const permissions = userData.permissions || 0;

    console.log(`📄 User Information:`);
    console.log(`   Email: ${userData.email}`);
    console.log(`   Display Name: ${userData.displayName}`);
    console.log(`   Roles: ${(userData.roles || []).join(', ')}`);
    console.log(`   Domain: ${userData.domain}`);
    console.log(`   isActive: ${userData.isActive}`);
    console.log(`   Status: ${userData.status}`);
    console.log(`   Permissions Value: ${permissions}\n`);

    console.log(`🔐 Active Permissions:`);
    const activePerms = listPermissions(permissions);
    if (activePerms.length === 0) {
      console.log(`   ❌ NO PERMISSIONS SET!\n`);
    } else {
      activePerms.forEach(perm => console.log(`   ✅ ${perm}`));
      console.log();
    }

    console.log(`📊 Entity Permissions Check:`);
    console.log(`   VIEW_ENTITIES (32): ${hasPermission(permissions, 32) ? '✅ YES' : '❌ NO'}`);
    console.log(`   CREATE_ENTITIES (64): ${hasPermission(permissions, 64) ? '✅ YES' : '❌ NO'}`);
    console.log(`   EDIT_ENTITIES (128): ${hasPermission(permissions, 128) ? '✅ YES' : '❌ NO'}`);
    console.log(`   DELETE_ENTITIES (256): ${hasPermission(permissions, 256) ? '✅ YES' : '❌ NO'}`);

    console.log(`\n💡 Result:`);
    if (hasPermission(permissions, 32)) {
      console.log(`   ✅ Can view entities list`);
    }
    if (hasPermission(permissions, 64)) {
      console.log(`   ✅ Can see "Add Entity" button and create entities`);
    } else {
      console.log(`   ❌ CANNOT see "Add Entity" button (missing CREATE_ENTITIES permission)`);
    }

    console.log('\n' + '='.repeat(70) + '\n');

  } catch (error) {
    console.error(`\n❌ Error:`, error.message);
  }
}

async function main() {
  await checkUserPermissions('kumaran@vapourdesal.com');
  process.exit(0);
}

main().catch((error) => {
  console.error('Fatal error:', error);
  process.exit(1);
});
