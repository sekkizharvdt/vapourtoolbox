/**
 * Feedback Cloud Functions
 *
 * Handles feedback-related triggers:
 * - When feedback is marked as 'resolved', creates a task notification
 *   for the reporter to verify and close or follow up.
 */

import { onDocumentUpdated } from 'firebase-functions/v2/firestore';
import { logger } from 'firebase-functions/v2';
import * as admin from 'firebase-admin';

/**
 * Feedback document structure
 */
interface FeedbackData {
  type: 'bug' | 'feature' | 'general';
  status: 'new' | 'in_progress' | 'resolved' | 'closed' | 'wont_fix';
  title: string;
  description: string;
  userName: string;
  userEmail: string;
  userId?: string;
  adminNotes?: string;
  createdAt: admin.firestore.Timestamp;
  updatedAt?: admin.firestore.Timestamp;
}

/**
 * Task notification input for creating tasks
 */
interface TaskNotificationData {
  type: 'actionable' | 'informational';
  category: string;
  userId: string;
  assignedBy?: string;
  assignedByName?: string;
  title: string;
  message: string;
  priority: 'LOW' | 'MEDIUM' | 'HIGH' | 'URGENT';
  entityType: string;
  entityId: string;
  linkUrl: string;
  autoCompletable: boolean;
  status: 'pending';
  read: boolean;
  completionConfirmed: boolean;
  metadata?: Record<string, unknown>;
  createdAt: admin.firestore.Timestamp;
}

/**
 * On Feedback Updated - Create Resolution Check Task
 *
 * When feedback status changes to 'resolved':
 * 1. Look up the reporter's userId (if they were logged in)
 * 2. Create an actionable task in the taskNotifications collection
 * 3. Task links to feedback page for verification
 *
 * If no userId is available (anonymous feedback), skip task creation.
 */
export const onFeedbackResolved = onDocumentUpdated('feedback/{feedbackId}', async (event) => {
  const feedbackId = event.params.feedbackId;
  const beforeData = event.data?.before.data() as FeedbackData | undefined;
  const afterData = event.data?.after.data() as FeedbackData | undefined;

  if (!beforeData || !afterData) {
    logger.warn(`Missing data for feedback ${feedbackId}`);
    return null;
  }

  // Only trigger when status changes TO 'resolved'
  if (beforeData.status === afterData.status || afterData.status !== 'resolved') {
    return null;
  }

  logger.info(`Feedback ${feedbackId} marked as resolved`, {
    title: afterData.title,
    userName: afterData.userName,
    previousStatus: beforeData.status,
  });

  // Check if we have a userId for the reporter
  if (!afterData.userId) {
    logger.info(`No userId for feedback ${feedbackId}, skipping task creation`, {
      userEmail: afterData.userEmail,
    });
    // Still want to track this, but can't create a task without userId
    return null;
  }

  try {
    // Create task notification for the reporter
    const taskData: TaskNotificationData = {
      type: 'actionable',
      category: 'FEEDBACK_RESOLUTION_CHECK',
      userId: afterData.userId,
      assignedBy: 'system',
      assignedByName: 'Support Team',
      title: `Review Fix: ${afterData.title}`,
      message: afterData.adminNotes
        ? `Your reported issue has been resolved: "${afterData.adminNotes}". Please verify and close or provide follow-up.`
        : `Your reported issue "${afterData.title}" has been resolved. Please verify and close or provide follow-up.`,
      priority: 'MEDIUM',
      entityType: 'FEEDBACK',
      entityId: feedbackId,
      linkUrl: `/feedback/${feedbackId}`,
      autoCompletable: true,
      status: 'pending',
      read: false,
      completionConfirmed: false,
      metadata: {
        feedbackTitle: afterData.title,
        feedbackType: afterData.type,
        reporterName: afterData.userName,
        reporterEmail: afterData.userEmail,
        resolutionNotes: afterData.adminNotes,
      },
      createdAt: admin.firestore.Timestamp.now(),
    };

    const taskRef = await admin.firestore().collection('taskNotifications').add(taskData);

    logger.info(`Created resolution check task for feedback ${feedbackId}`, {
      taskId: taskRef.id,
      userId: afterData.userId,
    });

    return { taskId: taskRef.id };
  } catch (error) {
    logger.error(`Error creating task for feedback ${feedbackId}:`, error);
    return null;
  }
});
