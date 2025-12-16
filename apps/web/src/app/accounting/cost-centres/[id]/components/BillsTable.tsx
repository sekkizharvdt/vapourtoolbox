'use client';

import {
  Alert,
  Box,
  Chip,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Typography,
} from '@mui/material';
import type { BaseTransaction } from '@vapour/types';

interface BillsTableProps {
  bills: BaseTransaction[];
  formatCurrency: (amount: number | undefined | null, currency?: string) => string;
  formatDate: (date: Date | undefined) => string;
}

export function BillsTable({ bills, formatCurrency, formatDate }: BillsTableProps) {
  if (bills.length === 0) {
    return (
      <Box sx={{ p: 3 }}>
        <Alert severity="info">No vendor bills found for this cost centre.</Alert>
      </Box>
    );
  }

  return (
    <TableContainer>
      <Table>
        <TableHead>
          <TableRow>
            <TableCell>Bill #</TableCell>
            <TableCell>Date</TableCell>
            <TableCell>Vendor</TableCell>
            <TableCell>Reference</TableCell>
            <TableCell align="right">Amount</TableCell>
            <TableCell>Status</TableCell>
          </TableRow>
        </TableHead>
        <TableBody>
          {bills.map((bill) => (
            <TableRow key={bill.id} hover>
              <TableCell>
                <Typography variant="body2" fontWeight="medium">
                  {bill.transactionNumber}
                </Typography>
              </TableCell>
              <TableCell>{formatDate(bill.date)}</TableCell>
              <TableCell>{bill.entityName || '-'}</TableCell>
              <TableCell>{bill.referenceNumber || bill.reference || '-'}</TableCell>
              <TableCell align="right">{formatCurrency(bill.amount, bill.currency)}</TableCell>
              <TableCell>
                <Chip
                  label={bill.status}
                  color={
                    bill.status === 'PAID'
                      ? 'success'
                      : bill.status === 'POSTED'
                        ? 'info'
                        : 'default'
                  }
                  size="small"
                />
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </TableContainer>
  );
}
