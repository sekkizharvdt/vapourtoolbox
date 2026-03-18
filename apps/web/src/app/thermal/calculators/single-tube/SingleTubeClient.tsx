'use client';

import { useState, useMemo } from 'react';
import { Container, Typography, Box, Paper, Grid, Alert, Chip, Stack, Button } from '@mui/material';
import { RestartAlt as ResetIcon } from '@mui/icons-material';
import { CalculatorBreadcrumb } from '../components/CalculatorBreadcrumb';
import { calculateSingleTube, getDefaultWallThickness } from '@/lib/thermal';
import type { TubeMaterialKey, SprayFluidType } from '@vapour/types';
import { SingleTubeInputs, SingleTubeResults, SingleTubeDiagram } from './components';

export default function SingleTubeClient() {
  // --- Tube geometry state ---
  const [tubeOD, setTubeOD] = useState<string>('25.4');
  const [wallThickness, setWallThickness] = useState<string>('1.0');
  const [tubeLength, setTubeLength] = useState<string>('');
  const [tubeMaterial, setTubeMaterial] = useState<TubeMaterialKey>('al_5052');

  // --- Inside (vapour) state ---
  const [vapourTemperature, setVapourTemperature] = useState<string>('');
  const [vapourFlowRate, setVapourFlowRate] = useState<string>('');

  // --- Outside (spray) state ---
  const [sprayFluidType, setSprayFluidType] = useState<SprayFluidType>('SEAWATER');
  const [sprayTemperature, setSprayTemperature] = useState<string>('');
  const [spraySalinity, setSpraySalinity] = useState<string>('35000');
  const [sprayFlowRate, setSprayFlowRate] = useState<string>('');

  // --- Fouling ---
  const [insideFouling, setInsideFouling] = useState<string>('0.00009');
  const [outsideFouling, setOutsideFouling] = useState<string>('0.00009');

  // --- Material change handler (also updates default wall thickness) ---
  const handleMaterialChange = (mat: TubeMaterialKey) => {
    setTubeMaterial(mat);
    setWallThickness(getDefaultWallThickness(mat).toString());
  };

  // --- Spray fluid change (reset salinity if pure water) ---
  const handleSprayFluidChange = (fluid: SprayFluidType) => {
    setSprayFluidType(fluid);
    if (fluid === 'PURE_WATER') setSpraySalinity('0');
    else if (fluid === 'SEAWATER') setSpraySalinity('35000');
    else setSpraySalinity('50000');
  };

  const handleReset = () => {
    setTubeOD('25.4');
    setWallThickness('1.0');
    setTubeLength('');
    setTubeMaterial('al_5052');
    setVapourTemperature('');
    setVapourFlowRate('');
    setSprayFluidType('SEAWATER');
    setSprayTemperature('');
    setSpraySalinity('35000');
    setSprayFlowRate('');
    setInsideFouling('0.00009');
    setOutsideFouling('0.00009');
  };

  // --- Live calculation ---
  const computed = useMemo(() => {
    try {
      const od = parseFloat(tubeOD);
      const wall = parseFloat(wallThickness);
      const len = parseFloat(tubeLength);
      const vT = parseFloat(vapourTemperature);
      const vF = parseFloat(vapourFlowRate);
      const sT = parseFloat(sprayTemperature);
      const sal = parseFloat(spraySalinity);
      const sF = parseFloat(sprayFlowRate);
      const fi = parseFloat(insideFouling);
      const fo = parseFloat(outsideFouling);

      if ([od, wall, len, vT, vF, sT, sF].some((v) => isNaN(v) || v <= 0) || isNaN(sal) || sal < 0)
        return null;

      // Derive vapour pressure from temperature (saturation)
      // Use approximate Antoine equation: P_sat(mbar) from T(°C)
      // Not needed for the calculator — vapourPressure is informational
      const vapourPressure = 0; // placeholder, not used in calc

      return {
        result: calculateSingleTube({
          tubeOD: od,
          wallThickness: wall,
          tubeLength: len,
          tubeMaterial,
          vapourTemperature: vT,
          vapourPressure,
          vapourFlowRate: vF,
          sprayFluidType,
          sprayTemperature: sT,
          spraySalinity: sal,
          sprayFlowRate: sF,
          ...(fi > 0 && { insideFouling: fi }),
          ...(fo > 0 && { outsideFouling: fo }),
        }),
        error: null,
      };
    } catch (err) {
      return { result: null, error: err instanceof Error ? err.message : 'Calculation error' };
    }
  }, [
    tubeOD,
    wallThickness,
    tubeLength,
    tubeMaterial,
    vapourTemperature,
    vapourFlowRate,
    sprayFluidType,
    sprayTemperature,
    spraySalinity,
    sprayFlowRate,
    insideFouling,
    outsideFouling,
  ]);

  const result = computed?.result ?? null;
  const error = computed?.error ?? null;

  return (
    <Container maxWidth="xl" sx={{ py: 4 }}>
      <CalculatorBreadcrumb calculatorName="Single Tube Analysis" />

      <Box sx={{ mb: 4 }}>
        <Stack direction="row" alignItems="center" spacing={2} mb={1}>
          <Typography variant="h4" component="h1">
            Single Tube Analysis
          </Typography>
          <Chip label="Nusselt / Chun-Seban" size="small" color="primary" variant="outlined" />
        </Stack>
        <Typography variant="body2" color="text.secondary" sx={{ maxWidth: 700 }}>
          Analyse a single horizontal tube with vapour condensing inside and spray water evaporating
          on the outside. Calculates film thickness on both sides, heat transfer coefficients,
          overall U-value, and complete heat &amp; mass balance.
        </Typography>
      </Box>

      <Box sx={{ mb: 2, display: 'flex', justifyContent: 'flex-end' }}>
        <Button variant="outlined" startIcon={<ResetIcon />} onClick={handleReset} size="small">
          Reset
        </Button>
      </Box>

      <Grid container spacing={3}>
        {/* Left: Inputs */}
        <Grid size={{ xs: 12, md: 5 }}>
          <Paper sx={{ p: 3 }}>
            <SingleTubeInputs
              tubeOD={tubeOD}
              wallThickness={wallThickness}
              tubeLength={tubeLength}
              tubeMaterial={tubeMaterial}
              vapourTemperature={vapourTemperature}
              vapourFlowRate={vapourFlowRate}
              sprayFluidType={sprayFluidType}
              sprayTemperature={sprayTemperature}
              spraySalinity={spraySalinity}
              sprayFlowRate={sprayFlowRate}
              insideFouling={insideFouling}
              outsideFouling={outsideFouling}
              onTubeODChange={setTubeOD}
              onWallThicknessChange={setWallThickness}
              onTubeLengthChange={setTubeLength}
              onTubeMaterialChange={handleMaterialChange}
              onVapourTemperatureChange={setVapourTemperature}
              onVapourFlowRateChange={setVapourFlowRate}
              onSprayFluidTypeChange={handleSprayFluidChange}
              onSprayTemperatureChange={setSprayTemperature}
              onSpraySalinityChange={setSpraySalinity}
              onSprayFlowRateChange={setSprayFlowRate}
              onInsideFoulingChange={setInsideFouling}
              onOutsideFoulingChange={setOutsideFouling}
            />
          </Paper>
        </Grid>

        {/* Right: Diagram + Results */}
        <Grid size={{ xs: 12, md: 7 }}>
          <SingleTubeDiagram result={result} />

          <Box sx={{ mt: 3 }}>
            {error && (
              <Alert severity="error" sx={{ mb: 2 }}>
                {error}
              </Alert>
            )}

            {result ? (
              <SingleTubeResults result={result} />
            ) : (
              !error && (
                <Paper sx={{ p: 4, textAlign: 'center' }}>
                  <Typography color="text.secondary">
                    Enter all inputs to see results. Calculations update live.
                  </Typography>
                </Paper>
              )
            )}
          </Box>
        </Grid>
      </Grid>
    </Container>
  );
}
