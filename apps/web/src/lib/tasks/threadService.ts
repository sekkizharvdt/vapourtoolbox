/**
 * Thread Service
 *
 * Manages task threads and messages for the Slack-like task interface.
 * Features:
 * - Create/get threads for task notifications
 * - Add messages to threads
 * - Real-time subscriptions for messages
 * - @mention parsing and creation
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
  increment,
  type Unsubscribe,
  type DocumentSnapshot,
  type QueryDocumentSnapshot,
} from 'firebase/firestore';
import { getFirebase } from '@/lib/firebase';
import { COLLECTIONS } from '@vapour/firebase';
import { createLogger } from '@vapour/logger';
import type { TaskThread, TaskMessage, TaskNotification } from '@vapour/types';
import { createMentionsFromMessage } from './mentionService';

const logger = createLogger({ context: 'threadService' });

// Helper to convert doc snapshot to typed object
function toThread(docSnap: DocumentSnapshot | QueryDocumentSnapshot): TaskThread {
  const docData = docSnap.data() as Omit<TaskThread, 'id'>;
  const data: TaskThread = { id: docSnap.id, ...docData };
  return data;
}

function toMessage(docSnap: DocumentSnapshot | QueryDocumentSnapshot): TaskMessage {
  const docData = docSnap.data() as Omit<TaskMessage, 'id'>;
  const data: TaskMessage = { id: docSnap.id, ...docData };
  return data;
}

// ============================================================================
// THREAD OPERATIONS
// ============================================================================

/**
 * Get or create a thread for a task notification
 */
export async function getOrCreateThread(taskNotification: TaskNotification): Promise<TaskThread> {
  const { db } = getFirebase();

  // Check if thread already exists
  const threadsRef = collection(db, COLLECTIONS.TASK_THREADS);
  const q = query(threadsRef, where('taskNotificationId', '==', taskNotification.id));
  const snapshot = await getDocs(q);

  if (!snapshot.empty && snapshot.docs[0]) {
    return toThread(snapshot.docs[0]);
  }

  // Create new thread
  const channelId = getChannelIdFromTaskCategory(taskNotification.category);
  const newThread: Omit<TaskThread, 'id'> = {
    taskNotificationId: taskNotification.id,
    projectId: taskNotification.projectId,
    channelId,
    messageCount: 0,
    lastMessageAt: Timestamp.now(),
    createdAt: Timestamp.now(),
  };

  const docRef = await addDoc(threadsRef, newThread);
  return { id: docRef.id, ...newThread };
}

/**
 * Get thread by ID
 */
export async function getThreadById(threadId: string): Promise<TaskThread | null> {
  const { db } = getFirebase();
  const docRef = doc(db, COLLECTIONS.TASK_THREADS, threadId);
  const docSnap = await getDoc(docRef);

  if (!docSnap.exists()) {
    return null;
  }

  return toThread(docSnap);
}

/**
 * Get thread by task notification ID
 */
export async function getThreadByTaskId(taskNotificationId: string): Promise<TaskThread | null> {
  const { db } = getFirebase();
  const threadsRef = collection(db, COLLECTIONS.TASK_THREADS);
  const q = query(threadsRef, where('taskNotificationId', '==', taskNotificationId), limit(1));
  const snapshot = await getDocs(q);

  if (snapshot.empty || !snapshot.docs[0]) {
    return null;
  }

  return toThread(snapshot.docs[0]);
}

/**
 * Get threads by project
 */
export async function getThreadsByProject(
  projectId: string,
  limitCount: number = 50
): Promise<TaskThread[]> {
  const { db } = getFirebase();
  const threadsRef = collection(db, COLLECTIONS.TASK_THREADS);
  const q = query(
    threadsRef,
    where('projectId', '==', projectId),
    orderBy('lastMessageAt', 'desc'),
    limit(limitCount)
  );

  const snapshot = await getDocs(q);
  return snapshot.docs.map(toThread);
}

/**
 * Get threads by channel
 */
export async function getThreadsByChannel(
  channelId: string,
  limitCount: number = 50
): Promise<TaskThread[]> {
  const { db } = getFirebase();
  const threadsRef = collection(db, COLLECTIONS.TASK_THREADS);
  const q = query(
    threadsRef,
    where('channelId', '==', channelId),
    orderBy('lastMessageAt', 'desc'),
    limit(limitCount)
  );

  const snapshot = await getDocs(q);
  return snapshot.docs.map(toThread);
}

// ============================================================================
// MESSAGE OPERATIONS
// ============================================================================

/**
 * Add a message to a thread
 */
export async function addMessage(
  threadId: string,
  userId: string,
  userName: string,
  content: string,
  userAvatar?: string
): Promise<TaskMessage> {
  const { db } = getFirebase();

  // Parse mentions from content
  const mentions = parseMentions(content);

  // Create message
  const messagesRef = collection(db, COLLECTIONS.TASK_MESSAGES);
  const newMessage: Omit<TaskMessage, 'id'> = {
    threadId,
    userId,
    userName,
    userAvatar,
    content,
    mentions,
    createdAt: Timestamp.now(),
  };

  const docRef = await addDoc(messagesRef, newMessage);
  const message = { id: docRef.id, ...newMessage };

  // Update thread metadata
  const threadRef = doc(db, COLLECTIONS.TASK_THREADS, threadId);
  await updateDoc(threadRef, {
    messageCount: increment(1),
    lastMessageAt: Timestamp.now(),
    updatedAt: Timestamp.now(),
  });

  // Create mention notifications if there are mentions
  if (mentions.length > 0) {
    const thread = await getThreadById(threadId);
    if (thread) {
      await createMentionsFromMessage(message, thread.taskNotificationId, userId, userName);
    }
  }

  return message;
}

/**
 * Edit a message
 */
export async function editMessage(
  messageId: string,
  newContent: string,
  userId: string
): Promise<void> {
  const { db } = getFirebase();
  const messageRef = doc(db, COLLECTIONS.TASK_MESSAGES, messageId);

  // Verify ownership
  const messageDoc = await getDoc(messageRef);
  if (!messageDoc.exists()) {
    throw new Error('Message not found');
  }

  const messageData = messageDoc.data();
  if (messageData.userId !== userId) {
    throw new Error('You can only edit your own messages');
  }

  // Parse new mentions
  const mentions = parseMentions(newContent);

  await updateDoc(messageRef, {
    content: newContent,
    mentions,
    editedAt: Timestamp.now(),
  });
}

/**
 * Get messages for a thread
 */
export async function getThreadMessages(
  threadId: string,
  limitCount: number = 100
): Promise<TaskMessage[]> {
  const { db } = getFirebase();
  const messagesRef = collection(db, COLLECTIONS.TASK_MESSAGES);
  const q = query(
    messagesRef,
    where('threadId', '==', threadId),
    orderBy('createdAt', 'asc'),
    limit(limitCount)
  );

  const snapshot = await getDocs(q);
  return snapshot.docs.map(toMessage);
}

/**
 * Subscribe to messages in a thread (real-time)
 */
export function subscribeToThreadMessages(
  threadId: string,
  callback: (messages: TaskMessage[]) => void,
  onError?: (error: Error) => void
): Unsubscribe {
  const { db } = getFirebase();
  const messagesRef = collection(db, COLLECTIONS.TASK_MESSAGES);
  const q = query(messagesRef, where('threadId', '==', threadId), orderBy('createdAt', 'asc'));

  return onSnapshot(
    q,
    (snapshot) => {
      callback(snapshot.docs.map(toMessage));
    },
    (error) => {
      logger.error('Error subscribing to thread messages', { error, threadId });
      onError?.(error);
    }
  );
}

// ============================================================================
// HELPER FUNCTIONS
// ============================================================================

/**
 * Parse @mentions from message content
 * Format: @[userId] or @userId
 */
export function parseMentions(content: string): string[] {
  // Match @[userId] or @userId patterns
  const mentionRegex = /@\[([^\]]+)\]|@(\w+)/g;
  const mentions: string[] = [];
  let match;

  while ((match = mentionRegex.exec(content)) !== null) {
    const userId = match[1] || match[2];
    if (userId && !mentions.includes(userId)) {
      mentions.push(userId);
    }
  }

  return mentions;
}

/**
 * Format content with clickable @mentions
 * Returns content with @[userId] replaced with display names
 */
export function formatMentions(content: string, userMap: Record<string, string>): string {
  return content.replace(/@\[([^\]]+)\]/g, (_, userId) => {
    const displayName = userMap[userId] || userId;
    return `@${displayName}`;
  });
}

/**
 * Get channel ID from task category
 * This maps task notification categories to channel IDs
 */
function getChannelIdFromTaskCategory(category: string): string {
  // Procurement categories
  if (
    category.startsWith('PR_') ||
    category.startsWith('RFQ_') ||
    category.startsWith('PO_') ||
    category.startsWith('OFFER_') ||
    category === 'GOODS_RECEIVED' ||
    category === 'PAYMENT_REQUESTED' ||
    category === 'WCC_ISSUED'
  ) {
    return 'procurement';
  }

  // Document categories
  if (
    category.startsWith('DOCUMENT_') ||
    category.startsWith('WORK_ITEM_') ||
    category === 'SUPPLY_LIST_PR_REQUIRED'
  ) {
    return 'documents';
  }

  // Accounting categories
  if (
    category.startsWith('INVOICE_') ||
    category.startsWith('PAYMENT_') ||
    category.startsWith('BILL_')
  ) {
    return 'accounting';
  }

  // Proposal categories
  if (category.startsWith('PROPOSAL_')) {
    return 'proposals';
  }

  // Enquiry categories
  if (category.startsWith('ENQUIRY_')) {
    return 'enquiries';
  }

  // Project categories
  if (
    category.startsWith('PROJECT_') ||
    category.startsWith('MILESTONE_') ||
    category.startsWith('DELIVERABLE_')
  ) {
    return 'general';
  }

  // Default to general
  return 'general';
}
