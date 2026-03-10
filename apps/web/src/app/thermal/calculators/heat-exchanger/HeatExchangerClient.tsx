'use client';

/**
 * Heat Exchanger Sizing Calculator -- Unified Iterative Design
 *
 * Supports three exchanger types:
 *   - CONDENSER: Shell-side condensation (Nusselt) + tube-side forced convection
 *   - EVAPORATOR: Shell-side pool boiling (Mostinski) + tube-side forced convection
 *   - LIQUID_LIQUID: Shell-side cross-flow (Kern) + tube-side forced convection
 *
 *   Step 1: Select exchanger type
 *   Step 2: Define process conditions (fluids, flow rates, temperatures)
 *   Step 3: Select tube geometry & fouling
 *   -> Click "Run Design" to execute iterative convergence
 *   -> Results panel: HTC breakdown, geometry, velocity, iteration history
 */

import { useState, useMemo, useCallback, lazy, Suspense } from 'react';
import {
  Container,
  Typography,
  Box,
  Grid,
  Chip,
  Stack,
  Button,
  Stepper,
  Step,
  StepLabel,
  StepContent,
  CircularProgress,
} from '@mui/material';
import {
  NavigateNext as NextIcon,
  NavigateBefore as BackIcon,
  PictureAsPdf as PdfIcon,
  FolderOpen as LoadIcon,
  Save as SaveIcon,
  PlayArrow as RunIcon,
} from '@mui/icons-material';
import { CalculatorBreadcrumb } from '../components/CalculatorBreadcrumb';
import { designHeatExchanger } from '@/lib/thermal/iterativeHXDesign';
import {
  calculateSensibleHeat,
  calculateLMTD,
  findTubeIndex,
  type FlowArrangement,
} from '@/lib/thermal';
import type { IterativeHXResult } from '@/lib/thermal/iterativeHXDesign.types';
import type { FluidType } from '@/lib/thermal/fluidProperties';

import { ExchangerTypeSelector } from './components/ExchangerTypeSelector';
import type { ExchangerTypeId } from './components/ExchangerTypeSelector';
import { ProcessConditionsStep } from './components/ProcessConditionsStep';
import type {
  TubeSideValues,
  ShellSideCondensingValues,
  ShellSideBoilingValues,
  ShellSideSensibleValues,
} from './components/FluidPanel';
import { TubeGeometryStep } from './components/TubeGeometryStep';
import type { TubeGeometryValues } from './components/TubeGeometryStep';
import { DesignResultsPanel } from './components/DesignResultsPanel';

const GenerateReportDialog = lazy(() =>
  import('./components/GenerateReportDialog').then((m) => ({
    default: m.GenerateReportDialog,
  }))
);

import { SaveCalculationDialog } from './components/SaveCalculationDialog';
import { LoadCalculationDialog } from './components/LoadCalculationDialog';

// -- Steps --

const STEPS = ['Exchanger Type', 'Process Conditions', 'Tube Geometry & Fouling'];

// -- Main component --

export default function HeatExchangerClient() {
  const [activeStep, setActiveStep] = useState(0);
  const [reportOpen, setReportOpen] = useState(false);
  const [saveOpen, setSaveOpen] = useState(false);
  const [loadOpen, setLoadOpen] = useState(false);

  // -- Step 1: Exchanger Type --
  const [exchangerType, setExchangerType] = useState<ExchangerTypeId | null>(null);

  // -- Step 2: Process Conditions --
  const [tubeSide, setTubeSide] = useState<TubeSideValues>({
    fluid: 'SEAWATER',
    salinity: '35000',
    massFlowRate: '',
    inletTemp: '',
    outletTemp: '',
  });

  // Shell-side state for each exchanger type (only the active one is used)
  const [shellSideCondensing, setShellSideCondensing] = useState<ShellSideCondensingValues>({
    massFlowRate: '',
    saturationTemp: '',
  });

  const [shellSideBoiling, setShellSideBoiling] = useState<ShellSideBoilingValues>({
    massFlowRate: '',
    saturationTemp: '',
  });

  const [shellSideSensible, setShellSideSensible] = useState<ShellSideSensibleValues>({
    fluid: 'PURE_WATER',
    salinity: '0',
    massFlowRate: '',
    inletTemp: '',
    outletTemp: '',
  });

  // -- Step 3: Tube Geometry --
  const [tubeGeometry, setTubeGeometry] = useState<TubeGeometryValues>({
    tubeOD: 19.05,
    tubeBWG: 16,
    tubeMaterial: 'cuNi_90_10',
    tubeLayout: 'triangular',
    pitchRatio: '1.25',
    tubePasses: 2,
    tubeLength: '6',
    foulingTubeSide: '0.000088',
    foulingShellSide: '0.0000088',
  });

  // -- Design result --
  const [designResult, setDesignResult] = useState<IterativeHXResult | null>(null);
  const [designError, setDesignError] = useState<string | null>(null);

  // -- Computed values --

  const heatDutyKW = useMemo(() => {
    const m = parseFloat(tubeSide.massFlowRate);
    const tIn = parseFloat(tubeSide.inletTemp);
    const tOut = parseFloat(tubeSide.outletTemp);
    if (isNaN(m) || isNaN(tIn) || isNaN(tOut) || m <= 0) return null;
    try {
      const result = calculateSensibleHeat({
        fluidType:
          tubeSide.fluid === 'CONDENSATE'
            ? 'PURE_WATER'
            : (tubeSide.fluid as 'PURE_WATER' | 'SEAWATER'),
        salinity: parseFloat(tubeSide.salinity) || 0,
        massFlowRate: m,
        inletTemperature: tIn,
        outletTemperature: tOut,
      });
      return Math.abs(result.heatDuty);
    } catch {
      return null;
    }
  }, [tubeSide]);

  const lmtdValue = useMemo(() => {
    if (!exchangerType) return null;
    const tIn = parseFloat(tubeSide.inletTemp);
    const tOut = parseFloat(tubeSide.outletTemp);
    if (isNaN(tIn) || isNaN(tOut)) return null;

    try {
      let hotIn: number, hotOut: number, coldIn: number, coldOut: number;

      if (exchangerType === 'CONDENSER') {
        const tSat = parseFloat(shellSideCondensing.saturationTemp);
        if (isNaN(tSat)) return null;
        hotIn = tSat;
        hotOut = tSat;
        coldIn = tIn;
        coldOut = tOut;
      } else if (exchangerType === 'EVAPORATOR') {
        const tSat = parseFloat(shellSideBoiling.saturationTemp);
        if (isNaN(tSat)) return null;
        // Tube is hot side, shell (boiling) is cold side
        hotIn = tIn;
        hotOut = tOut;
        coldIn = tSat;
        coldOut = tSat;
      } else {
        // LIQUID_LIQUID
        const sIn = parseFloat(shellSideSensible.inletTemp);
        const sOut = parseFloat(shellSideSensible.outletTemp);
        if (isNaN(sIn) || isNaN(sOut)) return null;
        const shellMean = (sIn + sOut) / 2;
        const tubeMean = (tIn + tOut) / 2;
        if (shellMean >= tubeMean) {
          hotIn = sIn;
          hotOut = sOut;
          coldIn = tIn;
          coldOut = tOut;
        } else {
          hotIn = tIn;
          hotOut = tOut;
          coldIn = sIn;
          coldOut = sOut;
        }
      }

      const result = calculateLMTD({
        hotInlet: hotIn,
        hotOutlet: hotOut,
        coldInlet: coldIn,
        coldOutlet: coldOut,
        flowArrangement: 'COUNTER' as FlowArrangement,
      });
      return result.correctedLMTD > 0 ? result.correctedLMTD : null;
    } catch {
      return null;
    }
  }, [
    exchangerType,
    tubeSide.inletTemp,
    tubeSide.outletTemp,
    shellSideCondensing.saturationTemp,
    shellSideBoiling.saturationTemp,
    shellSideSensible.inletTemp,
    shellSideSensible.outletTemp,
  ]);

  // -- Step validation --

  const step1Valid = exchangerType !== null;

  const step2Valid = useMemo(() => {
    return heatDutyKW !== null && lmtdValue !== null && lmtdValue > 0;
  }, [heatDutyKW, lmtdValue]);

  const step3Valid = useMemo(() => {
    const length = parseFloat(tubeGeometry.tubeLength);
    const fTS = parseFloat(tubeGeometry.foulingTubeSide);
    const fSS = parseFloat(tubeGeometry.foulingShellSide);
    return (
      !isNaN(length) &&
      length > 0 &&
      !isNaN(fTS) &&
      fTS >= 0 &&
      !isNaN(fSS) &&
      fSS >= 0 &&
      findTubeIndex(tubeGeometry.tubeOD, tubeGeometry.tubeBWG) >= 0
    );
  }, [tubeGeometry]);

  const canRunDesign = step1Valid && step2Valid && step3Valid;

  // -- Build shell-side input for the engine --

  const buildShellSideInput = useCallback(() => {
    if (exchangerType === 'LIQUID_LIQUID') {
      return {
        fluid: shellSideSensible.fluid as FluidType,
        salinity: parseFloat(shellSideSensible.salinity) || 0,
        massFlowRate: parseFloat(shellSideSensible.massFlowRate),
        inletTemp: parseFloat(shellSideSensible.inletTemp),
        outletTemp: parseFloat(shellSideSensible.outletTemp),
      };
    }
    // CONDENSER or EVAPORATOR — same structure
    const vals = exchangerType === 'EVAPORATOR' ? shellSideBoiling : shellSideCondensing;
    return {
      massFlowRate: parseFloat(vals.massFlowRate),
      saturationTemp: parseFloat(vals.saturationTemp),
    };
  }, [exchangerType, shellSideCondensing, shellSideBoiling, shellSideSensible]);

  // -- Run Design --

  const runDesign = useCallback(() => {
    if (!canRunDesign || !exchangerType) return;

    setDesignError(null);
    try {
      const result = designHeatExchanger({
        exchangerType,
        tubeSide: {
          fluid: tubeSide.fluid as FluidType,
          salinity: parseFloat(tubeSide.salinity) || 0,
          massFlowRate: parseFloat(tubeSide.massFlowRate),
          inletTemp: parseFloat(tubeSide.inletTemp),
          outletTemp: parseFloat(tubeSide.outletTemp),
        },
        shellSide: buildShellSideInput(),
        flowArrangement: 'COUNTER',
        tubeOrientation: 'horizontal',
        tubeGeometry: {
          tubeSpecIndex: findTubeIndex(tubeGeometry.tubeOD, tubeGeometry.tubeBWG),
          tubeMaterial: tubeGeometry.tubeMaterial,
          tubeLayout: tubeGeometry.tubeLayout,
          pitchRatio: parseFloat(tubeGeometry.pitchRatio) || 1.25,
          tubePasses: tubeGeometry.tubePasses,
          tubeLength: parseFloat(tubeGeometry.tubeLength),
        },
        fouling: {
          tubeSide: parseFloat(tubeGeometry.foulingTubeSide) || 0,
          shellSide: parseFloat(tubeGeometry.foulingShellSide) || 0,
        },
      });
      setDesignResult(result);
    } catch (e) {
      setDesignError(e instanceof Error ? e.message : 'Design calculation failed');
      setDesignResult(null);
    }
  }, [canRunDesign, exchangerType, tubeSide, buildShellSideInput, tubeGeometry]);

  // -- Save/Load input mapping --

  const saveInputs = {
    version: 2,
    exchangerType,
    tubeSide,
    shellSideCondensing,
    shellSideBoiling,
    shellSideSensible,
    tubeGeometry,
  };

  const handleLoad = useCallback((inputs: Record<string, unknown>) => {
    // Handle v2 (iterative design) inputs
    if (inputs.version === 2) {
      if (inputs.exchangerType) setExchangerType(inputs.exchangerType as ExchangerTypeId);
      if (inputs.tubeSide) setTubeSide(inputs.tubeSide as TubeSideValues);
      // Support both old (shellSide) and new separate shell-side fields
      if (inputs.shellSideCondensing) {
        setShellSideCondensing(inputs.shellSideCondensing as ShellSideCondensingValues);
      } else if (inputs.shellSide) {
        // Backward compat with v2 saves that used single shellSide field
        setShellSideCondensing(inputs.shellSide as ShellSideCondensingValues);
      }
      if (inputs.shellSideBoiling) {
        setShellSideBoiling(inputs.shellSideBoiling as ShellSideBoilingValues);
      }
      if (inputs.shellSideSensible) {
        setShellSideSensible(inputs.shellSideSensible as ShellSideSensibleValues);
      }
      if (inputs.tubeGeometry) setTubeGeometry(inputs.tubeGeometry as TubeGeometryValues);
      setDesignResult(null);
      setDesignError(null);
      return;
    }
    // Handle v1 (old manual-entry) saved calculations -- best-effort migration
    if (typeof inputs.massFlowRate === 'string' && inputs.massFlowRate) {
      setTubeSide((prev) => ({
        ...prev,
        massFlowRate: inputs.massFlowRate as string,
        inletTemp: (inputs.inletTemp as string) ?? prev.inletTemp,
        outletTemp: (inputs.outletTemp as string) ?? prev.outletTemp,
      }));
    }
    if (typeof inputs.satTemp === 'string' && inputs.satTemp) {
      setShellSideCondensing((prev) => ({
        ...prev,
        saturationTemp: inputs.satTemp as string,
      }));
    }
    if (typeof inputs.tubeOD === 'number') {
      setTubeGeometry((prev) => ({
        ...prev,
        tubeOD: inputs.tubeOD as number,
        tubeBWG: (inputs.tubeBWG as number) ?? prev.tubeBWG,
        tubeMaterial: (inputs.tubeMaterial as string) ?? prev.tubeMaterial,
        tubeLayout: (inputs.tubeLayout as TubeGeometryValues['tubeLayout']) ?? prev.tubeLayout,
        pitchRatio: (inputs.pitchRatio as string) ?? prev.pitchRatio,
        tubePasses: (inputs.tubePasses as number) ?? prev.tubePasses,
        tubeLength: (inputs.tubeLength as string) ?? prev.tubeLength,
      }));
    }
    if (!inputs.exchangerType) {
      setExchangerType('CONDENSER');
    }
    setDesignResult(null);
    setDesignError(null);
  }, []);

  // -- Render --

  return (
    <Container maxWidth="xl" sx={{ py: 3 }}>
      <CalculatorBreadcrumb calculatorName="Heat Exchanger Sizing" />

      {/* Header */}
      <Stack direction="row" alignItems="center" spacing={2} sx={{ mb: 0.5 }}>
        <Typography variant="h5" fontWeight="bold">
          Heat Exchanger Sizing
        </Typography>
        <Chip label="Iterative Design" size="small" color="primary" />
      </Stack>
      <Typography variant="body2" color="text.secondary" sx={{ mb: 1 }}>
        Unified design tool: define process conditions, select tube geometry, and the engine
        iterates to converge on HTC, area, and tube count.
      </Typography>

      {/* Load Saved */}
      <Button
        size="small"
        startIcon={<LoadIcon />}
        onClick={() => setLoadOpen(true)}
        sx={{ mb: 2 }}
      >
        Load Saved
      </Button>

      {/* Main layout: Stepper (left) + Results (right) */}
      <Grid container spacing={3}>
        {/* Left: Stepper with inputs */}
        <Grid size={{ xs: 12, lg: 5 }}>
          <Stepper activeStep={activeStep} orientation="vertical">
            {/* Step 1: Exchanger Type */}
            <Step completed={step1Valid && activeStep > 0}>
              <StepLabel
                optional={
                  exchangerType ? (
                    <Chip
                      label={exchangerType}
                      size="small"
                      color="success"
                      sx={{ fontSize: '0.65rem' }}
                    />
                  ) : undefined
                }
              >
                {STEPS[0]}
              </StepLabel>
              <StepContent>
                <ExchangerTypeSelector value={exchangerType} onChange={setExchangerType} />
                <Box sx={{ mt: 2 }}>
                  <Button
                    variant="contained"
                    size="small"
                    endIcon={<NextIcon />}
                    disabled={!step1Valid}
                    onClick={() => setActiveStep(1)}
                  >
                    Next
                  </Button>
                </Box>
              </StepContent>
            </Step>

            {/* Step 2: Process Conditions */}
            <Step completed={step2Valid && activeStep > 1}>
              <StepLabel
                optional={
                  heatDutyKW !== null && lmtdValue !== null ? (
                    <Chip
                      label={`Q = ${heatDutyKW.toFixed(0)} kW, LMTD = ${lmtdValue.toFixed(1)}\u00B0C`}
                      size="small"
                      color="success"
                      sx={{ fontSize: '0.65rem' }}
                    />
                  ) : undefined
                }
              >
                {STEPS[1]}
              </StepLabel>
              <StepContent>
                {exchangerType && (
                  <ProcessConditionsStep
                    exchangerType={exchangerType}
                    tubeSide={tubeSide}
                    onTubeSideChange={setTubeSide}
                    shellSideCondensing={shellSideCondensing}
                    onShellSideCondensingChange={setShellSideCondensing}
                    shellSideBoiling={shellSideBoiling}
                    onShellSideBoilingChange={setShellSideBoiling}
                    shellSideSensible={shellSideSensible}
                    onShellSideSensibleChange={setShellSideSensible}
                    heatDutyKW={heatDutyKW}
                    lmtd={lmtdValue}
                  />
                )}
                <Stack direction="row" spacing={1} sx={{ mt: 2 }}>
                  <Button size="small" startIcon={<BackIcon />} onClick={() => setActiveStep(0)}>
                    Back
                  </Button>
                  <Button
                    variant="contained"
                    size="small"
                    endIcon={<NextIcon />}
                    disabled={!step2Valid}
                    onClick={() => setActiveStep(2)}
                  >
                    Next
                  </Button>
                </Stack>
              </StepContent>
            </Step>

            {/* Step 3: Tube Geometry */}
            <Step completed={step3Valid && designResult !== null}>
              <StepLabel>{STEPS[2]}</StepLabel>
              <StepContent>
                <TubeGeometryStep values={tubeGeometry} onChange={setTubeGeometry} />
                <Stack direction="row" spacing={1} sx={{ mt: 2 }}>
                  <Button size="small" startIcon={<BackIcon />} onClick={() => setActiveStep(1)}>
                    Back
                  </Button>
                  <Button
                    variant="contained"
                    size="small"
                    color="success"
                    startIcon={<RunIcon />}
                    disabled={!canRunDesign}
                    onClick={runDesign}
                  >
                    Run Design
                  </Button>
                </Stack>
              </StepContent>
            </Step>
          </Stepper>
        </Grid>

        {/* Right: Results Panel */}
        <Grid size={{ xs: 12, lg: 7 }}>
          <DesignResultsPanel result={designResult} error={designError} />

          {/* Action buttons */}
          {designResult && (
            <Stack direction="row" spacing={1} justifyContent="flex-end" sx={{ mt: 2 }}>
              <Button
                variant="outlined"
                size="small"
                startIcon={<SaveIcon />}
                onClick={() => setSaveOpen(true)}
              >
                Save
              </Button>
              <Button
                variant="outlined"
                size="small"
                startIcon={<PdfIcon />}
                onClick={() => setReportOpen(true)}
              >
                Generate Report
              </Button>
            </Stack>
          )}
        </Grid>
      </Grid>

      {/* Report dialog -- bridges to existing PDF template via geometry adapter */}
      {reportOpen && designResult && (
        <Suspense fallback={<CircularProgress />}>
          <GenerateReportDialog
            open={reportOpen}
            onClose={() => setReportOpen(false)}
            result={{
              ...designResult.geometry,
              requiredTubeCount: designResult.geometry.requiredTubeCount,
              actualTubeCount: designResult.geometry.actualTubeCount,
              actualArea: designResult.geometry.actualArea,
              excessArea: designResult.geometry.excessArea,
              minShellID: designResult.geometry.shellID - designResult.geometry.bundleClearance,
              designArea: designResult.geometry.requiredArea,
              foulingMargin: 0,
              warnings: designResult.warnings,
            }}
            heatDutyKW={designResult.heatDuty.heatDutyKW}
            lmtd={designResult.lmtdResult.correctedLMTD}
            overallHTC={designResult.htcResult.overallHTC}
            velocityCheck={{
              velocity: designResult.velocity.tubeSideVelocity,
              reynoldsNumber: designResult.velocity.tubeSideReynolds,
              pressureDrop: designResult.velocity.tubeSidePressureDrop,
            }}
            iterativeResult={designResult}
          />
        </Suspense>
      )}

      {/* Save/Load Dialogs */}
      <SaveCalculationDialog
        open={saveOpen}
        onClose={() => setSaveOpen(false)}
        calculatorType="HEAT_EXCHANGER"
        inputs={saveInputs}
      />
      <LoadCalculationDialog
        open={loadOpen}
        onClose={() => setLoadOpen(false)}
        calculatorType="HEAT_EXCHANGER"
        onLoad={handleLoad}
      />
    </Container>
  );
}
