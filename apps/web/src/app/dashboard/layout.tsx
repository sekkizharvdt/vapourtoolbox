'use client';

import { useState, useRef } from 'react';
import { Box, Toolbar } from '@mui/material';
import { Sidebar } from '@/components/dashboard/Sidebar';
import { DashboardAppBar } from '@/components/dashboard/AppBar';
import { useAuth } from '@/contexts/AuthContext';
import { useRouter } from 'next/navigation';
import { useEffect } from 'react';

function DashboardContent({ children }: { children: React.ReactNode }) {
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
  const hasRedirected = useRef(false);

  // Persist sidebar collapsed state
  useEffect(() => {
    if (typeof window !== 'undefined') {
      localStorage.setItem('sidebar-collapsed', sidebarCollapsed.toString());
    }
  }, [sidebarCollapsed]);

  // Redirect based on auth state (only once to prevent redirect loops)
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
    // Reset flag if auth becomes valid
    if (user && claims) {
      hasRedirected.current = false;
    }
  }, [user, claims, loading]);

  const handleDrawerToggle = () => {
    setMobileOpen(!mobileOpen);
  };

  const handleSidebarToggle = () => {
    setSidebarCollapsed(!sidebarCollapsed);
  };

  // Show nothing while checking auth
  if (loading) {
    return null;
  }

  // Don't render if not authenticated or pending approval (will redirect)
  if (!user || !claims) {
    return null;
  }

  const sidebarWidth = sidebarCollapsed ? 64 : 240;

  return (
    <Box sx={{ display: 'flex' }}>
      <DashboardAppBar
        onMenuClick={handleDrawerToggle}
        sidebarWidth={sidebarWidth}
      />

      <Sidebar
        mobileOpen={mobileOpen}
        onMobileClose={handleDrawerToggle}
        userRoles={claims?.roles || []}
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
          transition: (theme) => theme.transitions.create(['margin', 'width'], {
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

export default function DashboardLayout({ children }: { children: React.ReactNode }) {
  return <DashboardContent>{children}</DashboardContent>;
}
