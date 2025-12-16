'use client';

import {
  Alert,
  Box,
  Chip,
  IconButton,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Tooltip,
  Typography,
} from '@mui/material';
import { OpenInNew as OpenIcon } from '@mui/icons-material';
import { useRouter } from 'next/navigation';
import type { CustomerInvoice } from '@vapour/types';

interface InvoicesTableProps {
  invoices: CustomerInvoice[];
  formatCurrency: (amount: number | undefined | null, currency?: string) => string;
  formatDate: (date: Date | undefined) => string;
}

export function InvoicesTable({ invoices, formatCurrency, formatDate }: InvoicesTableProps) {
  const router = useRouter();

  if (invoices.length === 0) {
    return (
      <Box sx={{ p: 3 }}>
        <Alert severity="info">No invoices found for this cost centre.</Alert>
      </Box>
    );
  }

  return (
    <TableContainer>
      <Table>
        <TableHead>
          <TableRow>
            <TableCell>Invoice #</TableCell>
            <TableCell>Date</TableCell>
            <TableCell>Customer</TableCell>
            <TableCell align="right">Amount</TableCell>
            <TableCell align="right">Paid</TableCell>
            <TableCell>Status</TableCell>
            <TableCell align="center">Actions</TableCell>
          </TableRow>
        </TableHead>
        <TableBody>
          {invoices.map((invoice) => (
            <TableRow key={invoice.id} hover>
              <TableCell>
                <Typography variant="body2" fontWeight="medium">
                  {invoice.transactionNumber}
                </Typography>
              </TableCell>
              <TableCell>{formatDate(invoice.date)}</TableCell>
              <TableCell>{invoice.entityName || '-'}</TableCell>
              <TableCell align="right">
                {formatCurrency(invoice.totalAmount || invoice.amount, invoice.currency)}
              </TableCell>
              <TableCell align="right">
                {formatCurrency(invoice.paidAmount || 0, invoice.currency)}
              </TableCell>
              <TableCell>
                <Chip
                  label={invoice.paymentStatus || invoice.status}
                  color={
                    invoice.paymentStatus === 'PAID'
                      ? 'success'
                      : invoice.paymentStatus === 'PARTIALLY_PAID'
                        ? 'warning'
                        : 'default'
                  }
                  size="small"
                />
              </TableCell>
              <TableCell align="center">
                <Tooltip title="View Invoice">
                  <IconButton
                    size="small"
                    onClick={() => router.push(`/accounting/invoices/${invoice.id}`)}
                  >
                    <OpenIcon fontSize="small" />
                  </IconButton>
                </Tooltip>
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </TableContainer>
  );
}
