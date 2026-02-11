/**
 * On-Duty Approval Service
 *
 * Handles the on-duty request approval workflow.
 * Supports 2-step sequential approval (both approvers must approve).
 * Self-approval prevention: when an approver applies, only the other can approve.
 * Pattern mirrors leaveApprovalService exactly.
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
  OnDutyRequest,
} from '@vapour/types';
import { getOnDutyRequestById } from './onDutyRequestService';
import { grantCompOff } from './compOffService';
import {
  createTaskNotification,
  completeTaskNotificationsByEntity,
} from '@/lib/tasks/taskNotificationService';
import { format, differenceInDays } from 'date-fns';
import { preventSelfApproval } from '@/lib/auth/authorizationService';

const logger = createLogger({ context: 'onDutyApprovalService' });

// HR-5: Approvers must be configured in Firestore — no hard-coded fallbacks.
// To configure: create document hrConfig/leaveSettings with { leaveApprovers: ['email1', 'email2'] }

/**
 * HR Config document structure
 */
interface HRConfig {
  leaveApprovers?: string[]; // Array of approver email addresses
  updatedAt?: Timestamp;
  updatedBy?: string;
}

/**
 * Get leave approver emails from HR config (reuse same approvers as leave requests)
 * Throws if config is not set up (HR-5: no hard-coded fallback emails)
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

    // HR-5: Fail explicitly instead of using hard-coded emails
    throw new Error(
      'Leave approvers not configured. Please set up hrConfig/leaveSettings in Firestore with { leaveApprovers: [...] }.'
    );
  } catch (error) {
    if (error instanceof Error && error.message.includes('not configured')) {
      throw error;
    }
    logger.error('Failed to fetch leave approver config', { error });
    throw new Error(
      'Failed to load leave approver configuration. Please contact an administrator.'
    );
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
 */
async function getApproverInfoByEmails(emails: string[]): Promise<ApproverInfo[]> {
  const { db } = getFirebase();

  try {
    if (emails.length === 0) {
      return [];
    }

    const approvers: ApproverInfo[] = [];
    const batchSize = 30; // Firestore 'in' query limit

    // Process emails in batches of 30
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
 * Notify all internal users about approved on-duty (team notification)
 */
async function notifyTeamOfApprovedOnDuty(request: OnDutyRequest): Promise<void> {
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
    const holidayDate = format(request.holidayDate.toDate(), 'dd/MM/yyyy');

    // Create notifications in parallel
    const notificationPromises = snapshot.docs
      .filter((userDoc) => userDoc.id !== request.userId) // Exclude the applicant
      .map((userDoc) => {
        const notification: CreateTaskNotificationInput = {
          type: 'informational',
          category: 'ON_DUTY_APPROVED',
          userId: userDoc.id,
          assignedBy: request.userId,
          assignedByName: request.userName,
          title: 'Team On-Duty Notice',
          message: `${request.userName} will be working on ${request.holidayName} (${holidayDate})`,
          priority: 'LOW',
          entityType: 'HR_ON_DUTY_REQUEST',
          entityId: request.id,
          linkUrl: '/hr/leaves/team-calendar',
          metadata: {
            employeeName: request.userName,
            holidayName: request.holidayName,
            holidayDate: request.holidayDate,
          },
        };
        return createTaskNotification(notification);
      });

    await Promise.all(notificationPromises);
    logger.info('Sent team on-duty notifications', {
      requestId: request.id,
      recipientCount: notificationPromises.length,
    });
  } catch (error) {
    // Don't fail the approval if team notifications fail
    logger.error('Failed to send team on-duty notifications', { error, requestId: request.id });
  }
}

/**
 * Submit an on-duty request for approval
 *
 * Implements 2-step approval workflow (same as leave requests)
 */
export async function submitOnDutyRequest(
  requestId: string,
  userId: string,
  userName: string
): Promise<void> {
  const { db } = getFirebase();

  try {
    const request = await getOnDutyRequestById(requestId);

    if (!request) {
      throw new Error('On-duty request not found');
    }

    if (request.status !== 'DRAFT') {
      throw new Error('Only DRAFT requests can be submitted for approval');
    }

    if (request.userId !== userId) {
      throw new Error('You can only submit your own on-duty requests');
    }

    // Get configured approver emails
    const allApproverEmails = await getLeaveApproverEmails();

    // Get applicant's email to check for self-approval case
    const applicantEmail = await getUserEmailById(userId);

    // Determine if this is a self-approval case
    const isSelfApprovalCase = applicantEmail ? allApproverEmails.includes(applicantEmail) : false;

    // For self-approval case, exclude the applicant from approvers
    const requiredApproverEmails = isSelfApprovalCase
      ? allApproverEmails.filter((email) => email !== applicantEmail)
      : allApproverEmails;

    // Get approver info
    const approvers = await getApproverInfoByEmails(requiredApproverEmails);
    const approverIds = approvers.map((a) => a.id);

    if (approverIds.length === 0) {
      throw new Error('No approvers configured. Please contact HR.');
    }

    // For normal case: 2 approvals needed
    // For self-approval case: 1 approval needed
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
    const docRef = doc(db, COLLECTIONS.HR_ON_DUTY_REQUESTS, requestId);
    await updateDoc(docRef, {
      status: 'PENDING_APPROVAL',
      approverIds,
      approvalFlow,
      submittedAt: now,
      approvalHistory: [approvalRecord],
      updatedAt: now,
    });

    // Create task notifications for all required approvers
    const holidayDate = format(request.holidayDate.toDate(), 'dd/MM/yyyy');
    const notificationPromises = approvers.map((approver) => {
      const notificationInput: CreateTaskNotificationInput = {
        type: 'actionable',
        category: 'ON_DUTY_SUBMITTED',
        userId: approver.id,
        assignedBy: userId,
        assignedByName: userName,
        title: `On-Duty Request: ${request.userName}`,
        message: isSelfApprovalCase
          ? `${request.userName} has requested to work on ${request.holidayName} (${holidayDate}) - your approval required`
          : `${request.userName} has requested to work on ${request.holidayName} (${holidayDate})`,
        priority: 'HIGH',
        entityType: 'HR_ON_DUTY_REQUEST',
        entityId: requestId,
        linkUrl: `/hr/on-duty/${requestId}`,
        autoCompletable: true,
        metadata: {
          employeeName: request.userName,
          holidayName: request.holidayName,
          holidayDate: request.holidayDate,
          isSelfApprovalCase,
          requiredApprovalCount,
        },
      };
      return createTaskNotification(notificationInput);
    });

    await Promise.all(notificationPromises);
    logger.info('Created on-duty approval notifications', {
      requestId,
      approverCount: approverIds.length,
      isSelfApprovalCase,
      requiredApprovalCount,
    });
  } catch (error) {
    logger.error('Failed to submit on-duty request', { error, requestId, userId });
    if (error instanceof Error) {
      throw error;
    }
    throw new Error('Failed to submit on-duty request');
  }
}

/**
 * Approve an on-duty request
 *
 * Implements 2-step approval (same as leave requests)
 */
export async function approveOnDutyRequest(
  requestId: string,
  approverId: string,
  approverName: string,
  remarks?: string
): Promise<void> {
  const { db } = getFirebase();

  try {
    const request = await getOnDutyRequestById(requestId);

    if (!request) {
      throw new Error('On-duty request not found');
    }

    // Allow approval of both PENDING_APPROVAL and PARTIALLY_APPROVED requests
    if (!['PENDING_APPROVAL', 'PARTIALLY_APPROVED'].includes(request.status)) {
      throw new Error('This request cannot be approved (status: ' + request.status + ')');
    }

    if (!request.approverIds.includes(approverId)) {
      throw new Error('You are not authorized to approve this request');
    }

    // HR-17: Defense-in-depth self-approval prevention
    preventSelfApproval(approverId, request.userId, 'approve on-duty request');

    // Get approver's email
    const approverEmail = await getUserEmailById(approverId);

    // Check if this approver has already approved
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
    const remarksValue = isComplete
      ? remarks
      : `${remarks || ''} (Approval ${newApprovalCount}/${approvalFlow.requiredApprovalCount})`.trim();
    const approvalRecord: LeaveApprovalRecord = {
      action: 'APPROVED',
      actorId: approverId,
      actorName: approverName,
      timestamp: now,
      ...(remarksValue ? { remarks: remarksValue } : {}),
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
    };

    // If fully approved, set final approver info and grant comp-off
    if (isComplete) {
      updateData.approvedBy = approverId;
      updateData.approvedByName = approverName;
      updateData.approvedAt = now;
      updateData.compOffGranted = true;
    }

    // Update request
    const docRef = doc(db, COLLECTIONS.HR_ON_DUTY_REQUESTS, requestId);
    await updateDoc(docRef, updateData);

    if (isComplete) {
      // Final approval - grant comp-off and notify team
      await grantCompOff(
        request.userId,
        {
          source: 'ON_DUTY_REQUEST',
          onDutyRequestId: requestId,
          holidayName: request.holidayName,
          holidayDate: request.holidayDate.toDate(),
        },
        approverId
      );

      // Complete all approver task notifications
      await completeTaskNotificationsByEntity('HR_ON_DUTY_REQUEST', requestId, approverId);

      // Create final approval notification for employee
      const approvedMetadata = Object.fromEntries(
        Object.entries({
          approverName,
          holidayName: request.holidayName,
          holidayDate: request.holidayDate,
          compOffGranted: true,
          remarks,
        }).filter(([, value]) => value !== undefined)
      );
      const employeeNotification: CreateTaskNotificationInput = {
        type: 'informational',
        category: 'ON_DUTY_APPROVED',
        userId: request.userId,
        assignedBy: approverId,
        assignedByName: approverName,
        title: 'On-Duty Request Approved',
        message: `Your on-duty request for ${request.holidayName} has been fully approved. You have been granted 1 comp-off day.`,
        priority: 'MEDIUM',
        entityType: 'HR_ON_DUTY_REQUEST',
        entityId: requestId,
        linkUrl: `/hr/on-duty/${requestId}`,
        metadata: approvedMetadata,
      };
      await createTaskNotification(employeeNotification);

      // Notify all internal users
      await notifyTeamOfApprovedOnDuty({
        ...request,
        id: requestId,
      });

      logger.info('On-duty request fully approved', {
        requestId,
        employeeId: request.userId,
        approvalCount: newApprovalCount,
        compOffGranted: true,
      });
    } else {
      // Partial approval - notify employee
      const employeeNotification: CreateTaskNotificationInput = {
        type: 'informational',
        category: 'ON_DUTY_APPROVED',
        userId: request.userId,
        assignedBy: approverId,
        assignedByName: approverName,
        title: 'On-Duty Request Partially Approved',
        message: `Your on-duty request for ${request.holidayName} has been approved by ${approverName} (${newApprovalCount}/${approvalFlow.requiredApprovalCount} approvals)`,
        priority: 'MEDIUM',
        entityType: 'HR_ON_DUTY_REQUEST',
        entityId: requestId,
        linkUrl: `/hr/on-duty/${requestId}`,
        metadata: {
          approverName,
          holidayName: request.holidayName,
          approvalStep: newApprovalCount,
          totalRequired: approvalFlow.requiredApprovalCount,
        },
      };
      await createTaskNotification(employeeNotification);

      logger.info('On-duty request partially approved', {
        requestId,
        employeeId: request.userId,
        approvalCount: newApprovalCount,
        requiredCount: approvalFlow.requiredApprovalCount,
      });
    }
  } catch (error) {
    logger.error('Failed to approve on-duty request', { error, requestId, approverId });
    if (error instanceof Error) {
      throw error;
    }
    throw new Error('Failed to approve on-duty request');
  }
}

/**
 * Reject an on-duty request
 */
export async function rejectOnDutyRequest(
  requestId: string,
  approverId: string,
  approverName: string,
  rejectionReason: string
): Promise<void> {
  const { db } = getFirebase();

  try {
    const request = await getOnDutyRequestById(requestId);

    if (!request) {
      throw new Error('On-duty request not found');
    }

    if (!['PENDING_APPROVAL', 'PARTIALLY_APPROVED'].includes(request.status)) {
      throw new Error('This request cannot be rejected (status: ' + request.status + ')');
    }

    if (!request.approverIds.includes(approverId)) {
      throw new Error('You are not authorized to reject this request');
    }

    // HR-17: Defense-in-depth self-approval prevention
    preventSelfApproval(approverId, request.userId, 'reject on-duty request');

    const now = Timestamp.now();

    // Create rejection history record
    const rejectionRecord: LeaveApprovalRecord = {
      action: 'REJECTED',
      actorId: approverId,
      actorName: approverName,
      timestamp: now,
      remarks: rejectionReason,
    };

    // Update request
    const docRef = doc(db, COLLECTIONS.HR_ON_DUTY_REQUESTS, requestId);
    await updateDoc(docRef, {
      status: 'REJECTED',
      rejectedBy: approverId,
      rejectedByName: approverName,
      rejectedAt: now,
      rejectionReason,
      approvalHistory: [...request.approvalHistory, rejectionRecord],
      updatedAt: now,
    });

    // Complete all approver task notifications
    await completeTaskNotificationsByEntity('HR_ON_DUTY_REQUEST', requestId, approverId);

    // Notify employee
    const employeeNotification: CreateTaskNotificationInput = {
      type: 'informational',
      category: 'ON_DUTY_REJECTED',
      userId: request.userId,
      assignedBy: approverId,
      assignedByName: approverName,
      title: 'On-Duty Request Rejected',
      message: `Your on-duty request for ${request.holidayName} has been rejected by ${approverName}`,
      priority: 'HIGH',
      entityType: 'HR_ON_DUTY_REQUEST',
      entityId: requestId,
      linkUrl: `/hr/on-duty/${requestId}`,
      metadata: {
        approverName,
        holidayName: request.holidayName,
        rejectionReason,
      },
    };
    await createTaskNotification(employeeNotification);

    logger.info('On-duty request rejected', {
      requestId,
      employeeId: request.userId,
      approverId,
    });
  } catch (error) {
    logger.error('Failed to reject on-duty request', { error, requestId, approverId });
    if (error instanceof Error) {
      throw error;
    }
    throw new Error('Failed to reject on-duty request');
  }
}

/**
 * Cancel an on-duty request (by employee)
 * Can only cancel DRAFT, PENDING_APPROVAL, or PARTIALLY_APPROVED requests
 * If approved and comp-off granted, can cancel up to 1 day before holiday
 */
export async function cancelOnDutyRequest(
  requestId: string,
  userId: string,
  userName: string,
  cancellationReason: string
): Promise<void> {
  const { db } = getFirebase();

  try {
    const request = await getOnDutyRequestById(requestId);

    if (!request) {
      throw new Error('On-duty request not found');
    }

    if (request.userId !== userId) {
      throw new Error('You can only cancel your own requests');
    }

    if (request.status === 'CANCELLED') {
      throw new Error('Request is already cancelled');
    }

    if (request.status === 'REJECTED') {
      throw new Error('Cannot cancel a rejected request');
    }

    // If approved, check if cancellation is allowed (at least 1 day before)
    if (request.status === 'APPROVED') {
      const holidayDate = request.holidayDate.toDate();
      const daysUntilHoliday = differenceInDays(holidayDate, new Date());

      if (daysUntilHoliday < 1) {
        throw new Error('Cannot cancel on-duty request less than 1 day before the holiday');
      }

      // If comp-off was granted, need to revoke it
      // This will be handled in a future enhancement
    }

    const now = Timestamp.now();

    // Create cancellation history record
    const cancellationRecord: LeaveApprovalRecord = {
      action: 'CANCELLED',
      actorId: userId,
      actorName: userName,
      timestamp: now,
      remarks: cancellationReason,
    };

    // Update request
    const docRef = doc(db, COLLECTIONS.HR_ON_DUTY_REQUESTS, requestId);
    await updateDoc(docRef, {
      status: 'CANCELLED',
      cancelledAt: now,
      cancellationReason,
      approvalHistory: [...request.approvalHistory, cancellationRecord],
      updatedAt: now,
    });

    // Complete any pending task notifications
    await completeTaskNotificationsByEntity('HR_ON_DUTY_REQUEST', requestId, userId);

    // Notify approvers if it was pending
    if (['PENDING_APPROVAL', 'PARTIALLY_APPROVED'].includes(request.status)) {
      const approverIds = request.approverIds;
      const notificationPromises = approverIds.map((approverId) => {
        const notification: CreateTaskNotificationInput = {
          type: 'informational',
          category: 'ON_DUTY_CANCELLED',
          userId: approverId,
          assignedBy: userId,
          assignedByName: userName,
          title: 'On-Duty Request Cancelled',
          message: `${userName} has cancelled their on-duty request for ${request.holidayName}`,
          priority: 'LOW',
          entityType: 'HR_ON_DUTY_REQUEST',
          entityId: requestId,
          linkUrl: `/hr/on-duty/${requestId}`,
          metadata: {
            employeeName: userName,
            holidayName: request.holidayName,
            cancellationReason,
          },
        };
        return createTaskNotification(notification);
      });
      await Promise.all(notificationPromises);
    }

    logger.info('On-duty request cancelled', {
      requestId,
      userId,
      previousStatus: request.status,
    });
  } catch (error) {
    logger.error('Failed to cancel on-duty request', { error, requestId, userId });
    if (error instanceof Error) {
      throw error;
    }
    throw new Error('Failed to cancel on-duty request');
  }
}
