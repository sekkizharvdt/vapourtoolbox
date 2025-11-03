'use client';

import { useRouter } from 'next/navigation';
import { useAuth } from '@/contexts/AuthContext';
import { Container, Box, CircularProgress } from '@mui/material';

/**
 * Tasks Layout
 *
 * The tasks page is accessible to all authenticated users as it shows
 * personal task notifications and time tracking.
 * No specific module permissions required.
 */
export default function TasksLayout({ children }: { children: React.ReactNode }) {
  const { user, loading } = useAuth();
  const router = useRouter();

  // Show loading state
  if (loading) {
    return (
      <Container maxWidth="xl">
        <Box
          sx={{
            display: 'flex',
            justifyContent: 'center',
            alignItems: 'center',
            minHeight: '60vh',
          }}
        >
          <CircularProgress />
        </Box>
      </Container>
    );
  }

  // Redirect to login if not authenticated
  if (!user) {
    router.push('/login');
    return null;
  }

  // All authenticated users can access tasks
  return <>{children}</>;
}
