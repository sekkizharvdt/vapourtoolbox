// Core enums and constants

/**
 * @deprecated UserRole has been removed in favor of pure permissions-based access control.
 * Use the permissions field with bitwise flags instead.
 * This type is kept for backward compatibility only and will be removed in a future version.
 */
export type UserRole =
  | 'SUPER_ADMIN'
  | 'DIRECTOR'
  | 'HR_ADMIN'
  | 'FINANCE_MANAGER'
  | 'ACCOUNTANT'
  | 'PROJECT_MANAGER'
  | 'ENGINEERING_HEAD'
  | 'ENGINEER'
  | 'PROCUREMENT_MANAGER'
  | 'SITE_ENGINEER'
  | 'TEAM_MEMBER'
  | 'CLIENT_PM'; // External client project manager (view-only procurement)

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
