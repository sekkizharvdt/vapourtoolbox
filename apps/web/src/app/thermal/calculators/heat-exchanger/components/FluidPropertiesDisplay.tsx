'use client';

/**
 * Read-only display of auto-populated fluid properties at a given temperature.
 * Shows density, Cp, viscosity, and thermal conductivity.
 */

import { Box, Stack, Typography } from '@mui/material';
import type { FluidProperties } from '@/lib/thermal/fluidProperties';

interface FluidPropertiesDisplayProps {
  label: string;
  properties: FluidProperties | null;
  temperatureLabel: string;
}

export function FluidPropertiesDisplay({
  label,
  properties,
  temperatureLabel,
}: FluidPropertiesDisplayProps) {
  if (!properties) return null;

  return (
    <Box
      sx={{
        bgcolor: 'action.hover',
        borderRadius: 1,
        p: 1.5,
        mt: 1,
      }}
    >
      <Typography variant="caption" color="text.secondary" fontWeight="bold">
        {label} properties at {temperatureLabel}
      </Typography>
      <Stack direction="row" spacing={2} sx={{ mt: 0.5, flexWrap: 'wrap' }}>
        <PropChip label={'\u03C1'} value={properties.density.toFixed(1)} unit="kg/m\u00B3" />
        <PropChip
          label="C\u209A"
          value={properties.specificHeat.toFixed(3)}
          unit="kJ/(kg\u00B7K)"
        />
        <PropChip
          label={'\u03BC'}
          value={(properties.viscosity * 1000).toFixed(3)}
          unit="mPa\u00B7s"
        />
        <PropChip label="k" value={properties.thermalConductivity.toFixed(3)} unit="W/(m\u00B7K)" />
      </Stack>
    </Box>
  );
}

function PropChip({ label, value, unit }: { label: string; value: string; unit: string }) {
  return (
    <Typography variant="caption" sx={{ whiteSpace: 'nowrap' }}>
      <strong>{label}</strong> = {value} {unit}
    </Typography>
  );
}
