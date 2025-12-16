'use client';

/**
 * Outstanding Bills Summary
 *
 * Shows a summary of outstanding bills for the selected vendor.
 */

import { Box, Button, Alert, Typography, CircularProgress } from '@mui/material';
import { formatCurrency } from '@/lib/accounting/transactionHelpers';
import type { OutstandingBillsSummaryProps } from './types';

export function OutstandingBillsSummary({
  entityId,
  loadingBills,
  outstandingBills,
  totalOutstanding,
  onPayFullOutstanding,
}: OutstandingBillsSummaryProps) {
  if (!entityId) return null;

  if (loadingBills) {
    return (
      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, py: 2 }}>
        <CircularProgress size={20} />
        <Typography variant="body2" color="text.secondary">
          Loading outstanding bills...
        </Typography>
      </Box>
    );
  }

  if (outstandingBills.length > 0) {
    return (
      <Alert
        severity="info"
        sx={{ mb: 1 }}
        action={
          <Button color="inherit" size="small" onClick={onPayFullOutstanding}>
            Pay Full Amount
          </Button>
        }
      >
        <Typography variant="body2">
          <strong>{outstandingBills.length} outstanding bill(s)</strong> totalling{' '}
          <strong>{formatCurrency(totalOutstanding)}</strong>
        </Typography>
      </Alert>
    );
  }

  return (
    <Alert severity="success" sx={{ mb: 1 }}>
      No outstanding bills for this vendor.
    </Alert>
  );
}
