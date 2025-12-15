'use client';

/**
 * Heat Duty Calculator
 *
 * Calculate sensible and latent heat duty for thermal processes
 * with LMTD calculation for heat exchanger sizing.
 */

import { useState, useMemo } from 'react';
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
  ToggleButton,
  ToggleButtonGroup,
} from '@mui/material';
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
    </Container>
  );
}
