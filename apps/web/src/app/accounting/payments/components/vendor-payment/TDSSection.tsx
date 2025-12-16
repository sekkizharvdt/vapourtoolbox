'use client';

/**
 * TDS Section
 *
 * Form section for Tax Deducted at Source configuration.
 */

import {
  Grid,
  TextField,
  MenuItem,
  Typography,
  Paper,
  FormControlLabel,
  Checkbox,
} from '@mui/material';
import { formatCurrency } from '@/lib/accounting/transactionHelpers';
import { TDS_SECTIONS, type TDSSectionProps } from './types';

export function TDSSection({
  tdsDeducted,
  setTdsDeducted,
  tdsSection,
  setTdsSection,
  tdsAmount,
  setTdsAmount,
  netPayment,
  amount,
}: TDSSectionProps) {
  return (
    <>
      <Grid size={{ xs: 12 }}>
        <Typography variant="h6" gutterBottom>
          TDS (Tax Deducted at Source)
        </Typography>
      </Grid>

      <Grid size={{ xs: 12 }}>
        <FormControlLabel
          control={
            <Checkbox checked={tdsDeducted} onChange={(e) => setTdsDeducted(e.target.checked)} />
          }
          label="TDS Deducted"
        />
      </Grid>

      {tdsDeducted && (
        <>
          <Grid size={{ xs: 12, md: 6 }}>
            <TextField
              fullWidth
              select
              label="TDS Section"
              value={tdsSection}
              onChange={(e) => setTdsSection(e.target.value)}
              required
            >
              {TDS_SECTIONS.map((section) => (
                <MenuItem key={section.code} value={section.code}>
                  {section.code} - {section.name}
                </MenuItem>
              ))}
            </TextField>
          </Grid>

          <Grid size={{ xs: 12, md: 6 }}>
            <TextField
              fullWidth
              label="TDS Amount"
              type="number"
              value={tdsAmount}
              onChange={(e) => setTdsAmount(parseFloat(e.target.value) || 0)}
              slotProps={{ htmlInput: { min: 0, step: 0.01 } }}
              helperText="Auto-calculated based on TDS section rate"
            />
          </Grid>

          <Grid size={{ xs: 12 }}>
            <Paper sx={{ p: 2, bgcolor: 'info.light' }}>
              <Typography variant="body2">
                <strong>Net Payment to Vendor:</strong> {formatCurrency(netPayment)}
                <br />
                (Payment Amount: {formatCurrency(amount)} - TDS: {formatCurrency(tdsAmount)})
              </Typography>
            </Paper>
          </Grid>
        </>
      )}
    </>
  );
}
