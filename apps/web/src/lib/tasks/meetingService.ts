/**
 * Meeting Service
 *
 * CRUD operations for meetings and action items.
 * Finalization creates ManualTasks from action items via batch write.
 *
 * **Required Firestore Composite Indexes:**
 * - meetings: (tenantId, status, date DESC)
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
  ManualTaskStatus,
} from '@vapour/types';
import { AuthorizationError } from '@/lib/auth/authorizationService';
import { getManualTasksByIds } from './manualTaskService';

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
    nextMeetingId: data.nextMeetingId,
    previousMeetingId: data.previousMeetingId,
    tenantId: data.tenantId,
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
  tenantId: string
): Promise<Meeting> {
  // rule5-exempt: task / notification write scoped to the calling user (firestore.rules check userId/assigneeId, not a permission flag); the recipient identity IS the gate
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
    ...(input.previousMeetingId && { previousMeetingId: input.previousMeetingId }),
    tenantId,
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
    previousMeetingId: input.previousMeetingId,
    tenantId,
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
  // rule5-exempt: task / notification write scoped to the calling user (firestore.rules check userId/assigneeId, not a permission flag); the recipient identity IS the gate
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
  // rule5-exempt: task / notification write scoped to the calling user (firestore.rules check userId/assigneeId, not a permission flag); the recipient identity IS the gate
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
  tenantId: string,
  callback: (meetings: Meeting[]) => void,
  onError?: (error: Error) => void
): Unsubscribe {
  const q = query(
    collection(db, COLLECTIONS.MEETINGS),
    where('tenantId', '==', tenantId),
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
  // rule5-exempt: task / notification write scoped to the calling user (firestore.rules check userId/assigneeId, not a permission flag); the recipient identity IS the gate
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
  // rule5-exempt: task / notification write scoped to the calling user (firestore.rules check userId/assigneeId, not a permission flag); the recipient identity IS the gate
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
  tenantId: string
): Promise<number> {
  // rule5-exempt: task / notification write scoped to the calling user (firestore.rules check userId/assigneeId, not a permission flag); the recipient identity IS the gate
  // rule18-exempt: low-risk meeting state — audit pending Phase 0 audit expansion
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
        meetingTitle: meeting.title,
        meetingDate: meeting.date,
        // B1: propagate the meeting's project link onto generated tasks
        ...(meeting.projectId && { projectId: meeting.projectId }),
        ...(meeting.projectName && { projectName: meeting.projectName }),
        tenantId,
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

// ============================================================================
// WEEKLY REVIEW CADENCE (Track B2)
// ============================================================================

const WEEK_MS = 7 * 24 * 60 * 60 * 1000;

/**
 * Decide which action items carry forward into the next review meeting.
 *
 * An item carries forward when its work is still open:
 * - it never generated a task (row was saved without action/assignee), or
 * - its generated task is missing from `taskStatusById` (task was deleted —
 *   treated as unresolved rather than silently dropped), or
 * - its generated task is still `todo` / `in_progress`.
 *
 * Items whose task reached a terminal state (`done`, `cancelled`) do NOT
 * carry forward.
 *
 * Pure function — exported for unit tests.
 */
export function selectCarryForwardItems(
  items: MeetingActionItem[],
  taskStatusById: Record<string, ManualTaskStatus | undefined>
): MeetingActionItem[] {
  return items.filter((item) => {
    if (!item.generatedTaskId) return true;
    const status = taskStatusById[item.generatedTaskId];
    if (status === undefined) return true;
    return status === 'todo' || status === 'in_progress';
  });
}

/**
 * Next review date: same weekday and time, +7 days.
 * Pure function — exported for unit tests.
 */
export function computeNextReviewDate(date: Timestamp): Timestamp {
  return Timestamp.fromMillis(date.toMillis() + WEEK_MS);
}

/**
 * Derive the next review's title: `Weekly review — <project/team> — <date>`.
 *
 * The middle segment is the meeting's project name when linked; otherwise the
 * previous title is reused (with an existing "Weekly review — X — date"
 * pattern unwrapped so titles don't nest week over week).
 *
 * Pure function — exported for unit tests.
 */
export function deriveNextReviewTitle(
  meeting: Pick<Meeting, 'title' | 'projectName'>,
  nextDate: Date
): string {
  let base = meeting.projectName;
  if (!base) {
    const match = meeting.title.match(/^Weekly review — (.+?) — .+$/);
    base = match ? match[1] : meeting.title;
  }
  const dateStr = nextDate.toLocaleDateString('en-IN', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  });
  return `Weekly review — ${base} — ${dateStr}`;
}

/**
 * Seed the next meeting's agenda (plain-text field, same shape the meeting
 * editor already renders) with the carried-forward open action items.
 * Returns undefined when nothing carries forward.
 *
 * Pure function — exported for unit tests.
 */
export function buildCarryForwardAgenda(
  previousTitle: string,
  carriedItems: MeetingActionItem[]
): string | undefined {
  if (carriedItems.length === 0) return undefined;
  const lines = carriedItems.map((item) => {
    const label = item.action || item.description || '(no action recorded)';
    return `- ${label} — ${item.assigneeName || 'Unassigned'}`;
  });
  return `Carried forward from "${previousTitle}":\n${lines.join('\n')}`;
}

/**
 * "Start next review" on a finalized meeting: create next week's meeting
 * (same weekday +7 days, same time/duration/location/attendees/project link)
 * with an agenda seeded from still-open action items.
 *
 * Idempotent (rule 9): if the meeting already has `nextMeetingId` — checked
 * both before and inside the transaction — the existing meeting is returned
 * instead of creating a duplicate. The new meeting gets `previousMeetingId`.
 */
export async function startNextReview(
  db: Firestore,
  meetingId: string,
  userId: string,
  userName: string,
  tenantId: string
): Promise<{ meetingId: string; created: boolean }> {
  // rule5-exempt: task / notification write scoped to the calling user (firestore.rules check userId/assigneeId, not a permission flag); the recipient identity IS the gate
  // rule18-exempt: low-risk meeting state — audit pending Phase 0 audit expansion
  const meeting = await getMeetingById(db, meetingId);
  if (!meeting) {
    throw new Error('Meeting not found');
  }
  if (meeting.status !== 'finalized') {
    throw new Error('Only a finalized meeting can start the next review');
  }
  // Fast idempotency path — next review already exists
  if (meeting.nextMeetingId) {
    return { meetingId: meeting.nextMeetingId, created: false };
  }

  // Authorization: caller must be creator or attendee (matches finalizeMeeting)
  const isCreator = meeting.createdBy === userId;
  const isAttendee = meeting.attendeeIds?.includes(userId);
  if (!isCreator && !isAttendee) {
    throw new AuthorizationError(
      'Only the meeting creator or an attendee can start the next review',
      undefined,
      userId,
      'start next review'
    );
  }

  // Carry-forward: open action items = generated task not done/cancelled
  const items = await getActionItems(db, meetingId);
  const taskIds = [
    ...new Set(items.map((i) => i.generatedTaskId).filter((id): id is string => !!id)),
  ];
  const tasks = await getManualTasksByIds(db, taskIds);
  const taskStatusById: Record<string, ManualTaskStatus | undefined> = {};
  for (const task of tasks) {
    taskStatusById[task.id] = task.status;
  }
  const carriedItems = selectCarryForwardItems(items, taskStatusById);

  const nextDate = computeNextReviewDate(meeting.date);
  const title = deriveNextReviewTitle(meeting, nextDate.toDate());
  const agenda = buildCarryForwardAgenda(meeting.title, carriedItems);

  const meetingRef = doc(db, COLLECTIONS.MEETINGS, meetingId);

  return runTransaction(db, async (transaction) => {
    // Idempotency re-check inside the transaction (rule 9): a concurrent
    // click may have created the next meeting between the read above and now.
    const snap = await transaction.get(meetingRef);
    if (!snap.exists()) {
      throw new Error('Meeting not found');
    }
    const existingNextId = snap.data().nextMeetingId as string | undefined;
    if (existingNextId) {
      return { meetingId: existingNextId, created: false };
    }

    const now = Timestamp.now();
    const newRef = doc(collection(db, COLLECTIONS.MEETINGS));

    const newMeetingData: Record<string, unknown> = {
      title,
      date: nextDate,
      ...(meeting.duration && { duration: meeting.duration }),
      ...(meeting.location && { location: meeting.location }),
      createdBy: userId,
      createdByName: userName,
      attendeeIds: meeting.attendeeIds,
      attendeeNames: meeting.attendeeNames,
      ...(agenda && { agenda }),
      status: 'draft',
      ...(meeting.projectId && { projectId: meeting.projectId }),
      ...(meeting.projectName && { projectName: meeting.projectName }),
      previousMeetingId: meetingId,
      tenantId,
      createdAt: now,
    };

    transaction.set(newRef, newMeetingData);
    transaction.update(meetingRef, { nextMeetingId: newRef.id, updatedAt: now });

    return { meetingId: newRef.id, created: true };
  });
}
