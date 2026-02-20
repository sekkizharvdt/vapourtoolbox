'use client';

/**
 * Pump Sizing Calculator
 *
 * Calculate total differential head, hydraulic power, brake power,
 * and recommended motor size for centrifugal pump sizing.
 */

import { useState, useMemo } from 'react';
import { Container, Typography, Box, Paper, Grid, Alert, Chip, Stack } from '@mui/material';
import { CalculatorBreadcrumb } from '../components/CalculatorBreadcrumb';
import { calculateTDH } from '@/lib/thermal';
import { PumpSizingInputs, PumpSizingResults } from './components';

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

  const [error, setError] = useState<string | null>(null);

  // Calculate pump sizing
  const result = useMemo(() => {
    setError(null);

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

      return calculateTDH({
        flowRate: flow,
        fluidDensity: density,
        suctionVesselPressure: suctionP,
        dischargeVesselPressure: dischargeP,
        staticHead: head,
        suctionPressureDrop: suctionDp,
        dischargePressureDrop: dischargeDp,
        pumpEfficiency: pumpEff / 100,
        motorEfficiency: motorEff / 100,
      });
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Calculation error');
      return null;
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
    </Container>
  );
}
