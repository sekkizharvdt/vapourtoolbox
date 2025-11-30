/**
 * Mention Service
 *
 * Handles @mention operations for the task thread system.
 * Features:
 * - Create mention records when users are @mentioned
 * - Query unread mentions for a user
 * - Mark mentions as read
 * - Subscribe to real-time mention updates
 */

import {
  collection,
  doc,
  getDoc,
  getDocs,
  addDoc,
  updateDoc,
  query,
  where,
  orderBy,
  limit,
  Timestamp,
  onSnapshot,
  writeBatch,
  type Unsubscribe,
  type DocumentSnapshot,
  type QueryDocumentSnapshot,
} from 'firebase/firestore';
import { getFirebase } from '@/lib/firebase';
import { COLLECTIONS } from '@vapour/firebase';
import { createLogger } from '@vapour/logger';
import type { TaskMention, TaskMessage, TaskThread } from '@vapour/types';

const logger = createLogger({ context: 'mentionService' });

// Helper to convert doc snapshot to typed object
function toMention(docSnap: DocumentSnapshot | QueryDocumentSnapshot): TaskMention {
  const docData = docSnap.data() as Omit<TaskMention, 'id'>;
  const data: TaskMention = { id: docSnap.id, ...docData };
  return data;
}

function toThread(docSnap: DocumentSnapshot | QueryDocumentSnapshot): TaskThread {
  const docData = docSnap.data() as Omit<TaskThread, 'id'>;
  const data: TaskThread = { id: docSnap.id, ...docData };
  return data;
}

// ============================================================================
// CREATE MENTIONS
// ============================================================================

/**
 * Create mention records from a message
 * Called after a message with @mentions is posted
 */
export async function createMentionsFromMessage(
  message: TaskMessage,
  taskNotificationId: string,
  mentionedByUserId: string,
  mentionedByName: string
): Promise<TaskMention[]> {
  const { db } = getFirebase();

  if (!message.mentions || message.mentions.length === 0) {
    return [];
  }

  const createdMentions: TaskMention[] = [];
  const now = Timestamp.now();

  for (const mentionedUserId of message.mentions) {
    // Don't create mention for self-mentions
    if (mentionedUserId === mentionedByUserId) {
      continue;
    }

    const mentionData: Omit<TaskMention, 'id'> = {
      mentionedUserId,
      mentionedByUserId,
      mentionedByName,
      threadId: message.threadId,
      messageId: message.id,
      taskNotificationId,
      read: false,
      createdAt: now,
    };

    const docRef = await addDoc(collection(db, COLLECTIONS.TASK_MENTIONS), mentionData);
    createdMentions.push({ id: docRef.id, ...mentionData });
  }

  return createdMentions;
}

// ============================================================================
// QUERY MENTIONS
// ============================================================================

/**
 * Get unread mentions for a user
 */
export async function getUnreadMentions(
  userId: string,
  limitCount: number = 50
): Promise<TaskMention[]> {
  const { db } = getFirebase();

  const mentionsRef = collection(db, COLLECTIONS.TASK_MENTIONS);
  const q = query(
    mentionsRef,
    where('mentionedUserId', '==', userId),
    where('read', '==', false),
    orderBy('createdAt', 'desc'),
    limit(limitCount)
  );

  const snapshot = await getDocs(q);
  return snapshot.docs.map(toMention);
}

/**
 * Get all mentions for a user (read and unread)
 */
export async function getAllMentions(
  userId: string,
  limitCount: number = 100
): Promise<TaskMention[]> {
  const { db } = getFirebase();

  const mentionsRef = collection(db, COLLECTIONS.TASK_MENTIONS);
  const q = query(
    mentionsRef,
    where('mentionedUserId', '==', userId),
    orderBy('createdAt', 'desc'),
    limit(limitCount)
  );

  const snapshot = await getDocs(q);
  return snapshot.docs.map(toMention);
}

/**
 * Get mentions in a specific thread
 */
export async function getMentionsByThread(
  threadId: string,
  userId?: string
): Promise<TaskMention[]> {
  const { db } = getFirebase();

  const mentionsRef = collection(db, COLLECTIONS.TASK_MENTIONS);

  // Build query with optional user filter
  const constraints = [where('threadId', '==', threadId), orderBy('createdAt', 'asc')];

  const q = query(mentionsRef, ...constraints);
  const snapshot = await getDocs(q);

  let mentions = snapshot.docs.map(toMention);

  // Filter by userId if provided (client-side since Firestore doesn't allow multiple equality filters easily)
  if (userId) {
    mentions = mentions.filter((m) => m.mentionedUserId === userId);
  }

  return mentions;
}

/**
 * Get unread mention count for a user
 */
export async function getUnreadMentionCount(userId: string): Promise<number> {
  const { db } = getFirebase();

  const mentionsRef = collection(db, COLLECTIONS.TASK_MENTIONS);
  const q = query(mentionsRef, where('mentionedUserId', '==', userId), where('read', '==', false));

  const snapshot = await getDocs(q);
  return snapshot.size;
}

// ============================================================================
// MARK AS READ
// ============================================================================

/**
 * Mark a single mention as read
 */
export async function markMentionAsRead(mentionId: string): Promise<void> {
  const { db } = getFirebase();

  const mentionRef = doc(db, COLLECTIONS.TASK_MENTIONS, mentionId);
  await updateDoc(mentionRef, {
    read: true,
  });
}

/**
 * Mark multiple mentions as read using batch writes for efficiency
 * Firestore batches support up to 500 operations
 */
export async function markMentionsAsRead(mentionIds: string[]): Promise<void> {
  if (mentionIds.length === 0) return;

  const { db } = getFirebase();
  const BATCH_SIZE = 500;

  // Process in chunks of 500 (Firestore batch limit)
  for (let i = 0; i < mentionIds.length; i += BATCH_SIZE) {
    const batch = writeBatch(db);
    const chunk = mentionIds.slice(i, i + BATCH_SIZE);

    chunk.forEach((id) => {
      const mentionRef = doc(db, COLLECTIONS.TASK_MENTIONS, id);
      batch.update(mentionRef, { read: true });
    });

    await batch.commit();
  }
}

/**
 * Mark all mentions in a thread as read for a user
 */
export async function markThreadMentionsAsRead(threadId: string, userId: string): Promise<void> {
  const mentions = await getMentionsByThread(threadId, userId);
  const unreadMentionIds = mentions.filter((m) => !m.read).map((m) => m.id);

  if (unreadMentionIds.length > 0) {
    await markMentionsAsRead(unreadMentionIds);
  }
}

/**
 * Mark all unread mentions as read for a user
 */
export async function markAllMentionsAsRead(userId: string): Promise<void> {
  const unreadMentions = await getUnreadMentions(userId);
  const mentionIds = unreadMentions.map((m) => m.id);

  if (mentionIds.length > 0) {
    await markMentionsAsRead(mentionIds);
  }
}

// ============================================================================
// REAL-TIME SUBSCRIPTIONS
// ============================================================================

/**
 * Subscribe to unread mentions for a user (real-time)
 */
export function subscribeToUnreadMentions(
  userId: string,
  callback: (mentions: TaskMention[]) => void,
  onError?: (error: Error) => void
): Unsubscribe {
  const { db } = getFirebase();

  const mentionsRef = collection(db, COLLECTIONS.TASK_MENTIONS);
  const q = query(
    mentionsRef,
    where('mentionedUserId', '==', userId),
    where('read', '==', false),
    orderBy('createdAt', 'desc')
  );

  return onSnapshot(
    q,
    (snapshot) => {
      callback(snapshot.docs.map(toMention));
    },
    (error) => {
      logger.error('Error subscribing to mentions', { error, userId });
      onError?.(error);
    }
  );
}

/**
 * Subscribe to mention count for badge display
 */
export function subscribeToMentionCount(
  userId: string,
  callback: (count: number) => void,
  onError?: (error: Error) => void
): Unsubscribe {
  return subscribeToUnreadMentions(userId, (mentions) => callback(mentions.length), onError);
}

// ============================================================================
// ENRICHMENT
// ============================================================================

/**
 * Get mention with thread details
 */
export async function getMentionWithThread(
  mentionId: string
): Promise<{ mention: TaskMention; thread: TaskThread | null } | null> {
  const { db } = getFirebase();

  const mentionDoc = await getDoc(doc(db, COLLECTIONS.TASK_MENTIONS, mentionId));
  if (!mentionDoc.exists()) {
    return null;
  }

  const mention = toMention(mentionDoc);

  // Get thread
  const threadDoc = await getDoc(doc(db, COLLECTIONS.TASK_THREADS, mention.threadId));
  const thread = threadDoc.exists() ? toThread(threadDoc) : null;

  return { mention, thread };
}

// ============================================================================
// HELPER FUNCTIONS
// ============================================================================

/**
 * Get display name from @[userId] format
 * This is a placeholder - in real usage, you'd look up the user's display name
 */
export function extractUserIdFromMention(mentionText: string): string | null {
  const match = mentionText.match(/@\[([^\]]+)\]/);
  return match && match[1] ? match[1] : null;
}
