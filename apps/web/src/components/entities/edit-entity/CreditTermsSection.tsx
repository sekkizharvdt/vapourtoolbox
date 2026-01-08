'use client';

/**
 * Credit Terms Section
 *
 * Form section for entity credit terms and opening balance configuration.
 */

import {
  Box,
  TextField,
  Grid,
  Typography,
  Divider,
  ToggleButtonGroup,
  ToggleButton,
  InputAdornment,
} from '@mui/material';
import type { CreditTermsSectionProps } from './types';

export function CreditTermsSection({
  creditDays,
  setCreditDays,
  creditLimit,
  setCreditLimit,
  openingBalance,
  setOpeningBalance,
  openingBalanceType,
  setOpeningBalanceType,
  disabled,
}: CreditTermsSectionProps) {
  return (
    <Box>
      <Typography variant="subtitle2" color="primary" gutterBottom>
        Credit Terms & Opening Balance (Optional)
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

        {/* Opening Balance Section */}
        <Typography variant="body2" color="text.secondary" sx={{ mt: 1 }}>
          Opening Balance from Previous Financial Year
        </Typography>
        <Grid container spacing={2} alignItems="flex-start">
          <Grid size={{ xs: 12, sm: 6 }}>
            <TextField
              label="Opening Balance (INR)"
              type="number"
              value={openingBalance}
              onChange={(e) => setOpeningBalance(e.target.value)}
              fullWidth
              placeholder="e.g., 50000"
              helperText="Balance carried forward from previous year"
              disabled={disabled}
              inputProps={{ min: 0 }}
              slotProps={{
                input: {
                  startAdornment: <InputAdornment position="start">₹</InputAdornment>,
                },
              }}
            />
          </Grid>
          <Grid size={{ xs: 12, sm: 6 }}>
            <Box>
              <Typography
                variant="caption"
                color="text.secondary"
                sx={{ mb: 0.5, display: 'block' }}
              >
                Balance Type
              </Typography>
              <ToggleButtonGroup
                value={openingBalanceType}
                exclusive
                onChange={(_e, value) => value && setOpeningBalanceType(value)}
                disabled={disabled}
                size="small"
                fullWidth
              >
                <ToggleButton value="DR" sx={{ flex: 1 }}>
                  Debit (DR)
                </ToggleButton>
                <ToggleButton value="CR" sx={{ flex: 1 }}>
                  Credit (CR)
                </ToggleButton>
              </ToggleButtonGroup>
              <Typography
                variant="caption"
                color="text.secondary"
                sx={{ mt: 0.5, display: 'block' }}
              >
                DR = They owe us (advance given) | CR = We owe them (advance received)
              </Typography>
            </Box>
          </Grid>
        </Grid>
      </Box>
    </Box>
  );
}
