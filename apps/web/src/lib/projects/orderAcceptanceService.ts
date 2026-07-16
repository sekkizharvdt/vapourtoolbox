/**
 * Order Acceptance Service
 *
 * Closes the gap between a proposal-derived charter and the customer's
 * actually-signed order/agreement. `convertProposalToProject`
 * (@/lib/proposals/projectConversion.ts) copies proposal data 1:1 into the
 * charter; the signed order can differ (schedule, payment terms, retention,
 * deliverables register, key personnel). This service records those deltas
 * on `charter.orderAcceptance` and, on approval, applies them onto the
 * charter's authoritative fields (`deliveryPeriod`, `paymentTerms`,
 * `keyPersonnel`, `deliverables`).
 *
 * Workflow (charter.orderAcceptance.status), mirrors charterApprovalService
 * closely but with a distinct REJECTED state (see orderAcceptanceStateMachine
 * in @/lib/workflow/stateMachines):
 *
 * DRAFT --submit--> PENDING_APPROVAL --approve--> APPROVED (terms applied)
 *                                     --reject-->  REJECTED --reopen--> DRAFT
 *
 * `saveOrderAcceptanceDraft` only allows edits while status is DRAFT (or the
 * record doesn't exist yet) — a record that's PENDING_APPROVAL, APPROVED, or
 * REJECTED must go through the explicit workflow actions
 * (submit/approve/reject/reopen) rather than being silently overwritten.
 */

import {
  doc,
  getDoc,
  updateDoc,
  runTransaction,
  Timestamp,
  type Firestore,
} from 'firebase/firestore';
import { COLLECTIONS } from '@vapour/firebase';
import { createLogger } from '@vapour/logger';
import type { Project, ProjectCharter, OrderAcceptanceRecord } from '@vapour/types';
import { PERMISSION_FLAGS } from '@vapour/constants';
import { requirePermission, preventSelfApproval } from '@/lib/auth';
import { logAuditEvent, createAuditContext } from '@/lib/audit/clientAuditService';
import { orderAcceptanceStateMachine } from '@/lib/workflow/stateMachines';
import { requireValidTransition } from '@/lib/utils/stateMachine';
import { retryOnStaleToken } from '@/lib/firebase/retryOnStaleToken';
import {
  computeProjectProgress,
  mergeDeliverablesBatch,
  type DeliverableInput,
} from './deliverableService';

const logger = createLogger({ context: 'orderAcceptanceService' });

async function getProjectOrThrow(
  db: Firestore,
  projectId: string
): Promise<{ projectRef: ReturnType<typeof doc>; project: Project }> {
  const projectRef = doc(db, COLLECTIONS.PROJECTS, projectId);
  const projectSnap = await getDoc(projectRef);
  if (!projectSnap.exists()) {
    throw new Error('Project not found');
  }
  const data = projectSnap.data() as Project;
  const project: Project = { ...data, id: projectSnap.id };
  return { projectRef, project };
}

/**
 * Create or update the DRAFT order acceptance record on
 * `charter.orderAcceptance`. Upserts — if no record exists yet this creates
 * one; if one exists it must be DRAFT (edits to a submitted/approved/rejected
 * record must go through the explicit workflow actions below).
 *
 * `data` is treated as the full desired form state for the fields it's
 * responsible for (documentReference/documentDate/contractValue/terms) —
 * the caller (RecordOrderAcceptanceDialog) always submits the complete form,
 * so this is a full-object replace of `charter.orderAcceptance`, not a
 * per-field patch (matches the existing `charter.authorization` save
 * pattern in CharterTab.tsx).
 */
export async function saveOrderAcceptanceDraft(
  db: Firestore,
  projectId: string,
  data: Pick<OrderAcceptanceRecord, 'terms'> &
    Partial<Pick<OrderAcceptanceRecord, 'documentReference' | 'documentDate' | 'contractValue'>>,
  userId: string,
  userName: string,
  userPermissions: number
): Promise<void> {
  // rule8-exempt: this never transitions status — it always (re)writes DRAFT,
  // either creating a fresh record (initial state) or re-saving an existing
  // one that's explicitly required to already be DRAFT (checked below).
  // requireValidTransition doesn't apply to a same-state write; the actual
  // DRAFT -> PENDING_APPROVAL / PENDING_APPROVAL -> APPROVED|REJECTED /
  // REJECTED -> DRAFT transitions are validated in the other four exported
  // functions in this file, all via requireValidTransition.
  try {
    requirePermission(
      userPermissions,
      PERMISSION_FLAGS.MANAGE_PROJECTS,
      userId,
      'save order acceptance draft'
    );

    const { projectRef, project } = await getProjectOrThrow(db, projectId);
    const existing = project.charter?.orderAcceptance;

    if (existing && existing.status !== 'DRAFT') {
      throw new Error(
        `Order acceptance cannot be edited while status is ${existing.status}. ` +
          (existing.status === 'REJECTED'
            ? 'Reopen it to DRAFT first (reopenOrderAcceptance).'
            : 'Reject it, or wait for the approval decision, before editing.')
      );
    }

    const now = Timestamp.now();
    const record: OrderAcceptanceRecord = {
      ...(data.documentReference !== undefined && { documentReference: data.documentReference }),
      ...(data.documentDate !== undefined && { documentDate: data.documentDate }),
      ...(data.contractValue !== undefined && { contractValue: data.contractValue }),
      terms: data.terms,
      status: 'DRAFT',
      applied: existing?.applied ?? false,
      ...(existing?.appliedAt !== undefined && { appliedAt: existing.appliedAt }),
      createdBy: existing?.createdBy ?? userId,
      createdAt: existing?.createdAt ?? now,
      updatedBy: userId,
      updatedAt: now,
    };

    await retryOnStaleToken(() =>
      updateDoc(projectRef, {
        'charter.orderAcceptance': record,
        updatedAt: now,
        updatedBy: userId,
      })
    );

    logger.info('Order acceptance draft saved', { projectId, userId });

    await logAuditEvent(
      db,
      createAuditContext(userId, '', userName),
      'PROJECT_UPDATED',
      'PROJECT',
      projectId,
      `Order acceptance draft saved for project ${project.code || project.name}`,
      { entityName: project.name }
    ).catch((err) => logger.error('Failed to log audit event', { error: err }));
  } catch (error) {
    logger.error('Error saving order acceptance draft', { projectId, error });
    throw error;
  }
}

/**
 * Submit the order acceptance record for approval (DRAFT -> PENDING_APPROVAL).
 */
export async function submitOrderAcceptanceForApproval(
  db: Firestore,
  projectId: string,
  userId: string,
  userName: string,
  userPermissions: number
): Promise<void> {
  try {
    requirePermission(
      userPermissions,
      PERMISSION_FLAGS.MANAGE_PROJECTS,
      userId,
      'submit order acceptance for approval'
    );

    const { projectRef, project } = await getProjectOrThrow(db, projectId);
    const record = project.charter?.orderAcceptance;
    if (!record) {
      throw new Error('No order acceptance draft has been recorded yet');
    }

    requireValidTransition(
      orderAcceptanceStateMachine,
      record.status,
      'PENDING_APPROVAL',
      'Order acceptance'
    );

    const now = Timestamp.now();
    await retryOnStaleToken(() =>
      updateDoc(projectRef, {
        'charter.orderAcceptance.status': 'PENDING_APPROVAL',
        'charter.orderAcceptance.submittedBy': userId,
        'charter.orderAcceptance.submittedByName': userName,
        'charter.orderAcceptance.submittedAt': now,
        'charter.orderAcceptance.rejectionReason': null,
        'charter.orderAcceptance.updatedBy': userId,
        'charter.orderAcceptance.updatedAt': now,
        updatedAt: now,
        updatedBy: userId,
      })
    );

    logger.info('Order acceptance submitted for approval', { projectId, userId });

    await logAuditEvent(
      db,
      createAuditContext(userId, '', userName),
      'PROJECT_UPDATED',
      'PROJECT',
      projectId,
      `Order acceptance for project ${project.code || project.name} submitted for approval`,
      { entityName: project.name }
    ).catch((err) => logger.error('Failed to log audit event', { error: err }));
  } catch (error) {
    logger.error('Error submitting order acceptance for approval', { projectId, error });
    throw error;
  }
}

/**
 * Approve the order acceptance record — THE APPLY STEP.
 *
 * PENDING_APPROVAL -> APPROVED, then in the SAME transaction (rule 19 —
 * `applied` must never be true without the charter fields it describes
 * actually being written, and vice versa):
 *  - `terms.scheduleDurationDays` / `scheduleStartDate` partially override
 *    `charter.deliveryPeriod` (only given fields change; `endDate` is
 *    recomputed when both start and duration are given).
 *  - `terms.paymentTermsDays` / `retentionPercentage` / `paymentMilestones`
 *    write `charter.paymentTerms`.
 *  - `terms.keyPersonnel` writes `charter.keyPersonnel`.
 *  - `terms.deliverables` are folded into `charter.deliverables` via
 *    `mergeDeliverablesBatch` (the same pure merge `saveDeliverablesBatch`
 *    uses) so this can't call that function's own `runTransaction` — a
 *    transaction can't nest another — but does exactly what it would do,
 *    inline, in this transaction.
 *  - `orderAcceptance.applied = true` / `appliedAt = now`.
 */
export async function approveOrderAcceptance(
  db: Firestore,
  projectId: string,
  approverId: string,
  approverName: string,
  userPermissions: number
): Promise<void> {
  try {
    requirePermission(
      userPermissions,
      PERMISSION_FLAGS.MANAGE_PROJECTS,
      approverId,
      'approve order acceptance terms'
    );

    let projectCode = '';
    let projectName = '';
    let submittedBy: string | undefined;

    await retryOnStaleToken(() =>
      runTransaction(db, async (tx) => {
        const projectRef = doc(db, COLLECTIONS.PROJECTS, projectId);
        const snap = await tx.get(projectRef);
        if (!snap.exists()) {
          throw new Error('Project not found');
        }
        const snapData = snap.data() as Project;
        const project: Project = { ...snapData, id: snap.id };
        projectCode = project.code;
        projectName = project.name;

        const charter = project.charter;
        const record = charter?.orderAcceptance;
        if (!charter || !record) {
          throw new Error('No order acceptance record has been submitted for approval');
        }
        submittedBy = record.submittedBy;

        requireValidTransition(
          orderAcceptanceStateMachine,
          record.status,
          'APPROVED',
          'Order acceptance'
        );

        // Separation of duty (rule 6): the submitter cannot approve their own terms
        if (record.submittedBy) {
          preventSelfApproval(approverId, record.submittedBy, 'approve order acceptance terms');
        }

        const now = Timestamp.now();
        const terms = record.terms ?? {};

        // 1. Schedule — partial override onto charter.deliveryPeriod. Only
        // given fields change; unspecified fields keep their existing value.
        const existingDeliveryPeriod = charter.deliveryPeriod ?? {};
        const newStartDate = terms.scheduleStartDate ?? existingDeliveryPeriod.startDate;
        const newDuration = terms.scheduleDurationDays ?? existingDeliveryPeriod.duration;
        let newEndDate = existingDeliveryPeriod.endDate;
        if (terms.scheduleStartDate && terms.scheduleDurationDays !== undefined) {
          const start = terms.scheduleStartDate.toDate();
          const end = new Date(start);
          end.setDate(end.getDate() + terms.scheduleDurationDays);
          newEndDate = Timestamp.fromDate(end);
        }
        const newDescription = terms.scheduleNotes ?? existingDeliveryPeriod.description;
        const deliveryPeriod: NonNullable<ProjectCharter['deliveryPeriod']> = {
          ...(newStartDate !== undefined && { startDate: newStartDate }),
          ...(newEndDate !== undefined && { endDate: newEndDate }),
          ...(newDuration !== undefined && { duration: newDuration }),
          ...(newDescription !== undefined && { description: newDescription }),
        };

        // 2. Payment terms — authoritative on charter.paymentTerms once applied.
        const existingPaymentTerms = charter.paymentTerms ?? {};
        const paymentTerms: NonNullable<ProjectCharter['paymentTerms']> = {
          ...((terms.paymentTermsDays ?? existingPaymentTerms.termsDays) !== undefined && {
            termsDays: terms.paymentTermsDays ?? existingPaymentTerms.termsDays,
          }),
          ...((terms.retentionPercentage ?? existingPaymentTerms.retentionPercentage) !==
            undefined && {
            retentionPercentage:
              terms.retentionPercentage ?? existingPaymentTerms.retentionPercentage,
          }),
          ...((terms.paymentMilestones ?? existingPaymentTerms.milestones) !== undefined && {
            milestones: terms.paymentMilestones ?? existingPaymentTerms.milestones,
          }),
        };

        // 3. Key personnel — authoritative on charter.keyPersonnel once applied.
        const keyPersonnel = terms.keyPersonnel ?? charter.keyPersonnel ?? [];

        // 4. Deliverables register — folded into charter.deliverables (inline
        // merge, see doc comment above for why this can't call
        // saveDeliverablesBatch directly).
        const existingDeliverables = charter.deliverables ?? [];
        const deliverableInputs: DeliverableInput[] = (terms.deliverables ?? []).map((d) => ({
          name: d.name,
          description: d.description ?? '',
          type: d.type,
          acceptanceCriteria: [],
          status: 'PENDING',
        }));
        const mergedDeliverables = mergeDeliverablesBatch(existingDeliverables, deliverableInputs);

        const updatedOrderAcceptance: OrderAcceptanceRecord = {
          ...record,
          status: 'APPROVED',
          approvedBy: approverId,
          approvedByName: approverName,
          approvedAt: now,
          applied: true,
          appliedAt: now,
          updatedBy: approverId,
          updatedAt: now,
        };

        tx.update(projectRef, {
          'charter.orderAcceptance': updatedOrderAcceptance,
          'charter.deliveryPeriod': deliveryPeriod,
          'charter.paymentTerms': paymentTerms,
          'charter.keyPersonnel': keyPersonnel,
          'charter.deliverables': mergedDeliverables,
          progress: computeProjectProgress(mergedDeliverables),
          updatedAt: now,
          updatedBy: approverId,
        });
      })
    );

    logger.info('Order acceptance approved and applied to charter', { projectId, approverId });

    await logAuditEvent(
      db,
      createAuditContext(approverId, '', approverName),
      'PROJECT_UPDATED',
      'PROJECT',
      projectId,
      `Order acceptance terms approved and applied to charter for project ${projectCode || projectName}`,
      {
        entityName: projectName,
        severity: 'WARNING',
        metadata: { submittedBy: submittedBy ?? null },
      }
    ).catch((err) => logger.error('Failed to log audit event', { error: err }));
  } catch (error) {
    logger.error('Error approving order acceptance', { projectId, error });
    throw error;
  }
}

/**
 * Reject the order acceptance record (PENDING_APPROVAL -> REJECTED) with a
 * reason. Unlike charter rejection (which bounces straight to DRAFT), this
 * lands on a distinct REJECTED state so the reason persists until someone
 * explicitly reopens it via `reopenOrderAcceptance`.
 */
export async function rejectOrderAcceptance(
  db: Firestore,
  projectId: string,
  rejecterId: string,
  rejecterName: string,
  userPermissions: number,
  reason: string
): Promise<void> {
  try {
    if (!(reason ?? '').trim()) {
      throw new Error('A rejection reason is required');
    }

    requirePermission(
      userPermissions,
      PERMISSION_FLAGS.MANAGE_PROJECTS,
      rejecterId,
      'reject order acceptance terms'
    );

    const { projectRef, project } = await getProjectOrThrow(db, projectId);
    const record = project.charter?.orderAcceptance;
    if (!record) {
      throw new Error('No order acceptance record has been submitted for approval');
    }

    requireValidTransition(
      orderAcceptanceStateMachine,
      record.status,
      'REJECTED',
      'Order acceptance'
    );

    // Separation of duty (rule 6): mirror of approveOrderAcceptance
    if (record.submittedBy) {
      preventSelfApproval(rejecterId, record.submittedBy, 'reject order acceptance terms');
    }

    const now = Timestamp.now();
    await retryOnStaleToken(() =>
      updateDoc(projectRef, {
        'charter.orderAcceptance.status': 'REJECTED',
        'charter.orderAcceptance.rejectionReason': reason.trim(),
        'charter.orderAcceptance.updatedBy': rejecterId,
        'charter.orderAcceptance.updatedAt': now,
        updatedAt: now,
        updatedBy: rejecterId,
      })
    );

    logger.info('Order acceptance rejected', { projectId, rejecterId });

    await logAuditEvent(
      db,
      createAuditContext(rejecterId, '', rejecterName),
      'PROJECT_UPDATED',
      'PROJECT',
      projectId,
      `Order acceptance for project ${project.code || project.name} rejected: ${reason.trim()}`,
      {
        entityName: project.name,
        severity: 'WARNING',
        metadata: { submittedBy: record.submittedBy ?? null, reason: reason.trim() },
      }
    ).catch((err) => logger.error('Failed to log audit event', { error: err }));
  } catch (error) {
    logger.error('Error rejecting order acceptance', { projectId, error });
    throw error;
  }
}

/**
 * Reopen a REJECTED order acceptance record back to DRAFT so it can be
 * revised and resubmitted. Without this, REJECTED would be a dead end —
 * `saveOrderAcceptanceDraft` only edits DRAFT records, and the state
 * machine's REJECTED -> DRAFT transition needs an explicit action to reach
 * (rule 8 — every status change goes through the state machine).
 */
export async function reopenOrderAcceptance(
  db: Firestore,
  projectId: string,
  userId: string,
  userName: string,
  userPermissions: number
): Promise<void> {
  try {
    requirePermission(
      userPermissions,
      PERMISSION_FLAGS.MANAGE_PROJECTS,
      userId,
      'reopen order acceptance for revision'
    );

    const { projectRef, project } = await getProjectOrThrow(db, projectId);
    const record = project.charter?.orderAcceptance;
    if (!record) {
      throw new Error('No order acceptance record exists to reopen');
    }

    requireValidTransition(orderAcceptanceStateMachine, record.status, 'DRAFT', 'Order acceptance');

    const now = Timestamp.now();
    await retryOnStaleToken(() =>
      updateDoc(projectRef, {
        'charter.orderAcceptance.status': 'DRAFT',
        'charter.orderAcceptance.rejectionReason': null,
        'charter.orderAcceptance.updatedBy': userId,
        'charter.orderAcceptance.updatedAt': now,
        updatedAt: now,
        updatedBy: userId,
      })
    );

    logger.info('Order acceptance reopened to DRAFT', { projectId, userId });

    await logAuditEvent(
      db,
      createAuditContext(userId, '', userName),
      'PROJECT_UPDATED',
      'PROJECT',
      projectId,
      `Order acceptance for project ${project.code || project.name} reopened for revision`,
      { entityName: project.name }
    ).catch((err) => logger.error('Failed to log audit event', { error: err }));
  } catch (error) {
    logger.error('Error reopening order acceptance', { projectId, error });
    throw error;
  }
}
