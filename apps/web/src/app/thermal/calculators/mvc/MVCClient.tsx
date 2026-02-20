'use client';

import { useState, useMemo } from 'react';
import { Container, Typography, Box, Paper, Grid, Alert, Chip, Stack } from '@mui/material';
import { CalculatorBreadcrumb } from '../components/CalculatorBreadcrumb';
import { calculateMVC } from '@/lib/thermal';
import { MVCInputs, MVCResults } from './components';

export default function MVCClient() {
  const [suctionPressure, setSuctionPressure] = useState<string>('');
  const [suctionTemperature, setSuctionTemperature] = useState<string>('');
  const [dischargePressure, setDischargePressure] = useState<string>('');
  const [flowRate, setFlowRate] = useState<string>('');
  const [isentropicEfficiency, setIsentropicEfficiency] = useState<string>('75');
  const [mechanicalEfficiency, setMechanicalEfficiency] = useState<string>('95');

  const [error, setError] = useState<string | null>(null);

  const result = useMemo(() => {
    setError(null);

    try {
      const ps = parseFloat(suctionPressure);
      const pd = parseFloat(dischargePressure);
      const flow = parseFloat(flowRate);

      if (isNaN(ps) || ps <= 0 || isNaN(pd) || pd <= 0) return null;
      if (isNaN(flow) || flow <= 0) return null;

      const suctionTemp = parseFloat(suctionTemperature);
      const etaIs = parseFloat(isentropicEfficiency);
      const etaMech = parseFloat(mechanicalEfficiency);

      return calculateMVC({
        suctionPressure: ps,
        suctionTemperature: isNaN(suctionTemp) ? undefined : suctionTemp,
        dischargePressure: pd,
        flowRate: flow,
        isentropicEfficiency: isNaN(etaIs) ? undefined : etaIs / 100,
        mechanicalEfficiency: isNaN(etaMech) ? undefined : etaMech / 100,
      });
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Calculation error');
      return null;
    }
  }, [
    suctionPressure,
    suctionTemperature,
    dischargePressure,
    flowRate,
    isentropicEfficiency,
    mechanicalEfficiency,
  ]);

  return (
    <Container maxWidth="xl" sx={{ py: 4 }}>
      <CalculatorBreadcrumb calculatorName="MVC" />

      <Box sx={{ mb: 4 }}>
        <Stack direction="row" alignItems="center" spacing={2} mb={1}>
          <Typography variant="h4" component="h1">
            Mechanical Vapour Compressor (MVC)
          </Typography>
          <Chip label="Isentropic Compression" size="small" color="primary" variant="outlined" />
        </Stack>
        <Typography variant="body1" color="text.secondary">
          Calculate shaft power, discharge conditions, and specific energy for isentropic vapor
          compression.
        </Typography>
      </Box>

      <Grid container spacing={3}>
        <Grid size={{ xs: 12, md: 5 }}>
          <Paper sx={{ p: 3 }}>
            <Typography variant="h6" gutterBottom>
              Input Parameters
            </Typography>
            <MVCInputs
              suctionPressure={suctionPressure}
              suctionTemperature={suctionTemperature}
              dischargePressure={dischargePressure}
              flowRate={flowRate}
              isentropicEfficiency={isentropicEfficiency}
              mechanicalEfficiency={mechanicalEfficiency}
              onSuctionPressureChange={setSuctionPressure}
              onSuctionTemperatureChange={setSuctionTemperature}
              onDischargePressureChange={setDischargePressure}
              onFlowRateChange={setFlowRate}
              onIsentropicEfficiencyChange={setIsentropicEfficiency}
              onMechanicalEfficiencyChange={setMechanicalEfficiency}
            />
          </Paper>

          {error && (
            <Alert severity="error" sx={{ mt: 2 }}>
              {error}
            </Alert>
          )}
        </Grid>

        <Grid size={{ xs: 12, md: 7 }}>
          {result && <MVCResults result={result} />}

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
                Enter pressures and flow to calculate compressor performance
              </Typography>
              <Typography variant="body2" color="text.secondary">
                Results will update automatically
              </Typography>
            </Paper>
          )}
        </Grid>
      </Grid>

      <Box sx={{ mt: 4, p: 3, bgcolor: 'action.hover', borderRadius: 2 }}>
        <Typography variant="subtitle2" gutterBottom>
          Method
        </Typography>
        <Typography variant="body2" color="text.secondary" component="div">
          <ul style={{ margin: 0, paddingLeft: 20 }}>
            <li>
              <strong>Isentropic Compression:</strong> W_is = m_dot x (h_out_s - h_in)
            </li>
            <li>
              <strong>Actual Discharge:</strong> h_out = h_in + (h_out_s - h_in) / eta_is
            </li>
            <li>
              <strong>Electrical Power:</strong> W_elec = W_shaft / eta_mech
            </li>
          </ul>
        </Typography>
        <Typography variant="body2" color="text.secondary" sx={{ mt: 2 }}>
          <strong>Reference:</strong> Smith, Van Ness &amp; Abbott, Introduction to Chemical
          Engineering Thermodynamics
        </Typography>
      </Box>
    </Container>
  );
}
