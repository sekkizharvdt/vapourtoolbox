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

const logger = createLogger({ context: 'AppError' });

interface ErrorProps {
  error: Error & { digest?: string };
  reset: () => void;
}

/**
 * Root-Level Error Boundary
 *
 * Catches errors that occur in the app directory and aren't caught
 * by module-specific error boundaries. Provides a user-friendly
 * error page with recovery options.
 */
export default function RootError({ error, reset }: ErrorProps) {
  const router = useRouter();

  useEffect(() => {
    // Log error to monitoring service
    logger.error('Application error', {
      message: error.message,
      digest: error.digest,
      stack: error.stack,
    });

    // Send to Sentry with app-level context
    Sentry.withScope((scope) => {
      scope.setTag('errorBoundary', 'root');
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
          maxWidth: 600,
          width: '100%',
        }}
      >
        <Stack spacing={3} alignItems="center">
          <ErrorIcon sx={{ fontSize: 72, color: 'error.main' }} />

          <Typography variant="h4" component="h1" fontWeight="bold" textAlign="center">
            Something went wrong
          </Typography>

          <Alert severity="error" sx={{ width: '100%' }}>
            <Typography variant="body1">
              An unexpected error occurred. Your data has not been modified. Please try again or
              contact support if the problem persists.
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
              Try Again
            </Button>
            <Button
              variant="outlined"
              startIcon={<HomeIcon />}
              onClick={() => router.push('/dashboard')}
            >
              Go to Dashboard
            </Button>
          </Stack>
        </Stack>
      </Paper>
    </Box>
  );
}
