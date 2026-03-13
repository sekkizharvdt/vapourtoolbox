'use client';

import {
  TextField,
  InputAdornment,
  Stack,
  Typography,
  Divider,
  FormControl,
  InputLabel,
  Select,
  MenuItem,
} from '@mui/material';
import {
  STRAINER_TYPE_LABELS,
  FLUID_TYPE_LABELS,
  getAvailableLineSizes,
  type StrainerType,
  type FluidType as StrainerFluidType,
} from '@/lib/thermal/strainerSizingCalculator';

interface StrainerSizingInputsProps {
  fluidType: StrainerFluidType;
  flowRate: string;
  lineSize: string;
  strainerType: StrainerType;
  fluidDensity: string;
  fluidViscosity: string;
  fluidTemperature: string;
  onFluidTypeChange: (value: StrainerFluidType) => void;
  onFlowRateChange: (value: string) => void;
  onLineSizeChange: (value: string) => void;
  onStrainerTypeChange: (value: StrainerType) => void;
  onFluidDensityChange: (value: string) => void;
  onFluidViscosityChange: (value: string) => void;
  onFluidTemperatureChange: (value: string) => void;
}

const LINE_SIZES = getAvailableLineSizes();

export function StrainerSizingInputs({
  fluidType,
  flowRate,
  lineSize,
  strainerType,
  fluidDensity,
  fluidViscosity,
  fluidTemperature,
  onFluidTypeChange,
  onFlowRateChange,
  onLineSizeChange,
  onStrainerTypeChange,
  onFluidDensityChange,
  onFluidViscosityChange,
  onFluidTemperatureChange,
}: StrainerSizingInputsProps) {
  return (
    <Stack spacing={2}>
      <Typography variant="subtitle2" color="text.secondary">
        Fluid Properties
      </Typography>

      <FormControl fullWidth>
        <InputLabel>Fluid Type</InputLabel>
        <Select
          value={fluidType}
          label="Fluid Type"
          onChange={(e) => onFluidTypeChange(e.target.value as StrainerFluidType)}
        >
          {(Object.entries(FLUID_TYPE_LABELS) as [StrainerFluidType, string][]).map(
            ([key, label]) => (
              <MenuItem key={key} value={key}>
                {label}
              </MenuItem>
            )
          )}
        </Select>
      </FormControl>

      <TextField
        label="Fluid Density"
        value={fluidDensity}
        onChange={(e) => onFluidDensityChange(e.target.value)}
        type="number"
        fullWidth
        InputProps={{
          endAdornment: <InputAdornment position="end">kg/m&sup3;</InputAdornment>,
        }}
      />

      <TextField
        label="Dynamic Viscosity"
        value={fluidViscosity}
        onChange={(e) => onFluidViscosityChange(e.target.value)}
        type="number"
        fullWidth
        InputProps={{
          endAdornment: <InputAdornment position="end">cP</InputAdornment>,
        }}
      />

      <TextField
        label="Fluid Temperature"
        value={fluidTemperature}
        onChange={(e) => onFluidTemperatureChange(e.target.value)}
        type="number"
        fullWidth
        helperText="Informational — used in report"
        InputProps={{
          endAdornment: <InputAdornment position="end">&deg;C</InputAdornment>,
        }}
      />

      <Divider />

      <Typography variant="subtitle2" color="text.secondary">
        Flow &amp; Line Size
      </Typography>

      <TextField
        label="Volumetric Flow Rate"
        value={flowRate}
        onChange={(e) => onFlowRateChange(e.target.value)}
        type="number"
        fullWidth
        InputProps={{
          endAdornment: <InputAdornment position="end">m&sup3;/hr</InputAdornment>,
        }}
      />

      <FormControl fullWidth>
        <InputLabel>Line Size (NPS)</InputLabel>
        <Select
          value={lineSize}
          label="Line Size (NPS)"
          onChange={(e) => onLineSizeChange(e.target.value)}
        >
          {LINE_SIZES.map((nps) => (
            <MenuItem key={nps} value={nps}>
              {nps}&quot;
            </MenuItem>
          ))}
        </Select>
      </FormControl>

      <Divider />

      <Typography variant="subtitle2" color="text.secondary">
        Strainer Configuration
      </Typography>

      <FormControl fullWidth>
        <InputLabel>Strainer Type</InputLabel>
        <Select
          value={strainerType}
          label="Strainer Type"
          onChange={(e) => onStrainerTypeChange(e.target.value as StrainerType)}
        >
          {(Object.entries(STRAINER_TYPE_LABELS) as [StrainerType, string][]).map(
            ([key, label]) => (
              <MenuItem key={key} value={key}>
                {label}
              </MenuItem>
            )
          )}
        </Select>
      </FormControl>
    </Stack>
  );
}
