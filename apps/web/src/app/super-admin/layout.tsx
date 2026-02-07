'use client';

import { ReactNode } from 'react';
import { Box, Alert, AlertTitle, Typography, Stack } from '@mui/material';
import { useAuth } from '@/contexts/AuthContext';
import { getAllPermissions, getAllPermissions2 } from '@vapour/constants';

interface SuperAdminLayoutProps {
  children: ReactNode;
}

export default function SuperAdminLayout({ children }: SuperAdminLayoutProps) {
  const { claims, user } = useAuth();

  // Check if user has SUPER_ADMIN permissions (all permissions in both fields)
  const requiredPermissions = getAllPermissions();
  const requiredPermissions2 = getAllPermissions2();
  const currentPermissions = claims?.permissions || 0;
  const currentPermissions2 = claims?.permissions2 || 0;
  // Use bitwise AND to check all required bits are set (not strict equality)
  // This ensures adding new permissions doesn't break existing super admins
  const hasAllPerms1 = (currentPermissions & requiredPermissions) === requiredPermissions;
  const hasAllPerms2 = (currentPermissions2 & requiredPermissions2) === requiredPermissions2;
  const isSuperAdmin = hasAllPerms1 && hasAllPerms2;

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
