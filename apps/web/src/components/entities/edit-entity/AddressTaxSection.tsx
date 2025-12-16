'use client';

/**
 * Address & Tax Section
 *
 * Form section for entity address and tax identifiers.
 */

import { Box, TextField, Grid, Typography, Divider } from '@mui/material';
import { StateSelector } from '@/components/common/forms/StateSelector';
import type { AddressTaxSectionProps } from './types';

export function AddressTaxSection({
  addressLine1,
  setAddressLine1,
  addressLine2,
  setAddressLine2,
  city,
  setCity,
  state,
  setState,
  postalCode,
  setPostalCode,
  country,
  setCountry,
  pan,
  setPan,
  gstin,
  setGstin,
  panValidation,
  gstinValidation,
  disabled,
}: AddressTaxSectionProps) {
  return (
    <Box>
      <Typography variant="subtitle2" color="primary" gutterBottom>
        Address & Tax Information
      </Typography>
      <Divider sx={{ mb: 2 }} />
      <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
        <TextField
          label="Address Line 1"
          value={addressLine1}
          onChange={(e) => setAddressLine1(e.target.value)}
          fullWidth
          placeholder="Street address (optional)"
        />

        <TextField
          label="Address Line 2"
          value={addressLine2}
          onChange={(e) => setAddressLine2(e.target.value)}
          fullWidth
          placeholder="Apartment, suite, etc. (optional)"
        />

        <Grid container spacing={2}>
          <Grid size={{ xs: 12, sm: 6 }}>
            <TextField
              label="City"
              value={city}
              onChange={(e) => setCity(e.target.value)}
              fullWidth
              placeholder="Optional"
            />
          </Grid>
          <Grid size={{ xs: 12, sm: 6 }}>
            <StateSelector label="State" value={state} onChange={setState} disabled={disabled} />
          </Grid>
        </Grid>

        <Grid container spacing={2}>
          <Grid size={{ xs: 12, sm: 6 }}>
            <TextField
              label="Postal Code"
              value={postalCode}
              onChange={(e) => setPostalCode(e.target.value)}
              fullWidth
              placeholder="Optional"
            />
          </Grid>
          <Grid size={{ xs: 12, sm: 6 }}>
            <TextField
              label="Country"
              value={country}
              onChange={(e) => setCountry(e.target.value)}
              fullWidth
              placeholder="Optional"
            />
          </Grid>
        </Grid>

        <Grid container spacing={2}>
          <Grid size={{ xs: 12, sm: 6 }}>
            <TextField
              label="PAN"
              value={pan}
              onChange={(e) => setPan(e.target.value.toUpperCase())}
              fullWidth
              placeholder="e.g., AAAAA9999A"
              error={!!pan && !panValidation.valid}
              helperText={
                pan && !panValidation.valid ? panValidation.error : 'Optional - 10 characters'
              }
              inputProps={{ maxLength: 10, style: { textTransform: 'uppercase' } }}
            />
          </Grid>
          <Grid size={{ xs: 12, sm: 6 }}>
            <TextField
              label="GSTIN"
              value={gstin}
              onChange={(e) => setGstin(e.target.value.toUpperCase())}
              fullWidth
              placeholder="e.g., 22AAAAA0000A1Z5"
              error={!!gstin && !gstinValidation.valid}
              helperText={
                gstin && !gstinValidation.valid ? gstinValidation.error : 'Optional - 15 characters'
              }
              inputProps={{ maxLength: 15, style: { textTransform: 'uppercase' } }}
            />
          </Grid>
        </Grid>
      </Box>
    </Box>
  );
}
