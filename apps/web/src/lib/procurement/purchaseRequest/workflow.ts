/**
 * Purchase Request Workflow Operations
 *
 * Submit, Approve, Reject, and Comment operations
 */

import { doc, getDoc, updateDoc, Timestamp, writeBatch } from 'firebase/firestore';
import { getFirebase } from '@/lib/firebase';
import { COLLECTIONS } from '@vapour/firebase';
import type { PurchaseRequest } from '@vapour/types';
import {
  createTaskNotification,
  findTaskNotificationByEntity,
  completeActionableTask,
} from '@/lib/tasks/taskNotificationService';
import { getPurchaseRequestItems } from './crud';
import { validateProjectBudget } from './utils';
import { logAuditEvent, createAuditContext } from '@/lib/audit';

/**
 * Submit Purchase Request for approval
 */
export async function submitPurchaseRequestForApproval(
  prId: string,
  userId: string,
  userName: string
): Promise<void> {
  const { db } = getFirebase();

  try {
    const docRef = doc(db, COLLECTIONS.PURCHASE_REQUESTS, prId);
    const docSnap = await getDoc(docRef);

    if (!docSnap.exists()) {
      throw new Error('Purchase request not found');
    }

    const pr = docSnap.data() as PurchaseRequest;

    // Validate PR can be submitted
    if (pr.status !== 'DRAFT') {
      throw new Error('Only draft purchase requests can be submitted');
    }

    if (pr.itemCount === 0) {
      throw new Error('Cannot submit purchase request with no items');
    }

    // Update status
    await updateDoc(docRef, {
      status: 'SUBMITTED',
      submittedAt: Timestamp.now(),
      submittedBy: userId,
      submittedByName: userName,
      updatedAt: Timestamp.now(),
      updatedBy: userId,
    });

    // Audit log: PR submitted
    const auditContext = createAuditContext(userId, '', userName);
    await logAuditEvent(
      db,
      auditContext,
      'PR_SUBMITTED',
      'PURCHASE_REQUEST',
      prId,
      `Submitted purchase request ${pr.number} for approval`,
      {
        entityName: pr.number,
        metadata: {
          title: pr.title,
          itemCount: pr.itemCount,
          projectId: pr.projectId,
          approverId: pr.approverId,
        },
      }
    );

    // Create task notification for the selected approver (if specified)
    if (pr.approverId) {
      await createTaskNotification({
        type: 'actionable',
        category: 'PR_SUBMITTED',
        userId: pr.approverId,
        assignedBy: userId,
        assignedByName: userName,
        title: `Review Purchase Request ${pr.number}`,
        message: `${userName} submitted a purchase request for your review: ${pr.title}`,
        entityType: 'PURCHASE_REQUEST',
        entityId: prId,
        linkUrl: `/procurement/purchase-requests/${prId}`,
        priority: pr.priority === 'URGENT' ? 'HIGH' : 'MEDIUM',
        autoCompletable: true,
        projectId: pr.projectId,
      });
    }
  } catch (error) {
    console.error('[submitPurchaseRequestForApproval] Error:', error);
    throw error;
  }
}

/**
 * Approve Purchase Request
 */
export async function approvePurchaseRequest(
  prId: string,
  userId: string,
  userName: string,
  comments?: string
): Promise<void> {
  const { db } = getFirebase();

  try {
    const docRef = doc(db, COLLECTIONS.PURCHASE_REQUESTS, prId);
    const docSnap = await getDoc(docRef);

    if (!docSnap.exists()) {
      throw new Error('Purchase request not found');
    }

    const pr = docSnap.data() as PurchaseRequest;

    // Validate PR can be approved
    if (pr.status !== 'SUBMITTED' && pr.status !== 'UNDER_REVIEW') {
      throw new Error('Purchase request is not in reviewable status');
    }

    // Get PR items for budget validation
    const prItems = await getPurchaseRequestItems(prId);

    // Validate project budget before approval
    const budgetValidation = await validateProjectBudget(pr, prItems);

    if (!budgetValidation.valid) {
      throw new Error(
        budgetValidation.error || 'Budget validation failed - insufficient project budget'
      );
    }

    // Update status - only include comment fields if they have values
    // Firestore doesn't accept undefined values
    const updateData: Record<string, unknown> = {
      status: 'APPROVED',
      reviewedBy: userId,
      reviewedByName: userName,
      reviewedAt: Timestamp.now(),
      approvedBy: userId,
      approvedByName: userName,
      approvedAt: Timestamp.now(),
      updatedAt: Timestamp.now(),
      updatedBy: userId,
    };

    if (comments) {
      updateData.reviewComments = comments;
      updateData.approvalComments = comments;
    }

    await updateDoc(docRef, updateData);

    // Update all items to approved
    const items = await getPurchaseRequestItems(prId);
    const batch = writeBatch(db);

    items.forEach((item) => {
      const itemRef = doc(db, COLLECTIONS.PURCHASE_REQUEST_ITEMS, item.id);
      batch.update(itemRef, {
        status: 'APPROVED',
        updatedAt: Timestamp.now(),
      });
    });

    await batch.commit();

    // Auto-complete the review task if it exists
    const reviewTask = await findTaskNotificationByEntity(
      'PURCHASE_REQUEST',
      prId,
      'PR_SUBMITTED',
      'in_progress'
    );
    if (reviewTask) {
      await completeActionableTask(reviewTask.id, userId, true);
    }

    // Audit log: PR approved
    const auditContext = createAuditContext(userId, '', userName);
    await logAuditEvent(
      db,
      auditContext,
      'PR_APPROVED',
      'PURCHASE_REQUEST',
      prId,
      `Approved purchase request ${pr.number}`,
      {
        entityName: pr.number,
        metadata: {
          title: pr.title,
          itemCount: items.length,
          projectId: pr.projectId,
          submittedBy: pr.submittedBy,
          comments,
        },
      }
    );

    // Create informational notification for submitter
    await createTaskNotification({
      type: 'informational',
      category: 'PR_APPROVED',
      userId: pr.submittedBy,
      assignedBy: userId,
      assignedByName: userName,
      title: `Purchase Request ${pr.number} Approved`,
      message: comments
        ? `Your purchase request was approved by ${userName}: ${comments}`
        : `Your purchase request was approved by ${userName}`,
      entityType: 'PURCHASE_REQUEST',
      entityId: prId,
      linkUrl: `/procurement/purchase-requests/${prId}`,
      priority: 'HIGH',
      projectId: pr.projectId,
    });
  } catch (error) {
    console.error('[approvePurchaseRequest] Error:', error);
    throw error;
  }
}

/**
 * Reject Purchase Request
 */
export async function rejectPurchaseRequest(
  prId: string,
  userId: string,
  userName: string,
  reason: string
): Promise<void> {
  const { db } = getFirebase();

  try {
    const docRef = doc(db, COLLECTIONS.PURCHASE_REQUESTS, prId);
    const docSnap = await getDoc(docRef);

    if (!docSnap.exists()) {
      throw new Error('Purchase request not found');
    }

    const pr = docSnap.data() as PurchaseRequest;

    // Validate PR can be rejected
    if (pr.status !== 'SUBMITTED' && pr.status !== 'UNDER_REVIEW') {
      throw new Error('Purchase request is not in reviewable status');
    }

    if (!reason || reason.trim() === '') {
      throw new Error('Rejection reason is required');
    }

    // Update status
    await updateDoc(docRef, {
      status: 'REJECTED',
      reviewedBy: userId,
      reviewedByName: userName,
      reviewedAt: Timestamp.now(),
      rejectionReason: reason,
      updatedAt: Timestamp.now(),
      updatedBy: userId,
    });

    // Update all items to rejected
    const items = await getPurchaseRequestItems(prId);
    const batch = writeBatch(db);

    items.forEach((item) => {
      const itemRef = doc(db, COLLECTIONS.PURCHASE_REQUEST_ITEMS, item.id);
      batch.update(itemRef, {
        status: 'REJECTED',
        updatedAt: Timestamp.now(),
      });
    });

    await batch.commit();

    // Auto-complete the review task if it exists
    const reviewTask = await findTaskNotificationByEntity(
      'PURCHASE_REQUEST',
      prId,
      'PR_SUBMITTED',
      'in_progress'
    );
    if (reviewTask) {
      await completeActionableTask(reviewTask.id, userId, true);
    }

    // Audit log: PR rejected
    const auditContext = createAuditContext(userId, '', userName);
    await logAuditEvent(
      db,
      auditContext,
      'PR_REJECTED',
      'PURCHASE_REQUEST',
      prId,
      `Rejected purchase request ${pr.number}: ${reason}`,
      {
        entityName: pr.number,
        severity: 'WARNING',
        metadata: {
          title: pr.title,
          projectId: pr.projectId,
          submittedBy: pr.submittedBy,
          rejectionReason: reason,
        },
      }
    );

    // Create informational notification for submitter
    await createTaskNotification({
      type: 'informational',
      category: 'PR_REJECTED',
      userId: pr.submittedBy,
      assignedBy: userId,
      assignedByName: userName,
      title: `Purchase Request ${pr.number} Rejected`,
      message: `Your purchase request was rejected by ${userName}: ${reason}`,
      entityType: 'PURCHASE_REQUEST',
      entityId: prId,
      linkUrl: `/procurement/purchase-requests/${prId}`,
      priority: 'HIGH',
      projectId: pr.projectId,
    });
  } catch (error) {
    console.error('[rejectPurchaseRequest] Error:', error);
    throw error;
  }
}

/**
 * Add comment to Purchase Request
 */
export async function addPurchaseRequestComment(
  prId: string,
  userId: string,
  userName: string,
  comment: string
): Promise<void> {
  const { db } = getFirebase();

  try {
    const docRef = doc(db, COLLECTIONS.PURCHASE_REQUESTS, prId);
    const docSnap = await getDoc(docRef);

    if (!docSnap.exists()) {
      throw new Error('Purchase request not found');
    }

    const pr = docSnap.data() as PurchaseRequest;

    // Update review comments
    await updateDoc(docRef, {
      status: 'UNDER_REVIEW', // Move to under review if submitted
      reviewedBy: userId,
      reviewedByName: userName,
      reviewedAt: Timestamp.now(),
      reviewComments: comment,
      updatedAt: Timestamp.now(),
      updatedBy: userId,
    });

    // Create informational notification for submitter
    const truncatedComment = comment.length > 100 ? comment.substring(0, 100) + '...' : comment;

    await createTaskNotification({
      type: 'informational',
      category: 'PR_COMMENTED',
      userId: pr.submittedBy,
      assignedBy: userId,
      assignedByName: userName,
      title: `Comment on Purchase Request ${pr.number}`,
      message: `${userName} added a comment: ${truncatedComment}`,
      entityType: 'PURCHASE_REQUEST',
      entityId: prId,
      linkUrl: `/procurement/purchase-requests/${prId}`,
      priority: 'MEDIUM',
      projectId: pr.projectId,
    });
  } catch (error) {
    console.error('[addPurchaseRequestComment] Error:', error);
    throw error;
  }
}
