'use client';

/**
 * PO Payments Section
 *
 * Milestone-by-milestone payment position and payment history for a purchase
 * order (feature request §3, §4, §7).
 *
 * Reads `po.paymentSummary` and NOTHING ELSE. Procurement cannot query
 * `transactions` — that needs VIEW_ACCOUNTING, which four of the nine live
 * users do not have — so every figure here comes from the projection the
 * `syncPOPaymentSummary` Cloud Function writes onto the PO document. Adding a
 * Firestore read of bills or payments to this component would make the whole
 * section fail with "Missing or insufficient permissions" for exactly the
 * people it is for.
 */

import {
  Box,
  Paper,
  Stack,
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableRow,
  Typography,
} from '@mui/material';
import { StatusChip, EmptyState } from '@vapour/ui';
import { PO_PAYMENT_STATUS_LABELS } from '@vapour/constants';
import type { PurchaseOrder } from '@vapour/types';
import { formatCurrencyCode, formatDate } from '@/lib/utils/formatters';

interface POPaymentsSectionProps {
  po: PurchaseOrder;
}

export function POPaymentsSection({ po }: POPaymentsSectionProps) {
  const summary = po.paymentSummary;
  const currency = po.currency || 'INR';

  if (!summary) {
    return (
      <Paper sx={{ p: 3 }}>
        <Typography variant="h6" gutterBottom>
          Payments
        </Typography>
        <EmptyState
          title="No payment position yet"
          message="Payment figures appear once a bill or payment is recorded against this PO. If you expect figures here, ask Accounts to rebuild the PO payment summaries from Data Health."
        />
      </Paper>
    );
  }

  return (
    <Paper sx={{ p: 3 }}>
      <Stack
        direction="row"
        justifyContent="space-between"
        alignItems="center"
        flexWrap="wrap"
        gap={1}
        sx={{ mb: 2 }}
      >
        <Typography variant="h6">Payments</Typography>
        <StatusChip
          status={summary.status}
          labels={PO_PAYMENT_STATUS_LABELS}
          context="poPayment"
          size="small"
        />
      </Stack>

      <Stack direction="row" flexWrap="wrap" gap={4} sx={{ mb: 3 }}>
        <Box>
          <Typography variant="body2" color="text.secondary">
            PO Value
          </Typography>
          <Typography variant="h6">{formatCurrencyCode(summary.totalAmount, currency)}</Typography>
        </Box>
        <Box>
          <Typography variant="body2" color="text.secondary">
            Paid
          </Typography>
          <Typography variant="h6" color="success.main">
            {formatCurrencyCode(summary.paidAmount, currency)}
          </Typography>
        </Box>
        <Box>
          <Typography variant="body2" color="text.secondary">
            Pending
          </Typography>
          <Typography variant="h6" color={summary.pendingAmount > 0 ? 'warning.main' : undefined}>
            {formatCurrencyCode(summary.pendingAmount, currency)}
          </Typography>
        </Box>
      </Stack>

      {summary.milestones.length > 0 && (
        <Box sx={{ mb: 3, overflowX: 'auto' }}>
          <Typography variant="subtitle2" color="text.secondary" gutterBottom>
            Milestones
          </Typography>
          <Table size="small">
            <TableHead>
              <TableRow>
                <TableCell width={50}>#</TableCell>
                <TableCell>Payment Type</TableCell>
                <TableCell align="right">%</TableCell>
                <TableCell align="right">Amount</TableCell>
                <TableCell align="right">Paid</TableCell>
                <TableCell align="right">Pending</TableCell>
                <TableCell>Status</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {summary.milestones.map((m) => (
                <TableRow key={m.milestoneId} hover>
                  <TableCell>{m.serialNumber}</TableCell>
                  <TableCell>{m.paymentType}</TableCell>
                  <TableCell align="right">{m.percentage}%</TableCell>
                  <TableCell align="right">{formatCurrencyCode(m.amount, currency)}</TableCell>
                  <TableCell align="right">{formatCurrencyCode(m.paid, currency)}</TableCell>
                  <TableCell align="right">{formatCurrencyCode(m.pending, currency)}</TableCell>
                  <TableCell>
                    <StatusChip
                      status={m.status}
                      labels={PO_PAYMENT_STATUS_LABELS}
                      context="poPayment"
                      size="small"
                    />
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </Box>
      )}

      <Box sx={{ overflowX: 'auto' }}>
        <Typography variant="subtitle2" color="text.secondary" gutterBottom>
          Payment History
        </Typography>
        {summary.history.length === 0 ? (
          <Typography variant="body2" color="text.secondary" sx={{ py: 2 }}>
            No payments recorded against this PO yet.
          </Typography>
        ) : (
          <Table size="small">
            <TableHead>
              <TableRow>
                <TableCell>Date</TableCell>
                <TableCell>Payment</TableCell>
                <TableCell align="right">Amount</TableCell>
                <TableCell>UTR / Reference</TableCell>
                <TableCell>Bill</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {summary.history.map((h, index) => (
                <TableRow key={`${h.paymentId}-${h.billId ?? index}`} hover>
                  <TableCell>{formatDate(h.paymentDate)}</TableCell>
                  <TableCell>{h.paymentNumber}</TableCell>
                  <TableCell align="right">{formatCurrencyCode(h.amount, currency)}</TableCell>
                  <TableCell>{h.reference || '—'}</TableCell>
                  <TableCell>{h.billNumber || '—'}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}
      </Box>

      {/*
        The projection is only as fresh as its last successful sync. Without
        this stamp a failed trigger shows procurement stale numbers with no
        signal that anything is wrong.
      */}
      <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mt: 2 }}>
        Payment figures last updated {formatDate(summary.syncedAt)}
      </Typography>
    </Paper>
  );
}

export default POPaymentsSection;
