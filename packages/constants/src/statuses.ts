// Status definitions and configurations

import type { Status, UserStatus, ProjectStatus, ApprovalStatus } from '@vapour/types';

export interface StatusConfig {
  value: string;
  label: string;
  color: string;
  variant: 'default' | 'success' | 'warning' | 'error' | 'info';
}

/**
 * General status configurations
 */
export const STATUSES: Record<Status, StatusConfig> = {
  active: {
    value: 'active',
    label: 'Active',
    color: '#10B981', // Green
    variant: 'success',
  },
  inactive: {
    value: 'inactive',
    label: 'Inactive',
    color: '#6B7280', // Gray
    variant: 'default',
  },
  draft: {
    value: 'draft',
    label: 'Draft',
    color: '#F59E0B', // Amber
    variant: 'warning',
  },
  archived: {
    value: 'archived',
    label: 'Archived',
    color: '#9CA3AF', // Light gray
    variant: 'default',
  },
};

/**
 * User status configurations
 */
export const USER_STATUSES: Record<UserStatus, StatusConfig> = {
  active: {
    value: 'active',
    label: 'Active',
    color: '#10B981',
    variant: 'success',
  },
  inactive: {
    value: 'inactive',
    label: 'Inactive',
    color: '#6B7280',
    variant: 'default',
  },
  pending: {
    value: 'pending',
    label: 'Pending',
    color: '#F59E0B',
    variant: 'warning',
  },
};

/**
 * Project status configurations
 */
export const PROJECT_STATUSES: Record<ProjectStatus, StatusConfig> = {
  PROPOSAL: {
    value: 'PROPOSAL',
    label: 'Proposal',
    color: '#F59E0B', // Amber
    variant: 'warning',
  },
  ACTIVE: {
    value: 'ACTIVE',
    label: 'Active',
    color: '#10B981', // Green
    variant: 'success',
  },
  ON_HOLD: {
    value: 'ON_HOLD',
    label: 'On Hold',
    color: '#EF4444', // Red
    variant: 'error',
  },
  COMPLETED: {
    value: 'COMPLETED',
    label: 'Completed',
    color: '#0891B2', // Cyan
    variant: 'info',
  },
  CANCELLED: {
    value: 'CANCELLED',
    label: 'Cancelled',
    color: '#6B7280', // Gray
    variant: 'default',
  },
  ARCHIVED: {
    value: 'ARCHIVED',
    label: 'Archived',
    color: '#9CA3AF', // Light gray
    variant: 'default',
  },
};

/**
 * Approval status configurations
 */
export const APPROVAL_STATUSES: Record<ApprovalStatus, StatusConfig> = {
  pending: {
    value: 'pending',
    label: 'Pending',
    color: '#F59E0B', // Amber
    variant: 'warning',
  },
  approved: {
    value: 'approved',
    label: 'Approved',
    color: '#10B981', // Green
    variant: 'success',
  },
  rejected: {
    value: 'rejected',
    label: 'Rejected',
    color: '#EF4444', // Red
    variant: 'error',
  },
  cancelled: {
    value: 'cancelled',
    label: 'Cancelled',
    color: '#6B7280', // Gray
    variant: 'default',
  },
};

/**
 * Get status config by value
 */
export function getStatus(value: Status): StatusConfig {
  return STATUSES[value];
}

export function getUserStatus(value: UserStatus): StatusConfig {
  return USER_STATUSES[value];
}

export function getProjectStatus(value: ProjectStatus): StatusConfig {
  return PROJECT_STATUSES[value];
}

export function getApprovalStatus(value: ApprovalStatus): StatusConfig {
  return APPROVAL_STATUSES[value];
}
