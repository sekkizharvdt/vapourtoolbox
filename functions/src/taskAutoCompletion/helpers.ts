/**
 * Task Auto-Completion Helpers
 *
 * Shared utilities for auto-completing task notifications
 * based on workflow state changes
 */

import { getFirestore, Timestamp } from 'firebase-admin/firestore';
import { logger } from 'firebase-functions/v2';

const db = getFirestore();

// Collection name (matches COLLECTIONS.TASK_NOTIFICATIONS from packages/firebase)
const TASK_NOTIFICATIONS_COLLECTION = 'taskNotifications';

/**
 * Task Notification status type
 */
export type TaskNotificationStatus = 'pending' | 'acknowledged' | 'in_progress' | 'completed';

/**
 * Find task notification by entity
 * Useful for auto-completion logic (e.g., find "Review PR-001" task when PR is approved)
 */
export async function findTaskNotificationByEntity(
  entityType: string,
  entityId: string,
  category?: string,
  status?: TaskNotificationStatus | TaskNotificationStatus[]
): Promise<{ id: string; userId: string } | null> {
  try {
    let query = db
      .collection(TASK_NOTIFICATIONS_COLLECTION)
      .where('entityType', '==', entityType)
      .where('entityId', '==', entityId);

    if (category) {
      query = query.where('category', '==', category);
    }

    if (status) {
      if (Array.isArray(status)) {
        query = query.where('status', 'in', status);
      } else {
        query = query.where('status', '==', status);
      }
    }

    const snapshot = await query.limit(1).get();

    if (snapshot.empty) {
      return null;
    }

    const doc = snapshot.docs[0];
    if (!doc) {
      return null;
    }

    return {
      id: doc.id,
      userId: doc.data().userId as string,
    };
  } catch (error) {
    logger.error('[findTaskNotificationByEntity] Error:', { entityType, entityId, error });
    return null;
  }
}

/**
 * Find all matching task notifications by entity
 * Used when multiple tasks might exist for the same entity
 */
export async function findAllTaskNotificationsByEntity(
  entityType: string,
  entityId: string,
  category?: string,
  status?: TaskNotificationStatus | TaskNotificationStatus[]
): Promise<Array<{ id: string; userId: string }>> {
  try {
    let query = db
      .collection(TASK_NOTIFICATIONS_COLLECTION)
      .where('entityType', '==', entityType)
      .where('entityId', '==', entityId);

    if (category) {
      query = query.where('category', '==', category);
    }

    if (status) {
      if (Array.isArray(status)) {
        query = query.where('status', 'in', status);
      } else {
        query = query.where('status', '==', status);
      }
    }

    const snapshot = await query.get();

    return snapshot.docs.map((doc) => ({
      id: doc.id,
      userId: doc.data().userId as string,
    }));
  } catch (error) {
    logger.error('[findAllTaskNotificationsByEntity] Error:', { entityType, entityId, error });
    return [];
  }
}

/**
 * Auto-complete a task notification
 * Sets status to 'completed' and marks as auto-completed
 */
export async function autoCompleteTask(taskId: string, reason: string): Promise<boolean> {
  try {
    const now = Timestamp.now();

    await db.collection(TASK_NOTIFICATIONS_COLLECTION).doc(taskId).update({
      status: 'completed',
      timeCompleted: now,
      autoCompletedAt: now,
      completionConfirmed: false, // Needs user confirmation
      read: true,
      updatedAt: now,
      // Store reason in metadata
      'metadata.autoCompletionReason': reason,
    });

    logger.info('[autoCompleteTask] Successfully auto-completed task', {
      taskId,
      reason,
    });

    return true;
  } catch (error) {
    logger.error('[autoCompleteTask] Error:', { taskId, error });
    return false;
  }
}

/**
 * Auto-complete multiple tasks in a batch
 */
export async function autoCompleteTasksBatch(
  taskIds: string[],
  reason: string
): Promise<{ succeeded: number; failed: number }> {
  if (taskIds.length === 0) {
    return { succeeded: 0, failed: 0 };
  }

  const batch = db.batch();
  const now = Timestamp.now();

  for (const taskId of taskIds) {
    const taskRef = db.collection(TASK_NOTIFICATIONS_COLLECTION).doc(taskId);
    batch.update(taskRef, {
      status: 'completed',
      timeCompleted: now,
      autoCompletedAt: now,
      completionConfirmed: false,
      read: true,
      updatedAt: now,
      'metadata.autoCompletionReason': reason,
    });
  }

  try {
    await batch.commit();
    logger.info('[autoCompleteTasksBatch] Batch completed', {
      count: taskIds.length,
      reason,
    });
    return { succeeded: taskIds.length, failed: 0 };
  } catch (error) {
    logger.error('[autoCompleteTasksBatch] Batch failed:', { taskIds, error });
    return { succeeded: 0, failed: taskIds.length };
  }
}

/**
 * Create an informational notification
 * Used to notify users when auto-completion happens
 */
export async function createInformationalNotification(params: {
  userId: string;
  title: string;
  message: string;
  category: string;
  entityType: string;
  entityId: string;
  linkUrl: string;
  projectId?: string;
  priority?: 'LOW' | 'MEDIUM' | 'HIGH' | 'URGENT';
  metadata?: Record<string, unknown>;
}): Promise<string | null> {
  try {
    const now = Timestamp.now();

    const docRef = await db.collection(TASK_NOTIFICATIONS_COLLECTION).add({
      type: 'informational',
      category: params.category,
      userId: params.userId,
      title: params.title,
      message: params.message,
      priority: params.priority || 'MEDIUM',
      projectId: params.projectId || null,
      entityType: params.entityType,
      entityId: params.entityId,
      linkUrl: params.linkUrl,
      status: 'pending',
      read: false,
      autoCompletable: false,
      completionConfirmed: false,
      metadata: params.metadata || null,
      createdAt: now,
    });

    logger.info('[createInformationalNotification] Created notification', {
      id: docRef.id,
      userId: params.userId,
      category: params.category,
    });

    return docRef.id;
  } catch (error) {
    logger.error('[createInformationalNotification] Error:', error);
    return null;
  }
}

/**
 * Log auto-completion event for audit trail
 */
export async function logAutoCompletionEvent(params: {
  taskId: string;
  entityType: string;
  entityId: string;
  triggerEvent: string;
  completedBy: 'system';
}): Promise<void> {
  try {
    const now = Timestamp.now();

    await db.collection('auditLogs').add({
      type: 'TASK_AUTO_COMPLETION',
      taskId: params.taskId,
      entityType: params.entityType,
      entityId: params.entityId,
      triggerEvent: params.triggerEvent,
      completedBy: params.completedBy,
      timestamp: now,
      createdAt: now,
    });
  } catch (error) {
    // Don't fail if audit logging fails
    logger.warn('[logAutoCompletionEvent] Failed to log event:', error);
  }
}
