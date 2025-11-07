'use client';

import React from 'react';
import { Grid, TextField } from '@mui/material';

interface TransactionNumberDisplayProps {
  /**
   * The transaction number to display (or undefined if not yet generated)
   */
  transactionNumber?: string;
  /**
   * Label for the field (e.g., "Invoice Number", "Bill Number")
   */
  label: string;
  /**
   * Placeholder text when transaction number is not yet generated
   */
  placeholder?: string;
  /**
   * Helper text to display below the field
   */
  helperText?: string;
}

/**
 * Reusable component for displaying transaction numbers (invoices, bills, etc.).
 * Shows the transaction number if available, or a placeholder indicating it will be auto-generated.
 *
 * @example
 * ```tsx
 * <TransactionNumberDisplay
 *   transactionNumber={invoice?.transactionNumber}
 *   label="Invoice Number"
 *   placeholder="Will be auto-generated (INV-XXXX)"
 *   helperText={invoice ? "Invoice number cannot be changed" : "Invoice number will be generated automatically upon creation"}
 * />
 * ```
 */
export function TransactionNumberDisplay({
  transactionNumber,
  label,
  placeholder = 'Will be auto-generated',
  helperText,
}: TransactionNumberDisplayProps) {
  return (
    <Grid size={{ xs: 12 }}>
      <TextField
        label={label}
        value={transactionNumber || placeholder}
        disabled
        fullWidth
        helperText={
          helperText ||
          (transactionNumber
            ? `${label} cannot be changed`
            : `${label} will be generated automatically upon creation`)
        }
      />
    </Grid>
  );
}
