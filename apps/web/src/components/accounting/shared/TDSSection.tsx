'use client';

import React from 'react';
import { Grid, Paper, FormControlLabel, Checkbox, TextField, MenuItem } from '@mui/material';
import { type TDSSection as TDSSectionType } from '@/lib/accounting/tdsCalculator';

const COMMON_TDS_SECTIONS: TDSSectionType[] = [
  '194C',
  '194H',
  '194I',
  '194J',
  '194Q',
];

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
   * Whether fields are disabled (read-only mode)
   */
  disabled?: boolean;
}

/**
 * Reusable TDS section component for bill dialogs.
 * Displays TDS checkbox and collects TDS section + vendor PAN when enabled.
 *
 * @example
 * ```tsx
 * <TDSSection
 *   tdsDeducted={tdsDeducted}
 *   onTdsDeductedChange={setTdsDeducted}
 *   tdsSection={tdsSection}
 *   onTdsSectionChange={setTdsSection}
 *   vendorPAN={vendorPAN}
 *   onVendorPANChange={setVendorPAN}
 * />
 * ```
 */
export function TDSSection({
  tdsDeducted,
  onTdsDeductedChange,
  tdsSection,
  onTdsSectionChange,
  vendorPAN,
  onVendorPANChange,
  disabled = false,
}: TDSSectionProps) {
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
            <Grid size={{ xs: 12, md: 6 }}>
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
            <Grid size={{ xs: 12, md: 6 }}>
              <TextField
                fullWidth
                label="Vendor PAN"
                value={vendorPAN}
                onChange={(e) => onVendorPANChange(e.target.value.toUpperCase())}
                helperText="Required for correct TDS calculation"
                disabled={disabled}
              />
            </Grid>
          </Grid>
        )}
      </Paper>
    </Grid>
  );
}
