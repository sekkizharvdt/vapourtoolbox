'use client';

import {
  TextField,
  InputAdornment,
  FormControl,
  InputLabel,
  Select,
  MenuItem,
  Stack,
} from '@mui/material';
import type { HeatFluidType } from '@/lib/thermal';

interface SensibleHeatInputsProps {
  fluidType: HeatFluidType;
  salinity: string;
  massFlowRate: string;
  inletTemp: string;
  outletTemp: string;
  onFluidTypeChange: (value: HeatFluidType) => void;
  onSalinityChange: (value: string) => void;
  onMassFlowRateChange: (value: string) => void;
  onInletTempChange: (value: string) => void;
  onOutletTempChange: (value: string) => void;
}

export function SensibleHeatInputs({
  fluidType,
  salinity,
  massFlowRate,
  inletTemp,
  outletTemp,
  onFluidTypeChange,
  onSalinityChange,
  onMassFlowRateChange,
  onInletTempChange,
  onOutletTempChange,
}: SensibleHeatInputsProps) {
  return (
    <Stack spacing={2}>
      <FormControl fullWidth>
        <InputLabel>Fluid Type</InputLabel>
        <Select
          value={fluidType}
          label="Fluid Type"
          onChange={(e) => onFluidTypeChange(e.target.value as HeatFluidType)}
        >
          <MenuItem value="PURE_WATER">Pure Water</MenuItem>
          <MenuItem value="SEAWATER">Seawater</MenuItem>
        </Select>
      </FormControl>

      {fluidType === 'SEAWATER' && (
        <TextField
          label="Salinity"
          value={salinity}
          onChange={(e) => onSalinityChange(e.target.value)}
          type="number"
          fullWidth
          InputProps={{
            endAdornment: <InputAdornment position="end">ppm</InputAdornment>,
          }}
        />
      )}

      <TextField
        label="Mass Flow Rate"
        value={massFlowRate}
        onChange={(e) => onMassFlowRateChange(e.target.value)}
        type="number"
        fullWidth
        InputProps={{
          endAdornment: <InputAdornment position="end">ton/hr</InputAdornment>,
        }}
      />

      <TextField
        label="Inlet Temperature"
        value={inletTemp}
        onChange={(e) => onInletTempChange(e.target.value)}
        type="number"
        fullWidth
        InputProps={{
          endAdornment: <InputAdornment position="end">°C</InputAdornment>,
        }}
      />

      <TextField
        label="Outlet Temperature"
        value={outletTemp}
        onChange={(e) => onOutletTempChange(e.target.value)}
        type="number"
        fullWidth
        InputProps={{
          endAdornment: <InputAdornment position="end">°C</InputAdornment>,
        }}
      />
    </Stack>
  );
}
