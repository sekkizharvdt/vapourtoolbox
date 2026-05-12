'use client';

import {
  TextField,
  InputAdornment,
  Stack,
  Typography,
  Divider,
  MenuItem,
  ToggleButton,
  ToggleButtonGroup,
  Box,
} from '@mui/material';
import {
  MATERIAL_THERMAL_PROPERTIES,
  MATERIAL_THERMAL_KEYS,
  getMaterialThermalProperties,
} from '@vapour/constants';
import type { ConstraintMode } from '@/lib/thermal';

interface Props {
  materialKey: string;
  length: string;
  installationTemperature: string;
  operatingTemperature: string;
  constraintMode: ConstraintMode;
  onMaterialChange: (key: string) => void;
  onLengthChange: (value: string) => void;
  onInstallationTemperatureChange: (value: string) => void;
  onOperatingTemperatureChange: (value: string) => void;
  onConstraintModeChange: (mode: ConstraintMode) => void;
}

export function ThermalExpansionInputs({
  materialKey,
  length,
  installationTemperature,
  operatingTemperature,
  constraintMode,
  onMaterialChange,
  onLengthChange,
  onInstallationTemperatureChange,
  onOperatingTemperatureChange,
  onConstraintModeChange,
}: Props) {
  const material = MATERIAL_THERMAL_PROPERTIES[materialKey]
    ? getMaterialThermalProperties(materialKey)
    : null;

  const rangeText = material
    ? `Valid range: ${material.validRange.min}–${material.validRange.max} °C`
    : '';

  return (
    <Stack spacing={2}>
      <Typography variant="subtitle2" color="text.secondary">
        Material
      </Typography>

      <TextField
        select
        label="Material"
        value={materialKey}
        onChange={(e) => onMaterialChange(e.target.value)}
        fullWidth
        helperText={material?.description ?? ''}
      >
        {MATERIAL_THERMAL_KEYS.map((key) => {
          const m = MATERIAL_THERMAL_PROPERTIES[key];
          if (!m) return null;
          return (
            <MenuItem key={key} value={key}>
              {m.label}
            </MenuItem>
          );
        })}
      </TextField>

      <Divider />

      <Typography variant="subtitle2" color="text.secondary">
        Geometry
      </Typography>

      <TextField
        label="Initial Length"
        value={length}
        onChange={(e) => onLengthChange(e.target.value)}
        type="number"
        fullWidth
        InputProps={{
          endAdornment: <InputAdornment position="end">mm</InputAdornment>,
        }}
        helperText="Length at installation temperature"
      />

      <Divider />

      <Typography variant="subtitle2" color="text.secondary">
        Temperatures
      </Typography>

      <TextField
        label="Installation Temperature"
        value={installationTemperature}
        onChange={(e) => onInstallationTemperatureChange(e.target.value)}
        type="number"
        fullWidth
        InputProps={{
          endAdornment: <InputAdornment position="end">°C</InputAdornment>,
        }}
        helperText="Ambient / erection temperature (typically 20 °C)"
      />

      <TextField
        label="Operating Temperature"
        value={operatingTemperature}
        onChange={(e) => onOperatingTemperatureChange(e.target.value)}
        type="number"
        fullWidth
        InputProps={{
          endAdornment: <InputAdornment position="end">°C</InputAdornment>,
        }}
        helperText={rangeText}
      />

      <Divider />

      <Typography variant="subtitle2" color="text.secondary">
        Constraint
      </Typography>

      <Box>
        <ToggleButtonGroup
          value={constraintMode}
          exclusive
          onChange={(_, v) => v && onConstraintModeChange(v as ConstraintMode)}
          size="small"
          fullWidth
        >
          <ToggleButton value="free">Free Expansion</ToggleButton>
          <ToggleButton value="restrained">Fully Restrained</ToggleButton>
        </ToggleButtonGroup>
        <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mt: 0.5 }}>
          {constraintMode === 'free'
            ? 'Component free to grow — reports ΔL and the stress that would arise if it were restrained.'
            : 'Component fully axially restrained — reports thermal stress vs yield strength.'}
        </Typography>
      </Box>
    </Stack>
  );
}
