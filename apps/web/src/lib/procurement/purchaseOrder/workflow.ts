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

import { doc, updateDoc, deleteField, Timestamp, runTransaction } from 'firebase/firestore';
import { getFirebase } from '@/lib/firebase';
import { COLLECTIONS } from '@vapour/firebase';
import type { PurchaseOrderStatus } from '@vapour/types';
import { PERMISSION_FLAGS, hasPermission } from '@vapour/constants';
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
  userPermissions: number,
  approverId: string,
  secondApproverId: string,
  approverName?: string,
  secondApproverName?: string
): Promise<void> {
  // rule8-exempt: workflow function called by an upstream gate that already validates the transition; firestore.rules + caller-side state machine cover the safety check
  const { db } = getFirebase();

  // Authorization: the submitter must be a procurement user.
  requirePermission(
    userPermissions,
    PERMISSION_FLAGS.MANAGE_PROCUREMENT,
    userId,
    'submit purchase order for approval'
  );

  // The submitter chooses two distinct approvers (review 2.3).
  if (!approverId || !secondApproverId) {
    throw new Error('Select both the first and second approvers before submitting');
  }
  if (approverId === secondApproverId) {
    throw new Error('The two approvers must be different people');
  }

  // Get PO for notification details
  const po = await getPOById(poId);
  if (!po) {
    throw new Error('Purchase Order not found');
  }

  // Separation of duties: neither approver can be the PO creator.
  if (approverId === po.createdBy || secondApproverId === po.createdBy) {
    throw new Error('An approver cannot be the person who created the PO');
  }

  await updateDoc(doc(db, COLLECTIONS.PURCHASE_ORDERS, poId), {
    status: 'PENDING_APPROVAL',
    submittedForApprovalAt: Timestamp.now(),
    submittedBy: userId,
    approverId,
    secondApproverId,
    ...(approverName && { approverName }),
    ...(secondApproverName && { secondApproverName }),
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
        secondApproverId,
      },
    }
  );

  // Notify the first approver that it's their turn.
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
    ...(po.projectIds[0] && { projectId: po.projectIds[0] }),
  });

  logger.info('PO submitted for approval', { poId, approverId, secondApproverId });
}

// ============================================================================
// FIRST APPROVAL → sends to the second/final approver
// ============================================================================

export async function firstApprovePO(
  poId: string,
  userId: string,
  userName: string,
  comments?: string
): Promise<void> {
  // rule8-exempt: transition is validated against the state machine inside the transaction below.
  // rule5-exempt: gated by approver IDENTITY (requireApprover below) — any user the
  // submitter named as the first approver may approve; no permission flag applies.
  const { db } = getFirebase();

  const po = await runTransaction(db, async (transaction) => {
    const now = Timestamp.now();
    const poRef = doc(db, COLLECTIONS.PURCHASE_ORDERS, poId);

    const poDoc = await transaction.get(poRef);
    if (!poDoc.exists()) {
      throw new Error('Purchase Order not found');
    }

    const poData = { id: poDoc.id, ...poDoc.data() } as ReturnType<
      typeof getPOById
    > extends Promise<infer T>
      ? NonNullable<T>
      : never;

    const transitionResult = purchaseOrderStateMachine.validateTransition(
      poData.status,
      'PENDING_FINAL_APPROVAL'
    );
    if (!transitionResult.allowed) {
      throw new Error(transitionResult.reason || `Cannot approve PO with status: ${poData.status}`);
    }

    // Only the designated first approver may approve; never the creator.
    preventSelfApproval(userId, poData.createdBy, 'approve purchase order');
    requireApprover(
      userId,
      poData.approverId ? [poData.approverId] : [],
      'approve this purchase order'
    );

    transaction.update(poRef, {
      status: 'PENDING_FINAL_APPROVAL',
      firstApprovedBy: userId,
      firstApprovedByName: userName,
      firstApprovedAt: now,
      ...(comments && { approvalComments: comments }),
      updatedAt: now,
      updatedBy: userId,
    });

    return poData;
  });

  const auditContext = createAuditContext(userId, '', userName);
  await logAuditEvent(
    db,
    auditContext,
    'PO_UPDATED',
    'PURCHASE_ORDER',
    poId,
    `First approval given for Purchase Order ${po.number}; sent for final approval`,
    {
      entityName: po.number,
      metadata: { vendorName: po.vendorName, grandTotal: po.grandTotal },
    }
  );

  // Notify the second/final approver that it's their turn.
  if (po.secondApproverId) {
    const { createTaskNotification } = await import('@/lib/tasks/taskNotificationService');
    await createTaskNotification({
      type: 'actionable',
      category: 'PO_PENDING_APPROVAL',
      userId: po.secondApproverId,
      assignedBy: userId,
      assignedByName: userName,
      title: `Final approval: Purchase Order ${po.number}`,
      message: `${userName} gave first approval to a purchase order needing your final approval: ${po.vendorName} - ${formatCurrency(po.grandTotal, po.currency)}`,
      entityType: 'PURCHASE_ORDER',
      entityId: poId,
      linkUrl: `/procurement/pos/${poId}`,
      priority: 'HIGH',
      autoCompletable: true,
      ...(po.projectIds[0] && { projectId: po.projectIds[0] }),
    });
  }

  logger.info('PO first-approved, pending final approval', { poId });
}

// ============================================================================
// FINAL APPROVAL (second approver)
// ============================================================================

export async function approvePO(
  poId: string,
  userId: string,
  userName: string,
  comments?: string,
  bankAccountId?: string
): Promise<void> {
  // rule8-exempt: transition is validated against the state machine inside the transaction below.
  // rule5-exempt: gated by approver IDENTITY (requireApprover below) — only the
  // submitter-designated second approver may give final approval.
  const { db } = getFirebase();

  // Atomically approve PO to prevent race conditions
  const po = await runTransaction(db, async (transaction) => {
    const now = Timestamp.now();
    const poRef = doc(db, COLLECTIONS.PURCHASE_ORDERS, poId);

    const poDoc = await transaction.get(poRef);
    if (!poDoc.exists()) {
      throw new Error('Purchase Order not found');
    }

    const poData = { id: poDoc.id, ...poDoc.data() } as ReturnType<
      typeof getPOById
    > extends Promise<infer T>
      ? NonNullable<T>
      : never;

    // Validate state machine transition (only valid from PENDING_FINAL_APPROVAL)
    const transitionResult = purchaseOrderStateMachine.validateTransition(
      poData.status,
      'APPROVED'
    );
    if (!transitionResult.allowed) {
      throw new Error(transitionResult.reason || `Cannot approve PO with status: ${poData.status}`);
    }

    // Separation of duties: the final approver can't be the creator, nor the
    // person who gave first approval.
    preventSelfApproval(userId, poData.createdBy, 'approve purchase order');
    if (poData.firstApprovedBy && poData.firstApprovedBy === userId) {
      throw new Error('The final approver must be different from the first approver');
    }

    // Only the submitter-designated second approver may give final approval.
    requireApprover(
      userId,
      poData.secondApproverId ? [poData.secondApproverId] : [],
      'give final approval to this purchase order'
    );

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
  // rule8-exempt: transition is validated against the state machine below.
  // rule5-exempt: a PO can be rejected by a procurement manager OR by one of the
  // two designated approvers (identity check below) — not a single permission flag.
  const { db } = getFirebase();

  // Get PO for validation and audit log
  const po = await getPOById(poId);
  if (!po) {
    throw new Error('Purchase Order not found');
  }

  // Authorization: a procurement manager, or either designated approver, may reject.
  const isDesignatedApprover = userId === po.approverId || userId === po.secondApproverId;
  if (
    !hasPermission(userPermissions, PERMISSION_FLAGS.MANAGE_PROCUREMENT) &&
    !isDesignatedApprover
  ) {
    throw new Error('You do not have permission to reject this purchase order');
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

  // Notify the submitter — previously silent despite the PO_REJECTED
  // category existing (feedback sUjQ9E0O9tS9YZHqEtox).
  if (po.submittedBy) {
    const { createTaskNotification } = await import('@/lib/tasks/taskNotificationService');
    await createTaskNotification({
      type: 'informational',
      category: 'PO_REJECTED',
      userId: po.submittedBy,
      assignedBy: userId,
      assignedByName: userName,
      title: `Purchase Order Rejected: ${po.number}`,
      message: `${userName} rejected ${po.number}: ${reason}`,
      entityType: 'PURCHASE_ORDER',
      entityId: poId,
      linkUrl: `/procurement/pos/${poId}`,
      priority: 'HIGH',
      ...(po.projectIds[0] && { projectId: po.projectIds[0] }),
    }).catch((err) => {
      logger.error('Failed to create PO rejection notification', { error: err, poId });
    });
  }
}

// ============================================================================
// RETURN WITH COMMENTS (approver sends the PO back to DRAFT for revision)
// ============================================================================

/**
 * An approver returns a PO to DRAFT with remarks instead of rejecting it
 * outright, avoiding a full restart of the approval cycle for minor changes
 * (feedback sUjQ9E0O9tS9YZHqEtox). Full-restart decision: on resubmission
 * both approvers must approve again in sequence — this does not skip either.
 * Modeled on proposals' requestProposalChanges (rule 32).
 */
export async function returnPOForRevision(
  poId: string,
  userId: string,
  userName: string,
  comments: string
): Promise<void> {
  // rule8-exempt: transition is validated against the state machine below.
  // rule5-exempt: gated by approver IDENTITY (requireApprover below) — only
  // the approver designated for the PO's current stage may return it.
  if (!comments || !comments.trim()) {
    throw new Error('Comments are required when returning a purchase order for revision');
  }

  const { db } = getFirebase();

  const po = await getPOById(poId);
  if (!po) {
    throw new Error('Purchase Order not found');
  }

  const transitionResult = purchaseOrderStateMachine.validateTransition(po.status, 'DRAFT');
  if (!transitionResult.allowed) {
    throw new Error(transitionResult.reason || `Cannot return PO with status: ${po.status}`);
  }

  // Only the approver for the PO's CURRENT stage may return it.
  if (po.status === 'PENDING_APPROVAL') {
    requireApprover(userId, po.approverId ? [po.approverId] : [], 'return this purchase order');
  } else if (po.status === 'PENDING_FINAL_APPROVAL') {
    requireApprover(
      userId,
      po.secondApproverId ? [po.secondApproverId] : [],
      'return this purchase order'
    );
  }

  const now = Timestamp.now();

  // Full restart: clear the prior submission/first-approval record so
  // resubmission goes through both approvers again in sequence.
  await updateDoc(doc(db, COLLECTIONS.PURCHASE_ORDERS, poId), {
    status: 'DRAFT',
    returnedBy: userId,
    returnedByName: userName,
    returnedAt: now,
    returnComments: comments,
    submittedForApprovalAt: deleteField(),
    submittedBy: deleteField(),
    firstApprovedBy: deleteField(),
    firstApprovedByName: deleteField(),
    firstApprovedAt: deleteField(),
    updatedAt: now,
    updatedBy: userId,
  });

  // Complete the returning approver's own open approval task(s) — plural
  // finder since it fans out no further than one recipient here, but mirrors
  // the GR clearance pattern for consistency.
  const { findTaskNotificationsByEntity, completeActionableTask, createTaskNotification } =
    await import('@/lib/tasks/taskNotificationService');
  const openTasks = await findTaskNotificationsByEntity(
    'PURCHASE_ORDER',
    poId,
    'PO_PENDING_APPROVAL',
    ['pending', 'in_progress']
  );
  await Promise.all(openTasks.map((task) => completeActionableTask(task.id, userId, true)));

  // Informational notification to the submitter.
  if (po.submittedBy) {
    await createTaskNotification({
      type: 'informational',
      category: 'PO_CHANGES_REQUESTED',
      userId: po.submittedBy,
      assignedBy: userId,
      assignedByName: userName,
      title: `Changes Requested: ${po.number}`,
      message: `${userName} returned ${po.number} for revision: ${comments}`,
      entityType: 'PURCHASE_ORDER',
      entityId: poId,
      linkUrl: `/procurement/pos/${poId}`,
      priority: 'HIGH',
      ...(po.projectIds[0] && { projectId: po.projectIds[0] }),
    }).catch((err) => {
      logger.error('Failed to create PO changes-requested notification', { error: err, poId });
    });
  }

  const auditContext = createAuditContext(userId, '', userName);
  logAuditEvent(
    db,
    auditContext,
    'PO_CHANGES_REQUESTED',
    'PURCHASE_ORDER',
    poId,
    `Purchase Order ${po.number} returned for revision: ${comments}`,
    {
      entityName: po.number,
      metadata: { vendorName: po.vendorName, comments },
    }
  ).catch((err) => logger.error('Failed to log audit event', { error: err, poId }));

  logger.info('PO returned for revision', { poId, userId });
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
  // rule8-exempt: workflow function called by an upstream gate that already validates the transition; firestore.rules + caller-side state machine cover the safety check
  const { db } = getFirebase();

  // Authorization: Require APPROVE_PO permission to issue
  requirePermission(
    userPermissions,
    PERMISSION_FLAGS.MANAGE_PROCUREMENT,
    userId,
    'issue purchase order'
  );

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
// AUTO-ADVANCE STATUS (idempotent — no-op unless the transition is legal)
// ============================================================================

/**
 * Advance a PO's status if (and only if) the transition is currently legal.
 * Used by upstream triggers (Packing List creation, GR completion) where the
 * caller doesn't know — and shouldn't need to check — the PO's exact current
 * status; unlike updatePOStatus, an illegal/no-op transition is silently
 * skipped rather than thrown (feedback i7brfS9rrdfGVxRTHHZu). Mirrors the
 * `canTransitionTo` guard already used for GR-triggered auto-completion.
 *
 * @returns true if the status was advanced, false if the transition wasn't
 * currently legal (e.g. already advanced by a concurrent trigger).
 */
export async function advancePOStatusIfAllowed(
  poId: string,
  target: PurchaseOrderStatus,
  userId: string,
  userName?: string
): Promise<boolean> {
  // rule8-exempt: idempotent by design — checks canTransitionTo and silently
  // no-ops when the transition isn't currently legal, so there is no
  // invalid-transition error to throw.
  // rule5-exempt: system-triggered auto-advance called by upstream flows
  // (Packing List creation, GR completion) that already gate the write with
  // their own permission checks; this helper carries no separate user action.
  const { db } = getFirebase();

  const po = await getPOById(poId);
  if (!po) {
    throw new Error('Purchase Order not found');
  }

  if (!purchaseOrderStateMachine.canTransitionTo(po.status, target)) {
    return false;
  }

  const now = Timestamp.now();
  await updateDoc(doc(db, COLLECTIONS.PURCHASE_ORDERS, poId), {
    status: target,
    updatedAt: now,
    updatedBy: userId,
  });

  const auditContext = createAuditContext(userId, '', userName || '');
  logAuditEvent(
    db,
    auditContext,
    'PO_UPDATED',
    'PURCHASE_ORDER',
    poId,
    `Purchase Order ${po.number} automatically advanced from ${po.status} to ${target}`,
    {
      entityName: po.number,
      metadata: { previousStatus: po.status, newStatus: target, automatic: true },
    }
  ).catch((err) => logger.error('Failed to log audit event', { error: err, poId }));

  logger.info('PO status auto-advanced', { poId, from: po.status, to: target });
  return true;
}

// ============================================================================
// UPDATE STATUS
// ============================================================================

export async function updatePOStatus(
  poId: string,
  status: PurchaseOrderStatus,
  userId: string
): Promise<void> {
  // rule5-exempt: procurement workflow operation; firestore.rules enforce MANAGE_PROCUREMENT on the affected collections; client-side check is defense-in-depth deferred
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
