/**
 * Meeting Service
 *
 * CRUD operations for meetings and action items.
 * Finalization creates ManualTasks from action items via batch write.
 *
 * **Required Firestore Composite Indexes:**
 * - meetings: (entityId, status, date DESC)
 * - meetingActionItems: (meetingId, createdAt ASC)
 */

import {
  collection,
  doc,
  addDoc,
  getDoc,
  getDocs,
  updateDoc,
  deleteDoc,
  query,
  where,
  orderBy,
  onSnapshot,
  writeBatch,
  runTransaction,
  Timestamp,
  type Firestore,
  type DocumentData,
  type Unsubscribe,
} from 'firebase/firestore';
import { COLLECTIONS } from '@vapour/firebase';
import type {
  Meeting,
  MeetingActionItem,
  CreateMeetingInput,
  MeetingActionItemInput,
  ManualTaskPriority,
} from '@vapour/types';
import { AuthorizationError } from '@/lib/auth/authorizationService';

// ============================================================================
// HELPERS
// ============================================================================

function docToMeeting(id: string, data: DocumentData): Meeting {
  return {
    id,
    title: data.title,
    date: data.date,
    duration: data.duration,
    location: data.location,
    createdBy: data.createdBy,
    createdByName: data.createdByName,
    attendeeIds: data.attendeeIds || [],
    attendeeNames: data.attendeeNames || [],
    agenda: data.agenda,
    notes: data.notes,
    status: data.status,
    finalizedAt: data.finalizedAt,
    projectId: data.projectId,
    projectName: data.projectName,
    entityId: data.entityId,
    createdAt: data.createdAt,
    updatedAt: data.updatedAt,
  };
}

function docToActionItem(id: string, data: DocumentData): MeetingActionItem {
  return {
    id,
    meetingId: data.meetingId,
    description: data.description,
    action: data.action,
    assigneeId: data.assigneeId,
    assigneeName: data.assigneeName,
    dueDate: data.dueDate,
    priority: data.priority,
    generatedTaskId: data.generatedTaskId,
    createdAt: data.createdAt,
  };
}

// ============================================================================
// MEETING CRUD
// ============================================================================

/**
 * Create a new meeting
 */
export async function createMeeting(
  db: Firestore,
  input: CreateMeetingInput,
  userId: string,
  userName: string,
  entityId: string
): Promise<Meeting> {
  const now = Timestamp.now();

  const meetingData: Record<string, unknown> = {
    title: input.title,
    date: input.date,
    ...(input.duration && { duration: input.duration }),
    ...(input.location && { location: input.location }),
    createdBy: userId,
    createdByName: userName,
    attendeeIds: input.attendeeIds,
    attendeeNames: input.attendeeNames,
    ...(input.agenda && { agenda: input.agenda }),
    ...(input.notes && { notes: input.notes }),
    status: 'draft',
    ...(input.projectId && { projectId: input.projectId }),
    ...(input.projectName && { projectName: input.projectName }),
    entityId,
    createdAt: now,
  };

  const docRef = await addDoc(collection(db, COLLECTIONS.MEETINGS), meetingData);

  return {
    id: docRef.id,
    title: input.title,
    date: input.date,
    duration: input.duration,
    location: input.location,
    createdBy: userId,
    createdByName: userName,
    attendeeIds: input.attendeeIds,
    attendeeNames: input.attendeeNames,
    agenda: input.agenda,
    notes: input.notes,
    status: 'draft',
    projectId: input.projectId,
    projectName: input.projectName,
    entityId,
    createdAt: now,
  };
}

/**
 * Get a meeting by ID
 */
export async function getMeetingById(db: Firestore, meetingId: string): Promise<Meeting | null> {
  const docRef = doc(db, COLLECTIONS.MEETINGS, meetingId);
  const docSnap = await getDoc(docRef);

  if (!docSnap.exists()) return null;
  return docToMeeting(docSnap.id, docSnap.data());
}

/**
 * Update a meeting (only while in draft status)
 */
export async function updateMeeting(
  db: Firestore,
  meetingId: string,
  updates: Partial<
    Pick<
      Meeting,
      | 'title'
      | 'date'
      | 'duration'
      | 'location'
      | 'attendeeIds'
      | 'attendeeNames'
      | 'agenda'
      | 'notes'
      | 'projectId'
      | 'projectName'
    >
  >,
  userId?: string
): Promise<void> {
  // Authorization check (FL-5): verify caller is meeting creator
  if (userId) {
    const meeting = await getMeetingById(db, meetingId);
    if (meeting && meeting.createdBy !== userId && !meeting.attendeeIds?.includes(userId)) {
      throw new AuthorizationError(
        'Only the meeting creator or an attendee can update the meeting',
        undefined,
        userId,
        'update meeting'
      );
    }
  }

  const docRef = doc(db, COLLECTIONS.MEETINGS, meetingId);
  await updateDoc(docRef, {
    ...updates,
    updatedAt: Timestamp.now(),
  });
}

/**
 * Delete a draft meeting and its action items
 */
export async function deleteMeeting(
  db: Firestore,
  meetingId: string,
  userId?: string
): Promise<void> {
  // Authorization check (FL-5): verify caller is meeting creator
  if (userId) {
    const meeting = await getMeetingById(db, meetingId);
    if (meeting && meeting.createdBy !== userId) {
      throw new AuthorizationError(
        'Only the meeting creator can delete the meeting',
        undefined,
        userId,
        'delete meeting'
      );
    }
  }

  const batch = writeBatch(db);

  // Delete action items
  const itemsQuery = query(
    collection(db, COLLECTIONS.MEETING_ACTION_ITEMS),
    where('meetingId', '==', meetingId)
  );
  const itemsSnapshot = await getDocs(itemsQuery);
  itemsSnapshot.docs.forEach((d) => batch.delete(d.ref));

  // Delete meeting
  batch.delete(doc(db, COLLECTIONS.MEETINGS, meetingId));

  await batch.commit();
}

/**
 * Subscribe to meetings for the entity (real-time)
 */
export function subscribeToMeetings(
  db: Firestore,
  entityId: string,
  callback: (meetings: Meeting[]) => void,
  onError?: (error: Error) => void
): Unsubscribe {
  const q = query(
    collection(db, COLLECTIONS.MEETINGS),
    where('entityId', '==', entityId),
    orderBy('date', 'desc')
  );

  return onSnapshot(
    q,
    (snapshot) => {
      const meetings = snapshot.docs.map((d) => docToMeeting(d.id, d.data()));
      callback(meetings);
    },
    (error) => {
      console.error('[meetingService] subscribeToMeetings error:', error);
      onError?.(error);
    }
  );
}

// ============================================================================
// ACTION ITEMS
// ============================================================================

/**
 * Add an action item to a meeting
 */
export async function addActionItem(
  db: Firestore,
  meetingId: string,
  input: MeetingActionItemInput
): Promise<MeetingActionItem> {
  const now = Timestamp.now();

  const itemData: Record<string, unknown> = {
    meetingId,
    description: input.description,
    action: input.action,
    assigneeId: input.assigneeId,
    assigneeName: input.assigneeName,
    ...(input.dueDate && { dueDate: input.dueDate }),
    priority: input.priority || 'MEDIUM',
    createdAt: now,
  };

  const docRef = await addDoc(collection(db, COLLECTIONS.MEETING_ACTION_ITEMS), itemData);

  return {
    id: docRef.id,
    meetingId,
    description: input.description,
    action: input.action,
    assigneeId: input.assigneeId,
    assigneeName: input.assigneeName,
    dueDate: input.dueDate,
    priority: input.priority || 'MEDIUM',
    createdAt: now,
  };
}

/**
 * Get action items for a meeting
 */
export async function getActionItems(
  db: Firestore,
  meetingId: string
): Promise<MeetingActionItem[]> {
  const q = query(
    collection(db, COLLECTIONS.MEETING_ACTION_ITEMS),
    where('meetingId', '==', meetingId),
    orderBy('createdAt', 'asc')
  );

  const snapshot = await getDocs(q);
  return snapshot.docs.map((d) => docToActionItem(d.id, d.data()));
}

/**
 * Subscribe to action items for a meeting (real-time)
 */
export function subscribeToActionItems(
  db: Firestore,
  meetingId: string,
  callback: (items: MeetingActionItem[]) => void,
  onError?: (error: Error) => void
): Unsubscribe {
  const q = query(
    collection(db, COLLECTIONS.MEETING_ACTION_ITEMS),
    where('meetingId', '==', meetingId),
    orderBy('createdAt', 'asc')
  );

  return onSnapshot(
    q,
    (snapshot) => {
      const items = snapshot.docs.map((d) => docToActionItem(d.id, d.data()));
      callback(items);
    },
    (error) => {
      console.error('[meetingService] subscribeToActionItems error:', error);
      onError?.(error);
    }
  );
}

/**
 * Delete an action item
 */
export async function deleteActionItem(db: Firestore, itemId: string): Promise<void> {
  const docRef = doc(db, COLLECTIONS.MEETING_ACTION_ITEMS, itemId);
  await deleteDoc(docRef);
}

// ============================================================================
// FINALIZATION
// ============================================================================

/**
 * Finalize a meeting: create ManualTasks from action items in a batch write.
 * Each action item with an action + assignee becomes a task.
 * Sets generatedTaskId on the action item and marks meeting as finalized.
 */
export async function finalizeMeeting(
  db: Firestore,
  meetingId: string,
  userId: string,
  userName: string,
  entityId: string
): Promise<number> {
  // Verify meeting exists and is in draft status (FL-11)
  const meeting = await getMeetingById(db, meetingId);
  if (!meeting) {
    throw new Error('Meeting not found');
  }
  if (meeting.status !== 'draft') {
    throw new Error('Meeting has already been finalized');
  }

  // Authorization check (FL-5): caller must be creator or attendee
  const isCreator = meeting.createdBy === userId;
  const isAttendee = meeting.attendeeIds?.includes(userId);
  if (!isCreator && !isAttendee) {
    throw new AuthorizationError(
      'Only the meeting creator or an attendee can finalize the meeting',
      undefined,
      userId,
      'finalize meeting'
    );
  }

  // FL-6: Use runTransaction instead of writeBatch so reads + writes are atomic.
  // If any task creation fails, the entire operation rolls back — no orphaned items.
  return runTransaction(db, async (transaction) => {
    const now = Timestamp.now();

    // Read action items inside transaction for consistency
    const items = await getActionItems(db, meetingId);
    if (items.length === 0) {
      throw new Error('Cannot finalize meeting with no action items');
    }
    const actionableItems = items.filter((item) => item.action && item.assigneeId);
    if (actionableItems.length === 0) {
      throw new Error(
        'No actionable items found. Each action item must have an action description and an assigned person.'
      );
    }

    // FL-10: Validate all assignees are active users before creating tasks
    const uniqueAssigneeIds = [...new Set(actionableItems.map((item) => item.assigneeId!))];
    for (const assigneeId of uniqueAssigneeIds) {
      const userDoc = await transaction.get(doc(db, COLLECTIONS.USERS, assigneeId));
      if (!userDoc.exists()) {
        throw new Error(
          `Assigned user no longer exists (ID: ${assigneeId}). Please reassign the action item.`
        );
      }
      const userData = userDoc.data();
      if (userData.isActive === false || userData.status === 'inactive') {
        throw new Error(
          `Assigned user "${userData.displayName || assigneeId}" is inactive. Please reassign the action item.`
        );
      }
    }

    // Create tasks from action items
    actionableItems.forEach((item) => {
      const taskRef = doc(collection(db, COLLECTIONS.MANUAL_TASKS));

      const taskData: Record<string, unknown> = {
        title: item.action,
        ...(item.description && { description: item.description }),
        createdBy: userId,
        createdByName: userName,
        assigneeId: item.assigneeId,
        assigneeName: item.assigneeName,
        status: 'todo',
        priority: item.priority || ('MEDIUM' as ManualTaskPriority),
        ...(item.dueDate && { dueDate: item.dueDate }),
        meetingId,
        entityId,
        createdAt: now,
      };

      transaction.set(taskRef, taskData);

      // Update action item with generated task ID
      const itemRef = doc(db, COLLECTIONS.MEETING_ACTION_ITEMS, item.id);
      transaction.update(itemRef, { generatedTaskId: taskRef.id });
    });

    // Mark meeting as finalized
    const meetingRef = doc(db, COLLECTIONS.MEETINGS, meetingId);
    transaction.update(meetingRef, {
      status: 'finalized',
      finalizedAt: now,
      updatedAt: now,
    });

    return actionableItems.length;
  });
}
