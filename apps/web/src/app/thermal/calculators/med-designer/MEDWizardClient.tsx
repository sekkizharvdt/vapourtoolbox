'use client';

import { useState, useMemo } from 'react';
import { Container, Typography, Box, Paper, Button, Stack, Chip, Alert } from '@mui/material';
import { PictureAsPdf as PdfIcon, RestartAlt as ResetIcon } from '@mui/icons-material';
import { CalculatorBreadcrumb } from '../components/CalculatorBreadcrumb';
import { designMED, type MEDDesignerResult, type GORConfigRow } from '@/lib/thermal';
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

  // ── Design result (computed when config is selected) ────────────────────
  const designResult = useMemo<MEDDesignerResult | null>(() => {
    if (selectedEffects === null) return null;
    const sf = parseFloat(steamFlow);
    const st = parseFloat(steamTemp);
    const sw = parseFloat(swTemp);
    const gor = parseFloat(targetGOR);
    if ([sf, st, sw, gor].some((v) => isNaN(v) || v <= 0)) return null;

    try {
      return designMED({
        steamFlow: sf,
        steamTemperature: st,
        seawaterTemperature: sw,
        targetGOR: gor,
        numberOfEffects: selectedEffects,
        numberOfPreheaters: selectedPreheaters,
      });
    } catch {
      return null;
    }
  }, [steamFlow, steamTemp, swTemp, targetGOR, selectedEffects, selectedPreheaters]);

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

      {/* ── Step 4: Review & Export ─────────────────────────────────────── */}
      {activeStep === 3 && designResult && (
        <Stack spacing={3}>
          <Paper sx={{ p: 3 }}>
            <Typography variant="subtitle1" gutterBottom fontWeight={600}>
              Step 4 — Review &amp; Export
            </Typography>
            <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
              Review the design summary and export PDF reports.
            </Typography>

            {/* Summary */}
            <Stack spacing={1}>
              <Typography>
                <strong>Configuration:</strong> {designResult.effects.length} effects,{' '}
                {designResult.preheaters.length} preheaters
              </Typography>
              <Typography>
                <strong>GOR:</strong> {fmt(designResult.achievedGOR)} (gross), Net:{' '}
                {fmt(designResult.achievedGOR - 0.985)}{' '}
              </Typography>
              <Typography>
                <strong>Distillate:</strong> {fmt(designResult.totalDistillate, 2)} T/h (
                {Math.round(designResult.totalDistillateM3Day)} m&sup3;/day)
              </Typography>
              <Typography>
                <strong>Steam:</strong> {fmt(designResult.inputs.steamFlow, 2)} T/h @{' '}
                {fmt(designResult.inputs.steamTemperature)}&deg;C
              </Typography>
              <Typography>
                <strong>Brine Recirculation:</strong> {fmt(designResult.totalBrineRecirculation)}{' '}
                T/h
              </Typography>
              <Typography>
                <strong>SW to Condenser:</strong>{' '}
                {Math.round(designResult.condenser.seawaterFlowM3h)} m&sup3;/h
              </Typography>
              {designResult.costEstimate && (
                <Typography>
                  <strong>Estimated Cost:</strong> $
                  {designResult.costEstimate.totalInstalledCost.toLocaleString()} (
                  {designResult.costEstimate.accuracy})
                </Typography>
              )}
            </Stack>
          </Paper>

          {/* Warnings */}
          {designResult.warnings.length > 0 && (
            <Alert severity="warning">
              {designResult.warnings.map((w, i) => (
                <div key={i}>{w}</div>
              ))}
            </Alert>
          )}

          {/* Export buttons */}
          <Stack direction="row" spacing={2}>
            <Button variant="contained" startIcon={<PdfIcon />} onClick={() => setReportOpen(true)}>
              Generate PDF Report
            </Button>
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
