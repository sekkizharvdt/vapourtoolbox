'use client';

import { useState } from 'react';
import {
  TextField,
  InputAdornment,
  Stack,
  Typography,
  Divider,
  MenuItem,
  Chip,
} from '@mui/material';
import { Inventory as DbIcon } from '@mui/icons-material';
import type { SprayFluidType, Material } from '@vapour/types';
import { QUICK_SELECT_MATERIALS } from '@/lib/thermal';
import MaterialPickerDialog from '@/components/materials/MaterialPickerDialog';

const SPRAY_FLUID_LABELS: Record<SprayFluidType, string> = {
  SEAWATER: 'Seawater',
  BRINE: 'Brine',
  PURE_WATER: 'Pure Water',
};

/** Special value for the dropdown meaning "pick from material database" */
const FROM_DATABASE = '__FROM_DATABASE__';

interface SingleTubeInputsProps {
  // Tube geometry
  tubeOD: string;
  wallThickness: string;
  tubeLength: string;
  tubeMaterialName: string;
  wallConductivity: string;
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
  onMaterialSelect: (name: string, conductivity: number, defaultWall?: number) => void;
  onWallConductivityChange: (v: string) => void;
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
  const [materialPickerOpen, setMaterialPickerOpen] = useState(false);

  // Determine which quick-select is active (or '' if from database / custom)
  const quickSelectValue =
    QUICK_SELECT_MATERIALS.find((m) => m.label === props.tubeMaterialName)?.label ?? '';

  const handleQuickSelect = (value: string) => {
    if (value === FROM_DATABASE) {
      setMaterialPickerOpen(true);
      return;
    }
    const mat = QUICK_SELECT_MATERIALS.find((m) => m.label === value);
    if (mat) {
      props.onMaterialSelect(mat.label, mat.conductivity, mat.defaultWallThickness);
    }
  };

  const handleMaterialPicked = (material: Material) => {
    const k = material.properties?.thermalConductivity;
    if (k && k > 0) {
      props.onMaterialSelect(material.name, k);
    } else {
      // Material exists but has no conductivity — set name, let user enter k manually
      props.onMaterialSelect(material.name, 0);
    }
    setMaterialPickerOpen(false);
  };

  return (
    <Stack spacing={2}>
      {/* --- Tube Geometry --- */}
      <Typography variant="subtitle2" color="text.secondary">
        Tube Geometry
      </Typography>

      <TextField
        select
        label="Tube Material"
        value={quickSelectValue || FROM_DATABASE}
        onChange={(e) => handleQuickSelect(e.target.value)}
        fullWidth
      >
        {QUICK_SELECT_MATERIALS.map((mat) => (
          <MenuItem key={mat.label} value={mat.label}>
            {mat.label} ({mat.conductivity} W/m&middot;K)
          </MenuItem>
        ))}
        <Divider />
        <MenuItem value={FROM_DATABASE}>
          <Stack direction="row" spacing={1} alignItems="center">
            <DbIcon fontSize="small" />
            <span>Select from Material Database...</span>
          </Stack>
        </MenuItem>
      </TextField>

      {/* Show picked material name if from DB and not matching quick-select */}
      {props.tubeMaterialName && !quickSelectValue && (
        <Chip
          label={`Material: ${props.tubeMaterialName}`}
          size="small"
          color="info"
          variant="outlined"
        />
      )}

      <Stack direction="row" spacing={2}>
        <TextField
          label="Wall Conductivity"
          value={props.wallConductivity}
          onChange={(e) => props.onWallConductivityChange(e.target.value)}
          type="number"
          fullWidth
          InputProps={{
            endAdornment: <InputAdornment position="end">W/(m&middot;K)</InputAdornment>,
          }}
          helperText="From material database or entered manually"
        />
      </Stack>

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

      {/* Material Database Picker */}
      <MaterialPickerDialog
        open={materialPickerOpen}
        onClose={() => setMaterialPickerOpen(false)}
        onSelect={(material) => handleMaterialPicked(material)}
        title="Select Tube Material"
      />
    </Stack>
  );
}
