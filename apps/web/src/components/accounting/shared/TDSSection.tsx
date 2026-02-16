'use client';

import React from 'react';
import { Grid, Paper, FormControlLabel, Checkbox, TextField, MenuItem } from '@mui/material';
import { type TDSSection as TDSSectionType, TDS_SECTIONS } from '@/lib/accounting/tdsCalculator';
import { ACCOUNTING } from '@vapour/constants';

const COMMON_TDS_SECTIONS: TDSSectionType[] = ['194C', '194H', '194I', '194J', '194Q'];

/**
 * Returns common TDS section codes for India
 */
function getCommonTDSSections(): TDSSectionType[] {
  return COMMON_TDS_SECTIONS;
}

interface TDSSectionProps {
  /**
   * Whether TDS is deducted
   */
  tdsDeducted: boolean;
  /**
   * Callback to update TDS deducted status
   */
  onTdsDeductedChange: (deducted: boolean) => void;
  /**
   * TDS section code
   */
  tdsSection: TDSSectionType;
  /**
   * Callback to update TDS section
   */
  onTdsSectionChange: (section: TDSSectionType) => void;
  /**
   * Vendor PAN number
   */
  vendorPAN: string;
  /**
   * Callback to update vendor PAN
   */
  onVendorPANChange: (pan: string) => void;
  /**
   * Manual TDS rate override (null = auto from section)
   */
  tdsRateOverride: number | null;
  /**
   * Callback to update TDS rate override
   */
  onTdsRateOverrideChange: (rate: number | null) => void;
  /**
   * Whether fields are disabled (read-only mode)
   */
  disabled?: boolean;
}

/**
 * Reusable TDS section component for bill dialogs.
 * Displays TDS checkbox and collects TDS section, rate, and vendor PAN when enabled.
 */
export function TDSSection({
  tdsDeducted,
  onTdsDeductedChange,
  tdsSection,
  onTdsSectionChange,
  vendorPAN,
  onVendorPANChange,
  tdsRateOverride,
  onTdsRateOverrideChange,
  disabled = false,
}: TDSSectionProps) {
  const sectionInfo = TDS_SECTIONS[tdsSection];
  const autoRate = !vendorPAN ? 20 : (sectionInfo?.rate ?? 0);

  return (
    <Grid size={{ xs: 12 }}>
      <Paper variant="outlined" sx={{ p: 2 }}>
        <FormControlLabel
          control={
            <Checkbox
              checked={tdsDeducted}
              onChange={(e) => onTdsDeductedChange(e.target.checked)}
              disabled={disabled}
            />
          }
          label="TDS Deducted"
        />
        {tdsDeducted && (
          <Grid container spacing={2} sx={{ mt: 1 }}>
            <Grid size={{ xs: 12, md: 4 }}>
              <TextField
                fullWidth
                label="TDS Section"
                select
                value={tdsSection}
                onChange={(e) => onTdsSectionChange(e.target.value as TDSSectionType)}
                required
                disabled={disabled}
              >
                {getCommonTDSSections().map((section) => (
                  <MenuItem key={section} value={section}>
                    Section {section}
                  </MenuItem>
                ))}
              </TextField>
            </Grid>
            <Grid size={{ xs: 12, md: 4 }}>
              <TextField
                fullWidth
                label="TDS Rate (%)"
                select
                value={tdsRateOverride != null ? String(tdsRateOverride) : 'auto'}
                onChange={(e) => {
                  const val = e.target.value;
                  onTdsRateOverrideChange(val === 'auto' ? null : Number(val));
                }}
                helperText={
                  tdsRateOverride == null
                    ? `Auto: ${autoRate}%${!vendorPAN ? ' (no PAN)' : ` (Section ${tdsSection})`}`
                    : undefined
                }
                disabled={disabled}
              >
                <MenuItem value="auto">Auto (from section)</MenuItem>
                {ACCOUNTING.TDS_RATES.map((rate) => (
                  <MenuItem key={rate} value={String(rate)}>
                    {rate}%
                  </MenuItem>
                ))}
              </TextField>
            </Grid>
            <Grid size={{ xs: 12, md: 4 }}>
              <TextField
                fullWidth
                label="Vendor PAN"
                value={vendorPAN}
                onChange={(e) => onVendorPANChange(e.target.value.toUpperCase())}
                helperText="If empty, auto rate defaults to 20%"
                disabled={disabled}
              />
            </Grid>
          </Grid>
        )}
      </Paper>
    </Grid>
  );
}
