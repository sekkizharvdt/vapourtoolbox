'use client';

import {
  TextField,
  InputAdornment,
  Stack,
  Typography,
  ToggleButton,
  ToggleButtonGroup,
} from '@mui/material';

interface TubeSideInputsProps {
  density: string;
  velocity: string;
  tubeID: string;
  viscosity: string;
  specificHeat: string;
  conductivity: string;
  isHeating: boolean;
  onDensityChange: (value: string) => void;
  onVelocityChange: (value: string) => void;
  onTubeIDChange: (value: string) => void;
  onViscosityChange: (value: string) => void;
  onSpecificHeatChange: (value: string) => void;
  onConductivityChange: (value: string) => void;
  onIsHeatingChange: (value: boolean) => void;
}

export function TubeSideInputs({
  density,
  velocity,
  tubeID,
  viscosity,
  specificHeat,
  conductivity,
  isHeating,
  onDensityChange,
  onVelocityChange,
  onTubeIDChange,
  onViscosityChange,
  onSpecificHeatChange,
  onConductivityChange,
  onIsHeatingChange,
}: TubeSideInputsProps) {
  return (
    <Stack spacing={2}>
      <Typography variant="subtitle2" color="text.secondary">
        Fluid Properties
      </Typography>

      <TextField
        label="Fluid Density"
        value={density}
        onChange={(e) => onDensityChange(e.target.value)}
        type="number"
        fullWidth
        InputProps={{
          endAdornment: <InputAdornment position="end">kg/m³</InputAdornment>,
        }}
      />

      <TextField
        label="Flow Velocity"
        value={velocity}
        onChange={(e) => onVelocityChange(e.target.value)}
        type="number"
        fullWidth
        InputProps={{
          endAdornment: <InputAdornment position="end">m/s</InputAdornment>,
        }}
      />

      <TextField
        label="Tube Inner Diameter"
        value={tubeID}
        onChange={(e) => onTubeIDChange(e.target.value)}
        type="number"
        fullWidth
        InputProps={{
          endAdornment: <InputAdornment position="end">mm</InputAdornment>,
        }}
      />

      <TextField
        label="Dynamic Viscosity"
        value={viscosity}
        onChange={(e) => onViscosityChange(e.target.value)}
        type="number"
        fullWidth
        InputProps={{
          endAdornment: <InputAdornment position="end">Pa·s</InputAdornment>,
        }}
      />

      <TextField
        label="Specific Heat"
        value={specificHeat}
        onChange={(e) => onSpecificHeatChange(e.target.value)}
        type="number"
        fullWidth
        InputProps={{
          endAdornment: <InputAdornment position="end">kJ/(kg·K)</InputAdornment>,
        }}
      />

      <TextField
        label="Thermal Conductivity"
        value={conductivity}
        onChange={(e) => onConductivityChange(e.target.value)}
        type="number"
        fullWidth
        InputProps={{
          endAdornment: <InputAdornment position="end">W/(m·K)</InputAdornment>,
        }}
      />

      <Typography variant="subtitle2" color="text.secondary">
        Process
      </Typography>

      <ToggleButtonGroup
        value={isHeating ? 'heating' : 'cooling'}
        exclusive
        onChange={(_, v) => v && onIsHeatingChange(v === 'heating')}
        fullWidth
        size="small"
      >
        <ToggleButton value="heating">Heating</ToggleButton>
        <ToggleButton value="cooling">Cooling</ToggleButton>
      </ToggleButtonGroup>
    </Stack>
  );
}
