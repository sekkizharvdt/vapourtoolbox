'use client';

import { useEffect } from 'react';
import { Box, Typography, Button, Paper, Stack, Alert } from '@mui/material';
import { ErrorOutline as ErrorIcon, Refresh as RefreshIcon } from '@mui/icons-material';
import { createLogger } from '@vapour/logger';
import * as Sentry from '@sentry/nextjs';

const logger = createLogger({ context: 'PendingApprovalError' });

interface ErrorProps {
  error: Error & { digest?: string };
  reset: () => void;
}

/**
 * Error Boundary for Pending Approval Module
 */
export default function PendingApprovalError({ error, reset }: ErrorProps) {
  useEffect(() => {
    logger.error('Pending approval module error', {
      message: error.message,
      digest: error.digest,
      stack: error.stack,
    });

    Sentry.withScope((scope) => {
      scope.setTag('module', 'pending-approval');
      scope.setTag('errorBoundary', 'pending-approval-module');
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
        minHeight: '100vh',
        p: 3,
      }}
    >
      <Paper elevation={3} sx={{ p: 4, maxWidth: 500, width: '100%' }}>
        <Stack spacing={3} alignItems="center">
          <ErrorIcon sx={{ fontSize: 72, color: 'error.main' }} />
          <Typography variant="h4" component="h1" fontWeight="bold" textAlign="center">
            Error
          </Typography>
          <Alert severity="warning" sx={{ width: '100%' }}>
            <Typography variant="body1">
              An error occurred. Please try refreshing the page.
            </Typography>
          </Alert>
          <Typography variant="body2" color="text.secondary" textAlign="center">
            This error has been automatically logged.
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
          <Button
            variant="contained"
            color="primary"
            startIcon={<RefreshIcon />}
            onClick={reset}
            fullWidth
          >
            Try Again
          </Button>
        </Stack>
      </Paper>
    </Box>
  );
}
