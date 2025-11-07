'use client';

import { ReactNode } from 'react';
import { Box, Alert } from '@mui/material';
import { useAuth } from '@/contexts/AuthContext';
import { getAllPermissions } from '@vapour/constants';

interface SuperAdminLayoutProps {
  children: ReactNode;
}

export default function SuperAdminLayout({ children }: SuperAdminLayoutProps) {
  const { claims } = useAuth();

  // Check if user has SUPER_ADMIN permissions (all permissions)
  const isSuperAdmin = (claims?.permissions || 0) === getAllPermissions();

  if (!isSuperAdmin) {
    return (
      <Box sx={{ p: 3 }}>
        <Alert severity="error">
          Access Denied: Super Admin privileges required to access this section.
        </Alert>
      </Box>
    );
  }

  return <>{children}</>;
}
