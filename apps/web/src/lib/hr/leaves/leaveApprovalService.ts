/**
 * Leave Approval Service
 *
 * Handles the leave request approval workflow.
 * Supports parallel approval (any one approver can approve/reject).
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
import type { LeaveApprovalRecord, CreateTaskNotificationInput } from '@vapour/types';
import { getLeaveRequestById } from './leaveRequestService';
import { addPendingLeave, confirmPendingLeave, removePendingLeave } from './leaveBalanceService';
import {
  createTaskNotification,
  completeTaskNotificationsByEntity,
} from '@/lib/tasks/taskNotificationService';

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
 * Get approver user IDs from emails
 *
 * Performance: Uses batched 'in' queries instead of N+1 sequential queries
 * Firestore 'in' queries support max 30 values, so we batch if needed
 */
async function getApproverUserIds(): Promise<string[]> {
  const { db } = getFirebase();

  try {
    const approverEmails = await getLeaveApproverEmails();

    if (approverEmails.length === 0) {
      return [];
    }

    const userIds: string[] = [];
    const batchSize = 30; // Firestore 'in' query limit

    // Process emails in batches of 30 (Firestore 'in' query limit)
    for (let i = 0; i < approverEmails.length; i += batchSize) {
      const emailBatch = approverEmails.slice(i, i + batchSize);

      const q = query(
        collection(db, COLLECTIONS.USERS),
        where('email', 'in', emailBatch),
        where('isActive', '==', true)
      );

      const snapshot = await getDocs(q);
      snapshot.docs.forEach((doc) => {
        userIds.push(doc.id);
      });
    }

    return userIds;
  } catch (error) {
    logger.error('Failed to get approver user IDs', { error });
    // Return empty array - will be handled by caller
    return [];
  }
}

/**
 * Submit a leave request for approval
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

    // Get approver user IDs
    const approverIds = await getApproverUserIds();

    if (approverIds.length === 0) {
      throw new Error('No approvers configured. Please contact HR.');
    }

    const now = Timestamp.now();

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

    // Create task notifications for approvers
    const notificationPromises = approverIds.map((approverId) => {
      const notificationInput: CreateTaskNotificationInput = {
        type: 'actionable',
        category: 'LEAVE_SUBMITTED',
        userId: approverId,
        assignedBy: userId,
        assignedByName: userName,
        title: `Leave Request: ${request.userName}`,
        message: `${request.userName} has requested ${request.numberOfDays} day(s) of ${request.leaveTypeName}`,
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
        },
      };
      return createTaskNotification(notificationInput);
    });

    await Promise.all(notificationPromises);
    logger.info('Created leave approval notifications', {
      requestId,
      approverCount: approverIds.length,
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

    if (request.status !== 'PENDING_APPROVAL') {
      throw new Error('Only PENDING_APPROVAL requests can be approved');
    }

    if (!request.approverIds.includes(approverId)) {
      throw new Error('You are not authorized to approve this request');
    }

    const now = Timestamp.now();

    // Create approval history record
    const approvalRecord: LeaveApprovalRecord = {
      action: 'APPROVED',
      actorId: approverId,
      actorName: approverName,
      timestamp: now,
      remarks,
    };

    // Update request
    const docRef = doc(db, COLLECTIONS.HR_LEAVE_REQUESTS, requestId);
    await updateDoc(docRef, {
      status: 'APPROVED',
      approvedBy: approverId,
      approvedByName: approverName,
      approvedAt: now,
      approvalHistory: [...request.approvalHistory, approvalRecord],
      updatedAt: now,
      updatedBy: approverId,
    });

    // Confirm pending leave as used
    await confirmPendingLeave(
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
      category: 'LEAVE_APPROVED',
      userId: request.userId,
      assignedBy: approverId,
      assignedByName: approverName,
      title: 'Leave Request Approved',
      message: `Your ${request.leaveTypeName} request for ${request.numberOfDays} day(s) has been approved by ${approverName}`,
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
    logger.info('Created leave approved notification', { requestId, employeeId: request.userId });
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

    if (request.status !== 'PENDING_APPROVAL') {
      throw new Error('Only PENDING_APPROVAL requests can be rejected');
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

    if (!['DRAFT', 'PENDING_APPROVAL'].includes(request.status)) {
      throw new Error('Only DRAFT or PENDING_APPROVAL requests can be cancelled');
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

    // If was pending, remove pending leave days and complete approver notifications
    if (request.status === 'PENDING_APPROVAL') {
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
