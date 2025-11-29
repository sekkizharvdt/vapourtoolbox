'use client';

/**
 * Tasks Page
 *
 * Slack-like task management with project channels, threaded discussions,
 * and real-time updates. Shows tasks filtered by selected workspace/channel.
 */

import React, { useState, useCallback, useEffect } from 'react';
import { Box, Alert, Snackbar } from '@mui/material';
import { collection, query, where, orderBy, onSnapshot } from 'firebase/firestore';
import { useAuth } from '@/contexts/AuthContext';
import { useTasksLayout } from './context';
import { ChannelView } from './components/ChannelView';
import { TimerWidget } from '@/components/tasks';
import { TaskThreadPanel, MentionsView } from '@/components/tasks/thread';
import { startActionableTask, completeActionableTask } from '@/lib/tasks/taskNotificationService';
import {
  startTimeEntry,
  stopTimeEntry,
  pauseTimeEntry,
  resumeTimeEntry,
  getActiveTimeEntry,
} from '@/lib/tasks/timeEntryService';
import { getFirebase } from '@/lib/firebase';
import { COLLECTIONS } from '@vapour/firebase';
import type { TimeEntry, TaskNotification, User, TaskMention } from '@vapour/types';

export default function TasksPage() {
  const { user } = useAuth();
  const {
    tasks,
    selectedWorkspaceId,
    selectedChannelId,
    selectedView,
    selectedWorkspaceName,
    tasksByWorkspace,
    isLoading,
    onToggleSidebar,
    showSidebarToggle,
  } = useTasksLayout();

  // Error state
  const [error, setError] = useState<string | null>(null);

  // Active timer state
  const [activeEntry, setActiveEntry] = useState<TimeEntry | null>(null);
  const [activeTask, setActiveTask] = useState<TaskNotification | null>(null);

  // Thread panel state (Phase C)
  const [selectedTaskForThread, setSelectedTaskForThread] = useState<TaskNotification | null>(null);
  const [threadPanelOpen, setThreadPanelOpen] = useState(false);

  // Users for @mention autocomplete (Phase C)
  const [users, setUsers] = useState<User[]>([]);

  // Load active timer on mount
  useEffect(() => {
    async function loadActiveEntry() {
      if (!user) return;
      try {
        const entry = await getActiveTimeEntry(user.uid);
        setActiveEntry(entry);
        if (entry) {
          const task = tasks.find((t) => t.id === entry.taskNotificationId);
          setActiveTask(task || null);
        }
      } catch (err) {
        console.error('Failed to load active entry:', err);
      }
    }
    loadActiveEntry();
  }, [user, tasks]);

  // Load users for @mention autocomplete (Phase C)
  useEffect(() => {
    const { db } = getFirebase();
    const usersRef = collection(db, COLLECTIONS.USERS);
    const q = query(usersRef, where('isActive', '==', true), orderBy('displayName', 'asc'));

    const unsubscribe = onSnapshot(
      q,
      (snapshot) => {
        const usersData: User[] = [];
        snapshot.forEach((doc) => {
          const data = doc.data();
          usersData.push({
            uid: doc.id,
            email: data.email || '',
            displayName: data.displayName || data.email || 'Unknown',
            photoURL: data.photoURL,
            department: data.department,
            permissions: data.permissions || 0,
            allowedModules: data.allowedModules,
            jobTitle: data.jobTitle,
            phone: data.phone,
            mobile: data.mobile,
            status: data.status || 'active',
            isActive: data.isActive ?? true,
            assignedProjects: data.assignedProjects || [],
            preferences: data.preferences,
            lastLoginAt: data.lastLoginAt,
            createdAt: data.createdAt,
            updatedAt: data.updatedAt,
          });
        });
        setUsers(usersData);
      },
      (err) => {
        console.error('[TasksPage] Error fetching users:', err);
      }
    );

    return () => unsubscribe();
  }, []);

  // Get tasks for current view
  const currentTasks = React.useMemo(() => {
    if (selectedView === 'my-tasks') {
      // Show all pending/in-progress tasks
      return tasks.filter((t) => t.status === 'pending' || t.status === 'in_progress');
    }
    if (selectedView === 'mentions') {
      // Placeholder for Phase C
      return [];
    }
    // Channel view - tasks are filtered by ChannelView component
    if (selectedWorkspaceId) {
      return tasksByWorkspace[selectedWorkspaceId] || [];
    }
    return [];
  }, [selectedView, selectedWorkspaceId, tasks, tasksByWorkspace]);

  // Handlers
  const handleStartTask = useCallback(
    async (taskId: string) => {
      if (!user) return;

      try {
        // Start the task
        await startActionableTask(taskId, user.uid);
        // Start time entry and get active entry
        await startTimeEntry(user.uid, taskId);
        const entry = await getActiveTimeEntry(user.uid);
        const task = tasks.find((t) => t.id === taskId);
        setActiveEntry(entry);
        setActiveTask(task || null);
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Failed to start task');
      }
    },
    [user, tasks]
  );

  const handleCompleteTask = useCallback(
    async (taskId: string) => {
      if (!user) return;

      try {
        // Stop any active time entry for this task
        if (activeEntry && activeEntry.taskNotificationId === taskId) {
          await stopTimeEntry(activeEntry.id);
          setActiveEntry(null);
          setActiveTask(null);
        }
        // Complete the task
        await completeActionableTask(taskId, user.uid, false);
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Failed to complete task');
      }
    },
    [user, activeEntry]
  );

  const handleViewThread = useCallback(
    (taskId: string) => {
      const task = tasks.find((t) => t.id === taskId);
      if (task) {
        setSelectedTaskForThread(task);
        setThreadPanelOpen(true);
      }
    },
    [tasks]
  );

  // Handle closing thread panel
  const handleCloseThreadPanel = useCallback(() => {
    setThreadPanelOpen(false);
    setSelectedTaskForThread(null);
  }, []);

  // Handle mention click - navigate to the thread (Phase C)
  const handleSelectMention = useCallback(
    (mention: TaskMention) => {
      // Find the task associated with this mention
      const task = tasks.find((t) => t.id === mention.taskNotificationId);
      if (task) {
        setSelectedTaskForThread(task);
        setThreadPanelOpen(true);
      }
    },
    [tasks]
  );

  // Timer handlers
  const handlePauseTimer = useCallback(async (entryId: string) => {
    try {
      await pauseTimeEntry(entryId);
      const entry = await getActiveTimeEntry(entryId);
      setActiveEntry(entry);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to pause timer');
    }
  }, []);

  const handleResumeTimer = useCallback(async (entryId: string) => {
    try {
      await resumeTimeEntry(entryId);
      const entry = await getActiveTimeEntry(entryId);
      setActiveEntry(entry);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to resume timer');
    }
  }, []);

  const handleStopTimer = useCallback(async (entryId: string) => {
    try {
      await stopTimeEntry(entryId);
      setActiveEntry(null);
      setActiveTask(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to stop timer');
    }
  }, []);

  // Clear error
  const handleCloseError = useCallback(() => {
    setError(null);
  }, []);

  if (!user) {
    return (
      <Box sx={{ p: 4 }}>
        <Alert severity="warning">Please log in to view your tasks.</Alert>
      </Box>
    );
  }

  return (
    <Box sx={{ height: '100%', display: 'flex', flexDirection: 'column' }}>
      {/* Mentions View - shown when 'mentions' view is selected */}
      {selectedView === 'mentions' ? (
        <MentionsView onSelectMention={handleSelectMention} />
      ) : (
        /* Channel View - default view */
        <ChannelView
          workspaceName={selectedWorkspaceName || 'All Projects'}
          channelId={selectedChannelId || undefined}
          view={selectedView}
          tasks={currentTasks}
          isLoading={isLoading}
          error={error}
          onStartTask={handleStartTask}
          onCompleteTask={handleCompleteTask}
          onViewThread={handleViewThread}
          activeTaskId={activeTask?.id}
          onToggleSidebar={onToggleSidebar}
          showSidebarToggle={showSidebarToggle}
        />
      )}

      {/* Thread Panel - slides in from right (Phase C) */}
      <TaskThreadPanel
        task={selectedTaskForThread}
        open={threadPanelOpen}
        onClose={handleCloseThreadPanel}
        users={users}
      />

      {/* Floating Timer Widget */}
      {activeEntry && activeTask && (
        <TimerWidget
          activeEntry={activeEntry}
          activeTask={activeTask}
          onPause={handlePauseTimer}
          onResume={handleResumeTimer}
          onStop={handleStopTimer}
        />
      )}

      {/* Error Snackbar */}
      <Snackbar
        open={!!error}
        autoHideDuration={6000}
        onClose={handleCloseError}
        anchorOrigin={{ vertical: 'bottom', horizontal: 'center' }}
      >
        <Alert onClose={handleCloseError} severity="error" sx={{ width: '100%' }}>
          {error}
        </Alert>
      </Snackbar>
    </Box>
  );
}
