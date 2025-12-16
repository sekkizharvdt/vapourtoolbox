'use client';

import { useState, useRef, useEffect } from 'react';
import { Box, Toolbar } from '@mui/material';
import dynamic from 'next/dynamic';
import { Sidebar } from '@/components/dashboard/Sidebar';
import { DashboardAppBar } from '@/components/dashboard/AppBar';
import { MobileBottomNav } from '@/components/layout/BottomNavigation';
import { SessionTimeoutModal } from '@/components/auth/SessionTimeoutModal';
import { useCommandPalette } from '@/components/common/useCommandPalette';
import { KeyboardShortcutsProvider } from '@/hooks/useKeyboardShortcuts';
import { OnboardingProvider } from '@/components/common/OnboardingTooltip';
import { useAuth } from '@/contexts/AuthContext';
import { useRouter } from 'next/navigation';
import { useSessionTimeout } from '@/hooks/useSessionTimeout';

// Lazy load modal components - only loaded when user triggers them
const CommandPalette = dynamic(
  () => import('@/components/common/CommandPalette').then((mod) => mod.CommandPalette),
  { ssr: false }
);

const KeyboardShortcutsHelp = dynamic(
  () =>
    import('@/components/common/KeyboardShortcutsHelp').then((mod) => mod.KeyboardShortcutsHelp),
  { ssr: false }
);

interface AuthenticatedLayoutProps {
  children: React.ReactNode;
  /** If true, the main sidebar starts collapsed (64px icons only). Useful for modules with secondary sidebars. */
  defaultSidebarCollapsed?: boolean;
  /** If true, removes padding from main content area. Useful for modules with their own layout. */
  noPadding?: boolean;
}

export function AuthenticatedLayout({
  children,
  defaultSidebarCollapsed,
  noPadding,
}: AuthenticatedLayoutProps) {
  const [mobileOpen, setMobileOpen] = useState(false);
  const [sidebarCollapsed, setSidebarCollapsed] = useState(() => {
    // If defaultSidebarCollapsed is explicitly set, use it
    if (defaultSidebarCollapsed !== undefined) {
      return defaultSidebarCollapsed;
    }
    // Otherwise load from localStorage
    if (typeof window !== 'undefined') {
      const saved = localStorage.getItem('sidebar-collapsed');
      return saved === 'true';
    }
    return false;
  });
  const { user, claims, loading } = useAuth();
  const router = useRouter();
  const hasRedirected = useRef(false);

  // Session timeout management (must be called before any conditional returns)
  const { showWarning, timeRemaining, extendSession, logout } = useSessionTimeout();

  // Command palette (Cmd+K)
  const commandPalette = useCommandPalette();

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
  }, [user, claims, loading, router]);

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
        <Box sx={{ textAlign: 'center' }}>
          <Box
            component="div"
            sx={{
              width: 40,
              height: 40,
              margin: '0 auto 16px',
              border: '4px solid',
              borderColor: 'primary.main',
              borderTopColor: 'transparent',
              borderRadius: '50%',
              animation: 'spin 1s linear infinite',
              '@keyframes spin': {
                '0%': { transform: 'rotate(0deg)' },
                '100%': { transform: 'rotate(360deg)' },
              },
            }}
          />
          <Box sx={{ color: 'text.secondary' }}>Loading...</Box>
        </Box>
      </Box>
    );
  }

  // Don't render if not authenticated or pending approval (will redirect)
  if (!user || !claims) {
    return null;
  }

  // Must match SIDEBAR_WIDTH_COLLAPSED (80) and SIDEBAR_WIDTH (240) from Sidebar.tsx
  const sidebarWidth = sidebarCollapsed ? 80 : 240;

  return (
    <OnboardingProvider>
      <KeyboardShortcutsProvider>
        <Box sx={{ display: 'flex' }}>
          <DashboardAppBar
            onMenuClick={handleDrawerToggle}
            sidebarWidth={sidebarWidth}
            onCommandPaletteOpen={commandPalette.toggle}
          />

          <Sidebar
            mobileOpen={mobileOpen}
            onMobileClose={handleDrawerToggle}
            userPermissions={claims?.permissions || 0}
            userPermissions2={claims?.permissions2 || 0}
            collapsed={sidebarCollapsed}
            onToggleCollapse={handleSidebarToggle}
          />

          <Box
            component="main"
            sx={{
              flexGrow: 1,
              p: noPadding ? 0 : 3,
              pb: { xs: noPadding ? 7 : 10, md: noPadding ? 0 : 3 }, // Extra padding on mobile for bottom nav
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

          {/* Mobile Bottom Navigation */}
          <MobileBottomNav onMoreClick={handleDrawerToggle} />

          {/* Session Timeout Warning Modal */}
          <SessionTimeoutModal
            open={showWarning}
            timeRemaining={timeRemaining}
            onExtend={extendSession}
            onLogout={logout}
          />

          {/* Command Palette (Cmd+K) */}
          <CommandPalette open={commandPalette.open} onClose={commandPalette.close} />

          {/* Keyboard Shortcuts Help (Shift+?) */}
          <KeyboardShortcutsHelp />
        </Box>
      </KeyboardShortcutsProvider>
    </OnboardingProvider>
  );
}
