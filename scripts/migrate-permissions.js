/**
 * Permission Migration Script
 *
 * Purpose: Update all users' permissions to match current role definitions
 *
 * This script:
 * 1. Queries all users from Firestore
 * 2. Recalculates permissions from their roles using current definitions
 * 3. Updates users whose permissions don't match expected values
 * 4. Logs all changes for audit trail
 *
 * Usage: node scripts/migrate-permissions.js [--dry-run]
 */

const admin = require('firebase-admin');

// Initialize Firebase Admin
if (!admin.apps.length) {
  admin.initializeApp();
}

const db = admin.firestore();

// ============================================================================
// PERMISSION DEFINITIONS - Must match functions/src/userManagement.ts
// ============================================================================

const PERMISSION_FLAGS = {
  // User Management (bits 0-2)
  MANAGE_USERS: 1 << 0,
  VIEW_USERS: 1 << 1,
  MANAGE_ROLES: 1 << 2,

  // Project Management (bits 3-4)
  MANAGE_PROJECTS: 1 << 3,
  VIEW_PROJECTS: 1 << 4,

  // Entity Management (bits 5-8)
  VIEW_ENTITIES: 1 << 5,
  CREATE_ENTITIES: 1 << 6,
  EDIT_ENTITIES: 1 << 7,
  DELETE_ENTITIES: 1 << 8,

  // Company Settings (bit 9)
  MANAGE_COMPANY_SETTINGS: 1 << 9,

  // Analytics & Reporting (bits 10-11)
  VIEW_ANALYTICS: 1 << 10,
  EXPORT_DATA: 1 << 11,

  // Time Tracking (bits 12-13)
  MANAGE_TIME_TRACKING: 1 << 12,
  VIEW_TIME_TRACKING: 1 << 13,

  // Accounting (bits 14-15)
  MANAGE_ACCOUNTING: 1 << 14,
  VIEW_ACCOUNTING: 1 << 15,

  // Procurement (bits 16-17)
  MANAGE_PROCUREMENT: 1 << 16,
  VIEW_PROCUREMENT: 1 << 17,

  // Estimation (bits 18-19)
  MANAGE_ESTIMATION: 1 << 18,
  VIEW_ESTIMATION: 1 << 19,

  // Granular Accounting Permissions (bits 20-25)
  MANAGE_CHART_OF_ACCOUNTS: 1 << 20,
  CREATE_TRANSACTIONS: 1 << 21,
  APPROVE_TRANSACTIONS: 1 << 22,
  VIEW_FINANCIAL_REPORTS: 1 << 23,
  MANAGE_COST_CENTRES: 1 << 24,
  MANAGE_FOREX: 1 << 25,
};

// Helper to get all permissions
function getAllPermissions() {
  return Object.values(PERMISSION_FLAGS).reduce((acc, perm) => acc | perm, 0);
}

// Role to Permissions Mapping
const ROLE_PERMISSIONS = {
  SUPER_ADMIN: getAllPermissions(),

  DIRECTOR:
    PERMISSION_FLAGS.MANAGE_USERS |
    PERMISSION_FLAGS.VIEW_USERS |
    PERMISSION_FLAGS.MANAGE_ROLES |
    PERMISSION_FLAGS.MANAGE_PROJECTS |
    PERMISSION_FLAGS.VIEW_PROJECTS |
    PERMISSION_FLAGS.VIEW_ENTITIES |
    PERMISSION_FLAGS.CREATE_ENTITIES |
    PERMISSION_FLAGS.EDIT_ENTITIES |
    PERMISSION_FLAGS.MANAGE_COMPANY_SETTINGS |
    PERMISSION_FLAGS.VIEW_ANALYTICS |
    PERMISSION_FLAGS.EXPORT_DATA |
    PERMISSION_FLAGS.MANAGE_TIME_TRACKING |
    PERMISSION_FLAGS.VIEW_TIME_TRACKING |
    PERMISSION_FLAGS.MANAGE_ACCOUNTING |
    PERMISSION_FLAGS.VIEW_ACCOUNTING |
    PERMISSION_FLAGS.MANAGE_PROCUREMENT |
    PERMISSION_FLAGS.VIEW_PROCUREMENT |
    PERMISSION_FLAGS.MANAGE_ESTIMATION |
    PERMISSION_FLAGS.VIEW_ESTIMATION |
    PERMISSION_FLAGS.MANAGE_CHART_OF_ACCOUNTS |
    PERMISSION_FLAGS.CREATE_TRANSACTIONS |
    PERMISSION_FLAGS.APPROVE_TRANSACTIONS |
    PERMISSION_FLAGS.VIEW_FINANCIAL_REPORTS |
    PERMISSION_FLAGS.MANAGE_COST_CENTRES |
    PERMISSION_FLAGS.MANAGE_FOREX,

  HR_ADMIN:
    PERMISSION_FLAGS.MANAGE_USERS | PERMISSION_FLAGS.VIEW_USERS | PERMISSION_FLAGS.MANAGE_ROLES,

  FINANCE_MANAGER:
    PERMISSION_FLAGS.VIEW_PROJECTS |
    PERMISSION_FLAGS.VIEW_ANALYTICS |
    PERMISSION_FLAGS.EXPORT_DATA |
    PERMISSION_FLAGS.VIEW_TIME_TRACKING |
    PERMISSION_FLAGS.MANAGE_ACCOUNTING |
    PERMISSION_FLAGS.VIEW_ACCOUNTING |
    PERMISSION_FLAGS.MANAGE_CHART_OF_ACCOUNTS |
    PERMISSION_FLAGS.CREATE_TRANSACTIONS |
    PERMISSION_FLAGS.APPROVE_TRANSACTIONS |
    PERMISSION_FLAGS.VIEW_FINANCIAL_REPORTS |
    PERMISSION_FLAGS.MANAGE_COST_CENTRES |
    PERMISSION_FLAGS.MANAGE_FOREX,

  ACCOUNTANT:
    PERMISSION_FLAGS.VIEW_TIME_TRACKING |
    PERMISSION_FLAGS.VIEW_ACCOUNTING |
    PERMISSION_FLAGS.CREATE_TRANSACTIONS |
    PERMISSION_FLAGS.VIEW_FINANCIAL_REPORTS,

  PROJECT_MANAGER:
    PERMISSION_FLAGS.MANAGE_PROJECTS |
    PERMISSION_FLAGS.VIEW_PROJECTS |
    PERMISSION_FLAGS.VIEW_ENTITIES |
    PERMISSION_FLAGS.VIEW_ANALYTICS |
    PERMISSION_FLAGS.VIEW_TIME_TRACKING |
    PERMISSION_FLAGS.MANAGE_PROCUREMENT |
    PERMISSION_FLAGS.VIEW_PROCUREMENT,

  ENGINEERING_HEAD:
    PERMISSION_FLAGS.VIEW_PROJECTS |
    PERMISSION_FLAGS.VIEW_ENTITIES |
    PERMISSION_FLAGS.MANAGE_ESTIMATION |
    PERMISSION_FLAGS.VIEW_ESTIMATION,

  ENGINEER: PERMISSION_FLAGS.VIEW_ESTIMATION,

  PROCUREMENT_MANAGER:
    PERMISSION_FLAGS.VIEW_PROJECTS |
    PERMISSION_FLAGS.VIEW_ENTITIES |
    PERMISSION_FLAGS.CREATE_ENTITIES |
    PERMISSION_FLAGS.EDIT_ENTITIES |
    PERMISSION_FLAGS.MANAGE_PROCUREMENT |
    PERMISSION_FLAGS.VIEW_PROCUREMENT |
    PERMISSION_FLAGS.MANAGE_ESTIMATION |
    PERMISSION_FLAGS.VIEW_ESTIMATION,

  SITE_ENGINEER: PERMISSION_FLAGS.VIEW_PROCUREMENT,

  TEAM_MEMBER: 0,

  CLIENT_PM: PERMISSION_FLAGS.VIEW_PROCUREMENT,
};

// Calculate permissions from roles
function calculatePermissionsFromRoles(roles) {
  let permissions = 0;
  for (const role of roles) {
    const rolePermissions = ROLE_PERMISSIONS[role];
    if (rolePermissions !== undefined) {
      permissions |= rolePermissions;
    }
  }
  return permissions;
}

// Format permission as binary string for readability
function formatPermissions(permissions) {
  return `${permissions} (0b${permissions.toString(2).padStart(26, '0')})`;
}

// Main migration function
async function migratePermissions() {
  const dryRun = process.argv.includes('--dry-run');

  console.log('='.repeat(80));
  console.log('PERMISSION MIGRATION SCRIPT');
  console.log('='.repeat(80));
  console.log(
    `Mode: ${dryRun ? 'DRY RUN (no changes will be made)' : 'LIVE (will update Firestore)'}`
  );
  console.log(`Started: ${new Date().toISOString()}`);
  console.log('');

  try {
    // Fetch all users
    console.log('📥 Fetching all users from Firestore...');
    const usersSnapshot = await db.collection('users').get();
    console.log(`Found ${usersSnapshot.size} users\n`);

    const stats = {
      total: usersSnapshot.size,
      checked: 0,
      needsUpdate: 0,
      updated: 0,
      noRoles: 0,
      errors: 0,
    };

    const changes = [];

    // Process each user
    for (const doc of usersSnapshot.docs) {
      const userId = doc.id;
      const userData = doc.data();
      stats.checked++;

      // Skip if no email
      if (!userData.email) {
        console.log(`⚠️  [${userId}] Skipping - no email`);
        stats.noRoles++;
        continue;
      }

      // Skip if no roles
      const roles = userData.roles || [];
      if (!Array.isArray(roles) || roles.length === 0) {
        console.log(`⚠️  [${userData.email}] No roles - skipping`);
        stats.noRoles++;
        continue;
      }

      // Calculate expected permissions from roles
      const expectedPermissions = calculatePermissionsFromRoles(roles);
      const currentPermissions = userData.permissions || 0;

      // Check if permissions need updating
      if (currentPermissions !== expectedPermissions) {
        stats.needsUpdate++;

        const change = {
          userId,
          email: userData.email,
          roles,
          currentPermissions,
          expectedPermissions,
          difference: expectedPermissions - currentPermissions,
        };
        changes.push(change);

        console.log(`\n🔄 [${userData.email}]`);
        console.log(`   Roles: ${roles.join(', ')}`);
        console.log(`   Current:  ${formatPermissions(currentPermissions)}`);
        console.log(`   Expected: ${formatPermissions(expectedPermissions)}`);
        console.log(`   Diff:     ${change.difference >= 0 ? '+' : ''}${change.difference}`);

        if (!dryRun) {
          try {
            // Update Firestore - this will trigger the Cloud Function
            await db.collection('users').doc(userId).update({
              permissions: expectedPermissions,
              permissionMigratedAt: admin.firestore.FieldValue.serverTimestamp(),
            });
            stats.updated++;
            console.log(`   ✅ Updated`);
          } catch (error) {
            stats.errors++;
            console.error(`   ❌ Error updating: ${error.message}`);
          }
        } else {
          console.log(`   🔍 Would update (dry-run mode)`);
        }
      }
    }

    // Summary
    console.log('\n' + '='.repeat(80));
    console.log('MIGRATION SUMMARY');
    console.log('='.repeat(80));
    console.log(`Total users:          ${stats.total}`);
    console.log(`Checked:              ${stats.checked}`);
    console.log(`No roles:             ${stats.noRoles}`);
    console.log(`Needs update:         ${stats.needsUpdate}`);
    if (!dryRun) {
      console.log(`Successfully updated: ${stats.updated}`);
      console.log(`Errors:               ${stats.errors}`);
    }
    console.log('');

    if (changes.length > 0) {
      console.log('DETAILED CHANGES:');
      console.log('-'.repeat(80));
      changes.forEach((change) => {
        console.log(`${change.email}`);
        console.log(`  Roles: ${change.roles.join(', ')}`);
        console.log(
          `  ${formatPermissions(change.currentPermissions)} → ${formatPermissions(change.expectedPermissions)}`
        );
      });
      console.log('');
    }

    if (dryRun && stats.needsUpdate > 0) {
      console.log('⚠️  This was a DRY RUN. To apply changes, run without --dry-run flag:');
      console.log('   node scripts/migrate-permissions.js');
    }

    if (!dryRun && stats.updated > 0) {
      console.log('✅ Migration complete!');
      console.log('');
      console.log(
        '📝 Note: The Cloud Function will automatically sync these changes to Firebase Auth custom claims.'
      );
      console.log('   Users will need to log out and log back in to see the updated permissions.');
    }

    console.log(`\nCompleted: ${new Date().toISOString()}`);
  } catch (error) {
    console.error('\n❌ Migration failed:', error);
    process.exit(1);
  } finally {
    process.exit(0);
  }
}

// Run migration
migratePermissions();
