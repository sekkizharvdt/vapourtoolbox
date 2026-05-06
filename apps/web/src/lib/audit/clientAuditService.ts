/**
 * Client-side Audit Service
 *
 * Provides utilities for logging audit events from the client side.
 * Used when operations happen directly in the frontend (not via Cloud Functions).
 */

import { collection, addDoc, Timestamp, type Firestore } from 'firebase/firestore';
import { COLLECTIONS } from '@vapour/firebase';
import { createLogger } from '@vapour/logger';
import type {
  AuditLog,
  AuditAction,
  AuditSeverity,
  AuditEntityType,
  AuditFieldChange,
} from '@vapour/types';

const logger = createLogger({ context: 'clientAuditService' });

/**
 * Remove undefined values from an object (Firestore rejects undefined)
 * This is necessary because optional fields may be undefined
 */
function removeUndefinedValues<T extends Record<string, unknown>>(obj: T): T {
  const result: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(obj)) {
    if (value !== undefined) {
      result[key] = value;
    }
  }
  return result as T;
}

/**
 * User context for audit logging
 * Should be obtained from the current authenticated user
 */
export interface AuditContext {
  userId: string;
  userEmail: string;
  userName: string;
  permissions?: number;
  // TODO: Required once the 97 `createAuditContext` call sites thread
  // `claims?.tenantId`. Currently optional so the broader call graph
  // compiles while the properly-plumbed `auditLogger` path lands.
  tenantId?: string;

  // Actor classification — see AuditLog.actorType for the full taxonomy.
  // Defaults to 'user' (set by createAuditContext); the agent orchestrator
  // calls createAgentAuditContext to override.
  actorType?: 'user' | 'agent' | 'system';

  // Agent provenance (set only when actorType === 'agent')
  agentRunId?: string;
  agentToolName?: string;
}

/**
 * Options for logging an audit event
 */
export interface AuditEventOptions {
  entityName?: string;
  parentEntityType?: AuditEntityType;
  parentEntityId?: string;
  changes?: AuditFieldChange[];
  metadata?: Record<string, unknown>;
  severity?: AuditSeverity;
  success?: boolean;
  errorMessage?: string;
}

/**
 * Get client IP address from public API
 * Uses a fallback chain of IP detection services
 * Note: This is best-effort and may not work in all environments
 */
async function getClientIPAddress(): Promise<string | undefined> {
  // Skip in SSR/build time
  if (typeof window === 'undefined') {
    return undefined;
  }

  try {
    // Use a public IP detection service with timeout
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 2000);

    const response = await fetch('https://api.ipify.org?format=json', {
      signal: controller.signal,
    });
    clearTimeout(timeoutId);

    if (response.ok) {
      const data = await response.json();
      return data.ip as string;
    }
  } catch {
    // IP detection failed - not critical, continue without IP
  }

  return undefined;
}

/**
 * Determine audit severity based on action type
 */
function getSeverityForAction(action: AuditAction): AuditSeverity {
  const actionStr = action.toString();

  if (actionStr.includes('DELETED') || actionStr.includes('VOIDED')) {
    return 'CRITICAL';
  }

  if (
    actionStr.includes('REJECTED') ||
    actionStr.includes('DEACTIVATED') ||
    actionStr.includes('CANCELLED')
  ) {
    return 'WARNING';
  }

  if (actionStr.includes('EXPORTED') || actionStr.includes('BACKUP')) {
    return 'WARNING';
  }

  return 'INFO';
}

/**
 * Log an audit event to the audit trail
 *
 * @param db - Firestore database instance
 * @param context - Current user context
 * @param action - Type of action performed
 * @param entityType - Type of entity affected
 * @param entityId - ID of the affected entity
 * @param description - Human-readable description of the action
 * @param options - Additional options (entityName, changes, metadata, etc.)
 */
export async function logAuditEvent(
  db: Firestore,
  context: AuditContext,
  action: AuditAction,
  entityType: AuditEntityType,
  entityId: string,
  description: string,
  options?: AuditEventOptions
): Promise<void> {
  // rule5-exempt: audit-log writer; the protected operation that triggered it has already been gated by the caller — gating here would double-check the same permission
  try {
    const severity = options?.severity ?? getSeverityForAction(action);

    const auditLog: Omit<AuditLog, 'id'> = {
      // Tenant scoping — written when the caller has threaded tenantId
      // through. See the TODO on AuditContext above for the migration path.
      ...(context.tenantId !== undefined && { tenantId: context.tenantId }),

      // Actor information
      actorId: context.userId,
      actorEmail: context.userEmail,
      actorName: context.userName,
      actorPermissions: context.permissions ?? 0, // Default to 0 to avoid Firestore undefined error

      // Actor classification (defaults to 'user' on legacy contexts that
      // pre-date the agent rollout — createAuditContext now sets this).
      actorType: context.actorType ?? 'user',
      ...(context.agentRunId !== undefined && { agentRunId: context.agentRunId }),
      ...(context.agentToolName !== undefined && { agentToolName: context.agentToolName }),

      // Action details
      action,
      severity,
      description,

      // Target entity
      entityType,
      entityId,
      entityName: options?.entityName,

      // Parent entity (for nested items)
      parentEntityType: options?.parentEntityType,
      parentEntityId: options?.parentEntityId,

      // Change tracking
      changes: options?.changes,
      changeCount: options?.changes?.length,

      // Technical details
      ipAddress: await getClientIPAddress(),
      userAgent: typeof navigator !== 'undefined' ? navigator.userAgent : undefined,

      // Metadata
      metadata: options?.metadata,

      // Status
      success: options?.success ?? true,
      errorMessage: options?.errorMessage,

      // Timestamp
      timestamp: Timestamp.now(),
    };

    // Write to Firestore audit logs collection
    // Remove undefined values as Firestore rejects them
    const cleanedAuditLog = removeUndefinedValues(auditLog);
    await addDoc(collection(db, COLLECTIONS.AUDIT_LOGS), cleanedAuditLog);
  } catch (error) {
    // Don't throw errors from audit logging - log but don't block the operation
    logger.error('Failed to write audit log', {
      error,
      action,
      entityType,
      entityId,
      user: context.userEmail,
    });
  }
}

/**
 * Create audit field changes from old and new values
 * Useful for tracking what changed during an update operation
 */
export function createFieldChanges(
  oldData: Record<string, unknown>,
  newData: Record<string, unknown>,
  excludeFields: string[] = []
): AuditFieldChange[] {
  const changes: AuditFieldChange[] = [];

  // Default fields to exclude
  const defaultExclude = ['updatedAt', 'updatedBy', '_id', 'id'];
  const fieldsToExclude = new Set([...defaultExclude, ...excludeFields]);

  // Find all changed fields
  const allKeys = new Set([...Object.keys(oldData), ...Object.keys(newData)]);

  for (const key of allKeys) {
    // Skip excluded fields
    if (fieldsToExclude.has(key) || key.startsWith('_')) {
      continue;
    }

    const oldValue = oldData[key];
    const newValue = newData[key];

    // Check if value changed
    if (JSON.stringify(oldValue) !== JSON.stringify(newValue)) {
      changes.push({
        field: key,
        oldValue: formatValue(oldValue),
        newValue: formatValue(newValue),
        fieldType: getFieldType(newValue ?? oldValue),
      });
    }
  }

  return changes;
}

/**
 * Format a value for display in audit logs
 */
function formatValue(value: unknown): unknown {
  if (value === undefined) return undefined;
  if (value === null) return null;

  // Handle Firestore Timestamp
  if (value && typeof value === 'object' && 'toDate' in value) {
    return (value as { toDate: () => Date }).toDate().toISOString();
  }

  // Handle Date
  if (value instanceof Date) {
    return value.toISOString();
  }

  // Handle arrays - show count for large arrays
  if (Array.isArray(value)) {
    if (value.length > 5) {
      return `[${value.length} items]`;
    }
    return value;
  }

  return value;
}

/**
 * Determine field type for audit log
 */
function getFieldType(
  value: unknown
): 'string' | 'number' | 'boolean' | 'array' | 'object' | 'timestamp' | undefined {
  if (value === null || value === undefined) return undefined;
  if (typeof value === 'string') return 'string';
  if (typeof value === 'number') return 'number';
  if (typeof value === 'boolean') return 'boolean';
  if (Array.isArray(value)) return 'array';
  if (value && typeof value === 'object' && 'toDate' in value) return 'timestamp';
  if (typeof value === 'object') return 'object';
  return undefined;
}

/**
 * Helper to create audit context from auth state
 *
 * Note: When email is not available, we don't create a fake email.
 * The audit log will show the userName only, which is acceptable
 * for client-side audit logging where email might not be passed.
 */
export function createAuditContext(
  userId: string,
  userEmail: string,
  userName: string,
  permissions?: number
): AuditContext {
  // Don't use fake fallback emails - better to have empty than misleading
  const effectiveEmail = userEmail || '';
  const effectiveName = userName || userEmail || '';

  return {
    userId,
    userEmail: effectiveEmail,
    userName: effectiveName,
    permissions,
    actorType: 'user',
  };
}

/**
 * Helper to create an audit context for an agent-driven run.
 *
 * The agent orchestrator (Phase 0 in AI-AGENT-ROADMAP-2026-04-25.md) calls
 * this once per run, then re-uses the returned context for every tool that
 * writes to Firestore. Every audit row written through this context will
 * carry `actorType: 'agent'` plus the run + tool identifiers, so the admin
 * dashboard can reconstruct a full transcript by querying
 * `auditLogs where agentRunId == X order by timestamp asc`.
 *
 * The userEmail / userName come from constants in
 * apps/web/src/lib/agent/identity.ts so callers can't drift; the
 * agentUserId comes from the actual provisioned Firebase user (looked
 * up by scripts/provision-agent-identity.js — the orchestrator caches
 * it after first sign-in).
 *
 * @param agentUserId - the Firebase UID for the agent identity (the
 *   `agent@vapourtoolbox.internal` user provisioned in Phase 0)
 * @param runId - unique identifier for this run (typically a uuid)
 * @param toolName - the named tool the orchestrator is about to invoke
 *   (e.g. 'createDraftPR'); subsequent tool calls within the same run
 *   should call createAgentAuditContext again to update toolName.
 * @param tenantId - tenant scope for the run
 */
export function createAgentAuditContext(
  agentUserId: string,
  runId: string,
  toolName: string,
  tenantId: string
): AuditContext {
  // Local re-import to avoid circular dependencies — identity.ts is in
  // a sibling barrel, and importing it at the top of this file would
  // pull the agent module into every audit consumer.
  // The values are stable constants; we copy them inline.
  const AGENT_EMAIL_LOCAL = 'agent@vapourtoolbox.internal';
  const AGENT_DISPLAY_NAME_LOCAL = 'Vapour Agent';
  return {
    userId: agentUserId,
    userEmail: AGENT_EMAIL_LOCAL,
    userName: AGENT_DISPLAY_NAME_LOCAL,
    actorType: 'agent',
    agentRunId: runId,
    agentToolName: toolName,
    tenantId,
  };
}
