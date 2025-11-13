/**
 * Financial Summary Section Component
 *
 * Displays PO financial breakdown: subtotal, taxes, grand total, advance payment
 */

'use client';

import { Paper, Typography, Stack, Divider } from '@mui/material';
import type { PurchaseOrder } from '@vapour/types';
import { formatCurrency } from '@/lib/procurement/purchaseOrderHelpers';

interface FinancialSummarySectionProps {
  po: PurchaseOrder;
}

export function FinancialSummarySection({ po }: FinancialSummarySectionProps) {
  return (
    <Paper sx={{ p: 3 }}>
      <Typography variant="h6" gutterBottom>
        Financial Summary
      </Typography>
      <Divider sx={{ my: 2 }} />
      <Stack spacing={1}>
        <Stack direction="row" justifyContent="space-between">
          <Typography>Subtotal</Typography>
          <Typography fontWeight="medium">{formatCurrency(po.subtotal, po.currency)}</Typography>
        </Stack>
        {po.cgst > 0 && (
          <Stack direction="row" justifyContent="space-between">
            <Typography>CGST</Typography>
            <Typography>{formatCurrency(po.cgst, po.currency)}</Typography>
          </Stack>
        )}
        {po.sgst > 0 && (
          <Stack direction="row" justifyContent="space-between">
            <Typography>SGST</Typography>
            <Typography>{formatCurrency(po.sgst, po.currency)}</Typography>
          </Stack>
        )}
        {po.igst > 0 && (
          <Stack direction="row" justifyContent="space-between">
            <Typography>IGST</Typography>
            <Typography>{formatCurrency(po.igst, po.currency)}</Typography>
          </Stack>
        )}
        <Divider />
        <Stack direction="row" justifyContent="space-between">
          <Typography variant="h6">Grand Total</Typography>
          <Typography variant="h6" color="primary">
            {formatCurrency(po.grandTotal, po.currency)}
          </Typography>
        </Stack>
        {po.advancePaymentRequired && (
          <Stack direction="row" justifyContent="space-between" sx={{ mt: 1 }}>
            <Typography color="text.secondary">
              Advance Payment ({po.advancePercentage}%)
            </Typography>
            <Typography color="text.secondary" fontWeight="medium">
              {formatCurrency(po.advanceAmount || 0, po.currency)}
            </Typography>
          </Stack>
        )}
      </Stack>
    </Paper>
  );
}
