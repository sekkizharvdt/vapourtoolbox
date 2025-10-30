const admin = require('firebase-admin');

// Initialize Firebase Admin
admin.initializeApp({
  projectId: 'vapour-toolbox',
});

const db = admin.firestore();

// All permission flags
const PERMISSIONS = {
  MANAGE_USERS: 1,
  VIEW_USERS: 2,
  MANAGE_ROLES: 4,
  MANAGE_PROJECTS: 8,
  VIEW_PROJECTS: 16,
  VIEW_ENTITIES: 32,
  CREATE_ENTITIES: 64,
  EDIT_ENTITIES: 128,
  DELETE_ENTITIES: 256,
  MANAGE_COMPANY_SETTINGS: 512,
  VIEW_ANALYTICS: 1024,
  EXPORT_DATA: 2048,
  MANAGE_TIME_TRACKING: 4096,
  VIEW_TIME_TRACKING: 8192,
  MANAGE_ACCOUNTING: 16384,
  VIEW_ACCOUNTING: 32768,
  MANAGE_PROCUREMENT: 65536,
  VIEW_PROCUREMENT: 131072,
  MANAGE_ESTIMATION: 262144,
  VIEW_ESTIMATION: 524288,
};

function hasPermission(permissions, flag) {
  return (permissions & flag) === flag;
}

function listActivePermissions(permissions) {
  const active = [];
  for (const [name, flag] of Object.entries(PERMISSIONS)) {
    if (hasPermission(permissions, flag)) {
      active.push(name);
    }
  }
  return active;
}

async function checkAllPermissions() {
  try {
    console.log('\n' + '='.repeat(90));
    console.log('DETAILED PERMISSION AUDIT - ALL USERS');
    console.log('='.repeat(90) + '\n');

    const usersSnapshot = await db.collection('users').get();

    for (const userDoc of usersSnapshot.docs) {
      const userData = userDoc.data();
      const permissions = userData.permissions || 0;
      const activePerms = listActivePermissions(permissions);

      console.log(`\n${'─'.repeat(90)}`);
      console.log(`👤 ${userData.displayName} (${userData.email})`);
      console.log(`${'─'.repeat(90)}`);
      console.log(`   Status: ${userData.status} | Active: ${userData.isActive} | Domain: ${userData.domain || 'NOT SET'}`);
      console.log(`   Roles: ${(userData.roles || []).join(', ') || 'NONE'}`);
      console.log(`   Permission Value: ${permissions} (binary: ${permissions.toString(2).padStart(20, '0')})`);

      if (activePerms.length === 0) {
        console.log(`   ❌ NO PERMISSIONS!`);
      } else {
        console.log(`   ✅ Active Permissions (${activePerms.length}):`);
        activePerms.forEach(perm => {
          console.log(`      • ${perm} (${PERMISSIONS[perm]})`);
        });
      }

      // Check critical permissions
      const critical = {
        'View Users': hasPermission(permissions, 2),
        'Manage Users': hasPermission(permissions, 1),
        'View Projects': hasPermission(permissions, 16),
        'Manage Projects': hasPermission(permissions, 8),
        'View Entities': hasPermission(permissions, 32),
        'Create Entities': hasPermission(permissions, 64),
      };

      console.log(`   📊 Critical Access Checks:`);
      for (const [check, has] of Object.entries(critical)) {
        console.log(`      ${has ? '✅' : '❌'} ${check}`);
      }
    }

    console.log('\n' + '='.repeat(90));
    console.log('ANALYSIS COMPLETE');
    console.log('='.repeat(90) + '\n');

  } catch (error) {
    console.error('\n❌ Error:', error);
    process.exit(1);
  }
}

checkAllPermissions()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error('Fatal error:', error);
    process.exit(1);
  });
