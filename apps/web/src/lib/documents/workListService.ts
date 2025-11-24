/**
 * Work List Service
 *
 * Manages work items linked to master documents
 * Creates task notifications for work assignments
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
  Timestamp,
  type QueryConstraint,
} from 'firebase/firestore';
import { getFirebase } from '@/lib/firebase';
import type { WorkItem, WorkItemStatus } from '@vapour/types';

// Helper to get database instance
const getDb = () => getFirebase().db;

/**
 * Add work item to master document
 */
export async function addWorkItem(
  data: Omit<WorkItem, 'id' | 'createdAt' | 'updatedAt' | 'isDeleted' | 'taskCreated'>
): Promise<string> {
  const now = Timestamp.now();

  const workItemData: Omit<WorkItem, 'id'> = {
    ...data,
    status: data.status || 'PENDING',
    taskCreated: false,
    attachments: data.attachments || [],
    createdAt: now,
    updatedAt: now,
    isDeleted: false,
  };

  const docRef = await addDoc(
    collection(getDb(), 'projects', data.projectId, 'workItems'),
    workItemData
  );

  // Update master document work item count
  await incrementWorkItemCount(data.projectId, data.masterDocumentId);

  return docRef.id;
}

/**
 * Update work item
 */
export async function updateWorkItem(
  projectId: string,
  workItemId: string,
  updates: Partial<Omit<WorkItem, 'id' | 'projectId' | 'createdAt'>>
): Promise<void> {
  const docRef = doc(getDb(), 'projects', projectId, 'workItems', workItemId);

  await updateDoc(docRef, {
    ...updates,
    updatedAt: Timestamp.now(),
  });
}

/**
 * Assign work item to user
 */
export async function assignWorkItem(
  projectId: string,
  workItemId: string,
  assignedTo: string,
  assignedToName: string,
  assignedBy: string
): Promise<void> {
  await updateWorkItem(projectId, workItemId, {
    assignedTo,
    assignedToName,
    assignedBy,
    assignedAt: Timestamp.now(),
    status: 'IN_PROGRESS',
  });
}

/**
 * Link work item to task notification
 */
export async function linkWorkItemToTask(
  projectId: string,
  workItemId: string,
  taskId: string
): Promise<void> {
  await updateWorkItem(projectId, workItemId, {
    linkedTaskId: taskId,
    taskCreated: true,
    taskCreatedAt: Timestamp.now(),
  });
}

/**
 * Complete work item
 */
export async function completeWorkItem(
  projectId: string,
  workItemId: string,
  completedBy: string,
  completedByName: string,
  completionNotes?: string
): Promise<void> {
  await updateWorkItem(projectId, workItemId, {
    status: 'COMPLETED',
    completedBy,
    completedByName,
    completedAt: Timestamp.now(),
    completionNotes,
  });
}

/**
 * Get work item by ID
 */
export async function getWorkItemById(
  projectId: string,
  workItemId: string
): Promise<WorkItem | null> {
  const docRef = doc(getDb(), 'projects', projectId, 'workItems', workItemId);
  const docSnap = await getDoc(docRef);

  if (!docSnap.exists()) {
    return null;
  }

  const docData = docSnap.data() as Omit<WorkItem, 'id'>;
  const data: WorkItem = {
    id: docSnap.id,
    ...docData,
  };

  return data;
}

/**
 * Get work items for a master document
 */
export async function getWorkItemsByDocument(
  projectId: string,
  masterDocumentId: string
): Promise<WorkItem[]> {
  const q = query(
    collection(getDb(), 'projects', projectId, 'workItems'),
    where('masterDocumentId', '==', masterDocumentId),
    where('isDeleted', '==', false),
    orderBy('createdAt', 'asc')
  );

  const querySnapshot = await getDocs(q);

  return querySnapshot.docs.map((doc) => ({
    id: doc.id,
    ...doc.data(),
  })) as WorkItem[];
}

/**
 * Get work items by assignee
 */
export async function getWorkItemsByAssignee(
  projectId: string,
  assignedTo: string,
  status?: WorkItemStatus
): Promise<WorkItem[]> {
  const constraints: QueryConstraint[] = [
    where('assignedTo', '==', assignedTo),
    where('isDeleted', '==', false),
  ];

  if (status) {
    constraints.push(where('status', '==', status));
  }

  constraints.push(orderBy('dueDate', 'asc'));

  const q = query(collection(getDb(), 'projects', projectId, 'workItems'), ...constraints);

  const querySnapshot = await getDocs(q);

  return querySnapshot.docs.map((doc) => ({
    id: doc.id,
    ...doc.data(),
  })) as WorkItem[];
}

/**
 * Soft delete work item
 */
export async function deleteWorkItem(projectId: string, workItemId: string): Promise<void> {
  const item = await getWorkItemById(projectId, workItemId);

  if (!item) {
    throw new Error('Work item not found');
  }

  await updateWorkItem(projectId, workItemId, {
    isDeleted: true,
  });

  // Decrement master document work item count
  await decrementWorkItemCount(projectId, item.masterDocumentId);
}

/**
 * Increment work item count on master document
 */
async function incrementWorkItemCount(projectId: string, masterDocumentId: string): Promise<void> {
  const docRef = doc(getDb(), 'projects', projectId, 'masterDocuments', masterDocumentId);
  const docSnap = await getDoc(docRef);

  if (docSnap.exists()) {
    const currentCount = docSnap.data().workItemCount || 0;
    await updateDoc(docRef, {
      hasWorkList: true,
      workItemCount: currentCount + 1,
      updatedAt: Timestamp.now(),
    });
  }
}

/**
 * Decrement work item count on master document
 */
async function decrementWorkItemCount(projectId: string, masterDocumentId: string): Promise<void> {
  const docRef = doc(getDb(), 'projects', projectId, 'masterDocuments', masterDocumentId);
  const docSnap = await getDoc(docRef);

  if (docSnap.exists()) {
    const currentCount = docSnap.data().workItemCount || 0;
    const newCount = Math.max(0, currentCount - 1);
    await updateDoc(docRef, {
      hasWorkList: newCount > 0,
      workItemCount: newCount,
      updatedAt: Timestamp.now(),
    });
  }
}

/**
 * Get work items summary for project
 */
export async function getWorkItemsSummary(projectId: string): Promise<{
  total: number;
  pending: number;
  inProgress: number;
  completed: number;
  cancelled: number;
}> {
  const q = query(
    collection(getDb(), 'projects', projectId, 'workItems'),
    where('isDeleted', '==', false)
  );

  const querySnapshot = await getDocs(q);
  const items = querySnapshot.docs.map((doc) => doc.data() as WorkItem);

  return {
    total: items.length,
    pending: items.filter((i) => i.status === 'PENDING').length,
    inProgress: items.filter((i) => i.status === 'IN_PROGRESS').length,
    completed: items.filter((i) => i.status === 'COMPLETED').length,
    cancelled: items.filter((i) => i.status === 'CANCELLED').length,
  };
}
