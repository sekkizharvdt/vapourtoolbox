'use client';

/**
 * Generic Transaction Allocation Table
 *
 * Table for allocating payment amounts to outstanding invoices or bills.
 * Consolidates InvoiceAllocationTable and BillAllocationTable.
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
  Chip,
} from '@mui/material';
import { PlaylistAdd as FillIcon } from '@mui/icons-material';
import { formatCurrency } from '@/lib/accounting/transactionHelpers';
import type { PaymentAllocation } from '@vapour/types';

export type AllocationTransactionType = 'invoice' | 'bill';

export interface AllocatableTransaction {
  id?: string;
  transactionNumber?: string;
  date?: Date | { toDate: () => Date };
  description?: string;
  totalAmount?: number;
  currency?: string;
}

export interface TransactionAllocationTableProps {
  transactionType: AllocationTransactionType;
  transactions: AllocatableTransaction[];
  allocations: PaymentAllocation[];
  totalAllocated: number;
  totalOutstanding?: number;
  unallocated: number;
  paymentAmount?: number;
  onAllocationChange: (transactionId: string, allocatedAmount: number) => void;
  onAutoAllocate: () => void;
  onFillRemaining: (transactionId: string) => void;
  showForexColumn?: boolean;
  variant?: 'standard' | 'compact';
}

/**
 * Helper to safely convert Firestore Timestamp or Date to Date
 */
function toDate(value: Date | { toDate?: () => Date } | string | number | undefined): Date | null {
  if (!value) return null;
  if (value instanceof Date) return value;
  if (typeof (value as { toDate?: () => Date }).toDate === 'function') {
    return (value as { toDate: () => Date }).toDate();
  }
  return new Date(value as string | number);
}

export function TransactionAllocationTable({
  transactionType,
  transactions,
  allocations,
  totalAllocated,
  totalOutstanding,
  unallocated,
  paymentAmount = 0,
  onAllocationChange,
  onAutoAllocate,
  onFillRemaining,
  showForexColumn = false,
  variant = 'standard',
}: TransactionAllocationTableProps) {
  const isInvoice = transactionType === 'invoice';
  const entityLabel = isInvoice ? 'Invoice' : 'Bill';
  const entitiesLabel = isInvoice ? 'Invoices' : 'Bills';

  if (transactions.length === 0) {
    return null;
  }

  // Standard variant (used by customer payments)
  if (variant === 'standard') {
    return (
      <>
        <Grid size={{ xs: 12 }}>
          <Stack direction="row" justifyContent="space-between" alignItems="center">
            <Typography variant="h6">Allocate to {entitiesLabel}</Typography>
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
                  <TableCell>{entityLabel} Number</TableCell>
                  <TableCell>Date</TableCell>
                  {showForexColumn && <TableCell align="right">{entityLabel} Amount</TableCell>}
                  <TableCell align="right">Outstanding (INR)</TableCell>
                  <TableCell align="right">Allocate Amount</TableCell>
                  <TableCell align="right">Remaining</TableCell>
                  <TableCell align="center">Actions</TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {transactions.map((transaction, index) => {
                  const allocation = allocations[index];
                  const transactionDate = toDate(transaction.date);
                  const transactionCurrency = transaction.currency || 'INR';
                  const originalAmount = transaction.totalAmount || 0;
                  const isForexTransaction = transactionCurrency !== 'INR';

                  return (
                    <TableRow key={transaction.id}>
                      <TableCell>{transaction.transactionNumber}</TableCell>
                      <TableCell>
                        {transactionDate ? transactionDate.toLocaleDateString() : '-'}
                      </TableCell>
                      {showForexColumn && (
                        <TableCell align="right">
                          {isForexTransaction ? (
                            <Typography variant="body2">
                              {transactionCurrency}{' '}
                              {originalAmount.toLocaleString('en-IN', {
                                minimumFractionDigits: 2,
                              })}
                            </Typography>
                          ) : (
                            formatCurrency(originalAmount)
                          )}
                        </TableCell>
                      )}
                      <TableCell align="right">
                        {formatCurrency(allocation?.originalAmount || 0)}
                      </TableCell>
                      <TableCell align="right">
                        <TextField
                          type="number"
                          size="small"
                          value={allocation?.allocatedAmount || 0}
                          onChange={(e) =>
                            onAllocationChange(transaction.id!, parseFloat(e.target.value) || 0)
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
                              onClick={() => onFillRemaining(transaction.id!)}
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

  // Compact variant (used by vendor payments)
  return (
    <TableContainer component={Paper} variant="outlined" sx={{ mb: 2 }}>
      <Table size="small">
        <TableHead>
          <TableRow sx={{ bgcolor: 'action.hover' }}>
            <TableCell>
              <strong>{entityLabel} Number</strong>
            </TableCell>
            <TableCell>
              <strong>Date</strong>
            </TableCell>
            <TableCell>
              <strong>Description</strong>
            </TableCell>
            <TableCell align="right">
              <strong>Outstanding</strong>
            </TableCell>
            <TableCell align="right">
              <strong>Allocate</strong>
            </TableCell>
            <TableCell align="center">
              <strong>Actions</strong>
            </TableCell>
          </TableRow>
        </TableHead>
        <TableBody>
          {transactions.map((transaction, index) => {
            const allocation = allocations[index];
            const transactionDate = toDate(transaction.date);

            return (
              <TableRow key={transaction.id} hover>
                <TableCell>
                  <Chip
                    label={transaction.transactionNumber}
                    size="small"
                    variant="outlined"
                    color="primary"
                  />
                </TableCell>
                <TableCell>
                  {transactionDate ? transactionDate.toLocaleDateString() : '-'}
                </TableCell>
                <TableCell sx={{ maxWidth: 200, overflow: 'hidden', textOverflow: 'ellipsis' }}>
                  {transaction.description || '-'}
                </TableCell>
                <TableCell align="right">
                  <Typography variant="body2" fontWeight="medium">
                    {formatCurrency(allocation?.originalAmount || 0)}
                  </Typography>
                </TableCell>
                <TableCell align="right">
                  <TextField
                    type="number"
                    size="small"
                    value={allocation?.allocatedAmount || 0}
                    onChange={(e) =>
                      onAllocationChange(transaction.id!, parseFloat(e.target.value) || 0)
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
                <TableCell align="center">
                  {allocation && allocation.remainingAmount > 0 && unallocated > 0 && (
                    <Tooltip
                      title={`Fill remaining ${formatCurrency(Math.min(unallocated, allocation.remainingAmount))}`}
                    >
                      <IconButton
                        size="small"
                        onClick={() => onFillRemaining(transaction.id!)}
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
          {/* Summary row */}
          <TableRow sx={{ bgcolor: 'action.selected' }}>
            <TableCell colSpan={3}>
              <Stack direction="row" spacing={1} alignItems="center">
                <Typography variant="body2" fontWeight="bold">
                  Total
                </Typography>
                <Button
                  size="small"
                  variant="text"
                  onClick={onAutoAllocate}
                  disabled={paymentAmount <= 0}
                >
                  Auto Allocate
                </Button>
              </Stack>
            </TableCell>
            <TableCell align="right">
              <Typography variant="body2" fontWeight="bold">
                {formatCurrency(totalOutstanding || 0)}
              </Typography>
            </TableCell>
            <TableCell align="right">
              <Typography
                variant="body2"
                fontWeight="bold"
                color={totalAllocated > 0 ? 'success.main' : 'text.secondary'}
              >
                {formatCurrency(totalAllocated)}
              </Typography>
            </TableCell>
            <TableCell />
          </TableRow>
        </TableBody>
      </Table>
    </TableContainer>
  );
}
