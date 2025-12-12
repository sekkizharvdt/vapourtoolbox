'use client';

import {
  Typography,
  Chip,
  Paper,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  TablePagination,
} from '@mui/material';
import { formatCurrency } from '@/lib/accounting/transactionHelpers';
import { formatDate } from '@/lib/utils/formatters';
import { getTransactionTypeLabel, getTransactionTypeColor, getPaymentStatusColor } from './helpers';
import type { EntityTransaction } from './types';

interface TransactionsTableProps {
  transactions: EntityTransaction[];
  page: number;
  rowsPerPage: number;
  onPageChange: (event: unknown, newPage: number) => void;
  onRowsPerPageChange: (event: React.ChangeEvent<HTMLInputElement>) => void;
}

export function TransactionsTable({
  transactions,
  page,
  rowsPerPage,
  onPageChange,
  onRowsPerPageChange,
}: TransactionsTableProps) {
  const paginatedTransactions = transactions.slice(
    page * rowsPerPage,
    page * rowsPerPage + rowsPerPage
  );

  return (
    <Paper>
      <TableContainer>
        <Table>
          <TableHead>
            <TableRow>
              <TableCell>Date</TableCell>
              <TableCell>Type</TableCell>
              <TableCell>Transaction #</TableCell>
              <TableCell>Description</TableCell>
              <TableCell align="right">Amount</TableCell>
              <TableCell align="right">Outstanding</TableCell>
              <TableCell>Status</TableCell>
            </TableRow>
          </TableHead>
          <TableBody>
            {paginatedTransactions.map((txn) => (
              <TableRow key={txn.id} hover>
                <TableCell>{formatDate(txn.invoiceDate || txn.billDate || txn.date)}</TableCell>
                <TableCell>
                  <Chip
                    label={getTransactionTypeLabel(txn.type)}
                    size="small"
                    color={getTransactionTypeColor(txn.type)}
                  />
                </TableCell>
                <TableCell>
                  <Typography variant="body2" fontWeight="medium">
                    {txn.transactionNumber}
                  </Typography>
                </TableCell>
                <TableCell>
                  <Typography variant="body2" noWrap sx={{ maxWidth: 250 }}>
                    {txn.description || '-'}
                  </Typography>
                  {txn.dueDate && (
                    <Typography variant="caption" color="text.secondary" display="block">
                      Due: {formatDate(txn.dueDate)}
                    </Typography>
                  )}
                </TableCell>
                <TableCell align="right">
                  <Typography variant="body2" fontWeight="medium">
                    {formatCurrency(txn.totalAmount || txn.amount, txn.currency)}
                  </Typography>
                </TableCell>
                <TableCell align="right">
                  {txn.outstandingAmount !== undefined && txn.outstandingAmount > 0 ? (
                    <Typography variant="body2" color="warning.main" fontWeight="medium">
                      {formatCurrency(txn.outstandingAmount, txn.currency)}
                    </Typography>
                  ) : (
                    <Typography variant="body2" color="text.secondary">
                      -
                    </Typography>
                  )}
                </TableCell>
                <TableCell>
                  {txn.paymentStatus && (
                    <Chip
                      label={txn.paymentStatus.replace('_', ' ')}
                      size="small"
                      color={getPaymentStatusColor(txn.paymentStatus)}
                    />
                  )}
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </TableContainer>
      <TablePagination
        rowsPerPageOptions={[10, 25, 50, 100]}
        component="div"
        count={transactions.length}
        rowsPerPage={rowsPerPage}
        page={page}
        onPageChange={onPageChange}
        onRowsPerPageChange={onRowsPerPageChange}
      />
    </Paper>
  );
}
