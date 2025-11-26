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
  /**
   * Whether the field is editable (default: false for backward compatibility)
   */
  editable?: boolean;
  /**
   * Callback when the transaction number changes (required if editable=true)
   */
  onChange?: (value: string) => void;
  /**
   * Current value for editable mode
   */
  value?: string;
}

/**
 * Reusable component for displaying or editing transaction numbers (invoices, bills, etc.).
 * Shows the transaction number if available, or a placeholder indicating it will be auto-generated.
 *
 * @example
 * ```tsx
 * // Display-only mode (existing behavior)
 * <TransactionNumberDisplay
 *   transactionNumber={invoice?.transactionNumber}
 *   label="Invoice Number"
 *   placeholder="Will be auto-generated (INV-XXXX)"
 * />
 *
 * // Editable mode (new behavior)
 * <TransactionNumberDisplay
 *   value={invoiceNumber}
 *   onChange={setInvoiceNumber}
 *   label="Invoice Number"
 *   placeholder="INV-XXXX"
 *   editable
 * />
 * ```
 */
export function TransactionNumberDisplay({
  transactionNumber,
  label,
  placeholder = 'Will be auto-generated',
  helperText,
  editable = false,
  onChange,
  value,
}: TransactionNumberDisplayProps) {
  // For editable mode, use the value prop
  // For display-only mode, use transactionNumber
  const displayValue = editable ? value || '' : transactionNumber || placeholder;

  return (
    <Grid size={{ xs: 12 }}>
      <TextField
        label={label}
        value={displayValue}
        onChange={editable ? (e) => onChange?.(e.target.value) : undefined}
        disabled={!editable && !!transactionNumber}
        fullWidth
        placeholder={editable ? placeholder : undefined}
        helperText={helperText}
        slotProps={{
          input: {
            readOnly: !editable && !!transactionNumber,
          },
        }}
      />
    </Grid>
  );
}
