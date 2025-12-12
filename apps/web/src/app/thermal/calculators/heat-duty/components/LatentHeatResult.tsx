'use client';

import { Paper, Typography, Box, Grid, Card, CardContent, Stack } from '@mui/material';
import type { LatentHeatResult as LatentHeatResultType } from './types';

interface LatentHeatResultProps {
  result: LatentHeatResultType;
}

export function LatentHeatResult({ result }: LatentHeatResultProps) {
  return (
    <Paper sx={{ p: 3 }}>
      <Typography variant="h6" gutterBottom>
        Latent Heat Result
      </Typography>

      <Card
        variant="outlined"
        sx={{ mb: 3, bgcolor: 'secondary.main', color: 'secondary.contrastText' }}
      >
        <CardContent>
          <Typography variant="caption" sx={{ opacity: 0.8 }}>
            Heat Duty (Q = m × hfg)
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
                Latent Heat
              </Typography>
              <Typography variant="h6">{result.latentHeat.toFixed(1)}</Typography>
              <Typography variant="caption">kJ/kg</Typography>
            </CardContent>
          </Card>
        </Grid>
        <Grid size={{ xs: 6, sm: 4 }}>
          <Card variant="outlined">
            <CardContent sx={{ textAlign: 'center', py: 1 }}>
              <Typography variant="caption" color="text.secondary">
                Mass Flow
              </Typography>
              <Typography variant="h6">{result.massFlowKgS.toFixed(3)}</Typography>
              <Typography variant="caption">kg/s</Typography>
            </CardContent>
          </Card>
        </Grid>
        <Grid size={{ xs: 6, sm: 4 }}>
          <Card variant="outlined">
            <CardContent sx={{ textAlign: 'center', py: 1 }}>
              <Typography variant="caption" color="text.secondary">
                Process
              </Typography>
              <Typography variant="h6">
                {result.process === 'EVAPORATION' ? 'Evap.' : 'Cond.'}
              </Typography>
            </CardContent>
          </Card>
        </Grid>
      </Grid>

      <Box sx={{ mt: 3, p: 2, bgcolor: 'action.hover', borderRadius: 1 }}>
        <Typography variant="body2">
          <strong>Formula:</strong> Q = ṁ × hfg
        </Typography>
        <Typography variant="body2" color="text.secondary">
          Q = {result.massFlowKgS.toFixed(3)} kg/s × {result.latentHeat.toFixed(1)} kJ/kg
        </Typography>
      </Box>
    </Paper>
  );
}
