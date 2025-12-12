'use client';

/**
 * Pipe Sizing Calculator
 *
 * Size pipes based on flow rate and velocity constraints, or calculate velocity for a given pipe.
 * Uses ASME B36.10 Schedule 40 pipe data.
 */

import { useState, useMemo } from 'react';
import { Container, Typography, Box, Paper, Grid, Chip, Stack } from '@mui/material';
import {
  SCHEDULE_40_PIPES,
  selectPipeByVelocity,
  calculateVelocity,
  calculateRequiredArea,
  getPipeByNPS,
  type PipeVariant,
} from '@/lib/thermal';
import { getSeawaterDensity, getDensityLiquid } from '@vapour/constants';
import {
  type CalculationMode,
  type FlowUnit,
  type FluidType,
  type PipeSizingResult,
  DEFAULT_VELOCITY_LIMITS,
  convertFlowToTonHr,
  PipeInputs,
  PipeResults,
  PipeReferenceTables,
} from './components';

export default function PipeSizingClient() {
  // Mode
  const [mode, setMode] = useState<CalculationMode>('size_by_flow');

  // Flow inputs
  const [flowRate, setFlowRate] = useState<string>('100');
  const [flowUnit, setFlowUnit] = useState<FlowUnit>('tonhr');

  // Fluid properties
  const [fluidType, setFluidType] = useState<FluidType>('water');
  const [temperature, setTemperature] = useState<string>('40');
  const [salinity, setSalinity] = useState<string>('35000');
  const [customDensity, setCustomDensity] = useState<string>('1000');

  // Velocity settings
  const [targetVelocity, setTargetVelocity] = useState<string>('1.5');
  const [minVelocity, setMinVelocity] = useState<string>('0.5');
  const [maxVelocity, setMaxVelocity] = useState<string>('3.0');

  // Check velocity mode - selected pipe
  const [selectedNPS, setSelectedNPS] = useState<string>('4');

  const [error, setError] = useState<string | null>(null);

  // Calculate fluid density
  const density = useMemo(() => {
    const temp = parseFloat(temperature) || 25;
    const sal = parseFloat(salinity) || 35000;

    switch (fluidType) {
      case 'water':
        try {
          return getDensityLiquid(temp);
        } catch {
          return 1000; // fallback
        }
      case 'seawater':
        try {
          return getSeawaterDensity(sal, temp);
        } catch {
          return 1025; // fallback
        }
      case 'steam':
        // For steam, user needs to specify density based on pressure
        return parseFloat(customDensity) || 0.6;
      case 'custom':
        return parseFloat(customDensity) || 1000;
      default:
        return 1000;
    }
  }, [fluidType, temperature, salinity, customDensity]);

  // Calculate mass flow in ton/hr
  const massFlowTonHr = useMemo(() => {
    const flow = parseFloat(flowRate) || 0;

    if (flowUnit === 'm3hr') {
      // Convert volumetric to mass flow
      return (flow * density) / 1000; // m³/hr × kg/m³ / 1000 = ton/hr
    }

    return convertFlowToTonHr(flow, flowUnit);
  }, [flowRate, flowUnit, density]);

  // Main calculation result
  const result: PipeSizingResult | null = useMemo(() => {
    setError(null);

    try {
      if (massFlowTonHr <= 0 || density <= 0) return null;

      const target = parseFloat(targetVelocity) || 1.5;
      const min = parseFloat(minVelocity) || 0.5;
      const max = parseFloat(maxVelocity) || 3.0;

      if (mode === 'size_by_flow') {
        // Convert mass flow to volumetric flow (m³/s)
        const volumetricFlow = (massFlowTonHr * 1000) / (density * 3600);

        // Select pipe by velocity
        const selectedPipe = selectPipeByVelocity(volumetricFlow, target, { min, max });

        // Also get alternatives (one size smaller and larger if available)
        const pipeIndex = SCHEDULE_40_PIPES.findIndex((p) => p.nps === selectedPipe.nps);
        const alternatives: Array<
          PipeVariant & { velocity: number; status: 'OK' | 'HIGH' | 'LOW' }
        > = [];

        // One size smaller
        if (pipeIndex > 0) {
          const smallerPipe = SCHEDULE_40_PIPES[pipeIndex - 1];
          if (smallerPipe) {
            const vel = calculateVelocity(massFlowTonHr, density, smallerPipe);
            const status: 'OK' | 'HIGH' | 'LOW' = vel > max ? 'HIGH' : vel < min ? 'LOW' : 'OK';
            alternatives.push({
              ...smallerPipe,
              velocity: vel,
              status,
            });
          }
        }

        // One size larger
        if (pipeIndex < SCHEDULE_40_PIPES.length - 1) {
          const largerPipe = SCHEDULE_40_PIPES[pipeIndex + 1];
          if (largerPipe) {
            const vel = calculateVelocity(massFlowTonHr, density, largerPipe);
            const status: 'OK' | 'HIGH' | 'LOW' = vel > max ? 'HIGH' : vel < min ? 'LOW' : 'OK';
            alternatives.push({
              ...largerPipe,
              velocity: vel,
              status,
            });
          }
        }

        return {
          mode: 'size_by_flow' as const,
          pipe: selectedPipe,
          velocity: selectedPipe.actualVelocity,
          velocityStatus: selectedPipe.velocityStatus,
          requiredArea: calculateRequiredArea(massFlowTonHr, density, target),
          alternatives,
        };
      } else {
        // Check velocity mode
        const pipe = getPipeByNPS(selectedNPS);
        if (!pipe) {
          setError(`Pipe size NPS ${selectedNPS} not found`);
          return null;
        }

        const velocity = calculateVelocity(massFlowTonHr, density, pipe);
        const status: 'OK' | 'HIGH' | 'LOW' =
          velocity > max ? 'HIGH' : velocity < min ? 'LOW' : 'OK';

        return {
          mode: 'check_velocity' as const,
          pipe,
          velocity,
          velocityStatus: status,
        };
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Calculation error');
      return null;
    }
  }, [mode, massFlowTonHr, density, targetVelocity, minVelocity, maxVelocity, selectedNPS]);

  // Apply velocity presets based on fluid type
  const handleFluidTypeChange = (newType: FluidType) => {
    setFluidType(newType);

    // Apply default velocity limits
    if (newType === 'water' || newType === 'seawater') {
      const limits = DEFAULT_VELOCITY_LIMITS[`${newType}_liquid`];
      if (limits) {
        setTargetVelocity(limits.target.toString());
        setMinVelocity(limits.min.toString());
        setMaxVelocity(limits.max.toString());
      }
    } else if (newType === 'steam') {
      const limits = DEFAULT_VELOCITY_LIMITS.steam_vapor;
      if (limits) {
        setTargetVelocity(limits.target.toString());
        setMinVelocity(limits.min.toString());
        setMaxVelocity(limits.max.toString());
      }
    }
  };

  // Handle pipe selection from reference table
  const handlePipeSelect = (newMode: CalculationMode, nps: string) => {
    setMode(newMode);
    setSelectedNPS(nps);
  };

  return (
    <Container maxWidth="lg" sx={{ py: 4 }}>
      {/* Header */}
      <Box sx={{ mb: 4 }}>
        <Stack direction="row" alignItems="center" spacing={2} mb={1}>
          <Typography variant="h4" component="h1">
            Pipe Sizing Calculator
          </Typography>
          <Chip label="ASME B36.10" size="small" color="primary" variant="outlined" />
        </Stack>
        <Typography variant="body1" color="text.secondary">
          Size pipes based on flow rate and velocity constraints, or check velocity for a given pipe
          size. Uses Schedule 40 pipe data.
        </Typography>
      </Box>

      <Grid container spacing={3}>
        {/* Input Section */}
        <Grid size={{ xs: 12, md: 5 }}>
          <PipeInputs
            mode={mode}
            flowRate={flowRate}
            flowUnit={flowUnit}
            fluidType={fluidType}
            temperature={temperature}
            salinity={salinity}
            customDensity={customDensity}
            targetVelocity={targetVelocity}
            minVelocity={minVelocity}
            maxVelocity={maxVelocity}
            selectedNPS={selectedNPS}
            massFlowTonHr={massFlowTonHr}
            density={density}
            error={error}
            onModeChange={setMode}
            onFlowRateChange={setFlowRate}
            onFlowUnitChange={setFlowUnit}
            onFluidTypeChange={handleFluidTypeChange}
            onTemperatureChange={setTemperature}
            onSalinityChange={setSalinity}
            onCustomDensityChange={setCustomDensity}
            onTargetVelocityChange={setTargetVelocity}
            onMinVelocityChange={setMinVelocity}
            onMaxVelocityChange={setMaxVelocity}
            onSelectedNPSChange={setSelectedNPS}
          />
        </Grid>

        {/* Results Section */}
        <Grid size={{ xs: 12, md: 7 }}>
          {result ? (
            <PipeResults result={result} minVelocity={minVelocity} maxVelocity={maxVelocity} />
          ) : (
            !error && (
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
                  Enter flow rate to calculate pipe size
                </Typography>
                <Typography variant="body2" color="text.secondary">
                  Results will update automatically
                </Typography>
              </Paper>
            )
          )}
        </Grid>
      </Grid>

      {/* Reference Tables */}
      <PipeReferenceTables onPipeSelect={handlePipeSelect} />

      {/* Info Section */}
      <Box sx={{ mt: 4, p: 3, bgcolor: 'action.hover', borderRadius: 2 }}>
        <Typography variant="subtitle2" gutterBottom>
          Reference
        </Typography>
        <Typography variant="body2" color="text.secondary">
          ASME B36.10M: Welded and Seamless Wrought Steel Pipe. Schedule 40 (STD) is the default for
          general process piping applications.
        </Typography>
      </Box>
    </Container>
  );
}
