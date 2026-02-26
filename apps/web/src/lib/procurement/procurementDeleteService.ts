/**
 * Procurement Delete Service
 *
 * Manages soft-delete for Draft Purchase Requests, RFQs, and Purchase Orders.
 * Only DRAFT documents can be soft-deleted.
 */

import { doc, getDoc, updateDoc, Timestamp, type Firestore } from 'firebase/firestore';
import { COLLECTIONS } from '@vapour/firebase';
import { createLogger } from '@vapour/logger';
import { logAuditEvent, createAuditContext } from '@/lib/audit';
import { PERMISSION_FLAGS } from '@vapour/constants';
import { requirePermission } from '@/lib/auth/authorizationService';

const logger = createLogger({ context: 'procurementDeleteService' });

export interface ProcurementSoftDeleteInput {
  id: string;
  userId: string;
  userName: string;
  userPermissions?: number;
}

export interface ProcurementSoftDeleteResult {
  success: boolean;
  id: string;
  error?: string;
}

// --- Purchase Request ---

/**
 * Soft-delete a Draft Purchase Request.
 * Only DRAFT status PRs can be deleted.
 */
export async function softDeletePurchaseRequest(
  db: Firestore,
  input: ProcurementSoftDeleteInput
): Promise<ProcurementSoftDeleteResult> {
  const { id, userId, userName, userPermissions } = input;

  if (userPermissions !== undefined) {
    requirePermission(
      userPermissions,
      PERMISSION_FLAGS.MANAGE_PROCUREMENT,
      userId,
      'delete purchase request'
    );
  }

  try {
    const ref = doc(db, COLLECTIONS.PURCHASE_REQUESTS, id);
    const snap = await getDoc(ref);

    if (!snap.exists()) {
      return { success: false, id, error: 'Purchase Request not found' };
    }

    const data = snap.data();

    if (data.status !== 'DRAFT') {
      return { success: false, id, error: 'Only DRAFT Purchase Requests can be deleted' };
    }

    if (data.isDeleted) {
      return { success: false, id, error: 'Purchase Request is already deleted' };
    }

    await updateDoc(ref, {
      isDeleted: true,
      deletedAt: Timestamp.now(),
      deletedBy: userId,
      updatedAt: Timestamp.now(),
      updatedBy: userId,
    });

    const auditContext = createAuditContext(userId, '', userName);
    try {
      await logAuditEvent(
        db,
        auditContext,
        'DOCUMENT_DELETED',
        'PURCHASE_REQUEST',
        id,
        `Purchase Request moved to trash: ${data.number || id}`,
        { severity: 'INFO', metadata: { number: data.number, status: data.status } }
      );
    } catch (auditError) {
      logger.warn('Failed to write audit log for PR soft delete', { auditError, id });
    }

    logger.info('Purchase Request soft deleted', { id, number: data.number });
    return { success: true, id };
  } catch (error) {
    logger.error('Error soft deleting purchase request', { id, error });
    return {
      success: false,
      id,
      error: error instanceof Error ? error.message : 'Unknown error',
    };
  }
}

// --- RFQ ---

/**
 * Soft-delete a Draft RFQ.
 * Only DRAFT status RFQs can be deleted.
 */
export async function softDeleteRFQ(
  db: Firestore,
  input: ProcurementSoftDeleteInput
): Promise<ProcurementSoftDeleteResult> {
  const { id, userId, userName, userPermissions } = input;

  if (userPermissions !== undefined) {
    requirePermission(userPermissions, PERMISSION_FLAGS.MANAGE_PROCUREMENT, userId, 'delete RFQ');
  }

  try {
    const ref = doc(db, COLLECTIONS.RFQS, id);
    const snap = await getDoc(ref);

    if (!snap.exists()) {
      return { success: false, id, error: 'RFQ not found' };
    }

    const data = snap.data();

    if (data.status !== 'DRAFT') {
      return { success: false, id, error: 'Only DRAFT RFQs can be deleted' };
    }

    if (data.isDeleted) {
      return { success: false, id, error: 'RFQ is already deleted' };
    }

    await updateDoc(ref, {
      isDeleted: true,
      deletedAt: Timestamp.now(),
      deletedBy: userId,
      updatedAt: Timestamp.now(),
      updatedBy: userId,
    });

    const auditContext = createAuditContext(userId, '', userName);
    try {
      await logAuditEvent(
        db,
        auditContext,
        'DOCUMENT_DELETED',
        'RFQ',
        id,
        `RFQ moved to trash: ${data.number || id}`,
        { severity: 'INFO', metadata: { number: data.number, status: data.status } }
      );
    } catch (auditError) {
      logger.warn('Failed to write audit log for RFQ soft delete', { auditError, id });
    }

    logger.info('RFQ soft deleted', { id, number: data.number });
    return { success: true, id };
  } catch (error) {
    logger.error('Error soft deleting RFQ', { id, error });
    return {
      success: false,
      id,
      error: error instanceof Error ? error.message : 'Unknown error',
    };
  }
}

// --- Purchase Order ---

/**
 * Soft-delete a Draft Purchase Order.
 * Only DRAFT status POs can be deleted.
 */
export async function softDeletePurchaseOrder(
  db: Firestore,
  input: ProcurementSoftDeleteInput
): Promise<ProcurementSoftDeleteResult> {
  const { id, userId, userName, userPermissions } = input;

  if (userPermissions !== undefined) {
    requirePermission(
      userPermissions,
      PERMISSION_FLAGS.MANAGE_PROCUREMENT,
      userId,
      'delete purchase order'
    );
  }

  try {
    const ref = doc(db, COLLECTIONS.PURCHASE_ORDERS, id);
    const snap = await getDoc(ref);

    if (!snap.exists()) {
      return { success: false, id, error: 'Purchase Order not found' };
    }

    const data = snap.data();

    if (data.status !== 'DRAFT') {
      return { success: false, id, error: 'Only DRAFT Purchase Orders can be deleted' };
    }

    if (data.isDeleted) {
      return { success: false, id, error: 'Purchase Order is already deleted' };
    }

    await updateDoc(ref, {
      isDeleted: true,
      deletedAt: Timestamp.now(),
      deletedBy: userId,
      updatedAt: Timestamp.now(),
      updatedBy: userId,
    });

    const auditContext = createAuditContext(userId, '', userName);
    try {
      await logAuditEvent(
        db,
        auditContext,
        'DOCUMENT_DELETED',
        'PURCHASE_ORDER',
        id,
        `Purchase Order moved to trash: ${data.number || id}`,
        { severity: 'INFO', metadata: { number: data.number, status: data.status } }
      );
    } catch (auditError) {
      logger.warn('Failed to write audit log for PO soft delete', { auditError, id });
    }

    logger.info('Purchase Order soft deleted', { id, number: data.number });
    return { success: true, id };
  } catch (error) {
    logger.error('Error soft deleting purchase order', { id, error });
    return {
      success: false,
      id,
      error: error instanceof Error ? error.message : 'Unknown error',
    };
  }
}
