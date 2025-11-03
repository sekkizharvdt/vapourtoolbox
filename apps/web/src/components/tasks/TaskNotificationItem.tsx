'use client';

/**
 * Task Notification Item Component
 *
 * Individual notification/task card with actions
 */

import React from 'react';
import { Card, CardContent, Stack, Typography, Chip, Button, IconButton, Box } from '@mui/material';
import {
  CheckCircle as CheckCircleIcon,
  Schedule as ScheduleIcon,
  PlayArrow as PlayArrowIcon,
  Check as CheckIcon,
  OpenInNew as OpenInNewIcon,
  Circle as CircleIcon,
} from '@mui/icons-material';
import { useRouter } from 'next/navigation';
import type { TaskNotification } from '@vapour/types';
import { formatDuration } from '@/lib/tasks/timeEntryService';

interface TaskNotificationItemProps {
  notification: TaskNotification;
  onAcknowledge?: (id: string) => void;
  onStartTask?: (id: string) => void;
  onCompleteTask?: (id: string) => void;
  onMarkRead?: (id: string) => void;
  showActions?: boolean;
}

export default function TaskNotificationItem({
  notification,
  onAcknowledge,
  onStartTask,
  onCompleteTask,
  onMarkRead,
  showActions = true,
}: TaskNotificationItemProps) {
  const router = useRouter();

  const getPriorityColor = (priority: string) => {
    switch (priority) {
      case 'URGENT':
        return 'error';
      case 'HIGH':
        return 'warning';
      case 'MEDIUM':
        return 'info';
      case 'LOW':
      default:
        return 'default';
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'completed':
        return 'success';
      case 'in_progress':
        return 'primary';
      case 'acknowledged':
        return 'info';
      case 'pending':
      default:
        return 'default';
    }
  };

  const getStatusText = (status: string) => {
    switch (status) {
      case 'completed':
        return 'Completed';
      case 'in_progress':
        return 'In Progress';
      case 'acknowledged':
        return 'Acknowledged';
      case 'pending':
      default:
        return 'Pending';
    }
  };

  const handleViewTask = () => {
    if (!notification.read && onMarkRead) {
      onMarkRead(notification.id);
    }
    router.push(notification.linkUrl);
  };

  const handleAcknowledge = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (onAcknowledge) {
      onAcknowledge(notification.id);
    }
  };

  const handleStartTask = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (onStartTask) {
      onStartTask(notification.id);
    }
  };

  const handleCompleteTask = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (onCompleteTask) {
      onCompleteTask(notification.id);
    }
  };

  return (
    <Card
      sx={{
        backgroundColor: notification.read ? 'background.paper' : 'action.hover',
        borderLeft: 4,
        borderColor: notification.read ? 'transparent' : 'primary.main',
        '&:hover': {
          boxShadow: 2,
        },
      }}
    >
      <CardContent>
        <Stack spacing={2}>
          {/* Header: Title and Unread Indicator */}
          <Stack direction="row" spacing={1} alignItems="flex-start">
            {!notification.read && (
              <CircleIcon sx={{ fontSize: 12, color: 'primary.main', mt: 0.5 }} />
            )}
            <Box sx={{ flexGrow: 1 }}>
              <Typography
                variant="h6"
                sx={{
                  fontWeight: notification.read ? 400 : 600,
                  fontSize: '1rem',
                }}
              >
                {notification.title}
              </Typography>
            </Box>
            <IconButton size="small" onClick={handleViewTask} aria-label="open task">
              <OpenInNewIcon fontSize="small" />
            </IconButton>
          </Stack>

          {/* Message */}
          <Typography variant="body2" color="text.secondary">
            {notification.message}
          </Typography>

          {/* Metadata Chips */}
          <Stack direction="row" spacing={1} flexWrap="wrap" gap={1}>
            {/* Priority */}
            <Chip
              label={notification.priority}
              size="small"
              color={getPriorityColor(notification.priority) as any}
            />

            {/* Status */}
            <Chip
              label={getStatusText(notification.status)}
              size="small"
              color={getStatusColor(notification.status) as any}
              variant="outlined"
            />

            {/* Type */}
            <Chip
              label={notification.type === 'actionable' ? 'Action Required' : 'Info'}
              size="small"
              variant="outlined"
            />

            {/* Duration if tracked */}
            {notification.totalDuration && notification.totalDuration > 0 && (
              <Chip
                icon={<ScheduleIcon />}
                label={formatDuration(notification.totalDuration)}
                size="small"
                variant="outlined"
              />
            )}
          </Stack>

          {/* Project/Entity Info */}
          {notification.projectId && (
            <Typography variant="caption" color="text.secondary">
              Project: {notification.projectId} • {notification.entityType}
            </Typography>
          )}

          {/* Time Info */}
          <Typography variant="caption" color="text.secondary">
            Created: {new Date(notification.createdAt.toMillis()).toLocaleString()}
            {notification.acknowledgedAt && (
              <>
                {' '}
                • Acknowledged: {new Date(notification.acknowledgedAt.toMillis()).toLocaleString()}
              </>
            )}
            {notification.timeCompleted && (
              <> • Completed: {new Date(notification.timeCompleted.toMillis()).toLocaleString()}</>
            )}
          </Typography>

          {/* Actions */}
          {showActions && (
            <Stack direction="row" spacing={1}>
              {/* Informational: Acknowledge */}
              {notification.type === 'informational' && notification.status === 'pending' && (
                <Button
                  size="small"
                  variant="contained"
                  startIcon={<CheckIcon />}
                  onClick={handleAcknowledge}
                >
                  Acknowledge
                </Button>
              )}

              {/* Actionable: Start Task */}
              {notification.type === 'actionable' && notification.status === 'pending' && (
                <>
                  <Button
                    size="small"
                    variant="contained"
                    startIcon={<PlayArrowIcon />}
                    onClick={handleStartTask}
                    color="primary"
                  >
                    Start Task
                  </Button>
                  <Button
                    size="small"
                    variant="outlined"
                    startIcon={<OpenInNewIcon />}
                    onClick={handleViewTask}
                  >
                    View Details
                  </Button>
                </>
              )}

              {/* Actionable: In Progress */}
              {notification.type === 'actionable' && notification.status === 'in_progress' && (
                <>
                  <Button
                    size="small"
                    variant="contained"
                    startIcon={<CheckCircleIcon />}
                    onClick={handleCompleteTask}
                    color="success"
                  >
                    Mark Complete
                  </Button>
                  <Button
                    size="small"
                    variant="outlined"
                    startIcon={<OpenInNewIcon />}
                    onClick={handleViewTask}
                  >
                    Continue Working
                  </Button>
                </>
              )}

              {/* Completed */}
              {notification.status === 'completed' && (
                <Button
                  size="small"
                  variant="outlined"
                  startIcon={<OpenInNewIcon />}
                  onClick={handleViewTask}
                >
                  View Details
                </Button>
              )}

              {/* Auto-completed awaiting confirmation */}
              {notification.autoCompletedAt && !notification.completionConfirmed && (
                <>
                  <Chip label="Auto-completed" size="small" color="success" variant="outlined" />
                  <Button
                    size="small"
                    variant="contained"
                    startIcon={<CheckIcon />}
                    onClick={handleCompleteTask}
                    color="success"
                  >
                    Confirm Completion
                  </Button>
                </>
              )}
            </Stack>
          )}
        </Stack>
      </CardContent>
    </Card>
  );
}
