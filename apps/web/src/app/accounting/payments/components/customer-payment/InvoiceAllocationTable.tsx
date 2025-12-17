'use client';

/**
 * Invoice Allocation Table
 *
 * Table for allocating payment amounts to outstanding customer invoices.
 */

import {
  Grid,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Paper,
  Stack,
  TextField,
  Typography,
  Button,
  IconButton,
  Tooltip,
} from '@mui/material';
import { PlaylistAdd as FillIcon } from '@mui/icons-material';
import { formatCurrency } from '@/lib/accounting/transactionHelpers';
import type { InvoiceAllocationTableProps } from './types';

export function InvoiceAllocationTable({
  outstandingInvoices,
  allocations,
  totalAllocated,
  unallocated,
  onAllocationChange,
  onAutoAllocate,
  onFillRemaining,
}: InvoiceAllocationTableProps) {
  if (outstandingInvoices.length === 0) {
    return null;
  }

  return (
    <>
      <Grid size={{ xs: 12 }}>
        <Stack direction="row" justifyContent="space-between" alignItems="center">
          <Typography variant="h6">Allocate to Invoices</Typography>
          <Stack direction="row" spacing={2} alignItems="center">
            <Typography variant="body2" color="text.secondary">
              Allocated: {formatCurrency(totalAllocated)} | Unallocated:{' '}
              {formatCurrency(unallocated)}
            </Typography>
            <Button
              variant="outlined"
              size="small"
              onClick={onAutoAllocate}
              disabled={unallocated <= 0}
            >
              Auto Allocate
            </Button>
          </Stack>
        </Stack>
      </Grid>

      <Grid size={{ xs: 12 }}>
        <TableContainer component={Paper} variant="outlined">
          <Table size="small">
            <TableHead>
              <TableRow>
                <TableCell>Invoice Number</TableCell>
                <TableCell>Date</TableCell>
                <TableCell align="right">Invoice Amount</TableCell>
                <TableCell align="right">Outstanding (INR)</TableCell>
                <TableCell align="right">Allocate Amount</TableCell>
                <TableCell align="right">Remaining</TableCell>
                <TableCell align="center">Actions</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {outstandingInvoices.map((invoice, index) => {
                const allocation = allocations[index];
                // Handle Firestore Timestamp or Date for invoice date
                const invoiceDate = invoice.date
                  ? typeof (invoice.date as unknown as { toDate?: () => Date }).toDate ===
                    'function'
                    ? (invoice.date as unknown as { toDate: () => Date }).toDate()
                    : new Date(invoice.date as unknown as string | number)
                  : null;
                // Show original currency amount if different from INR
                const invoiceCurrency = invoice.currency || 'INR';
                const originalAmount = invoice.totalAmount || 0;
                const isForexInvoice = invoiceCurrency !== 'INR';
                return (
                  <TableRow key={invoice.id}>
                    <TableCell>{invoice.transactionNumber}</TableCell>
                    <TableCell>{invoiceDate ? invoiceDate.toLocaleDateString() : '-'}</TableCell>
                    <TableCell align="right">
                      {isForexInvoice ? (
                        <Typography variant="body2">
                          {invoiceCurrency}{' '}
                          {originalAmount.toLocaleString('en-IN', {
                            minimumFractionDigits: 2,
                          })}
                        </Typography>
                      ) : (
                        formatCurrency(originalAmount)
                      )}
                    </TableCell>
                    <TableCell align="right">
                      {formatCurrency(allocation?.originalAmount || 0)}
                    </TableCell>
                    <TableCell align="right">
                      <TextField
                        type="number"
                        size="small"
                        value={allocation?.allocatedAmount || 0}
                        onChange={(e) =>
                          onAllocationChange(invoice.id!, parseFloat(e.target.value) || 0)
                        }
                        slotProps={{
                          htmlInput: {
                            min: 0,
                            max: allocation?.originalAmount || 0,
                            step: 0.01,
                          },
                        }}
                        sx={{ width: 120 }}
                      />
                    </TableCell>
                    <TableCell align="right">
                      {formatCurrency(allocation?.remainingAmount || 0)}
                    </TableCell>
                    <TableCell align="center">
                      {allocation && allocation.remainingAmount > 0 && unallocated > 0 && (
                        <Tooltip
                          title={`Fill remaining ${formatCurrency(Math.min(unallocated, allocation.remainingAmount))}`}
                        >
                          <IconButton
                            size="small"
                            onClick={() => onFillRemaining(invoice.id!)}
                            color="primary"
                          >
                            <FillIcon fontSize="small" />
                          </IconButton>
                        </Tooltip>
                      )}
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        </TableContainer>
      </Grid>
    </>
  );
}
