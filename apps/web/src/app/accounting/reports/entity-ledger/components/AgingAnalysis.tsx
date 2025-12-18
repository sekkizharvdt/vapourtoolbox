'use client';

import { Box, Typography, Grid, Paper } from '@mui/material';
import { formatCurrency } from '@/lib/utils/formatters';
import type { AgingBucket } from './types';

interface AgingAnalysisProps {
  aging: AgingBucket;
  /** Currency for display - aging should always be calculated in INR (base currency) */
  currency: string;
}

export function AgingAnalysis({ aging, currency }: AgingAnalysisProps) {
  return (
    <Paper sx={{ p: 3, mb: 3 }}>
      <Typography variant="h6" gutterBottom>
        Receivables Aging Analysis
      </Typography>
      <Grid container spacing={2}>
        <Grid size={{ xs: 6, sm: 3 }}>
          <Box sx={{ textAlign: 'center', p: 2, bgcolor: 'success.50', borderRadius: 1 }}>
            <Typography variant="body2" color="text.secondary">
              Current (0-30 days)
            </Typography>
            <Typography variant="h6" color="success.main">
              {formatCurrency(aging.current, currency)}
            </Typography>
          </Box>
        </Grid>
        <Grid size={{ xs: 6, sm: 3 }}>
          <Box sx={{ textAlign: 'center', p: 2, bgcolor: 'warning.50', borderRadius: 1 }}>
            <Typography variant="body2" color="text.secondary">
              31-60 days
            </Typography>
            <Typography variant="h6" color="warning.main">
              {formatCurrency(aging.days31to60, currency)}
            </Typography>
          </Box>
        </Grid>
        <Grid size={{ xs: 6, sm: 3 }}>
          <Box sx={{ textAlign: 'center', p: 2, bgcolor: 'orange.50', borderRadius: 1 }}>
            <Typography variant="body2" color="text.secondary">
              61-90 days
            </Typography>
            <Typography variant="h6" color="warning.dark">
              {formatCurrency(aging.days61to90, currency)}
            </Typography>
          </Box>
        </Grid>
        <Grid size={{ xs: 6, sm: 3 }}>
          <Box sx={{ textAlign: 'center', p: 2, bgcolor: 'error.50', borderRadius: 1 }}>
            <Typography variant="body2" color="text.secondary">
              Over 90 days
            </Typography>
            <Typography variant="h6" color="error.main">
              {formatCurrency(aging.over90days, currency)}
            </Typography>
          </Box>
        </Grid>
      </Grid>
    </Paper>
  );
}
