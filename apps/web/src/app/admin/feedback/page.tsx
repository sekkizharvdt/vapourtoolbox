'use client';

import { Box, Typography, Stack, Alert, AlertTitle } from '@mui/material';
import { FeedbackList } from '@/components/admin/FeedbackList';
import { useAuth } from '@/contexts/AuthContext';
import { hasPermission, PERMISSION_FLAGS } from '@vapour/constants';
import { AuthenticatedLayout } from '@/components/layout/AuthenticatedLayout';

export default function FeedbackManagementPage() {
  const { claims, user } = useAuth();

  // Check if user has MANAGE_USERS permission (admin access)
  const userPermissions = claims?.permissions || 0;
  const canAccessFeedback = hasPermission(userPermissions, PERMISSION_FLAGS.MANAGE_USERS);

  if (!canAccessFeedback) {
    return (
      <AuthenticatedLayout>
        <Box sx={{ p: 3 }}>
          <Alert severity="error">
            <AlertTitle>Access Denied</AlertTitle>
            <Typography variant="body2">
              You need admin permissions (MANAGE_USERS) to access feedback management.
            </Typography>
            <Typography variant="body2" sx={{ mt: 1 }}>
              Current permissions: {userPermissions}
            </Typography>
            <Typography variant="body2">Email: {user?.email || 'Not logged in'}</Typography>
          </Alert>
        </Box>
      </AuthenticatedLayout>
    );
  }

  return (
    <AuthenticatedLayout>
      <Box sx={{ p: 3 }}>
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
    </AuthenticatedLayout>
  );
}
