/**
 * Project Charter Approval Service
 *
 * Charter authorization workflow (charter.authorization.approvalStatus):
 * DRAFT → PENDING_APPROVAL → APPROVED, with rejection returning to DRAFT
 * with a reason. Mirrors the canonical proposal approval workflow
 * (@/lib/proposals/approvalWorkflow.ts): submit → notify approvers →
 * approve/reject with preventSelfApproval + requireValidTransition +
 * logAuditEvent + task notifications.
 *
 * The transition TO APPROVED is what downstream reacts to:
 * - functions/src/charterApproval.ts (onCharterApproved) auto-drafts PRs for
 *   HIGH/CRITICAL procurement items — it fires on
 *   `before != APPROVED && after == APPROVED`, so the intermediate
 *   PENDING_APPROVAL state does not double-fire it.
 * - The project cost centre is created here on approval (idempotent — only
 *   when the project has no costCentreId yet).
 */

import { doc, updateDoc, getDoc, Timestamp, type Firestore } from 'firebase/firestore';
import { COLLECTIONS } from '@vapour/firebase';
import { createLogger } from '@vapour/logger';
import type { Project } from '@vapour/types';
import { PERMISSION_FLAGS } from '@vapour/constants';
import { requirePermission, preventSelfApproval } from '@/lib/auth';
import { getUsersWithPermission } from '@/lib/auth/userLookup';
import { logAuditEvent, createAuditContext } from '@/lib/audit/clientAuditService';
import {
  createTaskNotification,
  findTaskNotificationByEntity,
  completeActionableTask,
} from '@/lib/tasks/taskNotificationService';
import { charterApprovalStateMachine } from '@/lib/workflow/stateMachines';
import { requireValidTransition } from '@/lib/utils/stateMachine';
import { validateCharterForApproval, getValidationSummary } from './charterValidationService';

const logger = createLogger({ context: 'charterApproval' });

async function getProjectOrThrow(
  db: Firestore,
  projectId: string
): Promise<{ projectRef: ReturnType<typeof doc>; project: Project }> {
  const projectRef = doc(db, COLLECTIONS.PROJECTS, projectId);
  const projectSnap = await getDoc(projectRef);
  if (!projectSnap.exists()) {
    throw new Error('Project not found');
  }
  const project: Project = { id: projectSnap.id, ...projectSnap.data() } as unknown as Project;
  return { projectRef, project };
}

/** Dismiss the approvers' pending charter-review task, if any. */
async function completePendingCharterTask(projectId: string, userId: string): Promise<void> {
  const pendingTask = await findTaskNotificationByEntity(
    'PROJECT',
    projectId,
    'CHARTER_SUBMITTED',
    'in_progress'
  );
  if (pendingTask) {
    await completeActionableTask(pendingTask.id, userId, true);
  }
}

/**
 * Submit project charter for approval.
 *
 * Changes charter.authorization.approvalStatus from DRAFT → PENDING_APPROVAL,
 * stamps submittedBy/At, and notifies every other MANAGE_PROJECTS user
 * (submit-then-anyone-else-approves — no named-approver pick for charters).
 */
export async function submitCharterForApproval(
  db: Firestore,
  projectId: string,
  userId: string,
  userName: string,
  userPermissions: number
): Promise<void> {
  // rule19-exempt: state-machine transition (DRAFT→PENDING_APPROVAL) with explicit guard; concurrent submitters converge to PENDING_APPROVAL
  try {
    requirePermission(
      userPermissions,
      PERMISSION_FLAGS.MANAGE_PROJECTS,
      userId,
      'submit project charter for approval'
    );

    const { projectRef, project } = await getProjectOrThrow(db, projectId);
    const authorization = project.charter?.authorization;

    if (!(authorization?.sponsorName ?? '').trim()) {
      throw new Error(
        'Charter authorization (sponsor details) must be completed before submitting for approval'
      );
    }

    // Validate completeness before it reaches an approver (rule 23). The
    // approve step re-validates as defense in depth.
    const validationResult = validateCharterForApproval(project.charter);
    if (!validationResult.isValid) {
      throw new Error(
        `Charter is not ready for approval:\n${getValidationSummary(validationResult)}`
      );
    }

    // Validate state machine transition (rule 8). `authorization` is
    // narrowed above (sponsor check throws when missing) but TS can't see
    // through the optional chain — guard explicitly.
    if (!authorization) {
      throw new Error('Charter authorization must be completed before submitting for approval');
    }
    requireValidTransition(
      charterApprovalStateMachine,
      authorization.approvalStatus || 'DRAFT',
      'PENDING_APPROVAL',
      'Project charter'
    );

    await updateDoc(projectRef, {
      'charter.authorization.approvalStatus': 'PENDING_APPROVAL',
      'charter.authorization.submittedBy': userId,
      'charter.authorization.submittedByName': userName,
      'charter.authorization.submittedAt': Timestamp.now(),
      'charter.authorization.rejectionReason': null,
      updatedAt: Timestamp.now(),
      updatedBy: userId,
    });

    // Notify every other user who can approve (MANAGE_PROJECTS). The
    // submitter is excluded — preventSelfApproval would reject their
    // approval anyway.
    const tenantId = project.tenantId || 'default-entity';
    const approverIds = (
      await getUsersWithPermission(db, tenantId, PERMISSION_FLAGS.MANAGE_PROJECTS)
    ).filter((approverId) => approverId !== userId);
    for (const approverId of approverIds) {
      await createTaskNotification({
        type: 'actionable',
        category: 'CHARTER_SUBMITTED',
        userId: approverId,
        assignedBy: userId,
        assignedByName: userName,
        title: `Review Charter: ${project.name}`,
        message: `${userName} submitted the charter for project "${project.name}" for approval`,
        entityType: 'PROJECT',
        entityId: projectId,
        linkUrl: `/projects/${projectId}/charter`,
        priority: 'HIGH',
        autoCompletable: true,
      });
    }

    logger.info('Charter submitted for approval', {
      projectId,
      userId,
      approverCount: approverIds.length,
    });

    await logAuditEvent(
      db,
      createAuditContext(userId, '', userName),
      'CHARTER_SUBMITTED',
      'PROJECT_CHARTER',
      projectId,
      `Charter for project ${project.code || project.name} submitted for approval`,
      { entityName: project.name }
    ).catch((err) => logger.error('Failed to log audit event', { error: err }));
  } catch (error) {
    logger.error('Error submitting charter for approval', { projectId, error });
    throw error;
  }
}

/**
 * Approve project charter.
 *
 * Changes charter.authorization.approvalStatus from PENDING_APPROVAL →
 * APPROVED. The transition triggers the onCharterApproved Cloud Function
 * (auto-drafts PRs for HIGH/CRITICAL procurement items) and creates the
 * project cost centre if one doesn't exist yet.
 */
export async function approveCharter(
  db: Firestore,
  projectId: string,
  userId: string,
  userName: string,
  userPermissions: number
): Promise<void> {
  // rule19-exempt: state-machine transition to APPROVED; the validation guard rejects duplicate calls and concurrent approvers converge to the same end state
  try {
    requirePermission(
      userPermissions,
      PERMISSION_FLAGS.MANAGE_PROJECTS,
      userId,
      'approve project charter'
    );

    const { projectRef, project } = await getProjectOrThrow(db, projectId);
    const authorization = project.charter?.authorization;
    if (!authorization) {
      throw new Error('Charter authorization has not been set up');
    }

    // Validate state machine transition (rule 8)
    requireValidTransition(
      charterApprovalStateMachine,
      authorization.approvalStatus || 'DRAFT',
      'APPROVED',
      'Project charter'
    );

    // Separation of duty (rule 6): the submitter cannot approve their own charter
    if (authorization.submittedBy) {
      preventSelfApproval(userId, authorization.submittedBy, 'approve project charter');
    }

    // Re-validate completeness at the approval gate (rule 23)
    const validationResult = validateCharterForApproval(project.charter);
    if (!validationResult.isValid) {
      throw new Error(
        `Cannot approve charter — validation failed:\n${getValidationSummary(validationResult)}`
      );
    }

    const now = Timestamp.now();
    await updateDoc(projectRef, {
      'charter.authorization.approvalStatus': 'APPROVED',
      'charter.authorization.approvedBy': userId,
      'charter.authorization.approvedAt': now,
      'charter.authorization.authorizedDate': now,
      'charter.authorization.rejectionReason': null,
      updatedAt: now,
      updatedBy: userId,
    });

    // Create the project cost centre (idempotent — skip if one already
    // exists, rule 9). Non-fatal: the approval is the primary record and has
    // already been written; a failed cost-centre creation is logged so it
    // can be created manually from the accounting module.
    let costCentreId: string | null = project.costCentreId || null;
    if (!costCentreId) {
      try {
        const { createProjectCostCentre } = await import('@/lib/accounting/costCentreService');
        costCentreId = await createProjectCostCentre(
          db,
          projectId,
          project.code,
          project.name,
          project.budget?.estimated?.amount || null,
          userId,
          userName,
          userPermissions
        );
        await updateDoc(projectRef, {
          costCentreId,
          updatedAt: Timestamp.now(),
          updatedBy: userId,
        });
      } catch (err) {
        logger.warn(
          'Charter approved but cost centre creation failed — create it manually from Accounting',
          { projectId, error: err }
        );
      }
    }

    // Auto-complete the review task and notify the submitter
    await completePendingCharterTask(projectId, userId);
    if (authorization.submittedBy) {
      await createTaskNotification({
        type: 'informational',
        category: 'CHARTER_APPROVED',
        userId: authorization.submittedBy,
        assignedBy: userId,
        assignedByName: userName,
        title: `Charter Approved: ${project.name}`,
        message: `${userName} approved the charter for project "${project.name}"`,
        entityType: 'PROJECT',
        entityId: projectId,
        linkUrl: `/projects/${projectId}/charter`,
        priority: 'HIGH',
      });
    }

    logger.info('Charter approved', { projectId, userId, costCentreId });

    await logAuditEvent(
      db,
      createAuditContext(userId, '', userName),
      'CHARTER_APPROVED',
      'PROJECT_CHARTER',
      projectId,
      `Charter for project ${project.code || project.name} approved`,
      {
        entityName: project.name,
        severity: 'WARNING',
        metadata: { submittedBy: authorization.submittedBy ?? null, costCentreId },
      }
    ).catch((err) => logger.error('Failed to log audit event', { error: err }));
  } catch (error) {
    logger.error('Error approving charter', { projectId, error });
    throw error;
  }
}

/**
 * Reject project charter — returns it to DRAFT with a reason.
 *
 * Changes charter.authorization.approvalStatus from PENDING_APPROVAL → DRAFT
 * and stores the rejection reason for the submitter to act on (house
 * pattern — mirrors rejectProposal, which also returns to DRAFT).
 */
export async function rejectCharter(
  db: Firestore,
  projectId: string,
  userId: string,
  userName: string,
  userPermissions: number,
  reason: string
): Promise<void> {
  // rule19-exempt: state-machine transition back to DRAFT; concurrent rejecters converge to the same end state
  try {
    if (!(reason ?? '').trim()) {
      throw new Error('A rejection reason is required');
    }

    requirePermission(
      userPermissions,
      PERMISSION_FLAGS.MANAGE_PROJECTS,
      userId,
      'reject project charter'
    );

    const { projectRef, project } = await getProjectOrThrow(db, projectId);
    const authorization = project.charter?.authorization;
    if (!authorization) {
      throw new Error('Charter authorization has not been set up');
    }

    // Validate state machine transition (rule 8): PENDING_APPROVAL → DRAFT
    requireValidTransition(
      charterApprovalStateMachine,
      authorization.approvalStatus || 'DRAFT',
      'DRAFT',
      'Project charter'
    );

    // Separation of duty (rule 6): mirror of approveCharter
    if (authorization.submittedBy) {
      preventSelfApproval(userId, authorization.submittedBy, 'reject project charter');
    }

    await updateDoc(projectRef, {
      'charter.authorization.approvalStatus': 'DRAFT',
      'charter.authorization.rejectionReason': reason.trim(),
      updatedAt: Timestamp.now(),
      updatedBy: userId,
    });

    // Auto-complete the review task and notify the submitter
    await completePendingCharterTask(projectId, userId);
    if (authorization.submittedBy) {
      await createTaskNotification({
        type: 'informational',
        category: 'CHARTER_REJECTED',
        userId: authorization.submittedBy,
        assignedBy: userId,
        assignedByName: userName,
        title: `Charter Returned: ${project.name}`,
        message: `${userName} returned the charter for project "${project.name}" for revision: ${reason.trim()}`,
        entityType: 'PROJECT',
        entityId: projectId,
        linkUrl: `/projects/${projectId}/charter`,
        priority: 'HIGH',
      });
    }

    logger.info('Charter rejected (returned to DRAFT)', { projectId, userId });

    await logAuditEvent(
      db,
      createAuditContext(userId, '', userName),
      'CHARTER_REJECTED',
      'PROJECT_CHARTER',
      projectId,
      `Charter for project ${project.code || project.name} returned for revision: ${reason.trim()}`,
      {
        entityName: project.name,
        severity: 'WARNING',
        metadata: { submittedBy: authorization.submittedBy ?? null, reason: reason.trim() },
      }
    ).catch((err) => logger.error('Failed to log audit event', { error: err }));
  } catch (error) {
    logger.error('Error rejecting charter', { projectId, error });
    throw error;
  }
}
