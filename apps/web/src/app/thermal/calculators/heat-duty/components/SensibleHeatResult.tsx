'use client';

import { Paper, Typography, Box, Grid, Card, CardContent, Stack } from '@mui/material';
import type { SensibleHeatResult as SensibleHeatResultType } from './types';

interface SensibleHeatResultProps {
  result: SensibleHeatResultType;
}

export function SensibleHeatResult({ result }: SensibleHeatResultProps) {
  return (
    <Paper sx={{ p: 3 }}>
      <Typography variant="h6" gutterBottom>
        Sensible Heat Result
      </Typography>

      <Card
        variant="outlined"
        sx={{ mb: 3, bgcolor: 'primary.main', color: 'primary.contrastText' }}
      >
        <CardContent>
          <Typography variant="caption" sx={{ opacity: 0.8 }}>
            Heat Duty (Q = m × Cp × ΔT)
          </Typography>
          <Stack direction="row" alignItems="baseline" spacing={2}>
            <Typography variant="h3">{result.heatDuty.toFixed(1)}</Typography>
            <Typography variant="h6">kW</Typography>
          </Stack>
          <Typography variant="body2" sx={{ opacity: 0.9, mt: 1 }}>
            = {(result.heatDuty / 1000).toFixed(3)} MW
          </Typography>
        </CardContent>
      </Card>

      <Grid container spacing={2}>
        <Grid size={{ xs: 6, sm: 4 }}>
          <Card variant="outlined">
            <CardContent sx={{ textAlign: 'center', py: 1 }}>
              <Typography variant="caption" color="text.secondary">
                Specific Heat
              </Typography>
              <Typography variant="h6">{result.specificHeat.toFixed(3)}</Typography>
              <Typography variant="caption">kJ/(kg·K)</Typography>
            </CardContent>
          </Card>
        </Grid>
        <Grid size={{ xs: 6, sm: 4 }}>
          <Card variant="outlined">
            <CardContent sx={{ textAlign: 'center', py: 1 }}>
              <Typography variant="caption" color="text.secondary">
                Temperature Change
              </Typography>
              <Typography variant="h6">{result.deltaT.toFixed(1)}</Typography>
              <Typography variant="caption">°C</Typography>
            </CardContent>
          </Card>
        </Grid>
        <Grid size={{ xs: 6, sm: 4 }}>
          <Card variant="outlined">
            <CardContent sx={{ textAlign: 'center', py: 1 }}>
              <Typography variant="caption" color="text.secondary">
                Process
              </Typography>
              <Typography variant="h6">{result.isHeating ? 'Heating' : 'Cooling'}</Typography>
            </CardContent>
          </Card>
        </Grid>
      </Grid>

      <Box sx={{ mt: 3, p: 2, bgcolor: 'action.hover', borderRadius: 1 }}>
        <Typography variant="body2">
          <strong>Formula:</strong> Q = ṁ × Cp × ΔT
        </Typography>
        <Typography variant="body2" color="text.secondary">
          Q = {result.massFlowKgS.toFixed(3)} kg/s × {result.specificHeat.toFixed(3)} kJ/(kg·K) ×{' '}
          {result.deltaT.toFixed(1)} K
        </Typography>
      </Box>
    </Paper>
  );
}
