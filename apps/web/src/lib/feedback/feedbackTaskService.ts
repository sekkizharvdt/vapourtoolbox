/**
 * Feedback Task Service
 *
 * Creates and manages tasks for feedback resolution follow-ups.
 * When feedback is resolved, a task is created for the reporter to verify
 * the fix and either close the feedback or provide follow-up comments.
 */

import { doc, updateDoc, getDoc, Timestamp, arrayUnion, type Firestore } from 'firebase/firestore';
import { createLogger } from '@vapour/logger';
import { createTaskNotification } from '@/lib/tasks/taskNotificationService';

const logger = createLogger({ context: 'feedbackTaskService' });

/**
 * Feedback document structure (from MCP server)
 */
interface FeedbackDocument {
  id: string;
  type: 'bug' | 'feature' | 'general';
  status: 'new' | 'in_progress' | 'resolved' | 'closed' | 'wont_fix';
  title: string;
  description: string;
  userName: string;
  userEmail: string;
  userId?: string; // Firebase Auth UID if user was logged in
  adminNotes?: string;
  followUpComments?: FollowUpComment[];
  createdAt: Timestamp;
  updatedAt?: Timestamp;
}

/**
 * Follow-up comment structure
 */
interface FollowUpComment {
  userId: string;
  userName: string;
  comment: string;
  createdAt: Timestamp;
}

/**
 * Create a resolution check task for the feedback reporter
 *
 * Called when feedback status changes to 'resolved'.
 * Creates an actionable task in the Flow module for the reporter
 * to verify the fix and close or follow up.
 */
export async function createFeedbackResolutionTask(
  feedbackId: string,
  feedbackTitle: string,
  reporterUserId: string,
  reporterName: string,
  resolvedByName: string,
  resolutionNotes?: string
): Promise<string> {
  try {
    const taskId = await createTaskNotification({
      type: 'actionable',
      category: 'FEEDBACK_RESOLUTION_CHECK',
      userId: reporterUserId,
      assignedBy: 'system',
      assignedByName: resolvedByName,
      title: `Review Fix: ${feedbackTitle}`,
      message: resolutionNotes
        ? `Your reported issue has been resolved by ${resolvedByName}: "${resolutionNotes}". Please verify and close or provide follow-up.`
        : `Your reported issue "${feedbackTitle}" has been resolved by ${resolvedByName}. Please verify and close or provide follow-up.`,
      entityType: 'FEEDBACK',
      entityId: feedbackId,
      linkUrl: `/feedback/${feedbackId}`,
      priority: 'MEDIUM',
      autoCompletable: true,
      metadata: {
        feedbackTitle,
        reporterName,
        resolvedByName,
        resolutionNotes,
      },
    });

    logger.info('Created feedback resolution task', {
      taskId,
      feedbackId,
      reporterUserId,
    });

    return taskId;
  } catch (error) {
    logger.error('Error creating feedback resolution task', { feedbackId, error });
    throw error;
  }
}

/**
 * Add a follow-up comment to feedback when reporter is not satisfied
 *
 * Changes feedback status back to 'in_progress' and notifies admin.
 */
export async function addFollowUpToFeedback(
  db: Firestore,
  feedbackId: string,
  followUpComment: string,
  userId: string,
  userName: string
): Promise<void> {
  try {
    const feedbackRef = doc(db, 'feedback', feedbackId);
    const feedbackSnap = await getDoc(feedbackRef);

    if (!feedbackSnap.exists()) {
      throw new Error('Feedback not found');
    }

    const comment: FollowUpComment = {
      userId,
      userName,
      comment: followUpComment,
      createdAt: Timestamp.now(),
    };

    await updateDoc(feedbackRef, {
      status: 'in_progress',
      followUpComments: arrayUnion(comment),
      updatedAt: Timestamp.now(),
    });

    // Create informational notification for admins about the follow-up
    // Note: This would need an admin user ID or role-based notification
    // For now, we'll log it and the admin can see it in the feedback list

    logger.info('Added follow-up comment to feedback', {
      feedbackId,
      userId,
      comment: followUpComment.substring(0, 100),
    });
  } catch (error) {
    logger.error('Error adding follow-up to feedback', { feedbackId, error });
    throw error;
  }
}

/**
 * Close feedback when reporter confirms the issue is resolved
 *
 * Changes feedback status to 'closed' and completes the associated task.
 */
export async function closeFeedbackFromTask(
  db: Firestore,
  feedbackId: string,
  userId: string,
  userName: string
): Promise<void> {
  try {
    const feedbackRef = doc(db, 'feedback', feedbackId);
    const feedbackSnap = await getDoc(feedbackRef);

    if (!feedbackSnap.exists()) {
      throw new Error('Feedback not found');
    }

    await updateDoc(feedbackRef, {
      status: 'closed',
      closedAt: Timestamp.now(),
      closedBy: userId,
      closedByName: userName,
      updatedAt: Timestamp.now(),
    });

    logger.info('Feedback closed by reporter', {
      feedbackId,
      userId,
    });
  } catch (error) {
    logger.error('Error closing feedback', { feedbackId, error });
    throw error;
  }
}

/**
 * Get feedback document by ID
 */
export async function getFeedbackById(
  db: Firestore,
  feedbackId: string
): Promise<FeedbackDocument | null> {
  try {
    const feedbackRef = doc(db, 'feedback', feedbackId);
    const feedbackSnap = await getDoc(feedbackRef);

    if (!feedbackSnap.exists()) {
      return null;
    }

    // eslint-disable-next-line @typescript-eslint/consistent-type-assertions
    return {
      id: feedbackSnap.id,
      ...feedbackSnap.data(),
    } as FeedbackDocument;
  } catch (error) {
    logger.error('Error getting feedback', { feedbackId, error });
    throw error;
  }
}
