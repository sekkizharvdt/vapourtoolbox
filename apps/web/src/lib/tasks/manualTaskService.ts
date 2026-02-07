/**
 * Manual Task Service
 *
 * CRUD operations and real-time subscriptions for user-created tasks.
 * These are standalone tasks (not system notifications) that can optionally
 * link to projects, proposals, or meetings.
 *
 * **Required Firestore Composite Indexes:**
 * - manualTasks: (entityId, assigneeId, status, createdAt DESC)
 * - manualTasks: (entityId, status, createdAt DESC)
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
  limit as firestoreLimit,
  onSnapshot,
  Timestamp,
  type Firestore,
  type DocumentData,
  type QueryConstraint,
  type Unsubscribe,
} from 'firebase/firestore';
import { COLLECTIONS } from '@vapour/firebase';
import type {
  ManualTask,
  ManualTaskStatus,
  CreateManualTaskInput,
  ManualTaskFilters,
} from '@vapour/types';
import { AuthorizationError } from '@/lib/auth/authorizationService';

// ============================================================================
// HELPERS
// ============================================================================

function docToManualTask(id: string, data: DocumentData): ManualTask {
  return {
    id,
    title: data.title,
    description: data.description,
    createdBy: data.createdBy,
    createdByName: data.createdByName,
    assigneeId: data.assigneeId,
    assigneeName: data.assigneeName,
    status: data.status,
    priority: data.priority,
    dueDate: data.dueDate,
    completedAt: data.completedAt,
    projectId: data.projectId,
    projectName: data.projectName,
    proposalId: data.proposalId,
    meetingId: data.meetingId,
    tags: data.tags,
    entityId: data.entityId,
    createdAt: data.createdAt,
    updatedAt: data.updatedAt,
  };
}

// ============================================================================
// CREATE
// ============================================================================

/**
 * Create a new manual task
 */
export async function createManualTask(
  db: Firestore,
  input: CreateManualTaskInput,
  userId: string,
  userName: string,
  entityId: string
): Promise<ManualTask> {
  const now = Timestamp.now();

  const taskData: Record<string, unknown> = {
    title: input.title,
    ...(input.description && { description: input.description }),
    createdBy: userId,
    createdByName: userName,
    assigneeId: input.assigneeId,
    assigneeName: input.assigneeName,
    status: 'todo',
    priority: input.priority || 'MEDIUM',
    ...(input.dueDate && { dueDate: input.dueDate }),
    ...(input.projectId && { projectId: input.projectId }),
    ...(input.projectName && { projectName: input.projectName }),
    ...(input.proposalId && { proposalId: input.proposalId }),
    ...(input.meetingId && { meetingId: input.meetingId }),
    ...(input.tags && input.tags.length > 0 && { tags: input.tags }),
    entityId,
    createdAt: now,
  };

  const docRef = await addDoc(collection(db, COLLECTIONS.MANUAL_TASKS), taskData);

  return {
    id: docRef.id,
    title: input.title,
    description: input.description,
    createdBy: userId,
    createdByName: userName,
    assigneeId: input.assigneeId,
    assigneeName: input.assigneeName,
    status: 'todo',
    priority: input.priority || 'MEDIUM',
    dueDate: input.dueDate,
    projectId: input.projectId,
    projectName: input.projectName,
    proposalId: input.proposalId,
    meetingId: input.meetingId,
    tags: input.tags,
    entityId,
    createdAt: now,
  };
}

// ============================================================================
// READ
// ============================================================================

/**
 * Get a single manual task by ID
 */
export async function getManualTaskById(db: Firestore, taskId: string): Promise<ManualTask | null> {
  const docRef = doc(db, COLLECTIONS.MANUAL_TASKS, taskId);
  const docSnap = await getDoc(docRef);

  if (!docSnap.exists()) return null;
  return docToManualTask(docSnap.id, docSnap.data());
}

/**
 * Get tasks assigned to a specific user
 */
export async function getMyTasks(
  db: Firestore,
  filters: ManualTaskFilters & { entityId: string }
): Promise<ManualTask[]> {
  const constraints: QueryConstraint[] = [where('entityId', '==', filters.entityId)];

  if (filters.assigneeId) {
    constraints.push(where('assigneeId', '==', filters.assigneeId));
  }

  if (filters.status) {
    constraints.push(where('status', '==', filters.status));
  }

  if (filters.projectId) {
    constraints.push(where('projectId', '==', filters.projectId));
  }

  if (filters.meetingId) {
    constraints.push(where('meetingId', '==', filters.meetingId));
  }

  constraints.push(orderBy('createdAt', 'desc'));

  if (filters.limit) {
    constraints.push(firestoreLimit(filters.limit));
  }

  const q = query(collection(db, COLLECTIONS.MANUAL_TASKS), ...constraints);
  const snapshot = await getDocs(q);

  return snapshot.docs.map((d) => docToManualTask(d.id, d.data()));
}

/**
 * Get all active tasks for the entity (team view)
 */
export async function getTeamTasks(
  db: Firestore,
  entityId: string,
  statusFilter?: ManualTaskStatus
): Promise<ManualTask[]> {
  const constraints: QueryConstraint[] = [where('entityId', '==', entityId)];

  if (statusFilter) {
    constraints.push(where('status', '==', statusFilter));
  }

  constraints.push(orderBy('createdAt', 'desc'));

  const q = query(collection(db, COLLECTIONS.MANUAL_TASKS), ...constraints);
  const snapshot = await getDocs(q);

  return snapshot.docs.map((d) => docToManualTask(d.id, d.data()));
}

// ============================================================================
// REAL-TIME SUBSCRIPTIONS
// ============================================================================

/**
 * Subscribe to tasks assigned to the current user (real-time)
 */
export function subscribeToMyTasks(
  db: Firestore,
  entityId: string,
  assigneeId: string,
  callback: (tasks: ManualTask[]) => void,
  onError?: (error: Error) => void
): Unsubscribe {
  const q = query(
    collection(db, COLLECTIONS.MANUAL_TASKS),
    where('entityId', '==', entityId),
    where('assigneeId', '==', assigneeId),
    orderBy('createdAt', 'desc')
  );

  return onSnapshot(
    q,
    (snapshot) => {
      const tasks = snapshot.docs.map((d) => docToManualTask(d.id, d.data()));
      callback(tasks);
    },
    (error) => {
      console.error('[manualTaskService] subscribeToMyTasks error:', error);
      onError?.(error);
    }
  );
}

/**
 * Subscribe to all active tasks for the entity (team board, real-time)
 */
export function subscribeToTeamTasks(
  db: Firestore,
  entityId: string,
  callback: (tasks: ManualTask[]) => void,
  onError?: (error: Error) => void
): Unsubscribe {
  const q = query(
    collection(db, COLLECTIONS.MANUAL_TASKS),
    where('entityId', '==', entityId),
    where('status', 'in', ['todo', 'in_progress']),
    orderBy('createdAt', 'desc')
  );

  return onSnapshot(
    q,
    (snapshot) => {
      const tasks = snapshot.docs.map((d) => docToManualTask(d.id, d.data()));
      callback(tasks);
    },
    (error) => {
      console.error('[manualTaskService] subscribeToTeamTasks error:', error);
      onError?.(error);
    }
  );
}

// ============================================================================
// UPDATE
// ============================================================================

/**
 * Update a manual task
 */
export async function updateManualTask(
  db: Firestore,
  taskId: string,
  updates: Partial<
    Pick<
      ManualTask,
      | 'title'
      | 'description'
      | 'assigneeId'
      | 'assigneeName'
      | 'priority'
      | 'dueDate'
      | 'projectId'
      | 'projectName'
      | 'tags'
    >
  >,
  userId?: string
): Promise<void> {
  // Authorization check (FL-2): verify caller is task creator or current assignee
  if (userId) {
    const task = await getManualTaskById(db, taskId);
    if (task && task.createdBy !== userId && task.assigneeId !== userId) {
      throw new AuthorizationError(
        'Only the task creator or current assignee can update this task',
        undefined,
        userId,
        'update task'
      );
    }
  }

  const docRef = doc(db, COLLECTIONS.MANUAL_TASKS, taskId);
  await updateDoc(docRef, {
    ...updates,
    updatedAt: Timestamp.now(),
  });
}

/**
 * Update task status with auto-timestamping
 */
export async function updateTaskStatus(
  db: Firestore,
  taskId: string,
  status: ManualTaskStatus
): Promise<void> {
  const docRef = doc(db, COLLECTIONS.MANUAL_TASKS, taskId);
  const now = Timestamp.now();

  const updates: Record<string, unknown> = {
    status,
    updatedAt: now,
  };

  if (status === 'done') {
    updates.completedAt = now;
  }

  await updateDoc(docRef, updates);
}

// ============================================================================
// DELETE
// ============================================================================

/**
 * Delete a manual task
 */
export async function deleteManualTask(db: Firestore, taskId: string): Promise<void> {
  const docRef = doc(db, COLLECTIONS.MANUAL_TASKS, taskId);
  await deleteDoc(docRef);
}
