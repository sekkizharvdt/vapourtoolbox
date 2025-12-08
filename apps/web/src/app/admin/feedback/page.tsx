'use client';

/**
 * Feedback Management Page
 *
 * Admin page for reviewing user feedback, bug reports, and feature requests.
 * Permission check is handled by the parent admin layout.
 */

import { Box, Typography, Stack } from '@mui/material';
import { FeedbackList } from '@/components/admin/FeedbackList';

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
