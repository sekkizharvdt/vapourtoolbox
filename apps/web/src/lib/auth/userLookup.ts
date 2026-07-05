/**
 * User Lookup Helpers
 *
 * Canonical helpers for finding users by permission flag, used for routing
 * task notifications in approval/handoff workflows (proposals, procurement).
 */

import { collection, query, where, getDocs, type Firestore } from 'firebase/firestore';
import { COLLECTIONS } from '@vapour/firebase';
import { hasPermission } from '@vapour/constants';
import type { User } from '@vapour/types';
import { createLogger } from '@vapour/logger';

const logger = createLogger({ context: 'userLookup' });

/**
 * Get users with a specific permission within an entity
 *
 * @param db Firestore instance
 * @param tenantId Tenant ID to filter users by
 * @param permission The permission flag to check for
 * @returns Array of user IDs that have the specified permission
 */
export async function getUsersWithPermission(
  db: Firestore,
  tenantId: string,
  permission: number
): Promise<string[]> {
  try {
    // Query active users in the tenant
    const usersRef = collection(db, COLLECTIONS.USERS);
    const q = query(usersRef, where('tenantId', '==', tenantId), where('isActive', '==', true));

    const snapshot = await getDocs(q);
    const userIds: string[] = [];

    snapshot.forEach((doc) => {
      const user = doc.data() as User;
      // Check if user has the required permission using bitwise check
      if (user.permissions && hasPermission(user.permissions, permission)) {
        userIds.push(doc.id);
      }
    });

    logger.debug('Found users with permission', {
      tenantId,
      permission,
      count: userIds.length,
    });

    return userIds;
  } catch (error) {
    logger.error('Error getting users with permission', { tenantId, permission, error });
    return [];
  }
}
