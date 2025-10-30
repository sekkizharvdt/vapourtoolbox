'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { Box, Container, Typography, CircularProgress } from '@mui/material';
import { useAuth } from '@/contexts/AuthContext';

export default function HomePage() {
  const router = useRouter();
  const { user, loading } = useAuth();

  useEffect(() => {
    if (!loading) {
      if (user) {
        // User is logged in, redirect to dashboard
        router.push('/dashboard');
      } else {
        // User not logged in, redirect to login
        router.push('/login');
      }
    }
  }, [user, loading, router]);

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
