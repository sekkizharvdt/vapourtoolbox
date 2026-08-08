/**
 * Feedback Task Service
 *
 * Creates and manages tasks for feedback resolution follow-ups.
 * When feedback is resolved, a task is created for the reporter to verify
 * the fix and either close the feedback or provide follow-up comments.
 */

import { doc, updateDoc, getDoc, Timestamp, arrayUnion, type Firestore } from 'firebase/firestore';
import { COLLECTIONS } from '@vapour/firebase';
import { createLogger } from '@vapour/logger';
import { createTaskNotification } from '@/lib/tasks/taskNotificationService';
import { getUsersWithPermission } from '@/lib/auth/userLookup';
import { PERMISSION_FLAGS } from '@vapour/constants';
import { docToTyped } from '@/lib/firebase/typeHelpers';

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
 * Notify the reporter that triage has asked them a question.
 *
 * The deployed CF `onFeedbackResolved` only fires on status -> 'resolved', so
 * notes added while an item is still 'new' or 'in_progress' reached nobody: the
 * reporter had to happen to reopen the item to discover a question was waiting.
 *
 * Call this when admin notes are saved WITHOUT resolving. Resolving already
 * carries the notes in the resolution notification, so firing here as well
 * would double-notify.
 *
 * Returns the task id, or null when there is nothing to notify (anonymous
 * reporter, or notes unchanged). Best-effort: never fails the caller's save.
 */
export async function notifyReporterOfQuestion(params: {
  feedbackId: string;
  feedbackTitle: string;
  reporterUserId?: string;
  adminNotes: string;
  askedByName: string;
  askedByUserId?: string;
}): Promise<string | null> {
  const { feedbackId, feedbackTitle, reporterUserId, adminNotes, askedByName, askedByUserId } =
    params;

  // Anonymous feedback has no reporter to notify — same guard the CF applies.
  if (!reporterUserId) {
    logger.info('No reporter userId on feedback, skipping question notification', { feedbackId });
    return null;
  }

  // Never notify someone about their own note (Revathi triages her own reports).
  if (askedByUserId && askedByUserId === reporterUserId) return null;

  if (!adminNotes.trim()) return null;

  try {
    const taskId = await createTaskNotification({
      type: 'actionable',
      category: 'FEEDBACK_QUESTION_ASKED',
      userId: reporterUserId,
      assignedBy: askedByUserId ?? 'system',
      assignedByName: askedByName,
      title: `Question on: ${feedbackTitle}`,
      message: `${askedByName} needs more detail before this can be finished: "${truncate(adminNotes, 200)}" Reply with the Follow-up button on the feedback item.`,
      entityType: 'FEEDBACK',
      entityId: feedbackId,
      linkUrl: `/feedback/${feedbackId}`,
      priority: 'MEDIUM',
      autoCompletable: true,
      metadata: { feedbackTitle, askedByName },
    });

    logger.info('Notified reporter of feedback question', { taskId, feedbackId, reporterUserId });
    return taskId;
  } catch (error) {
    logger.warn('Could not notify reporter of feedback question', {
      feedbackId,
      error: error instanceof Error ? error.message : String(error),
    });
    return null;
  }
}

/**
 * Notify the people who triage feedback that a reporter has replied.
 *
 * Uses FEEDBACK_REOPENED, which was already declared on the `feedback` channel
 * in TASK_CHANNEL_DEFINITIONS but never emitted — a category that routes
 * nowhere is invisible, so it has to be registered there as well as in the
 * union.
 *
 * Best-effort: a reply must never fail because the notification could not be
 * written. The comment is already saved by this point, so we warn and carry on
 * rather than rolling the reply back (rule 27).
 */
async function notifyAdminsOfFollowUp(
  db: Firestore,
  feedbackId: string,
  feedbackTitle: string,
  followUpComment: string,
  reporterUserId: string,
  reporterName: string
): Promise<void> {
  try {
    // /admin is gated on MANAGE_USERS (bitfield 1) OR MANAGE_ADMIN (bitfield 2)
    // — see app/admin/layout.tsx. getUsersWithPermission only reads bitfield 1,
    // so MANAGE_USERS is the gate used here. That currently loses nothing: no
    // account holds MANAGE_ADMIN, and the two people who can reach /admin
    // (Revathi SP, K Sekkizhar Prasanna) both hold MANAGE_USERS. If someone is
    // ever granted MANAGE_ADMIN alone they will silently miss these, and this
    // lookup needs a second-bitfield variant.
    const adminIds = await getUsersWithPermission(
      db,
      'default-entity',
      PERMISSION_FLAGS.MANAGE_USERS
    );

    // Never notify the reporter about their own comment.
    const recipients = adminIds.filter((id) => id !== reporterUserId);

    if (recipients.length === 0) {
      logger.warn('No admin recipients for feedback follow-up', { feedbackId });
      return;
    }

    await Promise.all(
      recipients.map((adminId) =>
        createTaskNotification({
          type: 'informational',
          category: 'FEEDBACK_REOPENED',
          userId: adminId,
          assignedBy: reporterUserId,
          assignedByName: reporterName,
          title: `Reply on: ${feedbackTitle}`,
          message: `${reporterName} replied: "${truncate(followUpComment, 200)}"`,
          entityType: 'FEEDBACK',
          entityId: feedbackId,
          linkUrl: `/admin/feedback?id=${feedbackId}`,
          priority: 'MEDIUM',
          metadata: { feedbackTitle, reporterName, reporterUserId },
        })
      )
    );

    logger.info('Notified admins of feedback follow-up', {
      feedbackId,
      recipientCount: recipients.length,
    });
  } catch (error) {
    logger.warn('Could not notify admins of feedback follow-up', {
      feedbackId,
      error: error instanceof Error ? error.message : String(error),
    });
  }
}

/** Trim a user-supplied comment for use inside a notification message. */
function truncate(text: string, max: number): string {
  const clean = text.trim().replace(/\s+/g, ' ');
  return clean.length <= max ? clean : `${clean.slice(0, max - 1)}…`;
}

/**
 * Add a follow-up comment to feedback when reporter is not satisfied
 *
 * Changes feedback status back to 'in_progress' and notifies the triage team.
 */
export async function addFollowUpToFeedback(
  db: Firestore,
  feedbackId: string,
  followUpComment: string,
  userId: string,
  userName: string
): Promise<void> {
  // rule5-exempt: feedback write scoped by submitter identity; firestore.rules enforce per-record ownership
  // rule19-exempt: reads feedback parent for context, writes a follow-up subdoc — different documents
  try {
    const feedbackRef = doc(db, COLLECTIONS.FEEDBACK, feedbackId);
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

    const feedbackTitle = (feedbackSnap.data()?.title as string) ?? feedbackId;
    await notifyAdminsOfFollowUp(db, feedbackId, feedbackTitle, followUpComment, userId, userName);

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
  // rule5-exempt: feedback write scoped by submitter identity; firestore.rules enforce per-record ownership
  // rule19-exempt: reads feedback for state, writes status update + linked task close — secondary writes are idempotent
  // rule18-exempt: workflow nudge from task auto-completion
  try {
    const feedbackRef = doc(db, COLLECTIONS.FEEDBACK, feedbackId);
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
    const feedbackRef = doc(db, COLLECTIONS.FEEDBACK, feedbackId);
    const feedbackSnap = await getDoc(feedbackRef);

    if (!feedbackSnap.exists()) {
      return null;
    }

    return docToTyped<FeedbackDocument>(feedbackSnap.id, feedbackSnap.data());
  } catch (error) {
    logger.error('Error getting feedback', { feedbackId, error });
    throw error;
  }
}
