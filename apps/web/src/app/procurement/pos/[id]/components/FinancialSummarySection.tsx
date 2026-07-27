/**
 * Financial Summary Section Component
 *
 * Displays PO financial breakdown: subtotal, taxes, grand total, advance payment
 */

'use client';

import { Paper, Typography, Stack, Divider } from '@mui/material';
import type { PurchaseOrder, PurchaseOrderItem } from '@vapour/types';
import { formatCurrency } from '@/lib/procurement/purchaseOrderHelpers';
import { getLineDiscountAmount } from './POLineItemsTable';

interface FinancialSummarySectionProps {
  po: PurchaseOrder;
  /** When provided, per-line discounts are summed and shown above the subtotal. */
  items?: PurchaseOrderItem[];
}

export function FinancialSummarySection({ po, items }: FinancialSummarySectionProps) {
  // Line items are priced at the actual unit price with the discount baked
  // into `amount` — surface the deduction so subtotal ≠ Σ(qty×price) is
  // explained (feedback Mqj9wmh96ui3mlBtWNOF).
  const lineDiscountTotal =
    Math.round((items ?? []).reduce((sum, i) => sum + getLineDiscountAmount(i), 0) * 100) / 100;

  return (
    <Paper sx={{ p: 3 }}>
      <Typography variant="h6" gutterBottom>
        Financial Summary
      </Typography>
      <Divider sx={{ my: 2 }} />
      <Stack spacing={1}>
        {lineDiscountTotal > 0 && (
          <>
            <Stack direction="row" justifyContent="space-between">
              <Typography>Gross Amount</Typography>
              <Typography>
                {formatCurrency(po.subtotal + lineDiscountTotal, po.currency)}
              </Typography>
            </Stack>
            <Stack direction="row" justifyContent="space-between">
              <Typography>Line Item Discounts</Typography>
              <Typography color="error.main">
                {`- ${formatCurrency(lineDiscountTotal, po.currency)}`}
              </Typography>
            </Stack>
          </>
        )}
        <Stack direction="row" justifyContent="space-between">
          <Typography>Subtotal</Typography>
          <Typography fontWeight="medium">{formatCurrency(po.subtotal, po.currency)}</Typography>
        </Stack>
        {po.discount !== undefined && po.discount > 0 && (
          <Stack direction="row" justifyContent="space-between">
            <Typography>Discount</Typography>
            <Typography color="error.main">
              {`- ${formatCurrency(po.discount, po.currency)}`}
            </Typography>
          </Stack>
        )}
        {po.packingForwardingAmount !== undefined && po.packingForwardingAmount > 0 && (
          <Stack direction="row" justifyContent="space-between">
            <Typography>Packing &amp; Forwarding</Typography>
            <Typography>{`+ ${formatCurrency(po.packingForwardingAmount, po.currency)}`}</Typography>
          </Stack>
        )}
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
