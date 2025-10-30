import { Timestamp } from 'firebase/firestore';

/**
 * Audit Actions - All trackable operations
 */
export type AuditAction =
  // User Management
  | 'USER_CREATED'
  | 'USER_UPDATED'
  | 'USER_DELETED'
  | 'USER_APPROVED'
  | 'USER_REJECTED'
  | 'USER_ACTIVATED'
  | 'USER_DEACTIVATED'
  // Role & Permission Management
  | 'ROLE_ASSIGNED'
  | 'ROLE_REMOVED'
  | 'PERMISSION_GRANTED'
  | 'PERMISSION_REVOKED'
  | 'CLAIMS_UPDATED'
  // Project Management
  | 'PROJECT_ASSIGNED'
  | 'PROJECT_UNASSIGNED'
  | 'PROJECT_CREATED'
  | 'PROJECT_UPDATED'
  | 'PROJECT_DELETED'
  // Authentication
  | 'LOGIN_SUCCESS'
  | 'LOGIN_FAILED'
  | 'LOGOUT'
  | 'PASSWORD_CHANGED'
  | 'PASSWORD_RESET'
  // Entity Management
  | 'ENTITY_CREATED'
  | 'ENTITY_UPDATED'
  | 'ENTITY_DELETED'
  // System
  | 'CONFIG_CHANGED'
  | 'BACKUP_CREATED'
  | 'DATA_EXPORTED'
  // Invitation
  | 'INVITATION_SENT'
  | 'INVITATION_ACCEPTED'
  | 'INVITATION_REJECTED';

/**
 * Entity types that can be audited
 */
export type AuditEntityType =
  | 'USER'
  | 'ROLE'
  | 'PERMISSION'
  | 'PROJECT'
  | 'ENTITY'
  | 'VENDOR'
  | 'CUSTOMER'
  | 'PARTNER'
  | 'COMPANY'
  | 'INVITATION'
  | 'SYSTEM';

/**
 * Audit log severity levels
 */
export type AuditSeverity = 'INFO' | 'WARNING' | 'ERROR' | 'CRITICAL';

/**
 * Field change tracking for audit logs
 */
export interface AuditFieldChange {
  field: string;
  oldValue: unknown;
  newValue: unknown;
}

/**
 * Main audit log entry
 */
export interface AuditLog {
  id: string;

  // Actor information (who performed the action)
  actorId: string;
  actorEmail: string;
  actorName: string;
  actorRoles?: string[];

  // Action details
  action: AuditAction;
  severity: AuditSeverity;

  // Target entity (what was affected)
  entityType: AuditEntityType;
  entityId: string;
  entityName?: string;

  // Change tracking
  changes?: AuditFieldChange[];

  // Context
  description: string;
  metadata?: Record<string, unknown>;

  // Request information
  ipAddress?: string;
  userAgent?: string;

  // Timestamps
  timestamp: Timestamp;

  // Status
  success: boolean;
  errorMessage?: string;
}

/**
 * Parameters for creating an audit log entry
 */
export interface CreateAuditLogParams {
  // Actor (optional - can be derived from context)
  actorId?: string;
  actorEmail?: string;
  actorName?: string;
  actorRoles?: string[];

  // Action details
  action: AuditAction;
  severity?: AuditSeverity; // Defaults to INFO

  // Target entity
  entityType: AuditEntityType;
  entityId: string;
  entityName?: string;

  // Change tracking
  changes?: AuditFieldChange[];

  // Context
  description: string;
  metadata?: Record<string, unknown>;

  // Request information
  ipAddress?: string;
  userAgent?: string;

  // Status
  success?: boolean; // Defaults to true
  errorMessage?: string;
}

/**
 * Query parameters for filtering audit logs
 */
export interface AuditLogQuery {
  actorId?: string;
  action?: AuditAction;
  entityType?: AuditEntityType;
  entityId?: string;
  severity?: AuditSeverity;
  startDate?: Date;
  endDate?: Date;
  limit?: number;
}
