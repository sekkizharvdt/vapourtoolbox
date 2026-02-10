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
  /** @deprecated User management module is admin-only. Kept for backward compatibility. */
  VIEW_USERS: 1 << 1, // 2 - DEPRECATED: Admin access requires MANAGE_USERS
  /** @deprecated Role system has been removed. Kept for backward compatibility. */
  MANAGE_ROLES: 1 << 2, // 4 - DEPRECATED: Role system removed

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
  /** @deprecated Flow module is now open to everyone. Kept for backward compatibility. */
  MANAGE_TIME_TRACKING: 1 << 12, // 4096 - DEPRECATED: Flow module is open
  VIEW_TIME_TRACKING: 1 << 13, // 8192 - Admin-only for viewing reports

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
 * Helper function to check if a permission is included
 */
export function hasPermission(userPermissions: number, requiredPermission: number): boolean {
  return (userPermissions & requiredPermission) === requiredPermission;
}

/**
 * Check if user has ANY of the specified permissions
 */
export function hasAnyPermission(userPermissions: number, ...permissions: number[]): boolean {
  return permissions.some((perm) => hasPermission(userPermissions, perm));
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

  // HR Module (bits 12-15)
  VIEW_HR: 1 << 12, // 4096 - View HR module (leaves, balances)
  MANAGE_HR_SETTINGS: 1 << 13, // 8192 - Configure leave types, policies
  APPROVE_LEAVES: 1 << 14, // 16384 - Approve/reject leave requests
  MANAGE_HR_PROFILES: 1 << 15, // 32768 - Edit employee HR profiles

  // Admin Module (bit 16)
  MANAGE_ADMIN: 1 << 16, // 65536 - Access admin panel, manage system settings

  // Goods Receipt Operations (bits 17-18)
  INSPECT_GOODS: 1 << 17, // 131072 - Create GRs, inspect received goods
  APPROVE_GR: 1 << 18, // 262144 - Approve GRs, send to accounting
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
 * HR Module permission helpers
 */
export function canViewHR(permissions2: number): boolean {
  return hasPermission2(permissions2, PERMISSION_FLAGS_2.VIEW_HR);
}

export function canManageHRSettings(permissions2: number): boolean {
  return hasPermission2(permissions2, PERMISSION_FLAGS_2.MANAGE_HR_SETTINGS);
}

export function canApproveLeaves(permissions2: number): boolean {
  return hasPermission2(permissions2, PERMISSION_FLAGS_2.APPROVE_LEAVES);
}

export function canManageHRProfiles(permissions2: number): boolean {
  return hasPermission2(permissions2, PERMISSION_FLAGS_2.MANAGE_HR_PROFILES);
}

/**
 * Admin Module permission helpers
 */
export function canManageAdmin(permissions2: number): boolean {
  return hasPermission2(permissions2, PERMISSION_FLAGS_2.MANAGE_ADMIN);
}

/**
 * Goods Receipt permission helpers
 */
export function canInspectGoods(permissions2: number): boolean {
  return hasPermission2(permissions2, PERMISSION_FLAGS_2.INSPECT_GOODS);
}

export function canApproveGR(permissions2: number): boolean {
  return hasPermission2(permissions2, PERMISSION_FLAGS_2.APPROVE_GR);
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
  {
    id: 'hr',
    name: 'HR & Leave Management',
    viewFlag: PERMISSION_FLAGS_2.VIEW_HR,
    manageFlag: PERMISSION_FLAGS_2.MANAGE_HR_SETTINGS,
    field: 'permissions2',
  },
];

/**
 * Open Modules (no permission required)
 * These modules are accessible to all authenticated users.
 */
export const OPEN_MODULES = [
  'Flow (Tasks & Time)',
  'Company Documents (viewing)',
  'Thermal Calculators (viewing)',
  'Material Database (viewing)',
  'Shape Database (viewing)',
  'Bought Out Items (viewing)',
  'HR Module (My Leaves, Expenses, Calendar, Directory)',
] as const;

/**
 * Permission Item for flat permission list
 * Used by EditUserDialog and ApproveUserDialog for granular permission control
 */
export interface PermissionItem {
  /** Permission flag value */
  flag: number;
  /** Display label for the permission */
  label: string;
  /** Description of what the permission allows */
  description: string;
  /** Which permission field to check: 'permissions' or 'permissions2' */
  field: 'permissions' | 'permissions2';
  /** If true, only shown in admin section of the UI */
  adminOnly: boolean;
}

/**
 * Complete list of all permissions for the user management UI
 *
 * This provides a flat list of all permission flags with their metadata,
 * categorized into regular permissions (shown to all admins) and
 * admin-only permissions (sensitive system-level access).
 *
 * Used by:
 * - EditUserDialog for editing user permissions
 * - ApproveUserDialog for setting up new user permissions
 */
export const ALL_PERMISSIONS: PermissionItem[] = [
  // ==========================================
  // Regular Permissions (permissions field)
  // ==========================================
  {
    flag: PERMISSION_FLAGS.VIEW_PROJECTS,
    label: 'View Projects',
    description: 'View project details and lists',
    field: 'permissions',
    adminOnly: false,
  },
  {
    flag: PERMISSION_FLAGS.MANAGE_PROJECTS,
    label: 'Manage Projects',
    description: 'Create, edit, and archive projects',
    field: 'permissions',
    adminOnly: false,
  },
  {
    flag: PERMISSION_FLAGS.VIEW_ENTITIES,
    label: 'View Entities',
    description: 'View vendors, customers, and other entities',
    field: 'permissions',
    adminOnly: false,
  },
  {
    flag: PERMISSION_FLAGS.CREATE_ENTITIES,
    label: 'Create Entities',
    description: 'Create new vendors, customers, and entities',
    field: 'permissions',
    adminOnly: false,
  },
  {
    flag: PERMISSION_FLAGS.VIEW_ACCOUNTING,
    label: 'View Accounting',
    description: 'View transactions and financial reports',
    field: 'permissions',
    adminOnly: false,
  },
  {
    flag: PERMISSION_FLAGS.MANAGE_ACCOUNTING,
    label: 'Manage Accounting',
    description: 'Create transactions, manage accounts',
    field: 'permissions',
    adminOnly: false,
  },
  {
    flag: PERMISSION_FLAGS.VIEW_PROCUREMENT,
    label: 'View Procurement',
    description: 'View PRs, RFQs, and POs',
    field: 'permissions',
    adminOnly: false,
  },
  {
    flag: PERMISSION_FLAGS.MANAGE_PROCUREMENT,
    label: 'Manage Procurement',
    description: 'Create and edit PRs, RFQs, and POs',
    field: 'permissions',
    adminOnly: false,
  },
  {
    flag: PERMISSION_FLAGS.VIEW_ESTIMATION,
    label: 'View Estimation',
    description: 'View estimates and BOMs',
    field: 'permissions',
    adminOnly: false,
  },
  {
    flag: PERMISSION_FLAGS.MANAGE_ESTIMATION,
    label: 'Manage Estimation',
    description: 'Create and edit estimates',
    field: 'permissions',
    adminOnly: false,
  },
  {
    flag: PERMISSION_FLAGS.VIEW_PROPOSALS,
    label: 'View Proposals',
    description: 'View proposals and enquiries',
    field: 'permissions',
    adminOnly: false,
  },
  {
    flag: PERMISSION_FLAGS.MANAGE_PROPOSALS,
    label: 'Manage Proposals',
    description: 'Create and edit proposals',
    field: 'permissions',
    adminOnly: false,
  },

  // ==========================================
  // Regular Permissions (permissions2 field)
  // ==========================================
  {
    flag: PERMISSION_FLAGS_2.VIEW_THERMAL_DESAL,
    label: 'View Thermal Desalination',
    description: 'View thermal desalination module',
    field: 'permissions2',
    adminOnly: false,
  },
  {
    flag: PERMISSION_FLAGS_2.MANAGE_THERMAL_DESAL,
    label: 'Manage Thermal Desalination',
    description: 'Edit thermal desalination data',
    field: 'permissions2',
    adminOnly: false,
  },
  {
    flag: PERMISSION_FLAGS_2.VIEW_SSOT,
    label: 'View Process Data (SSOT)',
    description: 'View process data',
    field: 'permissions2',
    adminOnly: false,
  },
  {
    flag: PERMISSION_FLAGS_2.MANAGE_SSOT,
    label: 'Manage Process Data (SSOT)',
    description: 'Edit process data',
    field: 'permissions2',
    adminOnly: false,
  },
  {
    flag: PERMISSION_FLAGS_2.MANAGE_MATERIAL_DB,
    label: 'Manage Material Database',
    description: 'Edit material database entries',
    field: 'permissions2',
    adminOnly: false,
  },
  {
    flag: PERMISSION_FLAGS_2.MANAGE_SHAPE_DB,
    label: 'Manage Shape Database',
    description: 'Edit shape database entries',
    field: 'permissions2',
    adminOnly: false,
  },
  {
    flag: PERMISSION_FLAGS_2.MANAGE_BOUGHT_OUT_DB,
    label: 'Manage Bought Out Items',
    description: 'Edit bought-out database entries',
    field: 'permissions2',
    adminOnly: false,
  },
  {
    flag: PERMISSION_FLAGS_2.MANAGE_HR_SETTINGS,
    label: 'Manage HR Settings',
    description: 'Configure leave types and policies',
    field: 'permissions2',
    adminOnly: false,
  },
  {
    flag: PERMISSION_FLAGS_2.APPROVE_LEAVES,
    label: 'Approve Leaves',
    description: 'Approve or reject leave requests',
    field: 'permissions2',
    adminOnly: false,
  },
  {
    flag: PERMISSION_FLAGS_2.MANAGE_HR_PROFILES,
    label: 'Manage HR Profiles',
    description: 'Edit employee HR profiles',
    field: 'permissions2',
    adminOnly: false,
  },
  {
    flag: PERMISSION_FLAGS_2.INSPECT_GOODS,
    label: 'Inspect Goods',
    description: 'Create goods receipts and inspect received items',
    field: 'permissions2',
    adminOnly: false,
  },
  {
    flag: PERMISSION_FLAGS_2.APPROVE_GR,
    label: 'Approve Goods Receipts',
    description: 'Approve goods receipts and send to accounting',
    field: 'permissions2',
    adminOnly: false,
  },

  // ==========================================
  // Admin-Only Permissions (permissions field)
  // ==========================================
  {
    flag: PERMISSION_FLAGS.MANAGE_USERS,
    label: 'Manage Users',
    description: 'Create, edit, and deactivate users',
    field: 'permissions',
    adminOnly: true,
  },
  {
    flag: PERMISSION_FLAGS.VIEW_USERS,
    label: 'View Users',
    description: 'View user list and profiles',
    field: 'permissions',
    adminOnly: true,
  },
  {
    flag: PERMISSION_FLAGS.EDIT_ENTITIES,
    label: 'Edit Entities',
    description: 'Edit existing entities',
    field: 'permissions',
    adminOnly: true,
  },
  {
    flag: PERMISSION_FLAGS.DELETE_ENTITIES,
    label: 'Delete Entities',
    description: 'Delete or archive entities',
    field: 'permissions',
    adminOnly: true,
  },
  {
    flag: PERMISSION_FLAGS.MANAGE_COMPANY_SETTINGS,
    label: 'Manage Company Settings',
    description: 'Configure company-wide settings',
    field: 'permissions',
    adminOnly: true,
  },
  {
    flag: PERMISSION_FLAGS.VIEW_ANALYTICS,
    label: 'View Analytics',
    description: 'View analytics dashboards',
    field: 'permissions',
    adminOnly: true,
  },
  {
    flag: PERMISSION_FLAGS.EXPORT_DATA,
    label: 'Export Data',
    description: 'Export data and reports',
    field: 'permissions',
    adminOnly: true,
  },
  {
    flag: PERMISSION_FLAGS.VIEW_TIME_TRACKING,
    label: 'View Time Reports',
    description: 'View task summaries and time reports',
    field: 'permissions',
    adminOnly: true,
  },
  {
    flag: PERMISSION_FLAGS.MANAGE_DOCUMENTS,
    label: 'Manage Company Documents',
    description: 'Upload SOPs, policies, and templates',
    field: 'permissions',
    adminOnly: true,
  },

  // ==========================================
  // Admin-Only Permissions (permissions2 field)
  // ==========================================
  {
    flag: PERMISSION_FLAGS_2.MANAGE_THERMAL_CALCS,
    label: 'Configure Thermal Calculators',
    description: 'Configure thermal calculator settings',
    field: 'permissions2',
    adminOnly: true,
  },
  {
    flag: PERMISSION_FLAGS_2.MANAGE_ADMIN,
    label: 'Manage Admin Panel',
    description: 'Access admin panel and manage system settings',
    field: 'permissions2',
    adminOnly: true,
  },
];

/**
 * Permission Definition
 * Defines a single permission within a permission module
 */
export interface PermissionDef {
  /** Permission flag value */
  flag: number;
  /** Short label for the permission */
  label: string;
  /** Longer description of what the permission allows */
  description: string;
  /** Category: 'view', 'manage', 'approve', or 'action' */
  category: 'view' | 'manage' | 'approve' | 'action';
  /** Which permission field to check: 'permissions' (default) or 'permissions2' */
  field?: 'permissions' | 'permissions2';
}

/**
 * Permission Module Definition for Permission Matrix
 * Groups permissions by logical business module
 */
export interface PermissionModuleDef {
  /** Module identifier (kebab-case) */
  id: string;
  /** Display name for the module */
  name: string;
  /** Brief description of the module */
  description: string;
  /** Permissions available in this module */
  permissions: PermissionDef[];
}

/**
 * Comprehensive Module Permissions Mapping
 *
 * This is the single source of truth for:
 * - Which modules exist in the system
 * - What permissions each module has
 * - How to check permissions (which field, which flag)
 *
 * Used by:
 * - Permission Matrix page (dual views: by module, by user)
 * - User management dialogs
 * - Authorization checks throughout the app
 */
export const MODULE_PERMISSIONS: PermissionModuleDef[] = [
  {
    id: 'admin',
    name: 'Admin Panel',
    description: 'System administration and settings',
    permissions: [
      {
        flag: PERMISSION_FLAGS_2.MANAGE_ADMIN,
        label: 'Manage',
        description: 'Access admin panel and manage system settings',
        category: 'manage',
        field: 'permissions2',
      },
    ],
  },
  {
    id: 'user-management',
    name: 'User Management',
    description: 'Manage users and their permissions',
    // Admin-only module - requires MANAGE_USERS to access /admin section
    // No View permission - user management requires full admin access
    permissions: [
      {
        flag: PERMISSION_FLAGS.MANAGE_USERS,
        label: 'Manage Users',
        description: 'Create, edit, and manage user permissions',
        category: 'manage',
      },
    ],
  },
  {
    id: 'projects',
    name: 'Projects',
    description: 'Project creation and management',
    permissions: [
      {
        flag: PERMISSION_FLAGS.VIEW_PROJECTS,
        label: 'View',
        description: 'View projects and project details',
        category: 'view',
      },
      {
        flag: PERMISSION_FLAGS.MANAGE_PROJECTS,
        label: 'Manage',
        description: 'Create, edit, and archive projects',
        category: 'manage',
      },
    ],
  },
  {
    id: 'entities',
    name: 'Entities',
    description: 'Vendors, customers, and other entities',
    permissions: [
      {
        flag: PERMISSION_FLAGS.VIEW_ENTITIES,
        label: 'View',
        description: 'View entity list and details',
        category: 'view',
      },
      {
        flag: PERMISSION_FLAGS.CREATE_ENTITIES,
        label: 'Create',
        description: 'Create new entities',
        category: 'action',
      },
      {
        flag: PERMISSION_FLAGS.EDIT_ENTITIES,
        label: 'Edit',
        description: 'Edit existing entities',
        category: 'manage',
      },
      {
        flag: PERMISSION_FLAGS.DELETE_ENTITIES,
        label: 'Delete',
        description: 'Delete or archive entities',
        category: 'manage',
      },
    ],
  },
  {
    id: 'procurement',
    name: 'Procurement',
    description: 'Purchase requests, RFQs, and purchase orders',
    permissions: [
      {
        flag: PERMISSION_FLAGS.VIEW_PROCUREMENT,
        label: 'View',
        description: 'View PRs, RFQs, and POs',
        category: 'view',
      },
      {
        flag: PERMISSION_FLAGS.MANAGE_PROCUREMENT,
        label: 'Manage',
        description: 'Create and edit PRs, RFQs, and POs',
        category: 'manage',
      },
      {
        flag: PERMISSION_FLAGS_2.INSPECT_GOODS,
        label: 'Inspect Goods',
        description: 'Create goods receipts and inspect received items',
        category: 'action',
        field: 'permissions2',
      },
      {
        flag: PERMISSION_FLAGS_2.APPROVE_GR,
        label: 'Approve GR',
        description: 'Approve goods receipts and send to accounting',
        category: 'approve',
        field: 'permissions2',
      },
    ],
  },
  {
    id: 'accounting',
    name: 'Accounting',
    description: 'Financial transactions and reporting',
    permissions: [
      {
        flag: PERMISSION_FLAGS.VIEW_ACCOUNTING,
        label: 'View',
        description: 'View transactions and reports',
        category: 'view',
      },
      {
        flag: PERMISSION_FLAGS.MANAGE_ACCOUNTING,
        label: 'Manage',
        description: 'Create transactions, manage accounts',
        category: 'manage',
      },
    ],
  },
  {
    id: 'estimation',
    name: 'Estimation',
    description: 'Cost estimation and BOMs',
    permissions: [
      {
        flag: PERMISSION_FLAGS.VIEW_ESTIMATION,
        label: 'View',
        description: 'View estimates and BOMs',
        category: 'view',
      },
      {
        flag: PERMISSION_FLAGS.MANAGE_ESTIMATION,
        label: 'Manage',
        description: 'Create and edit estimates',
        category: 'manage',
      },
    ],
  },
  {
    id: 'proposals',
    name: 'Proposals & Enquiries',
    description: 'Proposals and customer enquiries',
    permissions: [
      {
        flag: PERMISSION_FLAGS.VIEW_PROPOSALS,
        label: 'View',
        description: 'View proposals and enquiries',
        category: 'view',
      },
      {
        flag: PERMISSION_FLAGS.MANAGE_PROPOSALS,
        label: 'Manage',
        description: 'Create and edit proposals',
        category: 'manage',
      },
    ],
  },
  {
    id: 'documents',
    name: 'Document Management',
    description: 'Project documents and submissions',
    permissions: [
      {
        flag: PERMISSION_FLAGS.MANAGE_DOCUMENTS,
        label: 'Manage',
        description: 'Manage master document list',
        category: 'manage',
      },
      {
        flag: PERMISSION_FLAGS.SUBMIT_DOCUMENTS,
        label: 'Submit',
        description: 'Submit documents for review',
        category: 'action',
      },
      {
        flag: PERMISSION_FLAGS.REVIEW_DOCUMENTS,
        label: 'Review',
        description: 'Review and comment on documents',
        category: 'action',
      },
      {
        flag: PERMISSION_FLAGS.APPROVE_DOCUMENTS,
        label: 'Approve',
        description: 'Approve document submissions',
        category: 'approve',
      },
    ],
  },
  {
    id: 'time-tracking',
    name: 'Time Tracking',
    description: 'Time entries and timesheets',
    permissions: [
      {
        flag: PERMISSION_FLAGS.VIEW_TIME_TRACKING,
        label: 'View',
        description: 'View timesheets and reports',
        category: 'view',
      },
      {
        flag: PERMISSION_FLAGS.MANAGE_TIME_TRACKING,
        label: 'Manage',
        description: 'Manage time tracking settings',
        category: 'manage',
      },
    ],
  },
  {
    id: 'analytics',
    name: 'Analytics & Reporting',
    description: 'Reports and data analytics',
    permissions: [
      {
        flag: PERMISSION_FLAGS.VIEW_ANALYTICS,
        label: 'View',
        description: 'View analytics dashboards',
        category: 'view',
      },
      {
        flag: PERMISSION_FLAGS.EXPORT_DATA,
        label: 'Export',
        description: 'Export data and reports',
        category: 'action',
      },
    ],
  },
  {
    id: 'company-settings',
    name: 'Company Settings',
    description: 'System-wide company configuration',
    permissions: [
      {
        flag: PERMISSION_FLAGS.MANAGE_COMPANY_SETTINGS,
        label: 'Manage',
        description: 'Configure company settings',
        category: 'manage',
      },
    ],
  },
  // permissions2 modules
  {
    id: 'materials',
    name: 'Material Database',
    description: 'Material specifications and pricing',
    permissions: [
      {
        flag: PERMISSION_FLAGS_2.VIEW_MATERIAL_DB,
        label: 'View',
        description: 'View material database',
        category: 'view',
        field: 'permissions2',
      },
      {
        flag: PERMISSION_FLAGS_2.MANAGE_MATERIAL_DB,
        label: 'Manage',
        description: 'Edit material database',
        category: 'manage',
        field: 'permissions2',
      },
    ],
  },
  {
    id: 'shapes',
    name: 'Shape Database',
    description: 'Shape formulas and calculations',
    permissions: [
      {
        flag: PERMISSION_FLAGS_2.VIEW_SHAPE_DB,
        label: 'View',
        description: 'View shape database',
        category: 'view',
        field: 'permissions2',
      },
      {
        flag: PERMISSION_FLAGS_2.MANAGE_SHAPE_DB,
        label: 'Manage',
        description: 'Edit shape database',
        category: 'manage',
        field: 'permissions2',
      },
    ],
  },
  {
    id: 'bought-out',
    name: 'Bought Out Items',
    description: 'Bought-out components and assemblies',
    permissions: [
      {
        flag: PERMISSION_FLAGS_2.VIEW_BOUGHT_OUT_DB,
        label: 'View',
        description: 'View bought-out database',
        category: 'view',
        field: 'permissions2',
      },
      {
        flag: PERMISSION_FLAGS_2.MANAGE_BOUGHT_OUT_DB,
        label: 'Manage',
        description: 'Edit bought-out database',
        category: 'manage',
        field: 'permissions2',
      },
    ],
  },
  {
    id: 'thermal-desal',
    name: 'Thermal Desalination',
    description: 'Flash chamber and thermal calculations',
    permissions: [
      {
        flag: PERMISSION_FLAGS_2.VIEW_THERMAL_DESAL,
        label: 'View',
        description: 'View thermal desalination module',
        category: 'view',
        field: 'permissions2',
      },
      {
        flag: PERMISSION_FLAGS_2.MANAGE_THERMAL_DESAL,
        label: 'Manage',
        description: 'Edit thermal desalination data',
        category: 'manage',
        field: 'permissions2',
      },
    ],
  },
  {
    id: 'thermal-calcs',
    name: 'Thermal Calculators',
    description: 'Engineering calculators and tools',
    permissions: [
      {
        flag: PERMISSION_FLAGS_2.VIEW_THERMAL_CALCS,
        label: 'View',
        description: 'View thermal calculators',
        category: 'view',
        field: 'permissions2',
      },
      {
        flag: PERMISSION_FLAGS_2.MANAGE_THERMAL_CALCS,
        label: 'Manage',
        description: 'Configure thermal calculators',
        category: 'manage',
        field: 'permissions2',
      },
    ],
  },
  {
    id: 'ssot',
    name: 'Process Data (SSOT)',
    description: 'Single source of truth for process data',
    permissions: [
      {
        flag: PERMISSION_FLAGS_2.VIEW_SSOT,
        label: 'View',
        description: 'View process data',
        category: 'view',
        field: 'permissions2',
      },
      {
        flag: PERMISSION_FLAGS_2.MANAGE_SSOT,
        label: 'Manage',
        description: 'Edit process data',
        category: 'manage',
        field: 'permissions2',
      },
    ],
  },
  {
    id: 'hr',
    name: 'HR & Leave Management',
    description: 'Open to all users for basic functions (My Leaves, Expenses, Calendar, Directory)',
    // No View permission - HR module is open to all authenticated users
    // These are admin-only permissions for managing HR settings and approvals
    permissions: [
      {
        flag: PERMISSION_FLAGS_2.MANAGE_HR_SETTINGS,
        label: 'Manage Settings',
        description: 'Configure leave types, policies, and holiday settings',
        category: 'manage',
        field: 'permissions2',
      },
      {
        flag: PERMISSION_FLAGS_2.APPROVE_LEAVES,
        label: 'Approve Leaves',
        description: 'Approve or reject leave requests from team members',
        category: 'approve',
        field: 'permissions2',
      },
      {
        flag: PERMISSION_FLAGS_2.MANAGE_HR_PROFILES,
        label: 'Manage Profiles',
        description: 'Edit employee HR profiles and directory information',
        category: 'manage',
        field: 'permissions2',
      },
    ],
  },
];

/**
 * Get all approval permissions for quick reference
 * Returns flat array of all permissions with category 'approve'
 */
export function getApprovalPermissions(): Array<{
  moduleId: string;
  moduleName: string;
  permission: PermissionDef;
}> {
  const approvals: Array<{
    moduleId: string;
    moduleName: string;
    permission: PermissionDef;
  }> = [];

  for (const module of MODULE_PERMISSIONS) {
    for (const perm of module.permissions) {
      if (perm.category === 'approve') {
        approvals.push({
          moduleId: module.id,
          moduleName: module.name,
          permission: perm,
        });
      }
    }
  }

  return approvals;
}

/**
 * Get permission module by ID
 */
export function getPermissionModuleById(moduleId: string): PermissionModuleDef | undefined {
  return MODULE_PERMISSIONS.find((m) => m.id === moduleId);
}

/**
 * Check if a user has a specific module permission
 */
export function hasModulePermission(
  permissions: number,
  permissions2: number,
  moduleId: string,
  permissionLabel: string
): boolean {
  const module = getPermissionModuleById(moduleId);
  if (!module) return false;

  const perm = module.permissions.find((p) => p.label === permissionLabel);
  if (!perm) return false;

  const permsToCheck = perm.field === 'permissions2' ? permissions2 : permissions;
  return (permsToCheck & perm.flag) === perm.flag;
}
