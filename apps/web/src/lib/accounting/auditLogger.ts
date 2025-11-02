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

/**
 * User context for audit logging
 * Should be obtained from the current authenticated user
 */
export interface AuditUserContext {
  userId: string;
  userEmail: string;
  userName: string;
  userRoles?: string[];
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
      actorRoles: user.userRoles,

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
      ipAddress: undefined, // TODO: Get from request headers
      userAgent: typeof navigator !== 'undefined' ? navigator.userAgent : undefined,

      // Metadata
      metadata: metadata || {},

      // Status
      success: true,

      // Timestamp
      timestamp: Timestamp.now(),
    };

    // Write to Firestore audit logs collection
    await addDoc(collection(db, COLLECTIONS.AUDIT_LOGS), auditLog);

    console.log(`[AuditLogger] Logged ${action} on ${entityType} ${entityId}`);
  } catch (error) {
    // Don't throw errors from audit logging - log but don't block the operation
    console.error('[AuditLogger] Failed to write audit log:', error);
    console.error('[AuditLogger] Audit log data:', {
      action,
      entityType,
      entityId,
      user: user.userEmail,
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
