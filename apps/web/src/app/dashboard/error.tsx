'use client';

import { useEffect } from 'react';
import { Box, Typography, Button, Paper, Stack, Alert } from '@mui/material';
import {
  ErrorOutline as ErrorIcon,
  Home as HomeIcon,
  Refresh as RefreshIcon,
} from '@mui/icons-material';
import { useRouter } from 'next/navigation';
import { createLogger } from '@vapour/logger';
import * as Sentry from '@sentry/nextjs';

const logger = createLogger({ context: 'DashboardError' });

interface ErrorProps {
  error: Error & { digest?: string };
  reset: () => void;
}

/**
 * Error Boundary for Dashboard Module
 *
 * Catches and handles errors in the dashboard module with module-specific
 * context and recovery options.
 */
export default function DashboardError({ error, reset }: ErrorProps) {
  const router = useRouter();

  useEffect(() => {
    // Log error to monitoring service
    logger.error('Dashboard module error', {
      message: error.message,
      digest: error.digest,
      stack: error.stack,
    });

    // Send to Sentry with module-specific context
    Sentry.withScope((scope) => {
      scope.setTag('module', 'dashboard');
      scope.setTag('errorBoundary', 'dashboard-module');
      if (error.digest) {
        scope.setTag('errorDigest', error.digest);
      }
      scope.setLevel('error');
      Sentry.captureException(error);
    });
  }, [error]);

  return (
    <Box
      sx={{
        display: 'flex',
        justifyContent: 'center',
        alignItems: 'center',
        minHeight: '60vh',
        p: 3,
      }}
    >
      <Paper
        elevation={3}
        sx={{
          p: 4,
          maxWidth: 700,
          width: '100%',
        }}
      >
        <Stack spacing={3} alignItems="center">
          <ErrorIcon sx={{ fontSize: 72, color: 'error.main' }} />

          <Typography variant="h4" component="h1" fontWeight="bold" textAlign="center">
            Dashboard Error
          </Typography>

          <Alert severity="warning" sx={{ width: '100%' }}>
            <Typography variant="body1">
              An error occurred while loading the dashboard. This might be a temporary issue with
              loading your data. Please try refreshing the page.
            </Typography>
          </Alert>

          <Typography variant="body2" color="text.secondary" textAlign="center">
            This error has been automatically logged for investigation.
            {error.digest && ` Error ID: ${error.digest}`}
          </Typography>

          {process.env.NODE_ENV === 'development' && (
            <Box
              sx={{
                mt: 2,
                p: 2,
                bgcolor: 'grey.100',
                borderRadius: 1,
                width: '100%',
                maxHeight: 200,
                overflow: 'auto',
              }}
            >
              <Typography
                variant="caption"
                component="pre"
                fontFamily="monospace"
                sx={{ whiteSpace: 'pre-wrap', wordBreak: 'break-word' }}
              >
                {error.message}
                {error.stack && `\n\n${error.stack}`}
              </Typography>
            </Box>
          )}

          <Stack direction="row" spacing={2} flexWrap="wrap" justifyContent="center">
            <Button variant="contained" color="primary" startIcon={<RefreshIcon />} onClick={reset}>
              Refresh Dashboard
            </Button>
            <Button variant="outlined" startIcon={<HomeIcon />} onClick={() => router.push('/')}>
              Go Home
            </Button>
          </Stack>
        </Stack>
      </Paper>
    </Box>
  );
}
