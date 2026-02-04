'use client';

import { useState, useMemo } from 'react';
import { Container, Typography, Box, Paper, Grid, Alert, Chip, Stack } from '@mui/material';
import { getSaturationTemperature } from '@vapour/constants';
import { calculateDesuperheating } from '@/lib/thermal';
import { DesuperheatingInputs, DesuperheatingResults } from './components';

export default function DesuperheatingClient() {
  const [steamPressure, setSteamPressure] = useState<string>('');
  const [steamTemperature, setSteamTemperature] = useState<string>('');
  const [targetTemperature, setTargetTemperature] = useState<string>('');
  const [sprayWaterTemperature, setSprayWaterTemperature] = useState<string>('30');
  const [steamFlow, setSteamFlow] = useState<string>('');

  const [error, setError] = useState<string | null>(null);

  // Compute Tsat for helperText display
  const saturationTemp = useMemo(() => {
    const p = parseFloat(steamPressure);
    if (isNaN(p) || p <= 0) return null;
    try {
      return getSaturationTemperature(p);
    } catch {
      return null;
    }
  }, [steamPressure]);

  // Calculate desuperheating
  const result = useMemo(() => {
    setError(null);

    try {
      const pressure = parseFloat(steamPressure);
      const tempIn = parseFloat(steamTemperature);
      const tempTarget = parseFloat(targetTemperature);
      const tempWater = parseFloat(sprayWaterTemperature);
      const flow = parseFloat(steamFlow);

      if (
        isNaN(pressure) ||
        pressure <= 0 ||
        isNaN(tempIn) ||
        isNaN(tempTarget) ||
        isNaN(tempWater) ||
        isNaN(flow) ||
        flow <= 0
      )
        return null;

      return calculateDesuperheating({
        steamPressure: pressure,
        steamTemperature: tempIn,
        targetTemperature: tempTarget,
        sprayWaterTemperature: tempWater,
        steamFlow: flow,
      });
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Calculation error');
      return null;
    }
  }, [steamPressure, steamTemperature, targetTemperature, sprayWaterTemperature, steamFlow]);

  return (
    <Container maxWidth="xl" sx={{ py: 4 }}>
      <Box sx={{ mb: 4 }}>
        <Stack direction="row" alignItems="center" spacing={2} mb={1}>
          <Typography variant="h4" component="h1">
            Desuperheating Calculator
          </Typography>
          <Chip label="Energy Balance" size="small" color="primary" variant="outlined" />
        </Stack>
        <Typography variant="body1" color="text.secondary">
          Calculate spray water requirement to desuperheat steam from superheated to target
          temperature.
        </Typography>
      </Box>

      <Grid container spacing={3}>
        <Grid size={{ xs: 12, md: 5 }}>
          <Paper sx={{ p: 3 }}>
            <Typography variant="h6" gutterBottom>
              Input Parameters
            </Typography>
            <DesuperheatingInputs
              steamPressure={steamPressure}
              steamTemperature={steamTemperature}
              targetTemperature={targetTemperature}
              sprayWaterTemperature={sprayWaterTemperature}
              steamFlow={steamFlow}
              saturationTemperature={saturationTemp}
              onSteamPressureChange={setSteamPressure}
              onSteamTemperatureChange={setSteamTemperature}
              onTargetTemperatureChange={setTargetTemperature}
              onSprayWaterTemperatureChange={setSprayWaterTemperature}
              onSteamFlowChange={setSteamFlow}
            />
          </Paper>

          {error && (
            <Alert severity="error" sx={{ mt: 2 }}>
              {error}
            </Alert>
          )}
        </Grid>

        <Grid size={{ xs: 12, md: 7 }}>
          {result && <DesuperheatingResults result={result} />}

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
                Enter steam conditions to calculate spray water requirement
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
          Formula
        </Typography>
        <Typography variant="body2" color="text.secondary" component="div">
          <ul style={{ margin: 0, paddingLeft: 20 }}>
            <li>
              <strong>Energy Balance:</strong> m_steam × h_steam + m_water × h_water = m_total ×
              h_target
            </li>
            <li>
              <strong>Spray Water:</strong> m_water = m_steam × (h_steam - h_target) / (h_target -
              h_water)
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
