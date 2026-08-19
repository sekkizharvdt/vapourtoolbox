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
  /** Display name of whoever last wrote adminNotes; written by the admin UI. */
  adminNotesBy?: string;
  /** Uid of whoever last wrote adminNotes, so we can skip self-notification. */
  adminNotesByUserId?: string;
  createdAt: admin.firestore.Timestamp;
  updatedAt?: admin.firestore.Timestamp;
}

/** Trim a note down for the one-line notification message. */
function truncate(text: string, max: number): string {
  return text.length <= max ? text : `${text.slice(0, max).trimEnd()}…`;
}

/**
 * Short stable digest of a note, used in the task id so a retried trigger is a
 * no-op but a genuinely new note still notifies. Not security-sensitive.
 */
function hashNotes(text: string): string {
  let h = 5381;
  for (let i = 0; i < text.length; i++) {
    h = ((h << 5) + h + text.charCodeAt(i)) | 0;
  }
  return (h >>> 0).toString(36);
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

    // Deterministic id keyed on the feedback doc: Firestore triggers are
    // at-least-once, so a retried event must not create a second task. `create()`
    // throws ALREADY_EXISTS on a duplicate, which we treat as a no-op success.
    const taskId = `feedback-resolution-${feedbackId}`;
    const taskRef = admin.firestore().collection('taskNotifications').doc(taskId);
    try {
      await taskRef.create(taskData);
    } catch (createErr) {
      if ((createErr as { code?: number }).code === 6) {
        // ALREADY_EXISTS — a task for this resolution already exists.
        logger.info(`Resolution task already exists for feedback ${feedbackId}, skipping`, {
          taskId,
        });
        return { taskId };
      }
      throw createErr;
    }

    logger.info(`Created resolution check task for feedback ${feedbackId}`, {
      taskId,
      userId: afterData.userId,
    });

    return { taskId };
  } catch (error) {
    logger.error(`Error creating task for feedback ${feedbackId}:`, error);
    return null;
  }
});

/**
 * On Admin Notes Updated — Notify the Reporter
 *
 * The reporter only ever heard from us when an item flipped to 'resolved'.
 * Notes added while an item was still 'new' or 'in_progress' — questions,
 * progress updates, "please retest" — reached nobody unless they happened to
 * reopen the feedback page themselves.
 *
 * The admin UI used to fire this notification itself, which meant any write
 * that did not go through that one screen (a script, a Cloud Function, a future
 * integration) silently skipped it. Doing it on the trigger makes it
 * unconditional: notes change, the reporter is told, no matter who wrote them.
 *
 * Skipped when:
 * - the same write also resolves the item (onFeedbackResolved already carries
 *   the notes, and firing both would double-notify)
 * - the reporter is anonymous, or is the same person who wrote the note
 * - the notes were cleared rather than written
 */
export const onFeedbackNotesUpdated = onDocumentUpdated('feedback/{feedbackId}', async (event) => {
  const feedbackId = event.params.feedbackId;
  const before = event.data?.before.data() as FeedbackData | undefined;
  const after = event.data?.after.data() as FeedbackData | undefined;

  if (!before || !after) {
    logger.warn(`Missing data for feedback ${feedbackId}`);
    return null;
  }

  const notes = (after.adminNotes ?? '').trim();
  if ((before.adminNotes ?? '') === (after.adminNotes ?? '') || !notes) return null;

  // onFeedbackResolved owns this write — it sends the notes with it.
  if (before.status !== after.status && after.status === 'resolved') return null;

  if (!after.userId) {
    logger.info(`No userId for feedback ${feedbackId}, skipping notes notification`);
    return null;
  }

  // Whoever triages their own report should not be told about their own note.
  if (after.adminNotesByUserId && after.adminNotesByUserId === after.userId) return null;

  const author = after.adminNotesBy || 'The team';

  try {
    const taskData: TaskNotificationData = {
      type: 'actionable',
      category: 'FEEDBACK_QUESTION_ASKED',
      userId: after.userId,
      assignedBy: after.adminNotesByUserId ?? 'system',
      assignedByName: author,
      title: `Update on: ${after.title}`,
      message: `${author} has added a note to your report: "${truncate(notes, 200)}" Open it to read the full note and reply with the Follow-up button.`,
      priority: 'MEDIUM',
      entityType: 'FEEDBACK',
      entityId: feedbackId,
      linkUrl: `/feedback/${feedbackId}`,
      autoCompletable: true,
      status: 'pending',
      read: false,
      completionConfirmed: false,
      metadata: {
        feedbackTitle: after.title,
        feedbackType: after.type,
        noteAuthor: author,
      },
      createdAt: admin.firestore.Timestamp.now(),
    };

    // Firestore triggers are at-least-once. Key the task on the CONTENT of the
    // note, so a retried event is a no-op but a genuinely new note still
    // notifies. `create()` throws ALREADY_EXISTS (code 6) on a duplicate.
    const taskId = `feedback-note-${feedbackId}-${hashNotes(notes)}`;
    const taskRef = admin.firestore().collection('taskNotifications').doc(taskId);
    try {
      await taskRef.create(taskData);
    } catch (createErr) {
      if ((createErr as { code?: number }).code === 6) {
        logger.info(`Note task already exists for feedback ${feedbackId}, skipping`, { taskId });
        return { taskId };
      }
      throw createErr;
    }

    logger.info(`Notified reporter of note on feedback ${feedbackId}`, {
      taskId,
      userId: after.userId,
    });
    return { taskId };
  } catch (error) {
    logger.error(`Error creating note task for feedback ${feedbackId}:`, error);
    return null;
  }
});
