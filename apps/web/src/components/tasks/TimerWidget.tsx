'use client';

/**
 * Timer Widget Component
 *
 * Floating timer widget that appears when user has active time entry
 * Shows task title, elapsed time, and pause/stop controls
 */

import React, { useState, useEffect } from 'react';
import { Paper, Stack, Typography, IconButton, Tooltip, Box, Chip } from '@mui/material';
import {
  Pause as PauseIcon,
  PlayArrow as PlayArrowIcon,
  Stop as StopIcon,
  OpenInNew as OpenInNewIcon,
} from '@mui/icons-material';
import { useRouter } from 'next/navigation';
import type { TimeEntry, TaskNotification } from '@vapour/types';
import { calculateElapsedTime, formatDuration } from '@/lib/tasks/timeEntryService';

interface TimerWidgetProps {
  activeEntry: TimeEntry;
  activeTask: TaskNotification;
  onPause?: (entryId: string) => void;
  onResume?: (entryId: string) => void;
  onStop?: (entryId: string) => void;
}

export default function TimerWidget({
  activeEntry,
  activeTask,
  onPause,
  onResume,
  onStop,
}: TimerWidgetProps) {
  const router = useRouter();
  const [elapsedSeconds, setElapsedSeconds] = useState(0);
  const isPaused = !!activeEntry.pausedAt;

  // Update elapsed time every second
  useEffect(() => {
    const updateElapsed = () => {
      const elapsed = calculateElapsedTime(activeEntry);
      setElapsedSeconds(elapsed);
    };

    // Initial update
    updateElapsed();

    // Update every second
    const interval = setInterval(updateElapsed, 1000);

    return () => clearInterval(interval);
  }, [activeEntry]);

  const handlePause = () => {
    if (onPause) {
      onPause(activeEntry.id);
    }
  };

  const handleResume = () => {
    if (onResume) {
      onResume(activeEntry.id);
    }
  };

  const handleStop = () => {
    if (onStop) {
      onStop(activeEntry.id);
    }
  };

  const handleOpenTask = () => {
    router.push(activeTask.linkUrl);
  };

  return (
    <Paper
      elevation={6}
      sx={{
        position: 'fixed',
        bottom: 24,
        right: 24,
        width: 320,
        p: 2,
        zIndex: 1200,
        borderLeft: 4,
        borderColor: isPaused ? 'warning.main' : 'primary.main',
      }}
    >
      <Stack spacing={2}>
        {/* Header */}
        <Stack direction="row" justifyContent="space-between" alignItems="center">
          <Typography variant="caption" color="text.secondary">
            {isPaused ? 'PAUSED' : 'ACTIVE TASK'}
          </Typography>
          <Chip
            label={activeTask.priority}
            size="small"
            color={
              activeTask.priority === 'URGENT'
                ? 'error'
                : activeTask.priority === 'HIGH'
                  ? 'warning'
                  : 'primary'
            }
            sx={{ height: 20, fontSize: '0.7rem' }}
          />
        </Stack>

        {/* Task Title */}
        <Stack direction="row" spacing={1} alignItems="center">
          <Typography
            variant="subtitle1"
            sx={{
              flexGrow: 1,
              fontWeight: 600,
              overflow: 'hidden',
              textOverflow: 'ellipsis',
              whiteSpace: 'nowrap',
            }}
          >
            {activeTask.title}
          </Typography>
          <Tooltip title="Open task">
            <IconButton size="small" onClick={handleOpenTask} aria-label="Open task">
              <OpenInNewIcon fontSize="small" />
            </IconButton>
          </Tooltip>
        </Stack>

        {/* Elapsed Time */}
        <Box
          sx={{
            textAlign: 'center',
            py: 2,
            backgroundColor: isPaused ? 'warning.light' : 'primary.light',
            borderRadius: 1,
          }}
        >
          <Typography
            variant="h4"
            sx={{
              fontFamily: 'monospace',
              fontWeight: 700,
              color: isPaused ? 'warning.dark' : 'primary.dark',
            }}
          >
            {formatDuration(elapsedSeconds)}
          </Typography>
          {isPaused && (
            <Typography variant="caption" color="warning.dark">
              Timer is paused
            </Typography>
          )}
        </Box>

        {/* Controls */}
        <Stack direction="row" spacing={1} justifyContent="center">
          {/* Pause/Resume */}
          {isPaused ? (
            <Tooltip title="Resume timer">
              <IconButton
                onClick={handleResume}
                color="primary"
                aria-label="Resume timer"
                sx={{
                  backgroundColor: 'primary.light',
                  '&:hover': {
                    backgroundColor: 'primary.main',
                    color: 'white',
                  },
                }}
              >
                <PlayArrowIcon />
              </IconButton>
            </Tooltip>
          ) : (
            <Tooltip title="Pause timer">
              <IconButton
                onClick={handlePause}
                color="warning"
                aria-label="Pause timer"
                sx={{
                  backgroundColor: 'warning.light',
                  '&:hover': {
                    backgroundColor: 'warning.main',
                    color: 'white',
                  },
                }}
              >
                <PauseIcon />
              </IconButton>
            </Tooltip>
          )}

          {/* Stop */}
          <Tooltip title="Stop timer">
            <IconButton
              onClick={handleStop}
              color="error"
              aria-label="Stop timer"
              sx={{
                backgroundColor: 'error.light',
                '&:hover': {
                  backgroundColor: 'error.main',
                  color: 'white',
                },
              }}
            >
              <StopIcon />
            </IconButton>
          </Tooltip>
        </Stack>

        {/* Description if any */}
        {activeEntry.description && (
          <Typography variant="caption" color="text.secondary" sx={{ fontStyle: 'italic' }}>
            {activeEntry.description}
          </Typography>
        )}
      </Stack>
    </Paper>
  );
}
