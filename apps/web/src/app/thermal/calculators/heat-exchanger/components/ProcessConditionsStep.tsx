'use client';

/**
 * Step 2 — Process Conditions
 *
 * Two side-by-side panels for tube-side and shell-side fluid specification.
 * Auto-displays fluid properties and computed Q + LMTD summary.
 */

import { useMemo } from 'react';
import { Alert, Box, Divider, Grid, Stack, Typography } from '@mui/material';
import { TubeSidePanel, ShellSidePanel } from './FluidPanel';
import type { TubeSideValues, ShellSideValues } from './FluidPanel';
import { FluidPropertiesDisplay } from './FluidPropertiesDisplay';
import { getFluidProperties, getSaturationProperties } from '@/lib/thermal/fluidProperties';
import type { FluidProperties, SaturationFluidProperties } from '@/lib/thermal/fluidProperties';

interface ProcessConditionsStepProps {
  tubeSide: TubeSideValues;
  onTubeSideChange: (v: TubeSideValues) => void;
  shellSide: ShellSideValues;
  onShellSideChange: (v: ShellSideValues) => void;
  /** Computed values passed down from parent for display */
  heatDutyKW: number | null;
  lmtd: number | null;
}

export function ProcessConditionsStep({
  tubeSide,
  onTubeSideChange,
  shellSide,
  onShellSideChange,
  heatDutyKW,
  lmtd,
}: ProcessConditionsStepProps) {
  // Auto-populate tube-side properties at mean temperature
  const tubeProps: FluidProperties | null = useMemo(() => {
    const tIn = parseFloat(tubeSide.inletTemp);
    const tOut = parseFloat(tubeSide.outletTemp);
    const sal = parseFloat(tubeSide.salinity) || 0;
    if (isNaN(tIn) || isNaN(tOut)) return null;
    try {
      const meanT = (tIn + tOut) / 2;
      return getFluidProperties(tubeSide.fluid, meanT, sal);
    } catch {
      return null;
    }
  }, [tubeSide.fluid, tubeSide.salinity, tubeSide.inletTemp, tubeSide.outletTemp]);

  // Auto-populate shell-side properties at saturation temperature
  const shellProps: SaturationFluidProperties | null = useMemo(() => {
    const tSat = parseFloat(shellSide.saturationTemp);
    if (isNaN(tSat)) return null;
    try {
      return getSaturationProperties(tSat);
    } catch {
      return null;
    }
  }, [shellSide.saturationTemp]);

  const tubeMeanTemp = useMemo(() => {
    const tIn = parseFloat(tubeSide.inletTemp);
    const tOut = parseFloat(tubeSide.outletTemp);
    if (isNaN(tIn) || isNaN(tOut)) return null;
    return (tIn + tOut) / 2;
  }, [tubeSide.inletTemp, tubeSide.outletTemp]);

  return (
    <Box>
      <Typography variant="subtitle1" fontWeight="bold" gutterBottom>
        Process Conditions
      </Typography>
      <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
        Define tube-side and shell-side fluids. Properties are auto-populated from correlations.
      </Typography>

      <Grid container spacing={3}>
        {/* Tube Side */}
        <Grid size={{ xs: 12, md: 6 }}>
          <TubeSidePanel values={tubeSide} onChange={onTubeSideChange} />
          <FluidPropertiesDisplay
            label="Tube-side"
            properties={tubeProps}
            temperatureLabel={
              tubeMeanTemp !== null ? `${tubeMeanTemp.toFixed(1)}\u00B0C (mean)` : '\u2014'
            }
          />
        </Grid>

        {/* Shell Side */}
        <Grid size={{ xs: 12, md: 6 }}>
          <ShellSidePanel values={shellSide} onChange={onShellSideChange} />
          {shellProps && (
            <Box sx={{ bgcolor: 'action.hover', borderRadius: 1, p: 1.5, mt: 1 }}>
              <Typography variant="caption" color="text.secondary" fontWeight="bold">
                Condensate properties at {shellSide.saturationTemp}
                {'\u00B0C'} (sat.)
              </Typography>
              <Stack direction="row" spacing={2} sx={{ mt: 0.5, flexWrap: 'wrap' }}>
                <Typography variant="caption">
                  <strong>h_fg</strong> = {shellProps.latentHeat.toFixed(1)} kJ/kg
                </Typography>
                <Typography variant="caption">
                  <strong>{'\u03C1'}_l</strong> = {shellProps.density.toFixed(1)} kg/m{'\u00B3'}
                </Typography>
                <Typography variant="caption">
                  <strong>{'\u03C1'}_v</strong> = {shellProps.vaporDensity.toFixed(3)} kg/m
                  {'\u00B3'}
                </Typography>
                <Typography variant="caption">
                  <strong>k_l</strong> = {shellProps.thermalConductivity.toFixed(3)} W/(m{'\u00B7'}
                  K)
                </Typography>
              </Stack>
            </Box>
          )}
        </Grid>
      </Grid>

      {/* Computed Q & LMTD summary */}
      <Divider sx={{ my: 2 }} />
      {heatDutyKW !== null && lmtd !== null && lmtd > 0 ? (
        <Alert severity="success" sx={{ fontWeight: 'bold' }}>
          Q = {heatDutyKW.toFixed(1)} kW ({(heatDutyKW / 1000).toFixed(3)} MW)
          {' \u00A0\u00A0|\u00A0\u00A0 '}
          LMTD = {lmtd.toFixed(1)}
          {'\u00B0C'}
        </Alert>
      ) : (
        <Alert severity="info">
          Fill in all temperatures and flow rates to calculate Q and LMTD.
        </Alert>
      )}
    </Box>
  );
}
