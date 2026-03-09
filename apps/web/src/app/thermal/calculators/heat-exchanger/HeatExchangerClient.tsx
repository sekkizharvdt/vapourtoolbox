'use client';

/**
 * Heat Exchanger Sizing Calculator
 *
 * Three-step design workflow:
 *   Step 1: Define heat duty + LMTD
 *   Step 2: Determine overall HTC (from correlations or manual)
 *   Step 3: Select tube geometry → size exchanger
 */

import { useState, useMemo, lazy, Suspense } from 'react';
import {
  Container,
  Typography,
  Box,
  Paper,
  Grid,
  Alert,
  Chip,
  Stack,
  TextField,
  Divider,
  Table,
  TableBody,
  TableCell,
  TableRow,
  FormControl,
  InputLabel,
  Select,
  MenuItem,
  Button,
  Stepper,
  Step,
  StepLabel,
  StepContent,
  CircularProgress,
  Accordion,
  AccordionSummary,
  AccordionDetails,
} from '@mui/material';
import {
  NavigateNext as NextIcon,
  NavigateBefore as BackIcon,
  PictureAsPdf as PdfIcon,
  ExpandMore as ExpandMoreIcon,
  FolderOpen as LoadIcon,
  Save as SaveIcon,
} from '@mui/icons-material';
import { CalculatorBreadcrumb } from '../components/CalculatorBreadcrumb';
import {
  calculateLMTD,
  calculateSensibleHeat,
  calculateLatentHeat,
  calculateHeatExchangerArea,
  TYPICAL_HTC,
  sizeHeatExchanger,
  calculateTubeSideVelocity,
  estimateTubeSidePressureDrop,
  STANDARD_TUBES,
  TUBE_MATERIALS,
  TUBE_LAYOUT_LABELS,
  findTubeIndex,
  getDistinctODs,
  getBWGsForOD,
  type TubeLayout,
  type FlowArrangement,
  type HeatExchangerResult,
} from '@/lib/thermal';

const GenerateReportDialog = lazy(() =>
  import('./components/GenerateReportDialog').then((m) => ({
    default: m.GenerateReportDialog,
  }))
);

import { SaveCalculationDialog } from './components/SaveCalculationDialog';
import { LoadCalculationDialog } from './components/LoadCalculationDialog';

const STEPS = ['Heat Duty & LMTD', 'Heat Transfer Coefficient', 'Tube Geometry & Sizing'];

// ── Adornment helper ─────────────────────────────────────────────────────────

function Adornment({ children }: { children: React.ReactNode }) {
  return (
    <Typography variant="caption" sx={{ ml: 1, whiteSpace: 'nowrap' }}>
      {children}
    </Typography>
  );
}

function TdLabel({ children, bold }: { children: React.ReactNode; bold?: boolean }) {
  return (
    <TableCell
      sx={{
        color: bold ? 'text.primary' : 'text.secondary',
        fontSize: '0.8rem',
        fontWeight: bold ? 'bold' : 'normal',
      }}
    >
      {children}
    </TableCell>
  );
}

function TdValue({ children, bold }: { children?: React.ReactNode; bold?: boolean }) {
  return (
    <TableCell align="right" sx={{ fontSize: '0.8rem', fontWeight: bold ? 'bold' : 'normal' }}>
      {children}
    </TableCell>
  );
}

// ── Main component ───────────────────────────────────────────────────────────

export default function HeatExchangerClient() {
  const [activeStep, setActiveStep] = useState(0);
  const [reportOpen, setReportOpen] = useState(false);
  const [saveOpen, setSaveOpen] = useState(false);
  const [loadOpen, setLoadOpen] = useState(false);

  // ── Step 1: Heat Duty & LMTD ────────────────────────────────────────────
  const [heatDutyMode, setHeatDutyMode] = useState<'manual' | 'sensible' | 'latent'>('manual');
  const [manualDuty, setManualDuty] = useState('');

  // Sensible calc inputs
  const [massFlowRate, setMassFlowRate] = useState('');
  const [inletTemp, setInletTemp] = useState('');
  const [outletTemp, setOutletTemp] = useState('');

  // Latent calc inputs
  const [latentFlowRate, setLatentFlowRate] = useState('');
  const [satTemp, setSatTemp] = useState('');

  // LMTD inputs
  const [hotInlet, setHotInlet] = useState('');
  const [hotOutlet, setHotOutlet] = useState('');
  const [coldInlet, setColdInlet] = useState('');
  const [coldOutlet, setColdOutlet] = useState('');
  const [flowArrangement, setFlowArrangement] = useState<FlowArrangement>('COUNTER');

  // ── Step 2: HTC ──────────────────────────────────────────────────────────
  const [htcMode, setHtcMode] = useState<'manual' | 'typical'>('manual');
  const [manualHTC, setManualHTC] = useState('2500');
  const [typicalHTCKey, setTypicalHTCKey] = useState('steam_to_water');

  // ── Step 3: Tube Geometry ────────────────────────────────────────────────
  const [tubeOD, setTubeOD] = useState(19.05);
  const [tubeBWG, setTubeBWG] = useState(16);
  const [tubeMaterial, setTubeMaterial] = useState('cuNi_90_10');
  const [tubeLayout, setTubeLayout] = useState<TubeLayout>('triangular');
  const [pitchRatio, setPitchRatio] = useState('1.25');
  const [tubePasses, setTubePasses] = useState(2);
  const [tubeLength, setTubeLength] = useState('6');
  const [foulingMargin, setFoulingMargin] = useState('15');

  // Tube-side velocity check inputs
  const [tubeSideMassFlow, setTubeSideMassFlow] = useState('');
  const [tubeSideDensity, setTubeSideDensity] = useState('995');
  const [tubeSideViscosity, setTubeSideViscosity] = useState('0.0008');

  // ── Computed: Heat Duty ──────────────────────────────────────────────────
  const heatDutyKW = useMemo(() => {
    if (heatDutyMode === 'manual') {
      const v = parseFloat(manualDuty);
      return isNaN(v) || v <= 0 ? null : v;
    }
    if (heatDutyMode === 'sensible') {
      try {
        const mfr = parseFloat(massFlowRate);
        const tin = parseFloat(inletTemp);
        const tout = parseFloat(outletTemp);
        if (isNaN(mfr) || mfr <= 0 || isNaN(tin) || isNaN(tout)) return null;
        const r = calculateSensibleHeat({
          fluidType: 'PURE_WATER',
          massFlowRate: mfr,
          inletTemperature: tin,
          outletTemperature: tout,
        });
        return r.heatDuty;
      } catch {
        return null;
      }
    }
    if (heatDutyMode === 'latent') {
      try {
        const mfr = parseFloat(latentFlowRate);
        const tsat = parseFloat(satTemp);
        if (isNaN(mfr) || mfr <= 0 || isNaN(tsat)) return null;
        const r = calculateLatentHeat({
          massFlowRate: mfr,
          temperature: tsat,
          process: 'CONDENSATION',
        });
        return r.heatDuty;
      } catch {
        return null;
      }
    }
    return null;
  }, [heatDutyMode, manualDuty, massFlowRate, inletTemp, outletTemp, latentFlowRate, satTemp]);

  // ── Computed: LMTD ─────────────────────────────────────────────────────
  const lmtdResult = useMemo(() => {
    const hi = parseFloat(hotInlet);
    const ho = parseFloat(hotOutlet);
    const ci = parseFloat(coldInlet);
    const co = parseFloat(coldOutlet);
    if ([hi, ho, ci, co].some((v) => isNaN(v))) return null;
    try {
      return calculateLMTD({
        hotInlet: hi,
        hotOutlet: ho,
        coldInlet: ci,
        coldOutlet: co,
        flowArrangement,
      });
    } catch {
      return null;
    }
  }, [hotInlet, hotOutlet, coldInlet, coldOutlet, flowArrangement]);

  const lmtd = lmtdResult?.correctedLMTD ?? null;

  // ── Computed: HTC ──────────────────────────────────────────────────────
  const overallHTC = useMemo(() => {
    if (htcMode === 'manual') {
      const v = parseFloat(manualHTC);
      return isNaN(v) || v <= 0 ? null : v;
    }
    const htc = TYPICAL_HTC[typicalHTCKey];
    return htc?.typical ?? null;
  }, [htcMode, manualHTC, typicalHTCKey]);

  // ── Computed: Quick preview area ──────────────────────────────────────
  const previewArea = useMemo(() => {
    if (!heatDutyKW || !lmtd || !overallHTC || lmtd <= 0) return null;
    return calculateHeatExchangerArea(heatDutyKW, overallHTC, lmtd);
  }, [heatDutyKW, lmtd, overallHTC]);

  // ── Computed: Final sizing ─────────────────────────────────────────────
  const sizingResult = useMemo<{ result: HeatExchangerResult | null; error: string | null }>(() => {
    if (!heatDutyKW || !lmtd || !overallHTC || lmtd <= 0) {
      return { result: null, error: null };
    }

    const tl = parseFloat(tubeLength);
    const pr = parseFloat(pitchRatio);
    const fm = parseFloat(foulingMargin);
    if (isNaN(tl) || tl <= 0) return { result: null, error: null };

    const tubeIdx = findTubeIndex(tubeOD, tubeBWG);
    if (tubeIdx < 0) return { result: null, error: 'Invalid tube selection' };

    try {
      const result = sizeHeatExchanger({
        heatDutyKW,
        lmtd,
        overallHTC,
        foulingMargin: isNaN(fm) ? 0.15 : fm / 100,
        tubeSpecIndex: tubeIdx,
        tubeMaterial,
        tubeLayout,
        pitchRatio: isNaN(pr) ? undefined : pr,
        tubePasses,
        tubeLength: tl,
      });
      return { result, error: null };
    } catch (err) {
      return { result: null, error: err instanceof Error ? err.message : 'Sizing error' };
    }
  }, [
    heatDutyKW,
    lmtd,
    overallHTC,
    tubeOD,
    tubeBWG,
    tubeMaterial,
    tubeLayout,
    pitchRatio,
    tubePasses,
    tubeLength,
    foulingMargin,
  ]);

  const result = sizingResult.result;

  // ── Tube-side velocity check ───────────────────────────────────────────
  const velocityCheck = useMemo(() => {
    if (!result) return null;
    const mf = parseFloat(tubeSideMassFlow);
    const rho = parseFloat(tubeSideDensity);
    const mu = parseFloat(tubeSideViscosity);
    if (isNaN(mf) || mf <= 0 || isNaN(rho) || rho <= 0) return null;

    const mfKgS = mf / 3.6; // ton/hr → kg/s
    const vel = calculateTubeSideVelocity(mfKgS, rho, result.tubeSideFlowArea);
    const dp = estimateTubeSidePressureDrop(
      vel,
      result.tubeSpec.id_mm / 1000,
      result.tubeLength,
      result.tubePasses,
      rho,
      isNaN(mu) ? 0.001 : mu
    );
    return { velocity: vel, ...dp };
  }, [result, tubeSideMassFlow, tubeSideDensity, tubeSideViscosity]);

  // ── Step validation ────────────────────────────────────────────────────
  const step1Valid = heatDutyKW !== null && lmtd !== null && lmtd > 0;
  const step2Valid = overallHTC !== null;
  const canSize = step1Valid && step2Valid;

  const handleNext = () => setActiveStep((s) => Math.min(s + 1, 2));
  const handleBack = () => setActiveStep((s) => Math.max(s - 1, 0));

  // Available BWGs for selected OD
  const availableBWGs = getBWGsForOD(tubeOD);
  const distinctODs = getDistinctODs();

  return (
    <Container maxWidth="xl" sx={{ py: 4 }}>
      <CalculatorBreadcrumb calculatorName="Heat Exchanger Sizing" />

      <Stack direction="row" alignItems="center" spacing={2} mb={1}>
        <Typography variant="h4" component="h1">
          Heat Exchanger Sizing
        </Typography>
        <Chip label="Shell & Tube" size="small" color="primary" variant="outlined" />
      </Stack>
      <Typography variant="body1" color="text.secondary">
        Size shell-and-tube heat exchangers from heat duty, LMTD, and HTC.
      </Typography>
      <Button
        startIcon={<LoadIcon />}
        size="small"
        onClick={() => setLoadOpen(true)}
        sx={{ mt: 1, mb: 2 }}
      >
        Load Saved
      </Button>

      <Grid container spacing={3}>
        {/* Left: Stepper inputs */}
        <Grid size={{ xs: 12, lg: 5 }}>
          <Stepper activeStep={activeStep} orientation="vertical">
            {/* ── Step 1: Heat Duty & LMTD ── */}
            <Step>
              <StepLabel
                optional={
                  heatDutyKW && lmtd ? (
                    <Typography variant="caption" color="success.main">
                      Q = {heatDutyKW.toFixed(0)} kW, LMTD = {lmtd.toFixed(1)} °C
                    </Typography>
                  ) : undefined
                }
              >
                {STEPS[0]}
              </StepLabel>
              <StepContent>
                <Paper sx={{ p: 2 }}>
                  <Stack spacing={2}>
                    <FormControl fullWidth size="small">
                      <InputLabel>Heat Duty Input</InputLabel>
                      <Select
                        value={heatDutyMode}
                        label="Heat Duty Input"
                        onChange={(e) => setHeatDutyMode(e.target.value as typeof heatDutyMode)}
                      >
                        <MenuItem value="manual">Enter Q directly</MenuItem>
                        <MenuItem value="sensible">Calculate sensible (Q = mCpΔT)</MenuItem>
                        <MenuItem value="latent">Calculate latent (Q = mhfg)</MenuItem>
                      </Select>
                    </FormControl>

                    {heatDutyMode === 'manual' && (
                      <TextField
                        label="Heat Duty"
                        value={manualDuty}
                        onChange={(e) => setManualDuty(e.target.value)}
                        fullWidth
                        size="small"
                        type="number"
                        slotProps={{ input: { endAdornment: <Adornment>kW</Adornment> } }}
                      />
                    )}

                    {heatDutyMode === 'sensible' && (
                      <>
                        <TextField
                          label="Mass Flow Rate"
                          value={massFlowRate}
                          onChange={(e) => setMassFlowRate(e.target.value)}
                          fullWidth
                          size="small"
                          type="number"
                          slotProps={{ input: { endAdornment: <Adornment>ton/hr</Adornment> } }}
                        />
                        <Grid container spacing={1}>
                          <Grid size={{ xs: 6 }}>
                            <TextField
                              label="Inlet Temp"
                              value={inletTemp}
                              onChange={(e) => setInletTemp(e.target.value)}
                              fullWidth
                              size="small"
                              type="number"
                              slotProps={{ input: { endAdornment: <Adornment>°C</Adornment> } }}
                            />
                          </Grid>
                          <Grid size={{ xs: 6 }}>
                            <TextField
                              label="Outlet Temp"
                              value={outletTemp}
                              onChange={(e) => setOutletTemp(e.target.value)}
                              fullWidth
                              size="small"
                              type="number"
                              slotProps={{ input: { endAdornment: <Adornment>°C</Adornment> } }}
                            />
                          </Grid>
                        </Grid>
                        {heatDutyKW !== null && (
                          <Alert severity="info" sx={{ py: 0 }}>
                            <strong>Q = {heatDutyKW.toFixed(1)} kW</strong> (
                            {(heatDutyKW / 1000).toFixed(3)} MW)
                          </Alert>
                        )}
                      </>
                    )}

                    {heatDutyMode === 'latent' && (
                      <>
                        <TextField
                          label="Steam/Vapor Flow Rate"
                          value={latentFlowRate}
                          onChange={(e) => setLatentFlowRate(e.target.value)}
                          fullWidth
                          size="small"
                          type="number"
                          slotProps={{ input: { endAdornment: <Adornment>ton/hr</Adornment> } }}
                        />
                        <TextField
                          label="Saturation Temperature"
                          value={satTemp}
                          onChange={(e) => setSatTemp(e.target.value)}
                          fullWidth
                          size="small"
                          type="number"
                          slotProps={{ input: { endAdornment: <Adornment>°C</Adornment> } }}
                        />
                        {heatDutyKW !== null && (
                          <Alert severity="info" sx={{ py: 0 }}>
                            <strong>Q = {heatDutyKW.toFixed(1)} kW</strong> (
                            {(heatDutyKW / 1000).toFixed(3)} MW)
                          </Alert>
                        )}
                      </>
                    )}

                    <Divider />
                    <Typography variant="subtitle2">Temperature Profile (LMTD)</Typography>
                    <Grid container spacing={1}>
                      <Grid size={{ xs: 6 }}>
                        <TextField
                          label="Hot Inlet"
                          value={hotInlet}
                          onChange={(e) => setHotInlet(e.target.value)}
                          fullWidth
                          size="small"
                          type="number"
                          slotProps={{ input: { endAdornment: <Adornment>°C</Adornment> } }}
                        />
                      </Grid>
                      <Grid size={{ xs: 6 }}>
                        <TextField
                          label="Hot Outlet"
                          value={hotOutlet}
                          onChange={(e) => setHotOutlet(e.target.value)}
                          fullWidth
                          size="small"
                          type="number"
                          slotProps={{ input: { endAdornment: <Adornment>°C</Adornment> } }}
                        />
                      </Grid>
                      <Grid size={{ xs: 6 }}>
                        <TextField
                          label="Cold Inlet"
                          value={coldInlet}
                          onChange={(e) => setColdInlet(e.target.value)}
                          fullWidth
                          size="small"
                          type="number"
                          slotProps={{ input: { endAdornment: <Adornment>°C</Adornment> } }}
                        />
                      </Grid>
                      <Grid size={{ xs: 6 }}>
                        <TextField
                          label="Cold Outlet"
                          value={coldOutlet}
                          onChange={(e) => setColdOutlet(e.target.value)}
                          fullWidth
                          size="small"
                          type="number"
                          slotProps={{ input: { endAdornment: <Adornment>°C</Adornment> } }}
                        />
                      </Grid>
                    </Grid>
                    <FormControl fullWidth size="small">
                      <InputLabel>Flow Arrangement</InputLabel>
                      <Select
                        value={flowArrangement}
                        label="Flow Arrangement"
                        onChange={(e) => setFlowArrangement(e.target.value as FlowArrangement)}
                      >
                        <MenuItem value="COUNTER">Counter-current</MenuItem>
                        <MenuItem value="PARALLEL">Parallel flow</MenuItem>
                        <MenuItem value="CROSSFLOW">Crossflow</MenuItem>
                      </Select>
                    </FormControl>

                    {lmtdResult && (
                      <Alert
                        severity={lmtdResult.warnings.length > 0 ? 'warning' : 'success'}
                        sx={{ py: 0 }}
                      >
                        <strong>LMTD = {lmtdResult.correctedLMTD.toFixed(2)} °C</strong>
                        {lmtdResult.correctionFactor < 1 &&
                          ` (F = ${lmtdResult.correctionFactor.toFixed(3)})`}
                        {lmtdResult.warnings.map((w, i) => (
                          <Typography key={i} variant="caption" display="block">
                            {w}
                          </Typography>
                        ))}
                      </Alert>
                    )}
                  </Stack>
                </Paper>
                <Box sx={{ mt: 1 }}>
                  <Button
                    variant="contained"
                    size="small"
                    onClick={handleNext}
                    disabled={!step1Valid}
                    endIcon={<NextIcon />}
                  >
                    Next
                  </Button>
                </Box>
              </StepContent>
            </Step>

            {/* ── Step 2: HTC ── */}
            <Step>
              <StepLabel
                optional={
                  overallHTC ? (
                    <Typography variant="caption" color="success.main">
                      U = {overallHTC.toFixed(0)} W/m²·K
                      {previewArea && ` → A ≈ ${previewArea.toFixed(0)} m²`}
                    </Typography>
                  ) : undefined
                }
              >
                {STEPS[1]}
              </StepLabel>
              <StepContent>
                <Paper sx={{ p: 2 }}>
                  <Stack spacing={2}>
                    <FormControl fullWidth size="small">
                      <InputLabel>HTC Input</InputLabel>
                      <Select
                        value={htcMode}
                        label="HTC Input"
                        onChange={(e) => setHtcMode(e.target.value as typeof htcMode)}
                      >
                        <MenuItem value="manual">Enter U directly</MenuItem>
                        <MenuItem value="typical">Use typical value</MenuItem>
                      </Select>
                    </FormControl>

                    {htcMode === 'manual' && (
                      <TextField
                        label="Overall HTC (U)"
                        value={manualHTC}
                        onChange={(e) => setManualHTC(e.target.value)}
                        fullWidth
                        size="small"
                        type="number"
                        slotProps={{ input: { endAdornment: <Adornment>W/m²·K</Adornment> } }}
                      />
                    )}

                    {htcMode === 'typical' && (
                      <>
                        <FormControl fullWidth size="small">
                          <InputLabel>Service</InputLabel>
                          <Select
                            value={typicalHTCKey}
                            label="Service"
                            onChange={(e) => setTypicalHTCKey(e.target.value)}
                          >
                            {Object.entries(TYPICAL_HTC).map(([key, val]) => (
                              <MenuItem key={key} value={key}>
                                {key.replace(/_/g, ' ')} ({val.min}–{val.max})
                              </MenuItem>
                            ))}
                          </Select>
                        </FormControl>
                        {overallHTC && (
                          <Alert severity="info" sx={{ py: 0 }}>
                            Using typical: <strong>U = {overallHTC} W/m²·K</strong>
                          </Alert>
                        )}
                      </>
                    )}

                    {previewArea && (
                      <Alert severity="success" sx={{ py: 0 }}>
                        Preview: <strong>A = {previewArea.toFixed(1)} m²</strong> (clean, no fouling
                        margin)
                      </Alert>
                    )}

                    <Typography variant="caption" color="text.secondary">
                      Tip: Use the existing Heat Transfer Coefficients calculator for precise U from
                      Dittus-Boelter + Nusselt correlations, then enter the result here.
                    </Typography>
                  </Stack>
                </Paper>
                <Box sx={{ mt: 1, display: 'flex', gap: 1 }}>
                  <Button size="small" onClick={handleBack} startIcon={<BackIcon />}>
                    Back
                  </Button>
                  <Button
                    variant="contained"
                    size="small"
                    onClick={handleNext}
                    disabled={!step2Valid}
                    endIcon={<NextIcon />}
                  >
                    Next
                  </Button>
                </Box>
              </StepContent>
            </Step>

            {/* ── Step 3: Tube Geometry ── */}
            <Step>
              <StepLabel
                optional={
                  result ? (
                    <Typography variant="caption" color="success.main">
                      {result.actualTubeCount} tubes, shell {result.shellID} mm
                    </Typography>
                  ) : undefined
                }
              >
                {STEPS[2]}
              </StepLabel>
              <StepContent>
                <Paper sx={{ p: 2 }}>
                  <Stack spacing={2}>
                    <Grid container spacing={1.5}>
                      <Grid size={{ xs: 6 }}>
                        <FormControl fullWidth size="small">
                          <InputLabel>Tube OD</InputLabel>
                          <Select
                            value={tubeOD}
                            label="Tube OD"
                            onChange={(e) => {
                              setTubeOD(e.target.value as number);
                              const bwgs = getBWGsForOD(e.target.value as number);
                              if (bwgs.length > 0 && !bwgs.includes(tubeBWG)) setTubeBWG(bwgs[0]!);
                            }}
                          >
                            {distinctODs.map((od) => (
                              <MenuItem key={od} value={od}>
                                {od} mm ({(od / 25.4).toFixed(3)}&quot;)
                              </MenuItem>
                            ))}
                          </Select>
                        </FormControl>
                      </Grid>
                      <Grid size={{ xs: 6 }}>
                        <FormControl fullWidth size="small">
                          <InputLabel>BWG</InputLabel>
                          <Select
                            value={tubeBWG}
                            label="BWG"
                            onChange={(e) => setTubeBWG(e.target.value as number)}
                          >
                            {availableBWGs.map((bwg) => {
                              const spec = STANDARD_TUBES.find(
                                (t) => t.od_mm === tubeOD && t.bwg === bwg
                              );
                              return (
                                <MenuItem key={bwg} value={bwg}>
                                  BWG {bwg} ({spec?.wall_mm.toFixed(2)} mm wall, ID{' '}
                                  {spec?.id_mm.toFixed(2)} mm)
                                </MenuItem>
                              );
                            })}
                          </Select>
                        </FormControl>
                      </Grid>
                      <Grid size={{ xs: 6 }}>
                        <FormControl fullWidth size="small">
                          <InputLabel>Material</InputLabel>
                          <Select
                            value={tubeMaterial}
                            label="Material"
                            onChange={(e) => setTubeMaterial(e.target.value)}
                          >
                            {Object.entries(TUBE_MATERIALS).map(([key, mat]) => (
                              <MenuItem key={key} value={key}>
                                {mat.label} (k={mat.conductivity})
                              </MenuItem>
                            ))}
                          </Select>
                        </FormControl>
                      </Grid>
                      <Grid size={{ xs: 6 }}>
                        <FormControl fullWidth size="small">
                          <InputLabel>Layout</InputLabel>
                          <Select
                            value={tubeLayout}
                            label="Layout"
                            onChange={(e) => setTubeLayout(e.target.value as TubeLayout)}
                          >
                            {Object.entries(TUBE_LAYOUT_LABELS).map(([key, label]) => (
                              <MenuItem key={key} value={key}>
                                {label}
                              </MenuItem>
                            ))}
                          </Select>
                        </FormControl>
                      </Grid>
                      <Grid size={{ xs: 4 }}>
                        <TextField
                          label="Pitch Ratio"
                          value={pitchRatio}
                          onChange={(e) => setPitchRatio(e.target.value)}
                          fullWidth
                          size="small"
                          type="number"
                          helperText="≥ 1.25"
                        />
                      </Grid>
                      <Grid size={{ xs: 4 }}>
                        <FormControl fullWidth size="small">
                          <InputLabel>Passes</InputLabel>
                          <Select
                            value={tubePasses}
                            label="Passes"
                            onChange={(e) => setTubePasses(e.target.value as number)}
                          >
                            {[1, 2, 4, 6].map((p) => (
                              <MenuItem key={p} value={p}>
                                {p}
                              </MenuItem>
                            ))}
                          </Select>
                        </FormControl>
                      </Grid>
                      <Grid size={{ xs: 4 }}>
                        <TextField
                          label="Fouling %"
                          value={foulingMargin}
                          onChange={(e) => setFoulingMargin(e.target.value)}
                          fullWidth
                          size="small"
                          type="number"
                          helperText="Excess area"
                        />
                      </Grid>
                    </Grid>
                    <TextField
                      label="Effective Tube Length"
                      value={tubeLength}
                      onChange={(e) => setTubeLength(e.target.value)}
                      fullWidth
                      size="small"
                      type="number"
                      helperText="Between tube sheets"
                      slotProps={{ input: { endAdornment: <Adornment>m</Adornment> } }}
                    />
                  </Stack>
                </Paper>
                <Box sx={{ mt: 1 }}>
                  <Button size="small" onClick={handleBack} startIcon={<BackIcon />}>
                    Back
                  </Button>
                </Box>
              </StepContent>
            </Step>
          </Stepper>
        </Grid>

        {/* Right: Results */}
        <Grid size={{ xs: 12, lg: 7 }}>
          {sizingResult.error && (
            <Alert severity="error" sx={{ mb: 2 }}>
              {sizingResult.error}
            </Alert>
          )}

          {!result ? (
            <Paper
              sx={{
                p: 4,
                textAlign: 'center',
                bgcolor: 'action.hover',
                border: '2px dashed',
                borderColor: 'divider',
              }}
            >
              <Typography variant="body2" color="text.secondary">
                {!canSize
                  ? 'Complete Steps 1 and 2 to see sizing results'
                  : 'Configure tube geometry in Step 3'}
              </Typography>
            </Paper>
          ) : (
            <Stack spacing={2}>
              {/* Warnings */}
              {result.warnings.length > 0 && (
                <Alert severity="warning">
                  {result.warnings.map((w, i) => (
                    <Typography key={i} variant="body2">
                      {w}
                    </Typography>
                  ))}
                </Alert>
              )}

              {/* Key result cards */}
              <Grid container spacing={2}>
                {[
                  {
                    label: 'Required Area',
                    value: `${result.requiredArea.toFixed(1)} m²`,
                    sub: `Design: ${result.designArea.toFixed(1)} m²`,
                    color: '#e3f2fd',
                    border: '#1565c0',
                    text: 'primary.dark',
                  },
                  {
                    label: 'Tube Count',
                    value: `${result.actualTubeCount}`,
                    sub: `${result.excessArea.toFixed(0)}% excess`,
                    color: '#e8f5e9',
                    border: '#2e7d32',
                    text: 'success.dark',
                  },
                  {
                    label: 'Shell ID',
                    value: `${result.shellID} mm`,
                    sub: `Bundle: ${result.bundleDiameter.toFixed(0)} mm`,
                    color: '#fff8e1',
                    border: '#f57f17',
                    text: 'warning.dark',
                  },
                ].map((card) => (
                  <Grid key={card.label} size={{ xs: 12, sm: 4 }}>
                    <Box
                      sx={{
                        bgcolor: card.color,
                        border: `1.5px solid ${card.border}`,
                        borderRadius: 2,
                        p: 2,
                        textAlign: 'center',
                      }}
                    >
                      <Typography variant="caption" color={card.text} display="block">
                        {card.label}
                      </Typography>
                      <Typography variant="h6" color={card.text} fontWeight="bold">
                        {card.value}
                      </Typography>
                      <Typography variant="caption" color="text.secondary">
                        {card.sub}
                      </Typography>
                    </Box>
                  </Grid>
                ))}
              </Grid>

              {/* Geometry table */}
              <Paper sx={{ p: 2 }}>
                <Typography variant="subtitle2" gutterBottom>
                  Exchanger Geometry
                </Typography>
                <Table size="small">
                  <TableBody>
                    <TableRow>
                      <TdLabel>Tube</TdLabel>
                      <TdValue>
                        {result.tubeSpec.od_mm} mm OD × {result.tubeSpec.wall_mm.toFixed(2)} mm wall
                        (BWG {result.tubeSpec.bwg})
                      </TdValue>
                    </TableRow>
                    <TableRow>
                      <TdLabel>Material</TdLabel>
                      <TdValue>
                        {TUBE_MATERIALS[result.tubeMaterial]?.label} (k ={' '}
                        {result.tubeMaterialConductivity} W/m·K)
                      </TdValue>
                    </TableRow>
                    <TableRow>
                      <TdLabel>Layout</TdLabel>
                      <TdValue>
                        {TUBE_LAYOUT_LABELS[result.tubeLayout]}, pitch {result.tubePitch.toFixed(1)}{' '}
                        mm ({(result.tubePitch / result.tubeSpec.od_mm).toFixed(2)}×OD)
                      </TdValue>
                    </TableRow>
                    <TableRow>
                      <TdLabel>Tube passes</TdLabel>
                      <TdValue>{result.tubePasses}</TdValue>
                    </TableRow>
                    <TableRow>
                      <TdLabel>Tube length</TdLabel>
                      <TdValue>{result.tubeLength} m</TdValue>
                    </TableRow>
                    <TableRow>
                      <TdLabel>Tubes per pass</TdLabel>
                      <TdValue>{result.actualTubeCount / result.tubePasses}</TdValue>
                    </TableRow>
                    <TableRow>
                      <TdLabel bold>Actual area</TdLabel>
                      <TdValue bold>{result.actualArea.toFixed(1)} m²</TdValue>
                    </TableRow>
                    <TableRow>
                      <TdLabel>Bundle diameter</TdLabel>
                      <TdValue>{result.bundleDiameter.toFixed(0)} mm</TdValue>
                    </TableRow>
                    <TableRow>
                      <TdLabel bold>Shell ID</TdLabel>
                      <TdValue bold>
                        {result.shellID} mm ({(result.shellID / 25.4).toFixed(1)}&quot;)
                      </TdValue>
                    </TableRow>
                    <TableRow>
                      <TdLabel>Bundle clearance</TdLabel>
                      <TdValue>{result.bundleClearance.toFixed(0)} mm</TdValue>
                    </TableRow>
                    <TableRow>
                      <TdLabel>Tube-side flow area/pass</TdLabel>
                      <TdValue>{(result.tubeSideFlowArea * 1e4).toFixed(2)} cm²</TdValue>
                    </TableRow>
                  </TableBody>
                </Table>
              </Paper>

              {/* Velocity check (optional) */}
              <Accordion>
                <AccordionSummary expandIcon={<ExpandMoreIcon />}>
                  <Typography variant="subtitle2">Tube-side Velocity Check</Typography>
                </AccordionSummary>
                <AccordionDetails>
                  <Grid container spacing={1.5} sx={{ mb: 2 }}>
                    <Grid size={{ xs: 4 }}>
                      <TextField
                        label="Mass Flow"
                        value={tubeSideMassFlow}
                        onChange={(e) => setTubeSideMassFlow(e.target.value)}
                        fullWidth
                        size="small"
                        type="number"
                        slotProps={{ input: { endAdornment: <Adornment>ton/hr</Adornment> } }}
                      />
                    </Grid>
                    <Grid size={{ xs: 4 }}>
                      <TextField
                        label="Density"
                        value={tubeSideDensity}
                        onChange={(e) => setTubeSideDensity(e.target.value)}
                        fullWidth
                        size="small"
                        type="number"
                        slotProps={{ input: { endAdornment: <Adornment>kg/m³</Adornment> } }}
                      />
                    </Grid>
                    <Grid size={{ xs: 4 }}>
                      <TextField
                        label="Viscosity"
                        value={tubeSideViscosity}
                        onChange={(e) => setTubeSideViscosity(e.target.value)}
                        fullWidth
                        size="small"
                        type="number"
                        slotProps={{ input: { endAdornment: <Adornment>Pa·s</Adornment> } }}
                      />
                    </Grid>
                  </Grid>
                  {velocityCheck && (
                    <Table size="small">
                      <TableBody>
                        <TableRow>
                          <TdLabel>Tube-side velocity</TdLabel>
                          <TdValue bold>
                            {velocityCheck.velocity.toFixed(2)} m/s
                            {velocityCheck.velocity < 0.5 && (
                              <Chip
                                label="LOW"
                                size="small"
                                color="warning"
                                sx={{ ml: 1, height: 18, fontSize: '0.65rem' }}
                              />
                            )}
                            {velocityCheck.velocity > 3 && (
                              <Chip
                                label="HIGH"
                                size="small"
                                color="error"
                                sx={{ ml: 1, height: 18, fontSize: '0.65rem' }}
                              />
                            )}
                            {velocityCheck.velocity >= 0.5 && velocityCheck.velocity <= 3 && (
                              <Chip
                                label="OK"
                                size="small"
                                color="success"
                                sx={{ ml: 1, height: 18, fontSize: '0.65rem' }}
                              />
                            )}
                          </TdValue>
                        </TableRow>
                        <TableRow>
                          <TdLabel>Reynolds number</TdLabel>
                          <TdValue>{velocityCheck.reynoldsNumber.toLocaleString()}</TdValue>
                        </TableRow>
                        <TableRow>
                          <TdLabel>Est. pressure drop</TdLabel>
                          <TdValue>
                            {velocityCheck.pressureDrop.toLocaleString()} Pa (
                            {(velocityCheck.pressureDrop / 1000).toFixed(2)} kPa)
                          </TdValue>
                        </TableRow>
                      </TableBody>
                    </Table>
                  )}
                </AccordionDetails>
              </Accordion>

              {/* Action buttons */}
              <Stack direction="row" spacing={1}>
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
            </Stack>
          )}
        </Grid>
      </Grid>

      {/* Report dialog */}
      {reportOpen && result && (
        <Suspense fallback={<CircularProgress />}>
          <GenerateReportDialog
            open={reportOpen}
            onClose={() => setReportOpen(false)}
            result={result}
            heatDutyKW={heatDutyKW!}
            lmtd={lmtd!}
            overallHTC={overallHTC!}
            velocityCheck={velocityCheck}
          />
        </Suspense>
      )}

      {/* Save/Load Dialogs */}
      <SaveCalculationDialog
        open={saveOpen}
        onClose={() => setSaveOpen(false)}
        calculatorType="HEAT_EXCHANGER"
        inputs={{
          heatDutyMode,
          manualDuty,
          massFlowRate,
          inletTemp,
          outletTemp,
          latentFlowRate,
          satTemp,
          hotInlet,
          hotOutlet,
          coldInlet,
          coldOutlet,
          flowArrangement,
          htcMode,
          manualHTC,
          typicalHTCKey,
          tubeOD,
          tubeBWG,
          tubeMaterial,
          tubeLayout,
          pitchRatio,
          tubePasses,
          tubeLength,
          foulingMargin,
          tubeSideMassFlow,
          tubeSideDensity,
          tubeSideViscosity,
        }}
      />
      <LoadCalculationDialog
        open={loadOpen}
        onClose={() => setLoadOpen(false)}
        calculatorType="HEAT_EXCHANGER"
        onLoad={(inputs) => {
          if (typeof inputs.heatDutyMode === 'string')
            setHeatDutyMode(inputs.heatDutyMode as 'manual' | 'sensible' | 'latent');
          if (typeof inputs.manualDuty === 'string') setManualDuty(inputs.manualDuty);
          if (typeof inputs.massFlowRate === 'string') setMassFlowRate(inputs.massFlowRate);
          if (typeof inputs.inletTemp === 'string') setInletTemp(inputs.inletTemp);
          if (typeof inputs.outletTemp === 'string') setOutletTemp(inputs.outletTemp);
          if (typeof inputs.latentFlowRate === 'string') setLatentFlowRate(inputs.latentFlowRate);
          if (typeof inputs.satTemp === 'string') setSatTemp(inputs.satTemp);
          if (typeof inputs.hotInlet === 'string') setHotInlet(inputs.hotInlet);
          if (typeof inputs.hotOutlet === 'string') setHotOutlet(inputs.hotOutlet);
          if (typeof inputs.coldInlet === 'string') setColdInlet(inputs.coldInlet);
          if (typeof inputs.coldOutlet === 'string') setColdOutlet(inputs.coldOutlet);
          if (
            inputs.flowArrangement === 'COUNTER' ||
            inputs.flowArrangement === 'PARALLEL' ||
            inputs.flowArrangement === 'CROSSFLOW'
          )
            setFlowArrangement(inputs.flowArrangement);
          if (typeof inputs.htcMode === 'string')
            setHtcMode(inputs.htcMode as 'manual' | 'typical');
          if (typeof inputs.manualHTC === 'string') setManualHTC(inputs.manualHTC);
          if (typeof inputs.typicalHTCKey === 'string') setTypicalHTCKey(inputs.typicalHTCKey);
          if (typeof inputs.tubeOD === 'number') setTubeOD(inputs.tubeOD);
          if (typeof inputs.tubeBWG === 'number') setTubeBWG(inputs.tubeBWG);
          if (typeof inputs.tubeMaterial === 'string') setTubeMaterial(inputs.tubeMaterial);
          if (
            inputs.tubeLayout === 'triangular' ||
            inputs.tubeLayout === 'square' ||
            inputs.tubeLayout === 'rotated_square'
          )
            setTubeLayout(inputs.tubeLayout);
          if (typeof inputs.pitchRatio === 'string') setPitchRatio(inputs.pitchRatio);
          if (typeof inputs.tubePasses === 'number') setTubePasses(inputs.tubePasses);
          if (typeof inputs.tubeLength === 'string') setTubeLength(inputs.tubeLength);
          if (typeof inputs.foulingMargin === 'string') setFoulingMargin(inputs.foulingMargin);
          if (typeof inputs.tubeSideMassFlow === 'string')
            setTubeSideMassFlow(inputs.tubeSideMassFlow);
          if (typeof inputs.tubeSideDensity === 'string')
            setTubeSideDensity(inputs.tubeSideDensity);
          if (typeof inputs.tubeSideViscosity === 'string')
            setTubeSideViscosity(inputs.tubeSideViscosity);
        }}
      />
    </Container>
  );
}
