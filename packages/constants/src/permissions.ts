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
  MANAGE_USERS: 1 << 0, // 1
  VIEW_USERS: 1 << 1, // 2
  MANAGE_ROLES: 1 << 2, // 4

  // Project Management (bits 3-4)
  MANAGE_PROJECTS: 1 << 3, // 8
  VIEW_PROJECTS: 1 << 4, // 16

  // Entity Management (bits 5-8) - Granular permissions
  VIEW_ENTITIES: 1 << 5, // 32 - View all entities
  CREATE_ENTITIES: 1 << 6, // 64 - Create new entities
  EDIT_ENTITIES: 1 << 7, // 128 - Edit existing entities
  DELETE_ENTITIES: 1 << 8, // 256 - Delete entities (most sensitive)

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

  // Document Management (bits 27-30)
  MANAGE_DOCUMENTS: 1 << 27, // 134217728 - Create/edit master document list, bulk imports
  SUBMIT_DOCUMENTS: 1 << 28, // 268435456 - Submit documents for review
  REVIEW_DOCUMENTS: 1 << 29, // 536870912 - Client review/comment on documents (external users)
  APPROVE_DOCUMENTS: 1 << 30, // 1073741824 - Approve document submissions & comment resolutions

  // Note: Bit 31 is reserved (sign bit issues in JavaScript)
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
  MANAGE_CHART_OF_ACCOUNTS: 1048576,
  CREATE_TRANSACTIONS: 2097152,
  APPROVE_TRANSACTIONS: 4194304,
  VIEW_FINANCIAL_REPORTS: 8388608,
  MANAGE_COST_CENTRES: 16777216,
  MANAGE_FOREX: 33554432,
  RECONCILE_ACCOUNTS: 67108864,
  // Document Management
  MANAGE_DOCUMENTS: 134217728,
  SUBMIT_DOCUMENTS: 268435456,
  REVIEW_DOCUMENTS: 536870912,
  APPROVE_DOCUMENTS: 1073741824,
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
 * Accounting permission helpers
 * Granular accounting permissions for Chart of Accounts, transactions, reports, etc.
 */
export function canViewAccounting(permissions: number): boolean {
  return hasPermission(permissions, PERMISSION_FLAGS.VIEW_ACCOUNTING);
}

export function canManageAccounting(permissions: number): boolean {
  return hasPermission(permissions, PERMISSION_FLAGS.MANAGE_ACCOUNTING);
}

export function canManageChartOfAccounts(permissions: number): boolean {
  return hasPermission(permissions, PERMISSION_FLAGS.MANAGE_CHART_OF_ACCOUNTS);
}

export function canCreateTransactions(permissions: number): boolean {
  return hasPermission(permissions, PERMISSION_FLAGS.CREATE_TRANSACTIONS);
}

export function canApproveTransactions(permissions: number): boolean {
  return hasPermission(permissions, PERMISSION_FLAGS.APPROVE_TRANSACTIONS);
}

export function canViewFinancialReports(permissions: number): boolean {
  return hasPermission(permissions, PERMISSION_FLAGS.VIEW_FINANCIAL_REPORTS);
}

export function canManageCostCentres(permissions: number): boolean {
  return hasPermission(permissions, PERMISSION_FLAGS.MANAGE_COST_CENTRES);
}

export function canManageForex(permissions: number): boolean {
  return hasPermission(permissions, PERMISSION_FLAGS.MANAGE_FOREX);
}

export function canReconcileAccounts(permissions: number): boolean {
  return hasPermission(permissions, PERMISSION_FLAGS.RECONCILE_ACCOUNTS);
}

/**
 * Procurement permission helpers
 */
export function canViewProcurement(permissions: number): boolean {
  return hasPermission(permissions, PERMISSION_FLAGS.VIEW_PROCUREMENT);
}

export function canManageProcurement(permissions: number): boolean {
  return hasPermission(permissions, PERMISSION_FLAGS.MANAGE_PROCUREMENT);
}

/**
 * Estimation permission helpers
 */
export function canViewEstimation(permissions: number): boolean {
  return hasPermission(permissions, PERMISSION_FLAGS.VIEW_ESTIMATION);
}

export function canManageEstimation(permissions: number): boolean {
  return hasPermission(permissions, PERMISSION_FLAGS.MANAGE_ESTIMATION);
}

/**
 * Time Tracking permission helpers
 */
export function canViewTimeTracking(permissions: number): boolean {
  return hasPermission(permissions, PERMISSION_FLAGS.VIEW_TIME_TRACKING);
}

export function canManageTimeTracking(permissions: number): boolean {
  return hasPermission(permissions, PERMISSION_FLAGS.MANAGE_TIME_TRACKING);
}

/**
 * Document Management permission helpers
 */
export function canManageDocuments(permissions: number): boolean {
  return hasPermission(permissions, PERMISSION_FLAGS.MANAGE_DOCUMENTS);
}

export function canSubmitDocuments(permissions: number): boolean {
  return hasPermission(permissions, PERMISSION_FLAGS.SUBMIT_DOCUMENTS);
}

export function canReviewDocuments(permissions: number): boolean {
  return hasPermission(permissions, PERMISSION_FLAGS.REVIEW_DOCUMENTS);
}

export function canApproveDocuments(permissions: number): boolean {
  return hasPermission(permissions, PERMISSION_FLAGS.APPROVE_DOCUMENTS);
}

/**
 * Permission presets for common user types
 * These are convenience presets for quickly setting up users.
 * Not tied to any "role" concept - just predefined permission combinations.
 */
export const PERMISSION_PRESETS = {
  // Full access - all permissions
  FULL_ACCESS: getAllPermissions(),

  // Manager level - broad access without system admin
  MANAGER:
    PERMISSION_FLAGS.MANAGE_PROJECTS |
    PERMISSION_FLAGS.VIEW_PROJECTS |
    PERMISSION_FLAGS.VIEW_ENTITIES |
    PERMISSION_FLAGS.CREATE_ENTITIES |
    PERMISSION_FLAGS.EDIT_ENTITIES |
    PERMISSION_FLAGS.VIEW_ANALYTICS |
    PERMISSION_FLAGS.EXPORT_DATA |
    PERMISSION_FLAGS.VIEW_TIME_TRACKING |
    PERMISSION_FLAGS.VIEW_ACCOUNTING |
    PERMISSION_FLAGS.VIEW_PROCUREMENT |
    PERMISSION_FLAGS.VIEW_ESTIMATION,

  // Finance access
  FINANCE:
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
    PERMISSION_FLAGS.MANAGE_FOREX |
    PERMISSION_FLAGS.RECONCILE_ACCOUNTS,

  // Engineering access
  ENGINEERING:
    PERMISSION_FLAGS.VIEW_PROJECTS |
    PERMISSION_FLAGS.VIEW_ENTITIES |
    PERMISSION_FLAGS.MANAGE_ESTIMATION |
    PERMISSION_FLAGS.VIEW_ESTIMATION |
    PERMISSION_FLAGS.VIEW_PROCUREMENT |
    PERMISSION_FLAGS.SUBMIT_DOCUMENTS, // Engineers can submit documents

  // Project Manager access - includes document management
  PROJECT_MANAGER:
    PERMISSION_FLAGS.MANAGE_PROJECTS |
    PERMISSION_FLAGS.VIEW_PROJECTS |
    PERMISSION_FLAGS.VIEW_ENTITIES |
    PERMISSION_FLAGS.CREATE_ENTITIES |
    PERMISSION_FLAGS.VIEW_ANALYTICS |
    PERMISSION_FLAGS.VIEW_PROCUREMENT |
    PERMISSION_FLAGS.VIEW_ESTIMATION |
    PERMISSION_FLAGS.MANAGE_DOCUMENTS | // Can manage master document list
    PERMISSION_FLAGS.SUBMIT_DOCUMENTS |
    PERMISSION_FLAGS.APPROVE_DOCUMENTS, // Can approve document submissions

  // Procurement access
  PROCUREMENT:
    PERMISSION_FLAGS.VIEW_PROJECTS |
    PERMISSION_FLAGS.VIEW_ENTITIES |
    PERMISSION_FLAGS.CREATE_ENTITIES |
    PERMISSION_FLAGS.EDIT_ENTITIES |
    PERMISSION_FLAGS.MANAGE_PROCUREMENT |
    PERMISSION_FLAGS.VIEW_PROCUREMENT |
    PERMISSION_FLAGS.VIEW_ESTIMATION,

  // Read-only access
  VIEWER:
    PERMISSION_FLAGS.VIEW_PROJECTS |
    PERMISSION_FLAGS.VIEW_ENTITIES |
    PERMISSION_FLAGS.VIEW_TIME_TRACKING |
    PERMISSION_FLAGS.VIEW_ACCOUNTING |
    PERMISSION_FLAGS.VIEW_PROCUREMENT |
    PERMISSION_FLAGS.VIEW_ESTIMATION,
} as const;
