'use client';

import { TextField, InputAdornment, Stack, Typography, Divider } from '@mui/material';

interface MVCInputsProps {
  suctionPressure: string;
  suctionTemperature: string;
  dischargePressure: string;
  flowRate: string;
  isentropicEfficiency: string;
  mechanicalEfficiency: string;
  onSuctionPressureChange: (value: string) => void;
  onSuctionTemperatureChange: (value: string) => void;
  onDischargePressureChange: (value: string) => void;
  onFlowRateChange: (value: string) => void;
  onIsentropicEfficiencyChange: (value: string) => void;
  onMechanicalEfficiencyChange: (value: string) => void;
}

export function MVCInputs({
  suctionPressure,
  suctionTemperature,
  dischargePressure,
  flowRate,
  isentropicEfficiency,
  mechanicalEfficiency,
  onSuctionPressureChange,
  onSuctionTemperatureChange,
  onDischargePressureChange,
  onFlowRateChange,
  onIsentropicEfficiencyChange,
  onMechanicalEfficiencyChange,
}: MVCInputsProps) {
  return (
    <Stack spacing={2}>
      <Typography variant="subtitle2" color="text.secondary">
        Suction Conditions
      </Typography>

      <TextField
        label="Suction Pressure"
        value={suctionPressure}
        onChange={(e) => onSuctionPressureChange(e.target.value)}
        type="number"
        fullWidth
        InputProps={{
          endAdornment: <InputAdornment position="end">bar abs</InputAdornment>,
        }}
      />

      <TextField
        label="Suction Temperature"
        value={suctionTemperature}
        onChange={(e) => onSuctionTemperatureChange(e.target.value)}
        type="number"
        fullWidth
        InputProps={{
          endAdornment: <InputAdornment position="end">°C</InputAdornment>,
        }}
        helperText="Leave empty for saturated vapor"
      />

      <Divider />

      <Typography variant="subtitle2" color="text.secondary">
        Discharge
      </Typography>

      <TextField
        label="Discharge Pressure"
        value={dischargePressure}
        onChange={(e) => onDischargePressureChange(e.target.value)}
        type="number"
        fullWidth
        InputProps={{
          endAdornment: <InputAdornment position="end">bar abs</InputAdornment>,
        }}
      />

      <Divider />

      <Typography variant="subtitle2" color="text.secondary">
        Flow
      </Typography>

      <TextField
        label="Vapor Flow Rate"
        value={flowRate}
        onChange={(e) => onFlowRateChange(e.target.value)}
        type="number"
        fullWidth
        InputProps={{
          endAdornment: <InputAdornment position="end">ton/hr</InputAdornment>,
        }}
      />

      <Divider />

      <Typography variant="subtitle2" color="text.secondary">
        Efficiency
      </Typography>

      <TextField
        label="Isentropic Efficiency"
        value={isentropicEfficiency}
        onChange={(e) => onIsentropicEfficiencyChange(e.target.value)}
        type="number"
        fullWidth
        InputProps={{
          endAdornment: <InputAdornment position="end">%</InputAdornment>,
        }}
      />

      <TextField
        label="Mechanical Efficiency"
        value={mechanicalEfficiency}
        onChange={(e) => onMechanicalEfficiencyChange(e.target.value)}
        type="number"
        fullWidth
        InputProps={{
          endAdornment: <InputAdornment position="end">%</InputAdornment>,
        }}
      />
    </Stack>
  );
}
