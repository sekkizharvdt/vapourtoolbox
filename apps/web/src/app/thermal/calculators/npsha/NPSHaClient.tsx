'use client';

/**
 * Suction System Designer
 *
 * Complete pump suction system designer for vacuum vessels (MED effects, flash chambers, etc.).
 * Replaces the old NPSHa calculator with full pipe sizing, fitting selection,
 * friction calculation, holdup volume design, and NPSHa verification.
 */

import { useState, useMemo } from 'react';
import { Container, Typography, Box, Grid, Stack, Chip, Paper, Alert } from '@mui/material';
import {
  calculateSuctionSystem,
  type SuctionSystemInput,
  type SuctionSystemResult,
  type SuctionFluidType,
  type CalculationMode,
} from '@/lib/thermal/suctionSystemCalculator';
import { CalculatorBreadcrumb } from '../components/CalculatorBreadcrumb';
import { SuctionDiagram } from './components/SuctionDiagram';
import { SuctionInputs } from './components/SuctionInputs';
import { SuctionResults } from './components/SuctionResults';

export default function NPSHaClient() {
  // Operating conditions
  const [effectPressure, setEffectPressure] = useState<string>('300');
  const [fluidType, setFluidType] = useState<SuctionFluidType>('brine');
  const [salinity, setSalinity] = useState<string>('45000');
  const [flowRate, setFlowRate] = useState<string>('100');

  // Pipe sizing
  const [nozzleVelocityTarget, setNozzleVelocityTarget] = useState<string>('0.08');
  const [suctionVelocityTarget, setSuctionVelocityTarget] = useState<string>('1.2');

  // Pipe geometry
  const [elbowCount, setElbowCount] = useState<string>('1');
  const [verticalPipeRun, setVerticalPipeRun] = useState<string>('3');
  const [horizontalPipeRun, setHorizontalPipeRun] = useState<string>('2');

  // Holdup volume
  const [holdupPipeDiameter, setHoldupPipeDiameter] = useState<string>('');
  const [minColumnHeight, setMinColumnHeight] = useState<string>('1.0');
  const [residenceTime, setResidenceTime] = useState<string>('30');

  // Pump & mode
  const [pumpNPSHr, setPumpNPSHr] = useState<string>('3.0');
  const [safetyMargin, setSafetyMargin] = useState<string>('0.5');
  const [mode, setMode] = useState<CalculationMode>('find_elevation');
  const [userElevation, setUserElevation] = useState<string>('5.0');

  // Error state
  const [error, setError] = useState<string | null>(null);

  // Main calculation
  const result: SuctionSystemResult | null = useMemo(() => {
    setError(null);
    try {
      const ep = parseFloat(effectPressure);
      const sal = parseFloat(salinity);
      const fr = parseFloat(flowRate);
      const nvt = parseFloat(nozzleVelocityTarget);
      const svt = parseFloat(suctionVelocityTarget);
      const ec = parseInt(elbowCount);
      const vpr = parseFloat(verticalPipeRun);
      const hpr = parseFloat(horizontalPipeRun);
      const mch = parseFloat(minColumnHeight);
      const rt = parseFloat(residenceTime);
      const npr = parseFloat(pumpNPSHr);
      const sm = parseFloat(safetyMargin);
      const ue = parseFloat(userElevation);

      // Basic validation before calling calculator
      if (isNaN(ep) || isNaN(fr) || isNaN(nvt) || isNaN(svt)) return null;
      if (isNaN(ec) || isNaN(vpr) || isNaN(hpr)) return null;
      if (isNaN(mch) || isNaN(rt) || isNaN(npr) || isNaN(sm)) return null;
      if (fluidType === 'brine' && isNaN(sal)) return null;
      if (mode === 'verify_elevation' && isNaN(ue)) return null;

      const input: SuctionSystemInput = {
        effectPressure: ep,
        fluidType,
        salinity: fluidType === 'distillate' ? 0 : sal,
        flowRate: fr,
        nozzleVelocityTarget: nvt,
        suctionVelocityTarget: svt,
        elbowCount: ec,
        verticalPipeRun: vpr,
        horizontalPipeRun: hpr,
        ...(holdupPipeDiameter ? { holdupPipeDiameter } : {}),
        minColumnHeight: mch,
        residenceTime: rt,
        pumpNPSHr: npr,
        safetyMargin: sm,
        mode,
        ...(mode === 'verify_elevation' ? { userElevation: ue } : {}),
      };

      return calculateSuctionSystem(input);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Calculation error');
      return null;
    }
  }, [
    effectPressure,
    fluidType,
    salinity,
    flowRate,
    nozzleVelocityTarget,
    suctionVelocityTarget,
    elbowCount,
    verticalPipeRun,
    horizontalPipeRun,
    holdupPipeDiameter,
    minColumnHeight,
    residenceTime,
    pumpNPSHr,
    safetyMargin,
    mode,
    userElevation,
  ]);

  return (
    <Container maxWidth="xl" sx={{ py: 4 }}>
      <CalculatorBreadcrumb calculatorName="Suction System Designer" />

      {/* Header */}
      <Box sx={{ mb: 4 }}>
        <Stack direction="row" alignItems="center" spacing={2} mb={1}>
          <Typography variant="h4" component="h1">
            Suction System Designer
          </Typography>
          <Chip label="Darcy-Weisbach" size="small" color="primary" variant="outlined" />
          <Chip label="Crane TP-410" size="small" variant="outlined" />
        </Stack>
        <Typography variant="body1" color="text.secondary">
          Design pump suction systems for vacuum vessels — MED effects, flash chambers, and more.
          Sizes nozzle and suction piping, selects fittings, calculates friction losses, designs
          holdup volume, and determines required elevation for adequate NPSHa.
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
            <SuctionInputs
              effectPressure={effectPressure}
              fluidType={fluidType}
              salinity={salinity}
              flowRate={flowRate}
              onEffectPressureChange={setEffectPressure}
              onFluidTypeChange={setFluidType}
              onSalinityChange={setSalinity}
              onFlowRateChange={setFlowRate}
              nozzleVelocityTarget={nozzleVelocityTarget}
              suctionVelocityTarget={suctionVelocityTarget}
              onNozzleVelocityTargetChange={setNozzleVelocityTarget}
              onSuctionVelocityTargetChange={setSuctionVelocityTarget}
              elbowCount={elbowCount}
              verticalPipeRun={verticalPipeRun}
              horizontalPipeRun={horizontalPipeRun}
              onElbowCountChange={setElbowCount}
              onVerticalPipeRunChange={setVerticalPipeRun}
              onHorizontalPipeRunChange={setHorizontalPipeRun}
              holdupPipeDiameter={holdupPipeDiameter}
              minColumnHeight={minColumnHeight}
              residenceTime={residenceTime}
              onHoldupPipeDiameterChange={setHoldupPipeDiameter}
              onMinColumnHeightChange={setMinColumnHeight}
              onResidenceTimeChange={setResidenceTime}
              pumpNPSHr={pumpNPSHr}
              safetyMargin={safetyMargin}
              mode={mode}
              userElevation={userElevation}
              onPumpNPSHrChange={setPumpNPSHr}
              onSafetyMarginChange={setSafetyMargin}
              onModeChange={setMode}
              onUserElevationChange={setUserElevation}
              result={result}
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
          <SuctionDiagram result={result} />
          {result ? (
            <SuctionResults
              result={result}
              inputs={{
                effectPressure,
                fluidType,
                salinity,
                flowRate,
                nozzleVelocityTarget,
                suctionVelocityTarget,
                elbowCount,
                verticalPipeRun,
                horizontalPipeRun,
                holdupPipeDiameter,
                minColumnHeight,
                residenceTime,
                pumpNPSHr,
                safetyMargin,
                mode,
                userElevation,
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
                  Enter parameters to design suction system
                </Typography>
                <Typography variant="body2" color="text.secondary">
                  Provide effect pressure, fluid properties, flow rate, and pipe geometry to design
                  the complete suction system with NPSHa verification.
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
          MED thermal desalination plants operate under vacuum. Pumps extracting liquid from the
          last effects need carefully designed suction systems to avoid cavitation. This tool
          designs the complete flow path from vessel nozzle to pump suction.
        </Typography>
        <Typography variant="body2" color="text.secondary" paragraph>
          <strong>Flow path</strong>: Vessel nozzle (standpipe with holdup volume and level gauge) →
          concentric reducer → suction pipe → TEE (1 working + 1 standby pump) → 90° elbow(s) →
          valve → strainer → pump.
        </Typography>
        <Typography variant="body2" color="text.secondary" paragraph>
          <strong>NPSHa = Hs + Hp - Hvp - Hf</strong> where Hs = static head (elevation), Hp =
          pressure head, Hvp = vapor pressure head, Hf = friction losses. Both clean and dirty
          strainer conditions are evaluated; the dirty case (worst case) governs the design.
        </Typography>
        <Typography variant="body2" color="text.secondary">
          <strong>Auto-selection rules</strong>: Gate valve for NPS {'≥'} 4&quot;, ball valve for
          smaller sizes. Bucket strainer for NPS {'≥'} 4&quot;, Y-type for smaller sizes. Reducer
          K-factor computed from Crane TP-410 formula using the actual pipe diameter ratio.
        </Typography>
      </Box>
    </Container>
  );
}
