'use client';

import {
  Paper,
  Typography,
  TextField,
  FormControl,
  InputLabel,
  Select,
  MenuItem,
  InputAdornment,
  Stack,
  Divider,
} from '@mui/material';
import { SCHEDULE_40_PIPES } from '@/lib/thermal';
import type { FluidType } from './types';

interface PressureDropInputsProps {
  selectedNPS: string;
  setSelectedNPS: (value: string) => void;
  pipeLength: string;
  setPipeLength: (value: string) => void;
  roughness: string;
  setRoughness: (value: string) => void;
  flowRate: string;
  setFlowRate: (value: string) => void;
  fluidType: FluidType;
  setFluidType: (value: FluidType) => void;
  temperature: string;
  setTemperature: (value: string) => void;
  salinity: string;
  setSalinity: (value: string) => void;
  customDensity: string;
  setCustomDensity: (value: string) => void;
  customViscosity: string;
  setCustomViscosity: (value: string) => void;
  elevationChange: string;
  setElevationChange: (value: string) => void;
  fluidDensity: number;
  fluidViscosity: number;
}

export function PressureDropInputs({
  selectedNPS,
  setSelectedNPS,
  pipeLength,
  setPipeLength,
  roughness,
  setRoughness,
  flowRate,
  setFlowRate,
  fluidType,
  setFluidType,
  temperature,
  setTemperature,
  salinity,
  setSalinity,
  customDensity,
  setCustomDensity,
  customViscosity,
  setCustomViscosity,
  elevationChange,
  setElevationChange,
  fluidDensity,
  fluidViscosity,
}: PressureDropInputsProps) {
  return (
    <Paper sx={{ p: 3 }}>
      <Typography variant="h6" gutterBottom>
        Input Parameters
      </Typography>

      <Stack spacing={2}>
        {/* Pipe Selection */}
        <FormControl fullWidth>
          <InputLabel>Pipe Size</InputLabel>
          <Select
            value={selectedNPS}
            label="Pipe Size"
            onChange={(e) => setSelectedNPS(e.target.value)}
          >
            {SCHEDULE_40_PIPES.map((pipe) => (
              <MenuItem key={pipe.nps} value={pipe.nps}>
                {pipe.nps}&quot; (DN{pipe.dn}) - ID: {pipe.id_mm.toFixed(1)} mm
              </MenuItem>
            ))}
          </Select>
        </FormControl>

        <TextField
          label="Pipe Length"
          value={pipeLength}
          onChange={(e) => setPipeLength(e.target.value)}
          type="number"
          fullWidth
          InputProps={{
            endAdornment: <InputAdornment position="end">m</InputAdornment>,
          }}
        />

        <TextField
          label="Pipe Roughness"
          value={roughness}
          onChange={(e) => setRoughness(e.target.value)}
          type="number"
          fullWidth
          InputProps={{
            endAdornment: <InputAdornment position="end">mm</InputAdornment>,
          }}
          helperText="Commercial steel: 0.045 mm"
        />

        <Divider />

        <TextField
          label="Mass Flow Rate"
          value={flowRate}
          onChange={(e) => setFlowRate(e.target.value)}
          type="number"
          fullWidth
          InputProps={{
            endAdornment: <InputAdornment position="end">ton/hr</InputAdornment>,
          }}
        />

        {/* Fluid Type */}
        <FormControl fullWidth>
          <InputLabel>Fluid Type</InputLabel>
          <Select
            value={fluidType}
            label="Fluid Type"
            onChange={(e) => setFluidType(e.target.value as FluidType)}
          >
            <MenuItem value="water">Pure Water</MenuItem>
            <MenuItem value="seawater">Seawater</MenuItem>
            <MenuItem value="custom">Custom</MenuItem>
          </Select>
        </FormControl>

        {(fluidType === 'water' || fluidType === 'seawater') && (
          <TextField
            label="Temperature"
            value={temperature}
            onChange={(e) => setTemperature(e.target.value)}
            type="number"
            fullWidth
            InputProps={{
              endAdornment: <InputAdornment position="end">°C</InputAdornment>,
            }}
          />
        )}

        {fluidType === 'seawater' && (
          <TextField
            label="Salinity"
            value={salinity}
            onChange={(e) => setSalinity(e.target.value)}
            type="number"
            fullWidth
            InputProps={{
              endAdornment: <InputAdornment position="end">ppm</InputAdornment>,
            }}
          />
        )}

        {fluidType === 'custom' && (
          <>
            <TextField
              label="Fluid Density"
              value={customDensity}
              onChange={(e) => setCustomDensity(e.target.value)}
              type="number"
              fullWidth
              InputProps={{
                endAdornment: <InputAdornment position="end">kg/m³</InputAdornment>,
              }}
            />
            <TextField
              label="Dynamic Viscosity"
              value={customViscosity}
              onChange={(e) => setCustomViscosity(e.target.value)}
              type="number"
              fullWidth
              InputProps={{
                endAdornment: <InputAdornment position="end">Pa·s</InputAdornment>,
              }}
              helperText="Water at 20°C: 0.001 Pa·s"
            />
          </>
        )}

        <Typography variant="body2" color="text.secondary">
          ρ = {fluidDensity.toFixed(1)} kg/m³, μ = {(fluidViscosity * 1000).toFixed(3)} mPa·s
        </Typography>

        <Divider />

        <TextField
          label="Elevation Change"
          value={elevationChange}
          onChange={(e) => setElevationChange(e.target.value)}
          type="number"
          fullWidth
          InputProps={{
            endAdornment: <InputAdornment position="end">m</InputAdornment>,
          }}
          helperText="Positive = upward flow"
        />
      </Stack>
    </Paper>
  );
}
