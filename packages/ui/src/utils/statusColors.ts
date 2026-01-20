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
  | 'PENDING_APPROVAL'
  | 'APPROVED'
  | 'REJECTED'
  | 'POSTED'
  | 'VOID'
  | 'ARCHIVED'
  | 'COMPLETED'
  | 'IN_PROGRESS'
  | 'ON_HOLD'
  | 'CANCELLED'
  | 'PAID'
  | 'PARTIALLY_PAID'
  | 'UNPAID'
  | 'OVERDUE';

/**
 * Context-specific status types
 */
export type ProjectStatus = 'ACTIVE' | 'COMPLETED' | 'ON_HOLD' | 'CANCELLED' | 'PROPOSAL';

export type InvoiceStatus = 'DRAFT' | 'PENDING' | 'APPROVED' | 'POSTED' | 'REJECTED' | 'VOID';

export type UserStatus = 'active' | 'pending' | 'inactive';

export type BOMStatus = 'DRAFT' | 'UNDER_REVIEW' | 'APPROVED' | 'RELEASED' | 'ARCHIVED';

export type DocumentStatus = 'DRAFT' | 'PENDING_APPROVAL' | 'APPROVED' | 'REJECTED' | 'ARCHIVED';

export type TransactionStatus =
  | 'DRAFT'
  | 'PENDING_APPROVAL'
  | 'APPROVED'
  | 'REJECTED'
  | 'POSTED'
  | 'VOID'
  | 'UNPAID'
  | 'PARTIALLY_PAID'
  | 'PAID';

/**
 * Base status color mapping
 * These mappings are used across all contexts unless overridden
 *
 * Color semantics:
 * - success (green): Final positive state, fully complete
 * - info (blue): Intermediate positive state, needs action
 * - warning (orange): Waiting state, needs attention
 * - error (red): Negative state, problem
 * - primary (purple): Special/highlighted state
 * - default (gray): Initial/neutral state
 */
const baseStatusColors: Record<string, ChipProps['color']> = {
  // Final positive states (green)
  ACTIVE: 'success',
  POSTED: 'success',
  COMPLETED: 'success',
  RELEASED: 'success',
  PAID: 'success',
  active: 'success',

  // Intermediate positive states (blue) - approved but not final
  APPROVED: 'info',
  NEGOTIATION: 'info',

  // Warning/Waiting states (orange)
  PENDING: 'warning',
  PENDING_APPROVAL: 'warning',
  ON_HOLD: 'warning',
  IN_PROGRESS: 'warning',
  UNDER_REVIEW: 'warning',
  PARTIALLY_PAID: 'warning',
  OVERDUE: 'warning',
  pending: 'warning',

  // Neutral states (gray/default)
  DRAFT: 'default',
  UNPAID: 'default',

  // Primary/Special states (purple)
  PROPOSAL: 'primary',

  // Negative states (red)
  TERMINATED: 'error',
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
 *
 * Note: Most contexts use the base colors. Overrides are only needed
 * when a specific context has different semantic meaning for a status.
 */
const contextOverrides: Record<string, Partial<Record<string, ChipProps['color']>>> = {
  // BOM context - RELEASED is a caution state, APPROVED is final
  bom: {
    RELEASED: 'warning',
    APPROVED: 'success',
  },
  // Invoice/Bill contexts use base colors (APPROVED=info, POSTED=success)
  invoice: {},
  bill: {},
  // Transaction context (journal entries, etc.) uses base colors
  transaction: {},
  // Project context - ACTIVE is final positive state
  project: {
    ACTIVE: 'success',
    COMPLETED: 'success',
    ON_HOLD: 'warning',
    CANCELLED: 'error',
    PROPOSAL: 'primary',
  },
  // Entity context (customers, vendors)
  entity: {
    ACTIVE: 'success',
    INACTIVE: 'default',
  },
  // Vendor contract context - COMPLETED is primary (finished but not "success" green)
  vendorContract: {
    COMPLETED: 'primary',
    NEGOTIATION: 'warning',
    TERMINATED: 'error',
  },
  // Objective/Deliverable context
  objective: {
    ACHIEVED: 'success',
    ACCEPTED: 'success',
    IN_PROGRESS: 'primary',
    SUBMITTED: 'primary',
    AT_RISK: 'error',
    PENDING: 'default',
    NOT_STARTED: 'default',
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
  context?:
    | 'project'
    | 'invoice'
    | 'bill'
    | 'user'
    | 'bom'
    | 'document'
    | 'entity'
    | 'transaction'
    | 'vendorContract'
    | 'objective'
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
