'use client';

import { Paper, Typography, Box, Grid, Card, CardContent, Stack, Alert, Chip } from '@mui/material';
import type { TubeSideHTCResult } from '@/lib/thermal';

interface TubeSideResultProps {
  result: TubeSideHTCResult;
}

function getFlowRegime(re: number): { label: string; color: 'success' | 'warning' | 'info' } {
  if (re > 4000) return { label: 'Turbulent', color: 'success' };
  if (re > 2300) return { label: 'Transitional', color: 'warning' };
  return { label: 'Laminar', color: 'info' };
}

export function TubeSideResult({ result }: TubeSideResultProps) {
  const regime = getFlowRegime(result.reynoldsNumber);

  return (
    <Paper sx={{ p: 3 }}>
      <Typography variant="h6" gutterBottom>
        Tube-Side HTC Result
      </Typography>

      {/* Primary result: HTC */}
      <Card
        variant="outlined"
        sx={{ mb: 3, bgcolor: 'primary.main', color: 'primary.contrastText' }}
      >
        <CardContent>
          <Typography variant="caption" sx={{ opacity: 0.8 }}>
            Heat Transfer Coefficient (h = Nu × k / D)
          </Typography>
          <Stack direction="row" alignItems="baseline" spacing={2}>
            <Typography variant="h3">{result.htc.toFixed(0)}</Typography>
            <Typography variant="h6">W/(m²·K)</Typography>
          </Stack>
        </CardContent>
      </Card>

      {/* Validity warning */}
      {result.reynoldsNumber < 10000 && (
        <Alert severity="warning" sx={{ mb: 2 }}>
          Dittus-Boelter correlation is valid for Re &gt; 10,000 (fully turbulent). Current Re ={' '}
          {result.reynoldsNumber.toFixed(0)}.
        </Alert>
      )}

      {/* Dimensionless Numbers */}
      <Grid container spacing={2}>
        <Grid size={{ xs: 4 }}>
          <Card variant="outlined">
            <CardContent sx={{ textAlign: 'center', py: 1 }}>
              <Typography variant="caption" color="text.secondary">
                Reynolds Number
              </Typography>
              <Typography variant="h6">{result.reynoldsNumber.toFixed(0)}</Typography>
              <Chip label={regime.label} size="small" color={regime.color} variant="outlined" />
            </CardContent>
          </Card>
        </Grid>
        <Grid size={{ xs: 4 }}>
          <Card variant="outlined">
            <CardContent sx={{ textAlign: 'center', py: 1 }}>
              <Typography variant="caption" color="text.secondary">
                Prandtl Number
              </Typography>
              <Typography variant="h6">{result.prandtlNumber.toFixed(2)}</Typography>
            </CardContent>
          </Card>
        </Grid>
        <Grid size={{ xs: 4 }}>
          <Card variant="outlined">
            <CardContent sx={{ textAlign: 'center', py: 1 }}>
              <Typography variant="caption" color="text.secondary">
                Nusselt Number
              </Typography>
              <Typography variant="h6">{result.nusseltNumber.toFixed(1)}</Typography>
            </CardContent>
          </Card>
        </Grid>
      </Grid>

      {/* Formula */}
      <Box sx={{ mt: 3, p: 2, bgcolor: 'action.hover', borderRadius: 1 }}>
        <Typography variant="body2">
          <strong>Dittus-Boelter:</strong> Nu = 0.023 × Re<sup>0.8</sup> × Pr<sup>n</sup>
        </Typography>
        <Typography variant="body2" color="text.secondary">
          n = 0.4 (heating) or 0.3 (cooling). Valid for Re &gt; 10,000 and 0.6 &lt; Pr &lt; 160.
        </Typography>
      </Box>
    </Paper>
  );
}
