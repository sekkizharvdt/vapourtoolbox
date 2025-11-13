'use client';

import React, { useEffect, useState } from 'react';
import {
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Button,
  Typography,
  Box,
  LinearProgress,
  Alert,
} from '@mui/material';
import { AccessTime as ClockIcon, Logout as LogoutIcon } from '@mui/icons-material';

/**
 * Props for SessionTimeoutModal component
 */
interface SessionTimeoutModalProps {
  /** Whether the modal is open */
  open: boolean;

  /** Time remaining in seconds */
  timeRemaining: number;

  /** Total timeout duration in seconds */
  totalTime?: number;

  /** Callback when user clicks "Stay Signed In" */
  onExtend: () => void;

  /** Callback when user clicks "Sign Out Now" or time runs out */
  onLogout: () => void;
}

/**
 * Format seconds to MM:SS
 */
function formatTime(seconds: number): string {
  const mins = Math.floor(seconds / 60);
  const secs = seconds % 60;
  return `${mins}:${secs.toString().padStart(2, '0')}`;
}

/**
 * Session Timeout Warning Modal
 *
 * Displays a warning when the user's session is about to expire due to inactivity.
 * Gives the user the option to extend their session or sign out immediately.
 *
 * Features:
 * - Countdown timer showing time until auto-logout
 * - Progress bar visualization
 * - Color changes as time runs out (blue → yellow → red)
 * - Keyboard shortcuts (Enter = extend, Esc = logout)
 *
 * @example
 * ```tsx
 * <SessionTimeoutModal
 *   open={showWarning}
 *   timeRemaining={timeRemaining}
 *   onExtend={extendSession}
 *   onLogout={logout}
 * />
 * ```
 */
export function SessionTimeoutModal({
  open,
  timeRemaining,
  totalTime = 300, // Default 5 minutes
  onExtend,
  onLogout,
}: SessionTimeoutModalProps) {
  const [progress, setProgress] = useState(100);

  // Calculate progress percentage
  useEffect(() => {
    const percentage = (timeRemaining / totalTime) * 100;
    setProgress(Math.max(0, percentage));
  }, [timeRemaining, totalTime]);

  // Auto-logout when time runs out
  useEffect(() => {
    if (timeRemaining <= 0) {
      onLogout();
    }
  }, [timeRemaining, onLogout]);

  // Determine color based on time remaining
  const getColor = (): 'info' | 'warning' | 'error' => {
    if (timeRemaining > 180) return 'info'; // > 3 minutes: blue
    if (timeRemaining > 60) return 'warning'; // > 1 minute: yellow
    return 'error'; // <= 1 minute: red
  };

  // Determine severity for alert
  const getSeverity = (): 'info' | 'warning' | 'error' => {
    return getColor();
  };

  // Handle keyboard shortcuts
  useEffect(() => {
    if (!open) return;

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Enter') {
        event.preventDefault();
        onExtend();
      } else if (event.key === 'Escape') {
        event.preventDefault();
        onLogout();
      }
    };

    document.addEventListener('keydown', handleKeyDown);
    return () => {
      document.removeEventListener('keydown', handleKeyDown);
    };
  }, [open, onExtend, onLogout]);

  return (
    <Dialog
      open={open}
      onClose={(_, reason) => {
        // Prevent closing by clicking backdrop or pressing Esc
        // User must make explicit choice
        if (reason === 'backdropClick' || reason === 'escapeKeyDown') {
          return;
        }
      }}
      maxWidth="sm"
      fullWidth
      disableEscapeKeyDown
      aria-labelledby="session-timeout-dialog-title"
      aria-describedby="session-timeout-dialog-description"
      PaperProps={{
        sx: {
          // Slightly elevated to draw attention
          boxShadow: (theme) => theme.shadows[10],
        },
      }}
    >
      <DialogTitle
        id="session-timeout-dialog-title"
        sx={{
          display: 'flex',
          alignItems: 'center',
          gap: 1,
          pb: 1,
        }}
      >
        <ClockIcon color={getColor()} />
        Session Timeout Warning
      </DialogTitle>

      <DialogContent sx={{ pt: 2 }}>
        <Alert severity={getSeverity()} sx={{ mb: 2 }} id="session-timeout-dialog-description">
          Your session is about to expire due to inactivity. You will be automatically signed out
          in:
        </Alert>

        {/* Countdown Timer */}
        <Box
          sx={{
            textAlign: 'center',
            my: 3,
          }}
        >
          <Typography
            variant="h2"
            component="div"
            sx={{
              fontVariantNumeric: 'tabular-nums',
              fontWeight: 600,
              color: (theme) => {
                const colorMap = {
                  info: theme.palette.info.main,
                  warning: theme.palette.warning.main,
                  error: theme.palette.error.main,
                };
                return colorMap[getColor()];
              },
            }}
          >
            {formatTime(timeRemaining)}
          </Typography>
          <Typography variant="caption" color="text.secondary">
            minutes remaining
          </Typography>
        </Box>

        {/* Progress Bar */}
        <LinearProgress
          variant="determinate"
          value={progress}
          color={getColor()}
          sx={{
            height: 8,
            borderRadius: 1,
            mb: 2,
          }}
        />

        <Typography variant="body2" color="text.secondary" sx={{ textAlign: 'center' }}>
          Click &quot;Stay Signed In&quot; to continue your session.
        </Typography>

        {/* Keyboard shortcuts hint */}
        <Box sx={{ mt: 2, textAlign: 'center' }}>
          <Typography variant="caption" color="text.secondary">
            Keyboard shortcuts: <kbd>Enter</kbd> to stay signed in, <kbd>Esc</kbd> to sign out
          </Typography>
        </Box>
      </DialogContent>

      <DialogActions sx={{ px: 3, pb: 3, gap: 1 }}>
        <Button
          onClick={onLogout}
          variant="outlined"
          color="inherit"
          startIcon={<LogoutIcon />}
          fullWidth
          aria-label="Sign out now"
        >
          Sign Out Now
        </Button>
        <Button
          onClick={onExtend}
          variant="contained"
          color={getColor()}
          fullWidth
          autoFocus
          aria-label="Stay signed in"
          sx={{
            // Make button more prominent
            fontWeight: 600,
          }}
        >
          Stay Signed In
        </Button>
      </DialogActions>
    </Dialog>
  );
}
