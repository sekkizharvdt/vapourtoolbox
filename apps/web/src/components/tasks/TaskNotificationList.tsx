'use client';

/**
 * Task Notification List Component
 *
 * Full list view with filters and tabs
 * Optimized with useMemo for filtered data and useCallback for handlers
 */

import React, { useState, useMemo, useCallback } from 'react';
import {
  Box,
  Tabs,
  Tab,
  Stack,
  Typography,
  TextField,
  InputAdornment,
  Select,
  MenuItem,
  FormControl,
  InputLabel,
  Button,
  Alert,
} from '@mui/material';
import { Search as SearchIcon, FilterList as FilterListIcon } from '@mui/icons-material';
import type { TaskNotification } from '@vapour/types';
import TaskNotificationItem from './TaskNotificationItem';

interface TaskNotificationListProps {
  notifications: TaskNotification[];
  onAcknowledge?: (id: string) => void;
  onStartTask?: (id: string) => void;
  onCompleteTask?: (id: string) => void;
  onMarkRead?: (id: string) => void;
  onAcknowledgeAll?: () => void;
  isLoading?: boolean;
}

type FilterTab = 'all' | 'actionable' | 'informational' | 'completed';

export default function TaskNotificationList({
  notifications,
  onAcknowledge,
  onStartTask,
  onCompleteTask,
  onMarkRead,
  onAcknowledgeAll,
  isLoading = false,
}: TaskNotificationListProps) {
  const [activeTab, setActiveTab] = useState<FilterTab>('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [priorityFilter, setPriorityFilter] = useState<string>('all');
  const [statusFilter, setStatusFilter] = useState<string>('all');

  // Memoize tab change handler
  const handleTabChange = useCallback((_: React.SyntheticEvent, value: FilterTab) => {
    setActiveTab(value);
  }, []);

  // Memoize search change handler
  const handleSearchChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    setSearchQuery(e.target.value);
  }, []);

  // Memoize priority filter handler
  const handlePriorityChange = useCallback((e: { target: { value: string } }) => {
    setPriorityFilter(e.target.value);
  }, []);

  // Memoize status filter handler
  const handleStatusChange = useCallback((e: { target: { value: string } }) => {
    setStatusFilter(e.target.value);
  }, []);

  // Memoize counts to avoid recalculation on every render
  const counts = useMemo(
    () => ({
      all: notifications.length,
      actionable: notifications.filter((n) => n.type === 'actionable').length,
      informational: notifications.filter((n) => n.type === 'informational').length,
      completed: notifications.filter((n) => n.status === 'completed').length,
    }),
    [notifications]
  );

  // Memoize pending informational count
  const pendingInformational = useMemo(
    () => notifications.filter((n) => n.type === 'informational' && n.status === 'pending').length,
    [notifications]
  );

  // Memoize filtered notifications
  const filteredNotifications = useMemo(() => {
    // Filter by tab
    let filtered: TaskNotification[];
    switch (activeTab) {
      case 'actionable':
        filtered = notifications.filter((n) => n.type === 'actionable');
        break;
      case 'informational':
        filtered = notifications.filter((n) => n.type === 'informational');
        break;
      case 'completed':
        filtered = notifications.filter((n) => n.status === 'completed');
        break;
      case 'all':
      default:
        filtered = notifications;
    }

    // Search filter
    if (searchQuery.trim()) {
      const query = searchQuery.toLowerCase();
      filtered = filtered.filter(
        (n) =>
          n.title.toLowerCase().includes(query) ||
          n.message.toLowerCase().includes(query) ||
          n.category.toLowerCase().includes(query)
      );
    }

    // Priority filter
    if (priorityFilter !== 'all') {
      filtered = filtered.filter((n) => n.priority === priorityFilter);
    }

    // Status filter
    if (statusFilter !== 'all') {
      filtered = filtered.filter((n) => n.status === statusFilter);
    }

    return filtered;
  }, [notifications, activeTab, searchQuery, priorityFilter, statusFilter]);

  return (
    <Box>
      {/* Header with Tabs */}
      <Box sx={{ borderBottom: 1, borderColor: 'divider', mb: 3 }}>
        <Tabs value={activeTab} onChange={handleTabChange} aria-label="notification tabs">
          <Tab label={`All (${counts.all})`} value="all" />
          <Tab label={`Actionable (${counts.actionable})`} value="actionable" />
          <Tab label={`Informational (${counts.informational})`} value="informational" />
          <Tab label={`Completed (${counts.completed})`} value="completed" />
        </Tabs>
      </Box>

      {/* Filters */}
      <Stack direction="row" spacing={2} sx={{ mb: 3 }} flexWrap="wrap" gap={2}>
        {/* Search */}
        <TextField
          placeholder="Search notifications..."
          value={searchQuery}
          onChange={handleSearchChange}
          size="small"
          sx={{ minWidth: 300, flexGrow: 1 }}
          InputProps={{
            startAdornment: (
              <InputAdornment position="start">
                <SearchIcon />
              </InputAdornment>
            ),
          }}
        />

        {/* Priority Filter */}
        <FormControl size="small" sx={{ minWidth: 150 }}>
          <InputLabel>Priority</InputLabel>
          <Select value={priorityFilter} label="Priority" onChange={handlePriorityChange}>
            <MenuItem value="all">All Priorities</MenuItem>
            <MenuItem value="URGENT">Urgent</MenuItem>
            <MenuItem value="HIGH">High</MenuItem>
            <MenuItem value="MEDIUM">Medium</MenuItem>
            <MenuItem value="LOW">Low</MenuItem>
          </Select>
        </FormControl>

        {/* Status Filter */}
        <FormControl size="small" sx={{ minWidth: 150 }}>
          <InputLabel>Status</InputLabel>
          <Select value={statusFilter} label="Status" onChange={handleStatusChange}>
            <MenuItem value="all">All Status</MenuItem>
            <MenuItem value="pending">Pending</MenuItem>
            <MenuItem value="in_progress">In Progress</MenuItem>
            <MenuItem value="acknowledged">Acknowledged</MenuItem>
            <MenuItem value="completed">Completed</MenuItem>
          </Select>
        </FormControl>

        {/* Acknowledge All Button */}
        {pendingInformational > 0 && (
          <Button
            variant="outlined"
            startIcon={<FilterListIcon />}
            onClick={onAcknowledgeAll}
            sx={{ ml: 'auto' }}
          >
            Acknowledge All Info ({pendingInformational})
          </Button>
        )}
      </Stack>

      {/* Results Count */}
      <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
        Showing {filteredNotifications.length} of {notifications.length} notifications
      </Typography>

      {/* Loading State */}
      {isLoading && (
        <Alert severity="info" sx={{ mb: 2 }}>
          Loading notifications...
        </Alert>
      )}

      {/* Empty State */}
      {!isLoading && filteredNotifications.length === 0 && (
        <Alert severity="info" sx={{ mb: 2 }}>
          {searchQuery || priorityFilter !== 'all' || statusFilter !== 'all'
            ? 'No notifications match your filters'
            : 'No notifications yet'}
        </Alert>
      )}

      {/* Notification List */}
      <Stack spacing={2}>
        {filteredNotifications.map((notification) => (
          <TaskNotificationItem
            key={notification.id}
            notification={notification}
            onAcknowledge={onAcknowledge}
            onStartTask={onStartTask}
            onCompleteTask={onCompleteTask}
            onMarkRead={onMarkRead}
          />
        ))}
      </Stack>
    </Box>
  );
}
