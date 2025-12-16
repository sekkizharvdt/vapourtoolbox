'use client';

/**
 * Credit Terms Section
 *
 * Form section for entity credit terms configuration.
 */

import { Box, TextField, Grid, Typography, Divider } from '@mui/material';
import type { CreditTermsSectionProps } from './types';

export function CreditTermsSection({
  creditDays,
  setCreditDays,
  creditLimit,
  setCreditLimit,
  disabled,
}: CreditTermsSectionProps) {
  return (
    <Box>
      <Typography variant="subtitle2" color="primary" gutterBottom>
        Credit Terms (Optional)
      </Typography>
      <Divider sx={{ mb: 2 }} />
      <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
        <Grid container spacing={2}>
          <Grid size={{ xs: 12, sm: 6 }}>
            <TextField
              label="Credit Days"
              type="number"
              value={creditDays}
              onChange={(e) => setCreditDays(e.target.value)}
              fullWidth
              placeholder="e.g., 30"
              helperText="Payment due days from invoice date"
              disabled={disabled}
              inputProps={{ min: 0 }}
            />
          </Grid>
          <Grid size={{ xs: 12, sm: 6 }}>
            <TextField
              label="Credit Limit (INR)"
              type="number"
              value={creditLimit}
              onChange={(e) => setCreditLimit(e.target.value)}
              fullWidth
              placeholder="e.g., 100000"
              helperText="Maximum outstanding amount allowed"
              disabled={disabled}
              inputProps={{ min: 0 }}
            />
          </Grid>
        </Grid>
      </Box>
    </Box>
  );
}
