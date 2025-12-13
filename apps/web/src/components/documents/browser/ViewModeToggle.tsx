'use client';

/**
 * ViewModeToggle Component
 *
 * Toggle between entity-based and project-based folder views
 */

import { memo, useCallback } from 'react';
import { ToggleButton, ToggleButtonGroup, Tooltip, Box } from '@mui/material';
import { Business as EntityIcon, AccountTree as ProjectIcon } from '@mui/icons-material';
import type { DocumentBrowserViewMode } from '@vapour/types';

interface ViewModeToggleProps {
  value: DocumentBrowserViewMode;
  onChange: (mode: DocumentBrowserViewMode) => void;
  disabled?: boolean;
}

function ViewModeToggleComponent({ value, onChange, disabled = false }: ViewModeToggleProps) {
  const handleChange = useCallback(
    (_: React.MouseEvent<HTMLElement>, newValue: DocumentBrowserViewMode | null) => {
      if (newValue !== null) {
        onChange(newValue);
      }
    },
    [onChange]
  );

  return (
    <Box>
      <ToggleButtonGroup
        value={value}
        exclusive
        onChange={handleChange}
        size="small"
        disabled={disabled}
        aria-label="view mode"
      >
        <ToggleButton value="entity" aria-label="entity view">
          <Tooltip title="View by Entity Type">
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
              <EntityIcon fontSize="small" />
              <span>Entity</span>
            </Box>
          </Tooltip>
        </ToggleButton>
        <ToggleButton value="project" aria-label="project view">
          <Tooltip title="View by Project">
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
              <ProjectIcon fontSize="small" />
              <span>Project</span>
            </Box>
          </Tooltip>
        </ToggleButton>
      </ToggleButtonGroup>
    </Box>
  );
}

export const ViewModeToggle = memo(ViewModeToggleComponent);
