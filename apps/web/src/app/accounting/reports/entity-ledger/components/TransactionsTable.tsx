'use client';

import { useState, useMemo, Fragment } from 'react';
import {
  Typography,
  Chip,
  Paper,
  Box,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  TablePagination,
  Collapse,
  IconButton,
} from '@mui/material';
import {
  KeyboardArrowDown as ExpandIcon,
  KeyboardArrowUp as CollapseIcon,
} from '@mui/icons-material';
import { formatCurrency, formatDate } from '@/lib/utils/formatters';
import { getTransactionTypeLabel, getTransactionTypeColor, getPaymentStatusColor } from './helpers';
import type { EntityTransaction, AllocationRef } from './types';

interface TransactionsTableProps {
  transactions: EntityTransaction[];
  page: number;
  rowsPerPage: number;
  onPageChange: (event: unknown, newPage: number) => void;
  onRowsPerPageChange: (event: React.ChangeEvent<HTMLInputElement>) => void;
  /** Opening balance from prior period transactions */
  openingBalance?: number;
  /** Map of bill/invoice ID → payments allocated to it */
  allocationMap?: Map<string, AllocationRef[]>;
}

const TOTAL_COLUMNS = 9; // including expand column

/**
 * Determines if a transaction is a debit or credit from the entity's perspective.
 * - Customer Ledger: Invoices = Debit (they owe us), Payments = Credit (they paid us)
 * - Vendor Ledger: Bills = Credit (we owe them), Payments = Debit (we paid them)
 */
function getDebitCredit(txn: EntityTransaction): { debit: number; credit: number } {
  // Use baseAmount (INR) for foreign currency transactions, fall back to totalAmount for INR-only
  const amount = txn.baseAmount || txn.totalAmount || txn.amount || 0;

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
    case 'JOURNAL_ENTRY': {
      // Journal entries: entity-specific debit/credit computed during loading
      const jDebit = (txn as EntityTransaction & { _journalDebit?: number })._journalDebit || 0;
      const jCredit = (txn as EntityTransaction & { _journalCredit?: number })._journalCredit || 0;
      return { debit: jDebit, credit: jCredit };
    }
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
  // Use baseAmount (INR) for foreign currency transactions
  const amount = txn.baseAmount || txn.totalAmount || txn.amount || 0;
  switch (txn.type) {
    case 'CUSTOMER_INVOICE':
      return amount; // Customer owes us more
    case 'CUSTOMER_PAYMENT':
      return -amount; // Customer paid, owes less
    case 'VENDOR_BILL':
      return -amount; // We owe vendor more (negative balance)
    case 'VENDOR_PAYMENT':
      return amount; // We paid vendor, owe less
    case 'JOURNAL_ENTRY': {
      const jDebit = (txn as EntityTransaction & { _journalDebit?: number })._journalDebit || 0;
      const jCredit = (txn as EntityTransaction & { _journalCredit?: number })._journalCredit || 0;
      return jDebit - jCredit;
    }
    default:
      return 0;
  }
}

/** Check if a transaction has allocation details to show */
function hasAllocations(
  txn: EntityTransaction,
  allocationMap?: Map<string, AllocationRef[]>
): boolean {
  // Payments: check own allocation arrays
  if (txn.type === 'CUSTOMER_PAYMENT' && txn.invoiceAllocations?.length) return true;
  if (txn.type === 'VENDOR_PAYMENT' && txn.billAllocations?.length) return true;
  // Bills/Invoices: check if any payments are allocated to them
  if (
    (txn.type === 'CUSTOMER_INVOICE' || txn.type === 'VENDOR_BILL') &&
    allocationMap?.has(txn.id!)
  )
    return true;
  return false;
}

export function TransactionsTable({
  transactions,
  page,
  rowsPerPage,
  onPageChange,
  onRowsPerPageChange,
  openingBalance = 0,
  allocationMap,
}: TransactionsTableProps) {
  const [expandedRow, setExpandedRow] = useState<string | null>(null);

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

  const toggleExpand = (txnId: string) => {
    setExpandedRow((prev) => (prev === txnId ? null : txnId));
  };

  return (
    <Paper>
      <TableContainer>
        <Table>
          <TableHead>
            <TableRow>
              <TableCell sx={{ width: 40, p: 0.5 }} />
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
                <TableCell sx={{ p: 0.5 }} />
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
              const txnId = txn.id!;
              const expandable = hasAllocations(txn, allocationMap);
              const isExpanded = expandedRow === txnId;

              return (
                <Fragment key={txnId}>
                  <TableRow
                    hover
                    sx={expandable ? { cursor: 'pointer' } : undefined}
                    onClick={expandable ? () => toggleExpand(txnId) : undefined}
                  >
                    <TableCell sx={{ p: 0.5 }}>
                      {expandable && (
                        <IconButton size="small" onClick={() => toggleExpand(txnId)}>
                          {isExpanded ? (
                            <CollapseIcon fontSize="small" />
                          ) : (
                            <ExpandIcon fontSize="small" />
                          )}
                        </IconButton>
                      )}
                    </TableCell>
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
                      {txn.currency && txn.currency !== 'INR' && txn.totalAmount ? (
                        <Typography variant="caption" color="text.secondary" display="block">
                          {formatCurrency(txn.totalAmount, txn.currency)}
                          {txn.exchangeRate ? ` @ ${txn.exchangeRate}` : ''}
                        </Typography>
                      ) : null}
                      {txn.dueDate && (
                        <Typography variant="caption" color="text.secondary" display="block">
                          Due: {formatDate(txn.dueDate)}
                        </Typography>
                      )}
                    </TableCell>
                    <TableCell align="right">
                      {debit > 0 ? (
                        <Typography variant="body2" fontWeight="medium">
                          {formatCurrency(debit, 'INR')}
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
                          {formatCurrency(credit, 'INR')}
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

                  {/* Expandable allocation detail row */}
                  {expandable && (
                    <TableRow>
                      <TableCell colSpan={TOTAL_COLUMNS} sx={{ py: 0, border: 0 }}>
                        <Collapse in={isExpanded} timeout="auto" unmountOnExit>
                          <AllocationDetail txn={txn} allocationMap={allocationMap} />
                        </Collapse>
                      </TableCell>
                    </TableRow>
                  )}
                </Fragment>
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

/** Inline component showing allocation details for a single transaction */
function AllocationDetail({
  txn,
  allocationMap,
}: {
  txn: EntityTransaction;
  allocationMap?: Map<string, AllocationRef[]>;
}) {
  const isBillOrInvoice = txn.type === 'CUSTOMER_INVOICE' || txn.type === 'VENDOR_BILL';
  const isPayment = txn.type === 'CUSTOMER_PAYMENT' || txn.type === 'VENDOR_PAYMENT';

  // For bills/invoices: show payments allocated to them
  if (isBillOrInvoice) {
    const appliedPayments = allocationMap?.get(txn.id!) || [];
    const totalAllocated = appliedPayments.reduce((sum, p) => sum + p.allocatedAmount, 0);
    const totalAmount = txn.baseAmount || txn.totalAmount || 0;

    return (
      <Box sx={{ py: 1.5, px: 2, bgcolor: 'grey.50' }}>
        <Typography
          variant="caption"
          fontWeight="bold"
          color="text.secondary"
          sx={{ mb: 1, display: 'block' }}
        >
          Payment Allocations
        </Typography>
        <Table size="small">
          <TableHead>
            <TableRow>
              <TableCell sx={{ fontWeight: 'bold', fontSize: '0.75rem' }}>Payment #</TableCell>
              <TableCell sx={{ fontWeight: 'bold', fontSize: '0.75rem' }}>Date</TableCell>
              <TableCell align="right" sx={{ fontWeight: 'bold', fontSize: '0.75rem' }}>
                Amount Applied
              </TableCell>
            </TableRow>
          </TableHead>
          <TableBody>
            {appliedPayments.map((payment, idx) => (
              <TableRow key={idx}>
                <TableCell sx={{ fontSize: '0.75rem' }}>{payment.paymentNumber}</TableCell>
                <TableCell sx={{ fontSize: '0.75rem' }}>
                  {formatDate(payment.paymentDate)}
                </TableCell>
                <TableCell align="right" sx={{ fontSize: '0.75rem' }}>
                  {formatCurrency(payment.allocatedAmount, 'INR')}
                </TableCell>
              </TableRow>
            ))}
            <TableRow>
              <TableCell
                colSpan={2}
                sx={{ fontWeight: 'bold', fontSize: '0.75rem', borderBottom: 0 }}
              >
                Total Allocated / Bill Amount
              </TableCell>
              <TableCell
                align="right"
                sx={{ fontWeight: 'bold', fontSize: '0.75rem', borderBottom: 0 }}
              >
                {formatCurrency(totalAllocated, 'INR')} / {formatCurrency(totalAmount, 'INR')}
              </TableCell>
            </TableRow>
          </TableBody>
        </Table>
      </Box>
    );
  }

  // For payments: show bills/invoices they are allocated to
  if (isPayment) {
    const allocations =
      txn.type === 'CUSTOMER_PAYMENT' ? txn.invoiceAllocations : txn.billAllocations;
    if (!allocations?.length) return null;

    const totalAllocated = allocations.reduce((sum, a) => sum + a.allocatedAmount, 0);
    const label = txn.type === 'CUSTOMER_PAYMENT' ? 'Invoice' : 'Bill';

    return (
      <Box sx={{ py: 1.5, px: 2, bgcolor: 'grey.50' }}>
        <Typography
          variant="caption"
          fontWeight="bold"
          color="text.secondary"
          sx={{ mb: 1, display: 'block' }}
        >
          Allocated to {label}s
        </Typography>
        <Table size="small">
          <TableHead>
            <TableRow>
              <TableCell sx={{ fontWeight: 'bold', fontSize: '0.75rem' }}>{label} #</TableCell>
              <TableCell align="right" sx={{ fontWeight: 'bold', fontSize: '0.75rem' }}>
                Original Amount
              </TableCell>
              <TableCell align="right" sx={{ fontWeight: 'bold', fontSize: '0.75rem' }}>
                Amount Applied
              </TableCell>
              <TableCell align="right" sx={{ fontWeight: 'bold', fontSize: '0.75rem' }}>
                Remaining
              </TableCell>
            </TableRow>
          </TableHead>
          <TableBody>
            {allocations.map((alloc, idx) => (
              <TableRow key={idx}>
                <TableCell sx={{ fontSize: '0.75rem' }}>{alloc.invoiceNumber}</TableCell>
                <TableCell align="right" sx={{ fontSize: '0.75rem' }}>
                  {formatCurrency(alloc.originalAmount, 'INR')}
                </TableCell>
                <TableCell align="right" sx={{ fontSize: '0.75rem' }}>
                  {formatCurrency(alloc.allocatedAmount, 'INR')}
                </TableCell>
                <TableCell align="right" sx={{ fontSize: '0.75rem' }}>
                  {formatCurrency(alloc.remainingAmount, 'INR')}
                </TableCell>
              </TableRow>
            ))}
            <TableRow>
              <TableCell sx={{ fontWeight: 'bold', fontSize: '0.75rem', borderBottom: 0 }}>
                Total
              </TableCell>
              <TableCell align="right" sx={{ borderBottom: 0 }} />
              <TableCell
                align="right"
                sx={{ fontWeight: 'bold', fontSize: '0.75rem', borderBottom: 0 }}
              >
                {formatCurrency(totalAllocated, 'INR')}
              </TableCell>
              <TableCell align="right" sx={{ borderBottom: 0 }} />
            </TableRow>
          </TableBody>
        </Table>
      </Box>
    );
  }

  return null;
}
