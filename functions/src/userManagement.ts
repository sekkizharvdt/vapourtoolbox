import { onDocumentWritten } from 'firebase-functions/v2/firestore';
import type { FirestoreEvent, Change } from 'firebase-functions/v2/firestore';
import type { DocumentSnapshot } from 'firebase-admin/firestore';
import { FieldValue } from 'firebase-admin/firestore';
import * as admin from 'firebase-admin';
import {
  auditUserAction,
  auditRoleChange,
  auditPermissionChange,
  calculateFieldChanges,
} from './utils/audit';

/**
 * =====================================================================================
 * IMPORTANT: Permission definitions copied from packages/constants/src/permissions.ts
 * =====================================================================================
 *
 * SINGLE SOURCE OF TRUTH: packages/constants/src/permissions.ts
 *
 * These values MUST be kept in sync with the client application.
 * Any changes to permissions MUST be made in packages/constants first,
 * then copied here.
 *
 * TODO: Set up build process to auto-copy or bundle shared constants
 * =====================================================================================
 */

// Permission flags - MUST match packages/constants/src/permissions.ts EXACTLY
const PERMISSION_FLAGS = {
  // User Management (bits 0-2)
  MANAGE_USERS: 1 << 0, // 1
  VIEW_USERS: 1 << 1, // 2
  MANAGE_ROLES: 1 << 2, // 4

  // Project Management (bits 3-4)
  MANAGE_PROJECTS: 1 << 3, // 8
  VIEW_PROJECTS: 1 << 4, // 16

  // Entity Management (bits 5-8)
  VIEW_ENTITIES: 1 << 5, // 32
  CREATE_ENTITIES: 1 << 6, // 64
  EDIT_ENTITIES: 1 << 7, // 128
  DELETE_ENTITIES: 1 << 8, // 256

  // Company Settings (bit 9)
  MANAGE_COMPANY_SETTINGS: 1 << 9, // 512

  // Analytics & Reporting (bits 10-11)
  VIEW_ANALYTICS: 1 << 10, // 1024
  EXPORT_DATA: 1 << 11, // 2048

  // Time Tracking (bits 12-13)
  MANAGE_TIME_TRACKING: 1 << 12, // 4096
  VIEW_TIME_TRACKING: 1 << 13, // 8192

  // Accounting (bits 14-15)
  MANAGE_ACCOUNTING: 1 << 14, // 16384
  VIEW_ACCOUNTING: 1 << 15, // 32768

  // Procurement (bits 16-17)
  MANAGE_PROCUREMENT: 1 << 16, // 65536
  VIEW_PROCUREMENT: 1 << 17, // 131072

  // Estimation (bits 18-19)
  MANAGE_ESTIMATION: 1 << 18, // 262144
  VIEW_ESTIMATION: 1 << 19, // 524288

  // Granular Accounting Permissions (bits 20-25)
  MANAGE_CHART_OF_ACCOUNTS: 1 << 20, // 1048576 - Create/edit accounts
  CREATE_TRANSACTIONS: 1 << 21, // 2097152 - Create transactions
  APPROVE_TRANSACTIONS: 1 << 22, // 4194304 - Approve transactions
  VIEW_FINANCIAL_REPORTS: 1 << 23, // 8388608 - View P&L, Balance Sheet, etc.
  MANAGE_COST_CENTRES: 1 << 24, // 16777216 - Manage project cost centres
  MANAGE_FOREX: 1 << 25, // 33554432 - Manage currency and forex settings
};

// Helper to get all permissions (for SUPER_ADMIN)
function getAllPermissions(): number {
  return Object.values(PERMISSION_FLAGS).reduce((acc, perm) => acc | perm, 0);
}

// Role to Permissions Mapping - MUST match packages/constants/src/permissions.ts EXACTLY
const ROLE_PERMISSIONS: Record<string, number> = {
  SUPER_ADMIN: getAllPermissions(), // All permissions

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

  TEAM_MEMBER: 0, // No special permissions

  CLIENT_PM: PERMISSION_FLAGS.VIEW_PROCUREMENT,
};

// Calculate combined permissions from multiple roles
function calculatePermissionsFromRoles(roles: string[]): number {
  let permissions = 0;
  for (const role of roles) {
    const rolePermissions = ROLE_PERMISSIONS[role];
    if (rolePermissions !== undefined) {
      permissions |= rolePermissions;
    }
  }
  return permissions;
}

/**
 * Determine user domain based on email
 */
function getUserDomain(email: string): 'internal' | 'external' {
  return email.endsWith('@vapourdesal.com') ? 'internal' : 'external';
}

/**
 * Cloud Function: Automatically update custom claims when user document changes
 *
 * This function triggers whenever a user document is created or updated in Firestore.
 * It syncs the user's roles and permissions to Firebase Authentication custom claims.
 *
 * Custom claims are used for:
 * - Client-side authorization checks
 * - Firestore Security Rules enforcement
 * - Real-time permission validation
 */
export const onUserUpdate = onDocumentWritten(
  'users/{userId}',
  async (event: FirestoreEvent<Change<DocumentSnapshot> | undefined, { userId: string }>) => {
    const userId = event.params.userId;
    const change = event.data;

    // If document was deleted, clear custom claims
    if (!change || !change.after || !change.after.exists) {
      try {
        const previousData =
          change && change.before && change.before.exists ? change.before.data() : null;

        await admin.auth().setCustomUserClaims(userId, null);
        console.log(`Cleared custom claims for deleted user: ${userId}`);

        // Audit log user deletion
        if (previousData) {
          await auditUserAction({
            action: 'USER_DELETED',
            userId,
            userEmail: previousData.email || 'unknown',
            userName: previousData.displayName || 'Unknown',
            actorId: 'system',
            actorEmail: 'system@vapourdesal.com',
            actorName: 'System',
            metadata: {
              deletedAt: new Date().toISOString(),
              previousRoles: previousData.roles || [],
              previousStatus: previousData.status || 'unknown',
              triggeredBy: 'onUserUpdate',
            },
            severity: 'CRITICAL',
          });
        }
      } catch (error) {
        console.error(`Error clearing custom claims for deleted user ${userId}:`, error);
      }
      return;
    }

    const userData = change.after.data();
    const previousData = change.before && change.before.exists ? change.before.data() : null;
    const isNewDocument = !previousData;

    // Check what changed (needed for audit logging)
    const rolesChanged =
      !isNewDocument && JSON.stringify(userData?.roles) !== JSON.stringify(previousData?.roles);
    const statusChanged = !isNewDocument && userData?.status !== previousData?.status;
    const permissionsChanged =
      !isNewDocument && userData?.permissions !== previousData?.permissions;

    // ALWAYS recalculate permissions from roles to ensure they stay in sync
    // This ensures that when permission definitions change, all users automatically
    // get updated permissions on their next document write.
    // The small performance cost is worth the reliability gain.

    // Skip if user doesn't have email (shouldn't happen, but defensive)
    if (!userData?.email) {
      console.error(`User ${userId} has no email, cannot set custom claims`);
      return;
    }

    try {
      // Get user from Firebase Auth to ensure they exist
      const user = await admin.auth().getUser(userId);

      // If user is not active, clear their claims (prevent access)
      if (userData.status !== 'active' || !userData.isActive) {
        await admin.auth().setCustomUserClaims(userId, null);
        console.log(`Cleared custom claims for inactive user: ${user.email}`);
        return;
      }

      // User is active - set up custom claims
      const roles = userData.roles || [];

      // Validate roles array
      if (!Array.isArray(roles) || roles.length === 0) {
        console.warn(`User ${user.email} has no roles, clearing claims`);
        await admin.auth().setCustomUserClaims(userId, null);
        return;
      }

      // ALWAYS calculate permissions from roles - roles are the single source of truth
      // This ensures permissions stay in sync with role definitions
      // Uses shared function from @vapour/constants
      const permissions = calculatePermissionsFromRoles(roles);
      const domain = getUserDomain(userData.email);

      // Ensure assignedProjects field exists (required for queries)
      const assignedProjects = Array.isArray(userData.assignedProjects)
        ? userData.assignedProjects
        : [];

      // Set custom claims (including assignedProjects for project access validation)
      const customClaims = {
        roles,
        permissions,
        domain,
        assignedProjects, // Add assignedProjects to avoid Firestore reads in rules
        ...(userData.department && { department: userData.department }),
      };

      await admin.auth().setCustomUserClaims(userId, customClaims);

      console.log(`Updated custom claims for user ${user.email}:`, {
        roles,
        permissions,
        domain,
      });

      // Update user document with all calculated/required fields
      // This ensures data consistency between Firestore and Auth claims
      await change.after.ref.update({
        domain,
        permissions,
        assignedProjects,
        lastClaimUpdate: FieldValue.serverTimestamp(),
      });

      // === AUDIT LOGGING ===
      // Track role changes
      if (!isNewDocument && rolesChanged) {
        const roleChanges = calculateFieldChanges(previousData || {}, userData, ['roles']);

        await auditRoleChange({
          action: 'ROLE_ASSIGNED',
          userId,
          userEmail: userData.email,
          changes: roleChanges,
          actorId: 'system',
          actorEmail: 'system@vapourdesal.com',
          actorName: 'System',
          metadata: {
            previousRoles: previousData?.roles || [],
            newRoles: roles,
            triggeredBy: 'onUserUpdate',
          },
        });
      }

      // Track permission changes
      if (!isNewDocument && permissionsChanged) {
        const permissionChanges = calculateFieldChanges(previousData || {}, { permissions }, [
          'permissions',
        ]);

        await auditPermissionChange({
          action: 'CLAIMS_UPDATED',
          userId,
          userEmail: userData.email,
          changes: permissionChanges,
          actorId: 'system',
          actorEmail: 'system@vapourdesal.com',
          actorName: 'System',
          metadata: {
            previousPermissions: previousData?.permissions || 0,
            newPermissions: permissions,
            roles,
            triggeredBy: 'onUserUpdate',
          },
        });
      }

      // Track status changes
      if (!isNewDocument && statusChanged) {
        const action = userData.status === 'active' ? 'USER_ACTIVATED' : 'USER_DEACTIVATED';
        await auditUserAction({
          action,
          userId,
          userEmail: userData.email,
          userName: userData.displayName || user.displayName || 'Unknown',
          actorId: 'system',
          actorEmail: 'system@vapourdesal.com',
          actorName: 'System',
          changes: [
            {
              field: 'status',
              oldValue: previousData?.status || 'unknown',
              newValue: userData.status,
            },
          ],
          metadata: {
            triggeredBy: 'onUserUpdate',
          },
          severity: 'WARNING',
        });
      }

      // Track new user creation
      if (isNewDocument) {
        await auditUserAction({
          action: 'USER_CREATED',
          userId,
          userEmail: userData.email,
          userName: userData.displayName || user.displayName || 'Unknown',
          actorId: userId, // User created themselves
          actorEmail: userData.email,
          actorName: userData.displayName || 'New User',
          metadata: {
            domain,
            status: userData.status,
            triggeredBy: 'onUserUpdate',
          },
          severity: 'INFO',
        });
      }
    } catch (error) {
      console.error(`Error updating custom claims for user ${userId}:`, error);

      // If user doesn't exist in Auth, we can't set claims
      if ((error as { code?: string }).code === 'auth/user-not-found') {
        console.error(`User ${userId} exists in Firestore but not in Firebase Auth`);
      }

      throw error; // Re-throw to mark function as failed
    }
  }
);
