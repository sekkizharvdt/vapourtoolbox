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
} from '@mui/icons-material';
import { CalculatorBreadcrumb } from '../components/CalculatorBreadcrumb';
import { designMED, type MEDDesignerResult, type GORConfigRow } from '@/lib/thermal';
import { generateMEDBOM, type MEDCompleteBOM } from '@/lib/thermal';
import { WizardStepper } from './components/WizardStepper';
import { Step1Inputs } from './components/Step1Inputs';
import { Step2Geometry } from './components/Step2Geometry';
import { MEDProcessFlowDiagram } from './components/MEDProcessFlowDiagram';
import { MEDGeneralArrangement } from './components/MEDGeneralArrangement';
import { GenerateReportDialog } from './components/GenerateReportDialog';

const STEPS = ['Inputs & GOR', 'Geometry', 'Detailed Design', 'Review & Export'];

export default function MEDWizardClient() {
  // ── Step control ───────────────────────────────────────────────────────
  const [activeStep, setActiveStep] = useState(0);

  // ── Step 1: Primary inputs ─────────────────────────────────────────────
  const [steamFlow, setSteamFlow] = useState('0.79');
  const [steamTemp, setSteamTemp] = useState('57');
  const [swTemp, setSwTemp] = useState('30');
  const [targetGOR, setTargetGOR] = useState('6');

  // ── Step 1 → 2: Selected configuration ─────────────────────────────────
  const [selectedEffects, setSelectedEffects] = useState<number | null>(null);
  const [selectedPreheaters, setSelectedPreheaters] = useState<number>(0);

  // ── Step 2: Geometry selection ──────────────────────────────────────────
  const [geoMode, setGeoMode] = useState<'fixed_length' | 'fixed_tubes'>('fixed_tubes');
  const [geoValue, setGeoValue] = useState('2000');

  // ── PDF dialog ─────────────────────────────────────────────────────────
  const [reportOpen, setReportOpen] = useState(false);

  // ── GOR configuration matrix ───────────────────────────────────────────
  const gorConfigs = useMemo<GORConfigRow[]>(() => {
    const sf = parseFloat(steamFlow);
    const st = parseFloat(steamTemp);
    const sw = parseFloat(swTemp);
    const gor = parseFloat(targetGOR);
    if ([sf, st, sw, gor].some((v) => isNaN(v) || v <= 0)) return [];

    try {
      // Generate configs for effects 5-10 × preheaters 0-5
      const configs: GORConfigRow[] = [];
      for (let nEff = 5; nEff <= 10; nEff++) {
        for (let nPH = 0; nPH <= Math.min(nEff - 2, 5); nPH++) {
          try {
            const r = designMED({
              steamFlow: sf,
              steamTemperature: st,
              seawaterTemperature: sw,
              targetGOR: gor,
              numberOfEffects: nEff,
              numberOfPreheaters: nPH,
            });
            configs.push({
              effects: nEff,
              preheaters: nPH,
              gor: r.achievedGOR,
              distillate: r.totalDistillate,
              outputM3Day: r.totalDistillateM3Day,
              gorDeviation: Math.abs(r.achievedGOR - gor),
              recommended: false,
              feedTemp:
                r.preheaters.length > 0
                  ? r.preheaters[r.preheaters.length - 1]!.swOutlet
                  : parseFloat(swTemp) + 5, // condenser outlet
              workDTPerEffect: r.effects[0]?.workingDeltaT ?? 0,
              feasible: r.effects.every((e) => e.areaMargin >= -15),
            });
          } catch {
            // Skip infeasible configs
          }
        }
      }
      return configs;
    } catch {
      return [];
    }
  }, [steamFlow, steamTemp, swTemp, targetGOR]);

  // ── Design result (recomputed with geometry overrides) ───────────────────
  const designResult = useMemo<MEDDesignerResult | null>(() => {
    if (selectedEffects === null) return null;
    const sf = parseFloat(steamFlow);
    const st = parseFloat(steamTemp);
    const sw = parseFloat(swTemp);
    const gor = parseFloat(targetGOR);
    const gv = parseFloat(geoValue);
    if ([sf, st, sw, gor].some((v) => isNaN(v) || v <= 0)) return null;

    // Build overrides from Step 2 geometry selection
    const overrides: Record<string, unknown> = {};
    if (!isNaN(gv) && gv > 0) {
      const nEff = selectedEffects;
      if (geoMode === 'fixed_tubes') {
        // Fixed tube count → pass as tubeCountOverrides for all effects
        overrides.tubeCountOverrides = Array.from({ length: nEff }, () => Math.round(gv));
      } else {
        // Fixed tube length → pass as tubeLengthOverrides for all effects
        overrides.tubeLengthOverrides = Array.from({ length: nEff }, () => gv);
      }
    }

    try {
      return designMED({
        steamFlow: sf,
        steamTemperature: st,
        seawaterTemperature: sw,
        targetGOR: gor,
        numberOfEffects: selectedEffects,
        numberOfPreheaters: selectedPreheaters,
        ...overrides,
      });
    } catch {
      return null;
    }
  }, [
    steamFlow,
    steamTemp,
    swTemp,
    targetGOR,
    selectedEffects,
    selectedPreheaters,
    geoMode,
    geoValue,
  ]);

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
  const handleSelectConfig = (effects: number, preheaters: number) => {
    setSelectedEffects(effects);
    setSelectedPreheaters(preheaters);
    setActiveStep(1); // Move to geometry step
  };

  const handleReset = () => {
    setActiveStep(0);
    setSelectedEffects(null);
    setSelectedPreheaters(0);
    setSteamFlow('0.79');
    setSteamTemp('57');
    setSwTemp('30');
    setTargetGOR('6');
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
          Design a complete MED plant in 4 steps. Start with your steam supply and target GOR, then
          select the number of effects and tube geometry.
        </Typography>
      </Box>

      <Box sx={{ mb: 2, display: 'flex', justifyContent: 'flex-end' }}>
        <Button variant="outlined" startIcon={<ResetIcon />} onClick={handleReset} size="small">
          Start Over
        </Button>
      </Box>

      <WizardStepper activeStep={activeStep} steps={STEPS} />

      {/* ── Step 1: Inputs & GOR Config ────────────────────────────────── */}
      {activeStep === 0 && (
        <Step1Inputs
          steamFlow={steamFlow}
          steamTemp={steamTemp}
          swTemp={swTemp}
          targetGOR={targetGOR}
          onSteamFlowChange={setSteamFlow}
          onSteamTempChange={setSteamTemp}
          onSwTempChange={setSwTemp}
          onTargetGORChange={setTargetGOR}
          gorConfigs={gorConfigs}
          onSelectConfig={handleSelectConfig}
        />
      )}

      {/* ── Step 2: Geometry ───────────────────────────────────────────── */}
      {activeStep === 1 && designResult && (
        <Step2Geometry
          result={designResult}
          geoMode={geoMode}
          geoValue={geoValue}
          onGeoModeChange={setGeoMode}
          onGeoValueChange={setGeoValue}
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

          {/* Condenser */}
          <Paper sx={{ p: 3 }}>
            <Typography variant="subtitle1" gutterBottom fontWeight={600}>
              Final Condenser
            </Typography>
            <Typography variant="body2">
              {fmt(designResult.condenser.vapourFlow, 3)} T/h @{' '}
              {fmt(designResult.condenser.vapourTemp)}&deg;C | Duty:{' '}
              {Math.round(designResult.condenser.duty)} kW | LMTD:{' '}
              {fmt(designResult.condenser.lmtd, 2)}&deg;C | U:{' '}
              {Math.round(designResult.condenser.overallU)} W/(m&sup2;&middot;K) |
              {designResult.condenser.tubes} tubes, {designResult.condenser.passes} passes | Vel:{' '}
              {fmt(designResult.condenser.velocity, 2)} m/s | Area:{' '}
              {fmt(designResult.condenser.designArea)} m&sup2; | SW:{' '}
              {Math.round(designResult.condenser.seawaterFlowM3h)} m&sup3;/h
            </Typography>
          </Paper>

          {/* Preheaters */}
          {designResult.preheaters.length > 0 && (
            <Paper sx={{ p: 3 }}>
              <Typography variant="subtitle1" gutterBottom fontWeight={600}>
                Preheaters
              </Typography>
              {designResult.preheaters.map((ph) => (
                <Typography key={ph.id} variant="body2">
                  PH{ph.id} ({ph.vapourSource}): {fmt(ph.swInlet)}&rarr;{fmt(ph.swOutlet)}&deg;C |
                  Flow: {fmt(ph.flowTh)} T/h | Duty: {Math.round(ph.duty)} kW |{ph.tubes} tubes,{' '}
                  {ph.passes} passes | Vel: {fmt(ph.velocity, 2)} m/s | Area: {fmt(ph.designArea)}{' '}
                  m&sup2;
                </Typography>
              ))}
            </Paper>
          )}

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
    </Container>
  );
}
