'use client';

import { useState, useMemo } from 'react';
import { Container, Typography, Box, Paper, Grid, Alert, Chip, Stack } from '@mui/material';
import { calculateTVC } from '@/lib/thermal';
import { TVCInputs, TVCResults } from './components';

export default function TVCClient() {
  const [motivePressure, setMotivePressure] = useState<string>('');
  const [motiveTemperature, setMotiveTemperature] = useState<string>('');
  const [suctionPressure, setSuctionPressure] = useState<string>('');
  const [dischargePressure, setDischargePressure] = useState<string>('');
  const [flowMode, setFlowMode] = useState<'entrained' | 'motive'>('entrained');
  const [flowValue, setFlowValue] = useState<string>('');

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

  return (
    <Container maxWidth="xl" sx={{ py: 4 }}>
      <Box sx={{ mb: 4 }}>
        <Stack direction="row" alignItems="center" spacing={2} mb={1}>
          <Typography variant="h4" component="h1">
            Thermo Vapour Compressor (TVC)
          </Typography>
          <Chip label="El-Dessouky (2002)" size="small" color="primary" variant="outlined" />
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
              onMotivePressureChange={setMotivePressure}
              onMotiveTemperatureChange={setMotiveTemperature}
              onSuctionPressureChange={setSuctionPressure}
              onDischargePressureChange={setDischargePressure}
              onFlowModeChange={setFlowMode}
              onFlowValueChange={setFlowValue}
            />
          </Paper>

          {error && (
            <Alert severity="error" sx={{ mt: 2 }}>
              {error}
            </Alert>
          )}
        </Grid>

        <Grid size={{ xs: 12, md: 7 }}>
          {result && <TVCResults result={result} />}

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
          Correlation
        </Typography>
        <Typography variant="body2" color="text.secondary" component="div">
          <ul style={{ margin: 0, paddingLeft: 20 }}>
            <li>
              <strong>Entrainment Ratio:</strong> Ra = 0.296 × (Ps/Pm)<sup>1.04</sup> × (Pc/Pm)
              <sup>0.015</sup>
            </li>
            <li>
              <strong>Energy Balance:</strong> m_m × h_m + m_e × h_e = m_d × h_d
            </li>
          </ul>
        </Typography>
        <Typography variant="body2" color="text.secondary" sx={{ mt: 2 }}>
          <strong>Reference:</strong> El-Dessouky &amp; Ettouney, Fundamentals of Salt Water
          Desalination, 2002
        </Typography>
      </Box>
    </Container>
  );
}
