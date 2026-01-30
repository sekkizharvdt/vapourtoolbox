'use client';

/**
 * Admin Section Layout
 *
 * Wraps all /admin/* pages with permission check for MANAGE_USERS.
 * Provides consistent layout and access control.
 */

import { ReactNode } from 'react';
import { Box, Alert, AlertTitle, Typography, Container, Breadcrumbs, Link } from '@mui/material';
import { AdminPanelSettings as AdminIcon } from '@mui/icons-material';
import { useAuth } from '@/contexts/AuthContext';
import { hasPermission, PERMISSION_FLAGS } from '@vapour/constants';
import { AuthenticatedLayout } from '@/components/layout/AuthenticatedLayout';
import NextLink from 'next/link';
import { usePathname } from 'next/navigation';

interface AdminLayoutProps {
  children: ReactNode;
}

/**
 * Get breadcrumb items from pathname
 */
function getBreadcrumbs(pathname: string) {
  const segments = pathname.split('/').filter(Boolean);
  const items: { label: string; href: string }[] = [];

  // Always start with Admin
  items.push({ label: 'Administration', href: '/admin' });

  // Map known paths to friendly names
  const pathNames: Record<string, string> = {
    users: 'User Management',
    company: 'Company Settings',
    feedback: 'Feedback',
    'audit-logs': 'Audit Logs',
    seed: 'Seed Data',
    'seed-materials': 'Seed Materials',
    'hr-setup': 'HR Setup',
    activity: 'Activity Feed',
    backup: 'Data Backup',
    notifications: 'Notification Settings',
    settings: 'Settings',
    'task-analytics': 'Task Analytics',
  };

  // Add subsequent segments
  for (let i = 1; i < segments.length; i++) {
    const segment = segments[i];
    if (segment) {
      const href = '/' + segments.slice(0, i + 1).join('/');
      const label = pathNames[segment] || segment.charAt(0).toUpperCase() + segment.slice(1);
      items.push({ label, href });
    }
  }

  return items;
}

export default function AdminLayout({ children }: AdminLayoutProps) {
  const { claims, user } = useAuth();
  const pathname = usePathname();

  // Check if user has MANAGE_USERS permission (admin access)
  const userPermissions = claims?.permissions || 0;
  const canAccessAdmin = hasPermission(userPermissions, PERMISSION_FLAGS.MANAGE_USERS);

  // Get breadcrumbs
  const breadcrumbs = getBreadcrumbs(pathname);
  const isAdminRoot = pathname === '/admin';

  if (!canAccessAdmin) {
    return (
      <AuthenticatedLayout>
        <Container maxWidth="xl">
          <Box sx={{ p: 3 }}>
            <Alert severity="error">
              <AlertTitle>Access Denied</AlertTitle>
              <Typography variant="body2">
                You need admin permissions to access the Administration section.
              </Typography>
              <Typography variant="body2" sx={{ mt: 1 }}>
                Contact your administrator if you need access.
              </Typography>
              <Typography variant="caption" color="text.secondary" sx={{ mt: 1, display: 'block' }}>
                Email: {user?.email || 'Not logged in'}
              </Typography>
            </Alert>
          </Box>
        </Container>
      </AuthenticatedLayout>
    );
  }

  return (
    <AuthenticatedLayout>
      <Container maxWidth="xl">
        <Box sx={{ py: 2 }}>
          {/* Breadcrumbs - only show if not on admin root */}
          {!isAdminRoot && breadcrumbs.length > 1 && (
            <Breadcrumbs sx={{ mb: 2 }}>
              {breadcrumbs.map((item, index) => {
                const isLast = index === breadcrumbs.length - 1;
                return isLast ? (
                  <Typography key={item.href} color="text.primary" fontWeight="medium">
                    {item.label}
                  </Typography>
                ) : (
                  <Link
                    key={item.href}
                    component={NextLink}
                    href={item.href}
                    underline="hover"
                    color="inherit"
                    sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}
                  >
                    {index === 0 && <AdminIcon fontSize="small" />}
                    {item.label}
                  </Link>
                );
              })}
            </Breadcrumbs>
          )}

          {children}
        </Box>
      </Container>
    </AuthenticatedLayout>
  );
}
