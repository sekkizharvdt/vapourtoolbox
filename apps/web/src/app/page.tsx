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
    console.log('[HomePage] Checking redirect:', { pathname, loading, hasUser: !!user });

    // IMPORTANT: Only redirect if we're actually on the root page
    // For static export, Firebase serves index.html for all routes,
    // but Next.js will handle client-side routing to the correct page
    // So we must NOT redirect if the pathname is anything other than '/'
    if (pathname !== '/') {
      console.log('[HomePage] Not on root path, letting Next.js handle routing');
      return;
    }

    if (!loading) {
      if (user) {
        // User is logged in, redirect to dashboard
        console.log('[HomePage] User logged in, redirecting to /dashboard');
        router.push('/dashboard');
      } else {
        // User not logged in, redirect to login
        console.log('[HomePage] No user, redirecting to /login');
        router.push('/login');
      }
    }
  }, [user, loading, router, pathname]);

  // CRITICAL: Don't render root page content if we're on a different route
  // For static export, Firebase serves index.html for all routes initially,
  // but Next.js needs to hydrate the correct page component
  // If we render content here, it blocks the correct page from showing
  if (pathname !== '/') {
    console.log('[HomePage] Not rendering root page content, pathname:', pathname);
    return null; // Let Next.js render the correct page component
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
