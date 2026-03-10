'use client';

/**
 * Step 2 -- Process Conditions
 *
 * Two side-by-side panels for tube-side and shell-side fluid specification.
 * Shell-side panel varies by exchanger type:
 *   - CONDENSER: condensing steam (mass flow + saturation temp)
 *   - EVAPORATOR: boiling liquid (mass flow + saturation temp)
 *   - LIQUID_LIQUID: sensible fluid (type + flow + inlet/outlet temps)
 *
 * Auto-displays fluid properties and computed Q + LMTD summary.
 */

import { useMemo } from 'react';
import { Alert, Box, Divider, Grid, Stack, Typography } from '@mui/material';
import {
  TubeSidePanel,
  ShellSidePanel,
  ShellSideBoilingPanel,
  ShellSideSensiblePanel,
} from './FluidPanel';
import type {
  TubeSideValues,
  ShellSideCondensingValues,
  ShellSideBoilingValues,
  ShellSideSensibleValues,
} from './FluidPanel';
import { FluidPropertiesDisplay } from './FluidPropertiesDisplay';
import { getFluidProperties, getSaturationProperties } from '@/lib/thermal/fluidProperties';
import type { FluidProperties, SaturationFluidProperties } from '@/lib/thermal/fluidProperties';
import type { ExchangerTypeId } from './ExchangerTypeSelector';

interface ProcessConditionsStepProps {
  exchangerType: ExchangerTypeId;
  tubeSide: TubeSideValues;
  onTubeSideChange: (v: TubeSideValues) => void;
  /** Shell-side for CONDENSER */
  shellSideCondensing: ShellSideCondensingValues;
  onShellSideCondensingChange: (v: ShellSideCondensingValues) => void;
  /** Shell-side for EVAPORATOR */
  shellSideBoiling: ShellSideBoilingValues;
  onShellSideBoilingChange: (v: ShellSideBoilingValues) => void;
  /** Shell-side for LIQUID_LIQUID */
  shellSideSensible: ShellSideSensibleValues;
  onShellSideSensibleChange: (v: ShellSideSensibleValues) => void;
  /** Computed values passed down from parent for display */
  heatDutyKW: number | null;
  lmtd: number | null;
}

export function ProcessConditionsStep({
  exchangerType,
  tubeSide,
  onTubeSideChange,
  shellSideCondensing,
  onShellSideCondensingChange,
  shellSideBoiling,
  onShellSideBoilingChange,
  shellSideSensible,
  onShellSideSensibleChange,
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

  // Auto-populate shell-side saturation properties (for CONDENSER/EVAPORATOR)
  const shellSatProps: SaturationFluidProperties | null = useMemo(() => {
    if (exchangerType === 'LIQUID_LIQUID') return null;
    const satTemp =
      exchangerType === 'CONDENSER'
        ? shellSideCondensing.saturationTemp
        : shellSideBoiling.saturationTemp;
    const tSat = parseFloat(satTemp);
    if (isNaN(tSat)) return null;
    try {
      return getSaturationProperties(tSat);
    } catch {
      return null;
    }
  }, [exchangerType, shellSideCondensing.saturationTemp, shellSideBoiling.saturationTemp]);

  // Auto-populate shell-side liquid properties (for LIQUID_LIQUID)
  const shellLiquidProps: FluidProperties | null = useMemo(() => {
    if (exchangerType !== 'LIQUID_LIQUID') return null;
    const tIn = parseFloat(shellSideSensible.inletTemp);
    const tOut = parseFloat(shellSideSensible.outletTemp);
    const sal = parseFloat(shellSideSensible.salinity) || 0;
    if (isNaN(tIn) || isNaN(tOut)) return null;
    try {
      const meanT = (tIn + tOut) / 2;
      return getFluidProperties(shellSideSensible.fluid, meanT, sal);
    } catch {
      return null;
    }
  }, [
    exchangerType,
    shellSideSensible.fluid,
    shellSideSensible.salinity,
    shellSideSensible.inletTemp,
    shellSideSensible.outletTemp,
  ]);

  const tubeMeanTemp = useMemo(() => {
    const tIn = parseFloat(tubeSide.inletTemp);
    const tOut = parseFloat(tubeSide.outletTemp);
    if (isNaN(tIn) || isNaN(tOut)) return null;
    return (tIn + tOut) / 2;
  }, [tubeSide.inletTemp, tubeSide.outletTemp]);

  const shellMeanTemp = useMemo(() => {
    if (exchangerType !== 'LIQUID_LIQUID') return null;
    const tIn = parseFloat(shellSideSensible.inletTemp);
    const tOut = parseFloat(shellSideSensible.outletTemp);
    if (isNaN(tIn) || isNaN(tOut)) return null;
    return (tIn + tOut) / 2;
  }, [exchangerType, shellSideSensible.inletTemp, shellSideSensible.outletTemp]);

  // Tube-side label depends on exchanger type
  const tubeSideLabel =
    exchangerType === 'EVAPORATOR' ? 'Tube Side (Heating Fluid)' : 'Tube Side (Cooling Fluid)';

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
          <TubeSidePanel values={tubeSide} onChange={onTubeSideChange} label={tubeSideLabel} />
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
          {exchangerType === 'CONDENSER' && (
            <>
              <ShellSidePanel values={shellSideCondensing} onChange={onShellSideCondensingChange} />
              {shellSatProps && (
                <SaturationPropsDisplay
                  label="Condensate"
                  satTemp={shellSideCondensing.saturationTemp}
                  props={shellSatProps}
                />
              )}
            </>
          )}

          {exchangerType === 'EVAPORATOR' && (
            <>
              <ShellSideBoilingPanel
                values={shellSideBoiling}
                onChange={onShellSideBoilingChange}
              />
              {shellSatProps && (
                <SaturationPropsDisplay
                  label="Boiling liquid"
                  satTemp={shellSideBoiling.saturationTemp}
                  props={shellSatProps}
                />
              )}
            </>
          )}

          {exchangerType === 'LIQUID_LIQUID' && (
            <>
              <ShellSideSensiblePanel
                values={shellSideSensible}
                onChange={onShellSideSensibleChange}
              />
              <FluidPropertiesDisplay
                label="Shell-side"
                properties={shellLiquidProps}
                temperatureLabel={
                  shellMeanTemp !== null ? `${shellMeanTemp.toFixed(1)}\u00B0C (mean)` : '\u2014'
                }
              />
            </>
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

// -- Shared saturation properties display --

function SaturationPropsDisplay({
  label,
  satTemp,
  props,
}: {
  label: string;
  satTemp: string;
  props: SaturationFluidProperties;
}) {
  return (
    <Box sx={{ bgcolor: 'action.hover', borderRadius: 1, p: 1.5, mt: 1 }}>
      <Typography variant="caption" color="text.secondary" fontWeight="bold">
        {label} properties at {satTemp}
        {'\u00B0C'} (sat.)
      </Typography>
      <Stack direction="row" spacing={2} sx={{ mt: 0.5, flexWrap: 'wrap' }}>
        <Typography variant="caption">
          <strong>h_fg</strong> = {props.latentHeat.toFixed(1)} kJ/kg
        </Typography>
        <Typography variant="caption">
          <strong>{'\u03C1'}_l</strong> = {props.density.toFixed(1)} kg/m{'\u00B3'}
        </Typography>
        <Typography variant="caption">
          <strong>{'\u03C1'}_v</strong> = {props.vaporDensity.toFixed(3)} kg/m
          {'\u00B3'}
        </Typography>
        <Typography variant="caption">
          <strong>k_l</strong> = {props.thermalConductivity.toFixed(3)} W/(m{'\u00B7'}
          K)
        </Typography>
      </Stack>
    </Box>
  );
}
