'use client';

import {
  Paper,
  Typography,
  Box,
  TextField,
  ToggleButton,
  ToggleButtonGroup,
  Alert,
  Divider,
  InputAdornment,
  FormControl,
  InputLabel,
  Select,
  MenuItem,
  Stack,
} from '@mui/material';
import { CRITICAL_TEMPERATURE_C } from '@vapour/constants';
import type { SteamMode, LookupMode, PressureUnit } from './types';

interface SteamInputsProps {
  steamMode: SteamMode;
  lookupMode: LookupMode;
  temperatureInput: string;
  pressureInput: string;
  pressureUnit: PressureUnit;
  error: string | null;
  onSteamModeChange: (mode: SteamMode) => void;
  onLookupModeChange: (mode: LookupMode) => void;
  onTemperatureChange: (value: string) => void;
  onPressureChange: (value: string) => void;
  onPressureUnitChange: (unit: PressureUnit) => void;
}

export function SteamInputs({
  steamMode,
  lookupMode,
  temperatureInput,
  pressureInput,
  pressureUnit,
  error,
  onSteamModeChange,
  onLookupModeChange,
  onTemperatureChange,
  onPressureChange,
  onPressureUnitChange,
}: SteamInputsProps) {
  return (
    <Paper sx={{ p: 3 }}>
      <Typography variant="h6" gutterBottom>
        Steam State
      </Typography>

      {/* Steam Mode Selection */}
      <Box sx={{ mb: 3 }}>
        <ToggleButtonGroup
          value={steamMode}
          exclusive
          onChange={(_, newMode) => newMode && onSteamModeChange(newMode)}
          fullWidth
          size="small"
        >
          <ToggleButton value="saturation">Saturation</ToggleButton>
          <ToggleButton value="subcooled">Subcooled</ToggleButton>
          <ToggleButton value="superheated">Superheated</ToggleButton>
        </ToggleButtonGroup>
        <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mt: 1 }}>
          {steamMode === 'saturation' && 'Two-phase equilibrium (Region 4)'}
          {steamMode === 'subcooled' && 'Compressed liquid below saturation (Region 1)'}
          {steamMode === 'superheated' && 'Steam above saturation (Region 2)'}
        </Typography>
      </Box>

      <Divider sx={{ my: 2 }} />

      {/* Saturation Mode: Temperature OR Pressure */}
      {steamMode === 'saturation' && (
        <>
          <Box sx={{ mb: 3 }}>
            <Typography variant="body2" color="text.secondary" gutterBottom>
              Lookup by:
            </Typography>
            <ToggleButtonGroup
              value={lookupMode}
              exclusive
              onChange={(_, newMode) => newMode && onLookupModeChange(newMode)}
              fullWidth
              size="small"
            >
              <ToggleButton value="temperature">Temperature</ToggleButton>
              <ToggleButton value="pressure">Pressure</ToggleButton>
            </ToggleButtonGroup>
          </Box>

          {lookupMode === 'temperature' && (
            <TextField
              label="Temperature"
              value={temperatureInput}
              onChange={(e) => onTemperatureChange(e.target.value)}
              type="number"
              fullWidth
              InputProps={{
                endAdornment: <InputAdornment position="end">°C</InputAdornment>,
              }}
              helperText={`Valid range: 0.01 to ${CRITICAL_TEMPERATURE_C.toFixed(1)} °C`}
            />
          )}

          {lookupMode === 'pressure' && (
            <Stack spacing={2}>
              <TextField
                label="Pressure"
                value={pressureInput}
                onChange={(e) => onPressureChange(e.target.value)}
                type="number"
                fullWidth
              />
              <FormControl fullWidth size="small">
                <InputLabel>Unit</InputLabel>
                <Select
                  value={pressureUnit}
                  label="Unit"
                  onChange={(e) => onPressureUnitChange(e.target.value as PressureUnit)}
                >
                  <MenuItem value="bar">bar (absolute)</MenuItem>
                  <MenuItem value="mbar">mbar (absolute)</MenuItem>
                  <MenuItem value="kgcm2g">kg/cm² (gauge)</MenuItem>
                  <MenuItem value="mH2O">m H₂O</MenuItem>
                </Select>
              </FormControl>
            </Stack>
          )}
        </>
      )}

      {/* Subcooled/Superheated Mode: Both P and T required */}
      {(steamMode === 'subcooled' || steamMode === 'superheated') && (
        <Stack spacing={2}>
          <TextField
            label="Temperature"
            value={temperatureInput}
            onChange={(e) => onTemperatureChange(e.target.value)}
            type="number"
            fullWidth
            InputProps={{
              endAdornment: <InputAdornment position="end">°C</InputAdornment>,
            }}
            helperText={
              steamMode === 'subcooled' ? 'Valid range: 0 to 350°C' : 'Valid range: 0 to 800°C'
            }
          />
          <TextField
            label="Pressure"
            value={pressureInput}
            onChange={(e) => onPressureChange(e.target.value)}
            type="number"
            fullWidth
          />
          <FormControl fullWidth size="small">
            <InputLabel>Pressure Unit</InputLabel>
            <Select
              value={pressureUnit}
              label="Pressure Unit"
              onChange={(e) => onPressureUnitChange(e.target.value as PressureUnit)}
            >
              <MenuItem value="bar">bar (absolute)</MenuItem>
              <MenuItem value="mbar">mbar (absolute)</MenuItem>
              <MenuItem value="kgcm2g">kg/cm² (gauge)</MenuItem>
              <MenuItem value="mH2O">m H₂O</MenuItem>
            </Select>
          </FormControl>
        </Stack>
      )}

      {/* Error Display */}
      {error && (
        <Alert severity="error" sx={{ mt: 2 }}>
          {error}
        </Alert>
      )}
    </Paper>
  );
}
