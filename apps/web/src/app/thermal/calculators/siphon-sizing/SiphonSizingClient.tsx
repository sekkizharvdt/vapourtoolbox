'use client';

import { useState, useMemo } from 'react';
import { Container, Typography, Box, Grid, Stack, Chip, Paper, Alert, Button } from '@mui/material';
import {
  ViewList as BatchIcon,
  FolderOpen as LoadIcon,
  HelpOutline as GuideIcon,
} from '@mui/icons-material';
import Link from 'next/link';
import { LoadCalculationDialog } from './components/LoadCalculationDialog';
import {
  calculateSiphonSizing,
  type SiphonSizingInput,
  type SiphonSizingResult,
  type SiphonFluidType,
  type PressureUnit,
  type ElbowConfig,
} from '@/lib/thermal/siphonSizingCalculator';
import { mbarAbsToBar } from '@vapour/constants';
import { CalculatorBreadcrumb } from '../components/CalculatorBreadcrumb';
import { SiphonDiagram } from './components/SiphonDiagram';
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
  const [salinity, setSalinity] = useState<string>('35000');

  // Flow state
  const [flowRate, setFlowRate] = useState<string>('100');
  const [targetVelocity, setTargetVelocity] = useState<string>('1.0');

  // Geometry state
  const [elbowConfig, setElbowConfig] = useState<ElbowConfig>('2_elbows');
  const [horizontalDistance, setHorizontalDistance] = useState<string>('3');
  const [offsetDistance, setOffsetDistance] = useState<string>('1.5');

  // Pipe schedule state
  const [pipeSchedule, setPipeSchedule] = useState<string>('40');

  // Custom pipe state (for plate-formed pipes exceeding 24")
  const [customPipeId, setCustomPipeId] = useState<string>('');
  const [customPipeThickness, setCustomPipeThickness] = useState<string>('');

  // Safety state
  const [safetyFactor, setSafetyFactor] = useState<string>('20');

  // Load dialog state
  const [loadDialogOpen, setLoadDialogOpen] = useState(false);

  // Error state
  const [error, setError] = useState<string | null>(null);

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
      const sal = parseFloat(salinity);
      const flow = parseFloat(flowRate);
      const vel = parseFloat(targetVelocity);
      const hDist = parseFloat(horizontalDistance);
      const oDist = parseFloat(offsetDistance);
      const sf = parseFloat(safetyFactor);

      // Basic validation before calling calculator
      if (isNaN(up) || isNaN(down) || isNaN(flow) || isNaN(vel) || isNaN(hDist) || isNaN(sf)) {
        return null;
      }
      if ((fluidType === 'seawater' || fluidType === 'brine') && isNaN(sal)) {
        return null;
      }
      if (elbowConfig !== '2_elbows' && isNaN(oDist)) {
        return null;
      }
      if (up <= down) return null;

      // Build custom pipe if both dimensions provided
      const cpId = parseFloat(customPipeId);
      const cpWt = parseFloat(customPipeThickness);
      const customPipe =
        !isNaN(cpId) && cpId > 0 && !isNaN(cpWt) && cpWt > 0
          ? { id_mm: cpId, wt_mm: cpWt }
          : undefined;

      const input: SiphonSizingInput = {
        upstreamPressure: up,
        downstreamPressure: down,
        pressureUnit,
        fluidType,
        salinity: fluidType === 'distillate' ? 0 : sal,
        flowRate: flow,
        elbowConfig,
        horizontalDistance: hDist,
        offsetDistance: elbowConfig !== '2_elbows' ? oDist : 0,
        targetVelocity: vel,
        safetyFactor: sf,
        pipeSchedule,
        ...(customPipe ? { customPipe } : {}),
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
    salinity,
    flowRate,
    targetVelocity,
    pipeSchedule,
    elbowConfig,
    horizontalDistance,
    offsetDistance,
    safetyFactor,
    customPipeId,
    customPipeThickness,
  ]);

  return (
    <Container maxWidth="xl" sx={{ py: 4 }}>
      <CalculatorBreadcrumb calculatorName="Siphon Sizing" />

      {/* Header */}
      <Box sx={{ mb: 4 }}>
        <Stack direction="row" alignItems="center" spacing={2} mb={1}>
          <Typography variant="h4" component="h1">
            Siphon Sizing Calculator
          </Typography>
          <Chip label="Darcy-Weisbach" size="small" color="primary" variant="outlined" />
        </Stack>
        <Typography variant="body1" color="text.secondary" sx={{ mb: 1 }}>
          Size inter-effect siphon pipes for MED thermal desalination plants. Calculates pipe size,
          minimum U-bend height, pressure drop, and flash vapor at the downstream effect.
        </Typography>
        <Stack direction="row" spacing={1}>
          <Button startIcon={<LoadIcon />} size="small" onClick={() => setLoadDialogOpen(true)}>
            Load Saved
          </Button>
          <Button
            component={Link}
            href="/thermal/calculators/siphon-sizing/batch"
            startIcon={<BatchIcon />}
            size="small"
          >
            Batch Mode (All Effects)
          </Button>
          <Button
            component={Link}
            href="/guide?section=thermal"
            startIcon={<GuideIcon />}
            size="small"
          >
            Guide
          </Button>
        </Stack>
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
              salinity={salinity}
              onFluidTypeChange={setFluidType}
              onSalinityChange={setSalinity}
              flowRate={flowRate}
              onFlowRateChange={setFlowRate}
              targetVelocity={targetVelocity}
              onTargetVelocityChange={setTargetVelocity}
              pipeSchedule={pipeSchedule}
              onPipeScheduleChange={setPipeSchedule}
              customPipeId={customPipeId}
              customPipeThickness={customPipeThickness}
              onCustomPipeIdChange={setCustomPipeId}
              onCustomPipeThicknessChange={setCustomPipeThickness}
              pipeExceedsStandard={result?.pipeExceedsStandard ?? false}
              elbowConfig={elbowConfig}
              horizontalDistance={horizontalDistance}
              offsetDistance={offsetDistance}
              onElbowConfigChange={setElbowConfig}
              onHorizontalDistanceChange={setHorizontalDistance}
              onOffsetDistanceChange={setOffsetDistance}
              safetyFactor={safetyFactor}
              onSafetyFactorChange={setSafetyFactor}
              pressureDiffDisplay={pressureDiffDisplay}
              derivedTemperature={result?.fluidTemperature ?? null}
              derivedDensity={result?.fluidDensity ?? null}
            />
          </Paper>
          {error && (
            <Alert severity="error" sx={{ mt: 2 }}>
              {error}
            </Alert>
          )}
        </Grid>

        {/* Right: Diagram + Results */}
        <Grid size={{ xs: 12, md: 7 }}>
          <SiphonDiagram
            result={result}
            elbowConfig={elbowConfig}
            horizontalDistance={parseFloat(horizontalDistance) || 0}
            offsetDistance={parseFloat(offsetDistance) || 0}
          />
          {result ? (
            <SiphonResults
              result={result}
              inputs={{
                upstreamPressure,
                downstreamPressure,
                pressureUnit,
                fluidType,
                salinity,
                flowRate,
                targetVelocity,
                pipeSchedule,
                elbowConfig,
                horizontalDistance,
                offsetDistance,
                safetyFactor,
              }}
            />
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
          <strong>Flash vapor</strong> occurs when the fluid&apos;s saturation temperature at the
          upstream effect exceeds the saturation temperature at the downstream pressure. The flash
          fraction is calculated using an enthalpy balance.
        </Typography>
      </Box>

      {/* Load Calculation Dialog */}
      <LoadCalculationDialog
        open={loadDialogOpen}
        onClose={() => setLoadDialogOpen(false)}
        onLoad={(inputs) => {
          if (typeof inputs.upstreamPressure === 'string')
            setUpstreamPressure(inputs.upstreamPressure);
          if (typeof inputs.downstreamPressure === 'string')
            setDownstreamPressure(inputs.downstreamPressure);
          if (typeof inputs.pressureUnit === 'string')
            setPressureUnit(inputs.pressureUnit as PressureUnit);
          if (typeof inputs.fluidType === 'string')
            setFluidType(inputs.fluidType as SiphonFluidType);
          if (typeof inputs.salinity === 'string') setSalinity(inputs.salinity);
          if (typeof inputs.flowRate === 'string') setFlowRate(inputs.flowRate);
          if (typeof inputs.targetVelocity === 'string') setTargetVelocity(inputs.targetVelocity);
          if (typeof inputs.pipeSchedule === 'string') setPipeSchedule(inputs.pipeSchedule);
          if (typeof inputs.elbowConfig === 'string')
            setElbowConfig(inputs.elbowConfig as ElbowConfig);
          if (typeof inputs.horizontalDistance === 'string')
            setHorizontalDistance(inputs.horizontalDistance);
          if (typeof inputs.offsetDistance === 'string') setOffsetDistance(inputs.offsetDistance);
          if (typeof inputs.safetyFactor === 'string') setSafetyFactor(inputs.safetyFactor);
        }}
      />
    </Container>
  );
}
