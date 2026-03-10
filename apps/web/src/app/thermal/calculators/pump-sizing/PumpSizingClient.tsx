'use client';

/**
 * Pump Sizing Calculator
 *
 * Calculate total differential head, hydraulic power, brake power,
 * and recommended motor size for centrifugal pump sizing.
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
  Button,
  CircularProgress,
} from '@mui/material';
import {
  PictureAsPdf as PdfIcon,
  FolderOpen as LoadIcon,
  Save as SaveIcon,
  RestartAlt as ResetIcon,
} from '@mui/icons-material';
import { CalculatorBreadcrumb } from '../components/CalculatorBreadcrumb';
import { calculateTDH } from '@/lib/thermal';
import { PumpSizingInputs, PumpSizingResults } from './components';

const GenerateReportDialog = lazy(() =>
  import('./components/GenerateReportDialog').then((m) => ({ default: m.GenerateReportDialog }))
);

import { SaveCalculationDialog } from './components/SaveCalculationDialog';
import { LoadCalculationDialog } from './components/LoadCalculationDialog';

export default function PumpSizingClient() {
  // Input state
  const [flowRate, setFlowRate] = useState<string>('');
  const [fluidDensity, setFluidDensity] = useState<string>('1000');
  const [suctionVesselPressure, setSuctionVesselPressure] = useState<string>('1.01325');
  const [dischargeVesselPressure, setDischargeVesselPressure] = useState<string>('1.01325');
  const [staticHead, setStaticHead] = useState<string>('0');
  const [suctionPressureDrop, setSuctionPressureDrop] = useState<string>('0');
  const [dischargePressureDrop, setDischargePressureDrop] = useState<string>('0');
  const [pumpEfficiency, setPumpEfficiency] = useState<string>('70');
  const [motorEfficiency, setMotorEfficiency] = useState<string>('95');

  const [reportOpen, setReportOpen] = useState(false);
  const [saveOpen, setSaveOpen] = useState(false);
  const [loadOpen, setLoadOpen] = useState(false);

  const handleReset = () => {
    setFlowRate('');
    setFluidDensity('1000');
    setSuctionVesselPressure('1.01325');
    setDischargeVesselPressure('1.01325');
    setStaticHead('0');
    setSuctionPressureDrop('0');
    setDischargePressureDrop('0');
    setPumpEfficiency('70');
    setMotorEfficiency('95');
  };

  // Calculate pump sizing
  const computed = useMemo(() => {
    try {
      const flow = parseFloat(flowRate);
      const density = parseFloat(fluidDensity);

      if (isNaN(flow) || flow <= 0 || isNaN(density) || density <= 0) return null;

      const suctionP = parseFloat(suctionVesselPressure);
      const dischargeP = parseFloat(dischargeVesselPressure);
      const head = parseFloat(staticHead);
      const suctionDp = parseFloat(suctionPressureDrop);
      const dischargeDp = parseFloat(dischargePressureDrop);
      const pumpEff = parseFloat(pumpEfficiency);
      const motorEff = parseFloat(motorEfficiency);

      if (isNaN(suctionP) || isNaN(dischargeP) || isNaN(head)) return null;
      if (isNaN(suctionDp) || isNaN(dischargeDp)) return null;
      if (isNaN(pumpEff) || isNaN(motorEff)) return null;

      return {
        result: calculateTDH({
          flowRate: flow,
          fluidDensity: density,
          suctionVesselPressure: suctionP,
          dischargeVesselPressure: dischargeP,
          staticHead: head,
          suctionPressureDrop: suctionDp,
          dischargePressureDrop: dischargeDp,
          pumpEfficiency: pumpEff / 100,
          motorEfficiency: motorEff / 100,
        }),
        error: null,
      };
    } catch (err) {
      return { result: null, error: err instanceof Error ? err.message : 'Calculation error' };
    }
  }, [
    flowRate,
    fluidDensity,
    suctionVesselPressure,
    dischargeVesselPressure,
    staticHead,
    suctionPressureDrop,
    dischargePressureDrop,
    pumpEfficiency,
    motorEfficiency,
  ]);

  const result = computed?.result ?? null;
  const error = computed?.error ?? null;

  return (
    <Container maxWidth="xl" sx={{ py: 4 }}>
      <CalculatorBreadcrumb calculatorName="Pump Sizing" />

      {/* Header */}
      <Box sx={{ mb: 4 }}>
        <Stack direction="row" alignItems="center" spacing={2} mb={1}>
          <Typography variant="h4" component="h1">
            Pump Sizing Calculator
          </Typography>
          <Chip label="Hydraulic Institute" size="small" color="primary" variant="outlined" />
        </Stack>
        <Typography variant="body1" color="text.secondary">
          Calculate total differential head, hydraulic power, brake power, and recommended motor
          size for centrifugal pump sizing.
        </Typography>
        <Stack direction="row" spacing={1} sx={{ mt: 1 }}>
          <Button
            startIcon={<LoadIcon />}
            size="small"
            onClick={() => setLoadOpen(true)}
          >
            Load Saved
          </Button>
          <Button startIcon={<ResetIcon />} size="small" onClick={handleReset}>
            Reset
          </Button>
        </Stack>
      </Box>

      <Grid container spacing={3}>
        {/* Input Section */}
        <Grid size={{ xs: 12, md: 5 }}>
          <Paper sx={{ p: 3 }}>
            <Typography variant="h6" gutterBottom>
              Input Parameters
            </Typography>

            <PumpSizingInputs
              flowRate={flowRate}
              fluidDensity={fluidDensity}
              suctionVesselPressure={suctionVesselPressure}
              dischargeVesselPressure={dischargeVesselPressure}
              staticHead={staticHead}
              suctionPressureDrop={suctionPressureDrop}
              dischargePressureDrop={dischargePressureDrop}
              pumpEfficiency={pumpEfficiency}
              motorEfficiency={motorEfficiency}
              onFlowRateChange={setFlowRate}
              onFluidDensityChange={setFluidDensity}
              onSuctionVesselPressureChange={setSuctionVesselPressure}
              onDischargeVesselPressureChange={setDischargeVesselPressure}
              onStaticHeadChange={setStaticHead}
              onSuctionPressureDropChange={setSuctionPressureDrop}
              onDischargePressureDropChange={setDischargePressureDrop}
              onPumpEfficiencyChange={setPumpEfficiency}
              onMotorEfficiencyChange={setMotorEfficiency}
            />
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
          {result && <PumpSizingResults result={result} />}

          {/* Empty State */}
          {!result && !error && (
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
                Enter flow rate to calculate pump sizing
              </Typography>
              <Typography variant="body2" color="text.secondary">
                Results will update automatically
              </Typography>
            </Paper>
          )}
        </Grid>
      </Grid>

      {/* Action Buttons */}
      {result && (
        <Box sx={{ mt: 2, display: 'flex', justifyContent: 'flex-end', gap: 1 }}>
          <Button variant="outlined" startIcon={<SaveIcon />} onClick={() => setSaveOpen(true)}>
            Save
          </Button>
          <Button variant="outlined" startIcon={<PdfIcon />} onClick={() => setReportOpen(true)}>
            Generate Report
          </Button>
        </Box>
      )}

      {/* Formulas */}
      <Box sx={{ mt: 4, p: 3, bgcolor: 'action.hover', borderRadius: 2 }}>
        <Typography variant="subtitle2" gutterBottom>
          Formulas
        </Typography>
        <Typography variant="body2" color="text.secondary" component="div">
          <ul style={{ margin: 0, paddingLeft: 20 }}>
            <li>
              <strong>TDH:</strong> H = (P_discharge - P_suction) / (ρ × g) + static_head +
              friction_losses / (ρ × g)
            </li>
            <li>
              <strong>Hydraulic Power:</strong> P = Q × ρ × g × H / 1000 (kW)
            </li>
            <li>
              <strong>Brake Power:</strong> BHP = P_hydraulic / η_pump
            </li>
            <li>
              <strong>Motor Power:</strong> P_motor = BHP / η_motor
            </li>
          </ul>
        </Typography>
        <Typography variant="body2" color="text.secondary" sx={{ mt: 2 }}>
          <strong>Reference:</strong> Hydraulic Institute Standards, Pump Handbook (Karassik)
        </Typography>
      </Box>

      {/* Report Dialog */}
      {reportOpen && result && (
        <Suspense fallback={<CircularProgress />}>
          <GenerateReportDialog
            open={reportOpen}
            onClose={() => setReportOpen(false)}
            result={result}
            inputs={{
              flowRate,
              fluidDensity,
              suctionVesselPressure,
              dischargeVesselPressure,
              staticHead,
              suctionPressureDrop,
              dischargePressureDrop,
              pumpEfficiency,
              motorEfficiency,
            }}
          />
        </Suspense>
      )}

      {/* Save/Load Dialogs */}
      <SaveCalculationDialog
        open={saveOpen}
        onClose={() => setSaveOpen(false)}
        calculatorType="PUMP_SIZING"
        inputs={{
          flowRate,
          fluidDensity,
          suctionVesselPressure,
          dischargeVesselPressure,
          staticHead,
          suctionPressureDrop,
          dischargePressureDrop,
          pumpEfficiency,
          motorEfficiency,
        }}
      />
      <LoadCalculationDialog
        open={loadOpen}
        onClose={() => setLoadOpen(false)}
        calculatorType="PUMP_SIZING"
        onLoad={(inputs) => {
          if (typeof inputs.flowRate === 'string') setFlowRate(inputs.flowRate);
          if (typeof inputs.fluidDensity === 'string') setFluidDensity(inputs.fluidDensity);
          if (typeof inputs.suctionVesselPressure === 'string')
            setSuctionVesselPressure(inputs.suctionVesselPressure);
          if (typeof inputs.dischargeVesselPressure === 'string')
            setDischargeVesselPressure(inputs.dischargeVesselPressure);
          if (typeof inputs.staticHead === 'string') setStaticHead(inputs.staticHead);
          if (typeof inputs.suctionPressureDrop === 'string')
            setSuctionPressureDrop(inputs.suctionPressureDrop);
          if (typeof inputs.dischargePressureDrop === 'string')
            setDischargePressureDrop(inputs.dischargePressureDrop);
          if (typeof inputs.pumpEfficiency === 'string') setPumpEfficiency(inputs.pumpEfficiency);
          if (typeof inputs.motorEfficiency === 'string')
            setMotorEfficiency(inputs.motorEfficiency);
        }}
      />
    </Container>
  );
}
