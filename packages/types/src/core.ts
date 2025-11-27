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
  | 'PROPOSAL'
  | 'ACTIVE'
  | 'ON_HOLD'
  | 'COMPLETED'
  | 'CANCELLED'
  | 'ARCHIVED';

/**
 * Project priority
 */
export type ProjectPriority = 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL';
