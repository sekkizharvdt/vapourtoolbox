'use client';

import {
  Stack,
  TextField,
  FormControl,
  InputLabel,
  Select,
  MenuItem,
  InputAdornment,
  Typography,
  Divider,
  ToggleButtonGroup,
  ToggleButton,
  Alert,
} from '@mui/material';
import type { SiphonFluidType, PressureUnit, ElbowConfig } from './types';
import { PRESSURE_UNIT_LABELS, FLUID_TYPE_LABELS, ELBOW_CONFIG_LABELS } from './types';

interface SiphonInputsProps {
  // Pressure
  upstreamPressure: string;
  downstreamPressure: string;
  pressureUnit: PressureUnit;
  onUpstreamPressureChange: (value: string) => void;
  onDownstreamPressureChange: (value: string) => void;
  onPressureUnitChange: (value: PressureUnit) => void;

  // Fluid
  fluidType: SiphonFluidType;
  salinity: string;
  onFluidTypeChange: (value: SiphonFluidType) => void;
  onSalinityChange: (value: string) => void;

  // Flow
  flowRate: string;
  onFlowRateChange: (value: string) => void;
  targetVelocity: string;
  onTargetVelocityChange: (value: string) => void;

  // Geometry
  elbowConfig: ElbowConfig;
  horizontalDistance: string;
  offsetDistance: string;
  onElbowConfigChange: (value: ElbowConfig) => void;
  onHorizontalDistanceChange: (value: string) => void;
  onOffsetDistanceChange: (value: string) => void;

  // Safety
  safetyFactor: string;
  onSafetyFactorChange: (value: string) => void;

  // Computed display
  pressureDiffDisplay: string;
  derivedTemperature: number | null;
  derivedDensity: number | null;
}

export function SiphonInputs({
  upstreamPressure,
  downstreamPressure,
  pressureUnit,
  onUpstreamPressureChange,
  onDownstreamPressureChange,
  onPressureUnitChange,
  fluidType,
  salinity,
  onFluidTypeChange,
  onSalinityChange,
  flowRate,
  onFlowRateChange,
  targetVelocity,
  onTargetVelocityChange,
  elbowConfig,
  horizontalDistance,
  offsetDistance,
  onElbowConfigChange,
  onHorizontalDistanceChange,
  onOffsetDistanceChange,
  safetyFactor,
  onSafetyFactorChange,
  pressureDiffDisplay,
  derivedTemperature,
  derivedDensity,
}: SiphonInputsProps) {
  const unitLabel = PRESSURE_UNIT_LABELS[pressureUnit];

  return (
    <Stack spacing={2.5}>
      {/* === Pressure Section === */}
      <Typography variant="subtitle2" color="text.secondary">
        Effect Pressures
      </Typography>

      <FormControl fullWidth size="small">
        <InputLabel>Pressure Unit</InputLabel>
        <Select
          value={pressureUnit}
          label="Pressure Unit"
          onChange={(e) => onPressureUnitChange(e.target.value as PressureUnit)}
        >
          {Object.entries(PRESSURE_UNIT_LABELS).map(([key, label]) => (
            <MenuItem key={key} value={key}>
              {label}
            </MenuItem>
          ))}
        </Select>
      </FormControl>

      <TextField
        label="Upstream Effect Pressure"
        value={upstreamPressure}
        onChange={(e) => onUpstreamPressureChange(e.target.value)}
        type="number"
        fullWidth
        size="small"
        slotProps={{
          input: { endAdornment: <InputAdornment position="end">{unitLabel}</InputAdornment> },
        }}
      />

      <TextField
        label="Downstream Effect Pressure"
        value={downstreamPressure}
        onChange={(e) => onDownstreamPressureChange(e.target.value)}
        type="number"
        fullWidth
        size="small"
        slotProps={{
          input: { endAdornment: <InputAdornment position="end">{unitLabel}</InputAdornment> },
        }}
      />

      {pressureDiffDisplay && (
        <Typography variant="caption" color="text.secondary">
          {pressureDiffDisplay}
        </Typography>
      )}

      <Divider />

      {/* === Fluid Section === */}
      <Typography variant="subtitle2" color="text.secondary">
        Fluid Properties
      </Typography>

      <FormControl fullWidth size="small">
        <InputLabel>Fluid Type</InputLabel>
        <Select
          value={fluidType}
          label="Fluid Type"
          onChange={(e) => onFluidTypeChange(e.target.value as SiphonFluidType)}
        >
          {Object.entries(FLUID_TYPE_LABELS).map(([key, label]) => (
            <MenuItem key={key} value={key}>
              {label}
            </MenuItem>
          ))}
        </Select>
      </FormControl>

      {(fluidType === 'seawater' || fluidType === 'brine') && (
        <TextField
          label="Salinity"
          value={salinity}
          onChange={(e) => onSalinityChange(e.target.value)}
          type="number"
          fullWidth
          size="small"
          slotProps={{
            input: { endAdornment: <InputAdornment position="end">ppm</InputAdornment> },
          }}
        />
      )}

      {derivedTemperature !== null && (
        <Typography variant="caption" color="text.secondary">
          Saturation temperature: <strong>{derivedTemperature.toFixed(1)} &deg;C</strong>
          {derivedDensity !== null && (
            <>
              {' '}
              &middot; Density: <strong>{derivedDensity.toFixed(2)} kg/m&sup3;</strong>
            </>
          )}
        </Typography>
      )}

      <Divider />

      {/* === Flow Section === */}
      <Typography variant="subtitle2" color="text.secondary">
        Flow &amp; Velocity
      </Typography>

      <TextField
        label="Mass Flow Rate"
        value={flowRate}
        onChange={(e) => onFlowRateChange(e.target.value)}
        type="number"
        fullWidth
        size="small"
        slotProps={{
          input: { endAdornment: <InputAdornment position="end">ton/hr</InputAdornment> },
        }}
      />

      <TextField
        label="Target Velocity"
        value={targetVelocity}
        onChange={(e) => onTargetVelocityChange(e.target.value)}
        type="number"
        fullWidth
        size="small"
        slotProps={{
          input: { endAdornment: <InputAdornment position="end">m/s</InputAdornment> },
        }}
        helperText="Range: 0.05 &ndash; 1.0 m/s"
      />

      <Divider />

      {/* === Geometry Section === */}
      <Typography variant="subtitle2" color="text.secondary">
        Pipe Geometry
      </Typography>

      <ToggleButtonGroup
        value={elbowConfig}
        exclusive
        onChange={(_, newVal) => newVal && onElbowConfigChange(newVal as ElbowConfig)}
        fullWidth
        size="small"
      >
        {Object.entries(ELBOW_CONFIG_LABELS).map(([key, label]) => (
          <ToggleButton key={key} value={key}>
            {label}
          </ToggleButton>
        ))}
      </ToggleButtonGroup>

      <TextField
        label="Horizontal Distance"
        value={horizontalDistance}
        onChange={(e) => onHorizontalDistanceChange(e.target.value)}
        type="number"
        fullWidth
        size="small"
        slotProps={{
          input: { endAdornment: <InputAdornment position="end">m</InputAdornment> },
        }}
        helperText="Distance between nozzle centers"
      />

      {elbowConfig !== '2_elbows' && (
        <TextField
          label="Offset Distance"
          value={offsetDistance}
          onChange={(e) => onOffsetDistanceChange(e.target.value)}
          type="number"
          fullWidth
          size="small"
          slotProps={{
            input: { endAdornment: <InputAdornment position="end">m</InputAdornment> },
          }}
          helperText={
            elbowConfig === '3_elbows'
              ? 'Lateral offset between nozzle planes'
              : 'Lateral offset to clear adjacent siphon'
          }
        />
      )}

      <Divider />

      {/* === Safety Factor === */}
      <Typography variant="subtitle2" color="text.secondary">
        Safety Factor
      </Typography>

      <TextField
        label="Safety Factor"
        value={safetyFactor}
        onChange={(e) => onSafetyFactorChange(e.target.value)}
        type="number"
        fullWidth
        size="small"
        slotProps={{
          input: { endAdornment: <InputAdornment position="end">%</InputAdornment> },
        }}
      />

      {parseFloat(safetyFactor) < 20 && (
        <Alert severity="warning" variant="outlined">
          Minimum recommended safety factor is 20%
        </Alert>
      )}
    </Stack>
  );
}
