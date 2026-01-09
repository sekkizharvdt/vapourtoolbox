'use client';

import { useMemo } from 'react';
import { Box, Container, Typography, CircularProgress, Alert } from '@mui/material';
import { useAuth } from '@/contexts/AuthContext';
import { MODULES } from '@vapour/constants';
import { ModuleCard } from '@/components/dashboard/ModuleCard';
import { ActivityDashboard } from '@/components/dashboard/ActivityDashboard';
import { useAllModuleStats, getStatsForModule } from '@/lib/hooks/useModuleStats';

export default function DashboardPage() {
  const { user, claims } = useAuth();
  const userPermissions = claims?.permissions || 0;
  const userPermissions2 = claims?.permissions2 || 0;

  // Filter modules based on user permissions, status, and category
  // ONLY show application modules on dashboard (core modules are in sidebar only)
  // Use useMemo to prevent infinite loop by memoizing the array
  const accessibleModules = useMemo(() => {
    return Object.values(MODULES).filter((module) => {
      // Only show application modules (not core modules)
      if (module.category !== 'application') return false;

      // Check requiredPermissions (from permissions field)
      if (module.requiredPermissions !== undefined) {
        if ((userPermissions & module.requiredPermissions) !== module.requiredPermissions) {
          return false;
        }
      }

      // Check requiredPermissions2 (from permissions2 field)
      if (module.requiredPermissions2 !== undefined) {
        if ((userPermissions2 & module.requiredPermissions2) !== module.requiredPermissions2) {
          return false;
        }
      }

      return true;
    });
  }, [userPermissions, userPermissions2]);

  // Separate modules by status and sort by priority
  // Use useMemo to prevent unnecessary recalculations
  const activeModules = useMemo(() => {
    return accessibleModules
      .filter((m) => m.status === 'active')
      .sort((a, b) => (a.priority || 999) - (b.priority || 999));
  }, [accessibleModules]);

  const comingSoonModules = useMemo(() => {
    return accessibleModules
      .filter((m) => m.status === 'coming_soon')
      .sort((a, b) => (a.priority || 999) - (b.priority || 999));
  }, [accessibleModules]);

  // Fetch module stats using React Query (with automatic caching)
  const accessibleModuleIds = useMemo(
    () => accessibleModules.map((m) => m.id),
    [accessibleModules]
  );
  const {
    data: moduleStats,
    isLoading: isLoadingStats,
    error: statsError,
  } = useAllModuleStats(accessibleModuleIds);

  return (
    <Container maxWidth="xl">
      <Box sx={{ mb: 4 }}>
        <Typography variant="h4" component="h1" gutterBottom>
          Welcome back, {user?.displayName || 'User'}
        </Typography>
        <Typography variant="body1" color="text.secondary" sx={{ mb: 0.5 }}>
          Here&apos;s what needs your attention today
        </Typography>
        <Typography variant="caption" color="text.secondary">
          Press{' '}
          <kbd
            style={{
              fontFamily: 'monospace',
              padding: '2px 6px',
              background: 'rgba(0,0,0,0.1)',
              borderRadius: '4px',
            }}
          >
            ⌘K
          </kbd>{' '}
          to search and navigate quickly
        </Typography>
      </Box>

      {/* Activity Dashboard */}
      <ActivityDashboard />

      {/* Stats Error Alert */}
      {statsError && (
        <Alert severity="warning" sx={{ mb: 3 }}>
          Failed to load module statistics - Module cards will show without statistics
        </Alert>
      )}

      {/* Loading Stats */}
      {isLoadingStats && (
        <Box sx={{ display: 'flex', justifyContent: 'center', py: 4, mb: 4 }}>
          <CircularProgress size={32} />
          <Typography variant="body2" color="text.secondary" sx={{ ml: 2 }}>
            Loading module statistics...
          </Typography>
        </Box>
      )}

      {/* Active Modules */}
      {!isLoadingStats && activeModules.length > 0 && (
        <Box sx={{ mb: 4 }}>
          <Typography variant="h6" component="h2" gutterBottom sx={{ mb: 2 }}>
            Available Modules
          </Typography>
          <Box
            sx={{
              display: 'grid',
              gridTemplateColumns: {
                xs: '1fr',
                md: 'repeat(2, 1fr)',
                lg: 'repeat(3, 1fr)',
                xl: 'repeat(4, 1fr)',
              },
              gap: 3,
            }}
          >
            {activeModules.map((module) => (
              <ModuleCard
                key={module.id}
                module={module}
                stats={getStatsForModule(moduleStats, module.id)}
              />
            ))}
          </Box>
        </Box>
      )}

      {/* Coming Soon Modules */}
      {!isLoadingStats && comingSoonModules.length > 0 && (
        <Box>
          <Typography variant="h6" component="h2" gutterBottom sx={{ mb: 2 }}>
            Coming Soon
          </Typography>
          <Box
            sx={{
              display: 'grid',
              gridTemplateColumns: {
                xs: '1fr',
                md: 'repeat(2, 1fr)',
                lg: 'repeat(3, 1fr)',
                xl: 'repeat(4, 1fr)',
              },
              gap: 3,
            }}
          >
            {comingSoonModules.map((module) => (
              <ModuleCard key={module.id} module={module} />
            ))}
          </Box>
        </Box>
      )}

      {/* No modules available */}
      {!isLoadingStats && accessibleModules.length === 0 && (
        <Box
          sx={{
            textAlign: 'center',
            py: 8,
          }}
        >
          <Typography variant="h6" color="text.secondary">
            No modules available
          </Typography>
          <Typography variant="body2" color="text.secondary" sx={{ mt: 1 }}>
            Please contact your administrator for access
          </Typography>
        </Box>
      )}
    </Container>
  );
}
