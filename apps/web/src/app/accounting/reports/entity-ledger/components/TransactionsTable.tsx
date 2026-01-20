'use client';

import { useMemo } from 'react';
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
import { formatCurrency, formatDate } from '@/lib/utils/formatters';
import { getTransactionTypeLabel, getTransactionTypeColor, getPaymentStatusColor } from './helpers';
import type { EntityTransaction } from './types';

interface TransactionsTableProps {
  transactions: EntityTransaction[];
  page: number;
  rowsPerPage: number;
  onPageChange: (event: unknown, newPage: number) => void;
  onRowsPerPageChange: (event: React.ChangeEvent<HTMLInputElement>) => void;
  /** Opening balance from prior period transactions */
  openingBalance?: number;
}

/**
 * Determines if a transaction is a debit or credit from the entity's perspective.
 * - Customer Ledger: Invoices = Debit (they owe us), Payments = Credit (they paid us)
 * - Vendor Ledger: Bills = Credit (we owe them), Payments = Debit (we paid them)
 */
function getDebitCredit(txn: EntityTransaction): { debit: number; credit: number } {
  const amount = txn.totalAmount || txn.amount || 0;

  switch (txn.type) {
    case 'CUSTOMER_INVOICE':
      // Customer owes us - Debit to their account
      return { debit: amount, credit: 0 };
    case 'CUSTOMER_PAYMENT':
      // Customer paid us - Credit to their account
      return { debit: 0, credit: amount };
    case 'VENDOR_BILL':
      // We owe vendor - Credit to their account (our liability)
      return { debit: 0, credit: amount };
    case 'VENDOR_PAYMENT':
      // We paid vendor - Debit to their account (reduce liability)
      return { debit: amount, credit: 0 };
    default:
      return { debit: 0, credit: 0 };
  }
}

/**
 * Calculates the balance impact of a transaction
 * Positive = increases receivable (customer owes more or we owe vendor less)
 * Negative = decreases receivable (customer paid or we owe vendor more)
 */
function getBalanceImpact(txn: EntityTransaction): number {
  const amount = txn.totalAmount || txn.amount || 0;
  switch (txn.type) {
    case 'CUSTOMER_INVOICE':
      return amount; // Customer owes us more
    case 'CUSTOMER_PAYMENT':
      return -amount; // Customer paid, owes less
    case 'VENDOR_BILL':
      return -amount; // We owe vendor more (negative balance)
    case 'VENDOR_PAYMENT':
      return amount; // We paid vendor, owe less
    default:
      return 0;
  }
}

export function TransactionsTable({
  transactions,
  page,
  rowsPerPage,
  onPageChange,
  onRowsPerPageChange,
  openingBalance = 0,
}: TransactionsTableProps) {
  // Calculate running balances for all transactions (oldest to newest)
  // Note: transactions come in newest-first order from the page, we need to reverse for calculation
  const transactionsWithBalance = useMemo(() => {
    // Reverse to process oldest first
    const chronological = [...transactions].reverse();
    let runningBalance = openingBalance;

    const withBalances = chronological.map((txn) => {
      runningBalance += getBalanceImpact(txn);
      return { ...txn, runningBalance };
    });

    // Reverse back to newest-first for display
    return withBalances.reverse();
  }, [transactions, openingBalance]);

  const paginatedTransactions = transactionsWithBalance.slice(
    page * rowsPerPage,
    page * rowsPerPage + rowsPerPage
  );

  const showOpeningBalanceRow = page === 0 && openingBalance !== 0;

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
              <TableCell align="right">Debit</TableCell>
              <TableCell align="right">Credit</TableCell>
              <TableCell align="right">Balance</TableCell>
              <TableCell>Status</TableCell>
            </TableRow>
          </TableHead>
          <TableBody>
            {/* Opening Balance Row - show on first page if there's an opening balance */}
            {showOpeningBalanceRow && (
              <TableRow sx={{ bgcolor: 'grey.50' }}>
                <TableCell colSpan={4}>
                  <Typography variant="body2" fontWeight="medium" fontStyle="italic">
                    Opening Balance (from prior transactions)
                  </Typography>
                </TableCell>
                <TableCell align="right">-</TableCell>
                <TableCell align="right">-</TableCell>
                <TableCell align="right">
                  <Typography
                    variant="body2"
                    fontWeight="bold"
                    color={openingBalance >= 0 ? 'success.main' : 'error.main'}
                  >
                    {formatCurrency(openingBalance, 'INR')}
                  </Typography>
                </TableCell>
                <TableCell>-</TableCell>
              </TableRow>
            )}
            {paginatedTransactions.map((txn) => {
              const { debit, credit } = getDebitCredit(txn);
              return (
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
                    {debit > 0 ? (
                      <Typography variant="body2" fontWeight="medium">
                        {formatCurrency(debit, txn.currency || 'INR')}
                      </Typography>
                    ) : (
                      <Typography variant="body2" color="text.secondary">
                        -
                      </Typography>
                    )}
                  </TableCell>
                  <TableCell align="right">
                    {credit > 0 ? (
                      <Typography variant="body2" fontWeight="medium">
                        {formatCurrency(credit, txn.currency || 'INR')}
                      </Typography>
                    ) : (
                      <Typography variant="body2" color="text.secondary">
                        -
                      </Typography>
                    )}
                  </TableCell>
                  <TableCell align="right">
                    <Typography
                      variant="body2"
                      fontWeight="medium"
                      color={txn.runningBalance >= 0 ? 'success.main' : 'error.main'}
                    >
                      {formatCurrency(txn.runningBalance, 'INR')}
                    </Typography>
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
              );
            })}
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
