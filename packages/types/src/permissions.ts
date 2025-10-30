// Bitwise Permissions System
// Optimized for Firebase Custom Claims (1000 byte limit)

/**
 * Permission flags using bitwise operations
 * Each permission is a power of 2, allowing efficient storage and checking
 */
export enum PermissionFlag {
  // User Management (0-3)
  MANAGE_USERS = 1 << 0, // 1
  ASSIGN_ROLES = 1 << 1, // 2

  // Project Management (4-6)
  CREATE_PROJECTS = 1 << 4, // 16
  VIEW_ALL_PROJECTS = 1 << 5, // 32
  ASSIGN_PROJECTS = 1 << 6, // 64

  // Entity Management (7)
  MANAGE_ENTITIES = 1 << 7, // 128

  // Time Tracking (8-10)
  GENERATE_TIMESHEETS = 1 << 8, // 256
  APPROVE_LEAVES = 1 << 9, // 512
  MANAGE_ON_DUTY = 1 << 10, // 1024

  // Accounting (11-13)
  CREATE_TRANSACTIONS = 1 << 11, // 2048
  APPROVE_TRANSACTIONS = 1 << 12, // 4096
  VIEW_REPORTS = 1 << 13, // 8192

  // Procurement (14-18)
  CREATE_PR = 1 << 14, // 16384 (Purchase Requisition)
  APPROVE_PR = 1 << 15, // 32768
  CREATE_RFQ = 1 << 16, // 65536 (Request for Quotation)
  CREATE_PO = 1 << 17, // 131072 (Purchase Order)
  APPROVE_PO = 1 << 18, // 262144

  // Estimation (19-20)
  CREATE_ESTIMATES = 1 << 19, // 524288
  APPROVE_ESTIMATES = 1 << 20, // 1048576

  // View-only permissions for external users (21-23)
  VIEW_PROCUREMENT = 1 << 21, // 2097152 (for CLIENT_PM)
  VIEW_PROJECT_STATUS = 1 << 22, // 4194304 (for CLIENT_PM)
  VIEW_PAYMENT_STATUS = 1 << 23, // 8388608 (for CLIENT_PM)
}

/**
 * Permission helper functions
 */

/**
 * Check if a permission is granted
 */
export function hasPermission(permissions: number, flag: PermissionFlag): boolean {
  return (permissions & flag) === flag;
}

/**
 * Check if any of the given permissions are granted
 */
export function hasAnyPermission(permissions: number, ...flags: PermissionFlag[]): boolean {
  return flags.some((flag) => hasPermission(permissions, flag));
}

/**
 * Check if all of the given permissions are granted
 */
export function hasAllPermissions(permissions: number, ...flags: PermissionFlag[]): boolean {
  return flags.every((flag) => hasPermission(permissions, flag));
}

/**
 * Add a permission
 */
export function addPermission(permissions: number, flag: PermissionFlag): number {
  return permissions | flag;
}

/**
 * Add multiple permissions
 */
export function addPermissions(permissions: number, ...flags: PermissionFlag[]): number {
  return flags.reduce((acc, flag) => acc | flag, permissions);
}

/**
 * Remove a permission
 */
export function removePermission(permissions: number, flag: PermissionFlag): number {
  return permissions & ~flag;
}

/**
 * Remove multiple permissions
 */
export function removePermissions(permissions: number, ...flags: PermissionFlag[]): number {
  return flags.reduce((acc, flag) => acc & ~flag, permissions);
}

/**
 * Toggle a permission
 */
export function togglePermission(permissions: number, flag: PermissionFlag): number {
  return permissions ^ flag;
}

/**
 * Create permissions from an array of flags
 */
export function createPermissions(...flags: PermissionFlag[]): number {
  return flags.reduce((acc, flag) => acc | flag, 0);
}

/**
 * Get all granted permissions as an array
 */
export function getGrantedPermissions(permissions: number): PermissionFlag[] {
  const granted: PermissionFlag[] = [];
  const allFlags = Object.values(PermissionFlag).filter(
    (v) => typeof v === 'number'
  ) as PermissionFlag[];

  for (const flag of allFlags) {
    if (hasPermission(permissions, flag)) {
      granted.push(flag);
    }
  }

  return granted;
}

/**
 * Predefined permission sets for common roles
 */
export const RolePermissions = {
  SUPER_ADMIN: createPermissions(
    // All permissions
    PermissionFlag.MANAGE_USERS,
    PermissionFlag.ASSIGN_ROLES,
    PermissionFlag.CREATE_PROJECTS,
    PermissionFlag.VIEW_ALL_PROJECTS,
    PermissionFlag.ASSIGN_PROJECTS,
    PermissionFlag.MANAGE_ENTITIES,
    PermissionFlag.GENERATE_TIMESHEETS,
    PermissionFlag.APPROVE_LEAVES,
    PermissionFlag.MANAGE_ON_DUTY,
    PermissionFlag.CREATE_TRANSACTIONS,
    PermissionFlag.APPROVE_TRANSACTIONS,
    PermissionFlag.VIEW_REPORTS,
    PermissionFlag.CREATE_PR,
    PermissionFlag.APPROVE_PR,
    PermissionFlag.CREATE_RFQ,
    PermissionFlag.CREATE_PO,
    PermissionFlag.APPROVE_PO,
    PermissionFlag.CREATE_ESTIMATES,
    PermissionFlag.APPROVE_ESTIMATES
  ),

  DIRECTOR: createPermissions(
    PermissionFlag.VIEW_ALL_PROJECTS,
    PermissionFlag.ASSIGN_PROJECTS,
    PermissionFlag.MANAGE_ENTITIES,
    PermissionFlag.GENERATE_TIMESHEETS,
    PermissionFlag.APPROVE_LEAVES,
    PermissionFlag.APPROVE_TRANSACTIONS,
    PermissionFlag.VIEW_REPORTS,
    PermissionFlag.APPROVE_PR,
    PermissionFlag.APPROVE_PO,
    PermissionFlag.APPROVE_ESTIMATES
  ),

  PROJECT_MANAGER: createPermissions(
    PermissionFlag.CREATE_PROJECTS,
    PermissionFlag.ASSIGN_PROJECTS,
    PermissionFlag.GENERATE_TIMESHEETS,
    PermissionFlag.CREATE_PR,
    PermissionFlag.CREATE_RFQ,
    PermissionFlag.CREATE_ESTIMATES
  ),

  PROCUREMENT_MANAGER: createPermissions(
    PermissionFlag.MANAGE_ENTITIES,
    PermissionFlag.CREATE_PR,
    PermissionFlag.APPROVE_PR,
    PermissionFlag.CREATE_RFQ,
    PermissionFlag.CREATE_PO,
    PermissionFlag.APPROVE_PO
  ),

  ACCOUNTANT: createPermissions(
    PermissionFlag.MANAGE_ENTITIES,
    PermissionFlag.CREATE_TRANSACTIONS,
    PermissionFlag.VIEW_REPORTS
  ),

  FINANCE_MANAGER: createPermissions(
    PermissionFlag.MANAGE_ENTITIES,
    PermissionFlag.CREATE_TRANSACTIONS,
    PermissionFlag.APPROVE_TRANSACTIONS,
    PermissionFlag.VIEW_REPORTS
  ),

  ENGINEERING_HEAD: createPermissions(
    PermissionFlag.CREATE_PROJECTS,
    PermissionFlag.VIEW_ALL_PROJECTS,
    PermissionFlag.ASSIGN_PROJECTS,
    PermissionFlag.GENERATE_TIMESHEETS,
    PermissionFlag.APPROVE_LEAVES
  ),

  ENGINEER: createPermissions(
    PermissionFlag.CREATE_ESTIMATES
  ),

  SITE_ENGINEER: createPermissions(
    PermissionFlag.CREATE_PR
  ),

  HR_ADMIN: createPermissions(
    PermissionFlag.MANAGE_USERS,
    PermissionFlag.ASSIGN_ROLES,
    PermissionFlag.APPROVE_LEAVES
  ),

  TEAM_MEMBER: createPermissions(
    // Minimal permissions - can view assigned projects
  ),

  CLIENT_PM: createPermissions(
    // External client PM - view-only procurement for assigned projects
    PermissionFlag.VIEW_PROCUREMENT,
    PermissionFlag.VIEW_PROJECT_STATUS,
    PermissionFlag.VIEW_PAYMENT_STATUS
  ),
} as const;

/**
 * Get permissions for a role
 */
export function getPermissionsForRole(role: string): number {
  return RolePermissions[role as keyof typeof RolePermissions] || 0;
}

/**
 * Get permissions for multiple roles (combines all role permissions)
 */
export function getPermissionsForRoles(roles: string[]): number {
  return roles.reduce((acc, role) => {
    const rolePerms = getPermissionsForRole(role);
    return acc | rolePerms;
  }, 0);
}

/**
 * Permission descriptions for UI display
 */
export const PermissionDescriptions: Record<PermissionFlag, string> = {
  [PermissionFlag.MANAGE_USERS]: 'Manage users',
  [PermissionFlag.ASSIGN_ROLES]: 'Assign roles',
  [PermissionFlag.CREATE_PROJECTS]: 'Create projects',
  [PermissionFlag.VIEW_ALL_PROJECTS]: 'View all projects',
  [PermissionFlag.ASSIGN_PROJECTS]: 'Assign projects',
  [PermissionFlag.MANAGE_ENTITIES]: 'Manage entities',
  [PermissionFlag.GENERATE_TIMESHEETS]: 'Generate timesheets',
  [PermissionFlag.APPROVE_LEAVES]: 'Approve leaves',
  [PermissionFlag.MANAGE_ON_DUTY]: 'Manage on-duty',
  [PermissionFlag.CREATE_TRANSACTIONS]: 'Create transactions',
  [PermissionFlag.APPROVE_TRANSACTIONS]: 'Approve transactions',
  [PermissionFlag.VIEW_REPORTS]: 'View reports',
  [PermissionFlag.CREATE_PR]: 'Create purchase requisitions',
  [PermissionFlag.APPROVE_PR]: 'Approve purchase requisitions',
  [PermissionFlag.CREATE_RFQ]: 'Create RFQs',
  [PermissionFlag.CREATE_PO]: 'Create purchase orders',
  [PermissionFlag.APPROVE_PO]: 'Approve purchase orders',
  [PermissionFlag.CREATE_ESTIMATES]: 'Create estimates',
  [PermissionFlag.APPROVE_ESTIMATES]: 'Approve estimates',
  [PermissionFlag.VIEW_PROCUREMENT]: 'View procurement',
  [PermissionFlag.VIEW_PROJECT_STATUS]: 'View project status',
  [PermissionFlag.VIEW_PAYMENT_STATUS]: 'View payment status',
};
