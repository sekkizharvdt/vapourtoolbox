'use client';

/**
 * Heat Duty Calculator
 *
 * Calculate sensible and latent heat duty for thermal processes
 * with LMTD calculation for heat exchanger sizing.
 */

import { useState, useMemo, lazy, Suspense } from 'react';
import {
  Container,
  Typography,
  Box,
  Paper,
  Grid,
  Alert,
  Divider,
  Chip,
  Stack,
  Button,
  CircularProgress,
  ToggleButton,
  ToggleButtonGroup,
} from '@mui/material';
import {
  PictureAsPdf as PdfIcon,
  FolderOpen as LoadIcon,
  Save as SaveIcon,
} from '@mui/icons-material';
import { CalculatorBreadcrumb } from '../components/CalculatorBreadcrumb';
import {
  calculateSensibleHeat,
  calculateLatentHeat,
  calculateLMTD,
  calculateHeatExchangerArea,
  type HeatFluidType,
  type FlowArrangement,
} from '@/lib/thermal';
import {
  type CalculationMode,
  SensibleHeatInputs,
  LatentHeatInputs,
  LMTDInputs,
  SensibleHeatResult,
  LatentHeatResult,
  LMTDResult,
  HTCReferenceTable,
} from './components';

const GenerateReportDialog = lazy(() =>
  import('./components/GenerateReportDialog').then((m) => ({ default: m.GenerateReportDialog }))
);

import { SaveCalculationDialog } from './components/SaveCalculationDialog';
import { LoadCalculationDialog } from './components/LoadCalculationDialog';

export default function HeatDutyClient() {
  // Mode
  const [mode, setMode] = useState<CalculationMode>('sensible');

  // Sensible heat inputs
  const [fluidType, setFluidType] = useState<HeatFluidType>('SEAWATER');
  const [salinity, setSalinity] = useState<string>('35000');
  const [massFlowRate, setMassFlowRate] = useState<string>('100');
  const [inletTemp, setInletTemp] = useState<string>('25');
  const [outletTemp, setOutletTemp] = useState<string>('40');

  // Latent heat inputs
  const [latentFlowRate, setLatentFlowRate] = useState<string>('10');
  const [saturationTemp, setSaturationTemp] = useState<string>('60');
  const [process, setProcess] = useState<'EVAPORATION' | 'CONDENSATION'>('EVAPORATION');

  // LMTD inputs
  const [hotInlet, setHotInlet] = useState<string>('90');
  const [hotOutlet, setHotOutlet] = useState<string>('50');
  const [coldInlet, setColdInlet] = useState<string>('25');
  const [coldOutlet, setColdOutlet] = useState<string>('40');
  const [flowArrangement, setFlowArrangement] = useState<FlowArrangement>('COUNTER');

  // Heat exchanger sizing
  const [overallHTC, setOverallHTC] = useState<string>('1500');
  const [heatDutyForArea, setHeatDutyForArea] = useState<string>('');

  const [error, setError] = useState<string | null>(null);
  const [reportOpen, setReportOpen] = useState(false);
  const [saveOpen, setSaveOpen] = useState(false);
  const [loadOpen, setLoadOpen] = useState(false);

  // Calculate sensible heat
  const sensibleResult = useMemo(() => {
    if (mode !== 'sensible') return null;
    setError(null);

    try {
      const flow = parseFloat(massFlowRate);
      const tIn = parseFloat(inletTemp);
      const tOut = parseFloat(outletTemp);

      if (isNaN(flow) || flow <= 0 || isNaN(tIn) || isNaN(tOut)) return null;

      return calculateSensibleHeat({
        fluidType,
        salinity: fluidType === 'SEAWATER' ? parseFloat(salinity) || 35000 : undefined,
        massFlowRate: flow,
        inletTemperature: tIn,
        outletTemperature: tOut,
      });
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Calculation error');
      return null;
    }
  }, [mode, fluidType, salinity, massFlowRate, inletTemp, outletTemp]);

  // Calculate latent heat
  const latentResult = useMemo(() => {
    if (mode !== 'latent') return null;
    setError(null);

    try {
      const flow = parseFloat(latentFlowRate);
      const temp = parseFloat(saturationTemp);

      if (isNaN(flow) || flow <= 0 || isNaN(temp)) return null;

      return calculateLatentHeat({
        massFlowRate: flow,
        temperature: temp,
        process,
      });
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Calculation error');
      return null;
    }
  }, [mode, latentFlowRate, saturationTemp, process]);

  // Calculate LMTD
  const lmtdResult = useMemo(() => {
    if (mode !== 'lmtd') return null;
    setError(null);

    try {
      const hIn = parseFloat(hotInlet);
      const hOut = parseFloat(hotOutlet);
      const cIn = parseFloat(coldInlet);
      const cOut = parseFloat(coldOutlet);

      if (isNaN(hIn) || isNaN(hOut) || isNaN(cIn) || isNaN(cOut)) return null;

      return calculateLMTD({
        hotInlet: hIn,
        hotOutlet: hOut,
        coldInlet: cIn,
        coldOutlet: cOut,
        flowArrangement,
      });
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Calculation error');
      return null;
    }
  }, [mode, hotInlet, hotOutlet, coldInlet, coldOutlet, flowArrangement]);

  // Calculate required area
  const requiredArea = useMemo(() => {
    if (mode !== 'lmtd' || !lmtdResult) return null;

    const htc = parseFloat(overallHTC);
    const duty = parseFloat(heatDutyForArea);

    if (isNaN(htc) || htc <= 0 || isNaN(duty) || duty <= 0) return null;
    if (lmtdResult.correctedLMTD <= 0) return null;

    return calculateHeatExchangerArea(duty, htc, lmtdResult.correctedLMTD);
  }, [mode, lmtdResult, overallHTC, heatDutyForArea]);

  // Note: currentHeatDuty could be used to auto-populate the heatDutyForArea field
  // Currently not implemented but keeping logic for potential future use
  void (sensibleResult?.heatDuty || latentResult?.heatDuty);

  return (
    <Container maxWidth="xl" sx={{ py: 4 }}>
      <CalculatorBreadcrumb calculatorName="Heat Duty" />

      {/* Header */}
      <Box sx={{ mb: 4 }}>
        <Stack direction="row" alignItems="center" spacing={2} mb={1}>
          <Typography variant="h4" component="h1">
            Heat Duty Calculator
          </Typography>
          <Chip label="First Law" size="small" color="primary" variant="outlined" />
        </Stack>
        <Typography variant="body1" color="text.secondary">
          Calculate sensible and latent heat duty for thermal processes. Includes LMTD calculation
          for heat exchanger sizing.
        </Typography>
        <Button
          startIcon={<LoadIcon />}
          size="small"
          onClick={() => setLoadOpen(true)}
          sx={{ mt: 1 }}
        >
          Load Saved
        </Button>
      </Box>

      <Grid container spacing={3}>
        {/* Input Section */}
        <Grid size={{ xs: 12, md: 5 }}>
          <Paper sx={{ p: 3 }}>
            <Typography variant="h6" gutterBottom>
              Calculation Mode
            </Typography>

            {/* Mode Toggle */}
            <ToggleButtonGroup
              value={mode}
              exclusive
              onChange={(_, v) => v && setMode(v)}
              fullWidth
              size="small"
              sx={{ mb: 3 }}
            >
              <ToggleButton value="sensible">Sensible</ToggleButton>
              <ToggleButton value="latent">Latent</ToggleButton>
              <ToggleButton value="lmtd">LMTD</ToggleButton>
            </ToggleButtonGroup>

            <Divider sx={{ mb: 2 }} />

            {/* Sensible Heat Inputs */}
            {mode === 'sensible' && (
              <SensibleHeatInputs
                fluidType={fluidType}
                salinity={salinity}
                massFlowRate={massFlowRate}
                inletTemp={inletTemp}
                outletTemp={outletTemp}
                onFluidTypeChange={setFluidType}
                onSalinityChange={setSalinity}
                onMassFlowRateChange={setMassFlowRate}
                onInletTempChange={setInletTemp}
                onOutletTempChange={setOutletTemp}
              />
            )}

            {/* Latent Heat Inputs */}
            {mode === 'latent' && (
              <LatentHeatInputs
                process={process}
                latentFlowRate={latentFlowRate}
                saturationTemp={saturationTemp}
                onProcessChange={setProcess}
                onLatentFlowRateChange={setLatentFlowRate}
                onSaturationTempChange={setSaturationTemp}
              />
            )}

            {/* LMTD Inputs */}
            {mode === 'lmtd' && (
              <LMTDInputs
                flowArrangement={flowArrangement}
                hotInlet={hotInlet}
                hotOutlet={hotOutlet}
                coldInlet={coldInlet}
                coldOutlet={coldOutlet}
                overallHTC={overallHTC}
                heatDutyForArea={heatDutyForArea}
                onFlowArrangementChange={setFlowArrangement}
                onHotInletChange={setHotInlet}
                onHotOutletChange={setHotOutlet}
                onColdInletChange={setColdInlet}
                onColdOutletChange={setColdOutlet}
                onOverallHTCChange={setOverallHTC}
                onHeatDutyForAreaChange={setHeatDutyForArea}
              />
            )}
          </Paper>

          {/* Error Display */}
          {error && (
            <Alert severity="error" sx={{ mt: 2 }}>
              {error}
            </Alert>
          )}
        </Grid>

        {/* Results Section */}
        <Grid size={{ xs: 12, md: 7 }}>
          {/* Sensible Heat Result */}
          {mode === 'sensible' && sensibleResult && <SensibleHeatResult result={sensibleResult} />}

          {/* Latent Heat Result */}
          {mode === 'latent' && latentResult && <LatentHeatResult result={latentResult} />}

          {/* LMTD Result */}
          {mode === 'lmtd' && lmtdResult && (
            <LMTDResult result={lmtdResult} requiredArea={requiredArea} />
          )}

          {/* Empty State */}
          {((mode === 'sensible' && !sensibleResult) ||
            (mode === 'latent' && !latentResult) ||
            (mode === 'lmtd' && !lmtdResult)) &&
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
                  Enter parameters to calculate heat duty
                </Typography>
                <Typography variant="body2" color="text.secondary">
                  Results will update automatically
                </Typography>
              </Paper>
            )}
        </Grid>
      </Grid>

      {/* Action Buttons */}
      {(sensibleResult || latentResult || lmtdResult) && (
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
      <HTCReferenceTable onHTCSelect={setOverallHTC} />

      {/* Info Section */}
      <Box sx={{ mt: 4, p: 3, bgcolor: 'action.hover', borderRadius: 2 }}>
        <Typography variant="subtitle2" gutterBottom>
          Formulas
        </Typography>
        <Typography variant="body2" color="text.secondary" component="div">
          <ul style={{ margin: 0, paddingLeft: 20 }}>
            <li>
              <strong>Sensible Heat:</strong> Q = ṁ × Cp × ΔT (kW)
            </li>
            <li>
              <strong>Latent Heat:</strong> Q = ṁ × hfg (kW)
            </li>
            <li>
              <strong>LMTD:</strong> (ΔT₁ - ΔT₂) / ln(ΔT₁/ΔT₂) (°C)
            </li>
            <li>
              <strong>Heat Exchanger:</strong> Q = U × A × LMTD
            </li>
          </ul>
        </Typography>
        <Typography variant="body2" color="text.secondary" sx={{ mt: 2 }}>
          <strong>Reference:</strong> Perry&apos;s Chemical Engineers&apos; Handbook
        </Typography>
      </Box>
      {/* Report Dialog */}
      {reportOpen && (
        <Suspense fallback={<CircularProgress />}>
          <GenerateReportDialog
            open={reportOpen}
            onClose={() => setReportOpen(false)}
            inputs={{
              mode,
              fluidType,
              salinity,
              massFlowRate,
              inletTemp,
              outletTemp,
              latentFlowRate,
              saturationTemp,
              process,
              hotInlet,
              hotOutlet,
              coldInlet,
              coldOutlet,
              flowArrangement,
              overallHTC,
              heatDutyForArea,
            }}
            sensibleResult={sensibleResult}
            latentResult={latentResult}
            lmtdResult={lmtdResult}
            requiredArea={requiredArea}
          />
        </Suspense>
      )}

      {/* Save/Load Dialogs */}
      <SaveCalculationDialog
        open={saveOpen}
        onClose={() => setSaveOpen(false)}
        calculatorType="HEAT_DUTY"
        inputs={{
          mode,
          fluidType,
          salinity,
          massFlowRate,
          inletTemp,
          outletTemp,
          latentFlowRate,
          saturationTemp,
          process,
          hotInlet,
          hotOutlet,
          coldInlet,
          coldOutlet,
          flowArrangement,
          overallHTC,
          heatDutyForArea,
        }}
      />
      <LoadCalculationDialog
        open={loadOpen}
        onClose={() => setLoadOpen(false)}
        calculatorType="HEAT_DUTY"
        onLoad={(inputs) => {
          if (typeof inputs.mode === 'string') setMode(inputs.mode as CalculationMode);
          if (typeof inputs.fluidType === 'string') setFluidType(inputs.fluidType as HeatFluidType);
          if (typeof inputs.salinity === 'string') setSalinity(inputs.salinity);
          if (typeof inputs.massFlowRate === 'string') setMassFlowRate(inputs.massFlowRate);
          if (typeof inputs.inletTemp === 'string') setInletTemp(inputs.inletTemp);
          if (typeof inputs.outletTemp === 'string') setOutletTemp(inputs.outletTemp);
          if (typeof inputs.latentFlowRate === 'string') setLatentFlowRate(inputs.latentFlowRate);
          if (typeof inputs.saturationTemp === 'string') setSaturationTemp(inputs.saturationTemp);
          if (inputs.process === 'EVAPORATION' || inputs.process === 'CONDENSATION')
            setProcess(inputs.process);
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
          if (typeof inputs.overallHTC === 'string') setOverallHTC(inputs.overallHTC);
          if (typeof inputs.heatDutyForArea === 'string')
            setHeatDutyForArea(inputs.heatDutyForArea);
        }}
      />
    </Container>
  );
}
