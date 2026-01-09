/**
 * Activity Service
 *
 * Fetches user-specific activity data for the dashboard
 * Provides "Today's Focus" items and recent activity
 */

import {
  collection,
  query,
  where,
  orderBy,
  limit,
  getDocs,
  Timestamp,
  getCountFromServer,
} from 'firebase/firestore';
import { getFirebase } from '@/lib/firebase';
import { createLogger } from '@vapour/logger';

const logger = createLogger({ context: 'ActivityService' });

/**
 * Action item for "Today's Focus" section
 */
export interface ActionItem {
  id: string;
  type:
    | 'task'
    | 'proposal_review'
    | 'po_approval'
    | 'pr_approval'
    | 'bill_approval'
    | 'invoice_pending'
    | 'document_review'
    | 'mention'
    | 'rfq_response'
    | 'leave_approval';
  title: string;
  description?: string;
  priority: 'urgent' | 'high' | 'medium' | 'low';
  dueDate?: Date;
  link: string;
  metadata?: Record<string, unknown>;
}

/**
 * Recent activity item
 */
export interface ActivityItem {
  id: string;
  type: string;
  action: string;
  title: string;
  timestamp: Date;
  userId: string;
  userName?: string;
  link?: string;
}

/**
 * Dashboard summary counts
 */
export interface DashboardSummary {
  tasksToday: number;
  pendingApprovals: number;
  unreadMentions: number;
  overdueItems: number;
}

/**
 * Get action items for "Today's Focus" section
 */
export async function getActionItems(userId: string): Promise<ActionItem[]> {
  const { db } = getFirebase();
  const items: ActionItem[] = [];

  try {
    // 1. Get user's pending tasks (Flow)
    const pendingTasksQuery = query(
      collection(db, 'taskNotifications'),
      where('assigneeId', '==', userId),
      where('status', 'in', ['pending', 'in_progress']),
      orderBy('priority', 'desc'),
      limit(5)
    );

    try {
      const tasksSnapshot = await getDocs(pendingTasksQuery);
      tasksSnapshot.docs.forEach((doc) => {
        const data = doc.data();
        items.push({
          id: doc.id,
          type: 'task',
          title: data.title || 'Untitled Task',
          description: data.description,
          priority: mapPriority(data.priority),
          dueDate: data.dueDate?.toDate(),
          link: `/flow?task=${doc.id}`,
          metadata: { projectId: data.projectId },
        });
      });
    } catch (err) {
      logger.warn('Failed to fetch pending tasks', { error: err });
    }

    // 2. Get unread mentions
    const mentionsQuery = query(
      collection(db, 'taskMentions'),
      where('mentionedUserId', '==', userId),
      where('read', '==', false),
      orderBy('createdAt', 'desc'),
      limit(3)
    );

    try {
      const mentionsSnapshot = await getDocs(mentionsQuery);
      mentionsSnapshot.docs.forEach((doc) => {
        const data = doc.data();
        items.push({
          id: doc.id,
          type: 'mention',
          title: `${data.mentionedByName || 'Someone'} mentioned you`,
          description: data.messagePreview,
          priority: 'high',
          link: `/flow?channel=${data.channelId}&message=${data.messageId}`,
          metadata: { channelId: data.channelId },
        });
      });
    } catch (err) {
      logger.warn('Failed to fetch mentions', { error: err });
    }

    // 3. Get pending PO approvals (for approvers)
    const pendingPOsQuery = query(
      collection(db, 'purchaseOrders'),
      where('status', '==', 'PENDING_APPROVAL'),
      where('approverId', '==', userId),
      limit(3)
    );

    try {
      const posSnapshot = await getDocs(pendingPOsQuery);
      posSnapshot.docs.forEach((doc) => {
        const data = doc.data();
        items.push({
          id: doc.id,
          type: 'po_approval',
          title: `Approve PO ${data.poNumber}`,
          description: `${data.vendorName} - ${data.totalAmount?.toLocaleString() || ''}`,
          priority: 'high',
          link: `/procurement/pos/${doc.id}`,
          metadata: { poNumber: data.poNumber },
        });
      });
    } catch (err) {
      logger.warn('Failed to fetch pending POs', { error: err });
    }

    // 4. Get pending PR approvals (for approvers)
    const pendingPRsQuery = query(
      collection(db, 'purchaseRequests'),
      where('status', '==', 'PENDING_APPROVAL'),
      where('approverId', '==', userId),
      limit(3)
    );

    try {
      const prsSnapshot = await getDocs(pendingPRsQuery);
      prsSnapshot.docs.forEach((doc) => {
        const data = doc.data();
        items.push({
          id: doc.id,
          type: 'pr_approval',
          title: `Approve PR ${data.prNumber}`,
          description: data.description,
          priority: 'medium',
          link: `/procurement/purchase-requests/${doc.id}`,
          metadata: { prNumber: data.prNumber },
        });
      });
    } catch (err) {
      logger.warn('Failed to fetch pending PRs', { error: err });
    }

    // 5. Get proposals awaiting review
    const pendingProposalsQuery = query(
      collection(db, 'proposals'),
      where('status', 'in', ['DRAFT', 'INTERNAL_REVIEW']),
      where('createdBy', '==', userId),
      limit(3)
    );

    try {
      const proposalsSnapshot = await getDocs(pendingProposalsQuery);
      proposalsSnapshot.docs.forEach((doc) => {
        const data = doc.data();
        items.push({
          id: doc.id,
          type: 'proposal_review',
          title: `Complete proposal: ${data.title || data.proposalNumber}`,
          description: data.customerName,
          priority: 'medium',
          link: `/proposals/${doc.id}`,
          metadata: { proposalNumber: data.proposalNumber },
        });
      });
    } catch (err) {
      logger.warn('Failed to fetch pending proposals', { error: err });
    }

    // 6. Get pending bill approvals (for approvers)
    const pendingBillsQuery = query(
      collection(db, 'vendorBills'),
      where('status', '==', 'PENDING_APPROVAL'),
      where('assignedApproverId', '==', userId),
      limit(3)
    );

    try {
      const billsSnapshot = await getDocs(pendingBillsQuery);
      billsSnapshot.docs.forEach((doc) => {
        const data = doc.data();
        items.push({
          id: doc.id,
          type: 'bill_approval',
          title: `Approve Bill ${data.billNumber}`,
          description: `${data.entityName} - ₹${data.total?.toLocaleString('en-IN') || ''}`,
          priority: 'high',
          dueDate: data.dueDate?.toDate(),
          link: `/accounting/bills/${doc.id}`,
          metadata: { billNumber: data.billNumber },
        });
      });
    } catch (err) {
      logger.warn('Failed to fetch pending bills', { error: err });
    }

    // 7. Get pending leave approvals (for approvers/managers)
    const pendingLeavesQuery = query(
      collection(db, 'leaveRequests'),
      where('status', '==', 'PENDING'),
      where('approverId', '==', userId),
      limit(3)
    );

    try {
      const leavesSnapshot = await getDocs(pendingLeavesQuery);
      leavesSnapshot.docs.forEach((doc) => {
        const data = doc.data();
        items.push({
          id: doc.id,
          type: 'leave_approval',
          title: `Approve Leave: ${data.employeeName || 'Employee'}`,
          description: `${data.leaveType} - ${data.days} day(s)`,
          priority: 'medium',
          link: `/hr/leaves/${doc.id}`,
          metadata: { leaveType: data.leaveType },
        });
      });
    } catch (err) {
      logger.warn('Failed to fetch pending leaves', { error: err });
    }

    // Sort by priority
    const priorityOrder = { urgent: 0, high: 1, medium: 2, low: 3 };
    items.sort((a, b) => priorityOrder[a.priority] - priorityOrder[b.priority]);

    return items.slice(0, 10); // Limit to 10 items
  } catch (error) {
    logger.error('Failed to fetch action items', { error });
    return [];
  }
}

/**
 * Get dashboard summary counts
 */
export async function getDashboardSummary(userId: string): Promise<DashboardSummary> {
  const { db } = getFirebase();

  const summary: DashboardSummary = {
    tasksToday: 0,
    pendingApprovals: 0,
    unreadMentions: 0,
    overdueItems: 0,
  };

  try {
    // Tasks due today
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const tomorrow = new Date(today);
    tomorrow.setDate(tomorrow.getDate() + 1);

    try {
      const tasksTodayQuery = query(
        collection(db, 'taskNotifications'),
        where('assigneeId', '==', userId),
        where('status', 'in', ['pending', 'in_progress']),
        where('dueDate', '>=', Timestamp.fromDate(today)),
        where('dueDate', '<', Timestamp.fromDate(tomorrow))
      );
      const tasksTodaySnapshot = await getCountFromServer(tasksTodayQuery);
      summary.tasksToday = tasksTodaySnapshot.data().count;
    } catch (err) {
      logger.warn('Failed to count tasks today', { error: err });
    }

    // Pending approvals (POs + PRs + Bills + Leaves)
    try {
      const pendingPOsQuery = query(
        collection(db, 'purchaseOrders'),
        where('status', '==', 'PENDING_APPROVAL'),
        where('approverId', '==', userId)
      );
      const pendingPOsSnapshot = await getCountFromServer(pendingPOsQuery);

      const pendingPRsQuery = query(
        collection(db, 'purchaseRequests'),
        where('status', '==', 'PENDING_APPROVAL'),
        where('approverId', '==', userId)
      );
      const pendingPRsSnapshot = await getCountFromServer(pendingPRsQuery);

      const pendingBillsQuery = query(
        collection(db, 'vendorBills'),
        where('status', '==', 'PENDING_APPROVAL'),
        where('assignedApproverId', '==', userId)
      );
      const pendingBillsSnapshot = await getCountFromServer(pendingBillsQuery);

      const pendingLeavesQuery = query(
        collection(db, 'leaveRequests'),
        where('status', '==', 'PENDING'),
        where('approverId', '==', userId)
      );
      const pendingLeavesSnapshot = await getCountFromServer(pendingLeavesQuery);

      summary.pendingApprovals =
        pendingPOsSnapshot.data().count +
        pendingPRsSnapshot.data().count +
        pendingBillsSnapshot.data().count +
        pendingLeavesSnapshot.data().count;
    } catch (err) {
      logger.warn('Failed to count pending approvals', { error: err });
    }

    // Unread mentions
    try {
      const unreadMentionsQuery = query(
        collection(db, 'taskMentions'),
        where('mentionedUserId', '==', userId),
        where('read', '==', false)
      );
      const unreadMentionsSnapshot = await getCountFromServer(unreadMentionsQuery);
      summary.unreadMentions = unreadMentionsSnapshot.data().count;
    } catch (err) {
      logger.warn('Failed to count unread mentions', { error: err });
    }

    // Overdue items
    try {
      const overdueTasksQuery = query(
        collection(db, 'taskNotifications'),
        where('assigneeId', '==', userId),
        where('status', 'in', ['pending', 'in_progress']),
        where('dueDate', '<', Timestamp.fromDate(today))
      );
      const overdueTasksSnapshot = await getCountFromServer(overdueTasksQuery);
      summary.overdueItems = overdueTasksSnapshot.data().count;
    } catch (err) {
      logger.warn('Failed to count overdue items', { error: err });
    }

    return summary;
  } catch (error) {
    logger.error('Failed to fetch dashboard summary', { error });
    return summary;
  }
}

/**
 * Get recent activity across all modules
 */
export async function getRecentActivity(userId: string, limitCount = 10): Promise<ActivityItem[]> {
  const { db } = getFirebase();
  const activities: ActivityItem[] = [];

  try {
    // Get recent audit logs for this user (actorId is the user who performed the action)
    const auditQuery = query(
      collection(db, 'auditLogs'),
      where('actorId', '==', userId),
      orderBy('timestamp', 'desc'),
      limit(limitCount)
    );

    try {
      const auditSnapshot = await getDocs(auditQuery);
      auditSnapshot.docs.forEach((doc) => {
        const data = doc.data();
        activities.push({
          id: doc.id,
          type: data.entityType || 'system',
          action: data.action || 'unknown',
          title: data.description || `${data.action} ${data.entityType}`,
          timestamp: data.timestamp?.toDate() || new Date(),
          userId: data.userId,
          userName: data.userName,
          link: data.entityId ? `/${data.entityType}s/${data.entityId}` : undefined,
        });
      });
    } catch (err) {
      logger.warn('Failed to fetch audit logs', { error: err });
    }

    // Sort by timestamp
    activities.sort((a, b) => b.timestamp.getTime() - a.timestamp.getTime());

    return activities.slice(0, limitCount);
  } catch (error) {
    logger.error('Failed to fetch recent activity', { error });
    return [];
  }
}

/**
 * Map task priority to standard priority levels
 */
function mapPriority(priority: string | number | undefined): 'urgent' | 'high' | 'medium' | 'low' {
  if (typeof priority === 'number') {
    if (priority >= 4) return 'urgent';
    if (priority >= 3) return 'high';
    if (priority >= 2) return 'medium';
    return 'low';
  }

  const normalizedPriority = (priority || '').toUpperCase();
  switch (normalizedPriority) {
    case 'URGENT':
    case 'CRITICAL':
      return 'urgent';
    case 'HIGH':
      return 'high';
    case 'MEDIUM':
    case 'NORMAL':
      return 'medium';
    default:
      return 'low';
  }
}
