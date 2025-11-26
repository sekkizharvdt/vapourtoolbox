'use client';

import { useState, useEffect } from 'react';
import {
  Container,
  Paper,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Box,
  Typography,
  Chip,
  TextField,
  MenuItem,
  FormControl,
  InputLabel,
  Select,
  TablePagination,
  InputAdornment,
} from '@mui/material';
import { Visibility as ViewIcon, Search as SearchIcon } from '@mui/icons-material';
import {
  PageHeader,
  LoadingState,
  EmptyState,
  FilterBar,
  TableActionCell,
  getStatusColor,
} from '@vapour/ui';
import { useAuth } from '@/contexts/AuthContext';
import { getFirebase } from '@/lib/firebase';
import { collection, query, orderBy, onSnapshot } from 'firebase/firestore';
import { COLLECTIONS } from '@vapour/firebase';
import type { BaseTransaction, TransactionType } from '@vapour/types';
import { formatCurrency } from '@/lib/accounting/transactionHelpers';
import { formatDate } from '@/lib/utils/formatters';

export default function TransactionsPage() {
  // Note: Auth context available but not currently used
  useAuth();
  const [transactions, setTransactions] = useState<BaseTransaction[]>([]);
  const [loading, setLoading] = useState(true);
  const [filterType, setFilterType] = useState<TransactionType | 'ALL'>('ALL');
  const [filterStatus, setFilterStatus] = useState<string>('ALL');
  const [searchTerm, setSearchTerm] = useState('');
  const [page, setPage] = useState(0);
  const [rowsPerPage, setRowsPerPage] = useState(25);

  // Real-time listener for transactions
  useEffect(() => {
    const { db } = getFirebase();
    const transactionsRef = collection(db, COLLECTIONS.TRANSACTIONS);
    const q = query(transactionsRef, orderBy('date', 'desc'));

    const unsubscribe = onSnapshot(q, (snapshot) => {
      const transactionsData: BaseTransaction[] = [];
      snapshot.forEach((doc) => {
        const data = doc.data();
        transactionsData.push({ id: doc.id, ...data } as BaseTransaction);
      });
      setTransactions(transactionsData);
      setLoading(false);
    });

    return () => unsubscribe();
  }, []);

  // Filter transactions
  const filteredTransactions = transactions.filter((txn) => {
    // Filter by type
    if (filterType !== 'ALL' && txn.type !== filterType) {
      return false;
    }

    // Filter by status
    if (filterStatus !== 'ALL' && txn.status !== filterStatus) {
      return false;
    }

    // Search filter
    if (searchTerm) {
      const searchLower = searchTerm.toLowerCase();
      const entityName =
        'entityName' in txn ? (txn as { entityName?: string }).entityName : undefined;
      return (
        txn.transactionNumber?.toLowerCase().includes(searchLower) ||
        txn.description?.toLowerCase().includes(searchLower) ||
        txn.reference?.toLowerCase().includes(searchLower) ||
        entityName?.toLowerCase().includes(searchLower)
      );
    }

    return true;
  });

  // Paginate filtered transactions
  const paginatedTransactions = filteredTransactions.slice(
    page * rowsPerPage,
    page * rowsPerPage + rowsPerPage
  );

  const handleChangePage = (_event: unknown, newPage: number) => {
    setPage(newPage);
  };

  const handleChangeRowsPerPage = (event: React.ChangeEvent<HTMLInputElement>) => {
    setRowsPerPage(parseInt(event.target.value, 10));
    setPage(0);
  };

  const getTransactionTypeLabel = (type: TransactionType): string => {
    const labels: Record<TransactionType, string> = {
      CUSTOMER_INVOICE: 'Invoice',
      CUSTOMER_PAYMENT: 'Receipt',
      VENDOR_BILL: 'Bill',
      VENDOR_PAYMENT: 'Payment',
      JOURNAL_ENTRY: 'Journal Entry',
      BANK_TRANSFER: 'Transfer',
      EXPENSE_CLAIM: 'Expense',
    };
    return labels[type] || type;
  };

  const handleClearFilters = () => {
    setSearchTerm('');
    setFilterType('ALL');
    setFilterStatus('ALL');
  };

  if (loading) {
    return (
      <Container maxWidth="xl" sx={{ py: 4 }}>
        <LoadingState message="Loading transactions..." variant="page" />
      </Container>
    );
  }

  return (
    <Container maxWidth="xl" sx={{ py: 4 }}>
      <PageHeader title="All Transactions" subtitle="View and manage all accounting transactions" />

      <FilterBar onClear={handleClearFilters}>
        <TextField
          label="Search"
          size="small"
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
          placeholder="Search by number, description, or entity..."
          sx={{ minWidth: 300 }}
          InputProps={{
            startAdornment: (
              <InputAdornment position="start">
                <SearchIcon />
              </InputAdornment>
            ),
          }}
        />
        <FormControl size="small" sx={{ minWidth: 200 }}>
          <InputLabel>Type</InputLabel>
          <Select
            value={filterType}
            onChange={(e) => setFilterType(e.target.value as TransactionType | 'ALL')}
            label="Type"
          >
            <MenuItem value="ALL">All Types</MenuItem>
            <MenuItem value="CUSTOMER_INVOICE">Invoices</MenuItem>
            <MenuItem value="VENDOR_BILL">Bills</MenuItem>
            <MenuItem value="JOURNAL_ENTRY">Journal Entries</MenuItem>
            <MenuItem value="CUSTOMER_PAYMENT">Receipts</MenuItem>
            <MenuItem value="VENDOR_PAYMENT">Payments</MenuItem>
            <MenuItem value="BANK_TRANSFER">Transfers</MenuItem>
            <MenuItem value="EXPENSE_CLAIM">Expenses</MenuItem>
          </Select>
        </FormControl>
        <FormControl size="small" sx={{ minWidth: 150 }}>
          <InputLabel>Status</InputLabel>
          <Select
            value={filterStatus}
            onChange={(e) => setFilterStatus(e.target.value)}
            label="Status"
          >
            <MenuItem value="ALL">All Status</MenuItem>
            <MenuItem value="DRAFT">Draft</MenuItem>
            <MenuItem value="SENT">Sent</MenuItem>
            <MenuItem value="APPROVED">Approved</MenuItem>
            <MenuItem value="PAID">Paid</MenuItem>
            <MenuItem value="POSTED">Posted</MenuItem>
            <MenuItem value="OVERDUE">Overdue</MenuItem>
          </Select>
        </FormControl>
      </FilterBar>

      <TableContainer component={Paper}>
        <Table>
          <TableHead>
            <TableRow>
              <TableCell>Date</TableCell>
              <TableCell>Type</TableCell>
              <TableCell>Transaction Number</TableCell>
              <TableCell>Entity</TableCell>
              <TableCell>Description</TableCell>
              <TableCell>Reference</TableCell>
              <TableCell align="right">Amount</TableCell>
              <TableCell>Status</TableCell>
              <TableCell align="right">Actions</TableCell>
            </TableRow>
          </TableHead>
          <TableBody>
            {paginatedTransactions.length === 0 ? (
              <EmptyState
                message={
                  searchTerm || filterType !== 'ALL' || filterStatus !== 'ALL'
                    ? 'No transactions match the selected filters. Try adjusting your filters or search criteria.'
                    : 'No transactions found. Transactions will appear here once created.'
                }
                variant="table"
                colSpan={9}
              />
            ) : (
              paginatedTransactions.map((txn) => (
                <TableRow key={txn.id} hover>
                  <TableCell>{formatDate(txn.date)}</TableCell>
                  <TableCell>
                    <Chip
                      label={getTransactionTypeLabel(txn.type)}
                      size="small"
                      variant="outlined"
                    />
                  </TableCell>
                  <TableCell>{txn.transactionNumber}</TableCell>
                  <TableCell>
                    {'entityName' in txn ? (txn as { entityName?: string }).entityName || '-' : '-'}
                  </TableCell>
                  <TableCell>{txn.description || '-'}</TableCell>
                  <TableCell>{txn.reference || '-'}</TableCell>
                  <TableCell align="right">{formatCurrency(txn.amount)}</TableCell>
                  <TableCell>
                    <Chip
                      label={txn.status}
                      size="small"
                      color={getStatusColor(txn.status, 'transaction')}
                    />
                  </TableCell>
                  <TableCell align="right">
                    <TableActionCell
                      actions={[
                        {
                          icon: <ViewIcon />,
                          label: 'View Details',
                          onClick: () => {},
                        },
                      ]}
                    />
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
        <TablePagination
          rowsPerPageOptions={[10, 25, 50, 100]}
          component="div"
          count={filteredTransactions.length}
          rowsPerPage={rowsPerPage}
          page={page}
          onPageChange={handleChangePage}
          onRowsPerPageChange={handleChangeRowsPerPage}
        />
      </TableContainer>

      <Box sx={{ mt: 2, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <Typography variant="body2" color="text.secondary">
          Showing {filteredTransactions.length} of {transactions.length} transactions
        </Typography>
        <Typography variant="body2" color="text.secondary">
          Total: {formatCurrency(filteredTransactions.reduce((sum, txn) => sum + txn.amount, 0))}
        </Typography>
      </Box>
    </Container>
  );
}
