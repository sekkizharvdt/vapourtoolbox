'use client';

import {
  Card,
  CardContent,
  CardActions,
  Typography,
  Button,
  Box,
  Chip,
} from '@mui/material';
import {
  People as PeopleIcon,
  Business as BusinessIcon,
  Folder as FolderIcon,
  Settings as SettingsIcon,
  AccessTime as AccessTimeIcon,
  AccountBalance as AccountBalanceIcon,
  ShoppingCart as ShoppingCartIcon,
  Calculate as CalculateIcon,
  Science as ScienceIcon,
  Description as DescriptionIcon,
  ArrowForward as ArrowForwardIcon,
} from '@mui/icons-material';
import { useRouter } from 'next/navigation';
import type { ModuleDefinition } from '@vapour/constants';

// Map module IDs to icons and colors
const moduleConfig: Record<
  string,
  { icon: React.ReactNode; color: string }
> = {
  'user-management': { icon: <PeopleIcon />, color: '#0891B2' },
  'entity-management': { icon: <BusinessIcon />, color: '#0891B2' },
  'project-management': { icon: <FolderIcon />, color: '#0891B2' },
  'company-settings': { icon: <SettingsIcon />, color: '#0891B2' },
  'time-tracking': { icon: <AccessTimeIcon />, color: '#3B82F6' },
  'accounting': { icon: <AccountBalanceIcon />, color: '#10B981' },
  'procurement': { icon: <ShoppingCartIcon />, color: '#3B82F6' },
  'estimation': { icon: <CalculateIcon />, color: '#3B82F6' },
  'thermal-desal': { icon: <ScienceIcon />, color: '#6B7280' },
  'document-management': { icon: <DescriptionIcon />, color: '#6B7280' },
};

interface ModuleCardProps {
  module: ModuleDefinition;
}

export function ModuleCard({ module }: ModuleCardProps) {
  const router = useRouter();
  const config = moduleConfig[module.id] || { icon: <FolderIcon />, color: '#0891B2' };
  const isComingSoon = module.status === 'coming_soon';

  const handleClick = () => {
    if (!isComingSoon) {
      router.push(module.path);
    }
  };

  return (
    <Card
      sx={{
        height: '100%',
        display: 'flex',
        flexDirection: 'column',
        opacity: isComingSoon ? 0.6 : 1,
        transition: 'all 0.3s ease',
        '&:hover': {
          boxShadow: isComingSoon ? undefined : 6,
          transform: isComingSoon ? undefined : 'translateY(-4px)',
        },
      }}
    >
      <CardContent sx={{ flexGrow: 1, textAlign: 'center' }}>
        {isComingSoon && (
          <Chip
            label={`Coming Soon - ${module.estimatedRelease}`}
            size="small"
            sx={{ mb: 2 }}
          />
        )}

        <Box
          sx={{
            display: 'flex',
            justifyContent: 'center',
            mb: 2,
            '& svg': {
              fontSize: 48,
              color: config.color,
            },
          }}
        >
          {config.icon}
        </Box>

        <Typography variant="h5" component="h2" gutterBottom>
          {module.name}
        </Typography>

        {module.description && (
          <Typography variant="body2" color="text.secondary">
            {module.description}
          </Typography>
        )}
      </CardContent>

      {!isComingSoon && (
        <CardActions sx={{ justifyContent: 'center', pb: 2 }}>
          <Button
            size="small"
            endIcon={<ArrowForwardIcon />}
            onClick={handleClick}
          >
            Open Module
          </Button>
        </CardActions>
      )}
    </Card>
  );
}
