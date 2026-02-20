'use client';

import { useState, useMemo } from 'react';
import { Container, Typography, Box, Grid, Stack, Chip, Paper, Alert } from '@mui/material';
import {
  calculateSiphonSizing,
  type SiphonSizingInput,
  type SiphonSizingResult,
  type SiphonFluidType,
  type PressureUnit,
  type ElbowConfig,
} from '@/lib/thermal/siphonSizingCalculator';
import { getSeawaterDensity, getDensityLiquid, mbarAbsToBar } from '@vapour/constants';
import { SiphonInputs } from './components/SiphonInputs';
import { SiphonResults } from './components/SiphonResults';
import { PRESSURE_UNIT_LABELS } from './components/types';

export default function SiphonSizingClient() {
  // Pressure state
  const [upstreamPressure, setUpstreamPressure] = useState<string>('300');
  const [downstreamPressure, setDownstreamPressure] = useState<string>('250');
  const [pressureUnit, setPressureUnit] = useState<PressureUnit>('mbar_abs');

  // Fluid state
  const [fluidType, setFluidType] = useState<SiphonFluidType>('seawater');
  const [temperature, setTemperature] = useState<string>('65');
  const [salinity, setSalinity] = useState<string>('35000');

  // Flow state
  const [flowRate, setFlowRate] = useState<string>('100');

  // Geometry state
  const [elbowConfig, setElbowConfig] = useState<ElbowConfig>('2_elbows');
  const [horizontalDistance, setHorizontalDistance] = useState<string>('3');
  const [offsetDistance, setOffsetDistance] = useState<string>('1.5');

  // Safety state
  const [safetyFactor, setSafetyFactor] = useState<string>('20');

  // Error state
  const [error, setError] = useState<string | null>(null);

  // Computed fluid density for display
  const fluidDensity = useMemo(() => {
    const temp = parseFloat(temperature);
    const sal = parseFloat(salinity);
    if (isNaN(temp) || temp <= 0) return null;
    try {
      if (fluidType === 'distillate') {
        return getDensityLiquid(temp);
      }
      if (isNaN(sal) || sal < 0) return null;
      return getSeawaterDensity(sal, temp);
    } catch {
      return null;
    }
  }, [fluidType, temperature, salinity]);

  // Computed pressure difference display
  const pressureDiffDisplay = useMemo(() => {
    const up = parseFloat(upstreamPressure);
    const down = parseFloat(downstreamPressure);
    if (isNaN(up) || isNaN(down) || up <= down) return '';

    const diff = up - down;
    const unitLabel = PRESSURE_UNIT_LABELS[pressureUnit];

    // Also show in bar for reference
    let diffBar: number;
    switch (pressureUnit) {
      case 'mbar_abs':
        diffBar = mbarAbsToBar(diff);
        break;
      case 'bar_abs':
        diffBar = diff;
        break;
      case 'kpa_abs':
        diffBar = diff / 100;
        break;
    }

    return `\u0394P = ${diff.toFixed(1)} ${unitLabel} (${diffBar.toFixed(4)} bar)`;
  }, [upstreamPressure, downstreamPressure, pressureUnit]);

  // Main calculation
  const result: SiphonSizingResult | null = useMemo(() => {
    setError(null);
    try {
      const up = parseFloat(upstreamPressure);
      const down = parseFloat(downstreamPressure);
      const temp = parseFloat(temperature);
      const sal = parseFloat(salinity);
      const flow = parseFloat(flowRate);
      const hDist = parseFloat(horizontalDistance);
      const oDist = parseFloat(offsetDistance);
      const sf = parseFloat(safetyFactor);

      // Basic validation before calling calculator
      if (isNaN(up) || isNaN(down) || isNaN(temp) || isNaN(flow) || isNaN(hDist) || isNaN(sf)) {
        return null;
      }
      if ((fluidType === 'seawater' || fluidType === 'brine') && isNaN(sal)) {
        return null;
      }
      if (elbowConfig === '3_elbows' && isNaN(oDist)) {
        return null;
      }
      if (up <= down) return null;

      const input: SiphonSizingInput = {
        upstreamPressure: up,
        downstreamPressure: down,
        pressureUnit,
        fluidType,
        fluidTemperature: temp,
        salinity: fluidType === 'distillate' ? 0 : sal,
        flowRate: flow,
        elbowConfig,
        horizontalDistance: hDist,
        offsetDistance: elbowConfig === '3_elbows' ? oDist : 0,
        safetyFactor: sf,
      };

      return calculateSiphonSizing(input);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Calculation error');
      return null;
    }
  }, [
    upstreamPressure,
    downstreamPressure,
    pressureUnit,
    fluidType,
    temperature,
    salinity,
    flowRate,
    elbowConfig,
    horizontalDistance,
    offsetDistance,
    safetyFactor,
  ]);

  return (
    <Container maxWidth="xl" sx={{ py: 4 }}>
      {/* Header */}
      <Box sx={{ mb: 4 }}>
        <Stack direction="row" alignItems="center" spacing={2} mb={1}>
          <Typography variant="h4" component="h1">
            Siphon Sizing Calculator
          </Typography>
          <Chip label="Darcy-Weisbach" size="small" color="primary" variant="outlined" />
        </Stack>
        <Typography variant="body1" color="text.secondary">
          Size inter-effect siphon pipes for MED thermal desalination plants. Calculates pipe size,
          minimum U-bend height, pressure drop, and flash vapor at the downstream effect.
        </Typography>
      </Box>

      {/* Main Content */}
      <Grid container spacing={3}>
        {/* Left: Inputs */}
        <Grid size={{ xs: 12, md: 5 }}>
          <Paper sx={{ p: 3 }}>
            <Typography variant="h6" gutterBottom>
              Input Parameters
            </Typography>
            <SiphonInputs
              upstreamPressure={upstreamPressure}
              downstreamPressure={downstreamPressure}
              pressureUnit={pressureUnit}
              onUpstreamPressureChange={setUpstreamPressure}
              onDownstreamPressureChange={setDownstreamPressure}
              onPressureUnitChange={setPressureUnit}
              fluidType={fluidType}
              temperature={temperature}
              salinity={salinity}
              onFluidTypeChange={setFluidType}
              onTemperatureChange={setTemperature}
              onSalinityChange={setSalinity}
              flowRate={flowRate}
              onFlowRateChange={setFlowRate}
              elbowConfig={elbowConfig}
              horizontalDistance={horizontalDistance}
              offsetDistance={offsetDistance}
              onElbowConfigChange={setElbowConfig}
              onHorizontalDistanceChange={setHorizontalDistance}
              onOffsetDistanceChange={setOffsetDistance}
              safetyFactor={safetyFactor}
              onSafetyFactorChange={setSafetyFactor}
              fluidDensity={fluidDensity}
              pressureDiffDisplay={pressureDiffDisplay}
            />
          </Paper>
          {error && (
            <Alert severity="error" sx={{ mt: 2 }}>
              {error}
            </Alert>
          )}
        </Grid>

        {/* Right: Results */}
        <Grid size={{ xs: 12, md: 7 }}>
          {result ? (
            <SiphonResults result={result} />
          ) : (
            !error && (
              <Paper
                sx={{
                  p: 6,
                  textAlign: 'center',
                  bgcolor: 'action.hover',
                  borderRadius: 2,
                }}
              >
                <Typography variant="h6" color="text.secondary" gutterBottom>
                  Enter parameters to calculate siphon sizing
                </Typography>
                <Typography variant="body2" color="text.secondary">
                  Provide effect pressures, fluid properties, flow rate, and pipe geometry to
                  calculate pipe size, minimum siphon height, and flash vapor.
                </Typography>
              </Paper>
            )
          )}
        </Grid>
      </Grid>

      {/* Info Section */}
      <Box sx={{ mt: 4, p: 3, bgcolor: 'action.hover', borderRadius: 2 }}>
        <Typography variant="subtitle2" gutterBottom>
          How It Works
        </Typography>
        <Typography variant="body2" color="text.secondary" paragraph>
          Siphons are U-shaped pipes connecting two effects in a MED plant operating at different
          sub-atmospheric pressures. The liquid column in the U-bend creates a seal that prevents
          vapor from passing between effects.
        </Typography>
        <Typography variant="body2" color="text.secondary" paragraph>
          <strong>Minimum height</strong> = Static head (&Delta;P / &rho;g) + Friction losses
          (Darcy-Weisbach) + Safety margin. The safety factor (min. 20%) accounts for transient
          pressure fluctuations during operation.
        </Typography>
        <Typography variant="body2" color="text.secondary">
          <strong>Flash vapor</strong> occurs when the liquid temperature exceeds the saturation
          temperature at the downstream pressure. The flash fraction is calculated using an enthalpy
          balance across the downstream effect entry point.
        </Typography>
      </Box>
    </Container>
  );
}
