// Role Configuration and Labels

import type { UserRole } from '@vapour/types';

export interface RoleConfig {
  value: UserRole;
  label: string;
  description: string;
  level: number; // Hierarchy level (higher = more permissions)
  category: 'admin' | 'management' | 'staff';
}

/**
 * Role configurations with display labels and descriptions
 */
export const ROLES: Record<UserRole, RoleConfig> = {
  SUPER_ADMIN: {
    value: 'SUPER_ADMIN',
    label: 'Super Admin',
    description: 'Full system access and control',
    level: 100,
    category: 'admin',
  },

  DIRECTOR: {
    value: 'DIRECTOR',
    label: 'Director',
    description: 'Executive leadership with broad access',
    level: 90,
    category: 'management',
  },

  HR_ADMIN: {
    value: 'HR_ADMIN',
    label: 'HR Admin',
    description: 'Human resources administrator',
    level: 70,
    category: 'management',
  },

  FINANCE_MANAGER: {
    value: 'FINANCE_MANAGER',
    label: 'Finance Manager',
    description: 'Financial management and accounting oversight',
    level: 70,
    category: 'management',
  },

  ACCOUNTANT: {
    value: 'ACCOUNTANT',
    label: 'Accountant',
    description: 'Accounting and financial transactions',
    level: 50,
    category: 'staff',
  },

  PROJECT_MANAGER: {
    value: 'PROJECT_MANAGER',
    label: 'Project Manager',
    description: 'Project planning and execution',
    level: 70,
    category: 'management',
  },

  ENGINEERING_HEAD: {
    value: 'ENGINEERING_HEAD',
    label: 'Engineering Head',
    description: 'Engineering team leadership',
    level: 70,
    category: 'management',
  },

  ENGINEER: {
    value: 'ENGINEER',
    label: 'Engineer',
    description: 'Engineering and technical work',
    level: 50,
    category: 'staff',
  },

  PROCUREMENT_MANAGER: {
    value: 'PROCUREMENT_MANAGER',
    label: 'Procurement Manager',
    description: 'Procurement and purchasing management',
    level: 70,
    category: 'management',
  },

  SITE_ENGINEER: {
    value: 'SITE_ENGINEER',
    label: 'Site Engineer',
    description: 'On-site engineering and installation',
    level: 50,
    category: 'staff',
  },

  TEAM_MEMBER: {
    value: 'TEAM_MEMBER',
    label: 'Team Member',
    description: 'General team member access',
    level: 30,
    category: 'staff',
  },

  CLIENT_PM: {
    value: 'CLIENT_PM',
    label: 'Client Project Manager',
    description: 'External client PM with view-only procurement access',
    level: 20,
    category: 'staff',
  },
};

/**
 * Get role configuration
 */
export function getRole(value: UserRole): RoleConfig {
  return ROLES[value];
}

/**
 * Get all roles as array
 */
export function getAllRoles(): RoleConfig[] {
  return Object.values(ROLES);
}

/**
 * Get roles by category
 */
export function getRolesByCategory(category: 'admin' | 'management' | 'staff'): RoleConfig[] {
  return getAllRoles().filter((role) => role.category === category);
}

/**
 * Get role options for select/dropdown
 */
export function getRoleOptions() {
  return getAllRoles().map((role) => ({
    value: role.value,
    label: role.label,
  }));
}

/**
 * Check if role has sufficient level
 */
export function hasRoleLevel(userRole: UserRole, requiredLevel: number): boolean {
  return ROLES[userRole].level >= requiredLevel;
}

/**
 * Compare role levels
 */
export function compareRoles(role1: UserRole, role2: UserRole): number {
  return ROLES[role1].level - ROLES[role2].level;
}
