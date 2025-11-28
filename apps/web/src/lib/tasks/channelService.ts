/**
 * Channel Service
 *
 * Provides utilities for organizing tasks into channels (Slack-like interface)
 * - Default channels (procurement, documents, accounting, etc.)
 * - Custom project channels
 * - Channel grouping helpers
 */

import {
  collection,
  addDoc,
  getDocs,
  query,
  where,
  orderBy,
  Timestamp,
  onSnapshot,
  type QueryConstraint,
  type Unsubscribe,
} from 'firebase/firestore';
import { getFirebase } from '@/lib/firebase';
import { COLLECTIONS } from '@vapour/firebase';
import type {
  TaskNotification,
  TaskChannel,
  TaskWorkspace,
  ProjectChannel,
  DefaultTaskChannelId,
} from '@vapour/types';
import {
  TASK_CHANNEL_DEFINITIONS,
  getChannelIdFromCategory,
  isApprovalCategory,
} from '@vapour/types';
import type { DocumentData } from 'firebase/firestore';

// ============================================================================
// HELPER FUNCTIONS
// ============================================================================

/**
 * Convert Firestore document to TaskNotification
 */
function docToTaskNotification(id: string, data: DocumentData): TaskNotification {
  return {
    id,
    // Classification
    type: data.type,
    category: data.category,
    // Assignment
    userId: data.userId,
    assignedBy: data.assignedBy,
    assignedByName: data.assignedByName,
    // Content
    title: data.title,
    message: data.message,
    priority: data.priority,
    // Linking
    projectId: data.projectId,
    equipmentId: data.equipmentId,
    entityType: data.entityType,
    entityId: data.entityId,
    linkUrl: data.linkUrl,
    // Status
    status: data.status,
    read: data.read,
    // Time Tracking
    timeStarted: data.timeStarted,
    timeCompleted: data.timeCompleted,
    totalDuration: data.totalDuration,
    // Acknowledgement
    acknowledgedAt: data.acknowledgedAt,
    // Auto-completion
    autoCompletable: data.autoCompletable,
    autoCompletedAt: data.autoCompletedAt,
    manuallyCompletedAt: data.manuallyCompletedAt,
    completionConfirmed: data.completionConfirmed,
    // Metadata
    metadata: data.metadata,
    // Timestamps
    createdAt: data.createdAt,
    updatedAt: data.updatedAt,
  };
}

// ============================================================================
// DEFAULT CHANNELS
// ============================================================================

/**
 * Get default channels for a project workspace
 * Filters channels based on user's module permissions
 */
export function getDefaultChannelsForProject(_modulePermissions?: string[]): TaskChannel[] {
  // For now, return all channels. Later we can filter based on permissions
  const projectChannels: DefaultTaskChannelId[] = [
    'general',
    'procurement',
    'documents',
    'accounting',
    'approvals',
  ];

  return projectChannels.map((id) => TASK_CHANNEL_DEFINITIONS[id]);
}

/**
 * Get default channels for Pre-Sales workspace
 */
export function getPreSalesChannels(): TaskChannel[] {
  const preSalesChannelIds: DefaultTaskChannelId[] = ['enquiries', 'proposals'];
  return preSalesChannelIds.map((id) => TASK_CHANNEL_DEFINITIONS[id]);
}

// ============================================================================
// CUSTOM CHANNELS (for future use)
// ============================================================================

/**
 * Get custom channels for a project
 */
export async function getProjectCustomChannels(projectId: string): Promise<ProjectChannel[]> {
  const { db } = getFirebase();

  try {
    const q = query(
      collection(db, COLLECTIONS.PROJECT_CHANNELS),
      where('projectId', '==', projectId),
      orderBy('createdAt', 'asc')
    );

    const snapshot = await getDocs(q);
    const channels: ProjectChannel[] = [];

    snapshot.forEach((docSnap) => {
      channels.push({
        id: docSnap.id,
        ...docSnap.data(),
      } as ProjectChannel);
    });

    return channels;
  } catch (error) {
    console.error('[getProjectCustomChannels] Error:', error);
    return [];
  }
}

/**
 * Create a custom channel for a project
 */
export async function createProjectChannel(
  projectId: string,
  name: string,
  description: string,
  createdBy: string
): Promise<string> {
  const { db } = getFirebase();

  try {
    const channelData: Omit<ProjectChannel, 'id'> = {
      projectId,
      name,
      description,
      isDefault: false,
      createdBy,
      createdAt: Timestamp.now(),
    };

    const docRef = await addDoc(collection(db, COLLECTIONS.PROJECT_CHANNELS), channelData);
    return docRef.id;
  } catch (error) {
    console.error('[createProjectChannel] Error:', error);
    throw new Error('Failed to create project channel');
  }
}

// ============================================================================
// TASK GROUPING BY CHANNEL
// ============================================================================

/**
 * Group tasks by channel ID
 */
export function groupTasksByChannel(tasks: TaskNotification[]): Record<string, TaskNotification[]> {
  const grouped: Record<string, TaskNotification[]> = {};

  tasks.forEach((task) => {
    const channelId = getChannelIdFromCategory(task.category);

    if (!grouped[channelId]) {
      grouped[channelId] = [];
    }
    grouped[channelId].push(task);

    // Also add to approvals channel if it's an approval task
    if (isApprovalCategory(task.category) && channelId !== 'approvals') {
      if (!grouped['approvals']) {
        grouped['approvals'] = [];
      }
      grouped['approvals'].push(task);
    }
  });

  return grouped;
}

/**
 * Group tasks by project and channel
 */
export function groupTasksByProjectAndChannel(
  tasks: TaskNotification[]
): Record<string, Record<string, TaskNotification[]>> {
  const grouped: Record<string, Record<string, TaskNotification[]>> = {};

  tasks.forEach((task) => {
    const projectId = task.projectId || 'pre-sales';
    const channelId = getChannelIdFromCategory(task.category);

    if (!grouped[projectId]) {
      grouped[projectId] = {};
    }

    if (!grouped[projectId][channelId]) {
      grouped[projectId][channelId] = [];
    }

    grouped[projectId][channelId].push(task);

    // Also add to approvals channel if it's an approval task
    if (isApprovalCategory(task.category) && channelId !== 'approvals') {
      if (!grouped[projectId]['approvals']) {
        grouped[projectId]['approvals'] = [];
      }
      grouped[projectId]['approvals'].push(task);
    }
  });

  return grouped;
}

/**
 * Get tasks for a specific project and channel
 */
export async function getTasksByProjectAndChannel(
  userId: string,
  projectId: string | null,
  channelId: DefaultTaskChannelId
): Promise<TaskNotification[]> {
  const { db } = getFirebase();

  try {
    const constraints: QueryConstraint[] = [where('userId', '==', userId)];

    // Project filter
    if (projectId === 'pre-sales') {
      // For pre-sales, get tasks without a projectId
      constraints.push(where('projectId', '==', ''));
    } else if (projectId) {
      constraints.push(where('projectId', '==', projectId));
    }

    // Get channel definition
    const channel = TASK_CHANNEL_DEFINITIONS[channelId];

    // Order by creation date
    constraints.push(orderBy('createdAt', 'desc'));

    const q = query(collection(db, COLLECTIONS.TASK_NOTIFICATIONS), ...constraints);
    const snapshot = await getDocs(q);

    const tasks: TaskNotification[] = [];
    snapshot.forEach((docSnap) => {
      const task = docToTaskNotification(docSnap.id, docSnap.data());

      // Filter by channel categories (client-side because of Firestore limitations)
      if (channelId === 'approvals') {
        if (isApprovalCategory(task.category)) {
          tasks.push(task);
        }
      } else if (channel.categories.includes(task.category)) {
        tasks.push(task);
      }
    });

    return tasks;
  } catch (error) {
    console.error('[getTasksByProjectAndChannel] Error:', error);
    throw new Error('Failed to get tasks by project and channel');
  }
}

// ============================================================================
// WORKSPACE UTILITIES
// ============================================================================

/**
 * Build workspace list from projects
 */
export function buildWorkspaces(
  projects: Array<{ id: string; name: string; projectNumber?: string }>,
  tasksByProject: Record<string, TaskNotification[]>
): TaskWorkspace[] {
  const workspaces: TaskWorkspace[] = [];

  // Add project workspaces
  projects.forEach((project) => {
    const projectTasks = tasksByProject[project.id] || [];
    const unreadCount = projectTasks.filter((t) => !t.read).length;

    workspaces.push({
      id: project.id,
      name: project.projectNumber ? `${project.projectNumber} - ${project.name}` : project.name,
      type: 'project',
      channels: getDefaultChannelsForProject(),
      unreadCount,
    });
  });

  // Add Pre-Sales workspace
  const preSalesTasks = tasksByProject['pre-sales'] || [];
  const preSalesUnread = preSalesTasks.filter((t) => !t.read).length;

  workspaces.push({
    id: 'pre-sales',
    name: 'Pre-Sales',
    type: 'pre-sales',
    channels: getPreSalesChannels(),
    unreadCount: preSalesUnread,
  });

  return workspaces;
}

/**
 * Get unread count per channel for a project
 */
export function getChannelUnreadCounts(
  tasks: TaskNotification[],
  channels: TaskChannel[]
): Record<string, number> {
  const counts: Record<string, number> = {};

  channels.forEach((channel) => {
    counts[channel.id] = 0;
  });

  tasks.forEach((task) => {
    if (!task.read) {
      const channelId = getChannelIdFromCategory(task.category);
      if (counts[channelId] !== undefined) {
        counts[channelId]++;
      }

      // Also count for approvals channel
      if (isApprovalCategory(task.category) && counts['approvals'] !== undefined) {
        counts['approvals']++;
      }
    }
  });

  return counts;
}

// ============================================================================
// REAL-TIME SUBSCRIPTIONS
// ============================================================================

/**
 * Subscribe to tasks for a specific project
 */
export function subscribeToProjectTasks(
  userId: string,
  projectId: string | null,
  onUpdate: (tasks: TaskNotification[]) => void
): Unsubscribe {
  const { db } = getFirebase();

  const constraints: QueryConstraint[] = [
    where('userId', '==', userId),
    orderBy('createdAt', 'desc'),
  ];

  if (projectId === 'pre-sales') {
    constraints.push(where('projectId', '==', ''));
  } else if (projectId) {
    constraints.push(where('projectId', '==', projectId));
  }

  const q = query(collection(db, COLLECTIONS.TASK_NOTIFICATIONS), ...constraints);

  return onSnapshot(
    q,
    (snapshot) => {
      const tasks: TaskNotification[] = [];
      snapshot.forEach((docSnap) => {
        tasks.push(docToTaskNotification(docSnap.id, docSnap.data()));
      });
      onUpdate(tasks);
    },
    (error) => {
      console.error('[subscribeToProjectTasks] Error:', error);
    }
  );
}

/**
 * Subscribe to all tasks for a user (for My Tasks view)
 */
export function subscribeToUserTasks(
  userId: string,
  onUpdate: (tasks: TaskNotification[]) => void
): Unsubscribe {
  const { db } = getFirebase();

  const q = query(
    collection(db, COLLECTIONS.TASK_NOTIFICATIONS),
    where('userId', '==', userId),
    where('status', 'in', ['pending', 'in_progress']),
    orderBy('createdAt', 'desc')
  );

  return onSnapshot(
    q,
    (snapshot) => {
      const tasks: TaskNotification[] = [];
      snapshot.forEach((docSnap) => {
        tasks.push(docToTaskNotification(docSnap.id, docSnap.data()));
      });
      onUpdate(tasks);
    },
    (error) => {
      console.error('[subscribeToUserTasks] Error:', error);
    }
  );
}
