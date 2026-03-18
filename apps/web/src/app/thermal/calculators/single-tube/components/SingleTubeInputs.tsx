'use client';

import { TextField, InputAdornment, Stack, Typography, Divider, MenuItem } from '@mui/material';
import type { TubeMaterialKey, SprayFluidType } from '@vapour/types';
import { SINGLE_TUBE_MATERIAL_LABELS } from '@/lib/thermal';

const SPRAY_FLUID_LABELS: Record<SprayFluidType, string> = {
  SEAWATER: 'Seawater',
  BRINE: 'Brine',
  PURE_WATER: 'Pure Water',
};

interface SingleTubeInputsProps {
  // Tube geometry
  tubeOD: string;
  wallThickness: string;
  tubeLength: string;
  tubeMaterial: TubeMaterialKey;
  // Inside (vapour)
  vapourTemperature: string;
  vapourFlowRate: string;
  // Outside (spray)
  sprayFluidType: SprayFluidType;
  sprayTemperature: string;
  spraySalinity: string;
  sprayFlowRate: string;
  // Fouling
  insideFouling: string;
  outsideFouling: string;
  // Callbacks
  onTubeODChange: (v: string) => void;
  onWallThicknessChange: (v: string) => void;
  onTubeLengthChange: (v: string) => void;
  onTubeMaterialChange: (v: TubeMaterialKey) => void;
  onVapourTemperatureChange: (v: string) => void;
  onVapourFlowRateChange: (v: string) => void;
  onSprayFluidTypeChange: (v: SprayFluidType) => void;
  onSprayTemperatureChange: (v: string) => void;
  onSpraySalinityChange: (v: string) => void;
  onSprayFlowRateChange: (v: string) => void;
  onInsideFoulingChange: (v: string) => void;
  onOutsideFoulingChange: (v: string) => void;
}

export function SingleTubeInputs(props: SingleTubeInputsProps) {
  const showSalinity = props.sprayFluidType !== 'PURE_WATER';

  return (
    <Stack spacing={2}>
      {/* --- Tube Geometry --- */}
      <Typography variant="subtitle2" color="text.secondary">
        Tube Geometry
      </Typography>

      <TextField
        select
        label="Tube Material"
        value={props.tubeMaterial}
        onChange={(e) => props.onTubeMaterialChange(e.target.value as TubeMaterialKey)}
        fullWidth
      >
        {(Object.keys(SINGLE_TUBE_MATERIAL_LABELS) as TubeMaterialKey[]).map((key) => (
          <MenuItem key={key} value={key}>
            {SINGLE_TUBE_MATERIAL_LABELS[key]}
          </MenuItem>
        ))}
      </TextField>

      <Stack direction="row" spacing={2}>
        <TextField
          label="Tube OD"
          value={props.tubeOD}
          onChange={(e) => props.onTubeODChange(e.target.value)}
          type="number"
          fullWidth
          InputProps={{
            endAdornment: <InputAdornment position="end">mm</InputAdornment>,
          }}
        />
        <TextField
          label="Wall Thickness"
          value={props.wallThickness}
          onChange={(e) => props.onWallThicknessChange(e.target.value)}
          type="number"
          fullWidth
          InputProps={{
            endAdornment: <InputAdornment position="end">mm</InputAdornment>,
          }}
        />
      </Stack>

      <TextField
        label="Tube Length"
        value={props.tubeLength}
        onChange={(e) => props.onTubeLengthChange(e.target.value)}
        type="number"
        fullWidth
        InputProps={{
          endAdornment: <InputAdornment position="end">m</InputAdornment>,
        }}
      />

      <Divider />

      {/* --- Inside: Vapour / Condensation --- */}
      <Typography variant="subtitle2" color="text.secondary">
        Inside — Vapour (Condensation)
      </Typography>

      <TextField
        label="Vapour Temperature (Tsat)"
        value={props.vapourTemperature}
        onChange={(e) => props.onVapourTemperatureChange(e.target.value)}
        type="number"
        fullWidth
        InputProps={{
          endAdornment: <InputAdornment position="end">&deg;C</InputAdornment>,
        }}
        helperText="Saturation temperature of condensing vapour"
      />

      <TextField
        label="Vapour Flow Rate"
        value={props.vapourFlowRate}
        onChange={(e) => props.onVapourFlowRateChange(e.target.value)}
        type="number"
        fullWidth
        InputProps={{
          endAdornment: <InputAdornment position="end">kg/s</InputAdornment>,
        }}
      />

      <Divider />

      {/* --- Outside: Spray Evaporation --- */}
      <Typography variant="subtitle2" color="text.secondary">
        Outside — Spray Water (Evaporation)
      </Typography>

      <TextField
        select
        label="Spray Fluid"
        value={props.sprayFluidType}
        onChange={(e) => props.onSprayFluidTypeChange(e.target.value as SprayFluidType)}
        fullWidth
      >
        {(Object.keys(SPRAY_FLUID_LABELS) as SprayFluidType[]).map((key) => (
          <MenuItem key={key} value={key}>
            {SPRAY_FLUID_LABELS[key]}
          </MenuItem>
        ))}
      </TextField>

      <TextField
        label="Spray Water Temperature"
        value={props.sprayTemperature}
        onChange={(e) => props.onSprayTemperatureChange(e.target.value)}
        type="number"
        fullWidth
        InputProps={{
          endAdornment: <InputAdornment position="end">&deg;C</InputAdornment>,
        }}
      />

      {showSalinity && (
        <TextField
          label="Salinity"
          value={props.spraySalinity}
          onChange={(e) => props.onSpraySalinityChange(e.target.value)}
          type="number"
          fullWidth
          InputProps={{
            endAdornment: <InputAdornment position="end">ppm</InputAdornment>,
          }}
          helperText={
            props.sprayFluidType === 'SEAWATER'
              ? 'Typical: 35,000 ppm'
              : 'Typical: 50,000–70,000 ppm'
          }
        />
      )}

      <TextField
        label="Spray Flow Rate (per tube)"
        value={props.sprayFlowRate}
        onChange={(e) => props.onSprayFlowRateChange(e.target.value)}
        type="number"
        fullWidth
        InputProps={{
          endAdornment: <InputAdornment position="end">kg/s</InputAdornment>,
        }}
      />

      <Divider />

      {/* --- Fouling --- */}
      <Typography variant="subtitle2" color="text.secondary">
        Fouling Resistances
      </Typography>

      <Stack direction="row" spacing={2}>
        <TextField
          label="Inside (condensate)"
          value={props.insideFouling}
          onChange={(e) => props.onInsideFoulingChange(e.target.value)}
          type="number"
          fullWidth
          InputProps={{
            endAdornment: <InputAdornment position="end">m&sup2;&middot;K/W</InputAdornment>,
          }}
        />
        <TextField
          label="Outside (spray)"
          value={props.outsideFouling}
          onChange={(e) => props.onOutsideFoulingChange(e.target.value)}
          type="number"
          fullWidth
          InputProps={{
            endAdornment: <InputAdornment position="end">m&sup2;&middot;K/W</InputAdornment>,
          }}
        />
      </Stack>
    </Stack>
  );
}
