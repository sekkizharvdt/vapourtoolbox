/**
 * Notification CRUD Operations
 *
 * Create, read, and update notification operations
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
import { createLogger } from '@vapour/logger';
import type { ProcurementNotification } from '@vapour/types';
import type { CreateNotificationInput, GetNotificationsFilters } from './types';

const logger = createLogger({ context: 'notification/crud' });

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
    logger.error('createNotification failed', { type: input.type, userId: input.userId, error });
    throw new Error('Failed to create notification');
  }
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
    logger.error('getUserNotifications failed', { userId: filters.userId, error });
    throw new Error('Failed to get notifications');
  }
}

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
    logger.error('getUnreadNotificationCount failed', { userId, error });
    return 0; // Return 0 on error, don't throw
  }
}

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
    logger.error('markNotificationAsRead failed', { notificationId, error });
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
    logger.error('markAllNotificationsAsRead failed', { userId, error });
    throw new Error('Failed to mark all notifications as read');
  }
}
