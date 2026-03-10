'use client';

/**
 * Pipe Sizing Calculator
 *
 * Size pipes based on flow rate and velocity constraints, or calculate velocity for a given pipe.
 * Uses ASME B36.10 Schedule 40 pipe data.
 */

import { useState, useMemo, lazy, Suspense } from 'react';
import {
  Container,
  Typography,
  Box,
  Paper,
  Grid,
  Chip,
  Stack,
  Button,
  CircularProgress,
} from '@mui/material';
import {
  PictureAsPdf as PdfIcon,
  FolderOpen as LoadIcon,
  Save as SaveIcon,
  RestartAlt as ResetIcon,
} from '@mui/icons-material';
import { CalculatorBreadcrumb } from '../components/CalculatorBreadcrumb';
import {
  SCHEDULE_40_PIPES,
  selectPipeByVelocity,
  calculateVelocity,
  calculateRequiredPipeArea,
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

const GenerateReportDialog = lazy(() =>
  import('./components/GenerateReportDialog').then((m) => ({ default: m.GenerateReportDialog }))
);

import { SaveCalculationDialog } from './components/SaveCalculationDialog';
import { LoadCalculationDialog } from './components/LoadCalculationDialog';

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

  const [reportOpen, setReportOpen] = useState(false);
  const [saveOpen, setSaveOpen] = useState(false);
  const [loadOpen, setLoadOpen] = useState(false);

  const handleReset = () => {
    setMode('size_by_flow');
    setFlowRate('100');
    setFlowUnit('tonhr');
    setFluidType('water');
    setTemperature('40');
    setSalinity('35000');
    setCustomDensity('1000');
    setTargetVelocity('1.5');
    setMinVelocity('0.5');
    setMaxVelocity('3.0');
    setSelectedNPS('4');
  };

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
  const resultComputed = useMemo((): { result: PipeSizingResult | null; error: string | null } => {
    try {
      if (massFlowTonHr <= 0 || density <= 0) return { result: null, error: null };

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
          result: {
            mode: 'size_by_flow' as const,
            pipe: selectedPipe,
            velocity: selectedPipe.actualVelocity,
            velocityStatus: selectedPipe.velocityStatus,
            requiredArea: calculateRequiredPipeArea(massFlowTonHr, density, target),
            alternatives,
          },
          error: null,
        };
      } else {
        // Check velocity mode
        const pipe = getPipeByNPS(selectedNPS);
        if (!pipe) {
          return { result: null, error: `Pipe size NPS ${selectedNPS} not found` };
        }

        const velocity = calculateVelocity(massFlowTonHr, density, pipe);
        const status: 'OK' | 'HIGH' | 'LOW' =
          velocity > max ? 'HIGH' : velocity < min ? 'LOW' : 'OK';

        return {
          result: {
            mode: 'check_velocity' as const,
            pipe,
            velocity,
            velocityStatus: status,
          },
          error: null,
        };
      }
    } catch (err) {
      return { result: null, error: err instanceof Error ? err.message : 'Calculation error' };
    }
  }, [mode, massFlowTonHr, density, targetVelocity, minVelocity, maxVelocity, selectedNPS]);

  const result = resultComputed.result;
  const error = resultComputed.error;

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
    <Container maxWidth="xl" sx={{ py: 4 }}>
      <CalculatorBreadcrumb calculatorName="Pipe Sizing" />

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
        <Stack direction="row" spacing={1} sx={{ mt: 1 }}>
          <Button
            startIcon={<LoadIcon />}
            size="small"
            onClick={() => setLoadOpen(true)}
          >
            Load Saved
          </Button>
          <Button startIcon={<ResetIcon />} size="small" onClick={handleReset}>
            Reset
          </Button>
        </Stack>
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

      {/* Action Buttons */}
      {result && (
        <Box sx={{ mt: 2, display: 'flex', justifyContent: 'flex-end', gap: 1 }}>
          <Button variant="outlined" startIcon={<SaveIcon />} onClick={() => setSaveOpen(true)}>
            Save
          </Button>
          <Button variant="outlined" startIcon={<PdfIcon />} onClick={() => setReportOpen(true)}>
            Generate Report
          </Button>
        </Box>
      )}

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
      {/* Report Dialog */}
      {reportOpen && result && (
        <Suspense fallback={<CircularProgress />}>
          <GenerateReportDialog
            open={reportOpen}
            onClose={() => setReportOpen(false)}
            result={result}
            inputs={{
              mode,
              flowRate,
              flowUnit,
              fluidType,
              temperature,
              salinity,
              density,
              targetVelocity,
              minVelocity,
              maxVelocity,
              selectedNPS,
            }}
          />
        </Suspense>
      )}

      {/* Save/Load Dialogs */}
      <SaveCalculationDialog
        open={saveOpen}
        onClose={() => setSaveOpen(false)}
        calculatorType="PIPE_SIZING"
        inputs={{
          mode,
          flowRate,
          flowUnit,
          fluidType,
          temperature,
          salinity,
          customDensity,
          targetVelocity,
          minVelocity,
          maxVelocity,
          selectedNPS,
        }}
      />
      <LoadCalculationDialog
        open={loadOpen}
        onClose={() => setLoadOpen(false)}
        calculatorType="PIPE_SIZING"
        onLoad={(inputs) => {
          if (typeof inputs.mode === 'string') setMode(inputs.mode as CalculationMode);
          if (typeof inputs.flowRate === 'string') setFlowRate(inputs.flowRate);
          if (typeof inputs.flowUnit === 'string') setFlowUnit(inputs.flowUnit as FlowUnit);
          if (typeof inputs.fluidType === 'string') setFluidType(inputs.fluidType as FluidType);
          if (typeof inputs.temperature === 'string') setTemperature(inputs.temperature);
          if (typeof inputs.salinity === 'string') setSalinity(inputs.salinity);
          if (typeof inputs.customDensity === 'string') setCustomDensity(inputs.customDensity);
          if (typeof inputs.targetVelocity === 'string') setTargetVelocity(inputs.targetVelocity);
          if (typeof inputs.minVelocity === 'string') setMinVelocity(inputs.minVelocity);
          if (typeof inputs.maxVelocity === 'string') setMaxVelocity(inputs.maxVelocity);
          if (typeof inputs.selectedNPS === 'string') setSelectedNPS(inputs.selectedNPS);
        }}
      />
    </Container>
  );
}
