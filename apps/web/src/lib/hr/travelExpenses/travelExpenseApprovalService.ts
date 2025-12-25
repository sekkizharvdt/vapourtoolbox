/**
 * Travel Expense Approval Service
 *
 * Handles the travel expense report approval workflow.
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
import type { TravelExpenseApprovalRecord, CreateTaskNotificationInput } from '@vapour/types';
import { getTravelExpenseReport } from './travelExpenseService';
import {
  createTaskNotification,
  completeTaskNotificationsByEntity,
} from '@/lib/tasks/taskNotificationService';

const logger = createLogger({ context: 'travelExpenseApprovalService' });

// Fallback approvers if Firestore config is not set up
// To configure: create document hrConfig/travelExpenseSettings with { expenseApprovers: ['email1', 'email2'] }
const DEFAULT_EXPENSE_APPROVERS = ['revathi@vapourdesal.com', 'sekkizhar@vapourdesal.com'];

/**
 * HR Config document structure
 */
interface TravelExpenseConfig {
  expenseApprovers?: string[]; // Array of approver email addresses
  updatedAt?: Timestamp;
  updatedBy?: string;
}

/**
 * Get travel expense approver emails from HR config
 * Falls back to leave approvers if travel expense specific config is not set up
 */
async function getTravelExpenseApproverEmails(): Promise<string[]> {
  const { db } = getFirebase();

  try {
    // First try travel expense specific config
    const travelConfigRef = doc(db, COLLECTIONS.HR_CONFIG, 'travelExpenseSettings');
    const travelConfigSnap = await getDoc(travelConfigRef);

    if (travelConfigSnap.exists()) {
      const config = travelConfigSnap.data() as TravelExpenseConfig;
      if (config.expenseApprovers && config.expenseApprovers.length > 0) {
        return config.expenseApprovers;
      }
    }

    // Fallback to leave settings (same approvers for both)
    const leaveConfigRef = doc(db, COLLECTIONS.HR_CONFIG, 'leaveSettings');
    const leaveConfigSnap = await getDoc(leaveConfigRef);

    if (leaveConfigSnap.exists()) {
      const config = leaveConfigSnap.data() as { leaveApprovers?: string[] };
      if (config.leaveApprovers && config.leaveApprovers.length > 0) {
        return config.leaveApprovers;
      }
    }

    // Fallback to defaults if config not found
    logger.warn(
      'HR config not found, using default approvers. Configure hrConfig/travelExpenseSettings in Firestore.'
    );
    return DEFAULT_EXPENSE_APPROVERS;
  } catch (error) {
    logger.error('Failed to fetch travel expense approver config', { error });
    return DEFAULT_EXPENSE_APPROVERS;
  }
}

/**
 * Get approver user IDs from emails
 */
async function getApproverUserIds(): Promise<string[]> {
  const { db } = getFirebase();

  try {
    const approverEmails = await getTravelExpenseApproverEmails();

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
      snapshot.docs.forEach((docSnap) => {
        userIds.push(docSnap.id);
      });
    }

    return userIds;
  } catch (error) {
    logger.error('Failed to get approver user IDs', { error });
    return [];
  }
}

/**
 * Submit a travel expense report for approval
 */
export async function submitTravelExpenseReport(
  reportId: string,
  userId: string,
  userName: string
): Promise<void> {
  const { db } = getFirebase();

  try {
    const report = await getTravelExpenseReport(reportId);

    if (!report) {
      throw new Error('Travel expense report not found');
    }

    if (report.status !== 'DRAFT') {
      throw new Error('Only DRAFT reports can be submitted for approval');
    }

    if (report.employeeId !== userId) {
      throw new Error('You can only submit your own travel expense reports');
    }

    if (report.items.length === 0) {
      throw new Error('Cannot submit a report with no expense items');
    }

    // Get approver user IDs
    const approverIds = await getApproverUserIds();

    if (approverIds.length === 0) {
      throw new Error('No approvers configured. Please contact HR.');
    }

    const now = Timestamp.now();

    // Create approval history record
    const approvalRecord: TravelExpenseApprovalRecord = {
      action: 'SUBMITTED',
      userId,
      userName,
      timestamp: now,
    };

    // Update report
    const docRef = doc(db, COLLECTIONS.HR_TRAVEL_EXPENSES, reportId);
    await updateDoc(docRef, {
      status: 'SUBMITTED',
      approverIds,
      submittedAt: now,
      approvalHistory: [approvalRecord],
      updatedAt: now,
      updatedBy: userId,
    });

    // Create task notifications for approvers
    const notificationPromises = approverIds.map((approverId) => {
      const notificationInput: CreateTaskNotificationInput = {
        type: 'actionable',
        category: 'TRAVEL_EXPENSE_SUBMITTED',
        userId: approverId,
        assignedBy: userId,
        assignedByName: userName,
        title: `Travel Expense: ${report.reportNumber}`,
        message: `${report.employeeName} has submitted a travel expense report for ${report.tripPurpose} (${report.totalAmount.toLocaleString('en-IN', { style: 'currency', currency: 'INR' })})`,
        priority: 'HIGH',
        entityType: 'HR_TRAVEL_EXPENSE',
        entityId: reportId,
        linkUrl: `/hr/travel-expenses/${reportId}`,
        autoCompletable: true,
        metadata: {
          employeeName: report.employeeName,
          reportNumber: report.reportNumber,
          tripPurpose: report.tripPurpose,
          totalAmount: report.totalAmount,
          tripStartDate: report.tripStartDate,
          tripEndDate: report.tripEndDate,
        },
      };
      return createTaskNotification(notificationInput);
    });

    await Promise.all(notificationPromises);
    logger.info('Created travel expense approval notifications', {
      reportId,
      approverCount: approverIds.length,
    });
  } catch (error) {
    logger.error('Failed to submit travel expense report', { error, reportId, userId });
    if (error instanceof Error) {
      throw error;
    }
    throw new Error('Failed to submit travel expense report');
  }
}

/**
 * Approve a travel expense report
 */
export async function approveTravelExpenseReport(
  reportId: string,
  approverId: string,
  approverName: string,
  approvedAmount?: number,
  comments?: string
): Promise<void> {
  const { db } = getFirebase();

  try {
    const report = await getTravelExpenseReport(reportId);

    if (!report) {
      throw new Error('Travel expense report not found');
    }

    if (report.status !== 'SUBMITTED' && report.status !== 'UNDER_REVIEW') {
      throw new Error('Only SUBMITTED or UNDER_REVIEW reports can be approved');
    }

    if (!report.approverIds?.includes(approverId)) {
      throw new Error('You are not authorized to approve this report');
    }

    const now = Timestamp.now();
    const finalApprovedAmount = approvedAmount ?? report.totalAmount;

    // Create approval history record
    const approvalRecord: TravelExpenseApprovalRecord = {
      action: 'APPROVED',
      userId: approverId,
      userName: approverName,
      timestamp: now,
      comments,
      approvedAmount: finalApprovedAmount,
    };

    // Update report
    const docRef = doc(db, COLLECTIONS.HR_TRAVEL_EXPENSES, reportId);
    await updateDoc(docRef, {
      status: 'APPROVED',
      approvedBy: approverId,
      approvedByName: approverName,
      approvedAt: now,
      approvedAmount: finalApprovedAmount,
      approvalHistory: [...report.approvalHistory, approvalRecord],
      updatedAt: now,
      updatedBy: approverId,
    });

    // Complete all approver task notifications
    await completeTaskNotificationsByEntity('HR_TRAVEL_EXPENSE', reportId, approverId);

    // Create notification for employee
    const employeeNotification: CreateTaskNotificationInput = {
      type: 'informational',
      category: 'TRAVEL_EXPENSE_APPROVED',
      userId: report.employeeId,
      assignedBy: approverId,
      assignedByName: approverName,
      title: 'Travel Expense Report Approved',
      message: `Your travel expense report ${report.reportNumber} has been approved${finalApprovedAmount !== report.totalAmount ? ` for ${finalApprovedAmount.toLocaleString('en-IN', { style: 'currency', currency: 'INR' })}` : ''}`,
      priority: 'MEDIUM',
      entityType: 'HR_TRAVEL_EXPENSE',
      entityId: reportId,
      linkUrl: `/hr/travel-expenses/${reportId}`,
      metadata: {
        approverName,
        reportNumber: report.reportNumber,
        totalAmount: report.totalAmount,
        approvedAmount: finalApprovedAmount,
        comments,
      },
    };
    await createTaskNotification(employeeNotification);
    logger.info('Created travel expense approved notification', {
      reportId,
      employeeId: report.employeeId,
    });
  } catch (error) {
    logger.error('Failed to approve travel expense report', { error, reportId, approverId });
    if (error instanceof Error) {
      throw error;
    }
    throw new Error('Failed to approve travel expense report');
  }
}

/**
 * Reject a travel expense report
 */
export async function rejectTravelExpenseReport(
  reportId: string,
  approverId: string,
  approverName: string,
  rejectionReason: string
): Promise<void> {
  const { db } = getFirebase();

  if (!rejectionReason || rejectionReason.trim().length === 0) {
    throw new Error('Rejection reason is required');
  }

  try {
    const report = await getTravelExpenseReport(reportId);

    if (!report) {
      throw new Error('Travel expense report not found');
    }

    if (report.status !== 'SUBMITTED' && report.status !== 'UNDER_REVIEW') {
      throw new Error('Only SUBMITTED or UNDER_REVIEW reports can be rejected');
    }

    if (!report.approverIds?.includes(approverId)) {
      throw new Error('You are not authorized to reject this report');
    }

    const now = Timestamp.now();

    // Create approval history record
    const approvalRecord: TravelExpenseApprovalRecord = {
      action: 'REJECTED',
      userId: approverId,
      userName: approverName,
      timestamp: now,
      comments: rejectionReason,
    };

    // Update report
    const docRef = doc(db, COLLECTIONS.HR_TRAVEL_EXPENSES, reportId);
    await updateDoc(docRef, {
      status: 'REJECTED',
      rejectedBy: approverId,
      rejectedByName: approverName,
      rejectedAt: now,
      rejectionReason,
      approvalHistory: [...report.approvalHistory, approvalRecord],
      updatedAt: now,
      updatedBy: approverId,
    });

    // Complete all approver task notifications
    await completeTaskNotificationsByEntity('HR_TRAVEL_EXPENSE', reportId, approverId);

    // Create notification for employee
    const employeeNotification: CreateTaskNotificationInput = {
      type: 'informational',
      category: 'TRAVEL_EXPENSE_REJECTED',
      userId: report.employeeId,
      assignedBy: approverId,
      assignedByName: approverName,
      title: 'Travel Expense Report Rejected',
      message: `Your travel expense report ${report.reportNumber} has been rejected. Reason: ${rejectionReason}`,
      priority: 'HIGH',
      entityType: 'HR_TRAVEL_EXPENSE',
      entityId: reportId,
      linkUrl: `/hr/travel-expenses/${reportId}`,
      metadata: {
        approverName,
        reportNumber: report.reportNumber,
        totalAmount: report.totalAmount,
        rejectionReason,
      },
    };
    await createTaskNotification(employeeNotification);
    logger.info('Created travel expense rejected notification', {
      reportId,
      employeeId: report.employeeId,
    });
  } catch (error) {
    logger.error('Failed to reject travel expense report', { error, reportId, approverId });
    if (error instanceof Error) {
      throw error;
    }
    throw new Error('Failed to reject travel expense report');
  }
}

/**
 * Return a travel expense report for revision (back to draft)
 */
export async function returnTravelExpenseForRevision(
  reportId: string,
  approverId: string,
  approverName: string,
  comments: string
): Promise<void> {
  const { db } = getFirebase();

  if (!comments || comments.trim().length === 0) {
    throw new Error('Comments are required when returning for revision');
  }

  try {
    const report = await getTravelExpenseReport(reportId);

    if (!report) {
      throw new Error('Travel expense report not found');
    }

    if (report.status !== 'SUBMITTED' && report.status !== 'UNDER_REVIEW') {
      throw new Error('Only SUBMITTED or UNDER_REVIEW reports can be returned for revision');
    }

    if (!report.approverIds?.includes(approverId)) {
      throw new Error('You are not authorized to return this report');
    }

    const now = Timestamp.now();

    // Create approval history record
    const approvalRecord: TravelExpenseApprovalRecord = {
      action: 'RETURNED',
      userId: approverId,
      userName: approverName,
      timestamp: now,
      comments,
    };

    // Update report - back to draft for revision
    const docRef = doc(db, COLLECTIONS.HR_TRAVEL_EXPENSES, reportId);
    await updateDoc(docRef, {
      status: 'DRAFT',
      approverIds: [], // Clear approvers
      submittedAt: null,
      approvalHistory: [...report.approvalHistory, approvalRecord],
      updatedAt: now,
      updatedBy: approverId,
    });

    // Complete all approver task notifications
    await completeTaskNotificationsByEntity('HR_TRAVEL_EXPENSE', reportId, approverId);

    // Create notification for employee
    const employeeNotification: CreateTaskNotificationInput = {
      type: 'actionable',
      category: 'TRAVEL_EXPENSE_RETURNED',
      userId: report.employeeId,
      assignedBy: approverId,
      assignedByName: approverName,
      title: 'Travel Expense Report Returned for Revision',
      message: `Your travel expense report ${report.reportNumber} has been returned for revision. Comment: ${comments}`,
      priority: 'HIGH',
      entityType: 'HR_TRAVEL_EXPENSE',
      entityId: reportId,
      linkUrl: `/hr/travel-expenses/${reportId}`,
      autoCompletable: true,
      metadata: {
        approverName,
        reportNumber: report.reportNumber,
        totalAmount: report.totalAmount,
        comments,
      },
    };
    await createTaskNotification(employeeNotification);
    logger.info('Created travel expense returned notification', {
      reportId,
      employeeId: report.employeeId,
    });
  } catch (error) {
    logger.error('Failed to return travel expense report for revision', {
      error,
      reportId,
      approverId,
    });
    if (error instanceof Error) {
      throw error;
    }
    throw new Error('Failed to return travel expense report for revision');
  }
}

/**
 * Mark a travel expense report as reimbursed
 */
export async function markTravelExpenseReimbursed(
  reportId: string,
  userId: string,
  userName: string,
  reimbursedAmount: number,
  transactionId?: string
): Promise<void> {
  const { db } = getFirebase();

  try {
    const report = await getTravelExpenseReport(reportId);

    if (!report) {
      throw new Error('Travel expense report not found');
    }

    if (report.status !== 'APPROVED') {
      throw new Error('Only APPROVED reports can be marked as reimbursed');
    }

    const now = Timestamp.now();

    // Create approval history record for reimbursement
    const approvalRecord: TravelExpenseApprovalRecord = {
      action: 'APPROVED', // Using APPROVED since there's no REIMBURSED action type
      userId,
      userName,
      timestamp: now,
      comments: `Reimbursed ${reimbursedAmount.toLocaleString('en-IN', { style: 'currency', currency: 'INR' })}${transactionId ? ` (Transaction: ${transactionId})` : ''}`,
      approvedAmount: reimbursedAmount,
    };

    // Update report
    const docRef = doc(db, COLLECTIONS.HR_TRAVEL_EXPENSES, reportId);
    await updateDoc(docRef, {
      status: 'REIMBURSED',
      reimbursedAmount,
      reimbursementDate: now,
      reimbursementTransactionId: transactionId,
      approvalHistory: [...report.approvalHistory, approvalRecord],
      updatedAt: now,
      updatedBy: userId,
    });

    // Create notification for employee
    const employeeNotification: CreateTaskNotificationInput = {
      type: 'informational',
      category: 'TRAVEL_EXPENSE_REIMBURSED',
      userId: report.employeeId,
      assignedBy: userId,
      assignedByName: userName,
      title: 'Travel Expense Reimbursed',
      message: `Your travel expense report ${report.reportNumber} has been reimbursed for ${reimbursedAmount.toLocaleString('en-IN', { style: 'currency', currency: 'INR' })}`,
      priority: 'MEDIUM',
      entityType: 'HR_TRAVEL_EXPENSE',
      entityId: reportId,
      linkUrl: `/hr/travel-expenses/${reportId}`,
      metadata: {
        reportNumber: report.reportNumber,
        reimbursedAmount,
        transactionId,
      },
    };
    await createTaskNotification(employeeNotification);
    logger.info('Marked travel expense as reimbursed', {
      reportId,
      reimbursedAmount,
      employeeId: report.employeeId,
    });
  } catch (error) {
    logger.error('Failed to mark travel expense as reimbursed', { error, reportId, userId });
    if (error instanceof Error) {
      throw error;
    }
    throw new Error('Failed to mark travel expense as reimbursed');
  }
}
