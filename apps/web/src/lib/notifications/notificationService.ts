/**
 * In-App Notification Service
 *
 * Create and manage in-app notifications for users
 * NO EMAIL SENDING - notifications are in-app only
 */

import {
  collection,
  doc,
  addDoc,
  getDocs,
  updateDoc,
  query,
  where,
  orderBy,
  limit as firestoreLimit,
  Timestamp,
  type QueryConstraint,
} from 'firebase/firestore';
import { getFirebase } from '@/lib/firebase';
import { COLLECTIONS } from '@vapour/firebase';
import type { ProcurementNotification, ProcurementNotificationType } from '@vapour/types';

// ============================================================================
// CREATE NOTIFICATION
// ============================================================================

export interface CreateNotificationInput {
  type: ProcurementNotificationType;
  userId: string; // Target user to notify
  title: string;
  message: string;
  entityType: string; // e.g., 'PURCHASE_REQUEST', 'RFQ', 'PURCHASE_ORDER'
  entityId: string;
  linkUrl: string; // Where to navigate when clicked
  priority?: 'LOW' | 'MEDIUM' | 'HIGH' | 'URGENT';
  metadata?: Record<string, unknown>;
}

/**
 * Create a new in-app notification
 */
export async function createNotification(input: CreateNotificationInput): Promise<string> {
  const { db } = getFirebase();

  try {
    const now = Timestamp.now();

    const notificationData: Omit<ProcurementNotification, 'id'> = {
      type: input.type,
      userId: input.userId,
      title: input.title,
      message: input.message,
      entityType: input.entityType,
      entityId: input.entityId,
      linkUrl: input.linkUrl,
      read: false,
      priority: input.priority || 'MEDIUM',
      metadata: input.metadata,
      createdAt: now,
    };

    const docRef = await addDoc(collection(db, COLLECTIONS.NOTIFICATIONS), notificationData);

    return docRef.id;
  } catch (error) {
    console.error('[createNotification] Error:', error);
    throw new Error('Failed to create notification');
  }
}

// ============================================================================
// GET USER NOTIFICATIONS
// ============================================================================

export interface GetNotificationsFilters {
  userId: string;
  read?: boolean; // Filter by read/unread
  priority?: 'LOW' | 'MEDIUM' | 'HIGH' | 'URGENT';
  limit?: number;
}

/**
 * Get notifications for a user
 */
export async function getUserNotifications(
  filters: GetNotificationsFilters
): Promise<ProcurementNotification[]> {
  const { db } = getFirebase();

  try {
    const constraints: QueryConstraint[] = [where('userId', '==', filters.userId)];

    if (filters.read !== undefined) {
      constraints.push(where('read', '==', filters.read));
    }

    if (filters.priority) {
      constraints.push(where('priority', '==', filters.priority));
    }

    // Order by newest first
    constraints.push(orderBy('createdAt', 'desc'));

    // Limit
    if (filters.limit) {
      constraints.push(firestoreLimit(filters.limit));
    }

    const q = query(collection(db, COLLECTIONS.NOTIFICATIONS), ...constraints);
    const snapshot = await getDocs(q);

    const notifications: ProcurementNotification[] = [];
    snapshot.forEach((doc) => {
      notifications.push({
        id: doc.id,
        ...doc.data(),
      } as ProcurementNotification);
    });

    return notifications;
  } catch (error) {
    console.error('[getUserNotifications] Error:', error);
    throw new Error('Failed to get notifications');
  }
}

// ============================================================================
// GET UNREAD COUNT
// ============================================================================

/**
 * Get count of unread notifications for a user
 */
export async function getUnreadNotificationCount(userId: string): Promise<number> {
  const { db } = getFirebase();

  try {
    const q = query(
      collection(db, COLLECTIONS.NOTIFICATIONS),
      where('userId', '==', userId),
      where('read', '==', false)
    );

    const snapshot = await getDocs(q);
    return snapshot.size;
  } catch (error) {
    console.error('[getUnreadNotificationCount] Error:', error);
    return 0; // Return 0 on error, don't throw
  }
}

// ============================================================================
// MARK AS READ
// ============================================================================

/**
 * Mark a notification as read
 */
export async function markNotificationAsRead(notificationId: string): Promise<void> {
  const { db } = getFirebase();

  try {
    const docRef = doc(db, COLLECTIONS.NOTIFICATIONS, notificationId);

    await updateDoc(docRef, {
      read: true,
      readAt: Timestamp.now(),
    });
  } catch (error) {
    console.error('[markNotificationAsRead] Error:', error);
    throw new Error('Failed to mark notification as read');
  }
}

/**
 * Mark all notifications as read for a user
 */
export async function markAllNotificationsAsRead(userId: string): Promise<void> {
  try {
    const unreadNotifications = await getUserNotifications({
      userId,
      read: false,
    });

    const updatePromises = unreadNotifications.map((notification) =>
      markNotificationAsRead(notification.id)
    );

    await Promise.all(updatePromises);
  } catch (error) {
    console.error('[markAllNotificationsAsRead] Error:', error);
    throw new Error('Failed to mark all notifications as read');
  }
}

// ============================================================================
// PROCUREMENT-SPECIFIC NOTIFICATION HELPERS
// ============================================================================

/**
 * Create PR submitted notification for Engineering Head
 */
export async function notifyPRSubmitted(
  engineeringHeadUserId: string,
  prNumber: string,
  prId: string,
  submitterName: string
): Promise<void> {
  await createNotification({
    type: 'PR_SUBMITTED',
    userId: engineeringHeadUserId,
    title: `Purchase Request ${prNumber} Submitted`,
    message: `${submitterName} submitted a purchase request for your review`,
    entityType: 'PURCHASE_REQUEST',
    entityId: prId,
    linkUrl: `/procurement/engineering-approval`,
    priority: 'MEDIUM',
  });
}

/**
 * Create PR approved notification for submitter
 */
export async function notifyPRApproved(
  submitterUserId: string,
  prNumber: string,
  prId: string,
  approverName: string,
  comments?: string
): Promise<void> {
  await createNotification({
    type: 'PR_APPROVED',
    userId: submitterUserId,
    title: `Purchase Request ${prNumber} Approved`,
    message: comments
      ? `Your purchase request was approved by ${approverName}: ${comments}`
      : `Your purchase request was approved by ${approverName}`,
    entityType: 'PURCHASE_REQUEST',
    entityId: prId,
    linkUrl: `/procurement/purchase-requests/${prId}`,
    priority: 'HIGH',
  });
}

/**
 * Create PR rejected notification for submitter
 */
export async function notifyPRRejected(
  submitterUserId: string,
  prNumber: string,
  prId: string,
  reviewerName: string,
  reason: string
): Promise<void> {
  await createNotification({
    type: 'PR_REJECTED',
    userId: submitterUserId,
    title: `Purchase Request ${prNumber} Rejected`,
    message: `Your purchase request was rejected by ${reviewerName}: ${reason}`,
    entityType: 'PURCHASE_REQUEST',
    entityId: prId,
    linkUrl: `/procurement/purchase-requests/${prId}`,
    priority: 'HIGH',
  });
}

/**
 * Create PR commented notification for submitter
 */
export async function notifyPRCommented(
  submitterUserId: string,
  prNumber: string,
  prId: string,
  reviewerName: string,
  comment: string
): Promise<void> {
  const truncatedComment = comment.length > 100 ? comment.substring(0, 100) + '...' : comment;

  await createNotification({
    type: 'PR_COMMENTED',
    userId: submitterUserId,
    title: `Comment on Purchase Request ${prNumber}`,
    message: `${reviewerName} added a comment: ${truncatedComment}`,
    entityType: 'PURCHASE_REQUEST',
    entityId: prId,
    linkUrl: `/procurement/purchase-requests/${prId}`,
    priority: 'MEDIUM',
  });
}

/**
 * Create RFQ created notification
 */
export async function notifyRFQCreated(
  userIds: string[],
  rfqNumber: string,
  rfqId: string,
  creatorName: string
): Promise<void> {
  const createPromises = userIds.map((userId) =>
    createNotification({
      type: 'RFQ_CREATED',
      userId,
      title: `RFQ ${rfqNumber} Created`,
      message: `${creatorName} created a new RFQ, ready for PDF download`,
      entityType: 'RFQ',
      entityId: rfqId,
      linkUrl: `/procurement/rfqs/${rfqId}`,
      priority: 'MEDIUM',
    })
  );

  await Promise.all(createPromises);
}

/**
 * Create offer uploaded notification
 */
export async function notifyOfferUploaded(
  procurementManagerUserId: string,
  rfqNumber: string,
  rfqId: string,
  vendorName: string
): Promise<void> {
  await createNotification({
    type: 'OFFER_UPLOADED',
    userId: procurementManagerUserId,
    title: `Vendor Offer Received for RFQ ${rfqNumber}`,
    message: `Offer from ${vendorName} has been uploaded`,
    entityType: 'RFQ',
    entityId: rfqId,
    linkUrl: `/procurement/offers/compare/${rfqId}`,
    priority: 'MEDIUM',
  });
}

/**
 * Create PO pending approval notification for Director
 */
export async function notifyPOPendingApproval(
  directorUserId: string,
  poNumber: string,
  poId: string,
  creatorName: string,
  amount: number
): Promise<void> {
  await createNotification({
    type: 'PO_PENDING_APPROVAL',
    userId: directorUserId,
    title: `Purchase Order ${poNumber} Awaiting Approval`,
    message: `${creatorName} submitted a PO for ₹${amount.toLocaleString('en-IN')} for your approval`,
    entityType: 'PURCHASE_ORDER',
    entityId: poId,
    linkUrl: `/procurement/purchase-orders/approve`,
    priority: 'HIGH',
  });
}

/**
 * Create PO approved notification for Procurement Manager
 */
export async function notifyPOApproved(
  procurementManagerUserId: string,
  poNumber: string,
  poId: string,
  approverName: string
): Promise<void> {
  await createNotification({
    type: 'PO_APPROVED',
    userId: procurementManagerUserId,
    title: `Purchase Order ${poNumber} Approved`,
    message: `Your purchase order was approved by ${approverName}`,
    entityType: 'PURCHASE_ORDER',
    entityId: poId,
    linkUrl: `/procurement/purchase-orders/${poId}`,
    priority: 'HIGH',
  });
}

/**
 * Create PO rejected notification for Procurement Manager
 */
export async function notifyPORejected(
  procurementManagerUserId: string,
  poNumber: string,
  poId: string,
  rejectorName: string,
  reason: string
): Promise<void> {
  await createNotification({
    type: 'PO_REJECTED',
    userId: procurementManagerUserId,
    title: `Purchase Order ${poNumber} Rejected`,
    message: `Your purchase order was rejected by ${rejectorName}: ${reason}`,
    entityType: 'PURCHASE_ORDER',
    entityId: poId,
    linkUrl: `/procurement/purchase-orders/${poId}`,
    priority: 'HIGH',
  });
}

/**
 * Create goods received notification for payment approval
 */
export async function notifyGoodsReceived(
  accountsUserIds: string[],
  poNumber: string,
  poId: string,
  inspectorName: string
): Promise<void> {
  const createPromises = accountsUserIds.map((userId) =>
    createNotification({
      type: 'GOODS_RECEIVED',
      userId,
      title: `Goods Received for PO ${poNumber}`,
      message: `${inspectorName} verified goods receipt, approved for payment`,
      entityType: 'PURCHASE_ORDER',
      entityId: poId,
      linkUrl: `/procurement/purchase-orders/${poId}`,
      priority: 'MEDIUM',
    })
  );

  await Promise.all(createPromises);
}

/**
 * Create payment requested notification for Accounts
 */
export async function notifyPaymentRequested(
  accountsUserIds: string[],
  poNumber: string,
  poId: string,
  amount: number
): Promise<void> {
  const createPromises = accountsUserIds.map((userId) =>
    createNotification({
      type: 'PAYMENT_REQUESTED',
      userId,
      title: `Payment Request for PO ${poNumber}`,
      message: `Payment of ₹${amount.toLocaleString('en-IN')} requested`,
      entityType: 'PURCHASE_ORDER',
      entityId: poId,
      linkUrl: `/procurement/purchase-orders/${poId}`,
      priority: 'MEDIUM',
    })
  );

  await Promise.all(createPromises);
}

/**
 * Create WCC issued notification
 */
export async function notifyWCCIssued(
  userIds: string[],
  wccNumber: string,
  poNumber: string,
  wccId: string
): Promise<void> {
  const createPromises = userIds.map((userId) =>
    createNotification({
      type: 'WCC_ISSUED',
      userId,
      title: `Work Completion Certificate ${wccNumber} Issued`,
      message: `WCC issued for PO ${poNumber}`,
      entityType: 'WORK_COMPLETION_CERTIFICATE',
      entityId: wccId,
      linkUrl: `/procurement/work-completion/${wccId}`,
      priority: 'LOW',
    })
  );

  await Promise.all(createPromises);
}
