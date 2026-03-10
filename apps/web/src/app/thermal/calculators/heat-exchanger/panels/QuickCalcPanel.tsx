'use client';

/**
 * Quick Calc Panel — Heat Duty (Sensible / Latent / LMTD)
 *
 * Extracted from HeatDutyClient for the unified heat exchanger calculator.
 */

import { useState, useMemo, lazy, Suspense } from 'react';
import {
  Typography,
  Box,
  Paper,
  Grid,
  Alert,
  Divider,
  Button,
  CircularProgress,
  ToggleButton,
  ToggleButtonGroup,
} from '@mui/material';
import { PictureAsPdf as PdfIcon, Save as SaveIcon } from '@mui/icons-material';
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
} from '../../heat-duty/components';

const GenerateReportDialog = lazy(() =>
  import('../../heat-duty/components/GenerateReportDialog').then((m) => ({
    default: m.GenerateReportDialog,
  }))
);

import { SaveCalculationDialog } from '../../heat-duty/components/SaveCalculationDialog';
import { LoadCalculationDialog } from '../../heat-duty/components/LoadCalculationDialog';

interface QuickCalcPanelProps {
  /** Controls visibility — only renders when active */
  active: boolean;
}

export function QuickCalcPanel({ active }: QuickCalcPanelProps) {
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

  const [reportOpen, setReportOpen] = useState(false);
  const [saveOpen, setSaveOpen] = useState(false);
  const [loadOpen, setLoadOpen] = useState(false);

  // Calculate sensible heat
  const sensibleComputed = useMemo(() => {
    if (mode !== 'sensible') return { result: null, error: null };
    try {
      const flow = parseFloat(massFlowRate);
      const tIn = parseFloat(inletTemp);
      const tOut = parseFloat(outletTemp);
      if (isNaN(flow) || flow <= 0 || isNaN(tIn) || isNaN(tOut))
        return { result: null, error: null };
      return {
        result: calculateSensibleHeat({
          fluidType,
          salinity: fluidType === 'SEAWATER' ? parseFloat(salinity) || 35000 : undefined,
          massFlowRate: flow,
          inletTemperature: tIn,
          outletTemperature: tOut,
        }),
        error: null,
      };
    } catch (err) {
      return { result: null, error: err instanceof Error ? err.message : 'Calculation error' };
    }
  }, [mode, fluidType, salinity, massFlowRate, inletTemp, outletTemp]);

  // Calculate latent heat
  const latentComputed = useMemo(() => {
    if (mode !== 'latent') return { result: null, error: null };
    try {
      const flow = parseFloat(latentFlowRate);
      const temp = parseFloat(saturationTemp);
      if (isNaN(flow) || flow <= 0 || isNaN(temp)) return { result: null, error: null };
      return {
        result: calculateLatentHeat({ massFlowRate: flow, temperature: temp, process }),
        error: null,
      };
    } catch (err) {
      return { result: null, error: err instanceof Error ? err.message : 'Calculation error' };
    }
  }, [mode, latentFlowRate, saturationTemp, process]);

  // Calculate LMTD
  const lmtdComputed = useMemo(() => {
    if (mode !== 'lmtd') return { result: null, error: null };
    try {
      const hIn = parseFloat(hotInlet);
      const hOut = parseFloat(hotOutlet);
      const cIn = parseFloat(coldInlet);
      const cOut = parseFloat(coldOutlet);
      if (isNaN(hIn) || isNaN(hOut) || isNaN(cIn) || isNaN(cOut))
        return { result: null, error: null };
      return {
        result: calculateLMTD({
          hotInlet: hIn,
          hotOutlet: hOut,
          coldInlet: cIn,
          coldOutlet: cOut,
          flowArrangement,
        }),
        error: null,
      };
    } catch (err) {
      return { result: null, error: err instanceof Error ? err.message : 'Calculation error' };
    }
  }, [mode, hotInlet, hotOutlet, coldInlet, coldOutlet, flowArrangement]);

  const sensibleResult = sensibleComputed.result;
  const latentResult = latentComputed.result;
  const lmtdResult = lmtdComputed.result;
  const error = sensibleComputed.error || latentComputed.error || lmtdComputed.error;

  // Calculate required area
  const requiredArea = useMemo(() => {
    if (mode !== 'lmtd' || !lmtdResult) return null;
    const htc = parseFloat(overallHTC);
    const duty = parseFloat(heatDutyForArea);
    if (isNaN(htc) || htc <= 0 || isNaN(duty) || duty <= 0) return null;
    if (lmtdResult.correctedLMTD <= 0) return null;
    return calculateHeatExchangerArea(duty, htc, lmtdResult.correctedLMTD);
  }, [mode, lmtdResult, overallHTC, heatDutyForArea]);

  // Suppress unused var warning
  void (sensibleResult?.heatDuty || latentResult?.heatDuty);

  if (!active) return null;

  return (
    <>
      <Grid container spacing={3}>
        {/* Input Section */}
        <Grid size={{ xs: 12, md: 5 }}>
          <Paper sx={{ p: 3 }}>
            <Typography variant="h6" gutterBottom>
              Calculation Mode
            </Typography>

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

          {error && (
            <Alert severity="error" sx={{ mt: 2 }}>
              {error}
            </Alert>
          )}
        </Grid>

        {/* Results Section */}
        <Grid size={{ xs: 12, md: 7 }}>
          {mode === 'sensible' && sensibleResult && <SensibleHeatResult result={sensibleResult} />}
          {mode === 'latent' && latentResult && <LatentHeatResult result={latentResult} />}
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
              <strong>Sensible Heat:</strong> Q = m&#x0307; &times; Cp &times; &Delta;T (kW)
            </li>
            <li>
              <strong>Latent Heat:</strong> Q = m&#x0307; &times; hfg (kW)
            </li>
            <li>
              <strong>LMTD:</strong> (&Delta;T&#x2081; - &Delta;T&#x2082;) /
              ln(&Delta;T&#x2081;/&Delta;T&#x2082;) (&deg;C)
            </li>
            <li>
              <strong>Heat Exchanger:</strong> Q = U &times; A &times; LMTD
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
    </>
  );
}
