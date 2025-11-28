// Module Registry - All application modules
// Priority Order: Tasks → Documents → Procurement → Accounting → Estimation → Material DB → Shape DB → Bought Out DB → Thermal Desal → Proposals
// Includes 10 active modules + 3 coming soon placeholders

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
 * 8. Bought Out Database (coming Q1 2026)
 * 9. Thermal Desalination Design (coming Q2 2026)
 * 10. Proposal Management (coming Q1 2026)
 *
 * NOTE: Import PERMISSION_FLAGS from @vapour/constants to use these values
 */
export const MODULES: Record<string, ModuleDefinition> = {
  // ===== CORE MODULES (Sidebar only, no dashboard cards) =====

  USER_MANAGEMENT: {
    id: 'user-management',
    name: 'User Management',
    description: 'Manage users, roles, and permissions',
    icon: 'People',
    color: '#3B82F6', // Blue
    path: '/users',
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

  COMPANY_SETTINGS: {
    id: 'company-settings',
    name: 'Company Settings',
    description: 'One-time setup: company info, tax IDs, banking, fiscal year',
    icon: 'BusinessCenter',
    color: '#6B7280', // Gray
    path: '/company',
    status: 'active',
    requiredPermissions: 512, // MANAGE_COMPANY_SETTINGS
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
    requiredPermissions: 524288, // VIEW_ESTIMATION
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
    requiredPermissions: 524288, // VIEW_ESTIMATION (engineering materials)
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
    requiredPermissions: 524288, // VIEW_ESTIMATION (engineering calculations)
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
    requiredPermissions: 524288, // VIEW_ESTIMATION (procurement/engineering items)
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
    status: 'coming_soon',
    requiredPermissions: 524288, // VIEW_ESTIMATION (engineering calculations)
    category: 'application',
    estimatedRelease: 'Q2 2026',
    priority: 9,
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
    requiredPermissions: 8, // MANAGE_PROJECTS (for creating proposals)
    category: 'application',
    estimatedRelease: 'Q1 2026',
    priority: 10,
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
 */
export function getModulesByPermissions(userPermissions: number, allowedModules?: string[]) {
  return Object.values(MODULES).filter((module) => {
    // Check permission requirement
    if (module.requiredPermissions !== undefined) {
      if ((userPermissions & module.requiredPermissions) !== module.requiredPermissions) {
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
 */
export function hasModuleAccess(
  moduleId: string,
  userPermissions: number,
  allowedModules?: string[]
): boolean {
  const module = getModuleById(moduleId);
  if (!module) return false;

  // Check permission requirement
  const hasPermission =
    module.requiredPermissions === undefined ||
    (userPermissions & module.requiredPermissions) === module.requiredPermissions;

  // Check module visibility (if allowedModules is set, must include this module)
  const hasVisibility =
    !allowedModules || allowedModules.length === 0 || allowedModules.includes(moduleId);

  return hasPermission && hasVisibility;
}
