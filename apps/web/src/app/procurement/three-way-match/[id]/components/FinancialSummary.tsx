'use client';

import { Paper, Typography, Grid } from '@mui/material';
import type { ThreeWayMatch } from '@vapour/types';
import { formatCurrency } from '@/lib/procurement/threeWayMatchHelpers';

interface FinancialSummaryProps {
  match: ThreeWayMatch;
}

export function FinancialSummary({ match }: FinancialSummaryProps) {
  return (
    <Paper sx={{ p: 3, mb: 3 }}>
      <Typography variant="h6" gutterBottom>
        Financial Summary
      </Typography>
      <Grid container spacing={2}>
        <Grid size={{ xs: 6, sm: 3 }}>
          <Typography variant="body2" color="text.secondary">
            PO Amount
          </Typography>
          <Typography variant="h6">{formatCurrency(match.poAmount)}</Typography>
        </Grid>
        <Grid size={{ xs: 6, sm: 3 }}>
          <Typography variant="body2" color="text.secondary">
            GR Amount
          </Typography>
          <Typography variant="h6">{formatCurrency(match.grAmount)}</Typography>
        </Grid>
        <Grid size={{ xs: 6, sm: 3 }}>
          <Typography variant="body2" color="text.secondary">
            Invoice Amount
          </Typography>
          <Typography variant="h6">{formatCurrency(match.invoiceAmount)}</Typography>
        </Grid>
        <Grid size={{ xs: 6, sm: 3 }}>
          <Typography variant="body2" color="text.secondary">
            Variance
          </Typography>
          <Typography
            variant="h6"
            color={Math.abs(match.variance) < 0.01 ? 'success.main' : 'error.main'}
          >
            {formatCurrency(match.variance)}
          </Typography>
        </Grid>
      </Grid>
    </Paper>
  );
}
