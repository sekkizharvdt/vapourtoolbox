'use client';

import { useState, useEffect } from 'react';
import { Autocomplete, TextField, Box, Typography, Chip } from '@mui/material';
import type { Shape } from '@vapour/types';
import { rectangularPlate, circularPlate, customPlate } from '@/data/shapes/plates';
import { straightTube } from '@/data/shapes/tubes';
import {
  cylindricalShell,
  conicalShell,
  hemisphericalHead,
} from '@/data/shapes/pressureVesselComponents';
import {
  ellipsoidalHead,
  torisphericialHead,
  flatHead,
  conicalHead,
} from '@/data/shapes/pressureVesselHeads';
import {
  hxTubeBundle,
  hxTubeSheet,
  hxBaffle,
  hxTubeSupport,
} from '@/data/shapes/heatExchangerComponents';
import {
  nozzleAssembly,
  reinforcementPad,
  customCircularNozzle,
  customRectangularNozzle,
  manwayAssembly,
} from '@/data/shapes/nozzleAssemblies';

// Map category IDs to their shapes (all are Omit<Shape, 'id'> so we'll need to add IDs)
const SHAPE_CATALOG: Record<string, Shape[]> = {
  plates: [
    { ...rectangularPlate, id: 'rectangular-plate' } as Shape,
    { ...circularPlate, id: 'circular-plate' } as Shape,
    { ...customPlate, id: 'custom-plate' } as Shape,
  ],
  tubes: [{ ...straightTube, id: 'straight-tube' } as Shape],
  'pressure-vessels': [
    { ...cylindricalShell, id: 'cylindrical-shell' } as Shape,
    { ...conicalShell, id: 'conical-shell' } as Shape,
    { ...hemisphericalHead, id: 'hemispherical-head' } as Shape,
    { ...ellipsoidalHead, id: 'ellipsoidal-head' } as Shape,
    { ...torisphericialHead, id: 'torispherical-head' } as Shape,
    { ...flatHead, id: 'flat-head' } as Shape,
    { ...conicalHead, id: 'conical-head' } as Shape,
  ],
  'heat-exchangers': [
    { ...hxTubeBundle, id: 'hx-tube-bundle' } as Shape,
    { ...hxTubeSheet, id: 'hx-tube-sheet' } as Shape,
    { ...hxBaffle, id: 'hx-baffle' } as Shape,
    { ...hxTubeSupport, id: 'hx-tube-support' } as Shape,
  ],
  nozzles: [
    { ...nozzleAssembly, id: 'nozzle-assembly' } as Shape,
    { ...reinforcementPad, id: 'reinforcement-pad' } as Shape,
    { ...customCircularNozzle, id: 'custom-circular-nozzle' } as Shape,
    { ...customRectangularNozzle, id: 'custom-rectangular-nozzle' } as Shape,
    { ...manwayAssembly, id: 'manway-assembly' } as Shape,
  ],
};

interface ShapeDropdownProps {
  category: string | null;
  value: Shape | null;
  onChange: (shape: Shape | null) => void;
  disabled?: boolean;
}

export default function ShapeDropdown({
  category,
  value,
  onChange,
  disabled = false,
}: ShapeDropdownProps) {
  const [shapes, setShapes] = useState<Shape[]>([]);

  // Update available shapes when category changes
  useEffect(() => {
    if (category) {
      const categoryShapes = SHAPE_CATALOG[category] || [];
      setShapes(categoryShapes);

      // Reset selection if current shape is not in new category
      if (value && !categoryShapes.find((s) => s.id === value.id)) {
        onChange(null);
      }
    } else {
      setShapes([]);
      onChange(null);
    }
  }, [category, value, onChange]);

  // Helper to format standard reference
  const getStandardRef = (shape: Shape): string | null => {
    if (!shape.standard) return null;
    return `${shape.standard.standardBody} ${shape.standard.standardNumber}`;
  };

  // Group shapes by subCategory if available
  const groupedShapes = shapes.reduce(
    (acc, shape) => {
      const group = shape.subCategory || 'Other';
      if (!acc[group]) acc[group] = [];
      acc[group].push(shape);
      return acc;
    },
    {} as Record<string, Shape[]>
  );

  const hasGroups = Object.keys(groupedShapes).length > 1;

  return (
    <Autocomplete
      value={value}
      onChange={(_, newValue) => onChange(newValue)}
      options={shapes}
      getOptionLabel={(option) => option.name}
      groupBy={hasGroups ? (option) => option.subCategory || 'Other' : undefined}
      disabled={disabled || !category}
      disableClearable={false}
      renderInput={(params) => (
        <TextField
          {...params}
          label="Shape"
          placeholder={category ? 'Select a shape...' : 'Select a category first'}
          helperText={
            value
              ? getStandardRef(value) || value.description
              : category
                ? `Choose from ${shapes.length} available shapes`
                : 'Please select a category first'
          }
        />
      )}
      renderOption={(props, option) => {
        const standardRef = getStandardRef(option);

        return (
          <Box
            component="li"
            {...props}
            sx={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-start', gap: 0.5 }}
          >
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, width: '100%' }}>
              <Typography variant="body1" fontWeight="medium" sx={{ flex: 1 }}>
                {option.name}
              </Typography>
              {standardRef && (
                <Chip label={standardRef} size="small" variant="outlined" color="primary" />
              )}
            </Box>
            {option.description && (
              <Typography variant="caption" color="text.secondary">
                {option.description}
              </Typography>
            )}
            {option.tags && option.tags.length > 0 && (
              <Box sx={{ display: 'flex', gap: 0.5, mt: 0.5 }}>
                {option.tags.slice(0, 3).map((tag) => (
                  <Chip key={tag} label={tag} size="small" sx={{ fontSize: '0.65rem' }} />
                ))}
              </Box>
            )}
          </Box>
        );
      }}
      filterOptions={(options, state) => {
        const searchTerm = state.inputValue.toLowerCase();
        if (!searchTerm) return options;

        return options.filter((option) => {
          // Search in name
          if (option.name.toLowerCase().includes(searchTerm)) return true;
          // Search in description
          if (option.description?.toLowerCase().includes(searchTerm)) return true;
          // Search in tags
          if (option.tags?.some((tag) => tag.toLowerCase().includes(searchTerm))) return true;
          // Search in standard
          if (
            option.standard &&
            `${option.standard.standardBody} ${option.standard.standardNumber}`
              .toLowerCase()
              .includes(searchTerm)
          ) {
            return true;
          }
          return false;
        });
      }}
    />
  );
}
