'use client';

/**
 * Heat Transfer Coefficients Calculator
 *
 * Calculate tube-side (Dittus-Boelter), condensation (Nusselt film),
 * and overall heat transfer coefficients for heat exchanger design.
 */

import { useState, useMemo } from 'react';
import {
  Container,
  Typography,
  Box,
  Paper,
  Grid,
  Alert,
  Divider,
  Chip,
  Stack,
  ToggleButton,
  ToggleButtonGroup,
} from '@mui/material';
import { CalculatorBreadcrumb } from '../components/CalculatorBreadcrumb';
import {
  calculateTubeSideHTC,
  calculateNusseltCondensation,
  calculateOverallHTC,
} from '@/lib/thermal';
import {
  type HTCMode,
  TubeSideInputs,
  TubeSideResult,
  CondensationInputs,
  CondensationResult,
  OverallHTCInputs,
  OverallHTCResult,
} from './components';

export default function HeatTransferClient() {
  // Mode
  const [mode, setMode] = useState<HTCMode>('tube-side');

  // Tube-side inputs
  const [tsDensity, setTsDensity] = useState<string>('');
  const [tsVelocity, setTsVelocity] = useState<string>('');
  const [tsTubeID, setTsTubeID] = useState<string>('');
  const [tsViscosity, setTsViscosity] = useState<string>('');
  const [tsSpecificHeat, setTsSpecificHeat] = useState<string>('');
  const [tsConductivity, setTsConductivity] = useState<string>('');
  const [tsIsHeating, setTsIsHeating] = useState<boolean>(true);

  // Condensation inputs
  const [condLiquidDensity, setCondLiquidDensity] = useState<string>('');
  const [condVaporDensity, setCondVaporDensity] = useState<string>('');
  const [condLatentHeat, setCondLatentHeat] = useState<string>('');
  const [condLiquidConductivity, setCondLiquidConductivity] = useState<string>('');
  const [condLiquidViscosity, setCondLiquidViscosity] = useState<string>('');
  const [condDimension, setCondDimension] = useState<string>('');
  const [condDeltaT, setCondDeltaT] = useState<string>('');
  const [condOrientation, setCondOrientation] = useState<'vertical' | 'horizontal'>('horizontal');

  // Overall HTC inputs
  const [overallTubeSideHTC, setOverallTubeSideHTC] = useState<string>('');
  const [overallShellSideHTC, setOverallShellSideHTC] = useState<string>('');
  const [overallTubeOD, setOverallTubeOD] = useState<string>('');
  const [overallTubeID, setOverallTubeID] = useState<string>('');
  const [overallWallConductivity, setOverallWallConductivity] = useState<string>('');
  const [overallTubeSideFouling, setOverallTubeSideFouling] = useState<string>('');
  const [overallShellSideFouling, setOverallShellSideFouling] = useState<string>('');

  const [error, setError] = useState<string | null>(null);

  // Calculate tube-side HTC
  const tubeSideResult = useMemo(() => {
    if (mode !== 'tube-side') return null;
    setError(null);

    try {
      const density = parseFloat(tsDensity);
      const velocity = parseFloat(tsVelocity);
      const tubeIDmm = parseFloat(tsTubeID);
      const viscosity = parseFloat(tsViscosity);
      const specificHeat = parseFloat(tsSpecificHeat);
      const conductivity = parseFloat(tsConductivity);

      if (
        isNaN(density) ||
        density <= 0 ||
        isNaN(velocity) ||
        velocity <= 0 ||
        isNaN(tubeIDmm) ||
        tubeIDmm <= 0 ||
        isNaN(viscosity) ||
        viscosity <= 0 ||
        isNaN(specificHeat) ||
        specificHeat <= 0 ||
        isNaN(conductivity) ||
        conductivity <= 0
      )
        return null;

      return calculateTubeSideHTC({
        density,
        velocity,
        diameter: tubeIDmm / 1000, // mm to m
        viscosity,
        specificHeat,
        conductivity,
        isHeating: tsIsHeating,
      });
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Calculation error');
      return null;
    }
  }, [
    mode,
    tsDensity,
    tsVelocity,
    tsTubeID,
    tsViscosity,
    tsSpecificHeat,
    tsConductivity,
    tsIsHeating,
  ]);

  // Calculate condensation HTC
  const condensationResult = useMemo(() => {
    if (mode !== 'condensation') return null;
    setError(null);

    try {
      const liquidDensity = parseFloat(condLiquidDensity);
      const vaporDensity = parseFloat(condVaporDensity);
      const latentHeat = parseFloat(condLatentHeat);
      const liquidConductivity = parseFloat(condLiquidConductivity);
      const liquidViscosity = parseFloat(condLiquidViscosity);
      const dimension = parseFloat(condDimension);
      const deltaT = parseFloat(condDeltaT);

      if (
        isNaN(liquidDensity) ||
        liquidDensity <= 0 ||
        isNaN(vaporDensity) ||
        vaporDensity <= 0 ||
        isNaN(latentHeat) ||
        latentHeat <= 0 ||
        isNaN(liquidConductivity) ||
        liquidConductivity <= 0 ||
        isNaN(liquidViscosity) ||
        liquidViscosity <= 0 ||
        isNaN(dimension) ||
        dimension <= 0 ||
        isNaN(deltaT) ||
        deltaT <= 0
      )
        return null;

      return calculateNusseltCondensation({
        liquidDensity,
        vaporDensity,
        latentHeat,
        liquidConductivity,
        liquidViscosity,
        dimension,
        deltaT,
        orientation: condOrientation,
      });
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Calculation error');
      return null;
    }
  }, [
    mode,
    condLiquidDensity,
    condVaporDensity,
    condLatentHeat,
    condLiquidConductivity,
    condLiquidViscosity,
    condDimension,
    condDeltaT,
    condOrientation,
  ]);

  // Calculate overall HTC
  const overallResult = useMemo(() => {
    if (mode !== 'overall') return null;
    setError(null);

    try {
      const tubeSideHTC = parseFloat(overallTubeSideHTC);
      const shellSideHTC = parseFloat(overallShellSideHTC);
      const tubeODmm = parseFloat(overallTubeOD);
      const tubeIDmm = parseFloat(overallTubeID);
      const wallConductivity = parseFloat(overallWallConductivity);
      const tubeSideFouling = parseFloat(overallTubeSideFouling);
      const shellSideFouling = parseFloat(overallShellSideFouling);

      if (
        isNaN(tubeSideHTC) ||
        tubeSideHTC <= 0 ||
        isNaN(shellSideHTC) ||
        shellSideHTC <= 0 ||
        isNaN(tubeODmm) ||
        tubeODmm <= 0 ||
        isNaN(tubeIDmm) ||
        tubeIDmm <= 0 ||
        isNaN(wallConductivity) ||
        wallConductivity <= 0 ||
        isNaN(tubeSideFouling) ||
        isNaN(shellSideFouling)
      )
        return null;

      if (tubeIDmm >= tubeODmm) return null;

      return calculateOverallHTC({
        tubeSideHTC,
        shellSideHTC,
        tubeOD: tubeODmm / 1000, // mm to m
        tubeID: tubeIDmm / 1000, // mm to m
        tubeWallConductivity: wallConductivity,
        tubeSideFouling,
        shellSideFouling,
      });
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Calculation error');
      return null;
    }
  }, [
    mode,
    overallTubeSideHTC,
    overallShellSideHTC,
    overallTubeOD,
    overallTubeID,
    overallWallConductivity,
    overallTubeSideFouling,
    overallShellSideFouling,
  ]);

  const hasResult =
    (mode === 'tube-side' && tubeSideResult) ||
    (mode === 'condensation' && condensationResult) ||
    (mode === 'overall' && overallResult);

  return (
    <Container maxWidth="xl" sx={{ py: 4 }}>
      <CalculatorBreadcrumb calculatorName="Heat Transfer" />

      {/* Header */}
      <Box sx={{ mb: 4 }}>
        <Stack direction="row" alignItems="center" spacing={2} mb={1}>
          <Typography variant="h4" component="h1">
            Heat Transfer Coefficients
          </Typography>
          <Chip label="Dittus-Boelter / Nusselt" size="small" color="primary" variant="outlined" />
        </Stack>
        <Typography variant="body1" color="text.secondary">
          Calculate tube-side, condensation, and overall heat transfer coefficients for heat
          exchanger design.
        </Typography>
      </Box>

      <Grid container spacing={3}>
        {/* Input Section */}
        <Grid size={{ xs: 12, md: 5 }}>
          <Paper sx={{ p: 3 }}>
            <Typography variant="h6" gutterBottom>
              Calculation Mode
            </Typography>

            {/* Mode Toggle */}
            <ToggleButtonGroup
              value={mode}
              exclusive
              onChange={(_, v) => v && setMode(v)}
              fullWidth
              size="small"
              sx={{ mb: 3 }}
            >
              <ToggleButton value="tube-side">Tube-Side</ToggleButton>
              <ToggleButton value="condensation">Condensation</ToggleButton>
              <ToggleButton value="overall">Overall U</ToggleButton>
            </ToggleButtonGroup>

            <Divider sx={{ mb: 2 }} />

            {/* Tube-Side Inputs */}
            {mode === 'tube-side' && (
              <TubeSideInputs
                density={tsDensity}
                velocity={tsVelocity}
                tubeID={tsTubeID}
                viscosity={tsViscosity}
                specificHeat={tsSpecificHeat}
                conductivity={tsConductivity}
                isHeating={tsIsHeating}
                onDensityChange={setTsDensity}
                onVelocityChange={setTsVelocity}
                onTubeIDChange={setTsTubeID}
                onViscosityChange={setTsViscosity}
                onSpecificHeatChange={setTsSpecificHeat}
                onConductivityChange={setTsConductivity}
                onIsHeatingChange={setTsIsHeating}
              />
            )}

            {/* Condensation Inputs */}
            {mode === 'condensation' && (
              <CondensationInputs
                liquidDensity={condLiquidDensity}
                vaporDensity={condVaporDensity}
                latentHeat={condLatentHeat}
                liquidConductivity={condLiquidConductivity}
                liquidViscosity={condLiquidViscosity}
                dimension={condDimension}
                deltaT={condDeltaT}
                orientation={condOrientation}
                onLiquidDensityChange={setCondLiquidDensity}
                onVaporDensityChange={setCondVaporDensity}
                onLatentHeatChange={setCondLatentHeat}
                onLiquidConductivityChange={setCondLiquidConductivity}
                onLiquidViscosityChange={setCondLiquidViscosity}
                onDimensionChange={setCondDimension}
                onDeltaTChange={setCondDeltaT}
                onOrientationChange={setCondOrientation}
              />
            )}

            {/* Overall HTC Inputs */}
            {mode === 'overall' && (
              <OverallHTCInputs
                tubeSideHTC={overallTubeSideHTC}
                shellSideHTC={overallShellSideHTC}
                tubeOD={overallTubeOD}
                tubeID={overallTubeID}
                wallConductivity={overallWallConductivity}
                tubeSideFouling={overallTubeSideFouling}
                shellSideFouling={overallShellSideFouling}
                onTubeSideHTCChange={setOverallTubeSideHTC}
                onShellSideHTCChange={setOverallShellSideHTC}
                onTubeODChange={setOverallTubeOD}
                onTubeIDChange={setOverallTubeID}
                onWallConductivityChange={setOverallWallConductivity}
                onTubeSideFoulingChange={setOverallTubeSideFouling}
                onShellSideFoulingChange={setOverallShellSideFouling}
              />
            )}
          </Paper>

          {/* Error Display */}
          {error && (
            <Alert severity="error" sx={{ mt: 2 }}>
              {error}
            </Alert>
          )}
        </Grid>

        {/* Results Section */}
        <Grid size={{ xs: 12, md: 7 }}>
          {mode === 'tube-side' && tubeSideResult && <TubeSideResult result={tubeSideResult} />}

          {mode === 'condensation' && condensationResult && (
            <CondensationResult result={condensationResult} orientation={condOrientation} />
          )}

          {mode === 'overall' && overallResult && <OverallHTCResult result={overallResult} />}

          {/* Empty State */}
          {!hasResult && !error && (
            <Paper
              sx={{
                p: 6,
                textAlign: 'center',
                bgcolor: 'action.hover',
                border: '2px dashed',
                borderColor: 'divider',
              }}
            >
              <Typography variant="h6" color="text.secondary" gutterBottom>
                Enter parameters to calculate heat transfer coefficient
              </Typography>
              <Typography variant="body2" color="text.secondary">
                Results will update automatically
              </Typography>
            </Paper>
          )}
        </Grid>
      </Grid>

      {/* Formulas */}
      <Box sx={{ mt: 4, p: 3, bgcolor: 'action.hover', borderRadius: 2 }}>
        <Typography variant="subtitle2" gutterBottom>
          Correlations
        </Typography>
        <Typography variant="body2" color="text.secondary" component="div">
          <ul style={{ margin: 0, paddingLeft: 20 }}>
            <li>
              <strong>Dittus-Boelter (tube-side):</strong> Nu = 0.023 × Re<sup>0.8</sup> × Pr
              <sup>n</sup>, h = Nu × k / D
            </li>
            <li>
              <strong>Nusselt Film Condensation:</strong> h = C × [ρ_l(ρ_l-ρ_v)g·h_fg·k³ / (μ·D·ΔT)]
              <sup>0.25</sup>
            </li>
            <li>
              <strong>Overall HTC:</strong> 1/U_o = (1/h_i)(D_o/D_i) + R_fi(D_o/D_i) +
              D_o·ln(D_o/D_i)/(2k_w) + R_fo + 1/h_o
            </li>
          </ul>
        </Typography>
        <Typography variant="body2" color="text.secondary" sx={{ mt: 2 }}>
          <strong>References:</strong> Perry&apos;s Chemical Engineers&apos; Handbook, Kern&apos;s
          Process Heat Transfer
        </Typography>
      </Box>
    </Container>
  );
}
