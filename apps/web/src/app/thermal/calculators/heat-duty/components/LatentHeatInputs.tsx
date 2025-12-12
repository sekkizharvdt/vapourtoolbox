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

interface LatentHeatInputsProps {
  process: 'EVAPORATION' | 'CONDENSATION';
  latentFlowRate: string;
  saturationTemp: string;
  onProcessChange: (value: 'EVAPORATION' | 'CONDENSATION') => void;
  onLatentFlowRateChange: (value: string) => void;
  onSaturationTempChange: (value: string) => void;
}

export function LatentHeatInputs({
  process,
  latentFlowRate,
  saturationTemp,
  onProcessChange,
  onLatentFlowRateChange,
  onSaturationTempChange,
}: LatentHeatInputsProps) {
  return (
    <Stack spacing={2}>
      <FormControl fullWidth>
        <InputLabel>Process</InputLabel>
        <Select
          value={process}
          label="Process"
          onChange={(e) => onProcessChange(e.target.value as 'EVAPORATION' | 'CONDENSATION')}
        >
          <MenuItem value="EVAPORATION">Evaporation</MenuItem>
          <MenuItem value="CONDENSATION">Condensation</MenuItem>
        </Select>
      </FormControl>

      <TextField
        label={process === 'EVAPORATION' ? 'Vapor Production Rate' : 'Condensate Rate'}
        value={latentFlowRate}
        onChange={(e) => onLatentFlowRateChange(e.target.value)}
        type="number"
        fullWidth
        InputProps={{
          endAdornment: <InputAdornment position="end">ton/hr</InputAdornment>,
        }}
      />

      <TextField
        label="Saturation Temperature"
        value={saturationTemp}
        onChange={(e) => onSaturationTempChange(e.target.value)}
        type="number"
        fullWidth
        InputProps={{
          endAdornment: <InputAdornment position="end">°C</InputAdornment>,
        }}
        helperText="Temperature at which evaporation/condensation occurs"
      />
    </Stack>
  );
}
