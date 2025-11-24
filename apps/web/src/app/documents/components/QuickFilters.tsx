'use client';

/**
 * Quick Filters Component
 *
 * Provides one-click filter buttons for common document views:
 * - My Documents
 * - Overdue
 * - Pending Review
 * - Client Visible
 */

import { Stack, Chip } from '@mui/material';
import {
  Person as PersonIcon,
  Warning as WarningIcon,
  RateReview as ReviewIcon,
  Visibility as VisibilityIcon,
} from '@mui/icons-material';

interface QuickFiltersProps {
  activeFilter: string | null;
  onFilterChange: (filter: string | null) => void;
  currentUserId?: string;
}

export function QuickFilters({ activeFilter, onFilterChange, currentUserId }: QuickFiltersProps) {
  const filters = [
    {
      id: 'my-docs',
      label: 'My Documents',
      icon: PersonIcon,
      disabled: !currentUserId,
    },
    {
      id: 'overdue',
      label: 'Overdue',
      icon: WarningIcon,
    },
    {
      id: 'pending-review',
      label: 'Pending Review',
      icon: ReviewIcon,
    },
    {
      id: 'client-visible',
      label: 'Client Visible',
      icon: VisibilityIcon,
    },
  ];

  return (
    <Stack direction="row" spacing={1} sx={{ mb: 2, flexWrap: 'wrap', gap: 1 }}>
      {filters.map((filter) => {
        const Icon = filter.icon;
        const isActive = activeFilter === filter.id;

        return (
          <Chip
            key={filter.id}
            icon={<Icon />}
            label={filter.label}
            onClick={() => onFilterChange(isActive ? null : filter.id)}
            color={isActive ? 'primary' : 'default'}
            variant={isActive ? 'filled' : 'outlined'}
            disabled={filter.disabled}
            sx={{
              fontWeight: isActive ? 600 : 400,
              cursor: 'pointer',
              '&:hover': {
                bgcolor: isActive ? undefined : 'action.hover',
              },
            }}
          />
        );
      })}
    </Stack>
  );
}
