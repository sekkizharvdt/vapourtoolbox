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

const logger = createLogger({ context: 'AccountingError' });

interface ErrorProps {
  error: Error & { digest?: string };
  reset: () => void;
}

/**
 * Error Boundary for Accounting Module
 *
 * Catches and handles errors in the accounting module with module-specific
 * context and recovery options.
 */
export default function AccountingError({ error, reset }: ErrorProps) {
  const router = useRouter();

  useEffect(() => {
    // Log error to monitoring service
    logger.error('Accounting module error', {
      message: error.message,
      digest: error.digest,
      stack: error.stack,
    });

    // Send to Sentry with module-specific context
    Sentry.withScope((scope) => {
      scope.setTag('module', 'accounting');
      scope.setTag('errorBoundary', 'accounting-module');
      if (error.digest) {
        scope.setTag('errorDigest', error.digest);
      }
      scope.setLevel('error');
      scope.setContext('moduleInfo', {
        module: 'accounting',
        description: 'Error in financial data processing',
      });
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
            Accounting Module Error
          </Typography>

          <Alert severity="error" sx={{ width: '100%' }}>
            <Typography variant="body1">
              An error occurred while processing your financial data. Your data has not been
              modified. Please try again or contact support if the problem persists.
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
