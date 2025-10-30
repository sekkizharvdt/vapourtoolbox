/**
 * Firebase Cloud Functions for Vapour Toolbox
 *
 * Auto-syncs user custom claims when Firestore user documents are updated
 */

import {onDocumentWritten} from 'firebase-functions/v2/firestore';
import {onCall, HttpsError} from 'firebase-functions/v2/https';
import {logger} from 'firebase-functions/v2';
import * as admin from 'firebase-admin';
import {UserRole} from './types/user';
import {calculatePermissions} from './utils/permissions';

// Initialize Firebase Admin
admin.initializeApp();

/**
 * Create Firestore Document for New Users
 *
 * This is handled client-side in the AuthContext
 * When a user signs in for the first time, the client creates their Firestore document
 * This ensures we don't need Google Cloud Identity Platform
 */

/**
 * Sync Custom Claims on User Update
 *
 * Triggers whenever a user document in Firestore is updated
 * Automatically sets custom claims based on user roles, status, and domain
 *
 * Custom Claims Structure:
 * {
 *   roles: string[],          // User roles (e.g., ['SUPER_ADMIN', 'ENGINEER'])
 *   permissions: number,      // Bitwise permission flags
 *   domain: 'internal' | 'external'  // User domain
 * }
 */
export const onUserUpdate = onDocumentWritten('users/{userId}', async (event) => {
  const userId = event.params.userId;

  // If document was deleted, remove claims
  if (!event.data?.after.exists) {
    try {
      await admin.auth().setCustomUserClaims(userId, null);
      logger.info(`Removed claims for deleted user: ${userId}`);
      return null;
    } catch (error) {
      logger.error(`Error removing claims for user ${userId}:`, error);
      return null;
    }
  }

  const userData = event.data.after.data();

  if (!userData) {
    logger.warn(`No data found for user ${userId}`);
    return null;
  }

  const {
    roles,
    status,
    isActive,
    email,
  } = userData;

  // Validate required fields
  if (!email) {
    logger.warn(`User ${userId} has no email, skipping claims update`);
    return null;
  }

  // Determine domain from email
  const domain = email.endsWith('@vapourdesal.com') ? 'internal' : 'external';

  // Only set claims for active users with roles
  if (
    status === 'active' &&
    isActive === true &&
    roles &&
    Array.isArray(roles) &&
    roles.length > 0
  ) {
    // Calculate permissions from roles
    const permissions = calculatePermissions(roles as UserRole[]);

    const customClaims = {
      roles,
      permissions,
      domain,
    };

    try {
      // Get current user to check existing claims
      const user = await admin.auth().getUser(userId);

      // Check if claims actually changed (avoid unnecessary updates)
      const currentClaims = user.customClaims || {};
      const claimsChanged =
        JSON.stringify(currentClaims.roles) !== JSON.stringify(roles) ||
        currentClaims.permissions !== permissions ||
        currentClaims.domain !== domain;

      if (claimsChanged) {
        await admin.auth().setCustomUserClaims(userId, customClaims);
        logger.info(`Updated claims for user ${userId}:`, {
          email,
          roles,
          permissions,
          domain,
        });
      } else {
        logger.info(`Claims unchanged for user ${userId}, skipping update`);
      }

      return null;
    } catch (error) {
      logger.error(`Error setting claims for user ${userId}:`, error);
      return null;
    }
  } else {
    // User is pending, inactive, or has no roles - remove claims
    try {
      const user = await admin.auth().getUser(userId);

      if (user.customClaims && Object.keys(user.customClaims).length > 0) {
        await admin.auth().setCustomUserClaims(userId, null);
        logger.info(`Removed claims for user ${userId} (status: ${status}, active: ${isActive})`);
      }

      return null;
    } catch (error) {
      logger.error(`Error removing claims for user ${userId}:`, error);
      return null;
    }
  }
});

/**
 * Optional: Manually trigger claims sync for a user
 *
 * Can be called from the admin UI to force a claims update
 *
 * Usage:
 *   const syncClaims = httpsCallable(functions, 'syncUserClaims');
 *   await syncClaims({ userId: 'abc123' });
 */
export const syncUserClaims = onCall(async (request) => {
  // Only admins can trigger manual sync
  if (!request.auth || !request.auth.token.roles?.includes('SUPER_ADMIN')) {
    throw new HttpsError(
      'permission-denied',
      'Only SUPER_ADMIN can manually sync user claims'
    );
  }

  const { userId } = request.data;

  if (!userId) {
    throw new HttpsError(
      'invalid-argument',
      'userId is required'
    );
  }

  try {
    // Get user document from Firestore
    const userDoc = await admin.firestore().collection('users').doc(userId).get();

    if (!userDoc.exists) {
      throw new HttpsError(
        'not-found',
        `User document not found: ${userId}`
      );
    }

    const userData = userDoc.data();
    if (!userData) {
      throw new HttpsError(
        'internal',
        'User document has no data'
      );
    }

    const { roles, status, isActive, email } = userData;

    if (!email) {
      throw new HttpsError(
        'failed-precondition',
        'User has no email address'
      );
    }

    const domain = email.endsWith('@vapourdesal.com') ? 'internal' : 'external';

    if (
      status === 'active' &&
      isActive === true &&
      roles &&
      Array.isArray(roles) &&
      roles.length > 0
    ) {
      const permissions = calculatePermissions(roles as UserRole[]);

      await admin.auth().setCustomUserClaims(userId, {
        roles,
        permissions,
        domain,
      });

      logger.info(`Manually synced claims for user ${userId}`, {
        triggeredBy: request.auth.uid,
      });

      return {
        success: true,
        message: 'Claims synced successfully',
        claims: { roles, permissions, domain },
      };
    } else {
      await admin.auth().setCustomUserClaims(userId, null);

      return {
        success: true,
        message: 'Claims removed (user inactive or no roles)',
      };
    }
  } catch (error) {
    logger.error(`Error in syncUserClaims for ${userId}:`, error);
    throw new HttpsError(
      'internal',
      'Failed to sync claims'
    );
  }
});
