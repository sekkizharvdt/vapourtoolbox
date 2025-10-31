/**
 * Permission Audit Script
 *
 * Purpose: Validate that all users' permissions match their role definitions
 *
 * This script:
 * 1. Queries all users from Firestore
 * 2. Calculates expected permissions from their roles
 * 3. Reports any mismatches between actual and expected permissions
 * 4. Can be run periodically to catch permission drift
 *
 * Usage: node scripts/audit-permissions.js
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

// Format permission as binary string
function formatPermissions(permissions) {
  return `${permissions} (0b${permissions.toString(2).padStart(26, '0')})`;
}

// Find missing permissions (bits in expected but not in actual)
function getMissingPermissions(actual, expected) {
  return expected & ~actual;
}

// Find extra permissions (bits in actual but not in expected)
function getExtraPermissions(actual, expected) {
  return actual & ~expected;
}

// Get permission names from bitmask
function getPermissionNames(permissionMask) {
  const names = [];
  for (const [name, value] of Object.entries(PERMISSION_FLAGS)) {
    if (permissionMask & value) {
      names.push(name);
    }
  }
  return names;
}

// Main audit function
async function auditPermissions() {
  console.log('='.repeat(80));
  console.log('PERMISSION AUDIT REPORT');
  console.log('='.repeat(80));
  console.log(`Generated: ${new Date().toISOString()}`);
  console.log('');

  try {
    // Fetch all users
    console.log('📥 Fetching all users from Firestore...');
    const usersSnapshot = await db.collection('users').get();
    console.log(`Found ${usersSnapshot.size} users\n`);

    const stats = {
      total: usersSnapshot.size,
      checked: 0,
      matching: 0,
      mismatched: 0,
      noRoles: 0,
      noPermissions: 0,
    };

    const mismatches = [];

    // Process each user
    for (const doc of usersSnapshot.docs) {
      const userId = doc.id;
      const userData = doc.data();
      stats.checked++;

      // Skip if no email
      if (!userData.email) {
        stats.noRoles++;
        continue;
      }

      // Skip if no roles
      const roles = userData.roles || [];
      if (!Array.isArray(roles) || roles.length === 0) {
        stats.noRoles++;
        continue;
      }

      // Calculate expected permissions
      const expectedPermissions = calculatePermissionsFromRoles(roles);
      const currentPermissions = userData.permissions;

      // Check if permissions field is missing
      if (currentPermissions === undefined || currentPermissions === null) {
        stats.noPermissions++;
        mismatches.push({
          email: userData.email,
          roles,
          currentPermissions: 0,
          expectedPermissions,
          missing: expectedPermissions,
          extra: 0,
          severity: 'CRITICAL',
        });
        continue;
      }

      // Check for mismatch
      if (currentPermissions !== expectedPermissions) {
        stats.mismatched++;

        const missing = getMissingPermissions(currentPermissions, expectedPermissions);
        const extra = getExtraPermissions(currentPermissions, expectedPermissions);

        mismatches.push({
          email: userData.email,
          roles,
          currentPermissions,
          expectedPermissions,
          missing,
          extra,
          severity: missing > 0 ? 'ERROR' : 'WARNING',
        });
      } else {
        stats.matching++;
      }
    }

    // Summary
    console.log('='.repeat(80));
    console.log('AUDIT SUMMARY');
    console.log('='.repeat(80));
    console.log(`Total users:           ${stats.total}`);
    console.log(`Checked:               ${stats.checked}`);
    console.log(`No roles:              ${stats.noRoles}`);
    console.log(`No permissions field:  ${stats.noPermissions}`);
    console.log(`Matching:              ${stats.matching} ✅`);
    console.log(`Mismatched:            ${stats.mismatched} ${stats.mismatched > 0 ? '❌' : ''}`);
    console.log('');

    if (mismatches.length > 0) {
      console.log('='.repeat(80));
      console.log('MISMATCHED PERMISSIONS');
      console.log('='.repeat(80));
      console.log('');

      mismatches.forEach((mismatch) => {
        console.log(
          `${mismatch.severity === 'CRITICAL' ? '🔴' : mismatch.severity === 'ERROR' ? '❌' : '⚠️'} ${mismatch.email}`
        );
        console.log(`   Roles: ${mismatch.roles.join(', ')}`);
        console.log(`   Current:  ${formatPermissions(mismatch.currentPermissions)}`);
        console.log(`   Expected: ${formatPermissions(mismatch.expectedPermissions)}`);

        if (mismatch.missing > 0) {
          const missingNames = getPermissionNames(mismatch.missing);
          console.log(`   Missing:  ${formatPermissions(mismatch.missing)}`);
          console.log(`             ${missingNames.join(', ')}`);
        }

        if (mismatch.extra > 0) {
          const extraNames = getPermissionNames(mismatch.extra);
          console.log(`   Extra:    ${formatPermissions(mismatch.extra)}`);
          console.log(`             ${extraNames.join(', ')}`);
        }

        console.log('');
      });

      console.log('='.repeat(80));
      console.log('RECOMMENDATIONS');
      console.log('='.repeat(80));
      console.log('');
      console.log('To fix permission mismatches, run the migration script:');
      console.log('  node scripts/migrate-permissions.js --dry-run    (preview changes)');
      console.log('  node scripts/migrate-permissions.js              (apply changes)');
      console.log('');
    } else {
      console.log('✅ All user permissions are in sync with role definitions!');
      console.log('');
    }

    console.log(`Audit completed: ${new Date().toISOString()}`);
  } catch (error) {
    console.error('\n❌ Audit failed:', error);
    process.exit(1);
  } finally {
    process.exit(0);
  }
}

// Run audit
auditPermissions();
