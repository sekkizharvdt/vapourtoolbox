'use client';

import {
  TextField,
  InputAdornment,
  Stack,
  Typography,
  ToggleButton,
  ToggleButtonGroup,
} from '@mui/material';

interface CondensationInputsProps {
  liquidDensity: string;
  vaporDensity: string;
  latentHeat: string;
  liquidConductivity: string;
  liquidViscosity: string;
  dimension: string;
  deltaT: string;
  orientation: 'vertical' | 'horizontal';
  onLiquidDensityChange: (value: string) => void;
  onVaporDensityChange: (value: string) => void;
  onLatentHeatChange: (value: string) => void;
  onLiquidConductivityChange: (value: string) => void;
  onLiquidViscosityChange: (value: string) => void;
  onDimensionChange: (value: string) => void;
  onDeltaTChange: (value: string) => void;
  onOrientationChange: (value: 'vertical' | 'horizontal') => void;
}

export function CondensationInputs({
  liquidDensity,
  vaporDensity,
  latentHeat,
  liquidConductivity,
  liquidViscosity,
  dimension,
  deltaT,
  orientation,
  onLiquidDensityChange,
  onVaporDensityChange,
  onLatentHeatChange,
  onLiquidConductivityChange,
  onLiquidViscosityChange,
  onDimensionChange,
  onDeltaTChange,
  onOrientationChange,
}: CondensationInputsProps) {
  return (
    <Stack spacing={2}>
      <Typography variant="subtitle2" color="text.secondary">
        Fluid Properties
      </Typography>

      <TextField
        label="Liquid Density"
        value={liquidDensity}
        onChange={(e) => onLiquidDensityChange(e.target.value)}
        type="number"
        fullWidth
        InputProps={{
          endAdornment: <InputAdornment position="end">kg/m³</InputAdornment>,
        }}
      />

      <TextField
        label="Vapor Density"
        value={vaporDensity}
        onChange={(e) => onVaporDensityChange(e.target.value)}
        type="number"
        fullWidth
        InputProps={{
          endAdornment: <InputAdornment position="end">kg/m³</InputAdornment>,
        }}
      />

      <TextField
        label="Latent Heat of Vaporization"
        value={latentHeat}
        onChange={(e) => onLatentHeatChange(e.target.value)}
        type="number"
        fullWidth
        InputProps={{
          endAdornment: <InputAdornment position="end">kJ/kg</InputAdornment>,
        }}
      />

      <TextField
        label="Liquid Thermal Conductivity"
        value={liquidConductivity}
        onChange={(e) => onLiquidConductivityChange(e.target.value)}
        type="number"
        fullWidth
        InputProps={{
          endAdornment: <InputAdornment position="end">W/(m·K)</InputAdornment>,
        }}
      />

      <TextField
        label="Liquid Dynamic Viscosity"
        value={liquidViscosity}
        onChange={(e) => onLiquidViscosityChange(e.target.value)}
        type="number"
        fullWidth
        InputProps={{
          endAdornment: <InputAdornment position="end">Pa·s</InputAdornment>,
        }}
      />

      <Typography variant="subtitle2" color="text.secondary">
        Geometry &amp; Conditions
      </Typography>

      <ToggleButtonGroup
        value={orientation}
        exclusive
        onChange={(_, v) => v && onOrientationChange(v as 'vertical' | 'horizontal')}
        fullWidth
        size="small"
      >
        <ToggleButton value="vertical">Vertical</ToggleButton>
        <ToggleButton value="horizontal">Horizontal</ToggleButton>
      </ToggleButtonGroup>

      <TextField
        label={orientation === 'vertical' ? 'Tube Length' : 'Tube Outer Diameter'}
        value={dimension}
        onChange={(e) => onDimensionChange(e.target.value)}
        type="number"
        fullWidth
        helperText={
          orientation === 'vertical'
            ? 'Characteristic dimension for vertical tubes'
            : 'Characteristic dimension for horizontal tubes'
        }
        InputProps={{
          endAdornment: <InputAdornment position="end">m</InputAdornment>,
        }}
      />

      <TextField
        label="Temperature Difference (Tsat - Twall)"
        value={deltaT}
        onChange={(e) => onDeltaTChange(e.target.value)}
        type="number"
        fullWidth
        InputProps={{
          endAdornment: <InputAdornment position="end">°C</InputAdornment>,
        }}
      />
    </Stack>
  );
}
