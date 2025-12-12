'use client';

/**
 * Pressure Drop Calculator
 *
 * Calculate pressure drop in piping systems including straight pipe and fittings.
 * Uses Darcy-Weisbach equation with Colebrook-White friction factor.
 */

import { useState, useMemo } from 'react';
import { Container, Typography, Box, Grid, Alert, Stack, Chip } from '@mui/material';
import { calculatePressureDrop, type FittingType, type FittingCount } from '@/lib/thermal';
import { getSeawaterDensity, getSeawaterViscosity, getDensityLiquid } from '@vapour/constants';
import {
  FluidType,
  PressureDropInputs,
  FittingsManager,
  PressureDropResults,
  KFactorReference,
  MethodInfo,
} from './components';

// Water viscosity approximation (Pa·s)
function getWaterViscosity(tempC: number): number {
  const factor = 1 + 0.0168 * tempC - 0.000133 * tempC * tempC;
  return 0.001 / factor;
}

export default function PressureDropClient() {
  // Pipe parameters
  const [selectedNPS, setSelectedNPS] = useState<string>('4');
  const [pipeLength, setPipeLength] = useState<string>('100');
  const [roughness, setRoughness] = useState<string>('0.045');

  // Flow parameters
  const [flowRate, setFlowRate] = useState<string>('50');

  // Fluid parameters
  const [fluidType, setFluidType] = useState<FluidType>('water');
  const [temperature, setTemperature] = useState<string>('40');
  const [salinity, setSalinity] = useState<string>('35000');
  const [customDensity, setCustomDensity] = useState<string>('1000');
  const [customViscosity, setCustomViscosity] = useState<string>('0.001');

  // Fittings
  const [fittings, setFittings] = useState<FittingCount[]>([
    { type: '90_elbow_standard', count: 4 },
    { type: 'gate_valve', count: 2 },
  ]);
  const [newFittingType, setNewFittingType] = useState<FittingType>('90_elbow_standard');

  // Elevation
  const [elevationChange, setElevationChange] = useState<string>('0');

  const [error, setError] = useState<string | null>(null);

  // Calculate fluid properties
  const fluidDensity = useMemo(() => {
    const temp = parseFloat(temperature) || 25;
    const sal = parseFloat(salinity) || 35000;

    switch (fluidType) {
      case 'water':
        try {
          return getDensityLiquid(temp);
        } catch {
          return 1000;
        }
      case 'seawater':
        try {
          return getSeawaterDensity(sal, temp);
        } catch {
          return 1025;
        }
      case 'custom':
        return parseFloat(customDensity) || 1000;
      default:
        return 1000;
    }
  }, [fluidType, temperature, salinity, customDensity]);

  const fluidViscosity = useMemo(() => {
    const temp = parseFloat(temperature) || 25;
    const sal = parseFloat(salinity) || 35000;

    switch (fluidType) {
      case 'water':
        return getWaterViscosity(temp);
      case 'seawater':
        try {
          return getSeawaterViscosity(sal, temp);
        } catch {
          return 0.001;
        }
      case 'custom':
        return parseFloat(customViscosity) || 0.001;
      default:
        return 0.001;
    }
  }, [fluidType, temperature, salinity, customViscosity]);

  // Calculate pressure drop
  const result = useMemo(() => {
    setError(null);

    try {
      const flow = parseFloat(flowRate);
      const length = parseFloat(pipeLength);
      const rough = parseFloat(roughness);
      const elevation = parseFloat(elevationChange);

      if (isNaN(flow) || flow <= 0) return null;
      if (isNaN(length) || length <= 0) return null;

      return calculatePressureDrop({
        pipeNPS: selectedNPS,
        pipeLength: length,
        flowRate: flow,
        fluidDensity,
        fluidViscosity,
        roughness: rough,
        fittings: fittings.filter((f) => f.count > 0),
        elevationChange: elevation,
      });
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Calculation error');
      return null;
    }
  }, [
    selectedNPS,
    pipeLength,
    flowRate,
    fluidDensity,
    fluidViscosity,
    roughness,
    fittings,
    elevationChange,
  ]);

  return (
    <Container maxWidth="lg" sx={{ py: 4 }}>
      {/* Header */}
      <Box sx={{ mb: 4 }}>
        <Stack direction="row" alignItems="center" spacing={2} mb={1}>
          <Typography variant="h4" component="h1">
            Pressure Drop Calculator
          </Typography>
          <Chip label="Darcy-Weisbach" size="small" color="primary" variant="outlined" />
        </Stack>
        <Typography variant="body1" color="text.secondary">
          Calculate pressure drop in piping systems including straight pipe and fittings. Uses
          Darcy-Weisbach equation with Colebrook-White friction factor.
        </Typography>
      </Box>

      <Grid container spacing={3}>
        {/* Input Section */}
        <Grid size={{ xs: 12, md: 5 }}>
          <PressureDropInputs
            selectedNPS={selectedNPS}
            setSelectedNPS={setSelectedNPS}
            pipeLength={pipeLength}
            setPipeLength={setPipeLength}
            roughness={roughness}
            setRoughness={setRoughness}
            flowRate={flowRate}
            setFlowRate={setFlowRate}
            fluidType={fluidType}
            setFluidType={setFluidType}
            temperature={temperature}
            setTemperature={setTemperature}
            salinity={salinity}
            setSalinity={setSalinity}
            customDensity={customDensity}
            setCustomDensity={setCustomDensity}
            customViscosity={customViscosity}
            setCustomViscosity={setCustomViscosity}
            elevationChange={elevationChange}
            setElevationChange={setElevationChange}
            fluidDensity={fluidDensity}
            fluidViscosity={fluidViscosity}
          />

          <FittingsManager
            fittings={fittings}
            setFittings={setFittings}
            newFittingType={newFittingType}
            setNewFittingType={setNewFittingType}
          />

          {/* Error Display */}
          {error && (
            <Alert severity="error" sx={{ mt: 2 }}>
              {error}
            </Alert>
          )}
        </Grid>

        {/* Results Section */}
        <Grid size={{ xs: 12, md: 7 }}>
          <PressureDropResults
            result={result}
            pipeLength={pipeLength}
            fittings={fittings}
            elevationChange={elevationChange}
            error={error}
          />
        </Grid>
      </Grid>

      <KFactorReference />
      <MethodInfo />
    </Container>
  );
}
