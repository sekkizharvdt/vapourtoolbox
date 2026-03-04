/**
 * Procurement Delete Service
 *
 * Manages soft-delete for procurement documents.
 * During development, non-terminal statuses are deletable.
 */

import { doc, getDoc, updateDoc, deleteField, Timestamp, type Firestore } from 'firebase/firestore';
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

    const deletableStatuses = ['DRAFT', 'SUBMITTED', 'APPROVED', 'CONVERTED_TO_RFQ'];
    if (!deletableStatuses.includes(data.status)) {
      return {
        success: false,
        id,
        error:
          'Only DRAFT, SUBMITTED, APPROVED, or CONVERTED_TO_RFQ Purchase Requests can be deleted',
      };
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
 * Soft-delete an RFQ.
 * DRAFT and ISSUED RFQs can be deleted.
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

    const rfqDeletableStatuses = ['DRAFT', 'ISSUED'];
    if (!rfqDeletableStatuses.includes(data.status)) {
      return { success: false, id, error: 'Only DRAFT or ISSUED RFQs can be deleted' };
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
 * Soft-delete a Purchase Order.
 * DRAFT and PENDING_APPROVAL POs can be deleted.
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

    const poDeletableStatuses = ['DRAFT', 'PENDING_APPROVAL'];
    if (!poDeletableStatuses.includes(data.status)) {
      return {
        success: false,
        id,
        error: 'Only DRAFT or PENDING_APPROVAL Purchase Orders can be deleted',
      };
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

// --- Goods Receipt ---

/**
 * Soft-delete a Goods Receipt.
 * PENDING and IN_PROGRESS GRs can be deleted.
 */
export async function softDeleteGoodsReceipt(
  db: Firestore,
  input: ProcurementSoftDeleteInput
): Promise<ProcurementSoftDeleteResult> {
  const { id, userId, userName, userPermissions } = input;

  if (userPermissions !== undefined) {
    requirePermission(
      userPermissions,
      PERMISSION_FLAGS.MANAGE_PROCUREMENT,
      userId,
      'delete goods receipt'
    );
  }

  try {
    const ref = doc(db, COLLECTIONS.GOODS_RECEIPTS, id);
    const snap = await getDoc(ref);

    if (!snap.exists()) {
      return { success: false, id, error: 'Goods Receipt not found' };
    }

    const data = snap.data();

    const grDeletableStatuses = ['PENDING', 'IN_PROGRESS'];
    if (!grDeletableStatuses.includes(data.status)) {
      return {
        success: false,
        id,
        error: 'Only PENDING or IN_PROGRESS Goods Receipts can be deleted',
      };
    }

    if (data.isDeleted) {
      return { success: false, id, error: 'Goods Receipt is already deleted' };
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
        'GOODS_RECEIPT',
        id,
        `Goods Receipt moved to trash: ${data.number || id}`,
        { severity: 'INFO', metadata: { number: data.number, status: data.status } }
      );
    } catch (auditError) {
      logger.warn('Failed to write audit log for GR soft delete', { auditError, id });
    }

    logger.info('Goods Receipt soft deleted', { id, number: data.number });
    return { success: true, id };
  } catch (error) {
    logger.error('Error soft deleting goods receipt', { id, error });
    return {
      success: false,
      id,
      error: error instanceof Error ? error.message : 'Unknown error',
    };
  }
}

// --- Packing List ---

/**
 * Soft-delete a Packing List.
 * Only DRAFT Packing Lists can be deleted.
 */
export async function softDeletePackingList(
  db: Firestore,
  input: ProcurementSoftDeleteInput
): Promise<ProcurementSoftDeleteResult> {
  const { id, userId, userName, userPermissions } = input;

  if (userPermissions !== undefined) {
    requirePermission(
      userPermissions,
      PERMISSION_FLAGS.MANAGE_PROCUREMENT,
      userId,
      'delete packing list'
    );
  }

  try {
    const ref = doc(db, COLLECTIONS.PACKING_LISTS, id);
    const snap = await getDoc(ref);

    if (!snap.exists()) {
      return { success: false, id, error: 'Packing List not found' };
    }

    const data = snap.data();

    if (data.status !== 'DRAFT') {
      return { success: false, id, error: 'Only DRAFT Packing Lists can be deleted' };
    }

    if (data.isDeleted) {
      return { success: false, id, error: 'Packing List is already deleted' };
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
        'PACKING_LIST',
        id,
        `Packing List moved to trash: ${data.number || id}`,
        { severity: 'INFO', metadata: { number: data.number, status: data.status } }
      );
    } catch (auditError) {
      logger.warn('Failed to write audit log for PL soft delete', { auditError, id });
    }

    logger.info('Packing List soft deleted', { id, number: data.number });
    return { success: true, id };
  } catch (error) {
    logger.error('Error soft deleting packing list', { id, error });
    return {
      success: false,
      id,
      error: error instanceof Error ? error.message : 'Unknown error',
    };
  }
}

// --- PO Amendment ---

/**
 * Soft-delete a PO Amendment.
 * DRAFT and PENDING_APPROVAL Amendments can be deleted.
 */
export async function softDeleteAmendment(
  db: Firestore,
  input: ProcurementSoftDeleteInput
): Promise<ProcurementSoftDeleteResult> {
  const { id, userId, userName, userPermissions } = input;

  if (userPermissions !== undefined) {
    requirePermission(
      userPermissions,
      PERMISSION_FLAGS.MANAGE_PROCUREMENT,
      userId,
      'delete amendment'
    );
  }

  try {
    const ref = doc(db, COLLECTIONS.PURCHASE_ORDER_AMENDMENTS, id);
    const snap = await getDoc(ref);

    if (!snap.exists()) {
      return { success: false, id, error: 'Amendment not found' };
    }

    const data = snap.data();

    const amendmentDeletableStatuses = ['DRAFT', 'PENDING_APPROVAL'];
    if (!amendmentDeletableStatuses.includes(data.status)) {
      return {
        success: false,
        id,
        error: 'Only DRAFT or PENDING_APPROVAL Amendments can be deleted',
      };
    }

    if (data.isDeleted) {
      return { success: false, id, error: 'Amendment is already deleted' };
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
        'PURCHASE_ORDER_AMENDMENT',
        id,
        `PO Amendment moved to trash: ${data.purchaseOrderNumber || id} #${data.amendmentNumber || '?'}`,
        {
          severity: 'INFO',
          metadata: { purchaseOrderNumber: data.purchaseOrderNumber, status: data.status },
        }
      );
    } catch (auditError) {
      logger.warn('Failed to write audit log for amendment soft delete', { auditError, id });
    }

    logger.info('Amendment soft deleted', { id, purchaseOrderNumber: data.purchaseOrderNumber });
    return { success: true, id };
  } catch (error) {
    logger.error('Error soft deleting amendment', { id, error });
    return {
      success: false,
      id,
      error: error instanceof Error ? error.message : 'Unknown error',
    };
  }
}

// --- Restore (generic for all procurement collections) ---

import type { AuditEntityType } from '@vapour/types';

/** Map Firestore collection names to AuditEntityType */
const COLLECTION_TO_ENTITY_TYPE: Record<string, AuditEntityType> = {
  [COLLECTIONS.PURCHASE_REQUESTS]: 'PURCHASE_REQUEST',
  [COLLECTIONS.RFQS]: 'RFQ',
  [COLLECTIONS.PURCHASE_ORDERS]: 'PURCHASE_ORDER',
  [COLLECTIONS.GOODS_RECEIPTS]: 'GOODS_RECEIPT',
  [COLLECTIONS.PACKING_LISTS]: 'PACKING_LIST',
  [COLLECTIONS.PURCHASE_ORDER_AMENDMENTS]: 'PURCHASE_ORDER_AMENDMENT',
};

/**
 * Restore a soft-deleted procurement document.
 * Clears isDeleted, deletedAt, deletedBy fields.
 */
export async function restoreProcurementDocument(
  db: Firestore,
  collectionName: string,
  input: ProcurementSoftDeleteInput
): Promise<ProcurementSoftDeleteResult> {
  const { id, userId, userName, userPermissions } = input;

  if (userPermissions !== undefined) {
    requirePermission(
      userPermissions,
      PERMISSION_FLAGS.MANAGE_PROCUREMENT,
      userId,
      'restore procurement document'
    );
  }

  try {
    const ref = doc(db, collectionName, id);
    const snap = await getDoc(ref);

    if (!snap.exists()) {
      return { success: false, id, error: 'Document not found' };
    }

    const data = snap.data();

    if (!data.isDeleted) {
      return { success: false, id, error: 'Document is not deleted' };
    }

    await updateDoc(ref, {
      isDeleted: deleteField(),
      deletedAt: deleteField(),
      deletedBy: deleteField(),
      updatedAt: Timestamp.now(),
      updatedBy: userId,
    });

    const auditContext = createAuditContext(userId, '', userName);
    try {
      await logAuditEvent(
        db,
        auditContext,
        'DOCUMENT_UPDATED',
        COLLECTION_TO_ENTITY_TYPE[collectionName] || 'PURCHASE_REQUEST',
        id,
        `Procurement document restored from trash: ${data.number || id}`,
        { severity: 'INFO', metadata: { number: data.number, status: data.status } }
      );
    } catch (auditError) {
      logger.warn('Failed to write audit log for procurement restore', { auditError, id });
    }

    logger.info('Procurement document restored', {
      id,
      collection: collectionName,
      number: data.number,
    });
    return { success: true, id };
  } catch (error) {
    logger.error('Error restoring procurement document', { id, collectionName, error });
    return {
      success: false,
      id,
      error: error instanceof Error ? error.message : 'Unknown error',
    };
  }
}
