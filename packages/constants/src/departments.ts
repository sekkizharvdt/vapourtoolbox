// Department Configuration

import type { Department } from '@vapour/types';

export interface DepartmentConfig {
  value: Department;
  label: string;
  description: string;
  icon: string; // Material UI icon name
  color: string;
}

/**
 * Department configurations
 */
export const DEPARTMENTS: Record<Department, DepartmentConfig> = {
  MANAGEMENT: {
    value: 'MANAGEMENT',
    label: 'Management',
    description: 'Executive management and leadership',
    icon: 'CorporateFare',
    color: '#6B7280', // Gray
  },

  FINANCE: {
    value: 'FINANCE',
    label: 'Finance',
    description: 'Financial management and accounting',
    icon: 'AccountBalance',
    color: '#F59E0B', // Amber
  },

  HR: {
    value: 'HR',
    label: 'Human Resources',
    description: 'Human resources and administration',
    icon: 'People',
    color: '#3B82F6', // Blue
  },

  ENGINEERING: {
    value: 'ENGINEERING',
    label: 'Engineering',
    description: 'Technical design and engineering',
    icon: 'Engineering',
    color: '#8B5CF6', // Purple
  },

  PROCUREMENT: {
    value: 'PROCUREMENT',
    label: 'Procurement',
    description: 'Purchasing and procurement',
    icon: 'ShoppingCart',
    color: '#EC4899', // Pink
  },

  OPERATIONS: {
    value: 'OPERATIONS',
    label: 'Operations',
    description: 'Operations and project execution',
    icon: 'Settings',
    color: '#10B981', // Green
  },

  SALES: {
    value: 'SALES',
    label: 'Sales & Marketing',
    description: 'Sales, marketing, and business development',
    icon: 'TrendingUp',
    color: '#0891B2', // Cyan
  },
};

/**
 * Get department by value
 */
export function getDepartment(value: Department): DepartmentConfig {
  return DEPARTMENTS[value];
}

/**
 * Get all departments as array
 */
export function getAllDepartments(): DepartmentConfig[] {
  return Object.values(DEPARTMENTS);
}

/**
 * Get department options for select/dropdown
 */
export function getDepartmentOptions() {
  return getAllDepartments().map((dept) => ({
    value: dept.value,
    label: dept.label,
  }));
}
