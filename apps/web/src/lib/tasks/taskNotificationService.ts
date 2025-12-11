/**
 * Task Notification Service
 *
 * Unified notification-task system where all notifications are actionable
 * or acknowledgeable items with optional time tracking
 */

import {
  collection,
  doc,
  addDoc,
  getDoc,
  getDocs,
  updateDoc,
  query,
  where,
  orderBy,
  limit as firestoreLimit,
  Timestamp,
  type QueryConstraint,
  type DocumentData,
} from 'firebase/firestore';
import { getFirebase } from '@/lib/firebase';
import { COLLECTIONS } from '@vapour/firebase';
import { createLogger } from '@vapour/logger';
import type {
  TaskNotification,
  CreateTaskNotificationInput,
  TaskNotificationFilters,
  TaskNotificationSummary,
  TaskNotificationStatus,
} from '@vapour/types';

const logger = createLogger({ context: 'taskNotificationService' });

/**
 * Convert Firestore DocumentData to TaskNotification with proper type safety
 */
function docToTaskNotification(id: string, data: DocumentData): TaskNotification {
  return {
    id,
    type: data.type,
    category: data.category,
    userId: data.userId,
    assignedBy: data.assignedBy,
    assignedByName: data.assignedByName,
    title: data.title,
    message: data.message,
    priority: data.priority,
    projectId: data.projectId,
    equipmentId: data.equipmentId,
    entityType: data.entityType,
    entityId: data.entityId,
    linkUrl: data.linkUrl,
    status: data.status,
    read: data.read,
    autoCompletable: data.autoCompletable,
    completionConfirmed: data.completionConfirmed,
    metadata: data.metadata,
    createdAt: data.createdAt,
    updatedAt: data.updatedAt,
    acknowledgedAt: data.acknowledgedAt,
    timeStarted: data.timeStarted,
    timeCompleted: data.timeCompleted,
    totalDuration: data.totalDuration,
    autoCompletedAt: data.autoCompletedAt,
    manuallyCompletedAt: data.manuallyCompletedAt,
  };
}

// ============================================================================
// CREATE TASK NOTIFICATION
// ============================================================================

/**
 * Create a new task-notification
 * Can be actionable (with time tracking) or informational (acknowledgement only)
 */
export async function createTaskNotification(input: CreateTaskNotificationInput): Promise<string> {
  const { db } = getFirebase();

  try {
    const now = Timestamp.now();

    const taskNotificationData: Omit<TaskNotification, 'id'> = {
      // Classification
      type: input.type,
      category: input.category,

      // Assignment
      userId: input.userId,
      assignedBy: input.assignedBy,
      assignedByName: input.assignedByName,

      // Content
      title: input.title,
      message: input.message,
      priority: input.priority || 'MEDIUM',

      // Linking
      projectId: input.projectId,
      equipmentId: input.equipmentId,
      entityType: input.entityType,
      entityId: input.entityId,
      linkUrl: input.linkUrl,

      // Status
      status: 'pending',
      read: false,

      // Auto-completion
      autoCompletable: input.autoCompletable || false,
      completionConfirmed: false,

      // Metadata
      metadata: input.metadata,

      // Timestamps
      createdAt: now,
    };

    const docRef = await addDoc(
      collection(db, COLLECTIONS.TASK_NOTIFICATIONS),
      taskNotificationData
    );

    return docRef.id;
  } catch (error) {
    logger.error('Failed to create task notification', { error });
    throw new Error('Failed to create task notification');
  }
}

// ============================================================================
// GET TASK NOTIFICATIONS
// ============================================================================

/**
 * Get task notifications for a user with filters
 */
export async function getUserTaskNotifications(
  filters: TaskNotificationFilters
): Promise<TaskNotification[]> {
  const { db } = getFirebase();

  try {
    const constraints: QueryConstraint[] = [];

    // User filter (required)
    if (filters.userId) {
      constraints.push(where('userId', '==', filters.userId));
    }

    // Type filter
    if (filters.type) {
      constraints.push(where('type', '==', filters.type));
    }

    // Category filter
    if (filters.category) {
      constraints.push(where('category', '==', filters.category));
    }

    // Status filter
    if (filters.status) {
      constraints.push(where('status', '==', filters.status));
    }

    // Priority filter
    if (filters.priority) {
      constraints.push(where('priority', '==', filters.priority));
    }

    // Project filter
    if (filters.projectId) {
      constraints.push(where('projectId', '==', filters.projectId));
    }

    // Read filter
    if (filters.read !== undefined) {
      constraints.push(where('read', '==', filters.read));
    }

    // Order by priority (URGENT > HIGH > MEDIUM > LOW) then by creation date
    constraints.push(orderBy('priority', 'desc'));
    constraints.push(orderBy('createdAt', 'desc'));

    // Limit
    if (filters.limit) {
      constraints.push(firestoreLimit(filters.limit));
    }

    const q = query(collection(db, COLLECTIONS.TASK_NOTIFICATIONS), ...constraints);
    const snapshot = await getDocs(q);

    const taskNotifications: TaskNotification[] = [];
    snapshot.forEach((docSnap) => {
      taskNotifications.push(docToTaskNotification(docSnap.id, docSnap.data()));
    });

    return taskNotifications;
  } catch (error) {
    logger.error('Failed to get task notifications', { error, filters });
    throw new Error('Failed to get task notifications');
  }
}

/**
 * Get a single task notification by ID
 */
export async function getTaskNotificationById(
  taskNotificationId: string
): Promise<TaskNotification | null> {
  const { db } = getFirebase();

  try {
    const docRef = doc(db, COLLECTIONS.TASK_NOTIFICATIONS, taskNotificationId);
    const docSnap = await getDoc(docRef);

    if (!docSnap.exists()) {
      return null;
    }

    return docToTaskNotification(docSnap.id, docSnap.data());
  } catch (error) {
    logger.error('Failed to get task notification', { error, taskNotificationId });
    throw new Error('Failed to get task notification');
  }
}

/**
 * Find task notification by entity
 * Useful for auto-completion logic (e.g., find "Review PR-001" task when PR is approved)
 * Status can be a single value or an array of values to match
 */
export async function findTaskNotificationByEntity(
  entityType: string,
  entityId: string,
  category?: string,
  status?: TaskNotificationStatus | TaskNotificationStatus[]
): Promise<TaskNotification | null> {
  const { db } = getFirebase();

  try {
    const constraints: QueryConstraint[] = [
      where('entityType', '==', entityType),
      where('entityId', '==', entityId),
    ];

    if (category) {
      constraints.push(where('category', '==', category));
    }

    if (status) {
      if (Array.isArray(status)) {
        constraints.push(where('status', 'in', status));
      } else {
        constraints.push(where('status', '==', status));
      }
    }

    constraints.push(firestoreLimit(1));

    const q = query(collection(db, COLLECTIONS.TASK_NOTIFICATIONS), ...constraints);
    const snapshot = await getDocs(q);

    if (snapshot.empty || !snapshot.docs[0]) {
      return null;
    }

    const docData = snapshot.docs[0];
    return docToTaskNotification(docData.id, docData.data());
  } catch (error) {
    logger.error('Failed to find task notification by entity', { error, entityType, entityId });
    return null;
  }
}

// ============================================================================
// UPDATE STATUS
// ============================================================================

/**
 * Mark task notification as read
 */
export async function markAsRead(taskNotificationId: string): Promise<void> {
  const { db } = getFirebase();

  try {
    const docRef = doc(db, COLLECTIONS.TASK_NOTIFICATIONS, taskNotificationId);

    await updateDoc(docRef, {
      read: true,
      updatedAt: Timestamp.now(),
    });
  } catch (error) {
    logger.error('Failed to mark as read', { error, taskNotificationId });
    throw new Error('Failed to mark as read');
  }
}

/**
 * Mark all task notifications as read for a user
 */
export async function markAllAsRead(userId: string): Promise<void> {
  try {
    const unread = await getUserTaskNotifications({
      userId,
      read: false,
    });

    const updatePromises = unread.map((taskNotification) => markAsRead(taskNotification.id));

    await Promise.all(updatePromises);
  } catch (error) {
    logger.error('Failed to mark all as read', { error, userId });
    throw new Error('Failed to mark all as read');
  }
}

/**
 * Acknowledge informational task notification
 * Sets acknowledgedAt timestamp and updates status to 'acknowledged'
 */
export async function acknowledgeInformational(taskNotificationId: string): Promise<void> {
  const { db } = getFirebase();

  try {
    const taskNotification = await getTaskNotificationById(taskNotificationId);

    if (!taskNotification) {
      throw new Error('Task notification not found');
    }

    if (taskNotification.type !== 'informational') {
      throw new Error('Only informational task notifications can be acknowledged');
    }

    await updateDoc(doc(db, COLLECTIONS.TASK_NOTIFICATIONS, taskNotificationId), {
      acknowledgedAt: Timestamp.now(),
      status: 'acknowledged',
      read: true,
      updatedAt: Timestamp.now(),
    });
  } catch (error) {
    logger.error('Failed to acknowledge informational notification', { error, taskNotificationId });
    throw error;
  }
}

/**
 * Acknowledge all informational task notifications for a user
 */
export async function acknowledgeAllInformational(userId: string): Promise<void> {
  try {
    const informational = await getUserTaskNotifications({
      userId,
      type: 'informational',
      status: 'pending',
    });

    const acknowledgePromises = informational.map((taskNotification) =>
      acknowledgeInformational(taskNotification.id)
    );

    await Promise.all(acknowledgePromises);
  } catch (error) {
    logger.error('Failed to acknowledge all informational notifications', { error, userId });
    throw new Error('Failed to acknowledge all informational notifications');
  }
}

// ============================================================================
// ACTIONABLE TASK OPERATIONS
// ============================================================================

/**
 * Start working on an actionable task
 * Sets timeStarted and updates status to 'in_progress'
 * Note: Timer is actually started separately via timeEntryService
 */
export async function startActionableTask(
  taskNotificationId: string,
  userId: string
): Promise<void> {
  const { db } = getFirebase();

  try {
    const taskNotification = await getTaskNotificationById(taskNotificationId);

    if (!taskNotification) {
      throw new Error('Task notification not found');
    }

    if (taskNotification.type !== 'actionable') {
      throw new Error('Only actionable task notifications can be started');
    }

    if (taskNotification.userId !== userId) {
      throw new Error('You cannot start a task assigned to someone else');
    }

    await updateDoc(doc(db, COLLECTIONS.TASK_NOTIFICATIONS, taskNotificationId), {
      timeStarted: Timestamp.now(),
      status: 'in_progress',
      read: true,
      updatedAt: Timestamp.now(),
    });
  } catch (error) {
    logger.error('Failed to start actionable task', { error, taskNotificationId, userId });
    throw error;
  }
}

/**
 * Complete an actionable task
 * Can be auto-completed (system detected) or manually completed
 */
export async function completeActionableTask(
  taskNotificationId: string,
  userId: string,
  autoCompleted: boolean = false
): Promise<void> {
  const { db } = getFirebase();

  try {
    const taskNotification = await getTaskNotificationById(taskNotificationId);

    if (!taskNotification) {
      throw new Error('Task notification not found');
    }

    if (taskNotification.type !== 'actionable') {
      throw new Error('Only actionable task notifications can be completed');
    }

    if (taskNotification.userId !== userId) {
      throw new Error('You cannot complete a task assigned to someone else');
    }

    const updates: Partial<TaskNotification> = {
      timeCompleted: Timestamp.now(),
      status: 'completed',
      read: true,
      updatedAt: Timestamp.now(),
    };

    if (autoCompleted) {
      updates.autoCompletedAt = Timestamp.now();
      // Don't set completionConfirmed yet - wait for user confirmation
    } else {
      updates.manuallyCompletedAt = Timestamp.now();
      updates.completionConfirmed = true;
    }

    await updateDoc(doc(db, COLLECTIONS.TASK_NOTIFICATIONS, taskNotificationId), updates);
  } catch (error) {
    logger.error('Failed to complete actionable task', { error, taskNotificationId, userId });
    throw error;
  }
}

/**
 * Confirm auto-completion
 * User confirms that the auto-completed task should be marked as complete
 */
export async function confirmAutoCompletion(taskNotificationId: string): Promise<void> {
  const { db } = getFirebase();

  try {
    await updateDoc(doc(db, COLLECTIONS.TASK_NOTIFICATIONS, taskNotificationId), {
      completionConfirmed: true,
      manuallyCompletedAt: Timestamp.now(),
      updatedAt: Timestamp.now(),
    });
  } catch (error) {
    logger.error('Failed to confirm auto-completion', { error, taskNotificationId });
    throw new Error('Failed to confirm auto-completion');
  }
}

/**
 * Update total duration for a task notification
 * Called by time entry service when time entries are stopped
 */
export async function updateTaskDuration(
  taskNotificationId: string,
  totalDuration: number
): Promise<void> {
  const { db } = getFirebase();

  try {
    await updateDoc(doc(db, COLLECTIONS.TASK_NOTIFICATIONS, taskNotificationId), {
      totalDuration,
      updatedAt: Timestamp.now(),
    });
  } catch (error) {
    logger.error('Failed to update task duration', { error, taskNotificationId, totalDuration });
    throw new Error('Failed to update task duration');
  }
}

// ============================================================================
// COUNTS & STATS
// ============================================================================

/**
 * Get count of unread task notifications
 */
export async function getUnreadCount(userId: string): Promise<number> {
  const { db } = getFirebase();

  try {
    const q = query(
      collection(db, COLLECTIONS.TASK_NOTIFICATIONS),
      where('userId', '==', userId),
      where('read', '==', false)
    );

    const snapshot = await getDocs(q);
    return snapshot.size;
  } catch (error) {
    logger.error('Failed to get unread count', { error, userId });
    return 0;
  }
}

/**
 * Get count of pending actionable task notifications
 */
export async function getPendingActionCount(userId: string): Promise<number> {
  const { db } = getFirebase();

  try {
    const q = query(
      collection(db, COLLECTIONS.TASK_NOTIFICATIONS),
      where('userId', '==', userId),
      where('type', '==', 'actionable'),
      where('status', '==', 'pending')
    );

    const snapshot = await getDocs(q);
    return snapshot.size;
  } catch (error) {
    logger.error('Failed to get pending action count', { error, userId });
    return 0;
  }
}

/**
 * Get task notification summary stats for a user
 */
export async function getTaskNotificationSummary(userId: string): Promise<TaskNotificationSummary> {
  try {
    const allTasks = await getUserTaskNotifications({ userId });

    const summary: TaskNotificationSummary = {
      total: allTasks.length,
      unread: 0,
      pending: 0,
      inProgress: 0,
      completed: 0,
      byPriority: {
        LOW: 0,
        MEDIUM: 0,
        HIGH: 0,
        URGENT: 0,
      },
      byType: {
        actionable: 0,
        informational: 0,
      },
    };

    allTasks.forEach((task) => {
      // Count by status
      if (!task.read) summary.unread++;
      if (task.status === 'pending') summary.pending++;
      if (task.status === 'in_progress') summary.inProgress++;
      if (task.status === 'completed') summary.completed++;

      // Count by priority
      summary.byPriority[task.priority]++;

      // Count by type
      summary.byType[task.type]++;
    });

    return summary;
  } catch (error) {
    logger.error('Failed to get task notification summary', { error, userId });
    throw new Error('Failed to get task notification summary');
  }
}
