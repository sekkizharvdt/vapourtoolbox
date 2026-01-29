'use client';

import { Box, Typography, Button, Paper, Stack } from '@mui/material';
import {
  SearchOff as NotFoundIcon,
  Home as HomeIcon,
  ArrowBack as BackIcon,
} from '@mui/icons-material';
import { useRouter } from 'next/navigation';
import Link from 'next/link';

/**
 * Not Found Page (404)
 *
 * Displayed when a user navigates to a route that doesn't exist.
 * Provides helpful navigation options to get back to valid pages.
 */
export default function NotFound() {
  const router = useRouter();

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
          maxWidth: 500,
          width: '100%',
          textAlign: 'center',
        }}
      >
        <Stack spacing={3} alignItems="center">
          <NotFoundIcon sx={{ fontSize: 72, color: 'text.secondary' }} />

          <Typography variant="h3" component="h1" fontWeight="bold">
            404
          </Typography>

          <Typography variant="h5" component="h2" color="text.secondary">
            Page Not Found
          </Typography>

          <Typography variant="body1" color="text.secondary">
            The page you&apos;re looking for doesn&apos;t exist or has been moved.
          </Typography>

          <Stack direction="row" spacing={2} flexWrap="wrap" justifyContent="center" sx={{ mt: 2 }}>
            <Button variant="outlined" startIcon={<BackIcon />} onClick={() => router.back()}>
              Go Back
            </Button>
            <Button variant="contained" startIcon={<HomeIcon />} component={Link} href="/dashboard">
              Go to Dashboard
            </Button>
          </Stack>
        </Stack>
      </Paper>
    </Box>
  );
}
