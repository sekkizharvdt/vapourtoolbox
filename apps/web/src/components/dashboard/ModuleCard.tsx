'use client';

/**
 * Module Card Component
 *
 * Displays a module with icon, stats, and navigation
 * Memoized for performance in dashboard grid
 */

import { useState, useCallback, memo } from 'react';
import {
  Card,
  CardContent,
  CardActions,
  Typography,
  Button,
  Box,
  Chip,
  Badge,
  Stack,
} from '@mui/material';
import {
  People as PeopleIcon,
  Business as BusinessIcon,
  Assignment as AssignmentIcon,
  BusinessCenter as BusinessCenterIcon,
  Schedule as ScheduleIcon,
  AccountBalance as AccountBalanceIcon,
  ShoppingCart as ShoppingCartIcon,
  Calculate as CalculateIcon,
  Thermostat as ThermostatIcon,
  Description as DescriptionIcon,
  ArrowForward as ArrowForwardIcon,
  Inventory as InventoryIcon,
  LocalShipping as LocalShippingIcon,
} from '@mui/icons-material';
import { useRouter } from 'next/navigation';
import type { ModuleDefinition } from '@vapour/constants';
import type { ModuleStats } from '@/lib/dashboard/moduleStatsService';

// Map module IDs to icons - Using exact colors from MODULES definition
const moduleConfig: Record<string, { icon: React.ReactNode; color: string }> = {
  'user-management': { icon: <PeopleIcon />, color: '#3B82F6' }, // Blue
  'entity-management': { icon: <BusinessIcon />, color: '#10B981' }, // Green
  'project-management': { icon: <AssignmentIcon />, color: '#8B5CF6' }, // Purple
  'company-settings': { icon: <BusinessCenterIcon />, color: '#6B7280' }, // Gray
  'time-tracking': { icon: <ScheduleIcon />, color: '#0891B2' }, // Vapour Cyan
  'document-management': { icon: <DescriptionIcon />, color: '#7C3AED' }, // Purple
  procurement: { icon: <ShoppingCartIcon />, color: '#EC4899' }, // Pink
  accounting: { icon: <AccountBalanceIcon />, color: '#F59E0B' }, // Amber
  estimation: { icon: <CalculateIcon />, color: '#6366F1' }, // Indigo
  'material-database': { icon: <InventoryIcon />, color: '#059669' }, // Emerald
  'bought-out-database': { icon: <LocalShippingIcon />, color: '#0D9488' }, // Teal
  'thermal-desal': { icon: <ThermostatIcon />, color: '#EF4444' }, // Red
  'proposal-management': { icon: <AssignmentIcon />, color: '#10B981' }, // Green
};

interface ModuleCardProps {
  module: ModuleDefinition;
  stats?: ModuleStats;
}

function ModuleCardComponent({ module, stats }: ModuleCardProps) {
  const router = useRouter();
  const [isHovered, setIsHovered] = useState(false);
  const config = moduleConfig[module.id] || { icon: <AssignmentIcon />, color: '#0891B2' };
  const isComingSoon = module.status === 'coming_soon';

  const handleClick = useCallback(() => {
    if (!isComingSoon) {
      router.push(module.path);
    }
  }, [isComingSoon, router, module.path]);

  const handleMouseEnter = useCallback(() => setIsHovered(true), []);
  const handleMouseLeave = useCallback(() => setIsHovered(false), []);

  // Determine badge count (prioritize pendingCount, then recentCount, then totalCount)
  const badgeCount = stats?.pendingCount ?? stats?.recentCount ?? stats?.totalCount;
  const showBadge = badgeCount !== undefined && badgeCount > 0;

  return (
    <Card
      onMouseEnter={handleMouseEnter}
      onMouseLeave={handleMouseLeave}
      sx={{
        height: '100%',
        display: 'flex',
        flexDirection: 'column',
        position: 'relative',
        opacity: isComingSoon ? 0.6 : 1,
        transition: 'all 0.3s ease',
        cursor: isComingSoon ? 'default' : 'pointer',
        '&:hover': {
          boxShadow: isComingSoon ? undefined : 6,
          transform: isComingSoon ? undefined : 'translateY(-4px)',
        },
      }}
      onClick={!isComingSoon ? handleClick : undefined}
    >
      <CardContent sx={{ flexGrow: 1, textAlign: 'center', position: 'relative' }}>
        {/* Coming Soon Badge */}
        {isComingSoon && (
          <Chip
            label={module.estimatedRelease}
            size="small"
            sx={{
              mb: 2,
              fontWeight: 600,
              backgroundColor: 'rgba(99, 102, 241, 0.1)',
              color: 'primary.main',
            }}
          />
        )}

        {/* Module Icon with Badge */}
        <Box
          sx={{
            display: 'flex',
            justifyContent: 'center',
            mb: 2,
            position: 'relative',
          }}
        >
          <Badge
            badgeContent={showBadge ? badgeCount : undefined}
            color="error"
            max={99}
            sx={{
              '& .MuiBadge-badge': {
                fontSize: '0.75rem',
                fontWeight: 600,
                minWidth: '20px',
                height: '20px',
              },
            }}
          >
            <Box
              sx={{
                '& svg': {
                  fontSize: 48,
                  color: config.color,
                },
              }}
            >
              {config.icon}
            </Box>
          </Badge>
        </Box>

        {/* Module Name */}
        <Typography variant="h6" component="h2" gutterBottom fontWeight={600}>
          {module.name}
        </Typography>

        {/* Module Description */}
        {module.description && (
          <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
            {module.description}
          </Typography>
        )}

        {/* Stats Label */}
        {!isComingSoon && stats?.label && (
          <Typography variant="caption" color="text.secondary">
            {stats.label}: {badgeCount || 0}
          </Typography>
        )}
      </CardContent>

      {/* Quick Actions (visible on hover) */}
      {!isComingSoon && isHovered && (
        <CardActions sx={{ justifyContent: 'center', pb: 2 }}>
          <Stack direction="row" spacing={1}>
            <Button
              size="small"
              variant="contained"
              endIcon={<ArrowForwardIcon />}
              sx={{
                backgroundColor: config.color,
                '&:hover': {
                  backgroundColor: config.color,
                  filter: 'brightness(0.9)',
                },
              }}
            >
              Open
            </Button>
          </Stack>
        </CardActions>
      )}

      {/* Default Action (not hovered) */}
      {!isComingSoon && !isHovered && (
        <CardActions sx={{ justifyContent: 'center', pb: 2 }}>
          <Button size="small" endIcon={<ArrowForwardIcon />}>
            View Details
          </Button>
        </CardActions>
      )}
    </Card>
  );
}

// Memoize the component to prevent unnecessary re-renders
export const ModuleCard = memo(ModuleCardComponent);
