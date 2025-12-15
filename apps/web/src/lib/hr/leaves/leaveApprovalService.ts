/**
 * Leave Approval Service
 *
 * Handles the leave request approval workflow.
 * Supports parallel approval (any user with APPROVE_LEAVES permission can approve/reject).
 */

import { doc, updateDoc, Timestamp, getDocs, query, collection, where } from 'firebase/firestore';
import { getFirebase } from '@/lib/firebase';
import { COLLECTIONS } from '@vapour/firebase';
import { PERMISSION_FLAGS_2 } from '@vapour/constants';
import type { LeaveApprovalRecord } from '@vapour/types';
import { getLeaveRequestById } from './leaveRequestService';
import { addPendingLeave, confirmPendingLeave, removePendingLeave } from './leaveBalanceService';

// TODO: Integrate task notifications once the flow module is ready
// import { createTaskNotification, completeTaskNotifications } from '@/lib/flow/taskNotificationService';

/**
 * Get approver user IDs based on APPROVE_LEAVES permission
 * Users with APPROVE_LEAVES or MANAGE_HR_SETTINGS in permissions2 can approve leaves
 */
async function getApproverUserIds(): Promise<string[]> {
  const { db } = getFirebase();

  try {
    // Query active internal users
    const q = query(
      collection(db, COLLECTIONS.USERS),
      where('isActive', '==', true),
      where('domain', '==', 'vapourdesal.com')
    );

    const snapshot = await getDocs(q);

    // Filter users who have APPROVE_LEAVES or MANAGE_HR_SETTINGS permission
    const approverIds: string[] = [];
    const APPROVE_LEAVES = PERMISSION_FLAGS_2.APPROVE_LEAVES; // 16384
    const MANAGE_HR_SETTINGS = PERMISSION_FLAGS_2.MANAGE_HR_SETTINGS; // 8192

    snapshot.docs.forEach((doc) => {
      const userData = doc.data();
      const permissions2 = userData.permissions2 || 0;

      // Check if user has APPROVE_LEAVES or MANAGE_HR_SETTINGS permission
      const hasApproveLeaves = (permissions2 & APPROVE_LEAVES) === APPROVE_LEAVES;
      const hasManageHR = (permissions2 & MANAGE_HR_SETTINGS) === MANAGE_HR_SETTINGS;

      if (hasApproveLeaves || hasManageHR) {
        approverIds.push(doc.id);
      }
    });

    return approverIds;
  } catch (error) {
    console.error('[getApproverUserIds] Error:', error);
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

    // TODO: Create task notifications for approvers once flow module is ready
    // for (const approverId of approverIds) {
    //   await createTaskNotification({
    //     userId: approverId,
    //     category: 'LEAVE_SUBMITTED',
    //     title: `Leave Request: ${request.userName}`,
    //     message: `${request.userName} has requested ${request.numberOfDays} day(s) of ${request.leaveTypeName}`,
    //     ...
    //   });
    // }
    // TODO: Notifications pending flow module integration
  } catch (error) {
    console.error('[submitLeaveRequest] Error:', error);
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

    // TODO: Complete all approver task notifications once flow module is ready
    // await completeTaskNotifications('HR_LEAVE_REQUEST', requestId);

    // TODO: Create notification for employee once flow module is ready
    // await createTaskNotification({
    //   userId: request.userId,
    //   category: 'LEAVE_APPROVED',
    //   ...
    // });
    // TODO: Notifications pending flow module integration
  } catch (error) {
    console.error('[approveLeaveRequest] Error:', error);
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

    // TODO: Complete all approver task notifications once flow module is ready
    // await completeTaskNotifications('HR_LEAVE_REQUEST', requestId);

    // TODO: Create notification for employee once flow module is ready
    // await createTaskNotification({
    //   userId: request.userId,
    //   category: 'LEAVE_REJECTED',
    //   ...
    // });
    // TODO: Notifications pending flow module integration
  } catch (error) {
    console.error('[rejectLeaveRequest] Error:', error);
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

    // If was pending, remove pending leave days
    if (request.status === 'PENDING_APPROVAL') {
      await removePendingLeave(
        request.userId,
        request.leaveTypeCode,
        request.numberOfDays,
        userId,
        request.fiscalYear
      );

      // TODO: Complete all approver task notifications once flow module is ready
      // await completeTaskNotifications('HR_LEAVE_REQUEST', requestId);
    }
    // Leave request cancelled successfully
  } catch (error) {
    console.error('[cancelLeaveRequest] Error:', error);
    if (error instanceof Error) {
      throw error;
    }
    throw new Error('Failed to cancel leave request');
  }
}

// formatDate helper removed - was only used for task notifications which are currently disabled
