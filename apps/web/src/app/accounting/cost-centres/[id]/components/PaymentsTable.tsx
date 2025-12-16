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

interface PaymentsTableProps {
  payments: BaseTransaction[];
  formatCurrency: (amount: number | undefined | null, currency?: string) => string;
  formatDate: (date: Date | undefined) => string;
}

export function PaymentsTable({ payments, formatCurrency, formatDate }: PaymentsTableProps) {
  if (payments.length === 0) {
    return (
      <Box sx={{ p: 3 }}>
        <Alert severity="info">No payments received for this cost centre.</Alert>
      </Box>
    );
  }

  return (
    <TableContainer>
      <Table>
        <TableHead>
          <TableRow>
            <TableCell>Receipt #</TableCell>
            <TableCell>Date</TableCell>
            <TableCell>Customer</TableCell>
            <TableCell>Reference</TableCell>
            <TableCell align="right">Amount</TableCell>
            <TableCell>Status</TableCell>
          </TableRow>
        </TableHead>
        <TableBody>
          {payments.map((payment) => (
            <TableRow key={payment.id} hover>
              <TableCell>
                <Typography variant="body2" fontWeight="medium">
                  {payment.transactionNumber}
                </Typography>
              </TableCell>
              <TableCell>{formatDate(payment.date)}</TableCell>
              <TableCell>{payment.entityName || '-'}</TableCell>
              <TableCell>{payment.referenceNumber || payment.reference || '-'}</TableCell>
              <TableCell align="right">
                {formatCurrency(payment.amount, payment.currency)}
              </TableCell>
              <TableCell>
                <Chip
                  label={payment.status}
                  color={payment.status === 'POSTED' ? 'success' : 'default'}
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
