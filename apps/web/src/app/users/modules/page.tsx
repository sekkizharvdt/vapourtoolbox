'use client';

/**
 * Legacy Modules Page - Redirect to Admin Section
 *
 * Module access is now managed in /admin/users.
 * Kept for backward compatibility - automatically redirects.
 */

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { Box, CircularProgress, Typography } from '@mui/material';

export default function LegacyModulesPage() {
  const router = useRouter();

  useEffect(() => {
    router.replace('/admin/users');
  }, [router]);

  return (
    <Box
      sx={{
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        minHeight: '100vh',
        gap: 2,
      }}
    >
      <CircularProgress />
      <Typography color="text.secondary">
        Module access has been merged into User Management. Redirecting to /admin/users...
      </Typography>
    </Box>
  );
}
