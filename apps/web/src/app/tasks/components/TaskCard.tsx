'use client';

/**
 * TaskCard Component
 *
 * Compact task display for the channel view
 * Shows:
 * - Task title and message
 * - Assignee and timestamp
 * - Priority indicator
 * - Action buttons (Start, View, etc.)
 */

import { memo, useMemo } from 'react';
import {
  Box,
  Card,
  CardContent,
  Typography,
  Stack,
  Chip,
  IconButton,
  Button,
  Tooltip,
} from '@mui/material';
import {
  PlayArrow as PlayIcon,
  CheckCircle as CompleteIcon,
  OpenInNew as ViewIcon,
  Comment as CommentIcon,
  Flag as FlagIcon,
  Schedule as ScheduleIcon,
  Person as PersonIcon,
} from '@mui/icons-material';
import type { TaskNotification, TaskNotificationPriority } from '@vapour/types';
import { formatDistanceToNow } from 'date-fns';
import Link from 'next/link';

// Priority colors
const priorityColors: Record<
  TaskNotificationPriority,
  'inherit' | 'primary' | 'warning' | 'error'
> = {
  LOW: 'inherit',
  MEDIUM: 'primary',
  HIGH: 'warning',
  URGENT: 'error',
};

interface TaskCardProps {
  task: TaskNotification;
  onStart?: (taskId: string) => void;
  onComplete?: (taskId: string) => void;
  onViewThread?: (taskId: string) => void;
  isActive?: boolean;
  threadCount?: number;
}

export const TaskCard = memo(function TaskCard({
  task,
  onStart,
  onComplete,
  onViewThread,
  isActive = false,
  threadCount = 0,
}: TaskCardProps) {
  // Format timestamp
  const timeAgo = useMemo(() => {
    const date = task.createdAt?.toDate?.() || new Date();
    return formatDistanceToNow(date, { addSuffix: true });
  }, [task.createdAt]);

  // Determine if task can be started/completed
  const canStart = task.type === 'actionable' && task.status === 'pending';
  const canComplete =
    task.type === 'actionable' && task.status === 'in_progress' && !task.autoCompletable;
  const isInProgress = task.status === 'in_progress';
  const isCompleted = task.status === 'completed';

  // Get status display
  const getStatusChip = () => {
    if (isCompleted) {
      return <Chip label="Completed" size="small" color="success" variant="outlined" />;
    }
    if (isInProgress) {
      return <Chip label="In Progress" size="small" color="primary" variant="filled" />;
    }
    if (task.type === 'informational') {
      return <Chip label="Info" size="small" color="default" variant="outlined" />;
    }
    return null;
  };

  return (
    <Card
      sx={{
        mb: 1,
        transition: 'box-shadow 0.2s, border-color 0.2s',
        border: 1,
        borderColor: isActive ? 'primary.main' : 'divider',
        boxShadow: isActive ? 2 : 0,
        bgcolor: task.read ? 'background.paper' : 'action.hover',
        '&:hover': {
          boxShadow: 1,
          borderColor: 'primary.light',
        },
      }}
    >
      <CardContent sx={{ py: 1.5, px: 2, '&:last-child': { pb: 1.5 } }}>
        <Stack spacing={1}>
          {/* Header: Title + Priority + Status */}
          <Stack direction="row" alignItems="flex-start" spacing={1}>
            {/* Priority Flag */}
            <Tooltip title={`${task.priority} priority`}>
              <FlagIcon fontSize="small" color={priorityColors[task.priority]} sx={{ mt: 0.3 }} />
            </Tooltip>

            {/* Title */}
            <Box sx={{ flex: 1, minWidth: 0 }}>
              <Typography
                variant="subtitle2"
                fontWeight={task.read ? 400 : 600}
                sx={{
                  overflow: 'hidden',
                  textOverflow: 'ellipsis',
                  display: '-webkit-box',
                  WebkitLineClamp: 2,
                  WebkitBoxOrient: 'vertical',
                }}
              >
                {task.title}
              </Typography>
            </Box>

            {/* Status Chip */}
            {getStatusChip()}
          </Stack>

          {/* Message preview */}
          {task.message && (
            <Typography
              variant="body2"
              color="text.secondary"
              sx={{
                overflow: 'hidden',
                textOverflow: 'ellipsis',
                display: '-webkit-box',
                WebkitLineClamp: 2,
                WebkitBoxOrient: 'vertical',
                pl: 3.5,
              }}
            >
              {task.message}
            </Typography>
          )}

          {/* Footer: Meta info + Actions */}
          <Stack
            direction="row"
            alignItems="center"
            justifyContent="space-between"
            sx={{ pl: 3.5 }}
          >
            {/* Meta info */}
            <Stack direction="row" spacing={2} alignItems="center">
              {/* Assigned by */}
              {task.assignedByName && (
                <Stack direction="row" spacing={0.5} alignItems="center">
                  <PersonIcon fontSize="small" sx={{ color: 'text.secondary', fontSize: 16 }} />
                  <Typography variant="caption" color="text.secondary">
                    {task.assignedByName}
                  </Typography>
                </Stack>
              )}

              {/* Time */}
              <Stack direction="row" spacing={0.5} alignItems="center">
                <ScheduleIcon fontSize="small" sx={{ color: 'text.secondary', fontSize: 16 }} />
                <Typography variant="caption" color="text.secondary">
                  {timeAgo}
                </Typography>
              </Stack>

              {/* Thread count (placeholder for Phase C) */}
              {threadCount > 0 && (
                <Chip
                  icon={<CommentIcon sx={{ fontSize: 14 }} />}
                  label={threadCount}
                  size="small"
                  variant="outlined"
                  onClick={() => onViewThread?.(task.id)}
                  sx={{ height: 22 }}
                />
              )}
            </Stack>

            {/* Actions */}
            <Stack direction="row" spacing={0.5}>
              {/* Start Task */}
              {canStart && onStart && (
                <Button
                  size="small"
                  variant="contained"
                  startIcon={<PlayIcon />}
                  onClick={() => onStart(task.id)}
                  sx={{ minWidth: 'auto', px: 1.5 }}
                >
                  Start
                </Button>
              )}

              {/* Complete Task */}
              {canComplete && onComplete && (
                <Button
                  size="small"
                  variant="contained"
                  color="success"
                  startIcon={<CompleteIcon />}
                  onClick={() => onComplete(task.id)}
                  sx={{ minWidth: 'auto', px: 1.5 }}
                >
                  Complete
                </Button>
              )}

              {/* View Entity Link */}
              {task.linkUrl && (
                <Tooltip title="View details">
                  <IconButton size="small" component={Link} href={task.linkUrl} target="_blank">
                    <ViewIcon fontSize="small" />
                  </IconButton>
                </Tooltip>
              )}
            </Stack>
          </Stack>
        </Stack>
      </CardContent>
    </Card>
  );
});

export default TaskCard;
