/**
 * SSOT Authorization Helpers
 *
 * PE-14: Permission checks for SSOT write operations
 * PE-18: Project ownership validation for SSOT data
 */

import { requirePermission } from '@/lib/auth/authorizationService';
import { PERMISSION_FLAGS_2 } from '@vapour/constants';

/**
 * Access check parameters for SSOT write operations.
 * Optional — when omitted, no checks are performed (backward compatibility).
 */
export interface SSOTAccessCheck {
  userPermissions2?: number;
  userAssignedProjects?: string[];
}

/**
 * Validate that a user has write access to SSOT data for a given project.
 *
 * PE-14: Checks MANAGE_SSOT permission
 * PE-18: Validates user is assigned to the target project
 *
 * @param userId - User performing the operation
 * @param projectId - Target project
 * @param accessCheck - Optional access check parameters (from auth claims)
 */
export function validateSSOTWriteAccess(
  userId: string,
  projectId: string,
  accessCheck?: SSOTAccessCheck
): void {
  if (!accessCheck) return;

  // PE-14: Check MANAGE_SSOT permission
  if (accessCheck.userPermissions2 !== undefined) {
    requirePermission(
      accessCheck.userPermissions2,
      PERMISSION_FLAGS_2.MANAGE_SSOT,
      userId,
      'modify SSOT data'
    );
  }

  // PE-18: Validate user is assigned to this project
  if (
    accessCheck.userAssignedProjects !== undefined &&
    !accessCheck.userAssignedProjects.includes(projectId)
  ) {
    throw new Error(`User is not assigned to project "${projectId}". Cannot modify SSOT data.`);
  }
}
