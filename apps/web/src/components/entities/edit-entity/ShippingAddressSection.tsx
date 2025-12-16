'use client';

/**
 * Shipping Address Section
 *
 * Form section for entity shipping address.
 */

import {
  Box,
  TextField,
  Grid,
  Typography,
  Divider,
  FormControlLabel,
  Checkbox,
} from '@mui/material';
import { StateSelector } from '@/components/common/forms/StateSelector';
import type { ShippingAddressSectionProps } from './types';

export function ShippingAddressSection({
  sameAsBilling,
  setSameAsBilling,
  shippingLine1,
  setShippingLine1,
  shippingLine2,
  setShippingLine2,
  shippingCity,
  setShippingCity,
  shippingState,
  setShippingState,
  shippingPostalCode,
  setShippingPostalCode,
  shippingCountry,
  setShippingCountry,
  disabled,
}: ShippingAddressSectionProps) {
  return (
    <Box>
      <Typography variant="subtitle2" color="primary" gutterBottom>
        Shipping Address (Optional)
      </Typography>
      <Divider sx={{ mb: 2 }} />
      <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
        <FormControlLabel
          control={
            <Checkbox
              checked={sameAsBilling}
              onChange={(e) => setSameAsBilling(e.target.checked)}
              disabled={disabled}
            />
          }
          label="Same as billing address"
        />

        {!sameAsBilling && (
          <>
            <TextField
              label="Address Line 1"
              value={shippingLine1}
              onChange={(e) => setShippingLine1(e.target.value)}
              fullWidth
              placeholder="Street address (optional)"
              disabled={disabled}
            />

            <TextField
              label="Address Line 2"
              value={shippingLine2}
              onChange={(e) => setShippingLine2(e.target.value)}
              fullWidth
              placeholder="Apartment, suite, etc. (optional)"
              disabled={disabled}
            />

            <Grid container spacing={2}>
              <Grid size={{ xs: 12, sm: 6 }}>
                <TextField
                  label="City"
                  value={shippingCity}
                  onChange={(e) => setShippingCity(e.target.value)}
                  fullWidth
                  placeholder="Optional"
                  disabled={disabled}
                />
              </Grid>
              <Grid size={{ xs: 12, sm: 6 }}>
                <StateSelector
                  label="State"
                  value={shippingState}
                  onChange={setShippingState}
                  disabled={disabled}
                />
              </Grid>
            </Grid>

            <Grid container spacing={2}>
              <Grid size={{ xs: 12, sm: 6 }}>
                <TextField
                  label="Postal Code"
                  value={shippingPostalCode}
                  onChange={(e) => setShippingPostalCode(e.target.value)}
                  fullWidth
                  placeholder="Optional"
                  disabled={disabled}
                />
              </Grid>
              <Grid size={{ xs: 12, sm: 6 }}>
                <TextField
                  label="Country"
                  value={shippingCountry}
                  onChange={(e) => setShippingCountry(e.target.value)}
                  fullWidth
                  placeholder="Optional"
                  disabled={disabled}
                />
              </Grid>
            </Grid>
          </>
        )}
      </Box>
    </Box>
  );
}
