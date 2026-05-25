/**
 * Amendment CRUD Operations
 *
 * Create, submit, approve, and reject amendments
 */

import {
  collection,
  doc,
  getDoc,
  addDoc,
  serverTimestamp,
  type Firestore,
  writeBatch,
  runTransaction,
} from 'firebase/firestore';
import { COLLECTIONS } from '@vapour/firebase';
import { createLogger } from '@vapour/logger';
import type { PurchaseOrder, PurchaseOrderChange, PurchaseOrderAmendment } from '@vapour/types';
import { determineAmendmentType } from './helpers';
import { getAmendmentHistory } from './queries';
import { createVersionSnapshot } from './versioning';
import { PERMISSION_FLAGS } from '@vapour/constants';
import {
  requirePermission,
  preventSelfApproval,
  requireApprover,
} from '@/lib/auth/authorizationService';
import { requireValidTransition } from '@/lib/utils/stateMachine';
import { amendmentStateMachine } from '@/lib/workflow/stateMachines';

const logger = createLogger({ context: 'amendmentService' });

/**
 * PR-7: Whitelist of PO fields that amendments are allowed to modify.
 * Fields not in this list cannot be changed via amendments — this prevents
 * corruption of status, workflow, or structural fields.
 */
const ALLOWED_AMENDMENT_FIELDS = new Set([
  // Financial
  'subtotal',
  'cgst',
  'sgst',
  'igst',
  'totalTax',
  'grandTotal',
  'currency',
  // Terms
  'paymentTerms',
  'deliveryTerms',
  'warrantyTerms',
  'penaltyClause',
  'otherClauses',
  'commercialTerms',
  // Delivery
  'deliveryAddress',
  'expectedDeliveryDate',
  // Header
  'title',
  'description',
  // Advance payment
  'advancePaymentRequired',
  'advancePercentage',
  'advanceAmount',
]);

/**
 * Create a new purchase order amendment
 */
export async function createAmendment(
  db: Firestore,
  purchaseOrderId: string,
  changes: PurchaseOrderChange[],
  reason: string,
  userId: string,
  userName: string,
  tenantId?: string
): Promise<string> {
  // rule8-exempt: sets the initial status on a brand-new document (no prior state to transition from) — state-machine validation only applies to transitions, not first-write
  // rule5-exempt: procurement workflow operation; firestore.rules enforce MANAGE_PROCUREMENT on the affected collections; client-side check is defense-in-depth deferred
  try {
    // Get the current PO
    const poDoc = await getDoc(doc(db, COLLECTIONS.PURCHASE_ORDERS, purchaseOrderId));
    if (!poDoc.exists()) {
      throw new Error('Purchase order not found');
    }

    const po = { id: poDoc.id, ...poDoc.data() } as PurchaseOrder;

    // Validate PO status
    const amendableStatuses = ['APPROVED', 'ISSUED', 'ACKNOWLEDGED', 'IN_PROGRESS', 'AMENDED'];
    if (!amendableStatuses.includes(po.status)) {
      throw new Error('Only approved, issued, or in-progress purchase orders can be amended');
    }

    // Get the next amendment number
    const existingAmendments = await getAmendmentHistory(db, purchaseOrderId);
    const nextAmendmentNumber = existingAmendments.length + 1;

    // Calculate financial impact
    const financialChanges = changes.filter((c) => c.category === 'FINANCIAL');
    const previousGrandTotal = po.grandTotal;
    let newGrandTotal = po.grandTotal;

    // Calculate new grand total based on changes
    financialChanges.forEach((change) => {
      if (change.field.includes('grandTotal') || change.field.includes('subtotal')) {
        newGrandTotal = typeof change.newValue === 'number' ? change.newValue : newGrandTotal;
      }
    });

    const totalChange = newGrandTotal - previousGrandTotal;

    // Determine amendment type based on changes
    const amendmentType = determineAmendmentType(changes);

    // Create the amendment
    const amendmentData = {
      purchaseOrderId,
      purchaseOrderNumber: po.number,
      amendmentNumber: nextAmendmentNumber,
      amendmentDate: serverTimestamp(),
      amendmentType,
      reason,
      requestedBy: userId,
      requestedByName: userName,
      changes,
      previousGrandTotal,
      newGrandTotal,
      totalChange,
      status: 'DRAFT',
      applied: false,
      ...(tenantId && { tenantId }),
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
      createdBy: userId,
      updatedBy: userId,
    };

    const amendmentRef = await addDoc(
      collection(db, COLLECTIONS.PURCHASE_ORDER_AMENDMENTS),
      amendmentData
    );

    logger.info('Amendment created', {
      amendmentId: amendmentRef.id,
      purchaseOrderId,
      amendmentNumber: nextAmendmentNumber,
    });

    return amendmentRef.id;
  } catch (error) {
    logger.error('Failed to create amendment', { error, purchaseOrderId });
    throw error;
  }
}

/**
 * Update a DRAFT amendment.
 *
 * Only draft amendments can be edited — once submitted the change set is locked.
 * Recomputes the financial impact and amendment type from the new changes,
 * re-reading the PO so `previousGrandTotal` reflects the PO's current total.
 */
export async function updateAmendment(
  db: Firestore,
  amendmentId: string,
  changes: PurchaseOrderChange[],
  reason: string,
  userId: string,
  userPermissions?: number
): Promise<void> {
  // rule8-exempt: edits draft content only — the DRAFT guard is an editability
  // precondition, not a status transition (status is unchanged), so there is no
  // transition to validate against the state machine.
  // rule5-exempt: procurement workflow operation; firestore.rules enforce MANAGE_PROCUREMENT on update.
  if (userPermissions !== undefined) {
    requirePermission(
      userPermissions,
      PERMISSION_FLAGS.MANAGE_PROCUREMENT,
      userId,
      'edit amendment'
    );
  }

  try {
    const amendmentRef = doc(db, COLLECTIONS.PURCHASE_ORDER_AMENDMENTS, amendmentId);

    await runTransaction(db, async (transaction) => {
      const amendmentDoc = await transaction.get(amendmentRef);
      if (!amendmentDoc.exists()) {
        throw new Error('Amendment not found');
      }

      const amendment = { id: amendmentDoc.id, ...amendmentDoc.data() } as PurchaseOrderAmendment;

      // Only drafts are editable
      if (amendment.status !== 'DRAFT') {
        throw new Error('Only draft amendments can be edited');
      }

      // Re-read the PO inside the transaction so the financial baseline is current
      const poRef = doc(db, COLLECTIONS.PURCHASE_ORDERS, amendment.purchaseOrderId);
      const poDoc = await transaction.get(poRef);
      if (!poDoc.exists()) {
        throw new Error('Purchase order not found');
      }
      const po = { id: poDoc.id, ...poDoc.data() } as PurchaseOrder;

      const previousGrandTotal = po.grandTotal;
      let newGrandTotal = po.grandTotal;
      changes
        .filter((c) => c.category === 'FINANCIAL')
        .forEach((change) => {
          if (change.field.includes('grandTotal') || change.field.includes('subtotal')) {
            newGrandTotal = typeof change.newValue === 'number' ? change.newValue : newGrandTotal;
          }
        });

      transaction.update(amendmentRef, {
        reason,
        changes,
        amendmentType: determineAmendmentType(changes),
        previousGrandTotal,
        newGrandTotal,
        totalChange: newGrandTotal - previousGrandTotal,
        updatedAt: serverTimestamp(),
        updatedBy: userId,
      });
    });

    logger.info('Amendment updated', { amendmentId });
  } catch (error) {
    logger.error('Failed to update amendment', { error, amendmentId });
    throw error;
  }
}

/**
 * Submit amendment for approval.
 *
 * An `approverId` MUST be supplied — it is the designated approver who can
 * action the amendment. The requester is blocked from approving their own
 * amendment (separation of duties), so without a distinct approver the
 * amendment would be stuck in PENDING_APPROVAL forever (the original bug).
 */
export async function submitAmendmentForApproval(
  db: Firestore,
  amendmentId: string,
  userId: string,
  userName: string,
  approverId: string,
  approverName: string,
  comments?: string,
  ipAddress?: string,
  userAgent?: string
): Promise<void> {
  // rule5-exempt: procurement workflow operation; firestore.rules enforce MANAGE_PROCUREMENT — server-side gated
  // rule18-exempt: writes to AMENDMENT_APPROVAL_HISTORY (domain audit trail).
  if (!approverId) {
    throw new Error('An approver must be selected before submitting for approval');
  }

  try {
    const amendmentRef = doc(db, COLLECTIONS.PURCHASE_ORDER_AMENDMENTS, amendmentId);

    // Track whether this call actually performed the submission (vs. an
    // idempotent no-op) so we only fire the approver notification once.
    let submittedAmendment: PurchaseOrderAmendment | null = null;

    // PR-14: Use transaction for atomic read-then-write (idempotent submission)
    await runTransaction(db, async (transaction) => {
      const amendmentDoc = await transaction.get(amendmentRef);

      if (!amendmentDoc.exists()) {
        throw new Error('Amendment not found');
      }

      const amendment = {
        id: amendmentDoc.id,
        ...amendmentDoc.data(),
      } as PurchaseOrderAmendment;

      // Idempotency: already-submitted amendments are silently accepted
      if (amendment.status === 'PENDING_APPROVAL') {
        logger.info('Amendment already submitted, skipping', { amendmentId });
        submittedAmendment = null;
        return;
      }

      // Separation of duties: the requester cannot be the approver.
      if (approverId === amendment.requestedBy) {
        throw new Error('The amendment requester cannot be assigned as the approver');
      }

      // Validate the DRAFT -> PENDING_APPROVAL transition (rule 8)
      requireValidTransition(
        amendmentStateMachine,
        amendment.status,
        'PENDING_APPROVAL',
        'Amendment'
      );

      // Update amendment status + designated approver
      transaction.update(amendmentRef, {
        status: 'PENDING_APPROVAL',
        approverId,
        approverName,
        submittedForApprovalAt: serverTimestamp(),
        submittedBy: userId,
        updatedAt: serverTimestamp(),
        updatedBy: userId,
      });

      // Create approval history entry
      const historyData = {
        amendmentId,
        purchaseOrderId: amendment.purchaseOrderId,
        tenantId: amendment.tenantId,
        action: 'SUBMITTED',
        actionDate: serverTimestamp(),
        actionBy: userId,
        actionByName: userName,
        previousStatus: 'DRAFT',
        newStatus: 'PENDING_APPROVAL',
        ...(comments !== undefined && { comments }),
        ...(ipAddress !== undefined && { ipAddress }),
        ...(userAgent !== undefined && { userAgent }),
      };

      const historyRef = doc(collection(db, COLLECTIONS.AMENDMENT_APPROVAL_HISTORY));
      transaction.set(historyRef, historyData);

      submittedAmendment = amendment;
    });

    // Notify the designated approver (outside the transaction). Only on a real
    // submission, not an idempotent retry.
    if (submittedAmendment) {
      const amendment: PurchaseOrderAmendment = submittedAmendment;
      const { createTaskNotification } = await import('@/lib/tasks/taskNotificationService');
      await createTaskNotification({
        type: 'actionable',
        category: 'AMENDMENT_PENDING_APPROVAL',
        userId: approverId,
        assignedBy: userId,
        assignedByName: userName,
        title: `Review Amendment #${amendment.amendmentNumber} on ${amendment.purchaseOrderNumber}`,
        message: `${userName} submitted PO amendment #${amendment.amendmentNumber} for your approval.`,
        entityType: 'PURCHASE_ORDER_AMENDMENT',
        entityId: amendmentId,
        linkUrl: `/procurement/amendments/${amendmentId}`,
        priority: 'HIGH',
        autoCompletable: true,
      });
    }

    logger.info('Amendment submitted for approval', { amendmentId, approverId });
  } catch (error) {
    logger.error('Failed to submit amendment for approval', { error, amendmentId });
    throw error;
  }
}

/**
 * Approve amendment and apply changes to PO
 */
export async function approveAmendment(
  db: Firestore,
  amendmentId: string,
  userId: string,
  userName: string,
  comments?: string,
  ipAddress?: string,
  userAgent?: string,
  userPermissions?: number
): Promise<void> {
  // rule18-exempt: writes to AMENDMENT_APPROVAL_HISTORY (domain audit trail).
  // Authorization check (PR-4)
  if (userPermissions !== undefined) {
    requirePermission(
      userPermissions,
      PERMISSION_FLAGS.MANAGE_PROCUREMENT,
      userId,
      'approve amendment'
    );
  }

  try {
    const amendmentRef = doc(db, COLLECTIONS.PURCHASE_ORDER_AMENDMENTS, amendmentId);
    const amendmentDoc = await getDoc(amendmentRef);

    if (!amendmentDoc.exists()) {
      throw new Error('Amendment not found');
    }

    const amendment = { id: amendmentDoc.id, ...amendmentDoc.data() } as PurchaseOrderAmendment;

    // Validate the PENDING_APPROVAL -> APPROVED transition (rule 8)
    requireValidTransition(amendmentStateMachine, amendment.status, 'APPROVED', 'Amendment');

    // Idempotency guard (PR-8): prevent double-approval of already-applied amendments
    if (amendment.applied) {
      throw new Error('Amendment has already been applied');
    }

    // Prevent self-approval (PR-6): requester cannot approve their own amendment
    preventSelfApproval(userId, amendment.requestedBy, 'approve amendment');

    // Honour the designated approver assigned at submit time: only that user may
    // approve (mirrors the PO approval flow).
    if (amendment.approverId && amendment.approverId !== userId) {
      requireApprover(userId, [amendment.approverId], 'approve this amendment');
    }

    // Create version snapshot before applying changes
    await createVersionSnapshot(db, amendment.purchaseOrderId, amendmentId, userId);

    const batch = writeBatch(db);

    // Update amendment status
    batch.update(amendmentRef, {
      status: 'APPROVED',
      approvedBy: userId,
      approvedByName: userName,
      approvedAt: serverTimestamp(),
      applied: true,
      appliedAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
      updatedBy: userId,
      ...(comments && { approvalComments: comments }),
    });

    // Apply changes to PO
    const poRef = doc(db, COLLECTIONS.PURCHASE_ORDERS, amendment.purchaseOrderId);
    const updateData: Record<string, unknown> = {
      status: 'AMENDED',
      lastAmendmentNumber: amendment.amendmentNumber,
      lastAmendmentDate: serverTimestamp(),
      grandTotal: amendment.newGrandTotal,
      updatedAt: serverTimestamp(),
      updatedBy: userId,
    };

    // PR-7: Apply individual field changes with whitelist validation
    amendment.changes.forEach((change) => {
      if (change.field.startsWith('items[')) {
        // Item-level changes are handled separately
        return;
      }
      if (!ALLOWED_AMENDMENT_FIELDS.has(change.field)) {
        logger.warn('Amendment attempted to modify disallowed field', {
          amendmentId,
          field: change.field,
        });
        throw new Error(
          `Amendment cannot modify field "${change.field}". Only financial, terms, delivery, and header fields can be amended.`
        );
      }
      updateData[change.field] = change.newValue;
    });

    batch.update(poRef, updateData);

    // Create approval history entry (PR-17: include field-level change details)
    const historyData = {
      amendmentId,
      purchaseOrderId: amendment.purchaseOrderId,
      tenantId: amendment.tenantId,
      action: 'APPROVED',
      actionDate: serverTimestamp(),
      actionBy: userId,
      actionByName: userName,
      previousStatus: 'PENDING_APPROVAL',
      newStatus: 'APPROVED',
      ...(comments !== undefined && { comments }),
      ...(ipAddress !== undefined && { ipAddress }),
      ...(userAgent !== undefined && { userAgent }),
      fieldChanges: amendment.changes.map((change) => ({
        field: change.field,
        fieldLabel: change.fieldLabel,
        oldValue: change.oldValue ?? null,
        newValue: change.newValue ?? null,
        ...(change.oldValueDisplay !== undefined && { oldValueDisplay: change.oldValueDisplay }),
        ...(change.newValueDisplay !== undefined && { newValueDisplay: change.newValueDisplay }),
      })),
      changeCount: amendment.changes.length,
    };

    const historyRef = doc(collection(db, COLLECTIONS.AMENDMENT_APPROVAL_HISTORY));
    batch.set(historyRef, historyData);

    await batch.commit();

    logger.info('Amendment approved and applied', {
      amendmentId,
      purchaseOrderId: amendment.purchaseOrderId,
    });
  } catch (error) {
    logger.error('Failed to approve amendment', { error, amendmentId });
    throw error;
  }
}

/**
 * Reject amendment
 */
export async function rejectAmendment(
  db: Firestore,
  amendmentId: string,
  userId: string,
  userName: string,
  reason: string,
  ipAddress?: string,
  userAgent?: string,
  userPermissions?: number
): Promise<void> {
  // rule18-exempt: writes to AMENDMENT_APPROVAL_HISTORY (domain audit trail).
  // Authorization check (PR-4)
  if (userPermissions !== undefined) {
    requirePermission(
      userPermissions,
      PERMISSION_FLAGS.MANAGE_PROCUREMENT,
      userId,
      'reject amendment'
    );
  }

  try {
    const amendmentRef = doc(db, COLLECTIONS.PURCHASE_ORDER_AMENDMENTS, amendmentId);
    const amendmentDoc = await getDoc(amendmentRef);

    if (!amendmentDoc.exists()) {
      throw new Error('Amendment not found');
    }

    const amendment = { id: amendmentDoc.id, ...amendmentDoc.data() } as PurchaseOrderAmendment;

    // Validate the PENDING_APPROVAL -> REJECTED transition (rule 8)
    requireValidTransition(amendmentStateMachine, amendment.status, 'REJECTED', 'Amendment');

    // Prevent self-rejection — separation of duties (mirror of approveAmendment).
    if (amendment.requestedBy) {
      preventSelfApproval(userId, amendment.requestedBy, 'reject amendment');
    }

    const batch = writeBatch(db);

    // Update amendment status
    batch.update(amendmentRef, {
      status: 'REJECTED',
      rejectedBy: userId,
      rejectedByName: userName,
      rejectedAt: serverTimestamp(),
      rejectionReason: reason,
      updatedAt: serverTimestamp(),
      updatedBy: userId,
    });

    // Create approval history entry
    const historyData = {
      amendmentId,
      purchaseOrderId: amendment.purchaseOrderId,
      tenantId: amendment.tenantId,
      action: 'REJECTED',
      actionDate: serverTimestamp(),
      actionBy: userId,
      actionByName: userName,
      comments: reason,
      previousStatus: 'PENDING_APPROVAL',
      newStatus: 'REJECTED',
      ...(ipAddress !== undefined && { ipAddress }),
      ...(userAgent !== undefined && { userAgent }),
    };

    const historyRef = doc(collection(db, COLLECTIONS.AMENDMENT_APPROVAL_HISTORY));
    batch.set(historyRef, historyData);

    await batch.commit();

    logger.info('Amendment rejected', { amendmentId });
  } catch (error) {
    logger.error('Failed to reject amendment', { error, amendmentId });
    throw error;
  }
}
