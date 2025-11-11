'use client';

import { useEffect } from 'react';
import { useRouter, usePathname } from 'next/navigation';
import { Box, Container, Typography, CircularProgress } from '@mui/material';
import { useAuth } from '@/contexts/AuthContext';

export default function HomePage() {
  const router = useRouter();
  const pathname = usePathname();
  const { user, loading } = useAuth();

  useEffect(() => {
    // Only redirect if we're actually on the root page
    if (pathname !== '/') {
      return;
    }

    if (!loading) {
      if (user) {
        // User is logged in, redirect to dashboard
        router.push('/dashboard');
      } else {
        // User not logged in, redirect to login
        router.push('/login');
      }
    }
  }, [user, loading, router, pathname]);

  // CRITICAL: Don't render anything if we're not on the root page
  // This prevents HomePage from interfering with client-side navigation
  // Must be after all hooks to follow Rules of Hooks
  if (pathname !== '/') {
    return null;
  }

  return (
    <Container maxWidth="lg">
      <Box
        sx={{
          minHeight: '100vh',
          display: 'flex',
          flexDirection: 'column',
          justifyContent: 'center',
          alignItems: 'center',
          textAlign: 'center',
          gap: 3,
        }}
      >
        <Typography variant="h1" gutterBottom>
          Vapour Toolbox
        </Typography>
        <Typography variant="h5" color="text.secondary" gutterBottom>
          Unified VDT Platform
        </Typography>
        <CircularProgress />
        <Typography variant="body1" color="text.secondary">
          {loading ? 'Loading...' : 'Redirecting...'}
        </Typography>
      </Box>
    </Container>
  );
}
