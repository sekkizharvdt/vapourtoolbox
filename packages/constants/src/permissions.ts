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

  // Proposal Management (bits 20-21)
  VIEW_PROPOSALS: 1 << 20, // 1048576 - View proposals and enquiries
  MANAGE_PROPOSALS: 1 << 21, // 2097152 - Create/edit proposals and enquiries

  // DEPRECATED: Granular Accounting Permissions (bits 22-26) - No longer used
  // These flags existed in old code but are now superseded by VIEW_ACCOUNTING/MANAGE_ACCOUNTING
  // Keeping the bit assignments documented for backward compatibility during migration
  // _DEPRECATED_APPROVE_TRANSACTIONS: 1 << 22, // 4194304
  // _DEPRECATED_VIEW_FINANCIAL_REPORTS: 1 << 23, // 8388608
  // _DEPRECATED_MANAGE_COST_CENTRES: 1 << 24, // 16777216
  // _DEPRECATED_MANAGE_FOREX: 1 << 25, // 33554432
  // _DEPRECATED_RECONCILE_ACCOUNTS: 1 << 26, // 67108864

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
  VIEW_PROPOSALS: 1048576,
  MANAGE_PROPOSALS: 2097152,
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
 */
export function canViewAccounting(permissions: number): boolean {
  return hasPermission(permissions, PERMISSION_FLAGS.VIEW_ACCOUNTING);
}

export function canManageAccounting(permissions: number): boolean {
  return hasPermission(permissions, PERMISSION_FLAGS.MANAGE_ACCOUNTING);
}

/**
 * Proposal permission helpers
 */
export function canViewProposals(permissions: number): boolean {
  return hasPermission(permissions, PERMISSION_FLAGS.VIEW_PROPOSALS);
}

export function canManageProposals(permissions: number): boolean {
  return hasPermission(permissions, PERMISSION_FLAGS.MANAGE_PROPOSALS);
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
    PERMISSION_FLAGS.VIEW_ACCOUNTING,

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

/**
 * Extended Permission Flags (permissions2 field)
 *
 * These permissions are stored in a separate `permissions2` field
 * because the original `permissions` field has exhausted all 31 usable bits.
 *
 * Same bitwise operations apply:
 * - Check: (userPermissions2 & requiredPerm) === requiredPerm
 * - Add: permissions2 | newPerm
 * - Remove: permissions2 & ~newPerm
 */
export const PERMISSION_FLAGS_2 = {
  // Material Database (bits 0-1)
  VIEW_MATERIAL_DB: 1 << 0, // 1
  MANAGE_MATERIAL_DB: 1 << 1, // 2

  // Shape Database (bits 2-3)
  VIEW_SHAPE_DB: 1 << 2, // 4
  MANAGE_SHAPE_DB: 1 << 3, // 8

  // Bought Out Database (bits 4-5)
  VIEW_BOUGHT_OUT_DB: 1 << 4, // 16
  MANAGE_BOUGHT_OUT_DB: 1 << 5, // 32

  // Thermal Desalination (bits 6-7) - includes Flash Chamber
  VIEW_THERMAL_DESAL: 1 << 6, // 64
  MANAGE_THERMAL_DESAL: 1 << 7, // 128

  // Thermal Calculators (bits 8-9)
  VIEW_THERMAL_CALCS: 1 << 8, // 256
  MANAGE_THERMAL_CALCS: 1 << 9, // 512

  // SSOT / Process Data (bits 10-11)
  VIEW_SSOT: 1 << 10, // 1024
  MANAGE_SSOT: 1 << 11, // 2048
} as const;

/**
 * Permission bit positions for permissions2 (for Firestore rules)
 */
export const PERMISSION_BITS_2 = {
  VIEW_MATERIAL_DB: 1,
  MANAGE_MATERIAL_DB: 2,
  VIEW_SHAPE_DB: 4,
  MANAGE_SHAPE_DB: 8,
  VIEW_BOUGHT_OUT_DB: 16,
  MANAGE_BOUGHT_OUT_DB: 32,
  VIEW_THERMAL_DESAL: 64,
  MANAGE_THERMAL_DESAL: 128,
  VIEW_THERMAL_CALCS: 256,
  MANAGE_THERMAL_CALCS: 512,
  VIEW_SSOT: 1024,
  MANAGE_SSOT: 2048,
} as const;

/**
 * Helper function to check if a permission2 is included
 */
export function hasPermission2(userPermissions2: number, requiredPermission: number): boolean {
  return (userPermissions2 & requiredPermission) === requiredPermission;
}

/**
 * Calculate all permissions2 (for SUPER_ADMIN)
 */
export function getAllPermissions2(): number {
  return Object.values(PERMISSION_FLAGS_2).reduce((acc, perm) => acc | perm, 0);
}

/**
 * Material Database permission helpers
 */
export function canViewMaterialDB(permissions2: number): boolean {
  return hasPermission2(permissions2, PERMISSION_FLAGS_2.VIEW_MATERIAL_DB);
}

export function canManageMaterialDB(permissions2: number): boolean {
  return hasPermission2(permissions2, PERMISSION_FLAGS_2.MANAGE_MATERIAL_DB);
}

/**
 * Shape Database permission helpers
 */
export function canViewShapeDB(permissions2: number): boolean {
  return hasPermission2(permissions2, PERMISSION_FLAGS_2.VIEW_SHAPE_DB);
}

export function canManageShapeDB(permissions2: number): boolean {
  return hasPermission2(permissions2, PERMISSION_FLAGS_2.MANAGE_SHAPE_DB);
}

/**
 * Bought Out Database permission helpers
 */
export function canViewBoughtOutDB(permissions2: number): boolean {
  return hasPermission2(permissions2, PERMISSION_FLAGS_2.VIEW_BOUGHT_OUT_DB);
}

export function canManageBoughtOutDB(permissions2: number): boolean {
  return hasPermission2(permissions2, PERMISSION_FLAGS_2.MANAGE_BOUGHT_OUT_DB);
}

/**
 * Thermal Desalination permission helpers (includes Flash Chamber)
 */
export function canViewThermalDesal(permissions2: number): boolean {
  return hasPermission2(permissions2, PERMISSION_FLAGS_2.VIEW_THERMAL_DESAL);
}

export function canManageThermalDesal(permissions2: number): boolean {
  return hasPermission2(permissions2, PERMISSION_FLAGS_2.MANAGE_THERMAL_DESAL);
}

/**
 * Thermal Calculators permission helpers
 */
export function canViewThermalCalcs(permissions2: number): boolean {
  return hasPermission2(permissions2, PERMISSION_FLAGS_2.VIEW_THERMAL_CALCS);
}

export function canManageThermalCalcs(permissions2: number): boolean {
  return hasPermission2(permissions2, PERMISSION_FLAGS_2.MANAGE_THERMAL_CALCS);
}

/**
 * SSOT / Process Data permission helpers
 */
export function canViewSSOT(permissions2: number): boolean {
  return hasPermission2(permissions2, PERMISSION_FLAGS_2.VIEW_SSOT);
}

export function canManageSSOT(permissions2: number): boolean {
  return hasPermission2(permissions2, PERMISSION_FLAGS_2.MANAGE_SSOT);
}

/**
 * Restricted Modules Configuration
 *
 * Defines which modules require View/Manage permissions.
 * Used by EditUserDialog and user permission displays.
 */
export interface RestrictedModule {
  id: string;
  name: string;
  viewFlag: number;
  manageFlag: number;
  /** Which permission field to check: 'permissions' (default) or 'permissions2' */
  field?: 'permissions' | 'permissions2';
  /** Optional note shown in UI */
  note?: string;
}

export const RESTRICTED_MODULES: RestrictedModule[] = [
  {
    id: 'projects',
    name: 'Projects',
    viewFlag: PERMISSION_FLAGS.VIEW_PROJECTS,
    manageFlag: PERMISSION_FLAGS.MANAGE_PROJECTS,
  },
  {
    id: 'procurement',
    name: 'Procurement',
    viewFlag: PERMISSION_FLAGS.VIEW_PROCUREMENT,
    manageFlag: PERMISSION_FLAGS.MANAGE_PROCUREMENT,
  },
  {
    id: 'accounting',
    name: 'Accounting',
    viewFlag: PERMISSION_FLAGS.VIEW_ACCOUNTING,
    manageFlag: PERMISSION_FLAGS.MANAGE_ACCOUNTING,
  },
  {
    id: 'thermal-desal',
    name: 'Thermal Desalination',
    viewFlag: PERMISSION_FLAGS_2.VIEW_THERMAL_DESAL,
    manageFlag: PERMISSION_FLAGS_2.MANAGE_THERMAL_DESAL,
    field: 'permissions2',
  },
  {
    id: 'process-data',
    name: 'Process Data (SSOT)',
    viewFlag: PERMISSION_FLAGS_2.VIEW_SSOT,
    manageFlag: PERMISSION_FLAGS_2.MANAGE_SSOT,
    field: 'permissions2',
  },
  {
    id: 'proposals',
    name: 'Proposals',
    viewFlag: PERMISSION_FLAGS.VIEW_PROPOSALS,
    manageFlag: PERMISSION_FLAGS.MANAGE_PROPOSALS,
  },
  {
    id: 'entities',
    name: 'Entities',
    viewFlag: PERMISSION_FLAGS.VIEW_ENTITIES,
    manageFlag: PERMISSION_FLAGS.CREATE_ENTITIES,
  },
];

/**
 * Open Modules (no permission required)
 * These modules are accessible to all authenticated users.
 */
export const OPEN_MODULES = [
  'Flow (Time Tracking)',
  'Documents',
  'Estimation',
  'Thermal Calculators',
  'Material Database',
  'Shape Database',
  'Bought Out Items',
] as const;
