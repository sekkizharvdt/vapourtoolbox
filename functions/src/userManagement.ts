import { onDocumentWritten } from 'firebase-functions/v2/firestore';
import type { FirestoreEvent, Change } from 'firebase-functions/v2/firestore';
import type { DocumentSnapshot } from 'firebase-admin/firestore';
import { FieldValue } from 'firebase-admin/firestore';
import * as admin from 'firebase-admin';
import { auditUserAction, auditPermissionChange, calculateFieldChanges } from './utils/audit';

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

/**
 * Count active users with full admin permissions (MANAGE_USERS permission)
 * Used to prevent deletion/deactivation of the last admin
 */
async function countActiveAdmins(): Promise<number> {
  const db = admin.firestore();
  const usersRef = db.collection('users');

  // Query for active users - we'll check permissions in code
  // since Firestore doesn't support bitwise operations in queries
  const snapshot = await usersRef
    .where('status', '==', 'active')
    .where('isActive', '==', true)
    .get();

  // Count users with MANAGE_USERS permission (bit 0)
  let count = 0;
  snapshot.forEach((doc) => {
    const data = doc.data();
    const permissions = data.permissions || 0;
    // Check if user has MANAGE_USERS permission (1 << 0 = 1)
    if ((permissions & PERMISSION_FLAGS.MANAGE_USERS) === PERMISSION_FLAGS.MANAGE_USERS) {
      count++;
    }
  });

  return count;
}

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

  // Granular Accounting Permissions (bits 20-26)
  MANAGE_CHART_OF_ACCOUNTS: 1 << 20, // 1048576 - Create/edit accounts
  CREATE_TRANSACTIONS: 1 << 21, // 2097152 - Create transactions
  APPROVE_TRANSACTIONS: 1 << 22, // 4194304 - Approve transactions
  VIEW_FINANCIAL_REPORTS: 1 << 23, // 8388608 - View P&L, Balance Sheet, etc.
  MANAGE_COST_CENTRES: 1 << 24, // 16777216 - Manage project cost centres
  MANAGE_FOREX: 1 << 25, // 33554432 - Manage currency and forex settings
  RECONCILE_ACCOUNTS: 1 << 26, // 67108864 - Bank reconciliation
};

// Helper to check if user has admin permissions
function hasAdminPermission(permissions: number): boolean {
  return (permissions & PERMISSION_FLAGS.MANAGE_USERS) === PERMISSION_FLAGS.MANAGE_USERS;
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

        // === ADMIN SAFEGUARD ===
        // Prevent deleting the last admin user to avoid system lockout
        if (previousData) {
          const hadAdminPermission = hasAdminPermission(previousData.permissions || 0);
          const wasActive = previousData.status === 'active' && previousData.isActive === true;

          if (hadAdminPermission && wasActive) {
            const activeAdminCount = await countActiveAdmins();
            if (activeAdminCount <= 0) {
              // This was the last active admin
              console.error(
                `Cannot delete last admin user: ${previousData.email || userId}. At least one active admin must exist.`
              );
              throw new Error(
                'Cannot delete the last admin user. System must have at least one active administrator.'
              );
            }
          }
        }

        // Clear custom claims and revoke tokens
        await admin.auth().setCustomUserClaims(userId, null);
        await admin.auth().revokeRefreshTokens(userId);
        console.log(`Cleared custom claims and revoked tokens for deleted user: ${userId}`);

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
              previousPermissions: previousData.permissions || 0,
              previousStatus: previousData.status || 'unknown',
              triggeredBy: 'onUserUpdate',
            },
            severity: 'CRITICAL',
          });
        }
      } catch (error) {
        console.error(`Error clearing custom claims for deleted user ${userId}:`, error);
        throw error; // Re-throw to prevent deletion if safeguard fails
      }
      return;
    }

    const userData = change.after.data();
    const previousData = change.before && change.before.exists ? change.before.data() : null;
    const isNewDocument = !previousData;

    // Check what changed (needed for audit logging)
    const statusChanged = !isNewDocument && userData?.status !== previousData?.status;
    const permissionsChanged =
      !isNewDocument && userData?.permissions !== previousData?.permissions;
    const allowedModulesChanged =
      !isNewDocument &&
      JSON.stringify(userData?.allowedModules) !== JSON.stringify(previousData?.allowedModules);

    // Skip if user doesn't have email (shouldn't happen, but defensive)
    if (!userData?.email) {
      console.error(`User ${userId} has no email, cannot set custom claims`);
      return;
    }

    try {
      // Get user from Firebase Auth to ensure they exist
      const user = await admin.auth().getUser(userId);

      // === ADMIN SAFEGUARD ===
      // Prevent deactivating the last admin user to avoid system lockout
      const wasActive = previousData?.status === 'active' && previousData?.isActive === true;
      const isBeingDeactivated = wasActive && (userData.status !== 'active' || !userData.isActive);
      const isAdmin = hasAdminPermission(userData.permissions || 0);

      if (isBeingDeactivated && isAdmin) {
        const activeAdminCount = await countActiveAdmins();
        if (activeAdminCount <= 1) {
          console.error(
            `Cannot deactivate last admin user: ${user.email}. At least one active admin must exist.`
          );
          throw new Error(
            'Cannot deactivate the last admin user. System must have at least one active administrator.'
          );
        }
      }

      // If user is not active, clear their claims and revoke tokens (prevent access)
      if (userData.status !== 'active' || !userData.isActive) {
        // Clear custom claims
        await admin.auth().setCustomUserClaims(userId, null);

        // Revoke all refresh tokens to immediately invalidate all sessions
        // This ensures the user cannot access the system even with existing tokens
        await admin.auth().revokeRefreshTokens(userId);

        console.log(`Deactivated user: ${user.email} - Cleared claims and revoked all tokens`);
        return;
      }

      // User is active - set up custom claims
      // Permissions are stored directly on the user document (no roles)
      const permissions = userData.permissions || 0;
      const domain = getUserDomain(userData.email);

      // Get allowed modules (empty array means all modules)
      const allowedModules = Array.isArray(userData.allowedModules) ? userData.allowedModules : [];

      // Ensure assignedProjects field exists (required for queries)
      const assignedProjects = Array.isArray(userData.assignedProjects)
        ? userData.assignedProjects
        : [];

      // Set custom claims (permissions-based, no roles)
      const customClaims = {
        permissions,
        domain,
        allowedModules,
        assignedProjects, // Add assignedProjects to avoid Firestore reads in rules
        ...(userData.department && { department: userData.department }),
      };

      await admin.auth().setCustomUserClaims(userId, customClaims);

      console.log(`Updated custom claims for user ${user.email}:`, {
        permissions,
        domain,
        allowedModules: allowedModules.length > 0 ? allowedModules : 'all',
      });

      // Update user document with calculated domain field
      // This ensures data consistency between Firestore and Auth claims
      await change.after.ref.update({
        domain,
        lastClaimUpdate: FieldValue.serverTimestamp(),
      });

      // === AUDIT LOGGING ===
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
            triggeredBy: 'onUserUpdate',
          },
        });
      }

      // Track allowed modules changes
      if (!isNewDocument && allowedModulesChanged) {
        const moduleChanges = calculateFieldChanges(previousData || {}, userData, [
          'allowedModules',
        ]);

        await auditPermissionChange({
          action: 'CLAIMS_UPDATED',
          userId,
          userEmail: userData.email,
          changes: moduleChanges,
          actorId: 'system',
          actorEmail: 'system@vapourdesal.com',
          actorName: 'System',
          metadata: {
            previousAllowedModules: previousData?.allowedModules || [],
            newAllowedModules: allowedModules,
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
