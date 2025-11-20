/**
 * Status color utility
 * Provides standardized color mappings for status chips across the application
 */

import { ChipProps } from '@mui/material';

/**
 * Common status types across the application
 */
export type CommonStatus =
  | 'ACTIVE'
  | 'INACTIVE'
  | 'DRAFT'
  | 'PENDING'
  | 'APPROVED'
  | 'REJECTED'
  | 'POSTED'
  | 'VOID'
  | 'ARCHIVED'
  | 'COMPLETED'
  | 'IN_PROGRESS'
  | 'ON_HOLD'
  | 'CANCELLED';

/**
 * Context-specific status types
 */
export type ProjectStatus = 'ACTIVE' | 'COMPLETED' | 'ON_HOLD' | 'CANCELLED' | 'PROPOSAL';

export type InvoiceStatus = 'DRAFT' | 'PENDING' | 'APPROVED' | 'POSTED' | 'REJECTED' | 'VOID';

export type UserStatus = 'active' | 'pending' | 'inactive';

export type BOMStatus = 'DRAFT' | 'UNDER_REVIEW' | 'APPROVED' | 'RELEASED' | 'ARCHIVED';

export type DocumentStatus = 'DRAFT' | 'PENDING_APPROVAL' | 'APPROVED' | 'REJECTED' | 'ARCHIVED';

/**
 * Base status color mapping
 * These mappings are used across all contexts unless overridden
 */
const baseStatusColors: Record<string, ChipProps['color']> = {
  // Active/Positive states
  ACTIVE: 'success',
  APPROVED: 'success',
  POSTED: 'success',
  COMPLETED: 'success',
  RELEASED: 'success',
  active: 'success',

  // Warning/Intermediate states
  PENDING: 'warning',
  ON_HOLD: 'warning',
  IN_PROGRESS: 'warning',
  UNDER_REVIEW: 'warning',
  PENDING_APPROVAL: 'warning',
  pending: 'warning',

  // Info/Neutral states
  DRAFT: 'default',
  PROPOSAL: 'primary',

  // Error/Negative states
  INACTIVE: 'error',
  REJECTED: 'error',
  VOID: 'error',
  CANCELLED: 'error',
  ARCHIVED: 'error',
  inactive: 'error',
};

/**
 * Context-specific overrides
 * Use these when a context needs different color mappings
 */
const contextOverrides: Record<string, Partial<Record<string, ChipProps['color']>>> = {
  bom: {
    RELEASED: 'warning', // Released is a "caution" state for BOMs
    APPROVED: 'success',
  },
  invoice: {
    APPROVED: 'info', // Approved but not yet posted
    POSTED: 'success', // Final state
  },
  bill: {
    APPROVED: 'info', // Approved but not yet posted
    POSTED: 'success', // Final state
  },
};

/**
 * Get the appropriate color for a status chip
 *
 * @param status - The status value
 * @param context - Optional context for context-specific color mappings
 * @returns MUI Chip color prop value
 *
 * @example
 * ```tsx
 * <Chip
 *   label="Active"
 *   color={getStatusColor('ACTIVE')}
 * />
 *
 * <Chip
 *   label="Approved"
 *   color={getStatusColor('APPROVED', 'invoice')}
 * />
 * ```
 */
export function getStatusColor(
  status: string,
  context?: 'project' | 'invoice' | 'bill' | 'user' | 'bom' | 'document'
): ChipProps['color'] {
  // Check for context-specific override first
  if (context && contextOverrides[context]?.[status]) {
    return contextOverrides[context][status];
  }

  // Fall back to base mapping
  return baseStatusColors[status] || 'default';
}

/**
 * Get priority color for task/issue priority levels
 *
 * @param priority - Priority level (LOW, MEDIUM, HIGH, CRITICAL)
 * @returns MUI Chip color prop value
 */
export function getPriorityColor(
  priority: 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL' | string
): ChipProps['color'] {
  const priorityColors: Record<string, ChipProps['color']> = {
    LOW: 'default',
    MEDIUM: 'info',
    HIGH: 'warning',
    CRITICAL: 'error',
  };

  return priorityColors[priority] || 'default';
}

/**
 * Get role color for entity roles
 *
 * @param role - Entity role (CUSTOMER, VENDOR, EMPLOYEE, etc.)
 * @returns MUI Chip color prop value
 */
export function getRoleColor(
  role: 'CUSTOMER' | 'VENDOR' | 'EMPLOYEE' | 'CONTRACTOR' | string
): ChipProps['color'] {
  const roleColors: Record<string, ChipProps['color']> = {
    CUSTOMER: 'primary',
    VENDOR: 'secondary',
    EMPLOYEE: 'success',
    CONTRACTOR: 'info',
  };

  return roleColors[role] || 'default';
}
