/**
 * Work Item Service
 *
 * Handles work item operations for documents:
 * - Creating work items
 * - Updating work item status
 * - Deleting work items
 * - Task integration (when implemented)
 */

import {
  collection,
  doc,
  addDoc,
  updateDoc,
  deleteDoc,
  getDocs,
  query,
  where,
  orderBy,
  Timestamp,
  type Firestore,
} from 'firebase/firestore';
import type { WorkItem, WorkActivityType, WorkItemStatus } from '@vapour/types';

/**
 * Create a new work item
 */
export interface CreateWorkItemRequest {
  projectId: string;
  masterDocumentId: string;
  documentNumber: string;
  activityName: string;
  activityType: WorkActivityType;
  description: string;
  assignedTo?: string;
  assignedToName?: string;
  plannedStartDate?: Date;
  dueDate?: Date;
  estimatedHours?: number;
  createdBy: string;
  createdByName: string;
}

export async function createWorkItem(
  db: Firestore,
  request: CreateWorkItemRequest
): Promise<string> {
  const workItem: Omit<WorkItem, 'id'> = {
    projectId: request.projectId,
    masterDocumentId: request.masterDocumentId,
    documentNumber: request.documentNumber,

    // Activity Details
    activityName: request.activityName,
    activityType: request.activityType,
    description: request.description,

    // Assignment
    assignedTo: request.assignedTo,
    assignedToName: request.assignedToName,
    assignedBy: request.assignedTo ? request.createdBy : undefined,
    assignedAt: request.assignedTo ? Timestamp.now() : undefined,

    // Deadlines
    plannedStartDate: request.plannedStartDate
      ? Timestamp.fromDate(request.plannedStartDate)
      : undefined,
    dueDate: request.dueDate ? Timestamp.fromDate(request.dueDate) : undefined,

    // Status
    status: 'PENDING' as WorkItemStatus,

    // Task Integration
    taskCreated: false,

    // Time Tracking
    estimatedHours: request.estimatedHours,

    // Attachments
    attachments: [],

    // Audit
    createdBy: request.createdBy,
    createdByName: request.createdByName,
    createdAt: Timestamp.now(),
    updatedAt: Timestamp.now(),

    isDeleted: false,
  };

  const workItemsRef = collection(db, 'projects', request.projectId, 'workItems');
  const docRef = await addDoc(workItemsRef, workItem);

  console.log('[WorkItemService] Created work item:', docRef.id);
  return docRef.id;
}

/**
 * Update work item status
 */
export interface UpdateWorkItemStatusRequest {
  projectId: string;
  workItemId: string;
  status: WorkItemStatus;
  completedBy?: string;
  completedByName?: string;
}

export async function updateWorkItemStatus(
  db: Firestore,
  request: UpdateWorkItemStatusRequest
): Promise<void> {
  const workItemRef = doc(db, 'projects', request.projectId, 'workItems', request.workItemId);

  const updates: Record<string, unknown> = {
    status: request.status,
    updatedAt: Timestamp.now(),
  };

  // Set completion timestamp if completed
  if (request.status === 'COMPLETED' && request.completedBy) {
    updates.completedAt = Timestamp.now();
    updates.completedBy = request.completedBy;
    updates.completedByName = request.completedByName;
  }

  await updateDoc(workItemRef, updates);
  console.log('[WorkItemService] Updated work item status:', request.workItemId, request.status);
}

/**
 * Update work item assignment
 */
export interface UpdateWorkItemAssignmentRequest {
  projectId: string;
  workItemId: string;
  assignedTo: string;
  assignedToName: string;
  assignedBy: string;
}

export async function updateWorkItemAssignment(
  db: Firestore,
  request: UpdateWorkItemAssignmentRequest
): Promise<void> {
  const workItemRef = doc(db, 'projects', request.projectId, 'workItems', request.workItemId);

  await updateDoc(workItemRef, {
    assignedTo: request.assignedTo,
    assignedToName: request.assignedToName,
    assignedBy: request.assignedBy,
    assignedAt: Timestamp.now(),
    updatedAt: Timestamp.now(),
  });

  console.log('[WorkItemService] Updated work item assignment:', request.workItemId);
}

/**
 * Delete a work item
 */
export async function deleteWorkItem(
  db: Firestore,
  projectId: string,
  workItemId: string
): Promise<void> {
  const workItemRef = doc(db, 'projects', projectId, 'workItems', workItemId);
  await deleteDoc(workItemRef);
  console.log('[WorkItemService] Deleted work item:', workItemId);
}

/**
 * Get work items for a document
 */
export async function getDocumentWorkItems(
  db: Firestore,
  projectId: string,
  masterDocumentId: string
): Promise<WorkItem[]> {
  const workItemsRef = collection(db, 'projects', projectId, 'workItems');
  const q = query(
    workItemsRef,
    where('masterDocumentId', '==', masterDocumentId),
    orderBy('createdAt', 'desc')
  );

  const snapshot = await getDocs(q);
  const items: WorkItem[] = [];

  snapshot.forEach((doc) => {
    items.push({ id: doc.id, ...doc.data() } as WorkItem);
  });

  return items;
}

/**
 * Get work items by status
 */
export async function getWorkItemsByStatus(
  db: Firestore,
  projectId: string,
  status: WorkItemStatus
): Promise<WorkItem[]> {
  const workItemsRef = collection(db, 'projects', projectId, 'workItems');
  const q = query(workItemsRef, where('status', '==', status), orderBy('dueDate', 'asc'));

  const snapshot = await getDocs(q);
  const items: WorkItem[] = [];

  snapshot.forEach((doc) => {
    items.push({ id: doc.id, ...doc.data() } as WorkItem);
  });

  return items;
}
