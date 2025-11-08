'use client';

import { ReactNode } from 'react';
import { Box, Alert, AlertTitle, Typography, Stack } from '@mui/material';
import { useAuth } from '@/contexts/AuthContext';
import { getAllPermissions } from '@vapour/constants';

interface SuperAdminLayoutProps {
  children: ReactNode;
}

export default function SuperAdminLayout({ children }: SuperAdminLayoutProps) {
  const { claims, user } = useAuth();

  // Check if user has SUPER_ADMIN permissions (all permissions)
  const requiredPermissions = getAllPermissions();
  const currentPermissions = claims?.permissions || 0;
  const isSuperAdmin = currentPermissions === requiredPermissions;

  if (!isSuperAdmin) {
    return (
      <Box sx={{ p: 3 }}>
        <Alert severity="error">
          <AlertTitle>Access Denied: Super Admin Privileges Required</AlertTitle>
          <Stack spacing={1} sx={{ mt: 1 }}>
            <Typography variant="body2">
              You need SUPER_ADMIN permissions to access this section.
            </Typography>
            <Typography variant="body2" sx={{ mt: 1 }}>
              <strong>Current Status:</strong>
            </Typography>
            <Typography variant="body2" component="div" sx={{ ml: 2 }}>
              • Email: {user?.email || 'Not logged in'}
              <br />• Permissions: {currentPermissions} (Required: {requiredPermissions})
              <br />• Domain: {claims?.domain || 'Not set'}
            </Typography>
            <Typography variant="body2" sx={{ mt: 2 }}>
              <strong>To grant Super Admin access:</strong>
            </Typography>
            <Typography variant="body2" component="div" sx={{ ml: 2 }}>
              1. Open Firebase Console → Firestore Database
              <br />
              2. Find your user in the &quot;users&quot; collection
              <br />
              3. Update these fields:
              <br />
              &nbsp;&nbsp;&nbsp;• <code>permissions: {requiredPermissions}</code>
              <br />
              &nbsp;&nbsp;&nbsp;• <code>status: &quot;active&quot;</code>
              <br />
              &nbsp;&nbsp;&nbsp;• <code>isActive: true</code>
              <br />
              4. Sign out and sign back in to refresh your token
            </Typography>
          </Stack>
        </Alert>
      </Box>
    );
  }

  return <>{children}</>;
}
