'use client';

/**
 * Start Timer Button Component
 *
 * Appears on entity pages (PR, PO, etc.) when user has a related task-notification
 * Allows starting time tracking for that task
 */

import React, { useState } from 'react';
import {
  Button,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  TextField,
  Stack,
  Typography,
  Chip,
  Alert,
} from '@mui/material';
import { PlayArrow as PlayArrowIcon, Schedule as ScheduleIcon } from '@mui/icons-material';
import type { TaskNotification } from '@vapour/types';
import { formatDuration } from '@/lib/tasks/timeEntryService';

interface StartTimerButtonProps {
  taskNotification: TaskNotification;
  onStart?: (taskNotificationId: string, description?: string) => Promise<void>;
  disabled?: boolean;
}

export default function StartTimerButton({
  taskNotification,
  onStart,
  disabled = false,
}: StartTimerButtonProps) {
  const [open, setOpen] = useState(false);
  const [description, setDescription] = useState('');
  const [isStarting, setIsStarting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleClickOpen = () => {
    setOpen(true);
    setError(null);
  };

  const handleClose = () => {
    setOpen(false);
    setDescription('');
    setError(null);
  };

  const handleStart = async () => {
    if (!onStart) return;

    setIsStarting(true);
    setError(null);

    try {
      await onStart(taskNotification.id, description.trim() || undefined);
      handleClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to start timer');
    } finally {
      setIsStarting(false);
    }
  };

  // Don't show button if task is completed
  if (taskNotification.status === 'completed') {
    return null;
  }

  // Don't show for informational tasks
  if (taskNotification.type === 'informational') {
    return null;
  }

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

  return (
    <>
      <Button
        variant={taskNotification.status === 'in_progress' ? 'outlined' : 'contained'}
        color="primary"
        startIcon={<PlayArrowIcon />}
        onClick={handleClickOpen}
        disabled={disabled}
      >
        {taskNotification.status === 'in_progress' ? 'Continue Working' : 'Start Working on This'}
      </Button>

      <Dialog open={open} onClose={handleClose} maxWidth="sm" fullWidth>
        <DialogTitle>Start Timer</DialogTitle>
        <DialogContent>
          <Stack spacing={3} sx={{ mt: 1 }}>
            {/* Task Info */}
            <Stack spacing={1}>
              <Typography variant="subtitle1" fontWeight={600}>
                {taskNotification.title}
              </Typography>
              <Typography variant="body2" color="text.secondary">
                {taskNotification.message}
              </Typography>
              <Stack direction="row" spacing={1}>
                <Chip
                  label={taskNotification.priority}
                  size="small"
                  color={getPriorityColor(taskNotification.priority) as any}
                />
                <Chip label={taskNotification.category} size="small" variant="outlined" />
              </Stack>
            </Stack>

            {/* Time Info if previously worked on */}
            {taskNotification.totalDuration && taskNotification.totalDuration > 0 && (
              <Alert severity="info" icon={<ScheduleIcon />}>
                <Typography variant="body2">
                  Time spent so far:{' '}
                  <strong>{formatDuration(taskNotification.totalDuration)}</strong>
                </Typography>
              </Alert>
            )}

            {/* Description Field */}
            <TextField
              label="Work Description (Optional)"
              multiline
              rows={3}
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="What are you going to work on?"
              helperText="Add notes about what you're working on (optional)"
              fullWidth
            />

            {/* Error Alert */}
            {error && (
              <Alert severity="error" onClose={() => setError(null)}>
                {error}
              </Alert>
            )}

            {/* Info */}
            <Alert severity="info">
              Starting the timer will:
              <ul style={{ marginTop: 8, marginBottom: 0, paddingLeft: 20 }}>
                <li>Stop any other active timers</li>
                <li>Mark this task as "In Progress"</li>
                <li>Begin tracking your time</li>
              </ul>
            </Alert>
          </Stack>
        </DialogContent>
        <DialogActions>
          <Button onClick={handleClose} disabled={isStarting}>
            Cancel
          </Button>
          <Button
            onClick={handleStart}
            variant="contained"
            color="primary"
            startIcon={<PlayArrowIcon />}
            disabled={isStarting}
          >
            {isStarting ? 'Starting...' : 'Start Timer'}
          </Button>
        </DialogActions>
      </Dialog>
    </>
  );
}
