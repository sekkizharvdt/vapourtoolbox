'use client';

import { useState, useMemo } from 'react';
import { Container, Typography, Box, Paper, Grid, Alert, Chip, Stack, Button } from '@mui/material';
import {
  RestartAlt as ResetIcon,
  Save as SaveIcon,
  FolderOpen as FolderOpenIcon,
} from '@mui/icons-material';
import { CalculatorBreadcrumb } from '../components/CalculatorBreadcrumb';
import { calculateSingleTube } from '@/lib/thermal';
import type { SprayFluidType } from '@vapour/types';
import { SingleTubeInputs, SingleTubeResults, SingleTubeDiagram } from './components';
import { SaveCalculationDialog } from './components/SaveCalculationDialog';
import { LoadCalculationDialog } from './components/LoadCalculationDialog';

export default function SingleTubeClient() {
  // --- Tube geometry state ---
  const [tubeOD, setTubeOD] = useState<string>('25.4');
  const [wallThickness, setWallThickness] = useState<string>('1.0');
  const [tubeLength, setTubeLength] = useState<string>('');
  const [tubeMaterialName, setTubeMaterialName] = useState<string>('Aluminium 5052');
  const [wallConductivity, setWallConductivity] = useState<string>('138');

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

  // --- Save/Load ---
  const [saveOpen, setSaveOpen] = useState(false);
  const [loadOpen, setLoadOpen] = useState(false);

  // --- Material selection handler (from quick-select or database) ---
  const handleMaterialSelect = (name: string, conductivity: number, defaultWall?: number) => {
    setTubeMaterialName(name);
    if (conductivity > 0) {
      setWallConductivity(conductivity.toString());
    }
    if (defaultWall !== undefined) {
      setWallThickness(defaultWall.toString());
    }
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
    setTubeMaterialName('Aluminium 5052');
    setWallConductivity('138');
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
      const k = parseFloat(wallConductivity);
      const vT = parseFloat(vapourTemperature);
      const vF = parseFloat(vapourFlowRate);
      const sT = parseFloat(sprayTemperature);
      const sal = parseFloat(spraySalinity);
      const sF = parseFloat(sprayFlowRate);
      const fi = parseFloat(insideFouling);
      const fo = parseFloat(outsideFouling);

      if (
        [od, wall, len, k, vT, vF, sT, sF].some((v) => isNaN(v) || v <= 0) ||
        isNaN(sal) ||
        sal < 0
      )
        return null;

      return {
        result: calculateSingleTube({
          tubeOD: od,
          wallThickness: wall,
          tubeLength: len,
          tubeMaterial: tubeMaterialName,
          wallConductivity: k,
          vapourTemperature: vT,
          vapourPressure: 0, // informational, not used in calc
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
    tubeMaterialName,
    wallConductivity,
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

      <Box sx={{ mb: 2, display: 'flex', justifyContent: 'flex-end', gap: 1 }}>
        <Button
          variant="outlined"
          startIcon={<FolderOpenIcon />}
          onClick={() => setLoadOpen(true)}
          size="small"
        >
          Load
        </Button>
        <Button
          variant="outlined"
          startIcon={<SaveIcon />}
          onClick={() => setSaveOpen(true)}
          size="small"
          disabled={!result}
        >
          Save
        </Button>
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
              tubeMaterialName={tubeMaterialName}
              wallConductivity={wallConductivity}
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
              onMaterialSelect={handleMaterialSelect}
              onWallConductivityChange={setWallConductivity}
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

      {/* Save/Load Dialogs */}
      <SaveCalculationDialog
        open={saveOpen}
        onClose={() => setSaveOpen(false)}
        calculatorType="SINGLE_TUBE"
        inputs={{
          tubeOD,
          wallThickness,
          tubeLength,
          tubeMaterialName,
          wallConductivity,
          vapourTemperature,
          vapourFlowRate,
          sprayFluidType,
          sprayTemperature,
          spraySalinity,
          sprayFlowRate,
          insideFouling,
          outsideFouling,
        }}
      />
      <LoadCalculationDialog
        open={loadOpen}
        onClose={() => setLoadOpen(false)}
        calculatorType="SINGLE_TUBE"
        onLoad={(inputs) => {
          if (typeof inputs.tubeOD === 'string') setTubeOD(inputs.tubeOD);
          if (typeof inputs.wallThickness === 'string') setWallThickness(inputs.wallThickness);
          if (typeof inputs.tubeLength === 'string') setTubeLength(inputs.tubeLength);
          if (typeof inputs.tubeMaterialName === 'string')
            setTubeMaterialName(inputs.tubeMaterialName);
          if (typeof inputs.wallConductivity === 'string')
            setWallConductivity(inputs.wallConductivity);
          if (typeof inputs.vapourTemperature === 'string')
            setVapourTemperature(inputs.vapourTemperature);
          if (typeof inputs.vapourFlowRate === 'string') setVapourFlowRate(inputs.vapourFlowRate);
          if (
            inputs.sprayFluidType === 'SEAWATER' ||
            inputs.sprayFluidType === 'BRINE' ||
            inputs.sprayFluidType === 'PURE_WATER'
          )
            setSprayFluidType(inputs.sprayFluidType);
          if (typeof inputs.sprayTemperature === 'string')
            setSprayTemperature(inputs.sprayTemperature);
          if (typeof inputs.spraySalinity === 'string') setSpraySalinity(inputs.spraySalinity);
          if (typeof inputs.sprayFlowRate === 'string') setSprayFlowRate(inputs.sprayFlowRate);
          if (typeof inputs.insideFouling === 'string') setInsideFouling(inputs.insideFouling);
          if (typeof inputs.outsideFouling === 'string') setOutsideFouling(inputs.outsideFouling);
        }}
      />
    </Container>
  );
}
