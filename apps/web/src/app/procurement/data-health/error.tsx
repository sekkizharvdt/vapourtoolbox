'use client';

import { useEffect } from 'react';
import { Box, Typography, Button, Paper, Stack, Alert } from '@mui/material';
import {
  ErrorOutline as ErrorIcon,
  Home as HomeIcon,
  Refresh as RefreshIcon,
  ArrowBack as BackIcon,
} from '@mui/icons-material';
import { useRouter } from 'next/navigation';
import { createLogger } from '@vapour/logger';
import * as Sentry from '@sentry/nextjs';

const logger = createLogger({ context: 'ProcurementDataHealthError' });

interface ErrorProps {
  error: Error & { digest?: string };
  reset: () => void;
}

/**
 * Error Boundary for Procurement Data Health
 */
export default function ProcurementDataHealthError({ error, reset }: ErrorProps) {
  const router = useRouter();

  useEffect(() => {
    logger.error('Procurement data health error', {
      message: error.message,
      digest: error.digest,
      stack: error.stack,
    });

    Sentry.withScope((scope) => {
      scope.setTag('module', 'procurement');
      scope.setTag('feature', 'data-health');
      scope.setTag('errorBoundary', 'procurement-data-health');
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
            Data Health Error
          </Typography>

          <Alert severity="error" sx={{ width: '100%' }}>
            <Typography variant="body1">
              An error occurred while analyzing procurement data. This may be due to network issues
              or data inconsistencies. Please try again.
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
            <Button variant="outlined" startIcon={<BackIcon />} onClick={() => router.back()}>
              Go Back
            </Button>
            <Button
              variant="outlined"
              startIcon={<HomeIcon />}
              onClick={() => router.push('/procurement')}
            >
              Procurement Home
            </Button>
          </Stack>
        </Stack>
      </Paper>
    </Box>
  );
}
