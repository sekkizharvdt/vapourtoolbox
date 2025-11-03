'use client';

/**
 * Tasks Page
 *
 * Unified task-notification management with integrated time tracking
 * Shows all actionable and informational items with time stats
 */

import React, { useState, useEffect } from 'react';
import {
  Container,
  Box,
  Typography,
  Card,
  CardContent,
  Stack,
  Chip,
  CircularProgress,
  Alert,
} from '@mui/material';
import {
  Assignment as AssignmentIcon,
  Schedule as ScheduleIcon,
  CheckCircle as CheckCircleIcon,
  Notifications as NotificationsIcon,
} from '@mui/icons-material';
import { useAuth } from '@/contexts/AuthContext';
import { TaskNotificationList, TimerWidget } from '@/components/tasks';
import {
  getUserTaskNotifications,
  getTaskNotificationSummary,
  acknowledgeInformational,
  startActionableTask,
  completeActionableTask,
  markAsRead,
  acknowledgeAllInformational,
} from '@/lib/tasks/taskNotificationService';
import {
  startTimeEntry,
  stopTimeEntry,
  pauseTimeEntry,
  resumeTimeEntry,
  getActiveTimeEntry,
  getUserTimeStats,
} from '@/lib/tasks/timeEntryService';
import type {
  TaskNotification,
  TaskNotificationSummary,
  TimeEntry,
  UserTimeStats,
} from '@vapour/types';
import { formatDuration } from '@/lib/tasks/timeEntryService';

export default function TasksPage() {
  const { user } = useAuth();
  const [notifications, setNotifications] = useState<TaskNotification[]>([]);
  const [summary, setSummary] = useState<TaskNotificationSummary | null>(null);
  const [timeStats, setTimeStats] = useState<UserTimeStats | null>(null);
  const [activeEntry, setActiveEntry] = useState<TimeEntry | null>(null);
  const [activeTask, setActiveTask] = useState<TaskNotification | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Load data
  const loadData = async () => {
    if (!user) return;

    setIsLoading(true);
    setError(null);

    try {
      const [notifs, sum, stats, active] = await Promise.all([
        getUserTaskNotifications({ userId: user.uid }),
        getTaskNotificationSummary(user.uid),
        getUserTimeStats(user.uid),
        getActiveTimeEntry(user.uid),
      ]);

      setNotifications(notifs);
      setSummary(sum);
      setTimeStats(stats);
      setActiveEntry(active);

      // If there's an active entry, find the task
      if (active) {
        const task = notifs.find((n) => n.id === active.taskNotificationId);
        setActiveTask(task || null);
      }
    } catch (err) {
      console.error('Failed to load tasks:', err);
      setError(err instanceof Error ? err.message : 'Failed to load tasks');
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, [user]);

  // Handlers
  const handleAcknowledge = async (id: string) => {
    try {
      await acknowledgeInformational(id);
      await loadData();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to acknowledge');
    }
  };

  const handleStartTask = async (id: string) => {
    if (!user) return;

    try {
      // Start the task
      await startActionableTask(id, user.uid);
      // Start time entry
      await startTimeEntry(user.uid, id);
      await loadData();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to start task');
    }
  };

  const handleCompleteTask = async (id: string) => {
    if (!user) return;

    try {
      // Stop any active time entry
      if (activeEntry) {
        await stopTimeEntry(activeEntry.id);
      }
      // Complete the task
      await completeActionableTask(id, user.uid, false);
      await loadData();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to complete task');
    }
  };

  const handleMarkRead = async (id: string) => {
    try {
      await markAsRead(id);
      await loadData();
    } catch (err) {
      console.error('Failed to mark as read:', err);
    }
  };

  const handleAcknowledgeAll = async () => {
    if (!user) return;

    try {
      await acknowledgeAllInformational(user.uid);
      await loadData();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to acknowledge all');
    }
  };

  const handlePauseTimer = async (entryId: string) => {
    try {
      await pauseTimeEntry(entryId);
      await loadData();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to pause timer');
    }
  };

  const handleResumeTimer = async (entryId: string) => {
    try {
      await resumeTimeEntry(entryId);
      await loadData();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to resume timer');
    }
  };

  const handleStopTimer = async (entryId: string) => {
    try {
      await stopTimeEntry(entryId);
      await loadData();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to stop timer');
    }
  };

  if (!user) {
    return (
      <Container maxWidth="lg" sx={{ py: 4 }}>
        <Alert severity="warning">Please log in to view your tasks.</Alert>
      </Container>
    );
  }

  return (
    <Container maxWidth="lg" sx={{ py: 4 }}>
      {/* Header */}
      <Box sx={{ mb: 4 }}>
        <Typography variant="h4" gutterBottom>
          My Tasks
        </Typography>
        <Typography variant="body1" color="text.secondary">
          Manage your task notifications and track your time
        </Typography>
      </Box>

      {/* Error Alert */}
      {error && (
        <Alert severity="error" sx={{ mb: 3 }} onClose={() => setError(null)}>
          {error}
        </Alert>
      )}

      {/* Loading State */}
      {isLoading && (
        <Box sx={{ display: 'flex', justifyContent: 'center', py: 8 }}>
          <CircularProgress />
        </Box>
      )}

      {/* Content */}
      {!isLoading && (
        <>
          {/* Stats Cards */}
          <Stack direction={{ xs: 'column', sm: 'row' }} spacing={3} sx={{ mb: 4 }} flexWrap="wrap">
            {/* Pending Tasks */}
            <Box
              sx={{
                flex: { xs: '1 1 100%', sm: '1 1 calc(50% - 12px)', md: '1 1 calc(25% - 18px)' },
              }}
            >
              <Card>
                <CardContent>
                  <Stack spacing={2}>
                    <Stack direction="row" justifyContent="space-between" alignItems="center">
                      <AssignmentIcon color="primary" />
                      <Chip label="Pending" size="small" color="warning" />
                    </Stack>
                    <Typography variant="h3">{summary?.pending || 0}</Typography>
                    <Typography variant="body2" color="text.secondary">
                      Pending Tasks
                    </Typography>
                  </Stack>
                </CardContent>
              </Card>
            </Box>

            {/* In Progress */}
            <Box
              sx={{
                flex: { xs: '1 1 100%', sm: '1 1 calc(50% - 12px)', md: '1 1 calc(25% - 18px)' },
              }}
            >
              <Card>
                <CardContent>
                  <Stack spacing={2}>
                    <Stack direction="row" justifyContent="space-between" alignItems="center">
                      <ScheduleIcon color="primary" />
                      <Chip label="Active" size="small" color="primary" />
                    </Stack>
                    <Typography variant="h3">{summary?.inProgress || 0}</Typography>
                    <Typography variant="body2" color="text.secondary">
                      In Progress
                    </Typography>
                  </Stack>
                </CardContent>
              </Card>
            </Box>

            {/* Completed */}
            <Box
              sx={{
                flex: { xs: '1 1 100%', sm: '1 1 calc(50% - 12px)', md: '1 1 calc(25% - 18px)' },
              }}
            >
              <Card>
                <CardContent>
                  <Stack spacing={2}>
                    <Stack direction="row" justifyContent="space-between" alignItems="center">
                      <CheckCircleIcon color="success" />
                      <Chip label="Done" size="small" color="success" />
                    </Stack>
                    <Typography variant="h3">{summary?.completed || 0}</Typography>
                    <Typography variant="body2" color="text.secondary">
                      Completed
                    </Typography>
                  </Stack>
                </CardContent>
              </Card>
            </Box>

            {/* Unread */}
            <Box
              sx={{
                flex: { xs: '1 1 100%', sm: '1 1 calc(50% - 12px)', md: '1 1 calc(25% - 18px)' },
              }}
            >
              <Card>
                <CardContent>
                  <Stack spacing={2}>
                    <Stack direction="row" justifyContent="space-between" alignItems="center">
                      <NotificationsIcon color="error" />
                      <Chip label="Unread" size="small" color="error" />
                    </Stack>
                    <Typography variant="h3">{summary?.unread || 0}</Typography>
                    <Typography variant="body2" color="text.secondary">
                      Unread Notifications
                    </Typography>
                  </Stack>
                </CardContent>
              </Card>
            </Box>
          </Stack>

          {/* Time Stats */}
          <Stack direction={{ xs: 'column', md: 'row' }} spacing={3} sx={{ mb: 4 }}>
            <Box sx={{ flex: 1 }}>
              <Card>
                <CardContent>
                  <Stack spacing={1}>
                    <Typography variant="overline" color="text.secondary">
                      Time Today
                    </Typography>
                    <Typography variant="h4" color="primary.main">
                      {formatDuration(timeStats?.today.totalTime || 0)}
                    </Typography>
                    <Typography variant="caption" color="text.secondary">
                      {timeStats?.today.completedTasks || 0} tasks completed
                    </Typography>
                  </Stack>
                </CardContent>
              </Card>
            </Box>

            <Box sx={{ flex: 1 }}>
              <Card>
                <CardContent>
                  <Stack spacing={1}>
                    <Typography variant="overline" color="text.secondary">
                      Time This Week
                    </Typography>
                    <Typography variant="h4" color="primary.main">
                      {formatDuration(timeStats?.thisWeek.totalTime || 0)}
                    </Typography>
                    <Typography variant="caption" color="text.secondary">
                      {timeStats?.thisWeek.completedTasks || 0} tasks completed
                    </Typography>
                  </Stack>
                </CardContent>
              </Card>
            </Box>

            <Box sx={{ flex: 1 }}>
              <Card>
                <CardContent>
                  <Stack spacing={1}>
                    <Typography variant="overline" color="text.secondary">
                      Time This Month
                    </Typography>
                    <Typography variant="h4" color="primary.main">
                      {formatDuration(timeStats?.thisMonth.totalTime || 0)}
                    </Typography>
                    <Typography variant="caption" color="text.secondary">
                      {timeStats?.thisMonth.completedTasks || 0} tasks completed
                    </Typography>
                  </Stack>
                </CardContent>
              </Card>
            </Box>
          </Stack>

          {/* Task List */}
          <TaskNotificationList
            notifications={notifications}
            onAcknowledge={handleAcknowledge}
            onStartTask={handleStartTask}
            onCompleteTask={handleCompleteTask}
            onMarkRead={handleMarkRead}
            onAcknowledgeAll={handleAcknowledgeAll}
            isLoading={isLoading}
          />
        </>
      )}

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
    </Container>
  );
}
