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
import type { SuctionFluidType, CalculationMode } from './types';
import { FLUID_TYPE_LABELS, MODE_LABELS } from './types';
import { SCHEDULE_40_PIPES } from '@/lib/thermal/pipeService';
import type { SuctionSystemResult } from '@/lib/thermal/suctionSystemCalculator';

interface SuctionInputsProps {
  // Operating conditions
  effectPressure: string;
  fluidType: SuctionFluidType;
  salinity: string;
  flowRate: string;
  onEffectPressureChange: (value: string) => void;
  onFluidTypeChange: (value: SuctionFluidType) => void;
  onSalinityChange: (value: string) => void;
  onFlowRateChange: (value: string) => void;

  // Pipe sizing
  nozzleVelocityTarget: string;
  suctionVelocityTarget: string;
  onNozzleVelocityTargetChange: (value: string) => void;
  onSuctionVelocityTargetChange: (value: string) => void;

  // Pipe geometry
  elbowCount: string;
  verticalPipeRun: string;
  horizontalPipeRun: string;
  onElbowCountChange: (value: string) => void;
  onVerticalPipeRunChange: (value: string) => void;
  onHorizontalPipeRunChange: (value: string) => void;

  // Holdup volume
  holdupPipeDiameter: string;
  minColumnHeight: string;
  residenceTime: string;
  onHoldupPipeDiameterChange: (value: string) => void;
  onMinColumnHeightChange: (value: string) => void;
  onResidenceTimeChange: (value: string) => void;

  // Pump & mode
  pumpNPSHr: string;
  safetyMargin: string;
  mode: CalculationMode;
  userElevation: string;
  onPumpNPSHrChange: (value: string) => void;
  onSafetyMarginChange: (value: string) => void;
  onModeChange: (value: CalculationMode) => void;
  onUserElevationChange: (value: string) => void;

  // Derived values from result
  result: SuctionSystemResult | null;
}

// Only show pipes >= 2" for holdup pipe dropdown
const HOLDUP_PIPE_OPTIONS = SCHEDULE_40_PIPES.filter((p) => {
  const nps = parseFloat(p.nps);
  return !isNaN(nps) && nps >= 2;
});

export function SuctionInputs({
  effectPressure,
  fluidType,
  salinity,
  flowRate,
  onEffectPressureChange,
  onFluidTypeChange,
  onSalinityChange,
  onFlowRateChange,
  nozzleVelocityTarget,
  suctionVelocityTarget,
  onNozzleVelocityTargetChange,
  onSuctionVelocityTargetChange,
  elbowCount,
  verticalPipeRun,
  horizontalPipeRun,
  onElbowCountChange,
  onVerticalPipeRunChange,
  onHorizontalPipeRunChange,
  holdupPipeDiameter,
  minColumnHeight,
  residenceTime,
  onHoldupPipeDiameterChange,
  onMinColumnHeightChange,
  onResidenceTimeChange,
  pumpNPSHr,
  safetyMargin,
  mode,
  userElevation,
  onPumpNPSHrChange,
  onSafetyMarginChange,
  onModeChange,
  onUserElevationChange,
  result,
}: SuctionInputsProps) {
  return (
    <Stack spacing={2.5}>
      {/* === Operating Conditions === */}
      <Typography variant="subtitle2" color="text.secondary">
        Operating Conditions
      </Typography>

      <TextField
        label="Effect Pressure"
        value={effectPressure}
        onChange={(e) => onEffectPressureChange(e.target.value)}
        type="number"
        fullWidth
        size="small"
        slotProps={{
          input: { endAdornment: <InputAdornment position="end">mbar(a)</InputAdornment> },
        }}
        helperText="Absolute pressure in the MED effect"
      />

      <ToggleButtonGroup
        value={fluidType}
        exclusive
        onChange={(_, v) => v && onFluidTypeChange(v as SuctionFluidType)}
        fullWidth
        size="small"
      >
        {Object.entries(FLUID_TYPE_LABELS).map(([key, label]) => (
          <ToggleButton key={key} value={key}>
            {label}
          </ToggleButton>
        ))}
      </ToggleButtonGroup>

      {fluidType === 'brine' && (
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

      {result && (
        <Typography variant="caption" color="text.secondary">
          T<sub>sat</sub> = {result.saturationTemperature.toFixed(1)}°C
          {result.boilingPointElevation > 0 && (
            <> + BPE {result.boilingPointElevation.toFixed(2)}°C</>
          )}
          {' = '}
          <strong>{result.fluidTemperature.toFixed(1)}°C</strong>
          {' · '}
          {result.fluidDensity.toFixed(1)} kg/m³
        </Typography>
      )}

      <Divider />

      {/* === Pipe Sizing === */}
      <Typography variant="subtitle2" color="text.secondary">
        Velocity Targets
      </Typography>

      <TextField
        label="Nozzle Velocity Target"
        value={nozzleVelocityTarget}
        onChange={(e) => onNozzleVelocityTargetChange(e.target.value)}
        type="number"
        fullWidth
        size="small"
        slotProps={{
          input: { endAdornment: <InputAdornment position="end">m/s</InputAdornment> },
        }}
        helperText="Range: 0.01 – 0.15 m/s"
      />

      <TextField
        label="Suction Pipe Velocity Target"
        value={suctionVelocityTarget}
        onChange={(e) => onSuctionVelocityTargetChange(e.target.value)}
        type="number"
        fullWidth
        size="small"
        slotProps={{
          input: { endAdornment: <InputAdornment position="end">m/s</InputAdornment> },
        }}
        helperText="Range: 0.5 – 2.0 m/s"
      />

      {result && (
        <Typography variant="caption" color="text.secondary">
          Nozzle: {result.nozzlePipe.nps}&quot; ({result.nozzleVelocity.toFixed(3)} m/s)
          {' · '}
          Suction: {result.suctionPipe.nps}&quot; ({result.suctionVelocity.toFixed(2)} m/s)
          {' · '}
          Auto: {result.valveType === 'gate' ? 'Gate' : 'Ball'} valve,{' '}
          {result.strainerType === 'bucket_type' ? 'Bucket' : 'Y-type'} strainer
        </Typography>
      )}

      <Divider />

      {/* === Pipe Geometry === */}
      <Typography variant="subtitle2" color="text.secondary">
        Pipe Geometry
      </Typography>

      <TextField
        label="Number of 90° Elbows"
        value={elbowCount}
        onChange={(e) => onElbowCountChange(e.target.value)}
        type="number"
        fullWidth
        size="small"
        slotProps={{
          input: { inputProps: { min: 0, step: 1 } },
        }}
      />

      <TextField
        label="Vertical Pipe Run"
        value={verticalPipeRun}
        onChange={(e) => onVerticalPipeRunChange(e.target.value)}
        type="number"
        fullWidth
        size="small"
        slotProps={{
          input: { endAdornment: <InputAdornment position="end">m</InputAdornment> },
        }}
        helperText="Nozzle to pump centerline"
      />

      <TextField
        label="Horizontal Pipe Run"
        value={horizontalPipeRun}
        onChange={(e) => onHorizontalPipeRunChange(e.target.value)}
        type="number"
        fullWidth
        size="small"
        slotProps={{
          input: { endAdornment: <InputAdornment position="end">m</InputAdornment> },
        }}
      />

      <Divider />

      {/* === Holdup Volume === */}
      <Typography variant="subtitle2" color="text.secondary">
        Holdup Volume
      </Typography>

      <FormControl fullWidth size="small">
        <InputLabel>Holdup Pipe Diameter</InputLabel>
        <Select
          value={holdupPipeDiameter}
          label="Holdup Pipe Diameter"
          onChange={(e) => onHoldupPipeDiameterChange(e.target.value)}
        >
          <MenuItem value="">Same as nozzle</MenuItem>
          {HOLDUP_PIPE_OPTIONS.map((p) => (
            <MenuItem key={p.nps} value={p.nps}>
              {p.nps}&quot; (DN{p.dn}, ID {p.id_mm.toFixed(1)} mm)
            </MenuItem>
          ))}
        </Select>
      </FormControl>

      <TextField
        label="Minimum Column Height"
        value={minColumnHeight}
        onChange={(e) => onMinColumnHeightChange(e.target.value)}
        type="number"
        fullWidth
        size="small"
        slotProps={{
          input: { endAdornment: <InputAdornment position="end">m</InputAdornment> },
        }}
        helperText="For level gauge range"
      />

      <TextField
        label="Residence Time"
        value={residenceTime}
        onChange={(e) => onResidenceTimeChange(e.target.value)}
        type="number"
        fullWidth
        size="small"
        slotProps={{
          input: { endAdornment: <InputAdornment position="end">s</InputAdornment> },
        }}
        helperText="Holdup time for VFD pump control"
      />

      {result && (
        <Typography variant="caption" color="text.secondary">
          Holdup: {result.holdup.holdupPipeNPS}&quot; pipe,{' '}
          {result.holdup.governingHeight.toFixed(2)} m (
          {result.holdup.governingConstraint === 'residence_time' ? 'residence time' : 'min column'}{' '}
          governs)
          {' · '}
          {result.holdup.holdupVolume.toFixed(1)} L
        </Typography>
      )}

      <Divider />

      {/* === Pump & Mode === */}
      <Typography variant="subtitle2" color="text.secondary">
        Pump &amp; Elevation
      </Typography>

      <TextField
        label="Pump NPSHr"
        value={pumpNPSHr}
        onChange={(e) => onPumpNPSHrChange(e.target.value)}
        type="number"
        fullWidth
        size="small"
        slotProps={{
          input: { endAdornment: <InputAdornment position="end">m</InputAdornment> },
        }}
        helperText="From pump datasheet"
      />

      <TextField
        label="Safety Margin"
        value={safetyMargin}
        onChange={(e) => onSafetyMarginChange(e.target.value)}
        type="number"
        fullWidth
        size="small"
        slotProps={{
          input: { endAdornment: <InputAdornment position="end">m</InputAdornment> },
        }}
        helperText="Margin above NPSHr (min 0.5 m recommended)"
      />

      {parseFloat(safetyMargin) < 0.5 && parseFloat(safetyMargin) >= 0 && (
        <Alert severity="warning" variant="outlined">
          Recommended minimum safety margin is 0.5 m
        </Alert>
      )}

      <ToggleButtonGroup
        value={mode}
        exclusive
        onChange={(_, v) => v && onModeChange(v as CalculationMode)}
        fullWidth
        size="small"
      >
        {Object.entries(MODE_LABELS).map(([key, label]) => (
          <ToggleButton key={key} value={key} sx={{ fontSize: '0.75rem' }}>
            {label}
          </ToggleButton>
        ))}
      </ToggleButtonGroup>

      {mode === 'verify_elevation' && (
        <TextField
          label="User-Provided Elevation"
          value={userElevation}
          onChange={(e) => onUserElevationChange(e.target.value)}
          type="number"
          fullWidth
          size="small"
          slotProps={{
            input: { endAdornment: <InputAdornment position="end">m</InputAdornment> },
          }}
          helperText="Vessel nozzle to pump centerline"
        />
      )}
    </Stack>
  );
}
