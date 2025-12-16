'use client';

/**
 * Bill Allocation Table
 *
 * Table for allocating payment amounts to outstanding vendor bills.
 */

import {
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Paper,
  Stack,
  Button,
  TextField,
  Typography,
  Chip,
} from '@mui/material';
import { formatCurrency } from '@/lib/accounting/transactionHelpers';
import type { BillAllocationTableProps } from './types';

export function BillAllocationTable({
  outstandingBills,
  allocations,
  totalOutstanding,
  totalAllocated,
  amount,
  onAllocationChange,
  onAutoAllocate,
}: BillAllocationTableProps) {
  return (
    <TableContainer component={Paper} variant="outlined" sx={{ mb: 2 }}>
      <Table size="small">
        <TableHead>
          <TableRow sx={{ bgcolor: 'action.hover' }}>
            <TableCell>
              <strong>Bill Number</strong>
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
          </TableRow>
        </TableHead>
        <TableBody>
          {outstandingBills.map((bill, index) => {
            const allocation = allocations[index];
            const billDate = bill.date
              ? typeof (bill.date as unknown as { toDate?: () => Date }).toDate === 'function'
                ? (bill.date as unknown as { toDate: () => Date }).toDate()
                : new Date(bill.date as unknown as string | number)
              : null;
            return (
              <TableRow key={bill.id} hover>
                <TableCell>
                  <Chip
                    label={bill.transactionNumber}
                    size="small"
                    variant="outlined"
                    color="primary"
                  />
                </TableCell>
                <TableCell>{billDate ? billDate.toLocaleDateString() : '-'}</TableCell>
                <TableCell sx={{ maxWidth: 200, overflow: 'hidden', textOverflow: 'ellipsis' }}>
                  {bill.description || '-'}
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
                    onChange={(e) => onAllocationChange(bill.id!, parseFloat(e.target.value) || 0)}
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
                <Button size="small" variant="text" onClick={onAutoAllocate} disabled={amount <= 0}>
                  Auto Allocate
                </Button>
              </Stack>
            </TableCell>
            <TableCell align="right">
              <Typography variant="body2" fontWeight="bold">
                {formatCurrency(totalOutstanding)}
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
          </TableRow>
        </TableBody>
      </Table>
    </TableContainer>
  );
}
