'use client';

import { Box, Typography, Stack, Alert, AlertTitle } from '@mui/material';
import { AuditLogList } from '@/components/admin/AuditLogList';
import { useAuth } from '@/contexts/AuthContext';
import { hasPermission, PERMISSION_FLAGS } from '@vapour/constants';
import { AuthenticatedLayout } from '@/components/layout/AuthenticatedLayout';

export default function AuditLogsPage() {
  const { claims, user } = useAuth();

  // Check if user has MANAGE_USERS permission (admin access)
  const userPermissions = claims?.permissions || 0;
  const canAccessAuditLogs = hasPermission(userPermissions, PERMISSION_FLAGS.MANAGE_USERS);

  if (!canAccessAuditLogs) {
    return (
      <AuthenticatedLayout>
        <Box sx={{ p: 3 }}>
          <Alert severity="error">
            <AlertTitle>Access Denied</AlertTitle>
            <Typography variant="body2">
              You need admin permissions (MANAGE_USERS) to access the audit logs.
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
            <Typography variant="h4">Audit Logs</Typography>
            <Typography variant="body1" color="text.secondary">
              View system activity and track changes across all modules
            </Typography>
          </Box>
        </Stack>

        <AuditLogList />
      </Box>
    </AuthenticatedLayout>
  );
}
