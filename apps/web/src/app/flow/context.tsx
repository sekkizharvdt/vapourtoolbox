'use client';

/**
 * Tasks Layout Context
 *
 * Provides shared state between TasksLayout and its children.
 * Separated from layout.tsx to avoid Next.js export restrictions.
 */

import { createContext, useContext } from 'react';
import type { TaskNotification, TaskWorkspace, DefaultTaskChannelId } from '@vapour/types';

export interface TasksLayoutContextValue {
  workspaces: TaskWorkspace[];
  selectedWorkspaceId: string | null;
  selectedChannelId: DefaultTaskChannelId | null;
  selectedView: 'channel' | 'my-tasks' | 'mentions';
  tasks: TaskNotification[];
  tasksByWorkspace: Record<string, TaskNotification[]>;
  isLoading: boolean;
  selectedWorkspaceName: string;
  onSelectChannel: (workspaceId: string, channelId: DefaultTaskChannelId) => void;
  onSelectMyTasks: () => void;
  onSelectMentions: () => void;
  onToggleSidebar: () => void;
  showSidebarToggle: boolean;
  refreshTasks: () => void;
}

// Create context for child components
export const TasksLayoutContext = createContext<TasksLayoutContextValue | null>(null);

export function useTasksLayout() {
  const context = useContext(TasksLayoutContext);
  if (!context) {
    throw new Error('useTasksLayout must be used within TasksLayout');
  }
  return context;
}
