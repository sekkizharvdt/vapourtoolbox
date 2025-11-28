'use client';

/**
 * ChannelView Component
 *
 * Main content area showing tasks filtered by channel
 * - ChannelHeader with search
 * - Scrollable task list
 * - Empty state handling
 */

import { memo, useMemo, useState, useCallback } from 'react';
import { Box, Typography, Stack, CircularProgress, Alert } from '@mui/material';
import { Inbox as InboxIcon } from '@mui/icons-material';
import type { TaskNotification, DefaultTaskChannelId } from '@vapour/types';
import { TASK_CHANNEL_DEFINITIONS, isApprovalCategory } from '@vapour/types';
import { ChannelHeader } from './ChannelHeader';
import { TaskCard } from './TaskCard';

interface ChannelViewProps {
  workspaceName: string;
  channelId?: DefaultTaskChannelId;
  view: 'channel' | 'my-tasks' | 'mentions';
  tasks: TaskNotification[];
  isLoading?: boolean;
  error?: string | null;
  onStartTask: (taskId: string) => void;
  onCompleteTask: (taskId: string) => void;
  onViewThread?: (taskId: string) => void;
  activeTaskId?: string;
  onToggleSidebar?: () => void;
  showSidebarToggle?: boolean;
}

export const ChannelView = memo(function ChannelView({
  workspaceName,
  channelId,
  view,
  tasks,
  isLoading = false,
  error = null,
  onStartTask,
  onCompleteTask,
  onViewThread,
  activeTaskId,
  onToggleSidebar,
  showSidebarToggle = false,
}: ChannelViewProps) {
  const [searchQuery, setSearchQuery] = useState('');

  // Filter tasks by channel and search
  const filteredTasks = useMemo(() => {
    let result = tasks;

    // Filter by channel (if in channel view)
    if (view === 'channel' && channelId) {
      const channel = TASK_CHANNEL_DEFINITIONS[channelId];
      result = tasks.filter((task) => {
        // For approvals channel, include approval-type tasks from all modules
        if (channelId === 'approvals') {
          return isApprovalCategory(task.category);
        }
        // For other channels, match by category
        return channel.categories.includes(task.category);
      });
    }

    // Filter by search query
    if (searchQuery.trim()) {
      const query = searchQuery.toLowerCase();
      result = result.filter(
        (task) =>
          task.title.toLowerCase().includes(query) ||
          task.message?.toLowerCase().includes(query) ||
          task.assignedByName?.toLowerCase().includes(query)
      );
    }

    return result;
  }, [tasks, channelId, view, searchQuery]);

  // Handle search change
  const handleSearchChange = useCallback((query: string) => {
    setSearchQuery(query);
  }, []);

  return (
    <Box
      sx={{
        flex: 1,
        display: 'flex',
        flexDirection: 'column',
        overflow: 'hidden',
        bgcolor: 'background.default',
      }}
    >
      {/* Header */}
      <ChannelHeader
        workspaceName={workspaceName}
        channelId={channelId}
        view={view}
        taskCount={filteredTasks.length}
        searchQuery={searchQuery}
        onSearchChange={handleSearchChange}
        onToggleSidebar={onToggleSidebar}
        showSidebarToggle={showSidebarToggle}
      />

      {/* Content */}
      <Box sx={{ flex: 1, overflow: 'auto', p: 2 }}>
        {/* Error State */}
        {error && (
          <Alert severity="error" sx={{ mb: 2 }}>
            {error}
          </Alert>
        )}

        {/* Loading State */}
        {isLoading && (
          <Box sx={{ display: 'flex', justifyContent: 'center', py: 8 }}>
            <CircularProgress />
          </Box>
        )}

        {/* Empty State */}
        {!isLoading && filteredTasks.length === 0 && (
          <Stack
            alignItems="center"
            justifyContent="center"
            spacing={2}
            sx={{ py: 8, color: 'text.secondary' }}
          >
            <InboxIcon sx={{ fontSize: 64, opacity: 0.5 }} />
            <Typography variant="h6" color="text.secondary">
              {searchQuery
                ? 'No tasks match your search'
                : view === 'my-tasks'
                  ? 'No tasks assigned to you'
                  : view === 'mentions'
                    ? 'No mentions yet'
                    : 'No tasks in this channel'}
            </Typography>
            <Typography variant="body2" color="text.secondary">
              {searchQuery
                ? 'Try a different search term'
                : view === 'my-tasks'
                  ? 'Tasks assigned to you will appear here'
                  : view === 'mentions'
                    ? "When someone @mentions you, it'll show up here"
                    : 'Tasks will appear here when they are created'}
            </Typography>
          </Stack>
        )}

        {/* Task List */}
        {!isLoading && filteredTasks.length > 0 && (
          <Box>
            {filteredTasks.map((task) => (
              <TaskCard
                key={task.id}
                task={task}
                onStart={onStartTask}
                onComplete={onCompleteTask}
                onViewThread={onViewThread}
                isActive={task.id === activeTaskId}
                threadCount={0} // Placeholder for Phase C
              />
            ))}
          </Box>
        )}
      </Box>
    </Box>
  );
});

export default ChannelView;
