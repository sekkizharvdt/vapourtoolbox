'use client';

import { useState, useEffect } from 'react';
import {
  Box,
  Typography,
  Card,
  CardContent,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  TablePagination,
  Button,
  Chip,
  Alert,
  TextField,
  InputAdornment,
  FormControl,
  InputLabel,
  Select,
  MenuItem,
} from '@mui/material';
import {
  Edit as EditIcon,
  Search as SearchIcon,
  ArrowBack as BackIcon,
  CheckCircle as SuccessIcon,
  Home as HomeIcon,
} from '@mui/icons-material';
import { useRouter } from 'next/navigation';
import { PageHeader, LoadingState } from '@vapour/ui';
import { Breadcrumbs, Link } from '@mui/material';
import { useAuth } from '@/contexts/AuthContext';
import { getFirebase } from '@/lib/firebase';
import { collection, query, where, getDocs } from 'firebase/firestore';
import { COLLECTIONS } from '@vapour/firebase';
import type { VendorBill, CustomerInvoice, InvoiceLineItem } from '@vapour/types';

type UnmappedTransaction = {
  id: string;
  transactionNumber: string;
  type: 'VENDOR_BILL' | 'CUSTOMER_INVOICE';
  entityName: string;
  date: unknown;
  totalAmount: number;
  unmappedCount: number;
  totalLineItems: number;
};

export default function UnmappedAccountsPage() {
  const router = useRouter();
  useAuth();
  const [loading, setLoading] = useState(true);
  const [transactions, setTransactions] = useState<UnmappedTransaction[]>([]);
  const [filteredTransactions, setFilteredTransactions] = useState<UnmappedTransaction[]>([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [typeFilter, setTypeFilter] = useState<'all' | 'bill' | 'invoice'>('all');
  const [page, setPage] = useState(0);
  const [rowsPerPage, setRowsPerPage] = useState(25);

  const fetchUnmappedTransactions = async () => {
    setLoading(true);
    try {
      const { db } = getFirebase();
      const transactionsRef = collection(db, COLLECTIONS.TRANSACTIONS);

      const [billsSnap, invoicesSnap] = await Promise.all([
        getDocs(query(transactionsRef, where('type', '==', 'VENDOR_BILL'))),
        getDocs(query(transactionsRef, where('type', '==', 'CUSTOMER_INVOICE'))),
      ]);

      const unmapped: UnmappedTransaction[] = [];

      billsSnap.forEach((doc) => {
        const data = doc.data() as VendorBill;
        const lineItems: InvoiceLineItem[] = data.lineItems || [];
        const unmappedItems = lineItems.filter((item) => !item.accountId);

        if (unmappedItems.length > 0) {
          unmapped.push({
            id: doc.id,
            transactionNumber: data.transactionNumber || '',
            type: 'VENDOR_BILL',
            entityName: data.entityName || '',
            date: data.date || data.billDate,
            totalAmount: data.totalAmount || 0,
            unmappedCount: unmappedItems.length,
            totalLineItems: lineItems.length,
          });
        }
      });

      invoicesSnap.forEach((doc) => {
        const data = doc.data() as CustomerInvoice;
        const lineItems: InvoiceLineItem[] = data.lineItems || [];
        const unmappedItems = lineItems.filter((item) => !item.accountId);

        if (unmappedItems.length > 0) {
          unmapped.push({
            id: doc.id,
            transactionNumber: data.transactionNumber || '',
            type: 'CUSTOMER_INVOICE',
            entityName: data.entityName || '',
            date: data.date || data.invoiceDate,
            totalAmount: data.totalAmount || 0,
            unmappedCount: unmappedItems.length,
            totalLineItems: lineItems.length,
          });
        }
      });

      // Sort by unmapped count descending, then by date
      unmapped.sort((a, b) => {
        if (b.unmappedCount !== a.unmappedCount) {
          return b.unmappedCount - a.unmappedCount;
        }
        const dateRawA = a.date as { toDate?: () => Date } | string | undefined;
        const dateRawB = b.date as { toDate?: () => Date } | string | undefined;
        const dateA =
          dateRawA && typeof dateRawA === 'object' && dateRawA.toDate
            ? dateRawA.toDate()
            : new Date(dateRawA as string);
        const dateB =
          dateRawB && typeof dateRawB === 'object' && dateRawB.toDate
            ? dateRawB.toDate()
            : new Date(dateRawB as string);
        return dateB.getTime() - dateA.getTime();
      });

      setTransactions(unmapped);
      setFilteredTransactions(unmapped);
    } catch (err) {
      console.error('Error fetching unmapped transactions:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchUnmappedTransactions();
  }, []);

  useEffect(() => {
    let filtered = transactions;

    if (typeFilter !== 'all') {
      filtered = filtered.filter((t) =>
        typeFilter === 'bill' ? t.type === 'VENDOR_BILL' : t.type === 'CUSTOMER_INVOICE'
      );
    }

    if (searchTerm) {
      const term = searchTerm.toLowerCase();
      filtered = filtered.filter(
        (t) =>
          t.entityName?.toLowerCase().includes(term) ||
          t.transactionNumber?.toLowerCase().includes(term)
      );
    }

    setFilteredTransactions(filtered);
    setPage(0);
  }, [transactions, searchTerm, typeFilter]);

  const formatDate = (date: unknown): string => {
    if (!date) return '-';
    const d =
      typeof date === 'object' && 'toDate' in date
        ? (date as { toDate: () => Date }).toDate()
        : new Date(date as string);
    return d.toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' });
  };

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('en-IN', {
      style: 'currency',
      currency: 'INR',
      maximumFractionDigits: 2,
    }).format(amount);
  };

  const handleEdit = (transaction: UnmappedTransaction) => {
    if (transaction.type === 'VENDOR_BILL') {
      router.push(`/accounting/bills?edit=${transaction.id}`);
    } else {
      router.push(`/accounting/invoices?edit=${transaction.id}`);
    }
  };

  const billCount = filteredTransactions.filter((t) => t.type === 'VENDOR_BILL').length;
  const invoiceCount = filteredTransactions.filter((t) => t.type === 'CUSTOMER_INVOICE').length;
  const totalUnmappedItems = filteredTransactions.reduce((sum, t) => sum + t.unmappedCount, 0);

  if (loading) {
    return <LoadingState message="Loading transactions with unmapped accounts..." />;
  }

  return (
    <>
      <Breadcrumbs sx={{ mb: 2 }}>
        <Link
          color="inherit"
          href="/accounting"
          onClick={(e: React.MouseEvent) => {
            e.preventDefault();
            router.push('/accounting');
          }}
          sx={{ display: 'flex', alignItems: 'center', cursor: 'pointer' }}
        >
          <HomeIcon sx={{ mr: 0.5 }} fontSize="small" />
          Accounting
        </Link>
        <Link
          color="inherit"
          href="/accounting/data-health"
          onClick={(e: React.MouseEvent) => {
            e.preventDefault();
            router.push('/accounting/data-health');
          }}
          sx={{ cursor: 'pointer' }}
        >
          Data Health
        </Link>
        <Typography color="text.primary">Unmapped Accounts</Typography>
      </Breadcrumbs>

      <PageHeader
        title="Unmapped Line Item Accounts"
        action={
          <Button
            variant="outlined"
            startIcon={<BackIcon />}
            onClick={() => router.push('/accounting/data-health')}
          >
            Back to Dashboard
          </Button>
        }
      />

      <Alert severity="info" sx={{ mb: 3 }}>
        These transactions have line items without a Chart of Account assigned. This affects
        expense/revenue categorization in reports. Click &quot;Edit&quot; to assign accounts to each
        line item.
      </Alert>

      {/* Summary Cards */}
      <Box sx={{ display: 'flex', gap: 2, mb: 3, flexWrap: 'wrap' }}>
        <Card sx={{ minWidth: 150 }}>
          <CardContent sx={{ py: 1.5 }}>
            <Typography variant="body2" color="text.secondary">
              Transactions
            </Typography>
            <Typography variant="h5" fontWeight="bold">
              {filteredTransactions.length}
            </Typography>
          </CardContent>
        </Card>
        <Card sx={{ minWidth: 150 }}>
          <CardContent sx={{ py: 1.5 }}>
            <Typography variant="body2" color="text.secondary">
              Vendor Bills
            </Typography>
            <Typography variant="h5" fontWeight="bold" color="error.main">
              {billCount}
            </Typography>
          </CardContent>
        </Card>
        <Card sx={{ minWidth: 150 }}>
          <CardContent sx={{ py: 1.5 }}>
            <Typography variant="body2" color="text.secondary">
              Customer Invoices
            </Typography>
            <Typography variant="h5" fontWeight="bold" color="success.main">
              {invoiceCount}
            </Typography>
          </CardContent>
        </Card>
        <Card sx={{ minWidth: 200 }}>
          <CardContent sx={{ py: 1.5 }}>
            <Typography variant="body2" color="text.secondary">
              Unmapped Line Items
            </Typography>
            <Typography variant="h5" fontWeight="bold" color="warning.main">
              {totalUnmappedItems}
            </Typography>
          </CardContent>
        </Card>
      </Box>

      {/* Filters */}
      <Card sx={{ mb: 3 }}>
        <CardContent sx={{ py: 2 }}>
          <Box sx={{ display: 'flex', gap: 2, flexWrap: 'wrap' }}>
            <TextField
              placeholder="Search by entity or number..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              size="small"
              sx={{ minWidth: 300 }}
              InputProps={{
                startAdornment: (
                  <InputAdornment position="start">
                    <SearchIcon />
                  </InputAdornment>
                ),
              }}
            />
            <FormControl size="small" sx={{ minWidth: 150 }}>
              <InputLabel>Type</InputLabel>
              <Select
                value={typeFilter}
                label="Type"
                onChange={(e) => setTypeFilter(e.target.value as 'all' | 'bill' | 'invoice')}
              >
                <MenuItem value="all">All Types</MenuItem>
                <MenuItem value="bill">Vendor Bills</MenuItem>
                <MenuItem value="invoice">Customer Invoices</MenuItem>
              </Select>
            </FormControl>
          </Box>
        </CardContent>
      </Card>

      {filteredTransactions.length === 0 ? (
        <Box sx={{ textAlign: 'center', py: 4 }}>
          <SuccessIcon sx={{ fontSize: 48, color: 'success.main', mb: 2 }} />
          <Typography variant="h6">No Unmapped Accounts</Typography>
          <Typography color="text.secondary">
            All line items have account mappings assigned.
          </Typography>
        </Box>
      ) : (
        <Card>
          <TableContainer>
            <Table>
              <TableHead>
                <TableRow>
                  <TableCell>Type</TableCell>
                  <TableCell>Number</TableCell>
                  <TableCell>Date</TableCell>
                  <TableCell>Entity</TableCell>
                  <TableCell align="right">Amount</TableCell>
                  <TableCell align="center">Unmapped Items</TableCell>
                  <TableCell align="center">Action</TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {filteredTransactions
                  .slice(page * rowsPerPage, page * rowsPerPage + rowsPerPage)
                  .map((transaction) => (
                    <TableRow key={transaction.id} hover>
                      <TableCell>
                        <Chip
                          label={transaction.type === 'VENDOR_BILL' ? 'Bill' : 'Invoice'}
                          size="small"
                          color={transaction.type === 'VENDOR_BILL' ? 'error' : 'success'}
                          variant="outlined"
                        />
                      </TableCell>
                      <TableCell>
                        <Typography variant="body2" fontWeight="medium">
                          {transaction.transactionNumber}
                        </Typography>
                      </TableCell>
                      <TableCell>{formatDate(transaction.date)}</TableCell>
                      <TableCell>{transaction.entityName}</TableCell>
                      <TableCell align="right">
                        <Typography fontWeight="medium">
                          {formatCurrency(transaction.totalAmount)}
                        </Typography>
                      </TableCell>
                      <TableCell align="center">
                        <Chip
                          label={`${transaction.unmappedCount} / ${transaction.totalLineItems}`}
                          size="small"
                          color={
                            transaction.unmappedCount === transaction.totalLineItems
                              ? 'error'
                              : 'warning'
                          }
                        />
                      </TableCell>
                      <TableCell align="center">
                        <Button
                          variant="contained"
                          size="small"
                          startIcon={<EditIcon />}
                          onClick={() => handleEdit(transaction)}
                        >
                          Edit
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))}
              </TableBody>
            </Table>
          </TableContainer>
          <TablePagination
            component="div"
            count={filteredTransactions.length}
            page={page}
            onPageChange={(_, newPage) => setPage(newPage)}
            rowsPerPage={rowsPerPage}
            onRowsPerPageChange={(e) => {
              setRowsPerPage(parseInt(e.target.value, 10));
              setPage(0);
            }}
            rowsPerPageOptions={[10, 25, 50, 100]}
          />
        </Card>
      )}
    </>
  );
}
