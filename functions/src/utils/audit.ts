import * as admin from 'firebase-admin';
import type {
  AuditAction,
  AuditSeverity,
  AuditFieldChange,
  CreateAuditLogParams,
} from '@vapour/types';

const COLLECTIONS = {
  AUDIT_LOGS: 'auditLogs',
};

/**
 * Create an audit log entry
 * This function is used throughout Cloud Functions to track all sensitive operations
 */
export async function createAuditLog(params: CreateAuditLogParams): Promise<string> {
  const db = admin.firestore();

  // Generate audit log ID
  const auditLogRef = db.collection(COLLECTIONS.AUDIT_LOGS).doc();

  // Build audit log entry (omitting undefined values for Firestore)
  const auditLog: Record<string, unknown> = {
    // Actor information
    actorId: params.actorId || 'system',
    actorEmail: params.actorEmail || 'system@vapourdesal.com',
    actorName: params.actorName || 'System',
    actorPermissions: params.actorPermissions || 0,

    // Action details
    action: params.action,
    severity: params.severity || 'INFO',

    // Target entity
    entityType: params.entityType,
    entityId: params.entityId,

    // Context
    description: params.description,

    // Timestamps
    timestamp: admin.firestore.FieldValue.serverTimestamp(),

    // Status
    success: params.success !== undefined ? params.success : true,
  };

  // Only add optional fields if they're defined
  if (params.entityName !== undefined) {
    auditLog.entityName = params.entityName;
  }
  if (params.changes !== undefined && params.changes.length > 0) {
    auditLog.changes = params.changes;
  }
  if (params.metadata !== undefined) {
    auditLog.metadata = params.metadata;
  }
  if (params.ipAddress !== undefined) {
    auditLog.ipAddress = params.ipAddress;
  }
  if (params.userAgent !== undefined) {
    auditLog.userAgent = params.userAgent;
  }
  if (params.errorMessage !== undefined) {
    auditLog.errorMessage = params.errorMessage;
  }

  // Save audit log
  await auditLogRef.set(auditLog);

  console.log(
    `[AUDIT] ${params.action} | ${params.entityType}:${params.entityId} | Actor: ${auditLog.actorEmail}`
  );

  return auditLogRef.id;
}

/**
 * Compare objects and generate field changes for audit logging
 * Handles undefined values by converting them to null for Firestore compatibility
 */
export function calculateFieldChanges(
  oldData: Record<string, unknown>,
  newData: Record<string, unknown>,
  fieldsToTrack: string[]
): AuditFieldChange[] {
  const changes: AuditFieldChange[] = [];

  for (const field of fieldsToTrack) {
    const oldValue = oldData[field];
    const newValue = newData[field];

    // Handle array comparison
    if (Array.isArray(oldValue) && Array.isArray(newValue)) {
      if (JSON.stringify(oldValue) !== JSON.stringify(newValue)) {
        changes.push({
          field,
          oldValue: oldValue,
          newValue: newValue,
        });
      }
    }
    // Handle object comparison
    else if (
      typeof oldValue === 'object' &&
      oldValue !== null &&
      typeof newValue === 'object' &&
      newValue !== null
    ) {
      if (JSON.stringify(oldValue) !== JSON.stringify(newValue)) {
        changes.push({
          field,
          oldValue: oldValue,
          newValue: newValue,
        });
      }
    }
    // Handle primitive comparison
    else if (oldValue !== newValue) {
      changes.push({
        field,
        // Convert undefined to null for Firestore compatibility
        oldValue: oldValue === undefined ? null : oldValue,
        newValue: newValue === undefined ? null : newValue,
      });
    }
  }

  return changes;
}

/**
 * Helper to extract actor information from Firebase Auth context
 */
export async function getActorFromAuth(userId: string): Promise<{
  actorId: string;
  actorEmail: string;
  actorName: string;
  actorPermissions: number;
}> {
  try {
    const user = await admin.auth().getUser(userId);
    const customClaims = user.customClaims || {};

    return {
      actorId: userId,
      actorEmail: user.email || 'unknown@vapourdesal.com',
      actorName: user.displayName || 'Unknown User',
      actorPermissions: (customClaims.permissions as number) || 0,
    };
  } catch (error) {
    console.error(`Failed to get actor info for user ${userId}:`, error);
    return {
      actorId: userId,
      actorEmail: 'unknown@vapourdesal.com',
      actorName: 'Unknown User',
      actorPermissions: 0,
    };
  }
}

/**
 * Helper to create audit log for user-related actions
 */
export async function auditUserAction(params: {
  action: AuditAction;
  userId: string;
  userEmail: string;
  userName: string;
  actorId?: string;
  actorEmail?: string;
  actorName?: string;
  changes?: AuditFieldChange[];
  metadata?: Record<string, unknown>;
  severity?: AuditSeverity;
}): Promise<string> {
  return createAuditLog({
    action: params.action,
    severity: params.severity || 'INFO',
    entityType: 'USER',
    entityId: params.userId,
    entityName: params.userEmail,
    description: `${params.action} for user ${params.userEmail}`,
    changes: params.changes,
    metadata: params.metadata,
    actorId: params.actorId,
    actorEmail: params.actorEmail,
    actorName: params.actorName,
  });
}

/**
 * Helper to create audit log for role/permission changes
 */
export async function auditRoleChange(params: {
  action: AuditAction;
  userId: string;
  userEmail: string;
  changes: AuditFieldChange[];
  actorId: string;
  actorEmail: string;
  actorName: string;
  metadata?: Record<string, unknown>;
}): Promise<string> {
  return createAuditLog({
    action: params.action,
    severity: 'WARNING', // Role changes are always important
    entityType: 'ROLE',
    entityId: params.userId,
    entityName: params.userEmail,
    description: `${params.action} for user ${params.userEmail}`,
    changes: params.changes,
    metadata: params.metadata,
    actorId: params.actorId,
    actorEmail: params.actorEmail,
    actorName: params.actorName,
  });
}

/**
 * Helper to create audit log for permission changes
 */
export async function auditPermissionChange(params: {
  action: AuditAction;
  userId: string;
  userEmail: string;
  changes: AuditFieldChange[];
  actorId: string;
  actorEmail: string;
  actorName: string;
  metadata?: Record<string, unknown>;
}): Promise<string> {
  return createAuditLog({
    action: params.action,
    severity: 'WARNING', // Permission changes are always important
    entityType: 'PERMISSION',
    entityId: params.userId,
    entityName: params.userEmail,
    description: `${params.action} for user ${params.userEmail}`,
    changes: params.changes,
    metadata: params.metadata,
    actorId: params.actorId,
    actorEmail: params.actorEmail,
    actorName: params.actorName,
  });
}
