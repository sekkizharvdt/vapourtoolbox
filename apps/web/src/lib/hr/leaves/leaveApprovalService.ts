/**
 * Leave Approval Service
 *
 * Handles the leave request approval workflow.
 * Supports 2-step sequential approval (both approvers must approve).
 * Self-approval prevention: when an approver applies, only the other can approve.
 */

import {
  doc,
  updateDoc,
  Timestamp,
  getDocs,
  getDoc,
  query,
  collection,
  where,
} from 'firebase/firestore';
import { getFirebase } from '@/lib/firebase';
import { COLLECTIONS } from '@vapour/firebase';
import { createLogger } from '@vapour/logger';
import type {
  LeaveApprovalRecord,
  CreateTaskNotificationInput,
  ApprovalFlow,
  ApprovalEntry,
  LeaveRequest,
} from '@vapour/types';
import { getLeaveRequestById } from './leaveRequestService';
import { addPendingLeave, confirmPendingLeave, removePendingLeave } from './leaveBalanceService';
import {
  createTaskNotification,
  completeTaskNotificationsByEntity,
} from '@/lib/tasks/taskNotificationService';
import { format } from 'date-fns';

const logger = createLogger({ context: 'leaveApprovalService' });

// Fallback approvers if Firestore config is not set up
// To configure: create document hrConfig/leaveSettings with { leaveApprovers: ['email1', 'email2'] }
const DEFAULT_LEAVE_APPROVERS = ['revathi@vapourdesal.com', 'sekkizhar@vapourdesal.com'];

/**
 * HR Config document structure
 */
interface HRConfig {
  leaveApprovers?: string[]; // Array of approver email addresses
  updatedAt?: Timestamp;
  updatedBy?: string;
}

/**
 * Get leave approver emails from HR config
 * Falls back to default approvers if config is not set up
 */
async function getLeaveApproverEmails(): Promise<string[]> {
  const { db } = getFirebase();

  try {
    const configRef = doc(db, COLLECTIONS.HR_CONFIG, 'leaveSettings');
    const configSnap = await getDoc(configRef);

    if (configSnap.exists()) {
      const config = configSnap.data() as HRConfig;
      if (config.leaveApprovers && config.leaveApprovers.length > 0) {
        return config.leaveApprovers;
      }
    }

    // Fallback to defaults if config not found
    logger.warn(
      'HR config not found, using default approvers. Configure hrConfig/leaveSettings in Firestore.'
    );
    return DEFAULT_LEAVE_APPROVERS;
  } catch (error) {
    logger.error('Failed to fetch leave approver config', { error });
    return DEFAULT_LEAVE_APPROVERS;
  }
}

/**
 * User info structure for approvers
 */
interface ApproverInfo {
  id: string;
  email: string;
  displayName: string;
}

/**
 * Get approver user info from emails
 *
 * Performance: Uses batched 'in' queries instead of N+1 sequential queries
 * Firestore 'in' queries support max 30 values, so we batch if needed
 */
async function getApproverInfoByEmails(emails: string[]): Promise<ApproverInfo[]> {
  const { db } = getFirebase();

  try {
    if (emails.length === 0) {
      return [];
    }

    const approvers: ApproverInfo[] = [];
    const batchSize = 30; // Firestore 'in' query limit

    // Process emails in batches of 30 (Firestore 'in' query limit)
    for (let i = 0; i < emails.length; i += batchSize) {
      const emailBatch = emails.slice(i, i + batchSize);

      const q = query(
        collection(db, COLLECTIONS.USERS),
        where('email', 'in', emailBatch),
        where('isActive', '==', true)
      );

      const snapshot = await getDocs(q);
      snapshot.docs.forEach((docSnap) => {
        const data = docSnap.data();
        approvers.push({
          id: docSnap.id,
          email: data.email,
          displayName: data.displayName || data.email,
        });
      });
    }

    return approvers;
  } catch (error) {
    logger.error('Failed to get approver info', { error });
    return [];
  }
}

/**
 * Get user email by user ID
 */
async function getUserEmailById(userId: string): Promise<string | null> {
  const { db } = getFirebase();

  try {
    const userDoc = await getDoc(doc(db, COLLECTIONS.USERS, userId));
    if (!userDoc.exists()) {
      return null;
    }
    return userDoc.data().email || null;
  } catch (error) {
    logger.error('Failed to get user email', { error, userId });
    return null;
  }
}

/**
 * Notify all internal users about approved leave (team notification)
 */
async function notifyTeamOfApprovedLeave(request: LeaveRequest): Promise<void> {
  const { db } = getFirebase();

  try {
    // Get all active internal users
    const usersQuery = query(
      collection(db, COLLECTIONS.USERS),
      where('isActive', '==', true),
      where('status', '==', 'active'),
      where('userType', '==', 'internal')
    );

    const snapshot = await getDocs(usersQuery);

    const startDate = format(request.startDate.toDate(), 'dd/MM/yyyy');
    const endDate = format(request.endDate.toDate(), 'dd/MM/yyyy');
    const dateRange = startDate === endDate ? startDate : `${startDate} - ${endDate}`;

    // Create notifications in parallel
    const notificationPromises = snapshot.docs
      .filter((userDoc) => userDoc.id !== request.userId) // Exclude the applicant
      .map((userDoc) => {
        const notification: CreateTaskNotificationInput = {
          type: 'informational',
          category: 'LEAVE_APPROVED',
          userId: userDoc.id,
          assignedBy: request.userId,
          assignedByName: request.userName,
          title: 'Team Leave Notice',
          message: `${request.userName} will be on ${request.leaveTypeName} (${dateRange})`,
          priority: 'LOW',
          entityType: 'HR_LEAVE_REQUEST',
          entityId: request.id,
          linkUrl: '/hr/leaves/team-calendar',
          metadata: {
            employeeName: request.userName,
            leaveType: request.leaveTypeName,
            numberOfDays: request.numberOfDays,
            startDate: request.startDate,
            endDate: request.endDate,
          },
        };
        return createTaskNotification(notification);
      });

    await Promise.all(notificationPromises);
    logger.info('Sent team leave notifications', {
      requestId: request.id,
      recipientCount: notificationPromises.length,
    });
  } catch (error) {
    // Don't fail the approval if team notifications fail
    logger.error('Failed to send team leave notifications', { error, requestId: request.id });
  }
}

/**
 * Submit a leave request for approval
 *
 * Implements 2-step approval workflow:
 * - Normal case: Both approvers must approve (either order)
 * - Self-approval case: When applicant is an approver, only the other approver is needed
 */
export async function submitLeaveRequest(
  requestId: string,
  userId: string,
  userName: string
): Promise<void> {
  const { db } = getFirebase();

  try {
    const request = await getLeaveRequestById(requestId);

    if (!request) {
      throw new Error('Leave request not found');
    }

    if (request.status !== 'DRAFT') {
      throw new Error('Only DRAFT requests can be submitted for approval');
    }

    if (request.userId !== userId) {
      throw new Error('You can only submit your own leave requests');
    }

    // Get configured approver emails
    const allApproverEmails = await getLeaveApproverEmails();

    // Get applicant's email to check for self-approval case
    const applicantEmail = await getUserEmailById(userId);

    // Determine if this is a self-approval case (applicant is one of the approvers)
    const isSelfApprovalCase = applicantEmail ? allApproverEmails.includes(applicantEmail) : false;

    // For self-approval case, exclude the applicant from approvers
    const requiredApproverEmails = isSelfApprovalCase
      ? allApproverEmails.filter((email) => email !== applicantEmail)
      : allApproverEmails;

    // Get approver info for the required approvers
    const approvers = await getApproverInfoByEmails(requiredApproverEmails);
    const approverIds = approvers.map((a) => a.id);

    if (approverIds.length === 0) {
      throw new Error('No approvers configured. Please contact HR.');
    }

    // For normal case: 2 approvals needed
    // For self-approval case: 1 approval needed (from the other approver)
    const requiredApprovalCount = isSelfApprovalCase ? 1 : 2;

    const now = Timestamp.now();

    // Create approval flow configuration
    const approvalFlow: ApprovalFlow = {
      requiredApprovers: requiredApproverEmails,
      requiredApprovalCount,
      approvals: [],
      currentStep: 1,
      isComplete: false,
      isSelfApprovalCase,
    };

    // Create approval history record
    const approvalRecord: LeaveApprovalRecord = {
      action: 'SUBMITTED',
      actorId: userId,
      actorName: userName,
      timestamp: now,
    };

    // Update request
    const docRef = doc(db, COLLECTIONS.HR_LEAVE_REQUESTS, requestId);
    await updateDoc(docRef, {
      status: 'PENDING_APPROVAL',
      approverIds,
      approvalFlow,
      submittedAt: now,
      approvalHistory: [approvalRecord],
      updatedAt: now,
      updatedBy: userId,
    });

    // Add pending days to balance
    await addPendingLeave(
      request.userId,
      request.leaveTypeCode,
      request.numberOfDays,
      userId,
      request.fiscalYear
    );

    // Create task notifications for all required approvers
    const notificationPromises = approvers.map((approver) => {
      const notificationInput: CreateTaskNotificationInput = {
        type: 'actionable',
        category: 'LEAVE_SUBMITTED',
        userId: approver.id,
        assignedBy: userId,
        assignedByName: userName,
        title: `Leave Request: ${request.userName}`,
        message: isSelfApprovalCase
          ? `${request.userName} has requested ${request.numberOfDays} day(s) of ${request.leaveTypeName} (your approval required)`
          : `${request.userName} has requested ${request.numberOfDays} day(s) of ${request.leaveTypeName}`,
        priority: 'HIGH',
        entityType: 'HR_LEAVE_REQUEST',
        entityId: requestId,
        linkUrl: `/hr/leaves/${requestId}`,
        autoCompletable: true,
        metadata: {
          employeeName: request.userName,
          leaveType: request.leaveTypeName,
          numberOfDays: request.numberOfDays,
          startDate: request.startDate,
          endDate: request.endDate,
          isSelfApprovalCase,
          requiredApprovalCount,
        },
      };
      return createTaskNotification(notificationInput);
    });

    await Promise.all(notificationPromises);
    logger.info('Created leave approval notifications', {
      requestId,
      approverCount: approverIds.length,
      isSelfApprovalCase,
      requiredApprovalCount,
    });
  } catch (error) {
    logger.error('Failed to submit leave request', { error, requestId, userId });
    if (error instanceof Error) {
      throw error;
    }
    throw new Error('Failed to submit leave request');
  }
}

/**
 * Approve a leave request
 *
 * Implements 2-step approval:
 * - First approval: status changes to PARTIALLY_APPROVED
 * - Second approval: status changes to APPROVED, balance deducted, team notified
 * - Self-approval case: Single approval is sufficient
 */
export async function approveLeaveRequest(
  requestId: string,
  approverId: string,
  approverName: string,
  remarks?: string
): Promise<void> {
  const { db } = getFirebase();

  try {
    const request = await getLeaveRequestById(requestId);

    if (!request) {
      throw new Error('Leave request not found');
    }

    // Allow approval of both PENDING_APPROVAL and PARTIALLY_APPROVED requests
    if (!['PENDING_APPROVAL', 'PARTIALLY_APPROVED'].includes(request.status)) {
      throw new Error('This request cannot be approved (status: ' + request.status + ')');
    }

    if (!request.approverIds.includes(approverId)) {
      throw new Error('You are not authorized to approve this request');
    }

    // Get approver's email for the approval entry
    const approverEmail = await getUserEmailById(approverId);

    // Check if this approver has already approved (for 2-step flow)
    const approvalFlow = request.approvalFlow || {
      requiredApprovers: [],
      requiredApprovalCount: 1,
      approvals: [],
      currentStep: 1,
      isComplete: false,
      isSelfApprovalCase: false,
    };

    const alreadyApproved = approvalFlow.approvals.some(
      (a: ApprovalEntry) => a.approverId === approverId
    );

    if (alreadyApproved) {
      throw new Error('You have already approved this request');
    }

    const now = Timestamp.now();

    // Create approval entry
    const newApproval: ApprovalEntry = {
      approverId,
      approverEmail: approverEmail || '',
      approverName,
      approvedAt: now,
      step: approvalFlow.approvals.length + 1,
    };

    // Calculate if all required approvals are now complete
    const newApprovalCount = approvalFlow.approvals.length + 1;
    const isComplete = newApprovalCount >= approvalFlow.requiredApprovalCount;
    const newStatus = isComplete ? 'APPROVED' : 'PARTIALLY_APPROVED';

    // Create approval history record
    const approvalRecord: LeaveApprovalRecord = {
      action: 'APPROVED',
      actorId: approverId,
      actorName: approverName,
      timestamp: now,
      remarks: isComplete
        ? remarks
        : `${remarks || ''} (Approval ${newApprovalCount}/${approvalFlow.requiredApprovalCount})`.trim(),
    };

    // Update approval flow
    const updatedApprovalFlow: ApprovalFlow = {
      ...approvalFlow,
      approvals: [...approvalFlow.approvals, newApproval],
      currentStep: newApprovalCount,
      isComplete,
    };

    // Build update data
    const updateData: Record<string, unknown> = {
      status: newStatus,
      approvalFlow: updatedApprovalFlow,
      approvalHistory: [...request.approvalHistory, approvalRecord],
      updatedAt: now,
      updatedBy: approverId,
    };

    // If fully approved, set final approver info
    if (isComplete) {
      updateData.approvedBy = approverId;
      updateData.approvedByName = approverName;
      updateData.approvedAt = now;
    }

    // Update request
    const docRef = doc(db, COLLECTIONS.HR_LEAVE_REQUESTS, requestId);
    await updateDoc(docRef, updateData);

    if (isComplete) {
      // Final approval - deduct balance and notify team
      await confirmPendingLeave(
        request.userId,
        request.leaveTypeCode,
        request.numberOfDays,
        approverId,
        request.fiscalYear
      );

      // Complete all approver task notifications
      await completeTaskNotificationsByEntity('HR_LEAVE_REQUEST', requestId, approverId);

      // Create final approval notification for employee
      const employeeNotification: CreateTaskNotificationInput = {
        type: 'informational',
        category: 'LEAVE_APPROVED',
        userId: request.userId,
        assignedBy: approverId,
        assignedByName: approverName,
        title: 'Leave Request Approved',
        message: `Your ${request.leaveTypeName} request for ${request.numberOfDays} day(s) has been fully approved`,
        priority: 'MEDIUM',
        entityType: 'HR_LEAVE_REQUEST',
        entityId: requestId,
        linkUrl: `/hr/leaves/${requestId}`,
        metadata: {
          approverName,
          leaveType: request.leaveTypeName,
          numberOfDays: request.numberOfDays,
          startDate: request.startDate,
          endDate: request.endDate,
          remarks,
        },
      };
      await createTaskNotification(employeeNotification);

      // Notify all internal users about the approved leave
      await notifyTeamOfApprovedLeave({
        ...request,
        id: requestId,
      });

      logger.info('Leave request fully approved', {
        requestId,
        employeeId: request.userId,
        approvalCount: newApprovalCount,
      });
    } else {
      // Partial approval - notify employee and remaining approvers
      const employeeNotification: CreateTaskNotificationInput = {
        type: 'informational',
        category: 'LEAVE_APPROVED',
        userId: request.userId,
        assignedBy: approverId,
        assignedByName: approverName,
        title: 'Leave Request Partially Approved',
        message: `Your ${request.leaveTypeName} request has been approved by ${approverName} (${newApprovalCount}/${approvalFlow.requiredApprovalCount} approvals)`,
        priority: 'MEDIUM',
        entityType: 'HR_LEAVE_REQUEST',
        entityId: requestId,
        linkUrl: `/hr/leaves/${requestId}`,
        metadata: {
          approverName,
          leaveType: request.leaveTypeName,
          numberOfDays: request.numberOfDays,
          approvalStep: newApprovalCount,
          totalRequired: approvalFlow.requiredApprovalCount,
        },
      };
      await createTaskNotification(employeeNotification);

      logger.info('Leave request partially approved', {
        requestId,
        employeeId: request.userId,
        approvalCount: newApprovalCount,
        requiredCount: approvalFlow.requiredApprovalCount,
      });
    }
  } catch (error) {
    logger.error('Failed to approve leave request', { error, requestId, approverId });
    if (error instanceof Error) {
      throw error;
    }
    throw new Error('Failed to approve leave request');
  }
}

/**
 * Reject a leave request
 *
 * Either approver can reject at any stage (PENDING_APPROVAL or PARTIALLY_APPROVED)
 */
export async function rejectLeaveRequest(
  requestId: string,
  approverId: string,
  approverName: string,
  rejectionReason: string
): Promise<void> {
  const { db } = getFirebase();

  if (!rejectionReason || rejectionReason.trim().length === 0) {
    throw new Error('Rejection reason is required');
  }

  try {
    const request = await getLeaveRequestById(requestId);

    if (!request) {
      throw new Error('Leave request not found');
    }

    // Allow rejection of both PENDING_APPROVAL and PARTIALLY_APPROVED requests
    if (!['PENDING_APPROVAL', 'PARTIALLY_APPROVED'].includes(request.status)) {
      throw new Error('This request cannot be rejected (status: ' + request.status + ')');
    }

    if (!request.approverIds.includes(approverId)) {
      throw new Error('You are not authorized to reject this request');
    }

    const now = Timestamp.now();

    // Create approval history record
    const approvalRecord: LeaveApprovalRecord = {
      action: 'REJECTED',
      actorId: approverId,
      actorName: approverName,
      timestamp: now,
      remarks: rejectionReason,
    };

    // Update request
    const docRef = doc(db, COLLECTIONS.HR_LEAVE_REQUESTS, requestId);
    await updateDoc(docRef, {
      status: 'REJECTED',
      rejectedBy: approverId,
      rejectedByName: approverName,
      rejectionReason,
      rejectedAt: now,
      approvalHistory: [...request.approvalHistory, approvalRecord],
      updatedAt: now,
      updatedBy: approverId,
    });

    // Remove pending leave days
    await removePendingLeave(
      request.userId,
      request.leaveTypeCode,
      request.numberOfDays,
      approverId,
      request.fiscalYear
    );

    // Complete all approver task notifications
    await completeTaskNotificationsByEntity('HR_LEAVE_REQUEST', requestId, approverId);

    // Create notification for employee
    const employeeNotification: CreateTaskNotificationInput = {
      type: 'informational',
      category: 'LEAVE_REJECTED',
      userId: request.userId,
      assignedBy: approverId,
      assignedByName: approverName,
      title: 'Leave Request Rejected',
      message: `Your ${request.leaveTypeName} request for ${request.numberOfDays} day(s) has been rejected by ${approverName}. Reason: ${rejectionReason}`,
      priority: 'HIGH',
      entityType: 'HR_LEAVE_REQUEST',
      entityId: requestId,
      linkUrl: `/hr/leaves/${requestId}`,
      metadata: {
        approverName,
        leaveType: request.leaveTypeName,
        numberOfDays: request.numberOfDays,
        startDate: request.startDate,
        endDate: request.endDate,
        rejectionReason,
      },
    };
    await createTaskNotification(employeeNotification);
    logger.info('Created leave rejected notification', { requestId, employeeId: request.userId });
  } catch (error) {
    logger.error('Failed to reject leave request', { error, requestId, approverId });
    if (error instanceof Error) {
      throw error;
    }
    throw new Error('Failed to reject leave request');
  }
}

/**
 * Cancel a leave request (by employee)
 *
 * Can cancel DRAFT, PENDING_APPROVAL, or PARTIALLY_APPROVED requests
 */
export async function cancelLeaveRequest(
  requestId: string,
  userId: string,
  userName: string,
  cancellationReason?: string
): Promise<void> {
  const { db } = getFirebase();

  try {
    const request = await getLeaveRequestById(requestId);

    if (!request) {
      throw new Error('Leave request not found');
    }

    if (request.userId !== userId) {
      throw new Error('You can only cancel your own leave requests');
    }

    // Allow cancellation of PARTIALLY_APPROVED as well
    if (!['DRAFT', 'PENDING_APPROVAL', 'PARTIALLY_APPROVED'].includes(request.status)) {
      throw new Error(
        'Only DRAFT, PENDING_APPROVAL, or PARTIALLY_APPROVED requests can be cancelled'
      );
    }

    const now = Timestamp.now();

    // Create approval history record
    const approvalRecord: LeaveApprovalRecord = {
      action: 'CANCELLED',
      actorId: userId,
      actorName: userName,
      timestamp: now,
      remarks: cancellationReason,
    };

    // Update request
    const docRef = doc(db, COLLECTIONS.HR_LEAVE_REQUESTS, requestId);
    await updateDoc(docRef, {
      status: 'CANCELLED',
      cancellationReason,
      cancelledAt: now,
      approvalHistory: [...request.approvalHistory, approvalRecord],
      updatedAt: now,
      updatedBy: userId,
    });

    // If was pending or partially approved, remove pending leave days and complete approver notifications
    if (['PENDING_APPROVAL', 'PARTIALLY_APPROVED'].includes(request.status)) {
      await removePendingLeave(
        request.userId,
        request.leaveTypeCode,
        request.numberOfDays,
        userId,
        request.fiscalYear
      );

      // Complete all approver task notifications since request is cancelled
      await completeTaskNotificationsByEntity('HR_LEAVE_REQUEST', requestId, userId);
    }

    logger.info('Leave request cancelled successfully', { requestId, userId });
  } catch (error) {
    logger.error('Failed to cancel leave request', { error, requestId, userId });
    if (error instanceof Error) {
      throw error;
    }
    throw new Error('Failed to cancel leave request');
  }
}
