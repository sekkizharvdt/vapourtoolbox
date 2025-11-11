'use client';

import { useState, useEffect, useRef, ReactNode } from 'react';
import { Box, Toolbar, Typography, Container, CircularProgress } from '@mui/material';
import { Sidebar } from '@/components/dashboard/Sidebar';
import { DashboardAppBar } from '@/components/dashboard/AppBar';
import { useAuth } from '@/contexts/AuthContext';
import { useRouter, usePathname } from 'next/navigation';

interface ModuleLayoutProps {
  children: ReactNode;
  /**
   * Function to check if the user has permission to access this module
   * @param permissions - The user's permission bitmask
   * @returns true if the user has access, false otherwise
   */
  permissionCheck: (permissions: number) => boolean;
  /**
   * The module name displayed in the access denied message
   */
  moduleName: string;
}

/**
 * Reusable layout component for all application modules
 *
 * This component provides:
 * - Sidebar navigation with collapse/expand functionality
 * - AppBar with theme toggle and user menu
 * - Authentication checks and redirects
 * - Permission-based access control
 * - Consistent layout across all modules
 *
 * @example
 * ```tsx
 * // In apps/web/src/app/accounting/layout.tsx
 * import { ModuleLayout } from '@/components/layouts/ModuleLayout';
 * import { canViewAccounting } from '@vapour/constants';
 *
 * export default function AccountingLayout({ children }: { children: React.ReactNode }) {
 *   return (
 *     <ModuleLayout
 *       permissionCheck={canViewAccounting}
 *       moduleName="Accounting"
 *     >
 *       {children}
 *     </ModuleLayout>
 *   );
 * }
 * ```
 */
export function ModuleLayout({ children, permissionCheck, moduleName }: ModuleLayoutProps) {
  const [mobileOpen, setMobileOpen] = useState(false);
  const [sidebarCollapsed, setSidebarCollapsed] = useState(() => {
    // Load collapsed state from localStorage
    if (typeof window !== 'undefined') {
      const saved = localStorage.getItem('sidebar-collapsed');
      return saved === 'true';
    }
    return false;
  });
  const { user, claims, loading } = useAuth();
  const router = useRouter();
  const pathname = usePathname();
  const hasRedirected = useRef(false);
  const lastPathname = useRef(pathname);

  // Persist sidebar collapsed state
  useEffect(() => {
    if (typeof window !== 'undefined') {
      localStorage.setItem('sidebar-collapsed', sidebarCollapsed.toString());
    }
  }, [sidebarCollapsed]);

  // Reset redirect flag when pathname changes (navigating between routes)
  useEffect(() => {
    if (pathname !== lastPathname.current) {
      hasRedirected.current = false;
      lastPathname.current = pathname;
    }
  }, [pathname]);

  // Redirect based on auth state (only once per route to prevent redirect loops)
  useEffect(() => {
    if (!loading && !hasRedirected.current) {
      if (!user) {
        // Not authenticated - redirect to login
        hasRedirected.current = true;
        router.push('/login');
      } else if (!claims) {
        // Authenticated but no claims - redirect to pending approval
        hasRedirected.current = true;
        router.push('/pending-approval');
      }
    }
  }, [user, claims, loading, router, pathname, moduleName]);

  const handleDrawerToggle = () => {
    setMobileOpen(!mobileOpen);
  };

  const handleSidebarToggle = () => {
    setSidebarCollapsed(!sidebarCollapsed);
  };

  // Show loading indicator while checking auth
  if (loading) {
    return (
      <Box
        sx={{
          display: 'flex',
          justifyContent: 'center',
          alignItems: 'center',
          minHeight: '100vh',
        }}
      >
        <CircularProgress />
      </Box>
    );
  }

  // Don't render if not authenticated or pending approval (will redirect)
  if (!user || !claims) {
    return null;
  }

  // Check module-specific permissions
  const userPermissions = claims.permissions || 0;
  const hasAccess = permissionCheck(userPermissions);

  // If no permission, show access denied
  if (!hasAccess) {
    return (
      <Container maxWidth="xl">
        <Box sx={{ py: 4, textAlign: 'center' }}>
          <Typography variant="h5" color="error" gutterBottom>
            Access Denied
          </Typography>
          <Typography variant="body1" color="text.secondary">
            You do not have permission to access the {moduleName} module.
          </Typography>
        </Box>
      </Container>
    );
  }

  const sidebarWidth = sidebarCollapsed ? 64 : 240;

  return (
    <Box sx={{ display: 'flex' }}>
      <DashboardAppBar onMenuClick={handleDrawerToggle} sidebarWidth={sidebarWidth} />

      <Sidebar
        mobileOpen={mobileOpen}
        onMobileClose={handleDrawerToggle}
        userPermissions={claims?.permissions || 0}
        collapsed={sidebarCollapsed}
        onToggleCollapse={handleSidebarToggle}
      />

      <Box
        component="main"
        sx={{
          flexGrow: 1,
          p: 3,
          width: { xs: '100%', md: `calc(100% - ${sidebarWidth}px)` },
          ml: { xs: 0, md: `${sidebarWidth}px` },
          minHeight: '100vh',
          bgcolor: 'background.default',
          transition: (theme) =>
            theme.transitions.create(['margin', 'width'], {
              easing: theme.transitions.easing.sharp,
              duration: theme.transitions.duration.enteringScreen,
            }),
        }}
      >
        <Toolbar /> {/* Spacer for AppBar */}
        {children}
      </Box>
    </Box>
  );
}
