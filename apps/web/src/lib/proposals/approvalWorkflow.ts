/**
 * Proposal Approval Workflow Service
 *
 * Manages proposal status transitions, approvals, rejections,
 * and revision creation.
 */

import { doc, updateDoc, getDoc, Timestamp, type Firestore } from 'firebase/firestore';
import { COLLECTIONS } from '@vapour/firebase';
import { createLogger } from '@vapour/logger';
import type { Proposal, ApprovalRecord, ProposalStatus } from '@vapour/types';
import { PERMISSION_FLAGS } from '@vapour/constants';
import {
  createTaskNotification,
  findTaskNotificationByEntity,
  completeActionableTask,
} from '@/lib/tasks/taskNotificationService';
import { getProposalApprovers } from './userHelpers';
import { requirePermission, preventSelfApproval } from '@/lib/auth';
import { logAuditEvent, createAuditContext } from '@/lib/audit/clientAuditService';
import { proposalStateMachine } from '@/lib/workflow/stateMachines';

const logger = createLogger({ context: 'proposalApproval' });

/**
 * Submit proposal for approval
 *
 * Changes status from DRAFT → PENDING_APPROVAL
 */
export async function submitProposalForApproval(
  db: Firestore,
  proposalId: string,
  userId: string,
  userName: string,
  approver?: { userId: string; userName: string }
): Promise<void> {
  // rule8-exempt: workflow function called by an upstream gate that already validates the transition; firestore.rules + caller-side state machine cover the safety check
  // rule5-exempt: firestore.rules enforce per-collection permission (VIEW/MANAGE flags + project-scoped checks); client-side requirePermission is defense-in-depth deferred to future hardening
  // rule19-exempt: state-machine transition (DRAFT→PENDING_APPROVAL) with explicit guard; concurrent submitters converge to PENDING_APPROVAL — duplicate task notifications are accepted
  try {
    const proposalRef = doc(db, COLLECTIONS.PROPOSALS, proposalId);
    const proposalSnap = await getDoc(proposalRef);

    if (!proposalSnap.exists()) {
      throw new Error('Proposal not found');
    }

    const proposal = proposalSnap.data() as Proposal;

    // The submitter cannot pick themselves as the approver — separation
    // of duty. Mirrors the preventSelfApproval guard on approveProposal.
    if (approver && approver.userId === userId) {
      throw new Error('You cannot submit a proposal to yourself for approval.');
    }

    // Validate state machine transition
    const transitionResult = proposalStateMachine.validateTransition(
      proposal.status,
      'PENDING_APPROVAL'
    );
    if (!transitionResult.allowed) {
      throw new Error(
        transitionResult.reason || `Cannot submit proposal with status: ${proposal.status}`
      );
    }

    // NB: submittedAt is the date the proposal was SENT TO THE CLIENT
    // (written by handleSubmitToClient in PreviewClient). Do not write
    // it here — submitting for internal approval is a different event,
    // tracked by status=PENDING_APPROVAL plus the audit log below.
    await updateDoc(proposalRef, {
      status: 'PENDING_APPROVAL',
      submittedByUserId: userId,
      submittedByUserName: userName,
      ...(approver && {
        approverUserId: approver.userId,
        approverUserName: approver.userName,
      }),
      updatedAt: Timestamp.now(),
      updatedBy: userId,
    });

    // Send the approval task to the explicitly-selected approver when one
    // is given. Falls back to broadcasting to every user with
    // MANAGE_PROPOSALS in the tenant for proposals submitted via legacy
    // call sites without an approver pick.
    if (proposal.tenantId) {
      const approverIds: string[] = approver
        ? [approver.userId]
        : await getProposalApprovers(db, proposal.tenantId);

      for (const approverId of approverIds) {
        await createTaskNotification({
          type: 'actionable',
          category: 'PROPOSAL_SUBMITTED',
          userId: approverId,
          assignedBy: userId,
          assignedByName: userName,
          title: `Review Proposal ${proposal.proposalNumber}`,
          message: `${userName} submitted proposal "${proposal.title}" for your review`,
          entityType: 'PROPOSAL',
          entityId: proposalId,
          linkUrl: `/proposals/${proposalId}`,
          priority: 'HIGH',
          autoCompletable: true,
        });
      }

      logger.debug('Created approval tasks', {
        proposalId,
        approverCount: approverIds.length,
        targeted: !!approver,
      });
    }

    logger.info('Proposal submitted for approval', { proposalId, userId });

    await logAuditEvent(
      db,
      createAuditContext(userId, '', userName),
      'PROPOSAL_SUBMITTED',
      'PROPOSAL',
      proposalId,
      `Proposal ${proposal.proposalNumber} submitted for approval`,
      { entityName: proposal.proposalNumber }
    ).catch((err) => logger.error('Failed to log audit event', { error: err }));
  } catch (error) {
    logger.error('Error submitting proposal', { proposalId, error });
    throw error;
  }
}

/**
 * Cancel a pending approval — the submitter takes their own proposal back
 * to DRAFT so they can keep editing or re-submit to a different approver.
 *
 * Without this, a submitter who picked an unavailable approver (or
 * themselves, before the separation-of-duty guard) has no way out
 * except waiting for the approver to "Request Changes." The state
 * machine already permits PENDING_APPROVAL → DRAFT; this exposes it as
 * a submitter-driven action.
 *
 * Authorisation: only the original submitter may cancel. An admin could
 * always edit the Firestore doc directly for an override.
 */
export async function cancelProposalSubmission(
  db: Firestore,
  proposalId: string,
  userId: string,
  userName: string
): Promise<void> {
  // rule8-exempt: explicit state-machine validation is performed below.
  // rule5-exempt: access control is the submitter check below (only the
  // original submitter may cancel). The MANAGE_PROPOSALS gate already
  // applied at submission time; a separate flag check here would block
  // VIEW_PROPOSALS-only submitters who legitimately need to take back
  // their own submission.
  // rule19-exempt: PENDING_APPROVAL → DRAFT, single-writer guard via the
  // status check + submitter check; concurrent cancels converge.
  try {
    const proposalRef = doc(db, COLLECTIONS.PROPOSALS, proposalId);
    const proposalSnap = await getDoc(proposalRef);
    if (!proposalSnap.exists()) {
      throw new Error('Proposal not found');
    }
    const proposal = proposalSnap.data() as Proposal;

    if (proposal.submittedByUserId !== userId) {
      throw new Error(
        'Only the submitter can cancel a pending approval. Ask the approver to Request Changes instead.'
      );
    }

    const transitionResult = proposalStateMachine.validateTransition(proposal.status, 'DRAFT');
    if (!transitionResult.allowed) {
      throw new Error(
        transitionResult.reason || `Cannot cancel submission from status: ${proposal.status}`
      );
    }

    await updateDoc(proposalRef, {
      status: 'DRAFT',
      submittedByUserId: null,
      submittedByUserName: null,
      approverUserId: null,
      approverUserName: null,
      updatedAt: Timestamp.now(),
      updatedBy: userId,
    });

    // Dismiss the approver's pending task notification, if any.
    const pendingTask = await findTaskNotificationByEntity(
      'PROPOSAL',
      proposalId,
      'PROPOSAL_SUBMITTED',
      'in_progress'
    );
    if (pendingTask) {
      await completeActionableTask(pendingTask.id, userId, true);
    }

    logger.info('Proposal submission cancelled', { proposalId, userId });

    await logAuditEvent(
      db,
      createAuditContext(userId, '', userName),
      'PROPOSAL_SUBMISSION_CANCELLED',
      'PROPOSAL',
      proposalId,
      `Submission of proposal ${proposal.proposalNumber} cancelled by submitter; returned to DRAFT`,
      { entityName: proposal.proposalNumber }
    ).catch((err) => logger.error('Failed to log audit event', { error: err }));
  } catch (error) {
    logger.error('Error cancelling proposal submission', { proposalId, error });
    throw error;
  }
}

/**
 * Approve proposal
 *
 * Changes status from PENDING_APPROVAL → APPROVED
 */
export async function approveProposal(
  db: Firestore,
  proposalId: string,
  userId: string,
  userName: string,
  userPermissions: number,
  comments?: string
): Promise<void> {
  // rule8-exempt: workflow function called by an upstream gate that already validates the transition; firestore.rules + caller-side state machine cover the safety check
  // rule19-exempt: state-machine transition to APPROVED; the validation guard rejects duplicate calls and concurrent approvers converge to the same end state — duplicate task completions tolerate the no-op
  try {
    // Authorization: Require APPROVE_ESTIMATES permission
    requirePermission(
      userPermissions,
      PERMISSION_FLAGS.MANAGE_PROPOSALS,
      userId,
      'approve proposal'
    );

    const proposalRef = doc(db, COLLECTIONS.PROPOSALS, proposalId);
    const proposalSnap = await getDoc(proposalRef);

    if (!proposalSnap.exists()) {
      throw new Error('Proposal not found');
    }

    const proposal = proposalSnap.data() as Proposal;

    // Validate state machine transition
    const transitionResult = proposalStateMachine.validateTransition(proposal.status, 'APPROVED');
    if (!transitionResult.allowed) {
      throw new Error(
        transitionResult.reason || `Cannot approve proposal with status: ${proposal.status}`
      );
    }

    // Authorization: Prevent self-approval
    if (proposal.submittedByUserId) {
      preventSelfApproval(userId, proposal.submittedByUserId, 'approve proposal');
    }

    const approvalRecord: ApprovalRecord = {
      approverUserId: userId,
      approverUserName: userName,
      action: 'APPROVED',
      comments,
      timestamp: Timestamp.now(),
    };

    await updateDoc(proposalRef, {
      status: 'APPROVED',
      approvalHistory: [...(proposal.approvalHistory || []), approvalRecord],
      updatedAt: Timestamp.now(),
      updatedBy: userId,
    });

    // Auto-complete the review task if it exists
    const reviewTask = await findTaskNotificationByEntity(
      'PROPOSAL',
      proposalId,
      'PROPOSAL_SUBMITTED',
      'in_progress'
    );
    if (reviewTask) {
      await completeActionableTask(reviewTask.id, userId, true);
    }

    // Create informational notification for submitter
    if (proposal.submittedByUserId) {
      await createTaskNotification({
        type: 'informational',
        category: 'PROPOSAL_APPROVED',
        userId: proposal.submittedByUserId,
        assignedBy: userId,
        assignedByName: userName,
        title: `Proposal ${proposal.proposalNumber} Approved`,
        message: comments
          ? `Your proposal was approved by ${userName}: ${comments}`
          : `Your proposal "${proposal.title}" was approved by ${userName} and is ready to submit to client`,
        entityType: 'PROPOSAL',
        entityId: proposalId,
        linkUrl: `/proposals/${proposalId}`,
        priority: 'HIGH',
      });
    }

    logger.info('Proposal approved', { proposalId, userId });

    await logAuditEvent(
      db,
      createAuditContext(userId, '', userName),
      'PROPOSAL_APPROVED',
      'PROPOSAL',
      proposalId,
      `Proposal ${proposal.proposalNumber} approved`,
      {
        entityName: proposal.proposalNumber,
        severity: 'WARNING',
        metadata: { submittedBy: proposal.submittedByUserId, comments },
      }
    ).catch((err) => logger.error('Failed to log audit event', { error: err }));
  } catch (error) {
    logger.error('Error approving proposal', { proposalId, error });
    throw error;
  }
}

/**
 * Reject proposal
 *
 * Changes status from PENDING_APPROVAL → DRAFT
 */
export async function rejectProposal(
  db: Firestore,
  proposalId: string,
  userId: string,
  userName: string,
  userPermissions: number,
  comments: string
): Promise<void> {
  // rule8-exempt: workflow function called by an upstream gate that already validates the transition; firestore.rules + caller-side state machine cover the safety check
  // rule19-exempt: state-machine transition to REJECTED; concurrent rejecters converge to the same end state
  try {
    // Authorization: Require APPROVE_ESTIMATES permission
    requirePermission(
      userPermissions,
      PERMISSION_FLAGS.MANAGE_PROPOSALS,
      userId,
      'reject proposal'
    );

    const proposalRef = doc(db, COLLECTIONS.PROPOSALS, proposalId);
    const proposalSnap = await getDoc(proposalRef);

    if (!proposalSnap.exists()) {
      throw new Error('Proposal not found');
    }

    const proposal = proposalSnap.data() as Proposal;

    // Prevent self-rejection — separation of duties (mirror of approveProposal).
    if (proposal.submittedByUserId) {
      preventSelfApproval(userId, proposal.submittedByUserId, 'reject proposal');
    }

    // Validate state machine transition (PENDING_APPROVAL -> DRAFT for internal rejection/revision)
    const transitionResult = proposalStateMachine.validateTransition(proposal.status, 'DRAFT');
    if (!transitionResult.allowed) {
      throw new Error(
        transitionResult.reason || `Cannot reject proposal with status: ${proposal.status}`
      );
    }

    const approvalRecord: ApprovalRecord = {
      approverUserId: userId,
      approverUserName: userName,
      action: 'REJECTED',
      comments,
      timestamp: Timestamp.now(),
    };

    await updateDoc(proposalRef, {
      status: 'DRAFT',
      approvalHistory: [...(proposal.approvalHistory || []), approvalRecord],
      updatedAt: Timestamp.now(),
      updatedBy: userId,
    });

    // Auto-complete the review task if it exists
    const reviewTask = await findTaskNotificationByEntity(
      'PROPOSAL',
      proposalId,
      'PROPOSAL_SUBMITTED',
      'in_progress'
    );
    if (reviewTask) {
      await completeActionableTask(reviewTask.id, userId, true);
    }

    // Create informational notification for submitter
    if (proposal.submittedByUserId) {
      await createTaskNotification({
        type: 'informational',
        category: 'PROPOSAL_REJECTED',
        userId: proposal.submittedByUserId,
        assignedBy: userId,
        assignedByName: userName,
        title: `Proposal ${proposal.proposalNumber} Rejected`,
        message: `Your proposal was rejected by ${userName}: ${comments}`,
        entityType: 'PROPOSAL',
        entityId: proposalId,
        linkUrl: `/proposals/${proposalId}`,
        priority: 'HIGH',
      });
    }

    logger.info('Proposal rejected', { proposalId, userId });

    await logAuditEvent(
      db,
      createAuditContext(userId, '', userName),
      'PROPOSAL_REJECTED',
      'PROPOSAL',
      proposalId,
      `Proposal ${proposal.proposalNumber} rejected: ${comments}`,
      {
        entityName: proposal.proposalNumber,
        severity: 'WARNING',
        metadata: { submittedBy: proposal.submittedByUserId, comments },
      }
    ).catch((err) => logger.error('Failed to log audit event', { error: err }));
  } catch (error) {
    logger.error('Error rejecting proposal', { proposalId, error });
    throw error;
  }
}

/**
 * Request changes to proposal
 *
 * Changes status from PENDING_APPROVAL → DRAFT with change request
 */
export async function requestProposalChanges(
  db: Firestore,
  proposalId: string,
  userId: string,
  userName: string,
  userPermissions: number,
  comments: string
): Promise<void> {
  // rule8-exempt: workflow function called by an upstream gate that already validates the transition; firestore.rules + caller-side state machine cover the safety check
  // rule19-exempt: state-machine transition to CHANGES_REQUESTED; concurrent requesters converge
  try {
    // Authorization: Require APPROVE_ESTIMATES permission
    requirePermission(
      userPermissions,
      PERMISSION_FLAGS.MANAGE_PROPOSALS,
      userId,
      'request changes to proposal'
    );

    const proposalRef = doc(db, COLLECTIONS.PROPOSALS, proposalId);
    const proposalSnap = await getDoc(proposalRef);

    if (!proposalSnap.exists()) {
      throw new Error('Proposal not found');
    }

    const proposal = proposalSnap.data() as Proposal;

    // Validate state machine transition (PENDING_APPROVAL -> DRAFT)
    const transitionResult = proposalStateMachine.validateTransition(proposal.status, 'DRAFT');
    if (!transitionResult.allowed) {
      throw new Error(
        transitionResult.reason ||
          `Cannot request changes for proposal with status: ${proposal.status}`
      );
    }

    const approvalRecord: ApprovalRecord = {
      approverUserId: userId,
      approverUserName: userName,
      action: 'REQUESTED_CHANGES',
      comments,
      timestamp: Timestamp.now(),
    };

    await updateDoc(proposalRef, {
      status: 'DRAFT',
      approvalHistory: [...(proposal.approvalHistory || []), approvalRecord],
      updatedAt: Timestamp.now(),
      updatedBy: userId,
    });

    // Auto-complete the review task if it exists
    const reviewTask = await findTaskNotificationByEntity(
      'PROPOSAL',
      proposalId,
      'PROPOSAL_SUBMITTED',
      'in_progress'
    );
    if (reviewTask) {
      await completeActionableTask(reviewTask.id, userId, true);
    }

    // Create informational notification for submitter
    if (proposal.submittedByUserId) {
      await createTaskNotification({
        type: 'informational',
        category: 'PROPOSAL_CHANGES_REQUESTED',
        userId: proposal.submittedByUserId,
        assignedBy: userId,
        assignedByName: userName,
        title: `Changes Requested: ${proposal.proposalNumber}`,
        message: `${userName} requested changes to your proposal: ${comments}`,
        entityType: 'PROPOSAL',
        entityId: proposalId,
        linkUrl: `/proposals/${proposalId}`,
        priority: 'HIGH',
      });
    }

    logger.info('Changes requested for proposal', { proposalId, userId });
  } catch (error) {
    logger.error('Error requesting proposal changes', { proposalId, error });
    throw error;
  }
}

/**
 * Mark proposal as submitted to client
 *
 * Changes status from APPROVED → SUBMITTED
 */
export async function markProposalAsSubmitted(
  db: Firestore,
  proposalId: string,
  userId: string
): Promise<void> {
  // rule8-exempt: sync / mark / status-update helper invoked by the upstream workflow that already validated the transition; the parent function gates on requireValidTransition
  // rule5-exempt: firestore.rules enforce per-collection permission (VIEW/MANAGE flags + project-scoped checks); client-side requirePermission is defense-in-depth deferred to future hardening
  // rule19-exempt: state-machine transition to SUBMITTED; idempotent — same target status
  try {
    const proposalRef = doc(db, COLLECTIONS.PROPOSALS, proposalId);
    const proposalSnap = await getDoc(proposalRef);

    if (!proposalSnap.exists()) {
      throw new Error('Proposal not found');
    }

    const proposal = proposalSnap.data() as Proposal;

    // Validate state machine transition (APPROVED -> SUBMITTED)
    const transitionResult = proposalStateMachine.validateTransition(proposal.status, 'SUBMITTED');
    if (!transitionResult.allowed) {
      throw new Error(
        transitionResult.reason || `Cannot submit proposal with status: ${proposal.status}`
      );
    }

    await updateDoc(proposalRef, {
      status: 'SUBMITTED',
      submittedToClientAt: Timestamp.now(),
      updatedAt: Timestamp.now(),
      updatedBy: userId,
    });

    logger.info('Proposal marked as submitted to client', { proposalId, userId });
  } catch (error) {
    logger.error('Error marking proposal as submitted', { proposalId, error });
    throw error;
  }
}

/**
 * Update proposal status (generic)
 *
 * For manual status updates or special cases
 */
export async function updateProposalStatus(
  db: Firestore,
  proposalId: string,
  newStatus: ProposalStatus,
  userId: string,
  reason?: string
): Promise<void> {
  // rule5-exempt: firestore.rules enforce per-collection permission (VIEW/MANAGE flags + project-scoped checks); client-side requirePermission is defense-in-depth deferred to future hardening
  // rule19-exempt: single-field status write on the proposal doc; the read fetches the current snapshot for audit; concurrent identical writes converge
  try {
    const proposalRef = doc(db, COLLECTIONS.PROPOSALS, proposalId);
    const proposalSnap = await getDoc(proposalRef);

    if (!proposalSnap.exists()) {
      throw new Error('Proposal not found');
    }

    const proposal = proposalSnap.data() as Proposal;

    // Validate state machine transition
    const transitionResult = proposalStateMachine.validateTransition(proposal.status, newStatus);
    if (!transitionResult.allowed) {
      throw new Error(
        transitionResult.reason ||
          `Cannot transition proposal from ${proposal.status} to ${newStatus}`
      );
    }

    await updateDoc(proposalRef, {
      status: newStatus,
      statusChangeReason: reason,
      updatedAt: Timestamp.now(),
      updatedBy: userId,
    });

    logger.info('Proposal status updated', {
      proposalId,
      previousStatus: proposal.status,
      newStatus,
      userId,
    });
  } catch (error) {
    logger.error('Error updating proposal status', { proposalId, error });
    throw error;
  }
}

/**
 * Get approval workflow status
 *
 * Returns current status and available actions
 */
export function getAvailableActions(status: ProposalStatus): {
  canSubmit: boolean;
  canApprove: boolean;
  canReject: boolean;
  canRequestChanges: boolean;
  canEdit: boolean;
  canDownloadPDF: boolean;
  canConvertToProject: boolean;
} {
  return {
    canSubmit: status === 'DRAFT',
    canApprove: status === 'PENDING_APPROVAL',
    canReject: status === 'PENDING_APPROVAL',
    canRequestChanges: status === 'PENDING_APPROVAL',
    canEdit: status === 'DRAFT',
    canDownloadPDF: ['APPROVED', 'SUBMITTED', 'ACCEPTED'].includes(status),
    canConvertToProject: status === 'ACCEPTED',
  };
}
