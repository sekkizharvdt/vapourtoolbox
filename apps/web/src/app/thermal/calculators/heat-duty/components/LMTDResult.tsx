'use client';

import { Paper, Typography, Box, Grid, Card, CardContent, Stack, Alert } from '@mui/material';
import type { LMTDResult as LMTDResultType } from './types';

interface LMTDResultProps {
  result: LMTDResultType;
  requiredArea: number | null;
}

export function LMTDResult({ result, requiredArea }: LMTDResultProps) {
  return (
    <Paper sx={{ p: 3 }}>
      <Typography variant="h6" gutterBottom>
        LMTD Result
      </Typography>

      {result.warnings.length > 0 && (
        <Alert severity="warning" sx={{ mb: 2 }}>
          {result.warnings.map((w, i) => (
            <div key={i}>{w}</div>
          ))}
        </Alert>
      )}

      <Card variant="outlined" sx={{ mb: 3, bgcolor: 'info.main', color: 'info.contrastText' }}>
        <CardContent>
          <Typography variant="caption" sx={{ opacity: 0.8 }}>
            Log Mean Temperature Difference
          </Typography>
          <Stack direction="row" alignItems="baseline" spacing={2}>
            <Typography variant="h3">{result.correctedLMTD.toFixed(2)}</Typography>
            <Typography variant="h6">°C</Typography>
          </Stack>
          {result.correctionFactor < 1 && (
            <Typography variant="body2" sx={{ opacity: 0.9, mt: 1 }}>
              (Uncorrected: {result.lmtd.toFixed(2)}°C, F = {result.correctionFactor.toFixed(3)})
            </Typography>
          )}
        </CardContent>
      </Card>

      <Grid container spacing={2} mb={3}>
        <Grid size={{ xs: 6, sm: 4 }}>
          <Card variant="outlined">
            <CardContent sx={{ textAlign: 'center', py: 1 }}>
              <Typography variant="caption" color="text.secondary">
                ΔT₁
              </Typography>
              <Typography variant="h6">{result.deltaT1.toFixed(1)}</Typography>
              <Typography variant="caption">°C</Typography>
            </CardContent>
          </Card>
        </Grid>
        <Grid size={{ xs: 6, sm: 4 }}>
          <Card variant="outlined">
            <CardContent sx={{ textAlign: 'center', py: 1 }}>
              <Typography variant="caption" color="text.secondary">
                ΔT₂
              </Typography>
              <Typography variant="h6">{result.deltaT2.toFixed(1)}</Typography>
              <Typography variant="caption">°C</Typography>
            </CardContent>
          </Card>
        </Grid>
        <Grid size={{ xs: 6, sm: 4 }}>
          <Card variant="outlined">
            <CardContent sx={{ textAlign: 'center', py: 1 }}>
              <Typography variant="caption" color="text.secondary">
                Flow Type
              </Typography>
              <Typography variant="h6">{result.flowArrangement}</Typography>
            </CardContent>
          </Card>
        </Grid>
      </Grid>

      {/* Required Area */}
      {requiredArea !== null && (
        <Card variant="outlined" sx={{ mb: 3, borderColor: 'success.main' }}>
          <CardContent>
            <Typography variant="caption" color="text.secondary">
              Required Heat Transfer Area (A = Q / U × LMTD)
            </Typography>
            <Typography variant="h4" color="success.main">
              {requiredArea.toFixed(2)} m²
            </Typography>
          </CardContent>
        </Card>
      )}

      <Box sx={{ p: 2, bgcolor: 'action.hover', borderRadius: 1 }}>
        <Typography variant="body2">
          <strong>Formula:</strong> LMTD = (ΔT₁ - ΔT₂) / ln(ΔT₁/ΔT₂)
        </Typography>
        <Typography variant="body2" color="text.secondary">
          Q = U × A × LMTD
        </Typography>
      </Box>
    </Paper>
  );
}
