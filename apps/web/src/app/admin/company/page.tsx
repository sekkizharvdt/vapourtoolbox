'use client';

/**
 * Admin Company Settings Page
 *
 * Redirects to the main company settings page.
 * Permission check is handled by the parent admin layout.
 */

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { Box, CircularProgress, Typography } from '@mui/material';

export default function AdminCompanyPage() {
  const router = useRouter();

  useEffect(() => {
    router.replace('/company');
  }, [router]);

  return (
    <Box
      sx={{
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        minHeight: '200px',
        gap: 2,
      }}
    >
      <CircularProgress />
      <Typography color="text.secondary">Redirecting to Company Settings...</Typography>
    </Box>
  );
}
