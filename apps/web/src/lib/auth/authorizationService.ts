/**
 * Authorization Service
 *
 * Centralized authorization checks for service layer operations.
 * Uses the PERMISSION_FLAGS system from @vapour/constants.
 *
 * Usage:
 * - Use these functions in service layer functions to validate permissions
 * - Throw AuthorizationError for unauthorized operations
 * - Use requirePermission for single permission checks
 * - Use requireAnyPermission for OR logic (user has one of the permissions)
 * - Use requireApprover for checking designated approver lists
 */

import { doc, getDoc, type Firestore } from 'firebase/firestore';
import { COLLECTIONS } from '@vapour/firebase';
import { PERMISSION_FLAGS, hasPermission, PERMISSION_FLAGS_2 } from '@vapour/constants';
import { createLogger } from '@vapour/logger';

/**
 * Check if any of the given permissions are granted
 */
function hasAnyPermission(permissions: number, ...flags: number[]): boolean {
  return flags.some((flag) => hasPermission(permissions, flag));
}

/**
 * Look up a permission flag name from its numeric value
 */
function getPermissionName(flag: number): string {
  for (const [key, value] of Object.entries(PERMISSION_FLAGS)) {
    if (value === flag) return key;
  }
  for (const [key, value] of Object.entries(PERMISSION_FLAGS_2)) {
    if (value === flag) return key;
  }
  return `PERMISSION(${flag})`;
}

const logger = createLogger({ context: 'authorizationService' });

/**
 * Custom error class for authorization failures
 */
export class AuthorizationError extends Error {
  constructor(
    message: string,
    public readonly requiredPermission?: number,
    public readonly userId?: string,
    public readonly operation?: string
  ) {
    super(message);
    this.name = 'AuthorizationError';
  }
}

/**
 * Context for authorization checks
 */
export interface AuthorizationContext {
  /** The user performing the operation */
  userId: string;
  /** User's bitwise permissions */
  userPermissions: number;
  /** Optional entity/project scope */
  entityId?: string;
}

/**
 * Get user permissions from Firestore
 *
 * @param db - Firestore instance
 * @param userId - User ID to fetch permissions for
 * @returns User's permissions as a number (bitwise flags)
 */
export async function getUserPermissions(db: Firestore, userId: string): Promise<number> {
  const userDoc = await getDoc(doc(db, COLLECTIONS.USERS, userId));
  if (!userDoc.exists()) {
    throw new AuthorizationError('User not found', undefined, userId);
  }
  return userDoc.data()?.permissions || 0;
}

/**
 * Create an authorization context from user data
 *
 * @param userId - User ID
 * @param permissions - User's permissions (from Firebase claims or DB)
 * @param entityId - Optional entity scope
 */
export function createAuthContext(
  userId: string,
  permissions: number,
  entityId?: string
): AuthorizationContext {
  return { userId, userPermissions: permissions, entityId };
}

/**
 * Require a specific permission
 *
 * @param permissions - User's permissions
 * @param flag - Required permission flag
 * @param userId - User ID for logging
 * @param operation - Operation name for error messages
 * @throws AuthorizationError if permission not granted
 */
export function requirePermission(
  permissions: number,
  flag: number,
  userId: string,
  operation?: string
): void {
  if (!hasPermission(permissions, flag)) {
    const flagName = getPermissionName(flag);
    const message = operation
      ? `Permission denied: ${operation} requires ${flagName}`
      : `Permission denied: requires ${flagName}`;

    logger.warn('Permission denied', { userId, requiredPermission: flagName, operation });
    throw new AuthorizationError(message, flag, userId, operation);
  }
}

/**
 * Require any of the specified permissions (OR logic)
 *
 * @param permissions - User's permissions
 * @param flags - Array of acceptable permission flags
 * @param userId - User ID for logging
 * @param operation - Operation name for error messages
 * @throws AuthorizationError if none of the permissions are granted
 */
export function requireAnyPermission(
  permissions: number,
  flags: number[],
  userId: string,
  operation?: string
): void {
  if (!hasAnyPermission(permissions, ...flags)) {
    const flagNames = flags.map((f) => getPermissionName(f)).join(', ');
    const message = operation
      ? `Permission denied: ${operation} requires one of: ${flagNames}`
      : `Permission denied: requires one of: ${flagNames}`;

    logger.warn('Permission denied', { userId, requiredPermissions: flagNames, operation });
    throw new AuthorizationError(message, flags[0], userId, operation);
  }
}

/**
 * Require user to be in an approver list
 *
 * @param userId - User attempting the operation
 * @param approverIds - List of authorized approver IDs
 * @param operation - Operation name for error messages
 * @throws AuthorizationError if user is not in approver list
 */
export function requireApprover(userId: string, approverIds: string[], operation: string): void {
  if (!approverIds.includes(userId)) {
    logger.warn('Not an authorized approver', {
      userId,
      operation,
      approverCount: approverIds.length,
    });
    throw new AuthorizationError(
      `You are not authorized to ${operation}`,
      undefined,
      userId,
      operation
    );
  }
}

/**
 * Require ownership or admin permission
 *
 * Allows operation if:
 * 1. User is the owner of the resource, OR
 * 2. User has the admin permission
 *
 * @param userId - User attempting the operation
 * @param ownerId - Owner of the resource
 * @param permissions - User's permissions
 * @param adminPermission - Permission that overrides ownership requirement
 * @param operation - Operation name for error messages
 * @throws AuthorizationError if neither owner nor has admin permission
 */
export function requireOwnerOrPermission(
  userId: string,
  ownerId: string,
  permissions: number,
  adminPermission: number,
  operation?: string
): void {
  if (userId !== ownerId && !hasPermission(permissions, adminPermission)) {
    const flagName = getPermissionName(adminPermission);
    const message = operation
      ? `Permission denied: ${operation} requires ownership or ${flagName}`
      : `Must be owner or have ${flagName} permission`;

    logger.warn('Permission denied - not owner and lacks admin permission', {
      userId,
      ownerId,
      requiredPermission: flagName,
      operation,
    });
    throw new AuthorizationError(message, adminPermission, userId, operation);
  }
}

/**
 * Prevent self-approval
 *
 * Used to enforce separation of duties - users cannot approve their own requests
 *
 * @param approverId - User attempting to approve
 * @param creatorId - User who created the request
 * @param operation - Operation name for error messages
 * @throws AuthorizationError if trying to approve own request
 */
export function preventSelfApproval(
  approverId: string,
  creatorId: string,
  operation: string
): void {
  if (approverId === creatorId) {
    logger.warn('Self-approval attempt blocked', { userId: approverId, operation });
    throw new AuthorizationError(
      `Cannot ${operation} your own request`,
      undefined,
      approverId,
      operation
    );
  }
}

/**
 * Check if user has permission (non-throwing version)
 *
 * @param permissions - User's permissions
 * @param flag - Permission flag to check
 * @returns true if permission is granted
 */
export function checkPermission(permissions: number, flag: number): boolean {
  return hasPermission(permissions, flag);
}

/**
 * Check if user can perform operation (combines multiple checks)
 *
 * @param ctx - Authorization context
 * @param options - Check options
 * @returns true if all checks pass
 */
export function canPerformOperation(
  ctx: AuthorizationContext,
  options: {
    requiredPermission?: number;
    requiredAnyPermission?: number[];
    ownerId?: string;
    approverIds?: string[];
  }
): boolean {
  // Check required permission
  if (options.requiredPermission) {
    if (!hasPermission(ctx.userPermissions, options.requiredPermission)) {
      return false;
    }
  }

  // Check any of required permissions
  if (options.requiredAnyPermission && options.requiredAnyPermission.length > 0) {
    if (!hasAnyPermission(ctx.userPermissions, ...options.requiredAnyPermission)) {
      return false;
    }
  }

  // Check approver list
  if (options.approverIds && options.approverIds.length > 0) {
    if (!options.approverIds.includes(ctx.userId)) {
      return false;
    }
  }

  return true;
}
