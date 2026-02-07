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
  userName: string
): Promise<void> {
  try {
    const proposalRef = doc(db, COLLECTIONS.PROPOSALS, proposalId);
    const proposalSnap = await getDoc(proposalRef);

    if (!proposalSnap.exists()) {
      throw new Error('Proposal not found');
    }

    const proposal = proposalSnap.data() as Proposal;

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

    await updateDoc(proposalRef, {
      status: 'PENDING_APPROVAL',
      submittedAt: Timestamp.now(),
      submittedByUserId: userId,
      submittedByUserName: userName,
      updatedAt: Timestamp.now(),
      updatedBy: userId,
    });

    // Create actionable task for approvers (users with APPROVE_ESTIMATES permission)
    if (proposal.entityId) {
      const approverIds = await getProposalApprovers(db, proposal.entityId);

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
      });
    }

    logger.info('Proposal submitted for approval', { proposalId, userId });
  } catch (error) {
    logger.error('Error submitting proposal', { proposalId, error });
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
  try {
    // Authorization: Require APPROVE_ESTIMATES permission
    requirePermission(
      userPermissions,
      PERMISSION_FLAGS.MANAGE_ESTIMATION,
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
  try {
    // Authorization: Require APPROVE_ESTIMATES permission
    requirePermission(
      userPermissions,
      PERMISSION_FLAGS.MANAGE_ESTIMATION,
      userId,
      'reject proposal'
    );

    const proposalRef = doc(db, COLLECTIONS.PROPOSALS, proposalId);
    const proposalSnap = await getDoc(proposalRef);

    if (!proposalSnap.exists()) {
      throw new Error('Proposal not found');
    }

    const proposal = proposalSnap.data() as Proposal;

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
  try {
    // Authorization: Require APPROVE_ESTIMATES permission
    requirePermission(
      userPermissions,
      PERMISSION_FLAGS.MANAGE_ESTIMATION,
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
