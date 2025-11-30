// Core enums and constants

/**
 * Departments
 */
export type Department =
  | 'MANAGEMENT'
  | 'FINANCE'
  | 'HR'
  | 'ENGINEERING'
  | 'PROCUREMENT'
  | 'OPERATIONS'
  | 'SALES';

/**
 * Work areas / phases
 */
export type WorkArea =
  | 'PROPOSAL'
  | 'DESIGN'
  | 'PROCUREMENT'
  | 'MANUFACTURING'
  | 'INSTALLATION'
  | 'COMMISSIONING'
  | 'SUPPORT'
  | 'ADMIN';

/**
 * Entity roles (what role the entity plays)
 */
export type EntityRole = 'VENDOR' | 'CUSTOMER' | 'PARTNER' | 'BOTH';

/**
 * Project status
 */
export type ProjectStatus =
  | 'PLANNING'
  | 'PROPOSAL'
  | 'ACTIVE'
  | 'ON_HOLD'
  | 'COMPLETED'
  | 'CANCELLED'
  | 'ARCHIVED';

/**
 * Project status labels for display
 */
export const PROJECT_STATUS_LABELS: Record<ProjectStatus, string> = {
  PLANNING: 'Planning',
  PROPOSAL: 'Proposal',
  ACTIVE: 'Active',
  ON_HOLD: 'On Hold',
  COMPLETED: 'Completed',
  CANCELLED: 'Cancelled',
  ARCHIVED: 'Archived',
};

/**
 * Project priority
 */
export type ProjectPriority = 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL';
