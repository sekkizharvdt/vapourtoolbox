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
  permissionCheck?: (permissions: number) => boolean;
  /**
   * Function to check if the user has extended permission (permissions2) to access this module
   * @param permissions2 - The user's extended permission bitmask
   * @returns true if the user has access, false otherwise
   */
  permissionCheck2?: (permissions2: number) => boolean;
  /**
   * The module name displayed in the access denied message
   */
  moduleName: string;
  /**
   * Optional module ID for visibility check (from MODULES constant)
   * If provided, user's allowedModules will be checked
   */
  moduleId?: string;
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
export function ModuleLayout({
  children,
  permissionCheck,
  permissionCheck2,
  moduleName,
  moduleId,
}: ModuleLayoutProps) {
  const [mobileOpen, setMobileOpen] = useState(false);
  const [sidebarCollapsed, setSidebarCollapsed] = useState(() => {
    // Load collapsed state from localStorage
    if (typeof window !== 'undefined') {
      const saved = localStorage.getItem('sidebar-collapsed');
      return saved === 'true';
    }
    return false;
  });
  const [authTimeout, setAuthTimeout] = useState(false);
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

  // Auth loading timeout handler
  useEffect(() => {
    if (!loading) {
      setAuthTimeout(false);
      return;
    }

    const timer = setTimeout(() => {
      setAuthTimeout(true);
    }, 5000);

    return () => clearTimeout(timer);
  }, [loading]);

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

  // Show loading indicator while checking auth (with timeout failsafe)
  if (loading && !authTimeout) {
    return (
      <Box
        sx={{
          display: 'flex',
          flexDirection: 'column',
          justifyContent: 'center',
          alignItems: 'center',
          minHeight: '100vh',
          gap: 2,
        }}
      >
        <CircularProgress />
        <Typography variant="body2" color="text.secondary">
          Loading authentication...
        </Typography>
      </Box>
    );
  }

  // If auth loading timed out, show error and allow render
  if (authTimeout && loading) {
    return (
      <Container maxWidth="xl">
        <Box sx={{ py: 4, textAlign: 'center' }}>
          <Typography variant="h5" color="error" gutterBottom>
            Authentication Timeout
          </Typography>
          <Typography variant="body1" color="text.secondary" gutterBottom>
            Authentication is taking longer than expected. Please refresh the page.
          </Typography>
          <Typography variant="body2" color="text.secondary" sx={{ mt: 2 }}>
            Debug Info: loading={String(loading)}, user={String(!!user)}, claims={String(!!claims)}
          </Typography>
        </Box>
      </Container>
    );
  }

  // Don't render if not authenticated or pending approval (will redirect)
  if (!user || !claims) {
    return null;
  }

  // Check module-specific permissions
  const userPermissions = claims.permissions || 0;
  const userPermissions2 = claims.permissions2 || 0;
  const allowedModules = claims.allowedModules || [];

  // Check permission access - must pass either permissionCheck OR permissionCheck2 (or both if both provided)
  const hasPermissionAccess =
    (permissionCheck ? permissionCheck(userPermissions) : true) &&
    (permissionCheck2 ? permissionCheck2(userPermissions2) : true);

  // Check module visibility (if moduleId provided and allowedModules is restricted)
  const hasModuleVisibility =
    !moduleId || // No moduleId means no visibility check
    !allowedModules || // No allowedModules means all modules visible
    allowedModules.length === 0 || // Empty array means all modules visible
    allowedModules.includes(moduleId); // Check if this module is allowed

  const hasAccess = hasPermissionAccess && hasModuleVisibility;

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
        userPermissions={userPermissions}
        userPermissions2={userPermissions2}
        allowedModules={allowedModules}
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
