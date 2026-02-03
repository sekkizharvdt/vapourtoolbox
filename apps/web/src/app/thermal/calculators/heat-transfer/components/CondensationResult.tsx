'use client';

import { Paper, Typography, Box, Card, CardContent, Stack } from '@mui/material';
import type { CondensationHTCResult } from '@/lib/thermal';

interface CondensationResultProps {
  result: CondensationHTCResult;
  orientation: 'vertical' | 'horizontal';
}

export function CondensationResult({ result, orientation }: CondensationResultProps) {
  const C = orientation === 'vertical' ? '0.943' : '0.725';

  return (
    <Paper sx={{ p: 3 }}>
      <Typography variant="h6" gutterBottom>
        Condensation HTC Result
      </Typography>

      {/* Primary result: HTC */}
      <Card
        variant="outlined"
        sx={{ mb: 3, bgcolor: 'primary.main', color: 'primary.contrastText' }}
      >
        <CardContent>
          <Typography variant="caption" sx={{ opacity: 0.8 }}>
            Film Condensation HTC ({orientation})
          </Typography>
          <Stack direction="row" alignItems="baseline" spacing={2}>
            <Typography variant="h3">{result.htc.toFixed(0)}</Typography>
            <Typography variant="h6">W/(m²·K)</Typography>
          </Stack>
        </CardContent>
      </Card>

      {/* Formula */}
      <Box sx={{ p: 2, bgcolor: 'action.hover', borderRadius: 1 }}>
        <Typography variant="body2">
          <strong>Nusselt Film Condensation ({orientation}):</strong>
        </Typography>
        <Typography variant="body2" color="text.secondary" sx={{ mt: 0.5 }}>
          h = {C} × [ρ_l × (ρ_l - ρ_v) × g × h_fg × k³ / (μ ×{' '}
          {orientation === 'vertical' ? 'L' : 'D'} × ΔT)]<sup>0.25</sup>
        </Typography>
        <Typography variant="body2" color="text.secondary" sx={{ mt: 1 }}>
          <strong>Reference:</strong> Nusselt (1916), Perry&apos;s Chemical Engineers&apos; Handbook
        </Typography>
      </Box>
    </Paper>
  );
}
