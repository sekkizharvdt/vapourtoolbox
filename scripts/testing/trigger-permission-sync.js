const admin = require('firebase-admin');

// Initialize Firebase Admin
admin.initializeApp({
  projectId: 'vapour-toolbox',
});

const db = admin.firestore();

// Role to permissions mapping (for display only)
const ROLE_PERMISSIONS = {
  SUPER_ADMIN: 0xFFFFFF, // 16,777,215 - All permissions
  DIRECTOR: 'Multiple permissions',
  HR_ADMIN: 'MANAGE_USERS, APPROVE_LEAVES, MANAGE_ON_DUTY',
  FINANCE_MANAGER: 'VIEW_REPORTS, CREATE_TRANSACTIONS, VIEW_ALL_PROJECTS',
  ACCOUNTANT: 'VIEW_REPORTS, CREATE_TRANSACTIONS',
  PROJECT_MANAGER: 'CREATE_PROJECTS, VIEW_ALL_PROJECTS, VIEW_REPORTS, GENERATE_TIMESHEETS, CREATE_PR, APPROVE_PR',
  ENGINEERING_HEAD: 'VIEW_ALL_PROJECTS, CREATE_ESTIMATES, APPROVE_ESTIMATES',
  ENGINEER: 'CREATE_ESTIMATES',
  PROCUREMENT_MANAGER: 'VIEW_ALL_PROJECTS, CREATE_PR, APPROVE_PR, CREATE_RFQ, CREATE_PO, APPROVE_PO',
  SITE_ENGINEER: 'CREATE_PR',
  TEAM_MEMBER: '0 (No special permissions)',
  CLIENT_PM: 'VIEW_PROCUREMENT, VIEW_PAYMENT_STATUS',
};

async function triggerPermissionSync() {
  try {
    console.log('\n' + '='.repeat(90));
    console.log('TRIGGERING CLOUD FUNCTION - Recalculate Permissions from Roles');
    console.log('='.repeat(90) + '\n');

    const usersSnapshot = await db.collection('users').get();

    console.log(`Found ${usersSnapshot.size} users\n`);

    let successCount = 0;
    let errorCount = 0;

    for (const userDoc of usersSnapshot.docs) {
      const userData = userDoc.data();

      try {
        // Trigger Cloud Function by updating the roles array
        // The function checks for roles changes, so we update roles with same value
        // but use array assignment to ensure Firestore detects the change
        const currentRoles = userData.roles || [];
        await db.collection('users').doc(userDoc.id).update({
          roles: admin.firestore.FieldValue.delete(),
        });

        // Small delay to ensure the delete registers
        await new Promise(resolve => setTimeout(resolve, 100));

        // Restore the roles - this will trigger the function with rolesChanged=true
        await db.collection('users').doc(userDoc.id).update({
          roles: currentRoles,
        });

        const roles = (userData.roles || []).join(', ') || 'NONE';
        const expectedPerms = userData.roles?.map(role => ROLE_PERMISSIONS[role] || 'Unknown').join(' | ') || 'None';

        console.log(`✅ ${userData.email}`);
        console.log(`   Roles: ${roles}`);
        console.log(`   Will Calculate: ${expectedPerms}\n`);

        successCount++;

        // Small delay to avoid overwhelming Firebase
        await new Promise(resolve => setTimeout(resolve, 100));

      } catch (error) {
        console.error(`❌ ${userData.email} - Error: ${error.message}\n`);
        errorCount++;
      }
    }

    console.log('='.repeat(90));
    console.log('SUMMARY:');
    console.log(`  ✅ Triggered: ${successCount}`);
    console.log(`  ❌ Errors: ${errorCount}`);
    console.log('='.repeat(90));

    console.log('\n💡 NEXT STEPS:');
    console.log('   1. Wait ~30 seconds for Cloud Function to process all users');
    console.log('   2. Run: node check-all-permissions.js to verify');
    console.log('   3. ALL USERS must SIGN OUT and SIGN BACK IN to refresh tokens');
    console.log('   4. After sign-in, users will have correct role-based permissions\n');

  } catch (error) {
    console.error('\n❌ Error:', error);
    process.exit(1);
  }
}

triggerPermissionSync()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error('Fatal error:', error);
    process.exit(1);
  });
