'use client';

import { TextField, InputAdornment, Stack, Typography, Divider } from '@mui/material';

interface DesuperheatingInputsProps {
  steamPressure: string;
  steamTemperature: string;
  targetTemperature: string;
  sprayWaterTemperature: string;
  steamFlow: string;
  saturationTemperature: number | null;
  onSteamPressureChange: (value: string) => void;
  onSteamTemperatureChange: (value: string) => void;
  onTargetTemperatureChange: (value: string) => void;
  onSprayWaterTemperatureChange: (value: string) => void;
  onSteamFlowChange: (value: string) => void;
}

export function DesuperheatingInputs({
  steamPressure,
  steamTemperature,
  targetTemperature,
  sprayWaterTemperature,
  steamFlow,
  saturationTemperature,
  onSteamPressureChange,
  onSteamTemperatureChange,
  onTargetTemperatureChange,
  onSprayWaterTemperatureChange,
  onSteamFlowChange,
}: DesuperheatingInputsProps) {
  const tSatText =
    saturationTemperature !== null ? `Tsat = ${saturationTemperature.toFixed(1)}°C` : '';

  return (
    <Stack spacing={2}>
      <Typography variant="subtitle2" color="text.secondary">
        Steam Conditions
      </Typography>

      <TextField
        label="Steam Pressure"
        value={steamPressure}
        onChange={(e) => onSteamPressureChange(e.target.value)}
        type="number"
        fullWidth
        InputProps={{
          endAdornment: <InputAdornment position="end">bar abs</InputAdornment>,
        }}
        helperText={tSatText}
      />

      <TextField
        label="Inlet Steam Temperature"
        value={steamTemperature}
        onChange={(e) => onSteamTemperatureChange(e.target.value)}
        type="number"
        fullWidth
        InputProps={{
          endAdornment: <InputAdornment position="end">°C</InputAdornment>,
        }}
        helperText="Must be above saturation temperature"
      />

      <Divider />

      <Typography variant="subtitle2" color="text.secondary">
        Target
      </Typography>

      <TextField
        label="Target Outlet Temperature"
        value={targetTemperature}
        onChange={(e) => onTargetTemperatureChange(e.target.value)}
        type="number"
        fullWidth
        InputProps={{
          endAdornment: <InputAdornment position="end">°C</InputAdornment>,
        }}
        helperText={tSatText ? `Must be ≥ ${tSatText}` : 'Must be ≥ saturation temperature'}
      />

      <Divider />

      <Typography variant="subtitle2" color="text.secondary">
        Spray Water
      </Typography>

      <TextField
        label="Spray Water Temperature"
        value={sprayWaterTemperature}
        onChange={(e) => onSprayWaterTemperatureChange(e.target.value)}
        type="number"
        fullWidth
        InputProps={{
          endAdornment: <InputAdornment position="end">°C</InputAdornment>,
        }}
      />

      <Divider />

      <Typography variant="subtitle2" color="text.secondary">
        Flow
      </Typography>

      <TextField
        label="Steam Flow Rate"
        value={steamFlow}
        onChange={(e) => onSteamFlowChange(e.target.value)}
        type="number"
        fullWidth
        InputProps={{
          endAdornment: <InputAdornment position="end">ton/hr</InputAdornment>,
        }}
      />
    </Stack>
  );
}
