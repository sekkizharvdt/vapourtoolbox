'use client';

import { useState, useMemo } from 'react';
import {
  Container,
  Typography,
  Box,
  Paper,
  Button,
  Stack,
  Chip,
  Alert,
  Table,
  TableHead,
  TableBody,
  TableRow,
  TableCell,
  Tabs,
  Tab,
} from '@mui/material';
import {
  PictureAsPdf as PdfIcon,
  RestartAlt as ResetIcon,
  Download as DownloadIcon,
  Save as SaveIcon,
  FolderOpen as FolderOpenIcon,
} from '@mui/icons-material';
import { CalculatorBreadcrumb } from '../components/CalculatorBreadcrumb';
import { designMED, type MEDDesignerResult } from '@/lib/thermal';
import { generateMEDBOM, type MEDCompleteBOM } from '@/lib/thermal';
import { WizardStepper } from './components/WizardStepper';
import { Step1Inputs } from './components/Step1Inputs';
import { Step2Geometry } from './components/Step2Geometry';
import { MEDProcessFlowDiagram } from './components/MEDProcessFlowDiagram';
import { MEDGeneralArrangement } from './components/MEDGeneralArrangement';
import { GenerateReportDialog } from './components/GenerateReportDialog';
import { SaveCalculationDialog } from './components/SaveCalculationDialog';
import { LoadCalculationDialog } from './components/LoadCalculationDialog';

const STEPS = ['Design Inputs', 'Equipment & Geometry', 'Detailed Design', 'Review & Export'];

export default function MEDWizardClient() {
  // ── Step control ───────────────────────────────────────────────────────
  const [activeStep, setActiveStep] = useState(0);

  // ── Step 1: Primary inputs ─────────────────────────────────────────────
  const [steamFlow, setSteamFlow] = useState('0.79');
  const [steamTemp, setSteamTemp] = useState('57');
  const [swTemp, setSwTemp] = useState('30');
  const [numberOfEffects, setNumberOfEffects] = useState('6');
  const [numberOfPreheaters, setNumberOfPreheaters] = useState('0');

  // ── Step 2: Geometry selection ──────────────────────────────────────────
  const [geoMode, setGeoMode] = useState<'fixed_length' | 'fixed_tubes' | 'uniform'>('fixed_tubes');
  const [geoValue, setGeoValue] = useState('2000');
  const [geoUniformFix, setGeoUniformFix] = useState<'tubes' | 'length'>('tubes');

  // ── PDF dialog ─────────────────────────────────────────────────────────
  const [reportOpen, setReportOpen] = useState(false);

  // ── Save/Load ─────────────────────────────────────────────────────────
  const [saveOpen, setSaveOpen] = useState(false);
  const [loadOpen, setLoadOpen] = useState(false);

  // ── Design result (recomputed when inputs or geometry change) ────────────
  const designResult = useMemo<MEDDesignerResult | null>(() => {
    const sf = parseFloat(steamFlow);
    const st = parseFloat(steamTemp);
    const sw = parseFloat(swTemp);
    const nEff = parseInt(numberOfEffects, 10);
    const nPH = parseInt(numberOfPreheaters, 10);
    const gv = parseFloat(geoValue);
    if ([sf, st, sw].some((v) => isNaN(v) || v <= 0)) return null;
    if (isNaN(nEff) || nEff < 2) return null;

    // Build overrides from Step 2 geometry selection
    const overrides: Record<string, unknown> = {};
    if (!isNaN(gv) && gv > 0) {
      if (geoMode === 'fixed_tubes') {
        overrides.tubeCountOverrides = Array.from({ length: nEff }, () => Math.round(gv));
      } else if (geoMode === 'fixed_length') {
        overrides.tubeLengthOverrides = Array.from({ length: nEff }, () => gv);
      }
    }

    try {
      return designMED({
        steamFlow: sf,
        steamTemperature: st,
        seawaterTemperature: sw,
        targetGOR: 10, // not used by engine (steam-in paradigm), but required by type
        numberOfEffects: nEff,
        numberOfPreheaters: isNaN(nPH) ? 0 : nPH,
        ...overrides,
      });
    } catch {
      return null;
    }
  }, [steamFlow, steamTemp, swTemp, numberOfEffects, numberOfPreheaters, geoMode, geoValue]);

  // ── BOM generation ──────────────────────────────────────────────────────
  const bom = useMemo<MEDCompleteBOM | null>(() => {
    if (!designResult) return null;
    try {
      return generateMEDBOM(designResult);
    } catch {
      return null;
    }
  }, [designResult]);

  // ── BOM tab state ──────────────────────────────────────────────────────
  const [bomTab, setBomTab] = useState(0);

  // ── CSV export ─────────────────────────────────────────────────────────
  const downloadCSV = (data: string[][], filename: string) => {
    const csv = data.map((row) => row.map((cell) => `"${cell}"`).join(',')).join('\n');
    const blob = new Blob([csv], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    a.click();
    URL.revokeObjectURL(url);
  };

  const exportEquipmentBOM = () => {
    if (!bom) return;
    const header = [
      'Item',
      'Category',
      'Description',
      'Tag',
      'Qty',
      'Unit',
      'Material',
      'Specification',
      'Size',
      'Net Wt (kg)',
      'Wastage %',
      'Gross Wt (kg)',
      'Total Wt (kg)',
      'Notes',
    ];
    const rows = bom.equipment.map((e) => [
      e.itemNumber,
      e.category,
      e.description,
      e.tagNumber,
      String(e.quantity),
      e.unit,
      e.material,
      e.specification,
      e.size,
      String(e.netWeightKg),
      String(e.wastagePercent),
      String(e.grossWeightKg),
      String(e.totalWeightKg),
      e.notes ?? '',
    ]);
    downloadCSV([header, ...rows], 'MED_Equipment_BOM.csv');
  };

  const exportInstruments = () => {
    if (!bom) return;
    const header = [
      'Tag',
      'Type',
      'Service',
      'Location',
      'Range',
      'Connection',
      'Material',
      'Notes',
    ];
    const rows = bom.instruments.map((i) => [
      i.tagNumber,
      i.type,
      i.service,
      i.location,
      i.range,
      i.connection,
      i.material,
      i.notes ?? '',
    ]);
    downloadCSV([header, ...rows], 'MED_Instrument_Schedule.csv');
  };

  const exportValves = () => {
    if (!bom) return;
    const header = ['Tag', 'Type', 'Size', 'Rating', 'Material', 'Service', 'Location', 'Notes'];
    const rows = bom.valves.map((v) => [
      v.tagNumber,
      v.type,
      v.size,
      v.rating,
      v.material,
      v.service,
      v.location,
      v.notes ?? '',
    ]);
    downloadCSV([header, ...rows], 'MED_Valve_Schedule.csv');
  };

  const exportAllBOM = () => {
    exportEquipmentBOM();
    setTimeout(() => exportInstruments(), 200);
    setTimeout(() => exportValves(), 400);
  };

  // ── Handlers ───────────────────────────────────────────────────────────
  const handleReset = () => {
    setActiveStep(0);
    setSteamFlow('0.79');
    setSteamTemp('57');
    setSwTemp('30');
    setNumberOfEffects('6');
    setNumberOfPreheaters('0');
    setGeoValue('2000');
  };

  const fmt = (v: number, d = 1) => v.toFixed(d);

  return (
    <Container maxWidth="xl" sx={{ py: 4 }}>
      <CalculatorBreadcrumb calculatorName="MED Plant Designer" />

      <Box sx={{ mb: 3 }}>
        <Stack direction="row" alignItems="center" spacing={2} mb={1}>
          <Typography variant="h4" component="h1">
            MED Plant Designer
          </Typography>
          <Chip label="Multi-Effect Distillation" size="small" color="primary" variant="outlined" />
        </Stack>
        <Typography variant="body2" color="text.secondary" sx={{ maxWidth: 700 }}>
          Design a complete MED plant in 4 steps. Start with your steam supply and configuration,
          then refine the tube geometry and equipment sizing.
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
        >
          Save
        </Button>
        <Button variant="outlined" startIcon={<ResetIcon />} onClick={handleReset} size="small">
          Start Over
        </Button>
      </Box>

      <WizardStepper activeStep={activeStep} steps={STEPS} />

      {/* ── Step 1: Design Inputs ────────────────────────────────────── */}
      {activeStep === 0 && (
        <Step1Inputs
          steamFlow={steamFlow}
          steamTemp={steamTemp}
          swTemp={swTemp}
          numberOfEffects={numberOfEffects}
          numberOfPreheaters={numberOfPreheaters}
          onSteamFlowChange={setSteamFlow}
          onSteamTempChange={setSteamTemp}
          onSwTempChange={setSwTemp}
          onNumberOfEffectsChange={setNumberOfEffects}
          onNumberOfPreheatersChange={setNumberOfPreheaters}
          designResult={designResult}
          onProceed={() => setActiveStep(1)}
        />
      )}

      {/* ── Step 2: Geometry ───────────────────────────────────────────── */}
      {activeStep === 1 && designResult && (
        <Step2Geometry
          result={designResult}
          geoMode={geoMode}
          geoValue={geoValue}
          geoUniformFix={geoUniformFix}
          onGeoModeChange={setGeoMode}
          onGeoValueChange={setGeoValue}
          onGeoUniformFixChange={setGeoUniformFix}
          onBack={() => setActiveStep(0)}
          onNext={() => setActiveStep(2)}
        />
      )}

      {/* ── Step 3: Detailed Design ────────────────────────────────────── */}
      {activeStep === 2 && designResult && (
        <Stack spacing={3}>
          <Paper sx={{ p: 3 }}>
            <Typography variant="subtitle1" gutterBottom fontWeight={600}>
              Step 3 — Detailed Design
            </Typography>
            <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
              {designResult.effects.length} effects, {designResult.preheaters.length} preheaters,
              GOR {fmt(designResult.achievedGOR)}, Output:{' '}
              {Math.round(designResult.totalDistillateM3Day)} m&sup3;/day
            </Typography>
          </Paper>

          {/* PFD */}
          <MEDProcessFlowDiagram result={designResult} />

          {/* Condenser & Preheaters — side by side */}
          <Stack direction={{ xs: 'column', md: 'row' }} spacing={3}>
            {/* Condenser */}
            <Paper sx={{ p: 3, flex: 1 }}>
              <Typography variant="subtitle1" gutterBottom fontWeight={600}>
                Final Condenser
              </Typography>
              <Table size="small">
                <TableBody>
                  <TableRow>
                    <TableCell>Vapour</TableCell>
                    <TableCell align="right">
                      {fmt(designResult.condenser.vapourFlow, 3)} T/h @{' '}
                      {fmt(designResult.condenser.vapourTemp)}&deg;C
                    </TableCell>
                  </TableRow>
                  <TableRow>
                    <TableCell>Duty</TableCell>
                    <TableCell align="right">
                      {Math.round(designResult.condenser.duty)} kW
                    </TableCell>
                  </TableRow>
                  <TableRow>
                    <TableCell>LMTD</TableCell>
                    <TableCell align="right">{fmt(designResult.condenser.lmtd, 2)}&deg;C</TableCell>
                  </TableRow>
                  <TableRow>
                    <TableCell>U-value</TableCell>
                    <TableCell align="right">
                      {Math.round(designResult.condenser.overallU)} W/(m&sup2;&middot;K)
                    </TableCell>
                  </TableRow>
                  <TableRow>
                    <TableCell>Tubes / Passes</TableCell>
                    <TableCell align="right">
                      {designResult.condenser.tubes} tubes, {designResult.condenser.passes} passes
                    </TableCell>
                  </TableRow>
                  <TableRow>
                    <TableCell>Velocity</TableCell>
                    <TableCell align="right">
                      {fmt(designResult.condenser.velocity, 2)} m/s
                    </TableCell>
                  </TableRow>
                  <TableRow>
                    <TableCell>Design Area</TableCell>
                    <TableCell align="right">
                      {fmt(designResult.condenser.designArea)} m&sup2;
                    </TableCell>
                  </TableRow>
                  <TableRow>
                    <TableCell>SW Flow</TableCell>
                    <TableCell align="right">
                      {Math.round(designResult.condenser.seawaterFlowM3h)} m&sup3;/h
                    </TableCell>
                  </TableRow>
                  <TableRow>
                    <TableCell>Ti Tube</TableCell>
                    <TableCell align="right">
                      {designResult.condenser.tubeOD}mm OD &times;{' '}
                      {designResult.condenser.tubeLengthMM}mm L
                    </TableCell>
                  </TableRow>
                  <TableRow>
                    <TableCell>Shell</TableCell>
                    <TableCell align="right">OD {designResult.condenser.shellODmm} mm</TableCell>
                  </TableRow>
                </TableBody>
              </Table>
            </Paper>

            {/* Preheaters */}
            <Paper sx={{ p: 3, flex: 1 }}>
              <Typography variant="subtitle1" gutterBottom fontWeight={600}>
                Preheaters ({designResult.preheaters.length})
              </Typography>
              {designResult.preheaters.length > 0 ? (
                <Table size="small">
                  <TableHead>
                    <TableRow>
                      <TableCell>PH</TableCell>
                      <TableCell>Source</TableCell>
                      <TableCell align="right">SW In&rarr;Out</TableCell>
                      <TableCell align="right">Flow</TableCell>
                      <TableCell align="right">Duty</TableCell>
                      <TableCell align="right">Tubes</TableCell>
                      <TableCell align="right">Passes</TableCell>
                      <TableCell align="right">Vel</TableCell>
                      <TableCell align="right">Area</TableCell>
                    </TableRow>
                  </TableHead>
                  <TableBody>
                    {designResult.preheaters.map((ph) => (
                      <TableRow key={ph.id}>
                        <TableCell>PH{ph.id}</TableCell>
                        <TableCell sx={{ fontSize: '0.75rem' }}>{ph.vapourSource}</TableCell>
                        <TableCell align="right" sx={{ fontSize: '0.75rem' }}>
                          {fmt(ph.swInlet)}&rarr;{fmt(ph.swOutlet)}&deg;C
                        </TableCell>
                        <TableCell align="right">{fmt(ph.flowTh)}</TableCell>
                        <TableCell align="right">{Math.round(ph.duty)}</TableCell>
                        <TableCell align="right">{ph.tubes}</TableCell>
                        <TableCell align="right">{ph.passes}</TableCell>
                        <TableCell align="right">{fmt(ph.velocity, 2)}</TableCell>
                        <TableCell align="right">{fmt(ph.designArea)}</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              ) : (
                <Typography variant="body2" color="text.secondary">
                  No preheaters for this configuration.
                </Typography>
              )}
            </Paper>
          </Stack>

          {/* Mass Balance */}
          <Paper sx={{ p: 3 }}>
            <Typography variant="subtitle1" gutterBottom fontWeight={600}>
              Mass Balance
            </Typography>
            <Table size="small">
              <TableBody>
                <TableRow>
                  <TableCell>Heating Steam (in)</TableCell>
                  <TableCell align="right">
                    {fmt(designResult.inputs.steamFlow, 2)} T/h @{' '}
                    {fmt(designResult.inputs.steamTemperature)}&deg;C
                  </TableCell>
                </TableRow>
                <TableRow>
                  <TableCell>Net Distillate (out)</TableCell>
                  <TableCell align="right">
                    {fmt(designResult.totalDistillate, 2)} T/h (
                    {Math.round(designResult.totalDistillateM3Day)} m&sup3;/day)
                  </TableCell>
                </TableRow>
                <TableRow>
                  <TableCell>Make-up Seawater (in)</TableCell>
                  <TableCell align="right">
                    {fmt(designResult.makeUpFeed)} T/h @{' '}
                    {fmt(designResult.inputs.seawaterTemperature + 5)}&deg;C (after condenser)
                  </TableCell>
                </TableRow>
                <TableRow>
                  <TableCell>Brine Blowdown (out)</TableCell>
                  <TableCell align="right">
                    {fmt(designResult.brineBlowdown)} T/h @{' '}
                    {Number(
                      designResult.inputs.resolvedDefaults?.maxBrineSalinity ?? 65000
                    ).toLocaleString()}{' '}
                    ppm
                  </TableCell>
                </TableRow>
                <TableRow>
                  <TableCell>SW to Condenser (in)</TableCell>
                  <TableCell align="right">
                    {Math.round(designResult.condenser.seawaterFlowM3h)} m&sup3;/h (
                    {fmt(designResult.inputs.seawaterTemperature)}&rarr;
                    {fmt(designResult.inputs.seawaterTemperature + 5)}&deg;C)
                  </TableCell>
                </TableRow>
                <TableRow>
                  <TableCell>SW Reject (out)</TableCell>
                  <TableCell align="right">
                    {fmt(
                      (designResult.condenser.seawaterFlowM3h * 1.024) / 1000 -
                        designResult.makeUpFeed
                    )}{' '}
                    T/h
                  </TableCell>
                </TableRow>
                <TableRow>
                  <TableCell>Brine Recirculation</TableCell>
                  <TableCell align="right">
                    {fmt(designResult.totalBrineRecirculation)} T/h (blended TDS:{' '}
                    {(designResult.spraySalinity ?? 0).toLocaleString()} ppm)
                  </TableCell>
                </TableRow>
              </TableBody>
            </Table>
          </Paper>

          {/* GA Drawing */}
          <MEDGeneralArrangement result={designResult} />

          {/* Navigation */}
          <Stack direction="row" justifyContent="space-between">
            <Button startIcon={<Box />} onClick={() => setActiveStep(1)}>
              Back to Geometry
            </Button>
            <Button variant="contained" endIcon={<PdfIcon />} onClick={() => setActiveStep(3)}>
              Review &amp; Export
            </Button>
          </Stack>
        </Stack>
      )}

      {/* ── Step 4: Review, BOM & Export ────────────────────────────────── */}
      {activeStep === 3 && designResult && (
        <Stack spacing={3}>
          {/* Design Summary */}
          <Paper sx={{ p: 3 }}>
            <Typography variant="subtitle1" gutterBottom fontWeight={600}>
              Step 4 — Bill of Materials &amp; Export
            </Typography>
            <Stack direction="row" spacing={4} sx={{ mb: 2 }}>
              <Typography variant="body2">
                <strong>{designResult.effects.length}</strong> effects |{' '}
                <strong>GOR {fmt(designResult.achievedGOR)}</strong> |{' '}
                <strong>{Math.round(designResult.totalDistillateM3Day)} m&sup3;/day</strong>
              </Typography>
            </Stack>

            {/* Export buttons */}
            <Stack direction="row" spacing={2} sx={{ mb: 2 }}>
              <Button
                variant="contained"
                startIcon={<DownloadIcon />}
                onClick={exportAllBOM}
                disabled={!bom}
              >
                Export All BOM (CSV)
              </Button>
              <Button
                variant="outlined"
                startIcon={<DownloadIcon />}
                onClick={exportEquipmentBOM}
                disabled={!bom}
              >
                Equipment BOM
              </Button>
              <Button
                variant="outlined"
                startIcon={<DownloadIcon />}
                onClick={exportInstruments}
                disabled={!bom}
              >
                Instruments
              </Button>
              <Button
                variant="outlined"
                startIcon={<DownloadIcon />}
                onClick={exportValves}
                disabled={!bom}
              >
                Valves
              </Button>
              <Button
                variant="outlined"
                startIcon={<PdfIcon />}
                onClick={() => setReportOpen(true)}
              >
                PDF Report
              </Button>
            </Stack>
          </Paper>

          {/* BOM Tabs */}
          {bom && (
            <Paper sx={{ p: 3 }}>
              <Tabs value={bomTab} onChange={(_, v) => setBomTab(v)} sx={{ mb: 2 }}>
                <Tab label={`Equipment (${bom.equipment.length})`} />
                <Tab label={`Instruments (${bom.instruments.length})`} />
                <Tab label={`Valves (${bom.valves.length})`} />
                <Tab label="Summary" />
              </Tabs>

              {/* Equipment BOM */}
              {bomTab === 0 && (
                <Box sx={{ maxHeight: 500, overflow: 'auto' }}>
                  <Table size="small" stickyHeader>
                    <TableHead>
                      <TableRow>
                        <TableCell>Item</TableCell>
                        <TableCell>Description</TableCell>
                        <TableCell>Tag</TableCell>
                        <TableCell align="right">Qty</TableCell>
                        <TableCell>Material</TableCell>
                        <TableCell>Size</TableCell>
                        <TableCell align="right">Net (kg)</TableCell>
                        <TableCell align="right">Waste%</TableCell>
                        <TableCell align="right">Total (kg)</TableCell>
                      </TableRow>
                    </TableHead>
                    <TableBody>
                      {bom.equipment.map((e, i) => (
                        <TableRow key={i} sx={{ bgcolor: i % 2 ? 'action.hover' : undefined }}>
                          <TableCell sx={{ fontSize: '0.75rem' }}>{e.itemNumber}</TableCell>
                          <TableCell sx={{ fontSize: '0.75rem' }}>{e.description}</TableCell>
                          <TableCell sx={{ fontSize: '0.75rem' }}>{e.tagNumber}</TableCell>
                          <TableCell align="right">{e.quantity}</TableCell>
                          <TableCell sx={{ fontSize: '0.7rem' }}>{e.material}</TableCell>
                          <TableCell sx={{ fontSize: '0.7rem' }}>{e.size}</TableCell>
                          <TableCell align="right">
                            {e.netWeightKg > 0 ? e.netWeightKg.toLocaleString() : '—'}
                          </TableCell>
                          <TableCell align="right">
                            {e.wastagePercent > 0 ? e.wastagePercent + '%' : '—'}
                          </TableCell>
                          <TableCell align="right" sx={{ fontWeight: 600 }}>
                            {e.totalWeightKg > 0 ? e.totalWeightKg.toLocaleString() : '—'}
                          </TableCell>
                        </TableRow>
                      ))}
                      <TableRow sx={{ bgcolor: 'primary.main' }}>
                        <TableCell
                          colSpan={8}
                          sx={{ color: 'primary.contrastText', fontWeight: 600 }}
                        >
                          Total Equipment Weight
                        </TableCell>
                        <TableCell
                          align="right"
                          sx={{ color: 'primary.contrastText', fontWeight: 600 }}
                        >
                          {bom.summary.totalWeight.toLocaleString()} kg
                        </TableCell>
                      </TableRow>
                    </TableBody>
                  </Table>
                </Box>
              )}

              {/* Instrument Schedule */}
              {bomTab === 1 && (
                <Box sx={{ maxHeight: 500, overflow: 'auto' }}>
                  <Table size="small" stickyHeader>
                    <TableHead>
                      <TableRow>
                        <TableCell>Tag</TableCell>
                        <TableCell>Type</TableCell>
                        <TableCell>Service</TableCell>
                        <TableCell>Location</TableCell>
                        <TableCell>Range</TableCell>
                        <TableCell>Connection</TableCell>
                        <TableCell>Material</TableCell>
                        <TableCell>Notes</TableCell>
                      </TableRow>
                    </TableHead>
                    <TableBody>
                      {bom.instruments.map((inst, i) => (
                        <TableRow key={i} sx={{ bgcolor: i % 2 ? 'action.hover' : undefined }}>
                          <TableCell sx={{ fontWeight: 600 }}>{inst.tagNumber}</TableCell>
                          <TableCell>
                            <Chip label={inst.type} size="small" variant="outlined" />
                          </TableCell>
                          <TableCell sx={{ fontSize: '0.75rem' }}>{inst.service}</TableCell>
                          <TableCell sx={{ fontSize: '0.75rem' }}>{inst.location}</TableCell>
                          <TableCell sx={{ fontSize: '0.75rem' }}>{inst.range}</TableCell>
                          <TableCell sx={{ fontSize: '0.75rem' }}>{inst.connection}</TableCell>
                          <TableCell sx={{ fontSize: '0.7rem' }}>{inst.material}</TableCell>
                          <TableCell sx={{ fontSize: '0.7rem' }}>{inst.notes ?? ''}</TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </Box>
              )}

              {/* Valve Schedule */}
              {bomTab === 2 && (
                <Box sx={{ maxHeight: 500, overflow: 'auto' }}>
                  <Table size="small" stickyHeader>
                    <TableHead>
                      <TableRow>
                        <TableCell>Tag</TableCell>
                        <TableCell>Type</TableCell>
                        <TableCell>Size</TableCell>
                        <TableCell>Rating</TableCell>
                        <TableCell>Material</TableCell>
                        <TableCell>Service</TableCell>
                        <TableCell>Location</TableCell>
                        <TableCell>Notes</TableCell>
                      </TableRow>
                    </TableHead>
                    <TableBody>
                      {bom.valves.map((v, i) => (
                        <TableRow key={i} sx={{ bgcolor: i % 2 ? 'action.hover' : undefined }}>
                          <TableCell sx={{ fontWeight: 600 }}>{v.tagNumber}</TableCell>
                          <TableCell>{v.type}</TableCell>
                          <TableCell>{v.size}</TableCell>
                          <TableCell>{v.rating}</TableCell>
                          <TableCell sx={{ fontSize: '0.75rem' }}>{v.material}</TableCell>
                          <TableCell sx={{ fontSize: '0.75rem' }}>{v.service}</TableCell>
                          <TableCell sx={{ fontSize: '0.75rem' }}>{v.location}</TableCell>
                          <TableCell sx={{ fontSize: '0.7rem' }}>{v.notes ?? ''}</TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </Box>
              )}

              {/* Summary */}
              {bomTab === 3 && (
                <Stack spacing={2}>
                  <Typography variant="body2">
                    <strong>Total Equipment Items:</strong> {bom.summary.totalEquipmentItems} |{' '}
                    <strong>Instruments:</strong> {bom.summary.totalInstruments} |{' '}
                    <strong>Valves:</strong> {bom.summary.totalValves}
                  </Typography>
                  <Table size="small">
                    <TableHead>
                      <TableRow>
                        <TableCell>Category</TableCell>
                        <TableCell align="right">Items</TableCell>
                        <TableCell align="right">Weight (kg)</TableCell>
                      </TableRow>
                    </TableHead>
                    <TableBody>
                      {bom.summary.categories.map((cat) => (
                        <TableRow key={cat.category}>
                          <TableCell>{cat.category}</TableCell>
                          <TableCell align="right">{cat.items}</TableCell>
                          <TableCell align="right">{cat.weight.toLocaleString()}</TableCell>
                        </TableRow>
                      ))}
                      <TableRow sx={{ fontWeight: 600 }}>
                        <TableCell>
                          <strong>TOTAL</strong>
                        </TableCell>
                        <TableCell align="right">
                          <strong>{bom.summary.categories.reduce((s, c) => s + c.items, 0)}</strong>
                        </TableCell>
                        <TableCell align="right">
                          <strong>{bom.summary.totalWeight.toLocaleString()} kg</strong>
                        </TableCell>
                      </TableRow>
                    </TableBody>
                  </Table>
                </Stack>
              )}
            </Paper>
          )}

          {/* Warnings */}
          {designResult.warnings.length > 0 && (
            <Alert severity="warning">
              {designResult.warnings.map((w, i) => (
                <div key={i}>{w}</div>
              ))}
            </Alert>
          )}

          {/* Navigation */}
          <Stack direction="row" spacing={2}>
            <Button onClick={() => setActiveStep(2)}>Back to Design</Button>
            <Button onClick={() => setActiveStep(0)}>Start Over</Button>
          </Stack>

          {/* PDF Dialog */}
          <GenerateReportDialog
            open={reportOpen}
            onClose={() => setReportOpen(false)}
            result={designResult}
            options={[]}
          />
        </Stack>
      )}

      {/* Save/Load Dialogs */}
      <SaveCalculationDialog
        open={saveOpen}
        onClose={() => setSaveOpen(false)}
        calculatorType="MED_DESIGNER"
        inputs={{
          steamFlow,
          steamTemp,
          swTemp,
          numberOfEffects,
          numberOfPreheaters,
          geoMode,
          geoValue,
          geoUniformFix,
        }}
      />
      <LoadCalculationDialog
        open={loadOpen}
        onClose={() => setLoadOpen(false)}
        calculatorType="MED_DESIGNER"
        onLoad={(inputs) => {
          if (typeof inputs.steamFlow === 'string') setSteamFlow(inputs.steamFlow);
          if (typeof inputs.steamTemp === 'string') setSteamTemp(inputs.steamTemp);
          if (typeof inputs.swTemp === 'string') setSwTemp(inputs.swTemp);
          if (typeof inputs.numberOfEffects === 'string')
            setNumberOfEffects(inputs.numberOfEffects);
          if (typeof inputs.numberOfPreheaters === 'string')
            setNumberOfPreheaters(inputs.numberOfPreheaters);
          if (
            inputs.geoMode === 'fixed_length' ||
            inputs.geoMode === 'fixed_tubes' ||
            inputs.geoMode === 'uniform'
          )
            setGeoMode(inputs.geoMode);
          if (typeof inputs.geoValue === 'string') setGeoValue(inputs.geoValue);
          if (inputs.geoUniformFix === 'tubes' || inputs.geoUniformFix === 'length')
            setGeoUniformFix(inputs.geoUniformFix);
          // Return to step 1 after loading
          setActiveStep(0);
        }}
      />
    </Container>
  );
}
