/**
 * Notification Helper Functions
 *
 * Convenience functions for creating specific types of notifications
 */

import { createTaskNotification } from '@/lib/tasks/taskNotificationService';

/**
 * Create PR submitted notification for Engineering Head
 */
export async function notifyPRSubmitted(
  engineeringHeadUserId: string,
  prNumber: string,
  prId: string,
  submitterName: string
): Promise<void> {
  await createTaskNotification({
    type: 'actionable',
    category: 'PR_SUBMITTED',
    userId: engineeringHeadUserId,
    title: `Purchase Request ${prNumber} Submitted`,
    message: `${submitterName} submitted a purchase request for your review`,
    entityType: 'PURCHASE_REQUEST',
    entityId: prId,
    linkUrl: `/procurement/engineering-approval`,
    priority: 'MEDIUM',
    autoCompletable: true,
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
  await createTaskNotification({
    type: 'informational',
    category: 'PR_APPROVED',
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
  await createTaskNotification({
    type: 'informational',
    category: 'PR_REJECTED',
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

  await createTaskNotification({
    type: 'informational',
    category: 'PR_COMMENTED',
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
    createTaskNotification({
      type: 'informational',
      category: 'RFQ_CREATED',
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
  await createTaskNotification({
    type: 'informational',
    category: 'OFFER_UPLOADED',
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
  await createTaskNotification({
    type: 'actionable',
    category: 'PO_PENDING_APPROVAL',
    userId: directorUserId,
    title: `Purchase Order ${poNumber} Awaiting Approval`,
    message: `${creatorName} submitted a PO for ₹${amount.toLocaleString('en-IN')} for your approval`,
    entityType: 'PURCHASE_ORDER',
    entityId: poId,
    linkUrl: `/procurement/purchase-orders/approve`,
    priority: 'HIGH',
    autoCompletable: true,
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
  await createTaskNotification({
    type: 'informational',
    category: 'PO_APPROVED',
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
  await createTaskNotification({
    type: 'informational',
    category: 'PO_REJECTED',
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
    createTaskNotification({
      type: 'informational',
      category: 'GOODS_RECEIVED',
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
    createTaskNotification({
      type: 'actionable',
      category: 'PAYMENT_REQUESTED',
      userId,
      title: `Payment Request for PO ${poNumber}`,
      message: `Payment of ₹${amount.toLocaleString('en-IN')} requested`,
      entityType: 'PURCHASE_ORDER',
      entityId: poId,
      linkUrl: `/procurement/purchase-orders/${poId}`,
      priority: 'MEDIUM',
      autoCompletable: true,
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
    createTaskNotification({
      type: 'informational',
      category: 'WCC_ISSUED',
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
