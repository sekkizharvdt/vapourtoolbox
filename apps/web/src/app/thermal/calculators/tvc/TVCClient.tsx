'use client';

import { useState, useMemo } from 'react';
import { Container, Typography, Box, Paper, Grid, Alert, Chip, Stack } from '@mui/material';
import { CalculatorBreadcrumb } from '../components/CalculatorBreadcrumb';
import { calculateTVC, calculateDesuperheating } from '@/lib/thermal';
import type { DesuperheatingResult } from '@/lib/thermal';
import { TVCInputs, TVCResults } from './components';

export default function TVCClient() {
  const [motivePressure, setMotivePressure] = useState<string>('');
  const [motiveTemperature, setMotiveTemperature] = useState<string>('');
  const [suctionPressure, setSuctionPressure] = useState<string>('');
  const [dischargePressure, setDischargePressure] = useState<string>('');
  const [flowMode, setFlowMode] = useState<'entrained' | 'motive'>('entrained');
  const [flowValue, setFlowValue] = useState<string>('');
  const [desuperheatEnabled, setDesuperheatEnabled] = useState<boolean>(false);
  const [sprayWaterTemperature, setSprayWaterTemperature] = useState<string>('25');

  const [error, setError] = useState<string | null>(null);

  const result = useMemo(() => {
    setError(null);

    try {
      const pm = parseFloat(motivePressure);
      const ps = parseFloat(suctionPressure);
      const pc = parseFloat(dischargePressure);
      const flow = parseFloat(flowValue);

      if (isNaN(pm) || pm <= 0 || isNaN(ps) || ps <= 0 || isNaN(pc) || pc <= 0) return null;
      if (isNaN(flow) || flow <= 0) return null;

      const motiveTemp = parseFloat(motiveTemperature);

      return calculateTVC({
        motivePressure: pm,
        suctionPressure: ps,
        dischargePressure: pc,
        motiveTemperature: isNaN(motiveTemp) ? undefined : motiveTemp,
        entrainedFlow: flowMode === 'entrained' ? flow : undefined,
        motiveFlow: flowMode === 'motive' ? flow : undefined,
      });
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Calculation error');
      return null;
    }
  }, [motivePressure, motiveTemperature, suctionPressure, dischargePressure, flowMode, flowValue]);

  const desuperheatingResult = useMemo((): DesuperheatingResult | null => {
    if (!result || !desuperheatEnabled) return null;
    if (result.dischargeSuperheat <= 0) return null;

    try {
      const sprayTemp = parseFloat(sprayWaterTemperature);
      if (isNaN(sprayTemp)) return null;

      const pc = parseFloat(dischargePressure);

      return calculateDesuperheating({
        steamPressure: pc,
        steamTemperature: result.dischargeTemperature,
        targetTemperature: result.dischargeSatTemperature + 2, // Target 2°C above saturation
        sprayWaterTemperature: sprayTemp,
        steamFlow: result.dischargeFlow,
      });
    } catch {
      return null;
    }
  }, [result, desuperheatEnabled, sprayWaterTemperature, dischargePressure]);

  return (
    <Container maxWidth="xl" sx={{ py: 4 }}>
      <CalculatorBreadcrumb calculatorName="TVC" />

      <Box sx={{ mb: 4 }}>
        <Stack direction="row" alignItems="center" spacing={2} mb={1}>
          <Typography variant="h4" component="h1">
            Thermo Vapour Compressor (TVC)
          </Typography>
          <Chip label="1-D Model (Huang 1999)" size="small" color="primary" variant="outlined" />
        </Stack>
        <Typography variant="body1" color="text.secondary">
          Calculate entrainment ratio, flows, and energy balance for steam ejectors used in MED
          desalination.
        </Typography>
      </Box>

      <Grid container spacing={3}>
        <Grid size={{ xs: 12, md: 5 }}>
          <Paper sx={{ p: 3 }}>
            <Typography variant="h6" gutterBottom>
              Input Parameters
            </Typography>
            <TVCInputs
              motivePressure={motivePressure}
              motiveTemperature={motiveTemperature}
              suctionPressure={suctionPressure}
              dischargePressure={dischargePressure}
              flowMode={flowMode}
              flowValue={flowValue}
              desuperheatEnabled={desuperheatEnabled}
              sprayWaterTemperature={sprayWaterTemperature}
              showDesuperheatOption={result !== null && result.dischargeSuperheat > 0}
              onMotivePressureChange={setMotivePressure}
              onMotiveTemperatureChange={setMotiveTemperature}
              onSuctionPressureChange={setSuctionPressure}
              onDischargePressureChange={setDischargePressure}
              onFlowModeChange={setFlowMode}
              onFlowValueChange={setFlowValue}
              onDesuperheatEnabledChange={setDesuperheatEnabled}
              onSprayWaterTemperatureChange={setSprayWaterTemperature}
            />
          </Paper>

          {error && (
            <Alert severity="error" sx={{ mt: 2 }}>
              {error}
            </Alert>
          )}
        </Grid>

        <Grid size={{ xs: 12, md: 7 }}>
          {result && <TVCResults result={result} desuperheatingResult={desuperheatingResult} />}

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
                Enter pressures and flow to calculate ejector performance
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
          Method: 1-D Constant Pressure Mixing Model
        </Typography>
        <Typography variant="body2" color="text.secondary" component="div">
          <ul style={{ margin: 0, paddingLeft: 20 }}>
            <li>
              <strong>Theoretical Ra:</strong> (h_m - h_d_sat) / (h_d_sat - h_e) — from energy
              balance
            </li>
            <li>
              <strong>Actual Ra:</strong> Theoretical × η_ejector — accounting for real losses
            </li>
            <li>
              <strong>η_ejector:</strong> η_nozzle × η_mixing × η_diffuser × f(CR)
            </li>
            <li>
              <strong>Typical MED-TVC:</strong> Ra = 0.3 – 1.2, CR limit = 2.2 – 2.5
            </li>
          </ul>
        </Typography>
        <Typography variant="body2" color="text.secondary" sx={{ mt: 2 }}>
          <strong>References:</strong> Huang et al. (1999) Int. J. Refrigeration; Keenan et al.
          (1950) ASME; El-Dessouky & Ettouney (2002)
        </Typography>
      </Box>
    </Container>
  );
}
