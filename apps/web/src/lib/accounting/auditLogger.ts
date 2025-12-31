/**
 * Audit Logger for Financial Transactions
 *
 * Provides utilities for logging financial transaction events to the audit trail.
 * All financial operations (create, update, delete, approve, post) are logged
 * for compliance and audit purposes.
 */

import { collection, addDoc, Timestamp, type Firestore } from 'firebase/firestore';
import { COLLECTIONS } from '@vapour/firebase';
import type {
  AuditLog,
  AuditAction,
  AuditSeverity,
  AuditEntityType,
  AuditFieldChange,
} from '@vapour/types';
import { createLogger } from '@vapour/logger';

const logger = createLogger({ context: 'auditLogger' });

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
    const timeoutId = setTimeout(() => controller.abort(), 2000); // 2 second timeout

    const response = await fetch('https://api.ipify.org?format=json', {
      signal: controller.signal,
    });
    clearTimeout(timeoutId);

    if (response.ok) {
      const data = await response.json();
      return data.ip as string;
    }
  } catch (error) {
    // IP detection failed - not critical, continue without IP
    logger.warn('Could not detect client IP', { error });
  }

  return undefined;
}

/**
 * User context for audit logging
 * Should be obtained from the current authenticated user
 */
export interface AuditUserContext {
  userId: string;
  userEmail: string;
  userName: string;
  userPermissions?: number; // Bitwise permission flags
}

/**
 * Log a financial transaction event to the audit trail
 *
 * @param db - Firestore database instance
 * @param user - Current user context
 * @param action - Type of action performed
 * @param entityType - Type of entity affected
 * @param entityId - ID of the affected entity
 * @param description - Human-readable description of the action
 * @param entityName - Name/number of the affected entity (e.g., "INV-2024-001")
 * @param changes - Optional field changes for update operations
 * @param metadata - Optional additional metadata
 */
export async function logFinancialTransactionEvent(
  db: Firestore,
  user: AuditUserContext,
  action: AuditAction,
  entityType: AuditEntityType,
  entityId: string,
  description: string,
  entityName?: string,
  changes?: AuditFieldChange[],
  metadata?: Record<string, unknown>
): Promise<void> {
  try {
    // Determine severity based on action
    const severity: AuditSeverity = getSeverityForAction(action);

    const auditLog: Omit<AuditLog, 'id'> = {
      // Actor information
      actorId: user.userId,
      actorEmail: user.userEmail,
      actorName: user.userName,
      actorPermissions: user.userPermissions,

      // Action details
      action,
      severity,
      description,

      // Target entity
      entityType,
      entityId,
      entityName,

      // Change tracking
      changes,

      // Technical details
      ipAddress: await getClientIPAddress(), // Captured from client metadata
      userAgent: typeof navigator !== 'undefined' ? navigator.userAgent : undefined,

      // Metadata
      metadata: metadata || {},

      // Status
      success: true,

      // Timestamp
      timestamp: Timestamp.now(),
    };

    // Remove undefined values before sending to Firestore
    const cleanedAuditLog = Object.fromEntries(
      Object.entries(auditLog).filter(([, value]) => value !== undefined)
    );

    // Write to Firestore audit logs collection
    await addDoc(collection(db, COLLECTIONS.AUDIT_LOGS), cleanedAuditLog);
  } catch (error) {
    // First attempt failed - retry once before falling back
    logger.error('Failed to write audit log - attempting retry', {
      error,
      action,
      entityType,
      entityId,
      user: user.userEmail,
    });

    try {
      // Retry the write operation once
      const retryAuditLog: Omit<AuditLog, 'id'> = {
        actorId: user.userId,
        actorEmail: user.userEmail,
        actorName: user.userName,
        actorPermissions: user.userPermissions,
        action,
        severity: getSeverityForAction(action),
        description,
        entityType,
        entityId,
        entityName,
        changes,
        ipAddress: undefined, // Skip IP on retry to avoid another failure
        userAgent: typeof navigator !== 'undefined' ? navigator.userAgent : undefined,
        metadata: { ...(metadata || {}), _retryAttempt: true },
        success: true,
        timestamp: Timestamp.now(),
      };

      // Remove undefined values before sending to Firestore
      const cleanedRetryLog = Object.fromEntries(
        Object.entries(retryAuditLog).filter(([, value]) => value !== undefined)
      );

      await addDoc(collection(db, COLLECTIONS.AUDIT_LOGS), cleanedRetryLog);
      logger.info('Audit log written successfully on retry', { entityId, action });
    } catch (retryError) {
      // Retry also failed - write to fallback storage
      logger.error('Audit log retry failed - writing to fallback storage', {
        error: retryError,
        action,
        entityType,
        entityId,
      });

      // Store failed audit log in localStorage as fallback (for later sync)
      await writeFallbackAuditLog({
        action,
        entityType,
        entityId,
        entityName,
        user: user.userEmail,
        description,
        timestamp: new Date().toISOString(),
        originalError: String(error),
        retryError: String(retryError),
      });
    }
  }
}

/**
 * Fallback audit log entry for when Firestore writes fail
 */
interface FallbackAuditEntry {
  action: AuditAction;
  entityType: AuditEntityType;
  entityId: string;
  entityName?: string;
  user: string;
  description: string;
  timestamp: string;
  originalError: string;
  retryError: string;
}

/**
 * Write audit log to localStorage as fallback when Firestore is unavailable
 * These can be synced back to Firestore when connectivity is restored
 */
async function writeFallbackAuditLog(entry: FallbackAuditEntry): Promise<void> {
  if (typeof window === 'undefined') {
    // In SSR, just log to console - no localStorage available
    logger.error('CRITICAL: Audit log lost in SSR context', { entry });
    return;
  }

  try {
    const FALLBACK_KEY = 'vapour_failed_audit_logs';
    const existing = localStorage.getItem(FALLBACK_KEY);
    const entries: FallbackAuditEntry[] = existing ? JSON.parse(existing) : [];

    // Add new entry with a cap to prevent localStorage overflow
    entries.push(entry);

    // Keep only last 100 failed entries to avoid storage limits
    const trimmed = entries.slice(-100);

    localStorage.setItem(FALLBACK_KEY, JSON.stringify(trimmed));
    logger.warn('Audit log written to fallback storage', {
      entityId: entry.entityId,
      totalPending: trimmed.length,
    });
  } catch (storageError) {
    // Last resort - log to console with full details for manual recovery
    logger.error('CRITICAL: Failed to write fallback audit log', {
      storageError,
      entry,
    });
  }
}

/**
 * Determine audit severity based on action type
 */
function getSeverityForAction(action: AuditAction): AuditSeverity {
  // For now, use a simple mapping based on action patterns
  const actionStr = action.toString();

  if (actionStr.includes('DELETED')) {
    return 'CRITICAL'; // Deletions are critical severity
  }

  if (actionStr.includes('REJECTED') || actionStr.includes('DEACTIVATED')) {
    return 'WARNING'; // Rejections and deactivations are warnings
  }

  if (actionStr.includes('EXPORTED') || actionStr.includes('BACKUP')) {
    return 'WARNING'; // Data exports and backups are warnings
  }

  return 'INFO'; // Default to info for other operations
}

/**
 * Create audit field changes from old and new values
 * Useful for tracking what changed during an update operation
 */
export function createAuditFieldChanges(
  oldData: Record<string, unknown>,
  newData: Record<string, unknown>
): AuditFieldChange[] {
  const changes: AuditFieldChange[] = [];

  // Find all changed fields
  const allKeys = new Set([...Object.keys(oldData), ...Object.keys(newData)]);

  for (const key of allKeys) {
    // Skip internal/system fields
    if (key.startsWith('_') || key === 'updatedAt' || key === 'updatedBy') {
      continue;
    }

    const oldValue = oldData[key];
    const newValue = newData[key];

    // Check if value changed
    if (JSON.stringify(oldValue) !== JSON.stringify(newValue)) {
      changes.push({
        field: key,
        oldValue: oldValue !== undefined ? String(oldValue) : undefined,
        newValue: newValue !== undefined ? String(newValue) : undefined,
      });
    }
  }

  return changes;
}

/**
 * Convenience function to log payment creation
 * Uses DATA_EXPORTED as a placeholder since financial transaction types don't exist yet
 */
export async function logPaymentCreated(
  db: Firestore,
  user: AuditUserContext,
  paymentId: string,
  paymentNumber: string,
  amount: number,
  currency: string,
  customerId: string
): Promise<void> {
  await logFinancialTransactionEvent(
    db,
    user,
    'DATA_EXPORTED', // Placeholder - should be PAYMENT_CREATED when added to types
    'SYSTEM', // Placeholder - should be PAYMENT when added to types
    paymentId,
    `Created customer payment ${paymentNumber} for ${currency} ${amount}`,
    paymentNumber,
    undefined,
    {
      amount,
      currency,
      customerId,
      operationType: 'CUSTOMER_PAYMENT',
      action: 'CREATE',
    }
  );
}

/**
 * Convenience function to log payment update
 */
export async function logPaymentUpdated(
  db: Firestore,
  user: AuditUserContext,
  paymentId: string,
  paymentNumber: string,
  changes: AuditFieldChange[]
): Promise<void> {
  await logFinancialTransactionEvent(
    db,
    user,
    'DATA_EXPORTED', // Placeholder - should be PAYMENT_UPDATED when added to types
    'SYSTEM',
    paymentId,
    `Updated customer payment ${paymentNumber}`,
    paymentNumber,
    changes,
    {
      operationType: 'CUSTOMER_PAYMENT',
      action: 'UPDATE',
    }
  );
}

/**
 * Convenience function to log invoice status update
 */
export async function logInvoiceStatusUpdated(
  db: Firestore,
  user: AuditUserContext,
  invoiceId: string,
  invoiceNumber: string,
  oldStatus: string,
  newStatus: string,
  allocatedAmount?: number
): Promise<void> {
  await logFinancialTransactionEvent(
    db,
    user,
    'DATA_EXPORTED', // Placeholder - should be INVOICE_UPDATED when added to types
    'SYSTEM',
    invoiceId,
    `Updated invoice ${invoiceNumber} status from ${oldStatus} to ${newStatus}`,
    invoiceNumber,
    [
      {
        field: 'status',
        oldValue: oldStatus,
        newValue: newStatus,
      },
    ],
    {
      allocatedAmount,
      operationType: 'STATUS_UPDATE',
      action: 'UPDATE',
    }
  );
}

/**
 * Convenience function to log payment posting
 */
export async function logPaymentPosted(
  db: Firestore,
  user: AuditUserContext,
  paymentId: string,
  paymentNumber: string
): Promise<void> {
  await logFinancialTransactionEvent(
    db,
    user,
    'DATA_EXPORTED', // Placeholder - should be PAYMENT_POSTED when added to types
    'SYSTEM',
    paymentId,
    `Posted customer payment ${paymentNumber}`,
    paymentNumber,
    [
      {
        field: 'status',
        oldValue: 'DRAFT',
        newValue: 'POSTED',
      },
    ],
    {
      operationType: 'CUSTOMER_PAYMENT',
      action: 'POST',
    }
  );
}

/**
 * Sync any failed audit logs from localStorage back to Firestore
 * Call this when the application regains connectivity or on app startup
 *
 * @param db - Firestore database instance
 * @param user - Current user context for the sync operation
 * @returns Number of successfully synced entries
 */
export async function syncFallbackAuditLogs(
  db: Firestore,
  user: AuditUserContext
): Promise<number> {
  if (typeof window === 'undefined') {
    return 0;
  }

  const FALLBACK_KEY = 'vapour_failed_audit_logs';
  const existing = localStorage.getItem(FALLBACK_KEY);

  if (!existing) {
    return 0;
  }

  let entries: FallbackAuditEntry[];
  try {
    entries = JSON.parse(existing);
  } catch {
    logger.error('Failed to parse fallback audit logs');
    return 0;
  }

  if (entries.length === 0) {
    return 0;
  }

  logger.info('Attempting to sync fallback audit logs', { count: entries.length });

  const failed: FallbackAuditEntry[] = [];
  let synced = 0;

  for (const entry of entries) {
    try {
      const recoveredLog: Omit<AuditLog, 'id'> = {
        actorId: user.userId,
        actorEmail: entry.user,
        actorName: user.userName,
        action: entry.action,
        severity: getSeverityForAction(entry.action),
        description: entry.description,
        entityType: entry.entityType,
        entityId: entry.entityId,
        entityName: entry.entityName,
        success: true,
        timestamp: Timestamp.fromDate(new Date(entry.timestamp)),
        metadata: {
          _recoveredFromFallback: true,
          _originalError: entry.originalError,
          _recoveredAt: new Date().toISOString(),
        },
      };

      // Remove undefined values before sending to Firestore
      const cleanedRecoveredLog = Object.fromEntries(
        Object.entries(recoveredLog).filter(([, value]) => value !== undefined)
      );

      await addDoc(collection(db, COLLECTIONS.AUDIT_LOGS), cleanedRecoveredLog);
      synced++;
    } catch {
      // Keep for next sync attempt
      failed.push(entry);
    }
  }

  // Update localStorage with remaining failed entries
  if (failed.length > 0) {
    localStorage.setItem(FALLBACK_KEY, JSON.stringify(failed));
  } else {
    localStorage.removeItem(FALLBACK_KEY);
  }

  logger.info('Fallback audit log sync complete', { synced, remaining: failed.length });
  return synced;
}

/**
 * Get count of pending fallback audit logs
 * Useful for showing a warning indicator in the UI
 */
export function getPendingAuditLogCount(): number {
  if (typeof window === 'undefined') {
    return 0;
  }

  const FALLBACK_KEY = 'vapour_failed_audit_logs';
  const existing = localStorage.getItem(FALLBACK_KEY);

  if (!existing) {
    return 0;
  }

  try {
    const entries = JSON.parse(existing);
    return Array.isArray(entries) ? entries.length : 0;
  } catch {
    return 0;
  }
}
