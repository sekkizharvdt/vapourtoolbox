'use client';

import { Box, Container, Typography } from '@mui/material';
import { useAuth } from '@/contexts/AuthContext';
import { MODULES } from '@vapour/constants';
import { ModuleCard } from '@/components/dashboard/ModuleCard';

export default function DashboardPage() {
  const { user, claims } = useAuth();
  const userPermissions = claims?.permissions || 0;

  // Filter modules based on user permissions, status, and category
  // ONLY show application modules on dashboard (core modules are in sidebar only)
  const accessibleModules = Object.values(MODULES).filter((module) => {
    // Only show application modules (not core modules)
    if (module.category !== 'application') return false;

    // If no permission required, accessible by all
    if (module.requiredPermissions === undefined) return true;

    // Check if user has required permissions using bitwise AND
    return (userPermissions & module.requiredPermissions) === module.requiredPermissions;
  });

  // Separate modules by status and sort by priority
  const activeModules = accessibleModules
    .filter((m) => m.status === 'active')
    .sort((a, b) => (a.priority || 999) - (b.priority || 999));

  const comingSoonModules = accessibleModules
    .filter((m) => m.status === 'coming_soon')
    .sort((a, b) => (a.priority || 999) - (b.priority || 999));

  return (
    <Container maxWidth="xl">
      <Box sx={{ mb: 4 }}>
        <Typography variant="h4" component="h1" gutterBottom>
          Welcome back, {user?.displayName || 'User'}
        </Typography>
        <Typography variant="body1" color="text.secondary">
          Select a module to get started
        </Typography>
      </Box>

      {/* Active Modules */}
      {activeModules.length > 0 && (
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
              <ModuleCard key={module.id} module={module} />
            ))}
          </Box>
        </Box>
      )}

      {/* Coming Soon Modules */}
      {comingSoonModules.length > 0 && (
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
      {accessibleModules.length === 0 && (
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
