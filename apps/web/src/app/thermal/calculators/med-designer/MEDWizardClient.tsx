'use client';

import { useState, useMemo, useEffect } from 'react';
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
  PlaylistAdd as ExportBOMIcon,
} from '@mui/icons-material';
import { CalculatorBreadcrumb } from '../components/CalculatorBreadcrumb';
import { designMED, type MEDDesignerResult } from '@/lib/thermal';
import { generateMEDBOM, type MEDCompleteBOM } from '@/lib/thermal';
import { WizardStepper } from './components/WizardStepper';
import { Step1Inputs } from './components/Step1Inputs';
import { Step2Geometry } from './components/Step2Geometry';
import { MEDProcessFlowDiagram } from './components/MEDProcessFlowDiagram';
import { MEDGeneralArrangement } from './components/MEDGeneralArrangement';
import { AuxiliaryEquipmentSections } from './components/AuxiliaryEquipmentSections';
import { GenerateReportDialog } from './components/GenerateReportDialog';
import { SaveCalculationDialog } from './components/SaveCalculationDialog';
import { LoadCalculationDialog } from './components/LoadCalculationDialog';
import { ExportToBOMDialog } from './components/ExportToBOMDialog';
import { getFirebase } from '@/lib/firebase';
import { computeCostEstimate } from '@/lib/thermal/med/costEstimation';
import type { MEDCostEstimate } from '@/lib/thermal/med/designerTypes';
import {
  MED_WIZARD_DEFAULTS,
  buildMEDSavePayload,
  restoreMEDWizardState,
  type VacuumConfig,
  type GeoMode,
  type GeoUniformFix,
} from './medWizardPersistence';

const STEPS = ['Design Inputs', 'Equipment & Geometry', 'Detailed Design', 'Review & Export'];

export default function MEDWizardClient() {
  // ── Step control ───────────────────────────────────────────────────────
  const [activeStep, setActiveStep] = useState(0);

  // ── Step 1: Primary inputs ─────────────────────────────────────────────
  // Initializers come from MED_WIZARD_DEFAULTS so save/load fallbacks can't
  // drift from fresh-wizard state (rule 22 round-trip; see medWizardPersistence.ts).
  const [steamFlow, setSteamFlow] = useState(MED_WIZARD_DEFAULTS.steamFlow);
  const [steamTemp, setSteamTemp] = useState(MED_WIZARD_DEFAULTS.steamTemp);
  const [swTemp, setSwTemp] = useState(MED_WIZARD_DEFAULTS.swTemp);
  const [swSalinity, setSwSalinity] = useState(MED_WIZARD_DEFAULTS.swSalinity);
  const [maxBrineSalinity, setMaxBrineSalinity] = useState(MED_WIZARD_DEFAULTS.maxBrineSalinity);
  const [numberOfEffects, setNumberOfEffects] = useState(MED_WIZARD_DEFAULTS.numberOfEffects);
  const [condenserApproach, setCondenserApproach] = useState(MED_WIZARD_DEFAULTS.condenserApproach);
  const [condenserOutletTemp, setCondenserOutletTemp] = useState(
    MED_WIZARD_DEFAULTS.condenserOutletTemp
  );
  const [preheaterEffects, setPreheaterEffects] = useState<number[]>(
    MED_WIZARD_DEFAULTS.preheaterEffects
  );
  const [preheaterTempRise, setPreheaterTempRise] = useState(MED_WIZARD_DEFAULTS.preheaterTempRise);
  const [preheaterTempRiseMap, setPreheaterTempRiseMap] = useState<Record<number, string>>(
    MED_WIZARD_DEFAULTS.preheaterTempRiseMap
  );
  const [tvcEnabled, setTvcEnabled] = useState(MED_WIZARD_DEFAULTS.tvcEnabled);
  const [tvcMotivePressure, setTvcMotivePressure] = useState(MED_WIZARD_DEFAULTS.tvcMotivePressure);
  const [tvcSuperheat, setTvcSuperheat] = useState(MED_WIZARD_DEFAULTS.tvcSuperheat);
  const [tvcEntrainedEffect, setTvcEntrainedEffect] = useState(
    MED_WIZARD_DEFAULTS.tvcEntrainedEffect
  );

  // ── Step 1: Advanced parameters ────────────────────────────────────────
  const [tubeMaterial, setTubeMaterial] = useState(MED_WIZARD_DEFAULTS.tubeMaterial);
  const [foulingResistance, setFoulingResistance] = useState(MED_WIZARD_DEFAULTS.foulingResistance);
  const [bpeSafetyFactor, setBpeSafetyFactor] = useState(MED_WIZARD_DEFAULTS.bpeSafetyFactor);
  const [designMargin, setDesignMargin] = useState(MED_WIZARD_DEFAULTS.designMargin);
  const [includeBrineRecirculation, setIncludeBrineRecirculation] = useState(
    MED_WIZARD_DEFAULTS.includeBrineRecirculation
  );
  const [antiscalantDose, setAntiscalantDose] = useState(MED_WIZARD_DEFAULTS.antiscalantDose);
  const [shellsPerEffect, setShellsPerEffect] = useState(MED_WIZARD_DEFAULTS.shellsPerEffect);
  const [vacuumConfig, setVacuumConfig] = useState<VacuumConfig>(MED_WIZARD_DEFAULTS.vacuumConfig);
  const [sealWaterTemp, setSealWaterTemp] = useState(MED_WIZARD_DEFAULTS.sealWaterTemp);
  const [sealWaterClosedLoop, setSealWaterClosedLoop] = useState(
    MED_WIZARD_DEFAULTS.sealWaterClosedLoop
  );
  const [sealWaterChillerCOP, setSealWaterChillerCOP] = useState(
    MED_WIZARD_DEFAULTS.sealWaterChillerCOP
  );
  const [includeTurndown, setIncludeTurndown] = useState(MED_WIZARD_DEFAULTS.includeTurndown);

  // ── Step 2: Geometry selection ──────────────────────────────────────────
  const [geoMode, setGeoMode] = useState<GeoMode>(MED_WIZARD_DEFAULTS.geoMode);
  const [geoValue, setGeoValue] = useState(MED_WIZARD_DEFAULTS.geoValue);
  const [geoUniformFix, setGeoUniformFix] = useState<GeoUniformFix>(
    MED_WIZARD_DEFAULTS.geoUniformFix
  );
  // % overdesign above max duty effect
  const [uniformMargin, setUniformMargin] = useState(MED_WIZARD_DEFAULTS.uniformMargin);

  // ── PDF dialog ─────────────────────────────────────────────────────────
  const [reportOpen, setReportOpen] = useState(false);

  // ── Save/Load ─────────────────────────────────────────────────────────
  const [saveOpen, setSaveOpen] = useState(false);
  const [loadOpen, setLoadOpen] = useState(false);

  // ── Export to Estimation BOM (A3) ─────────────────────────────────────
  const [exportBomOpen, setExportBomOpen] = useState(false);

  // ── Derived values ──────────────────────────────────────────────────────
  const nEff = parseInt(numberOfEffects, 10) || 6;

  const togglePreheater = (effNum: number) => {
    setPreheaterEffects((prev) =>
      prev.includes(effNum)
        ? prev.filter((e) => e !== effNum)
        : [...prev, effNum].sort((a, b) => a - b)
    );
  };

  // ── Design result (recomputed when inputs or geometry change) ────────────
  const designResult = useMemo<MEDDesignerResult | null>(() => {
    const sf = parseFloat(steamFlow);
    const st = parseFloat(steamTemp);
    const sw = parseFloat(swTemp);
    const sal = parseFloat(swSalinity);
    const maxBrine = parseFloat(maxBrineSalinity);
    const ca = parseFloat(condenserApproach);
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
      } else if (geoMode === 'uniform') {
        // Uniform: ALL effects get the same tubes AND length.
        // First run without overrides to get max required area, then derive both.
        try {
          const baseRun = designMED({
            steamFlow: sf,
            steamTemperature: st,
            seawaterTemperature: sw,
            targetGOR: 10,
            numberOfEffects: nEff,
            ...(preheaterEffects.length > 0 && { preheaterEffects }),
            numberOfPreheaters: preheaterEffects.length,
            ...(sal > 0 && { seawaterSalinity: sal }),
            ...(maxBrine > 0 && { maxBrineSalinity: maxBrine }),
          });
          const tubeOD = baseRun.inputs.tubeOD ?? 25.4;
          const areaPerTubePerM = (Math.PI * tubeOD) / 1000;
          const maxReqArea = Math.max(...baseRun.effects.map((e) => e.requiredArea));
          const marginFrac = 1 + (parseFloat(uniformMargin) || 15) / 100;
          const targetArea = maxReqArea * marginFrac;
          if (geoUniformFix === 'tubes') {
            const tubes = Math.round(gv);
            const length =
              tubes > 0 ? Math.ceil((targetArea / (tubes * areaPerTubePerM)) * 10) / 10 : 1;
            overrides.tubeCountOverrides = Array.from({ length: nEff }, () => tubes);
            overrides.tubeLengthOverrides = Array.from({ length: nEff }, () => length);
          } else {
            const length = gv;
            const tubes = length > 0 ? Math.ceil(targetArea / (areaPerTubePerM * length)) : 1;
            overrides.tubeCountOverrides = Array.from({ length: nEff }, () => tubes);
            overrides.tubeLengthOverrides = Array.from({ length: nEff }, () => length);
          }
        } catch {
          // Fallback: just pass the user's value, pipeline derives the other
          if (geoUniformFix === 'tubes') {
            overrides.tubeCountOverrides = Array.from({ length: nEff }, () => Math.round(gv));
          } else {
            overrides.tubeLengthOverrides = Array.from({ length: nEff }, () => gv);
          }
        }
      }
    }

    // TVC parameters
    const tvcParams: Record<string, unknown> = {};
    if (tvcEnabled) {
      const mp = parseFloat(tvcMotivePressure);
      if (!isNaN(mp) && mp > 0) {
        tvcParams.tvcEnabled = true;
        tvcParams.tvcMotivePressure = mp;
        const sh = parseFloat(tvcSuperheat);
        if (!isNaN(sh) && sh > 0) tvcParams.tvcSuperheat = sh;
        const ee = parseInt(tvcEntrainedEffect, 10);
        if (!isNaN(ee) && ee >= 1) tvcParams.tvcEntrainedEffect = ee;
      }
    }

    try {
      return designMED({
        steamFlow: sf,
        steamTemperature: st,
        seawaterTemperature: sw,
        targetGOR: 10, // not used by engine (steam-in paradigm), but required by type
        numberOfEffects: nEff,
        ...(preheaterEffects.length > 0 && { preheaterEffects }),
        numberOfPreheaters: preheaterEffects.length,
        ...(sal > 0 && { seawaterSalinity: sal }),
        ...(maxBrine > 0 && { maxBrineSalinity: maxBrine }),
        ...(!isNaN(ca) && ca > 0 && { condenserApproach: ca }),
        ...(condenserOutletTemp &&
          parseFloat(condenserOutletTemp) > sw && {
            condenserSWOutlet: parseFloat(condenserOutletTemp),
          }),
        tubeMaterialName: tubeMaterial,
        foulingResistance: parseFloat(foulingResistance) || 0.00015,
        bpeSafetyFactor: parseFloat(bpeSafetyFactor) || 1.1,
        designMargin: (parseFloat(designMargin) || 15) / 100,
        ...(preheaterTempRise && { preheaterTempRise: parseFloat(preheaterTempRise) || 4 }),
        ...(() => {
          const map: Record<number, number> = {};
          for (const [k, v] of Object.entries(preheaterTempRiseMap)) {
            const parsed = parseFloat(v);
            if (!isNaN(parsed) && parsed > 0) map[parseInt(k)] = parsed;
          }
          return Object.keys(map).length > 0 ? { preheaterTempRiseMap: map } : {};
        })(),
        includeBrineRecirculation,
        antiscalantDoseMgL: parseFloat(antiscalantDose) || 2,
        vacuumTrainConfig: vacuumConfig,
        ...(parseFloat(sealWaterTemp) > 0 && { sealWaterTempC: parseFloat(sealWaterTemp) }),
        ...(sealWaterClosedLoop && { sealWaterClosedLoop: true }),
        ...(parseFloat(sealWaterChillerCOP) > 0 && {
          sealWaterChillerCOP: parseFloat(sealWaterChillerCOP),
        }),
        ...(parseInt(shellsPerEffect) > 1 && { shellsPerEffect: parseInt(shellsPerEffect) }),
        ...(includeTurndown && { includeTurndown: true }),
        ...overrides,
        ...tvcParams,
      });
    } catch {
      return null;
    }
  }, [
    steamFlow,
    steamTemp,
    swTemp,
    swSalinity,
    maxBrineSalinity,
    condenserApproach,
    condenserOutletTemp,
    preheaterEffects,
    nEff,
    geoMode,
    geoValue,
    geoUniformFix,
    uniformMargin,
    tvcEnabled,
    tvcMotivePressure,
    tvcSuperheat,
    tvcEntrainedEffect,
    tubeMaterial,
    foulingResistance,
    bpeSafetyFactor,
    designMargin,
    preheaterTempRise,
    preheaterTempRiseMap,
    includeBrineRecirculation,
    antiscalantDose,
    vacuumConfig,
    sealWaterTemp,
    sealWaterClosedLoop,
    sealWaterChillerCOP,
    shellsPerEffect,
    includeTurndown,
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

  // ── Cost estimation (async — looks up material prices from database) ────
  const [costEstimate, setCostEstimate] = useState<MEDCostEstimate | null>(null);
  const [costLoading, setCostLoading] = useState(false);
  useEffect(() => {
    if (!bom || !designResult) {
      setCostEstimate(null);
      return;
    }
    let cancelled = false;
    setCostLoading(true);
    (async () => {
      try {
        const { db } = getFirebase();
        const estimate = await computeCostEstimate(bom, db, designResult.totalDistillateM3Day);
        if (!cancelled) setCostEstimate(estimate);
      } catch {
        if (!cancelled) setCostEstimate(null);
      } finally {
        if (!cancelled) setCostLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [bom, designResult]);

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

  const exportMaterialSummary = () => {
    if (!bom) return;
    const header = [
      'Material',
      'Form',
      'Specification',
      'BOM Items',
      'Total Qty',
      'Unit',
      'Net Weight (kg)',
      'Gross Weight incl. Wastage (kg)',
    ];
    const rows = bom.materialSummary.map((m) => [
      m.material,
      m.form,
      m.specification,
      String(m.itemCount),
      String(m.totalQuantity),
      m.unit,
      String(Math.round(m.totalNetWeight)),
      String(Math.round(m.totalGrossWeight)),
    ]);
    // Add total row
    const totalNet = bom.materialSummary.reduce((s, m) => s + m.totalNetWeight, 0);
    const totalGross = bom.materialSummary.reduce((s, m) => s + m.totalGrossWeight, 0);
    rows.push([
      'TOTAL',
      '',
      '',
      '',
      '',
      '',
      String(Math.round(totalNet)),
      String(Math.round(totalGross)),
    ]);
    downloadCSV([header, ...rows], 'MED_Material_Summary.csv');
  };

  const exportAllBOM = () => {
    exportEquipmentBOM();
    setTimeout(() => exportInstruments(), 200);
    setTimeout(() => exportValves(), 400);
    setTimeout(() => exportMaterialSummary(), 600);
  };

  // ── Handlers ───────────────────────────────────────────────────────────
  const handleReset = () => {
    setActiveStep(0);
    setSteamFlow('0.79');
    setSteamTemp('57');
    setSwTemp('30');
    setSwSalinity('35000');
    setMaxBrineSalinity('65000');
    setNumberOfEffects('6');
    setCondenserApproach('4');
    setCondenserOutletTemp('');
    setPreheaterEffects([]);
    setTvcEnabled(false);
    setTvcMotivePressure('10');
    setTvcSuperheat('0');
    setTvcEntrainedEffect('');
    setTubeMaterial('Al 5052');
    setFoulingResistance('0.00015');
    setDesignMargin('15');
    setGeoValue('1.2');
    setUniformMargin('15');
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
          swSalinity={swSalinity}
          maxBrineSalinity={maxBrineSalinity}
          numberOfEffects={numberOfEffects}
          condenserApproach={condenserApproach}
          condenserOutletTemp={condenserOutletTemp}
          preheaterEffects={preheaterEffects}
          tvcEnabled={tvcEnabled}
          tvcMotivePressure={tvcMotivePressure}
          tvcSuperheat={tvcSuperheat}
          tvcEntrainedEffect={tvcEntrainedEffect}
          onSteamFlowChange={setSteamFlow}
          onSteamTempChange={setSteamTemp}
          onSwTempChange={setSwTemp}
          onSwSalinityChange={setSwSalinity}
          onMaxBrineSalinityChange={setMaxBrineSalinity}
          onNumberOfEffectsChange={setNumberOfEffects}
          onCondenserApproachChange={setCondenserApproach}
          onCondenserOutletTempChange={setCondenserOutletTemp}
          onTogglePreheater={togglePreheater}
          preheaterTempRise={preheaterTempRise}
          onPreheaterTempRiseChange={setPreheaterTempRise}
          preheaterTempRiseMap={preheaterTempRiseMap}
          onPreheaterTempRiseMapChange={(effNum, val) =>
            setPreheaterTempRiseMap((prev) => ({ ...prev, [effNum]: val }))
          }
          onTvcEnabledChange={setTvcEnabled}
          onTvcMotivePressureChange={setTvcMotivePressure}
          onTvcSuperheatChange={setTvcSuperheat}
          onTvcEntrainedEffectChange={setTvcEntrainedEffect}
          tubeMaterial={tubeMaterial}
          foulingResistance={foulingResistance}
          designMargin={designMargin}
          onTubeMaterialChange={setTubeMaterial}
          onFoulingResistanceChange={setFoulingResistance}
          bpeSafetyFactor={bpeSafetyFactor}
          onBpeSafetyFactorChange={setBpeSafetyFactor}
          onDesignMarginChange={setDesignMargin}
          includeBrineRecirculation={includeBrineRecirculation}
          onIncludeBrineRecirculationChange={setIncludeBrineRecirculation}
          antiscalantDose={antiscalantDose}
          onAntiscalantDoseChange={setAntiscalantDose}
          vacuumConfig={vacuumConfig}
          sealWaterTemp={sealWaterTemp}
          onSealWaterTempChange={setSealWaterTemp}
          sealWaterClosedLoop={sealWaterClosedLoop}
          onSealWaterClosedLoopChange={setSealWaterClosedLoop}
          sealWaterChillerCOP={sealWaterChillerCOP}
          onSealWaterChillerCOPChange={setSealWaterChillerCOP}
          shellsPerEffect={shellsPerEffect}
          onShellsPerEffectChange={setShellsPerEffect}
          onVacuumConfigChange={(v) =>
            setVacuumConfig(v as 'single_ejector' | 'two_stage_ejector' | 'lrvp_only' | 'hybrid')
          }
          includeTurndown={includeTurndown}
          onIncludeTurndownChange={setIncludeTurndown}
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
          uniformMargin={uniformMargin}
          onUniformMarginChange={setUniformMargin}
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
              {Math.round(designResult.totalDistillateM3Day)} m&sup3;/day (clean conditions &mdash;
              production decreases with fouling over time)
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
                  <TableCell>Gross Distillate (hotwell)</TableCell>
                  <TableCell align="right">
                    {fmt(designResult.grossDistillate, 2)} T/h (extraction pump duty)
                  </TableCell>
                </TableRow>
                <TableRow>
                  <TableCell>Steam Condensate Return (out)</TableCell>
                  <TableCell align="right">
                    {fmt(designResult.steamCondensateReturn, 2)} T/h (branched back to heat source)
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

          {/* Auxiliary Equipment */}
          <AuxiliaryEquipmentSections result={designResult} />

          {/* Turndown Analysis */}
          {designResult.turndownAnalysis && (
            <Paper sx={{ p: 3 }}>
              <Typography variant="subtitle1" gutterBottom fontWeight={600}>
                Turndown Analysis
              </Typography>
              <Typography variant="body2" color="text.secondary" sx={{ mb: 1 }}>
                Minimum stable load: {designResult.turndownAnalysis.minimumLoadPercent}%
              </Typography>
              <Table size="small">
                <TableHead>
                  <TableRow>
                    <TableCell>Load</TableCell>
                    <TableCell align="right">Steam (T/h)</TableCell>
                    <TableCell align="right">Distillate (m&sup3;/day)</TableCell>
                    <TableCell align="right">GOR</TableCell>
                    <TableCell align="center">Wetting OK</TableCell>
                    <TableCell align="center">Siphons OK</TableCell>
                    <TableCell align="center">Feasible</TableCell>
                  </TableRow>
                </TableHead>
                <TableBody>
                  {designResult.turndownAnalysis.points.map((pt) => (
                    <TableRow
                      key={pt.loadPercent}
                      sx={{
                        bgcolor: !pt.feasible ? 'error.50' : undefined,
                      }}
                    >
                      <TableCell>{pt.loadPercent}%</TableCell>
                      <TableCell align="right">{fmt(pt.steamFlow, 2)}</TableCell>
                      <TableCell align="right">{Math.round(pt.distillateM3Day)}</TableCell>
                      <TableCell align="right">{fmt(pt.gor, 2)}</TableCell>
                      <TableCell align="center">
                        {pt.wettingAdequacy.every((w) => w.adequate) ? '\u2713' : '\u2717'}
                      </TableCell>
                      <TableCell align="center">{pt.siphonsSealOk ? '\u2713' : '\u2717'}</TableCell>
                      <TableCell align="center">
                        <Chip
                          label={pt.feasible ? 'Yes' : 'No'}
                          size="small"
                          color={pt.feasible ? 'success' : 'error'}
                          variant="outlined"
                        />
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
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
              <Button
                variant="outlined"
                startIcon={<ExportBOMIcon />}
                onClick={() => setExportBomOpen(true)}
                disabled={!bom}
              >
                Export to Estimation BOM
              </Button>
            </Stack>
          </Paper>

          {/* Cost Estimate */}
          {(costEstimate || costLoading) && (
            <Paper sx={{ p: 3 }}>
              <Typography variant="subtitle1" gutterBottom fontWeight={600}>
                Cost Estimate
              </Typography>
              {costLoading ? (
                <Typography variant="body2" color="text.secondary">
                  Looking up material prices...
                </Typography>
              ) : costEstimate ? (
                <Stack spacing={2}>
                  <Stack direction="row" spacing={4} flexWrap="wrap" useFlexGap>
                    <Box>
                      <Typography variant="caption" color="text.secondary">
                        Equipment Cost
                      </Typography>
                      <Typography variant="h5" fontWeight={700}>
                        {costEstimate.totalEquipmentCost.toLocaleString()} {costEstimate.currency}
                      </Typography>
                    </Box>
                    <Box>
                      <Typography variant="caption" color="text.secondary">
                        Cost per m&sup3;/day
                      </Typography>
                      <Typography variant="h6">
                        {costEstimate.costPerM3Day.toLocaleString()} {costEstimate.currency}
                      </Typography>
                    </Box>
                    <Box>
                      <Typography variant="caption" color="text.secondary">
                        Priced Items
                      </Typography>
                      <Typography variant="h6">
                        {costEstimate.pricedItemCount} /{' '}
                        {costEstimate.pricedItemCount + costEstimate.unpricedItemCount}
                      </Typography>
                    </Box>
                  </Stack>
                  {costEstimate.unpricedMaterials.length > 0 && (
                    <Typography variant="body2" color="warning.main">
                      Prices not available for: {costEstimate.unpricedMaterials.join(', ')}
                    </Typography>
                  )}
                </Stack>
              ) : null}
            </Paper>
          )}

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
                <Stack spacing={3}>
                  <Typography variant="body2">
                    <strong>Total Equipment Items:</strong> {bom.summary.totalEquipmentItems} |{' '}
                    <strong>Instruments:</strong> {bom.summary.totalInstruments} |{' '}
                    <strong>Valves:</strong> {bom.summary.totalValves}
                  </Typography>

                  {/* Category breakdown */}
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

                  {/* Material breakdown — consolidated by material type */}
                  <Typography variant="subtitle2">Material Breakdown</Typography>
                  <Table size="small">
                    <TableHead>
                      <TableRow>
                        <TableCell>Material</TableCell>
                        <TableCell align="right">Items</TableCell>
                        <TableCell align="right">Total Weight (kg)</TableCell>
                      </TableRow>
                    </TableHead>
                    <TableBody>
                      {(() => {
                        const matMap = new Map<string, { items: number; weight: number }>();
                        for (const item of bom.equipment) {
                          const key = item.material || 'Unspecified';
                          const prev = matMap.get(key) ?? { items: 0, weight: 0 };
                          matMap.set(key, {
                            items: prev.items + 1,
                            weight: prev.weight + item.totalWeightKg,
                          });
                        }
                        return Array.from(matMap.entries())
                          .sort((a, b) => b[1].weight - a[1].weight)
                          .map(([mat, data]) => (
                            <TableRow key={mat}>
                              <TableCell>{mat}</TableCell>
                              <TableCell align="right">{data.items}</TableCell>
                              <TableCell align="right">
                                {Math.round(data.weight).toLocaleString()}
                              </TableCell>
                            </TableRow>
                          ));
                      })()}
                    </TableBody>
                  </Table>

                  {/* Plant weight estimate */}
                  {designResult.weightEstimate && (
                    <>
                      <Typography variant="subtitle2">Plant Weight</Typography>
                      <Stack direction="row" spacing={4}>
                        <Box>
                          <Typography variant="caption" color="text.secondary">
                            Total Dry Weight
                          </Typography>
                          <Typography variant="h6">
                            {Math.round(
                              designResult.weightEstimate.totalDryWeight
                            ).toLocaleString()}{' '}
                            kg
                          </Typography>
                        </Box>
                        <Box>
                          <Typography variant="caption" color="text.secondary">
                            Total Operating Weight
                          </Typography>
                          <Typography variant="h6">
                            {Math.round(
                              designResult.weightEstimate.totalOperatingWeight
                            ).toLocaleString()}{' '}
                            kg
                          </Typography>
                        </Box>
                        <Box>
                          <Typography variant="caption" color="text.secondary">
                            Condenser
                          </Typography>
                          <Typography variant="h6">
                            {Math.round(
                              designResult.weightEstimate.condenserWeight
                            ).toLocaleString()}{' '}
                            kg
                          </Typography>
                        </Box>
                      </Stack>
                    </>
                  )}
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

          {/* Export to Estimation BOM (A3) */}
          <ExportToBOMDialog
            open={exportBomOpen}
            onClose={() => setExportBomOpen(false)}
            bom={bom}
            designResult={designResult}
          />
        </Stack>
      )}

      {/* Save/Load Dialogs */}
      <SaveCalculationDialog
        open={saveOpen}
        onClose={() => setSaveOpen(false)}
        calculatorType="MED_DESIGNER"
        inputs={buildMEDSavePayload({
          steamFlow,
          steamTemp,
          swTemp,
          swSalinity,
          maxBrineSalinity,
          numberOfEffects,
          condenserApproach,
          condenserOutletTemp,
          preheaterEffects,
          preheaterTempRise,
          preheaterTempRiseMap,
          tvcEnabled,
          tvcMotivePressure,
          tvcSuperheat,
          tvcEntrainedEffect,
          tubeMaterial,
          foulingResistance,
          bpeSafetyFactor,
          designMargin,
          includeBrineRecirculation,
          antiscalantDose,
          shellsPerEffect,
          vacuumConfig,
          sealWaterTemp,
          sealWaterClosedLoop,
          sealWaterChillerCOP,
          includeTurndown,
          geoMode,
          geoValue,
          geoUniformFix,
          uniformMargin,
        })}
      />
      <LoadCalculationDialog
        open={loadOpen}
        onClose={() => setLoadOpen(false)}
        calculatorType="MED_DESIGNER"
        onLoad={(inputs) => {
          // Restore EVERY design input (rule 22 round-trip). Keys missing from
          // old saves fall back to the fresh-wizard defaults.
          const restored = restoreMEDWizardState(inputs);
          setSteamFlow(restored.steamFlow);
          setSteamTemp(restored.steamTemp);
          setSwTemp(restored.swTemp);
          setSwSalinity(restored.swSalinity);
          setMaxBrineSalinity(restored.maxBrineSalinity);
          setNumberOfEffects(restored.numberOfEffects);
          setCondenserApproach(restored.condenserApproach);
          setCondenserOutletTemp(restored.condenserOutletTemp);
          setPreheaterEffects(restored.preheaterEffects);
          setPreheaterTempRise(restored.preheaterTempRise);
          setPreheaterTempRiseMap(restored.preheaterTempRiseMap);
          setTvcEnabled(restored.tvcEnabled);
          setTvcMotivePressure(restored.tvcMotivePressure);
          setTvcSuperheat(restored.tvcSuperheat);
          setTvcEntrainedEffect(restored.tvcEntrainedEffect);
          setTubeMaterial(restored.tubeMaterial);
          setFoulingResistance(restored.foulingResistance);
          setBpeSafetyFactor(restored.bpeSafetyFactor);
          setDesignMargin(restored.designMargin);
          setIncludeBrineRecirculation(restored.includeBrineRecirculation);
          setAntiscalantDose(restored.antiscalantDose);
          setShellsPerEffect(restored.shellsPerEffect);
          setVacuumConfig(restored.vacuumConfig);
          setSealWaterTemp(restored.sealWaterTemp);
          setSealWaterClosedLoop(restored.sealWaterClosedLoop);
          setSealWaterChillerCOP(restored.sealWaterChillerCOP);
          setIncludeTurndown(restored.includeTurndown);
          setGeoMode(restored.geoMode);
          setGeoValue(restored.geoValue);
          setGeoUniformFix(restored.geoUniformFix);
          setUniformMargin(restored.uniformMargin);
          // Return to step 1 after loading
          setActiveStep(0);
        }}
      />
    </Container>
  );
}
