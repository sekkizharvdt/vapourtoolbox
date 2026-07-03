/**
 * Status color mapping — single source of truth for status→Chip-color logic.
 *
 * Framework-agnostic (no MUI import here — @vapour/constants has no UI deps).
 * @vapour/ui/utils/statusColors.ts re-exports this so its existing importers
 * are unaffected; `StatusChip` in @vapour/ui consumes it directly.
 */

/** Matches MUI's Chip `color` prop values. Kept as a plain union so this
 * package stays framework-agnostic (no `@mui/material` dependency). */
export type StatusChipColor =
  | 'default'
  | 'primary'
  | 'secondary'
  | 'error'
  | 'info'
  | 'success'
  | 'warning';

export type StatusColorContext =
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
  | 'quote'
  | 'travelExpense';

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
const baseStatusColors: Record<string, StatusChipColor> = {
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
const contextOverrides: Record<string, Partial<Record<string, StatusChipColor>>> = {
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
  // Project context - ACTIVE is ongoing (green), COMPLETED is finished (blue)
  project: {
    ACTIVE: 'success',
    COMPLETED: 'info',
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
  // Vendor quote context (QuoteStatus) — ARCHIVED here means the quote's
  // lifecycle completed normally (lost to a competing offer, expired, etc.),
  // not a failure state, so it's colored as success rather than the base
  // map's error. SELECTED/PO_CREATED/REJECTED/WITHDRAWN fall back to default.
  quote: {
    DRAFT: 'default',
    UPLOADED: 'info',
    UNDER_REVIEW: 'info',
    EVALUATED: 'success',
    SELECTED: 'default',
    PO_CREATED: 'default',
    REJECTED: 'default',
    WITHDRAWN: 'default',
    ARCHIVED: 'success',
  },
  // Travel expense report context (TravelExpenseStatus) — matches the
  // pre-existing local TRAVEL_EXPENSE_STATUS_COLORS map exactly.
  travelExpense: {
    DRAFT: 'default',
    SUBMITTED: 'warning',
    UNDER_REVIEW: 'info',
    APPROVED: 'success',
    REJECTED: 'error',
    REIMBURSED: 'primary',
  },
};

/**
 * Get the appropriate color for a status chip
 *
 * @param status - The status value
 * @param context - Optional context for context-specific color mappings
 * @returns Chip color value
 *
 * @example
 * ```tsx
 * <Chip label="Active" color={getStatusColor('ACTIVE')} />
 * <Chip label="Approved" color={getStatusColor('APPROVED', 'invoice')} />
 * ```
 */
export function getStatusColor(status: string, context?: StatusColorContext): StatusChipColor {
  // Check for context-specific override first
  if (context && contextOverrides[context]?.[status]) {
    return contextOverrides[context][status] as StatusChipColor;
  }

  // Fall back to base mapping
  return baseStatusColors[status] || 'default';
}

/**
 * Get priority color for task/issue priority levels
 *
 * @param priority - Priority level (LOW, MEDIUM, HIGH, CRITICAL)
 */
export function getPriorityColor(
  priority: 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL' | string
): StatusChipColor {
  const priorityColors: Record<string, StatusChipColor> = {
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
 */
export function getRoleColor(
  role: 'CUSTOMER' | 'VENDOR' | 'EMPLOYEE' | 'CONTRACTOR' | string
): StatusChipColor {
  const roleColors: Record<string, StatusChipColor> = {
    CUSTOMER: 'primary',
    VENDOR: 'secondary',
    EMPLOYEE: 'success',
    CONTRACTOR: 'info',
  };

  return roleColors[role] || 'default';
}
