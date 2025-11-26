'use client';

import { Autocomplete, TextField, Box, Typography, Chip } from '@mui/material';
import {
  Category as PlatesIcon,
  Circle as TubesIcon,
  Storage as VesselsIcon,
  Thermostat as HeatExIcon,
  Settings as NozzlesIcon,
} from '@mui/icons-material';

interface CategoryOption {
  id: string;
  label: string;
  description: string;
  icon: React.ReactNode;
  count: number;
}

const CATEGORIES: CategoryOption[] = [
  {
    id: 'plates',
    label: 'Plates & Sheets',
    description: 'Rectangular, circular, and custom plates',
    icon: <PlatesIcon />,
    count: 3,
  },
  {
    id: 'tubes',
    label: 'Tubes',
    description: 'Custom fabricated tubes',
    icon: <TubesIcon />,
    count: 1,
  },
  {
    id: 'pressure-vessels',
    label: 'Pressure Vessels',
    description: 'Shells and heads per ASME',
    icon: <VesselsIcon />,
    count: 7,
  },
  {
    id: 'heat-exchangers',
    label: 'Heat Exchangers',
    description: 'Tube bundles, baffles, tube sheets',
    icon: <HeatExIcon />,
    count: 4,
  },
  {
    id: 'nozzles',
    label: 'Nozzles & Connections',
    description: 'Nozzle assemblies with auto-reinforcement',
    icon: <NozzlesIcon />,
    count: 5,
  },
];

interface ShapeCategoryDropdownProps {
  value: string | null;
  onChange: (category: string | null) => void;
  disabled?: boolean;
}

export default function ShapeCategoryDropdown({
  value,
  onChange,
  disabled = false,
}: ShapeCategoryDropdownProps) {
  const selectedCategory = CATEGORIES.find((cat) => cat.id === value) || null;

  return (
    <Autocomplete
      value={selectedCategory}
      onChange={(_, newValue) => onChange(newValue?.id || null)}
      options={CATEGORIES}
      getOptionLabel={(option) => option.label}
      disabled={disabled}
      disableClearable={false}
      renderInput={(params) => (
        <TextField
          {...params}
          label="Shape Category"
          placeholder="Select a category..."
          helperText={selectedCategory?.description || 'Choose the type of shape to calculate'}
        />
      )}
      renderOption={(props, option) => (
        <Box component="li" {...props} sx={{ display: 'flex', gap: 2, alignItems: 'flex-start' }}>
          <Box sx={{ mt: 0.5, color: 'primary.main' }}>{option.icon}</Box>
          <Box sx={{ flex: 1 }}>
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
              <Typography variant="body1" fontWeight="medium">
                {option.label}
              </Typography>
              <Chip label={option.count} size="small" color="primary" />
            </Box>
            <Typography variant="caption" color="text.secondary">
              {option.description}
            </Typography>
          </Box>
        </Box>
      )}
    />
  );
}
