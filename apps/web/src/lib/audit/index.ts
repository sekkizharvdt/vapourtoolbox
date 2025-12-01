/**
 * Audit Module Exports
 *
 * Central export point for all audit-related utilities
 */

export {
  logAuditEvent,
  createFieldChanges,
  createAuditContext,
  type AuditContext,
  type AuditEventOptions,
} from './clientAuditService';

export {
  buildAuditLogQuery,
  getAuditLogById,
  ACTION_CATEGORIES,
  ENTITY_TYPE_CATEGORIES,
  SEVERITY_CONFIG,
  type AuditLogQueryOptions,
} from './auditLogService';
