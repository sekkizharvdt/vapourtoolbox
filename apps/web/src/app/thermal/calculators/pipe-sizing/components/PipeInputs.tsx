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
import { SCHEDULE_40_PIPES } from '@/lib/thermal';
import type { CalculationMode, FlowUnit, FluidType } from './types';

interface PipeInputsProps {
  mode: CalculationMode;
  flowRate: string;
  flowUnit: FlowUnit;
  fluidType: FluidType;
  temperature: string;
  salinity: string;
  customDensity: string;
  targetVelocity: string;
  minVelocity: string;
  maxVelocity: string;
  selectedNPS: string;
  massFlowTonHr: number;
  density: number;
  error: string | null;
  onModeChange: (mode: CalculationMode) => void;
  onFlowRateChange: (value: string) => void;
  onFlowUnitChange: (unit: FlowUnit) => void;
  onFluidTypeChange: (type: FluidType) => void;
  onTemperatureChange: (value: string) => void;
  onSalinityChange: (value: string) => void;
  onCustomDensityChange: (value: string) => void;
  onTargetVelocityChange: (value: string) => void;
  onMinVelocityChange: (value: string) => void;
  onMaxVelocityChange: (value: string) => void;
  onSelectedNPSChange: (nps: string) => void;
}

export function PipeInputs({
  mode,
  flowRate,
  flowUnit,
  fluidType,
  temperature,
  salinity,
  customDensity,
  targetVelocity,
  minVelocity,
  maxVelocity,
  selectedNPS,
  massFlowTonHr,
  density,
  error,
  onModeChange,
  onFlowRateChange,
  onFlowUnitChange,
  onFluidTypeChange,
  onTemperatureChange,
  onSalinityChange,
  onCustomDensityChange,
  onTargetVelocityChange,
  onMinVelocityChange,
  onMaxVelocityChange,
  onSelectedNPSChange,
}: PipeInputsProps) {
  return (
    <Paper sx={{ p: 3 }}>
      <Typography variant="h6" gutterBottom>
        Input Parameters
      </Typography>

      {/* Mode Toggle */}
      <Box sx={{ mb: 3 }}>
        <Typography variant="body2" color="text.secondary" gutterBottom>
          Calculation Mode:
        </Typography>
        <ToggleButtonGroup
          value={mode}
          exclusive
          onChange={(_, newMode) => newMode && onModeChange(newMode)}
          fullWidth
          size="small"
        >
          <ToggleButton value="size_by_flow">Size by Flow</ToggleButton>
          <ToggleButton value="check_velocity">Check Velocity</ToggleButton>
        </ToggleButtonGroup>
      </Box>

      <Divider sx={{ my: 2 }} />

      {/* Flow Rate */}
      <Stack spacing={2}>
        <Box>
          <TextField
            label="Flow Rate"
            value={flowRate}
            onChange={(e) => onFlowRateChange(e.target.value)}
            type="number"
            fullWidth
          />
          <FormControl fullWidth sx={{ mt: 1 }} size="small">
            <InputLabel>Unit</InputLabel>
            <Select
              value={flowUnit}
              label="Unit"
              onChange={(e) => onFlowUnitChange(e.target.value as FlowUnit)}
            >
              <MenuItem value="tonhr">ton/hr (mass)</MenuItem>
              <MenuItem value="kghr">kg/hr (mass)</MenuItem>
              <MenuItem value="kgsec">kg/s (mass)</MenuItem>
              <MenuItem value="m3hr">m³/hr (volumetric)</MenuItem>
            </Select>
          </FormControl>
          <Typography variant="caption" color="text.secondary" sx={{ mt: 0.5, display: 'block' }}>
            = {massFlowTonHr.toFixed(3)} ton/hr
          </Typography>
        </Box>

        {/* Fluid Type */}
        <FormControl fullWidth>
          <InputLabel>Fluid Type</InputLabel>
          <Select
            value={fluidType}
            label="Fluid Type"
            onChange={(e) => onFluidTypeChange(e.target.value as FluidType)}
          >
            <MenuItem value="water">Pure Water</MenuItem>
            <MenuItem value="seawater">Seawater</MenuItem>
            <MenuItem value="steam">Steam/Vapor</MenuItem>
            <MenuItem value="custom">Custom</MenuItem>
          </Select>
        </FormControl>

        {/* Temperature (for water/seawater) */}
        {(fluidType === 'water' || fluidType === 'seawater') && (
          <TextField
            label="Temperature"
            value={temperature}
            onChange={(e) => onTemperatureChange(e.target.value)}
            type="number"
            fullWidth
            InputProps={{
              endAdornment: <InputAdornment position="end">°C</InputAdornment>,
            }}
          />
        )}

        {/* Salinity (for seawater) */}
        {fluidType === 'seawater' && (
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

        {/* Custom density */}
        {(fluidType === 'steam' || fluidType === 'custom') && (
          <TextField
            label="Fluid Density"
            value={customDensity}
            onChange={(e) => onCustomDensityChange(e.target.value)}
            type="number"
            fullWidth
            InputProps={{
              endAdornment: <InputAdornment position="end">kg/m³</InputAdornment>,
            }}
            helperText={fluidType === 'steam' ? 'Depends on steam pressure' : ''}
          />
        )}

        {/* Show calculated density */}
        <Typography variant="body2" color="text.secondary">
          Fluid density: <strong>{density.toFixed(2)} kg/m³</strong>
        </Typography>

        <Divider />

        {/* Velocity Limits */}
        <Typography variant="subtitle2">Velocity Limits</Typography>

        <TextField
          label="Target Velocity"
          value={targetVelocity}
          onChange={(e) => onTargetVelocityChange(e.target.value)}
          type="number"
          fullWidth
          size="small"
          InputProps={{
            endAdornment: <InputAdornment position="end">m/s</InputAdornment>,
          }}
        />

        <Stack direction="row" spacing={1}>
          <TextField
            label="Min"
            value={minVelocity}
            onChange={(e) => onMinVelocityChange(e.target.value)}
            type="number"
            fullWidth
            size="small"
            InputProps={{
              endAdornment: <InputAdornment position="end">m/s</InputAdornment>,
            }}
          />
          <TextField
            label="Max"
            value={maxVelocity}
            onChange={(e) => onMaxVelocityChange(e.target.value)}
            type="number"
            fullWidth
            size="small"
            InputProps={{
              endAdornment: <InputAdornment position="end">m/s</InputAdornment>,
            }}
          />
        </Stack>

        {/* Pipe selection (check velocity mode) */}
        {mode === 'check_velocity' && (
          <>
            <Divider />
            <FormControl fullWidth>
              <InputLabel>Pipe Size</InputLabel>
              <Select
                value={selectedNPS}
                label="Pipe Size"
                onChange={(e) => onSelectedNPSChange(e.target.value)}
              >
                {SCHEDULE_40_PIPES.map((pipe) => (
                  <MenuItem key={pipe.nps} value={pipe.nps}>
                    {pipe.nps}&quot; (DN{pipe.dn}) - ID: {pipe.id_mm.toFixed(1)} mm
                  </MenuItem>
                ))}
              </Select>
            </FormControl>
          </>
        )}
      </Stack>

      {/* Error Display */}
      {error && (
        <Alert severity="error" sx={{ mt: 2 }}>
          {error}
        </Alert>
      )}
    </Paper>
  );
}
