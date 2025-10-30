/**
 * Permission Flags - Bitwise permission system
 *
 * Each permission is a power of 2 (single bit)
 * Allows combining permissions using bitwise OR: perm1 | perm2
 * Allows checking permissions using bitwise AND: (userPerms & requiredPerm) === requiredPerm
 *
 * Maximum 32 permissions (0-31 bits in a 32-bit integer)
 */

export const PERMISSION_FLAGS = {
  // User Management (bits 0-2)
  MANAGE_USERS: 1 << 0,        // 1
  VIEW_USERS: 1 << 1,          // 2
  MANAGE_ROLES: 1 << 2,        // 4

  // Project Management (bits 3-4)
  MANAGE_PROJECTS: 1 << 3,     // 8
  VIEW_PROJECTS: 1 << 4,       // 16

  // Entity Management (bits 5-8) - Granular permissions
  VIEW_ENTITIES: 1 << 5,       // 32 - View all entities
  CREATE_ENTITIES: 1 << 6,     // 64 - Create new entities
  EDIT_ENTITIES: 1 << 7,       // 128 - Edit existing entities
  DELETE_ENTITIES: 1 << 8,     // 256 - Delete entities (most sensitive)

  // Company Settings (bit 9)
  MANAGE_COMPANY_SETTINGS: 1 << 9, // 512

  // Analytics & Reporting (bits 10-11)
  VIEW_ANALYTICS: 1 << 10,     // 1024
  EXPORT_DATA: 1 << 11,        // 2048

  // Time Tracking (bits 12-13)
  MANAGE_TIME_TRACKING: 1 << 12, // 4096
  VIEW_TIME_TRACKING: 1 << 13,   // 8192

  // Accounting (bits 14-15)
  MANAGE_ACCOUNTING: 1 << 14,  // 16384
  VIEW_ACCOUNTING: 1 << 15,    // 32768

  // Procurement (bits 16-17)
  MANAGE_PROCUREMENT: 1 << 16, // 65536
  VIEW_PROCUREMENT: 1 << 17,   // 131072

  // Estimation (bits 18-19)
  MANAGE_ESTIMATION: 1 << 18,  // 262144
  VIEW_ESTIMATION: 1 << 19,    // 524288

  // Reserved for future use (bits 20-31)
} as const;

/**
 * Permission bit positions (for Firestore rules)
 * Used with modulo arithmetic: floor(permissions / permissionBit) % 2 == 1
 */
export const PERMISSION_BITS = {
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
} as const;

/**
 * Helper function to check if a permission is included
 */
export function hasPermission(userPermissions: number, requiredPermission: number): boolean {
  return (userPermissions & requiredPermission) === requiredPermission;
}

/**
 * Calculate all permissions (for SUPER_ADMIN)
 */
export function getAllPermissions(): number {
  return Object.values(PERMISSION_FLAGS).reduce((acc, perm) => acc | perm, 0);
}

/**
 * Project permission helpers
 * These check project permissions
 */
export function canViewProjects(permissions: number): boolean {
  return hasPermission(permissions, PERMISSION_FLAGS.VIEW_PROJECTS);
}

export function canManageProjects(permissions: number): boolean {
  return hasPermission(permissions, PERMISSION_FLAGS.MANAGE_PROJECTS);
}

/**
 * Entity permission helpers
 * These check granular entity permissions
 */
export function canViewEntities(permissions: number): boolean {
  return hasPermission(permissions, PERMISSION_FLAGS.VIEW_ENTITIES);
}

export function canCreateEntities(permissions: number): boolean {
  return hasPermission(permissions, PERMISSION_FLAGS.CREATE_ENTITIES);
}

export function canEditEntities(permissions: number): boolean {
  return hasPermission(permissions, PERMISSION_FLAGS.EDIT_ENTITIES);
}

export function canDeleteEntities(permissions: number): boolean {
  return hasPermission(permissions, PERMISSION_FLAGS.DELETE_ENTITIES);
}

/**
 * Role to Permissions Mapping
 * SINGLE SOURCE OF TRUTH - Used by both client and Cloud Function
 *
 * Each role gets a specific set of permissions.
 * Roles are combined using bitwise OR when user has multiple roles.
 */
export const ROLE_PERMISSIONS: Record<string, number> = {
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
    PERMISSION_FLAGS.VIEW_ESTIMATION,

  HR_ADMIN:
    PERMISSION_FLAGS.MANAGE_USERS |
    PERMISSION_FLAGS.VIEW_USERS |
    PERMISSION_FLAGS.MANAGE_ROLES,

  FINANCE_MANAGER:
    PERMISSION_FLAGS.VIEW_PROJECTS |
    PERMISSION_FLAGS.VIEW_ANALYTICS |
    PERMISSION_FLAGS.EXPORT_DATA |
    PERMISSION_FLAGS.VIEW_TIME_TRACKING |
    PERMISSION_FLAGS.MANAGE_ACCOUNTING |
    PERMISSION_FLAGS.VIEW_ACCOUNTING,

  ACCOUNTANT:
    PERMISSION_FLAGS.VIEW_TIME_TRACKING |
    PERMISSION_FLAGS.MANAGE_ACCOUNTING |
    PERMISSION_FLAGS.VIEW_ACCOUNTING,

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

  ENGINEER:
    PERMISSION_FLAGS.VIEW_ESTIMATION,

  PROCUREMENT_MANAGER:
    PERMISSION_FLAGS.VIEW_PROJECTS |
    PERMISSION_FLAGS.VIEW_ENTITIES |
    PERMISSION_FLAGS.CREATE_ENTITIES |
    PERMISSION_FLAGS.EDIT_ENTITIES |
    PERMISSION_FLAGS.MANAGE_PROCUREMENT |
    PERMISSION_FLAGS.VIEW_PROCUREMENT |
    PERMISSION_FLAGS.MANAGE_ESTIMATION |
    PERMISSION_FLAGS.VIEW_ESTIMATION,

  SITE_ENGINEER:
    PERMISSION_FLAGS.VIEW_PROCUREMENT,

  TEAM_MEMBER: 0, // No special permissions

  CLIENT_PM:
    PERMISSION_FLAGS.VIEW_PROCUREMENT,
};

/**
 * Calculate combined permissions from multiple roles
 * Used by both client and Cloud Function
 */
export function calculatePermissionsFromRoles(roles: string[]): number {
  let permissions = 0;
  for (const role of roles) {
    const rolePermissions = ROLE_PERMISSIONS[role];
    if (rolePermissions !== undefined) {
      permissions |= rolePermissions;
    }
  }
  return permissions;
}
