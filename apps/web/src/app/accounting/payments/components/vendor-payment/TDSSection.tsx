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
              helperText="Calculated from the section rate on the basic (pre-GST) value — override if your figure differs"
            />
          </Grid>

          <Grid size={{ xs: 12 }}>
            {/* Spelled out line by line (feedback zeZC6HtN). The old wording,
                "(Payment Amount: X - TDS: Y)", read as though TDS were being
                taken off again when the user had already entered a net figure.
                Naming each line makes it unambiguous which number is which. */}
            <Paper sx={{ p: 2, bgcolor: 'info.light' }}>
              <Typography variant="body2">
                Bill amount being settled: <strong>{formatCurrency(amount)}</strong>
                <br />
                Less TDS withheld: <strong>{formatCurrency(tdsAmount)}</strong>
                <br />
                <strong>Cash leaving the bank: {formatCurrency(netPayment)}</strong>
              </Typography>
              <Typography variant="caption" color="text.secondary">
                The bill is settled in full for {formatCurrency(amount)}; the TDS is held and paid
                to the government separately.
              </Typography>
            </Paper>
          </Grid>
        </>
      )}
    </>
  );
}
