/**
 * Purchase Order Workflow Operations
 *
 * Handles PO workflow and status transitions:
 * - Submit for approval
 * - Approve PO
 * - Reject PO
 * - Issue PO
 * - General status updates
 */

import {
  doc,
  updateDoc,
  Timestamp,
  runTransaction,
} from 'firebase/firestore';
import { getFirebase } from '@/lib/firebase';
import { COLLECTIONS } from '@vapour/firebase';
import type { PurchaseOrderStatus } from '@vapour/types';
import { PermissionFlag } from '@vapour/types';
import { createLogger } from '@vapour/logger';
import { formatCurrency } from '../purchaseOrderHelpers';
import { logAuditEvent, createAuditContext } from '@/lib/audit';
import { requirePermission, requireApprover, preventSelfApproval } from '@/lib/auth';
import { purchaseOrderStateMachine } from '@/lib/workflow/stateMachines';
import { getPOById } from './crud';

const logger = createLogger({ context: 'purchaseOrder/workflow' });

// ============================================================================
// SUBMIT FOR APPROVAL
// ============================================================================

export async function submitPOForApproval(
  poId: string,
  userId: string,
  userName: string,
  approverId?: string
): Promise<void> {
  const { db } = getFirebase();

  // Get PO for notification details
  const po = await getPOById(poId);
  if (!po) {
    throw new Error('Purchase Order not found');
  }

  await updateDoc(doc(db, COLLECTIONS.PURCHASE_ORDERS, poId), {
    status: 'PENDING_APPROVAL',
    submittedForApprovalAt: Timestamp.now(),
    submittedBy: userId,
    ...(approverId && { approverId }),
    updatedAt: Timestamp.now(),
    updatedBy: userId,
  });

  // Audit log: PO submitted
  const auditContext = createAuditContext(userId, '', userName);
  await logAuditEvent(
    db,
    auditContext,
    'PO_UPDATED',
    'PURCHASE_ORDER',
    poId,
    `Submitted Purchase Order ${po.number} for approval`,
    {
      entityName: po.number,
      metadata: {
        vendorName: po.vendorName,
        grandTotal: po.grandTotal,
        approverId,
      },
    }
  );

  // Create task notification for selected approver
  if (approverId) {
    const { createTaskNotification } = await import('@/lib/tasks/taskNotificationService');
    await createTaskNotification({
      type: 'actionable',
      category: 'PO_PENDING_APPROVAL',
      userId: approverId,
      assignedBy: userId,
      assignedByName: userName,
      title: `Review Purchase Order ${po.number}`,
      message: `${userName} submitted a purchase order for your approval: ${po.vendorName} - ${formatCurrency(po.grandTotal, po.currency)}`,
      entityType: 'PURCHASE_ORDER',
      entityId: poId,
      linkUrl: `/procurement/pos/${poId}`,
      priority: 'HIGH',
      autoCompletable: true,
      projectId: po.projectIds[0], // Use first project ID
    });
  }

  logger.info('PO submitted for approval', { poId, approverId });
}

// ============================================================================
// APPROVE PO
// ============================================================================

export async function approvePO(
  poId: string,
  userId: string,
  userName: string,
  userPermissions: number,
  comments?: string,
  bankAccountId?: string
): Promise<void> {
  const { db } = getFirebase();

  // Authorization: Require APPROVE_PO permission
  requirePermission(userPermissions, PermissionFlag.APPROVE_PO, userId, 'approve purchase order');

  // Atomically approve PO to prevent race conditions
  const po = await runTransaction(db, async (transaction) => {
    const now = Timestamp.now();
    const poRef = doc(db, COLLECTIONS.PURCHASE_ORDERS, poId);

    const poDoc = await transaction.get(poRef);
    if (!poDoc.exists()) {
      throw new Error('Purchase Order not found');
    }

    const poData = { id: poDoc.id, ...poDoc.data() } as ReturnType<typeof getPOById> extends Promise<infer T> ? NonNullable<T> : never;

    // Validate state machine transition
    const transitionResult = purchaseOrderStateMachine.validateTransition(
      poData.status,
      'APPROVED'
    );
    if (!transitionResult.allowed) {
      throw new Error(transitionResult.reason || `Cannot approve PO with status: ${poData.status}`);
    }

    // Authorization: Prevent self-approval
    preventSelfApproval(userId, poData.createdBy, 'approve purchase order');

    // Authorization: Check designated approver if set
    if (poData.approverId && poData.approverId !== userId) {
      requireApprover(userId, [poData.approverId], 'approve this purchase order');
    }

    // Update PO status atomically
    transaction.update(poRef, {
      status: 'APPROVED',
      approvedBy: userId,
      approvedByName: userName,
      approvedAt: now,
      approvalComments: comments,
      updatedAt: now,
      updatedBy: userId,
    });

    return poData;
  });

  // Audit log outside transaction (non-critical)
  const auditContext = createAuditContext(userId, '', userName);
  logAuditEvent(
    db,
    auditContext,
    'PO_APPROVED',
    'PURCHASE_ORDER',
    poId,
    `Approved Purchase Order ${po.number}`,
    {
      entityName: po.number,
      metadata: {
        vendorName: po.vendorName,
        grandTotal: po.grandTotal,
        comments,
      },
    }
  ).catch((err) => logger.error('Failed to log audit event', { error: err }));

  logger.info('PO approved', { poId });

  // Create advance payment if required (outside transaction)
  // This involves complex GL entry generation that can't easily be in same transaction
  if (po.advancePaymentRequired && bankAccountId) {
    try {
      const { createAdvancePaymentFromPO } = await import('../accountingIntegration');
      const userEmail = userName; // Use userName as fallback for email
      const paymentId = await createAdvancePaymentFromPO(db, po, bankAccountId, userId, userEmail);

      // Update PO with payment reference
      await updateDoc(doc(db, COLLECTIONS.PURCHASE_ORDERS, poId), {
        advancePaymentId: paymentId,
        advancePaymentStatus: 'REQUESTED',
        updatedAt: Timestamp.now(),
        updatedBy: userId,
      });

      logger.info('Advance payment created', { paymentId });
    } catch (err) {
      logger.error('Error creating advance payment (can be created manually)', {
        poId,
        error: err,
      });
      // PO is approved, advance payment can be created manually through accounting
    }
  } else if (po.advancePaymentRequired && !bankAccountId) {
    logger.warn('Advance payment required but no bank account provided');
    await updateDoc(doc(db, COLLECTIONS.PURCHASE_ORDERS, poId), {
      advancePaymentStatus: 'PENDING',
      updatedAt: Timestamp.now(),
      updatedBy: userId,
    });
  }
}

// ============================================================================
// REJECT PO
// ============================================================================

export async function rejectPO(
  poId: string,
  userId: string,
  userName: string,
  userPermissions: number,
  reason: string
): Promise<void> {
  const { db } = getFirebase();

  // Authorization: Require APPROVE_PO permission
  requirePermission(userPermissions, PermissionFlag.APPROVE_PO, userId, 'reject purchase order');

  // Get PO for validation and audit log
  const po = await getPOById(poId);
  if (!po) {
    throw new Error('Purchase Order not found');
  }

  // Validate state machine transition
  const transitionResult = purchaseOrderStateMachine.validateTransition(po.status, 'REJECTED');
  if (!transitionResult.allowed) {
    throw new Error(transitionResult.reason || `Cannot reject PO with status: ${po.status}`);
  }

  // Authorization: Prevent self-rejection
  preventSelfApproval(userId, po.createdBy, 'reject purchase order');

  const now = Timestamp.now();

  await updateDoc(doc(db, COLLECTIONS.PURCHASE_ORDERS, poId), {
    status: 'REJECTED',
    rejectedBy: userId,
    rejectedByName: userName,
    rejectedAt: now,
    rejectionReason: reason,
    updatedAt: now,
    updatedBy: userId,
  });

  // Audit log: PO rejected
  const auditContext = createAuditContext(userId, '', userName);
  await logAuditEvent(
    db,
    auditContext,
    'PO_REJECTED',
    'PURCHASE_ORDER',
    poId,
    `Rejected Purchase Order ${po.number}: ${reason}`,
    {
      entityName: po.number,
      severity: 'WARNING',
      metadata: {
        vendorName: po.vendorName,
        rejectionReason: reason,
      },
    }
  );

  logger.info('PO rejected', { poId });
}

// ============================================================================
// ISSUE PO
// ============================================================================

export async function issuePO(
  poId: string,
  userId: string,
  userName: string,
  userPermissions: number
): Promise<void> {
  const { db } = getFirebase();

  // Authorization: Require APPROVE_PO permission to issue
  requirePermission(userPermissions, PermissionFlag.APPROVE_PO, userId, 'issue purchase order');

  // Get PO for validation and audit log
  const po = await getPOById(poId);
  if (!po) {
    throw new Error('Purchase Order not found');
  }

  // Validate state machine transition
  const transitionResult = purchaseOrderStateMachine.validateTransition(po.status, 'ISSUED');
  if (!transitionResult.allowed) {
    throw new Error(transitionResult.reason || `Cannot issue PO with status: ${po.status}`);
  }

  const now = Timestamp.now();

  await updateDoc(doc(db, COLLECTIONS.PURCHASE_ORDERS, poId), {
    status: 'ISSUED',
    issuedAt: now,
    issuedBy: userId,
    updatedAt: now,
    updatedBy: userId,
  });

  // Audit log: PO issued
  const auditContext = createAuditContext(userId, '', userName);
  await logAuditEvent(
    db,
    auditContext,
    'PO_ISSUED',
    'PURCHASE_ORDER',
    poId,
    `Issued Purchase Order ${po.number} to ${po.vendorName}`,
    {
      entityName: po.number,
      metadata: {
        vendorId: po.vendorId,
        vendorName: po.vendorName,
        grandTotal: po.grandTotal,
      },
    }
  );

  logger.info('PO issued', { poId });
}

// ============================================================================
// UPDATE STATUS
// ============================================================================

export async function updatePOStatus(
  poId: string,
  status: PurchaseOrderStatus,
  userId: string
): Promise<void> {
  const { db } = getFirebase();

  // Get current PO to validate transition
  const po = await getPOById(poId);
  if (!po) {
    throw new Error('Purchase Order not found');
  }

  // Validate state machine transition
  const transitionResult = purchaseOrderStateMachine.validateTransition(po.status, status);
  if (!transitionResult.allowed) {
    throw new Error(
      transitionResult.reason || `Cannot transition PO from ${po.status} to ${status}`
    );
  }

  await updateDoc(doc(db, COLLECTIONS.PURCHASE_ORDERS, poId), {
    status,
    updatedAt: Timestamp.now(),
    updatedBy: userId,
  });

  logger.info('PO status updated', { poId, previousStatus: po.status, newStatus: status });
}
