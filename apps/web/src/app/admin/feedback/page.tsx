'use client';

/**
 * Feedback Management Page
 *
 * Admin page for reviewing user feedback, bug reports, and feature requests.
 * Permission check is handled by the parent admin layout.
 */

import { Box, Typography, Stack, Skeleton } from '@mui/material';
import dynamic from 'next/dynamic';

// Lazy load FeedbackList - admin-only component (700+ lines)
const FeedbackList = dynamic(
  () => import('@/components/admin/FeedbackList').then((mod) => mod.FeedbackList),
  {
    ssr: false,
    loading: () => (
      <Box>
        <Skeleton variant="rectangular" height={56} sx={{ mb: 2, borderRadius: 1 }} />
        <Skeleton variant="rectangular" height={400} sx={{ borderRadius: 1 }} />
      </Box>
    ),
  }
);

export default function FeedbackManagementPage() {
  return (
    <Box>
      <Stack direction="row" justifyContent="space-between" alignItems="center" sx={{ mb: 3 }}>
        <Box>
          <Typography variant="h4">Feedback Management</Typography>
          <Typography variant="body1" color="text.secondary">
            Review and manage user feedback, bug reports, and feature requests
          </Typography>
        </Box>
      </Stack>

      <FeedbackList />
    </Box>
  );
}
