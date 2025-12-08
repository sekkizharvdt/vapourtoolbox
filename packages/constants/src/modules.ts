// Module Registry - All application modules
// Priority Order: Tasks → Documents → Procurement → Accounting → Estimation → Material DB → Shape DB → Bought Out DB → Thermal Desal → Proposals
// Includes 11 active modules + 2 coming soon placeholders

export type ModuleStatus = 'active' | 'coming_soon' | 'beta';

export interface ModuleDefinition {
  id: string;
  name: string;
  shortName?: string;
  description: string;
  icon: string; // Material UI icon name
  color: string;
  path: string;
  status: ModuleStatus;
  requiredPermissions?: number; // Bitwise permission flags required for access (undefined = no permission check)
  requiredPermissions2?: number; // Extended permissions from PERMISSION_FLAGS_2 (undefined = no permission check)
  estimatedRelease?: string;
  category: 'core' | 'application';
  priority?: number; // Lower number = higher priority (1 = highest)
}

/**
 * Complete module registry for Vapour Toolbox
 * 13 total modules: 10 active + 3 coming soon
 *
 * PRIORITY ORDER (for dashboard display):
 * 1. Tasks (highest priority - all users)
 * 2. Document Management (all users)
 * 3. Procurement (permission-based)
 * 4. Accounting (permission-based)
 * 5. Estimation (permission-based)
 * 6. Material Database (active)
 * 7. Shape Database (active)
 * 8. Bought Out Database (active)
 * 9. Thermal Desalination Design (active)
 * 10. Proposal Management (active)
 *
 * NOTE: Import PERMISSION_FLAGS from @vapour/constants to use these values
 */
export const MODULES: Record<string, ModuleDefinition> = {
  // ===== CORE MODULES (Sidebar only, no dashboard cards) =====

  // Admin module - links to /admin section (contains Users, Company, Feedback)
  ADMIN: {
    id: 'admin',
    name: 'Administration',
    shortName: 'Admin',
    description: 'User management, company settings, and system administration',
    icon: 'AdminPanelSettings',
    color: '#6366F1', // Indigo
    path: '/admin',
    status: 'active',
    requiredPermissions: 1, // MANAGE_USERS
    category: 'core',
  },

  ENTITY_MANAGEMENT: {
    id: 'entity-management',
    name: 'Entity Management',
    description: 'Manage vendors, customers, and partners',
    icon: 'Business',
    color: '#10B981', // Green
    path: '/entities',
    status: 'active',
    requiredPermissions: 32, // VIEW_ENTITIES
    category: 'core',
  },

  PROJECT_MANAGEMENT: {
    id: 'project-management',
    name: 'Project Management',
    description: 'Manage projects, teams, and milestones',
    icon: 'Assignment',
    color: '#8B5CF6', // Purple
    path: '/projects',
    status: 'active',
    requiredPermissions: 16, // VIEW_PROJECTS
    category: 'core',
  },

  // ===== APPLICATION MODULES (Dashboard cards, priority ordered) =====

  TIME_TRACKING: {
    id: 'time-tracking',
    name: 'Flow',
    shortName: 'Flow',
    description: 'Track tasks, time entries, and team collaboration',
    icon: 'Schedule',
    color: '#0891B2', // Vapour Cyan
    path: '/flow',
    status: 'active',
    // No requiredPermissions - accessible by all users
    category: 'application',
    priority: 1, // HIGHEST PRIORITY
  },

  DOCUMENT_MANAGEMENT: {
    id: 'document-management',
    name: 'Document Management',
    shortName: 'Documents',
    description: 'Centralized document storage with version control and sharing',
    icon: 'Description',
    color: '#7C3AED', // Purple
    path: '/documents',
    status: 'active',
    // No requiredPermissions - accessible by all users
    category: 'application',
    priority: 2,
  },

  PROCUREMENT: {
    id: 'procurement',
    name: 'Procurement',
    shortName: 'Procure',
    description: 'Purchase requisitions, RFQs, and purchase orders',
    icon: 'ShoppingCart',
    color: '#EC4899', // Pink
    path: '/procurement',
    status: 'active',
    requiredPermissions: 131072, // VIEW_PROCUREMENT
    category: 'application',
    priority: 3,
  },

  ACCOUNTING: {
    id: 'accounting',
    name: 'Accounting',
    shortName: 'Accounts',
    description: 'Financial transactions, ledgers, and reports',
    icon: 'AccountBalance',
    color: '#F59E0B', // Amber
    path: '/accounting',
    status: 'active',
    requiredPermissions: 32768, // VIEW_ACCOUNTING
    category: 'application',
    priority: 4,
  },

  ESTIMATION: {
    id: 'estimation',
    name: 'Estimation',
    shortName: 'Estimate',
    description: 'Engineering estimates, equipment, and components',
    icon: 'Calculate',
    color: '#6366F1', // Indigo
    path: '/estimation',
    status: 'active',
    // No requiredPermissions - open to all users
    category: 'application',
    priority: 5,
  },

  // ===== COMING SOON MODULES =====

  MATERIAL_DATABASE: {
    id: 'material-database',
    name: 'Material Database',
    shortName: 'Materials',
    description: 'ASME/ASTM compliant materials database for engineering and manufacturing',
    icon: 'Inventory',
    color: '#059669', // Emerald
    path: '/materials',
    status: 'active',
    // No requiredPermissions - open to all users
    category: 'application',
    priority: 6,
  },

  SHAPE_DATABASE: {
    id: 'shape-database',
    name: 'Shape Database',
    shortName: 'Shapes',
    description: 'Parametric shapes and components with automated weight/cost calculations',
    icon: 'Category',
    color: '#8B5CF6', // Purple
    path: '/dashboard/shapes/calculator',
    status: 'active',
    // No requiredPermissions - open to all users
    category: 'application',
    priority: 7,
  },

  BOUGHT_OUT_DATABASE: {
    id: 'bought-out-database',
    name: 'Bought Out Items',
    shortName: 'Bought Out',
    description: 'Valves, pumps, instruments, strainers, and separation equipment',
    icon: 'LocalShipping',
    color: '#0D9488', // Teal
    path: '/bought-out',
    status: 'active',
    // No requiredPermissions - open to all users
    category: 'application',
    priority: 8,
  },

  THERMAL_DESAL: {
    id: 'thermal-desal',
    name: 'Thermal Desalination Design',
    shortName: 'Thermal Desal',
    description: 'Design calculations for thermal desalination processes (MED/MSF)',
    icon: 'Thermostat',
    color: '#EF4444', // Red
    path: '/thermal',
    status: 'active',
    requiredPermissions2: 64, // VIEW_THERMAL_DESAL (PERMISSION_FLAGS_2)
    category: 'application',
    priority: 9,
  },

  THERMAL_CALCS: {
    id: 'thermal-calcs',
    name: 'Thermal Calculators',
    shortName: 'Thermal Calcs',
    description:
      'Engineering calculators for thermal processes (steam tables, seawater properties, pipe sizing)',
    icon: 'Calculate',
    color: '#F97316', // Orange
    path: '/thermal/calculators',
    status: 'active',
    // No permission required - open to all users
    category: 'application',
    priority: 10,
  },

  PROCESS_DATA: {
    id: 'process-data',
    name: 'Process Data (SSOT)',
    shortName: 'Process Data',
    description:
      'Single Source of Truth for process engineering data (streams, equipment, lines, instruments, valves)',
    icon: 'Storage',
    color: '#14B8A6', // Teal
    path: '/ssot',
    status: 'active',
    requiredPermissions2: 64, // VIEW_THERMAL_DESAL (shares permission with thermal design)
    category: 'application',
    priority: 11,
  },

  PROPOSAL_MANAGEMENT: {
    id: 'proposal-management',
    name: 'Proposal Management',
    shortName: 'Proposals',
    description: 'Create proposals, link estimations, generate contracts',
    icon: 'Assignment',
    color: '#10B981', // Green
    path: '/proposals',
    status: 'active',
    requiredPermissions: 1048576, // VIEW_PROPOSALS
    category: 'application',
    priority: 11,
  },
};

/**
 * Get modules by category
 */
export function getModulesByCategory(category: 'core' | 'application') {
  return Object.values(MODULES).filter((module) => module.category === category);
}

/**
 * Get modules accessible by user permissions and allowed modules list
 * Import PERMISSION_FLAGS from @vapour/constants and use hasPermission helper
 * @param userPermissions - Bitwise permission flags
 * @param allowedModules - Optional array of module IDs the user can access (empty = all modules)
 * @param userPermissions2 - Extended permissions from PERMISSION_FLAGS_2
 */
export function getModulesByPermissions(
  userPermissions: number,
  allowedModules?: string[],
  userPermissions2?: number
) {
  return Object.values(MODULES).filter((module) => {
    // Check permission requirement (permissions field)
    if (module.requiredPermissions !== undefined) {
      if ((userPermissions & module.requiredPermissions) !== module.requiredPermissions) {
        return false;
      }
    }
    // Check permission2 requirement (permissions2 field)
    if (module.requiredPermissions2 !== undefined) {
      const perms2 = userPermissions2 ?? 0;
      if ((perms2 & module.requiredPermissions2) !== module.requiredPermissions2) {
        return false;
      }
    }
    // Check module visibility (if allowedModules is set, must include this module)
    if (allowedModules && allowedModules.length > 0) {
      if (!allowedModules.includes(module.id)) return false;
    }
    return true;
  });
}

/**
 * Get active modules only
 */
export function getActiveModules() {
  return Object.values(MODULES).filter((module) => module.status === 'active');
}

/**
 * Get module by ID
 */
export function getModuleById(id: string): ModuleDefinition | undefined {
  return Object.values(MODULES).find((module) => module.id === id);
}

/**
 * Check if user has access to a specific module
 * @param moduleId - The module ID to check
 * @param userPermissions - Bitwise permission flags
 * @param allowedModules - Optional array of module IDs the user can access (empty = all modules)
 * @param userPermissions2 - Extended permissions from PERMISSION_FLAGS_2
 */
export function hasModuleAccess(
  moduleId: string,
  userPermissions: number,
  allowedModules?: string[],
  userPermissions2?: number
): boolean {
  const module = getModuleById(moduleId);
  if (!module) return false;

  // Check permission requirement (permissions field)
  const hasPermission =
    module.requiredPermissions === undefined ||
    (userPermissions & module.requiredPermissions) === module.requiredPermissions;

  // Check permission2 requirement (permissions2 field)
  const perms2 = userPermissions2 ?? 0;
  const hasPermission2 =
    module.requiredPermissions2 === undefined ||
    (perms2 & module.requiredPermissions2) === module.requiredPermissions2;

  // Check module visibility (if allowedModules is set, must include this module)
  const hasVisibility =
    !allowedModules || allowedModules.length === 0 || allowedModules.includes(moduleId);

  return hasPermission && hasPermission2 && hasVisibility;
}
