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
    // IMPORTANT: Only redirect if we're actually on the root page
    // For static export, Firebase serves index.html for all routes,
    // but Next.js will handle client-side routing to the correct page
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
