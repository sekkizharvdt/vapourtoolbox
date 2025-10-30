// Module Registry - All application modules
// Includes 8 active modules + 2 coming soon placeholders

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
}

/**
 * Complete module registry for Vapour Toolbox
 * 10 total modules: 8 active + 2 coming soon
 */
export const MODULES: Record<string, ModuleDefinition> = {
  // ===== CORE MODULES (Always in sidebar) =====

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
    description: 'Configure company information and preferences',
    icon: 'BusinessCenter',
    color: '#6B7280', // Gray
    path: '/company',
    status: 'active',
    roles: ['SUPER_ADMIN', 'DIRECTOR'],
    category: 'core',
  },

  // ===== APPLICATION MODULES (Dashboard cards) =====

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
  },

  // ===== COMING SOON MODULES (Placeholders) =====

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
  },

  DOCUMENT_MANAGEMENT: {
    id: 'document-management',
    name: 'Document Management System',
    shortName: 'Documents',
    description: 'Centralized document storage with version control and sharing',
    icon: 'Description',
    color: '#7C3AED', // Purple
    path: '/documents',
    status: 'coming_soon',
    roles: 'ALL',
    category: 'application',
    estimatedRelease: 'Q2 2026',
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
