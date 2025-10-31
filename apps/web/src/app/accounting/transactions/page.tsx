'use client';

import { useState, useEffect } from 'react';
import {
  Box,
  Paper,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Typography,
  Chip,
  Stack,
  IconButton,
  Tooltip,
  TextField,
  MenuItem,
  FormControl,
  InputLabel,
  Select,
} from '@mui/material';
import {
  Visibility as ViewIcon,
  FilterList as FilterIcon,
} from '@mui/icons-material';
import { useAuth } from '@/contexts/AuthContext';
import { getFirebase } from '@/lib/firebase';
import { collection, query, orderBy, onSnapshot } from 'firebase/firestore';
import { COLLECTIONS } from '@vapour/firebase';
import type { BaseTransaction, TransactionType } from '@vapour/types';
import { formatCurrency } from '@/lib/accounting/transactionHelpers';

export default function TransactionsPage() {
  // Note: Auth context available but not currently used
  useAuth();
  const [transactions, setTransactions] = useState<BaseTransaction[]>([]);
  const [loading, setLoading] = useState(true);
  const [filterType, setFilterType] = useState<TransactionType | 'ALL'>('ALL');
  const [filterStatus, setFilterStatus] = useState<string>('ALL');
  const [searchTerm, setSearchTerm] = useState('');

  // Real-time listener for transactions
  useEffect(() => {
    const { db } = getFirebase();
    const transactionsRef = collection(db, COLLECTIONS.TRANSACTIONS);
    const q = query(
      transactionsRef,
      orderBy('date', 'desc')
    );

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
      const entityName = 'entityName' in txn ? (txn as { entityName?: string }).entityName : undefined;
      return (
        txn.transactionNumber?.toLowerCase().includes(searchLower) ||
        txn.description?.toLowerCase().includes(searchLower) ||
        txn.reference?.toLowerCase().includes(searchLower) ||
        entityName?.toLowerCase().includes(searchLower)
      );
    }

    return true;
  });

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

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'PAID':
      case 'POSTED':
        return 'success';
      case 'SENT':
      case 'APPROVED':
        return 'info';
      case 'DRAFT':
        return 'default';
      case 'OVERDUE':
        return 'error';
      default:
        return 'warning';
    }
  };

  if (loading) {
    return (
      <Box sx={{ p: 3 }}>
        <Typography>Loading transactions...</Typography>
      </Box>
    );
  }

  return (
    <Box sx={{ p: 3 }}>
      <Typography variant="h4" sx={{ mb: 3 }}>
        All Transactions
      </Typography>

      <Paper sx={{ p: 2, mb: 3 }}>
        <Stack direction="row" spacing={2} alignItems="center">
          <FilterIcon />
          <TextField
            label="Search"
            variant="outlined"
            size="small"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            placeholder="Search by number, description, or entity..."
            sx={{ flexGrow: 1 }}
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
        </Stack>
      </Paper>

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
            {filteredTransactions.length === 0 ? (
              <TableRow>
                <TableCell colSpan={9} align="center">
                  <Typography variant="body2" color="text.secondary" sx={{ py: 4 }}>
                    {searchTerm || filterType !== 'ALL' || filterStatus !== 'ALL'
                      ? 'No transactions match the selected filters.'
                      : 'No transactions found.'}
                  </Typography>
                </TableCell>
              </TableRow>
            ) : (
              filteredTransactions.map((txn) => (
                <TableRow key={txn.id} hover>
                  <TableCell>
                    {new Date(txn.date).toLocaleDateString()}
                  </TableCell>
                  <TableCell>
                    <Chip
                      label={getTransactionTypeLabel(txn.type)}
                      size="small"
                      variant="outlined"
                    />
                  </TableCell>
                  <TableCell>{txn.transactionNumber}</TableCell>
                  <TableCell>{'entityName' in txn ? (txn as { entityName?: string }).entityName || '-' : '-'}</TableCell>
                  <TableCell>{txn.description || '-'}</TableCell>
                  <TableCell>{txn.reference || '-'}</TableCell>
                  <TableCell align="right">
                    {formatCurrency(txn.amount)}
                  </TableCell>
                  <TableCell>
                    <Chip
                      label={txn.status}
                      size="small"
                      color={getStatusColor(txn.status)}
                    />
                  </TableCell>
                  <TableCell align="right">
                    <Tooltip title="View Details">
                      <IconButton size="small">
                        <ViewIcon fontSize="small" />
                      </IconButton>
                    </Tooltip>
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </TableContainer>

      <Box sx={{ mt: 2, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <Typography variant="body2" color="text.secondary">
          Showing {filteredTransactions.length} of {transactions.length} transactions
        </Typography>
        <Typography variant="body2" color="text.secondary">
          Total: {formatCurrency(filteredTransactions.reduce((sum, txn) => sum + txn.amount, 0))}
        </Typography>
      </Box>
    </Box>
  );
}
