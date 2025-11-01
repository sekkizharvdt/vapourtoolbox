// Module Registry - All application modules
// Priority Order: Time Tracking → Documents → Procurement → Proposals → Accounting → Estimation
// Includes 9 active modules + 2 coming soon placeholders

import type { UserRole } from '@vapour/types';

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
  roles: UserRole[] | 'ALL';
  estimatedRelease?: string;
  category: 'core' | 'application';
  priority?: number; // Lower number = higher priority (1 = highest)
}

/**
 * Complete module registry for Vapour Toolbox
 * 11 total modules: 9 active + 2 coming soon
 *
 * PRIORITY ORDER (for dashboard display):
 * 1. Time Tracking (highest priority - all users)
 * 2. Document Management (all users)
 * 3. Procurement (role-based)
 * 4. Accounting (role-based)
 * 5. Estimation (role-based)
 * 6. Thermal Desalination (coming soon)
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
    roles: ['SUPER_ADMIN', 'HR_ADMIN', 'DIRECTOR'],
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
    roles: ['SUPER_ADMIN', 'FINANCE_MANAGER', 'PROCUREMENT_MANAGER', 'DIRECTOR'],
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
    roles: ['SUPER_ADMIN', 'PROJECT_MANAGER', 'DIRECTOR', 'ENGINEERING_HEAD'],
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
    roles: ['SUPER_ADMIN', 'DIRECTOR'],
    category: 'core',
  },

  // ===== APPLICATION MODULES (Dashboard cards, priority ordered) =====

  TIME_TRACKING: {
    id: 'time-tracking',
    name: 'Time Tracking',
    shortName: 'Time',
    description: 'Track time, tasks, leaves, and on-duty records',
    icon: 'Schedule',
    color: '#0891B2', // Vapour Cyan
    path: '/time',
    status: 'active',
    roles: 'ALL',
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
    status: 'active', // Changed from coming_soon
    roles: 'ALL',
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
    roles: ['SUPER_ADMIN', 'PROCUREMENT_MANAGER', 'PROJECT_MANAGER', 'DIRECTOR'],
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
    roles: ['SUPER_ADMIN', 'FINANCE_MANAGER', 'ACCOUNTANT', 'DIRECTOR'],
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
    roles: ['SUPER_ADMIN', 'ENGINEERING_HEAD', 'ENGINEER', 'PROJECT_MANAGER', 'DIRECTOR'],
    category: 'application',
    priority: 5,
  },

  // ===== COMING SOON MODULES =====

  PROPOSAL_MANAGEMENT: {
    id: 'proposal-management',
    name: 'Proposal Management',
    shortName: 'Proposals',
    description: 'Create proposals, link estimations, generate contracts',
    icon: 'Assignment',
    color: '#10B981', // Green
    path: '/proposals',
    status: 'coming_soon',
    roles: ['SUPER_ADMIN', 'DIRECTOR', 'PROJECT_MANAGER', 'ENGINEERING_HEAD'],
    category: 'application',
    estimatedRelease: 'Q1 2026',
    priority: 6,
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
    roles: ['SUPER_ADMIN', 'ENGINEERING_HEAD', 'ENGINEER', 'PROJECT_MANAGER', 'DIRECTOR'],
    category: 'application',
    estimatedRelease: 'Q2 2026',
    priority: 7,
  },
};

/**
 * Get modules by category
 */
export function getModulesByCategory(category: 'core' | 'application') {
  return Object.values(MODULES).filter((module) => module.category === category);
}

/**
 * Get modules accessible by user roles
 */
export function getModulesByRoles(userRoles: UserRole[]) {
  return Object.values(MODULES).filter((module) => {
    if (module.roles === 'ALL') return true;
    return userRoles.some((role) => module.roles.includes(role));
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
