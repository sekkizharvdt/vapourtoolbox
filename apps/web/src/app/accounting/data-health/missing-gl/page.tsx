'use client';

import { useState, useEffect } from 'react';
import {
  Box,
  Typography,
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
  FormControl,
  InputLabel,
  Select,
  MenuItem,
  CircularProgress,
  Snackbar,
  Breadcrumbs,
  Link,
  Paper,
} from '@mui/material';
import {
  Refresh as RefreshIcon,
  ArrowBack as BackIcon,
  CheckCircle as SuccessIcon,
  Error as ErrorIcon,
  Home as HomeIcon,
  Receipt as ReceiptIcon,
  Payment as PaymentIcon,
  Build as BuildIcon,
  AccountBalance as TotalIcon,
} from '@mui/icons-material';
import { useRouter } from 'next/navigation';
import { PageHeader, LoadingState, StatCard, FilterBar, EmptyState } from '@vapour/ui';
import { useAuth } from '@/contexts/AuthContext';
import { getFirebase } from '@/lib/firebase';
import { collection, query, where, getDocs } from 'firebase/firestore';
import { COLLECTIONS } from '@vapour/firebase';
import type { CustomerPayment, VendorPayment } from '@vapour/types';
import { regeneratePaymentGL } from '@/lib/accounting/glEntryRegeneration';
import { formatCurrency } from '@/lib/utils/formatters';

type MissingGLPayment = (CustomerPayment | VendorPayment) & {
  id: string;
  paymentType: 'CUSTOMER_PAYMENT' | 'VENDOR_PAYMENT';
  hasBankAccount: boolean;
};

export default function MissingGLEntriesPage() {
  const router = useRouter();
  useAuth();
  const [loading, setLoading] = useState(true);
  const [payments, setPayments] = useState<MissingGLPayment[]>([]);
  const [filteredPayments, setFilteredPayments] = useState<MissingGLPayment[]>([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [typeFilter, setTypeFilter] = useState<'all' | 'customer' | 'vendor'>('all');
  const [page, setPage] = useState(0);
  const [rowsPerPage, setRowsPerPage] = useState(25);

  // Regeneration state
  const [regenerating, setRegenerating] = useState<Record<string, boolean>>({});
  const [error, setError] = useState<string | null>(null);
  const [snackbar, setSnackbar] = useState<{
    open: boolean;
    message: string;
    severity: 'success' | 'error';
  }>({ open: false, message: '', severity: 'success' });

  const fetchMissingGLPayments = async () => {
    setLoading(true);
    setError(null);
    try {
      const { db } = getFirebase();
      const transactionsRef = collection(db, COLLECTIONS.TRANSACTIONS);

      const [customerSnap, vendorSnap] = await Promise.all([
        getDocs(
          query(
            transactionsRef,
            where('type', '==', 'CUSTOMER_PAYMENT'),
            where('status', '==', 'POSTED')
          )
        ),
        getDocs(
          query(
            transactionsRef,
            where('type', '==', 'VENDOR_PAYMENT'),
            where('status', '==', 'POSTED')
          )
        ),
      ]);

      const missingGL: MissingGLPayment[] = [];

      customerSnap.forEach((doc) => {
        const data = doc.data() as CustomerPayment;
        const entries = data.entries || [];
        if (entries.length === 0) {
          const bankAccountId = data.bankAccountId || data.depositedToBankAccountId;
          missingGL.push({
            ...data,
            id: doc.id,
            paymentType: 'CUSTOMER_PAYMENT',
            hasBankAccount: !!bankAccountId,
          });
        }
      });

      vendorSnap.forEach((doc) => {
        const data = doc.data() as VendorPayment;
        const entries = data.entries || [];
        if (entries.length === 0) {
          const bankAccountId = data.bankAccountId;
          missingGL.push({
            ...data,
            id: doc.id,
            paymentType: 'VENDOR_PAYMENT',
            hasBankAccount: !!bankAccountId,
          });
        }
      });

      // Sort by date descending
      missingGL.sort((a, b) => {
        const paymentDateA = a.paymentDate as unknown as { toDate?: () => Date } | string;
        const paymentDateB = b.paymentDate as unknown as { toDate?: () => Date } | string;
        const dateA =
          typeof paymentDateA === 'object' && paymentDateA?.toDate
            ? paymentDateA.toDate()
            : new Date(paymentDateA as string);
        const dateB =
          typeof paymentDateB === 'object' && paymentDateB?.toDate
            ? paymentDateB.toDate()
            : new Date(paymentDateB as string);
        return dateB.getTime() - dateA.getTime();
      });

      setPayments(missingGL);
      setFilteredPayments(missingGL);
    } catch (err) {
      console.error('Error fetching missing GL payments:', err);
      setError(
        err instanceof Error
          ? err.message
          : 'Failed to fetch transactions with missing GL entries. Please try again.'
      );
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchMissingGLPayments();
  }, []);

  useEffect(() => {
    let filtered = payments;

    if (typeFilter !== 'all') {
      filtered = filtered.filter((p) =>
        typeFilter === 'customer'
          ? p.paymentType === 'CUSTOMER_PAYMENT'
          : p.paymentType === 'VENDOR_PAYMENT'
      );
    }

    if (searchTerm) {
      const term = searchTerm.toLowerCase();
      filtered = filtered.filter(
        (p) =>
          p.entityName?.toLowerCase().includes(term) ||
          p.transactionNumber?.toLowerCase().includes(term)
      );
    }

    setFilteredPayments(filtered);
    setPage(0);
  }, [payments, searchTerm, typeFilter]);

  const formatDate = (date: unknown): string => {
    if (!date) return '-';
    const d =
      typeof date === 'object' && 'toDate' in date
        ? (date as { toDate: () => Date }).toDate()
        : new Date(date as string);
    return d.toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' });
  };

  const handleClearFilters = () => {
    setSearchTerm('');
    setTypeFilter('all');
  };

  const handleRegenerate = async (payment: MissingGLPayment) => {
    if (!payment.hasBankAccount) {
      setSnackbar({
        open: true,
        message: 'Cannot regenerate: No bank account specified. Please edit the payment first.',
        severity: 'error',
      });
      return;
    }

    setRegenerating((prev) => ({ ...prev, [payment.id]: true }));

    try {
      const { db } = getFirebase();
      const result = await regeneratePaymentGL(db, payment.id, payment.paymentType);

      if (result.success) {
        setSnackbar({
          open: true,
          message: `GL entries regenerated successfully (${result.entries.length} entries created)`,
          severity: 'success',
        });
        // Remove from list
        setPayments((prev) => prev.filter((p) => p.id !== payment.id));
      } else {
        setSnackbar({
          open: true,
          message: result.error || 'Failed to regenerate GL entries',
          severity: 'error',
        });
      }
    } catch (err) {
      console.error('Error regenerating GL:', err);
      setSnackbar({
        open: true,
        message: 'An error occurred while regenerating GL entries',
        severity: 'error',
      });
    } finally {
      setRegenerating((prev) => ({ ...prev, [payment.id]: false }));
    }
  };

  const handleRegenerateAll = async () => {
    const eligiblePayments = filteredPayments.filter((p) => p.hasBankAccount);
    if (eligiblePayments.length === 0) {
      setSnackbar({
        open: true,
        message: 'No payments with bank accounts to regenerate',
        severity: 'error',
      });
      return;
    }

    let successCount = 0;
    let failCount = 0;

    for (const payment of eligiblePayments) {
      setRegenerating((prev) => ({ ...prev, [payment.id]: true }));

      try {
        const { db } = getFirebase();
        const result = await regeneratePaymentGL(db, payment.id, payment.paymentType);

        if (result.success) {
          successCount++;
          setPayments((prev) => prev.filter((p) => p.id !== payment.id));
        } else {
          failCount++;
        }
      } catch (err) {
        console.error('Error regenerating GL for payment:', payment.id, err);
        failCount++;
      } finally {
        setRegenerating((prev) => ({ ...prev, [payment.id]: false }));
      }
    }

    setSnackbar({
      open: true,
      message: `Regeneration complete: ${successCount} succeeded, ${failCount} failed`,
      severity: failCount > 0 ? 'error' : 'success',
    });
  };

  const customerCount = filteredPayments.filter((p) => p.paymentType === 'CUSTOMER_PAYMENT').length;
  const vendorCount = filteredPayments.filter((p) => p.paymentType === 'VENDOR_PAYMENT').length;
  const eligibleCount = filteredPayments.filter((p) => p.hasBankAccount).length;

  if (loading) {
    return (
      <LoadingState variant="page" message="Loading transactions with missing GL entries..." />
    );
  }

  return (
    <Box sx={{ py: 4 }}>
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
        <Typography color="text.primary">Missing GL Entries</Typography>
      </Breadcrumbs>

      <PageHeader
        title="Missing GL Entries"
        action={
          <Box sx={{ display: 'flex', gap: 2 }}>
            {eligibleCount > 0 && (
              <Button
                variant="contained"
                color="primary"
                startIcon={<RefreshIcon />}
                onClick={handleRegenerateAll}
                disabled={Object.values(regenerating).some(Boolean)}
              >
                Regenerate All ({eligibleCount})
              </Button>
            )}
            <Button
              variant="outlined"
              startIcon={<BackIcon />}
              onClick={() => router.push('/accounting/data-health')}
            >
              Back
            </Button>
          </Box>
        }
      />

      {error && (
        <Alert severity="error" sx={{ mb: 3 }} onClose={() => setError(null)}>
          {error}
        </Alert>
      )}

      <Alert severity="warning" sx={{ mb: 3 }}>
        These posted transactions are missing General Ledger entries. This affects your financial
        reports (Balance Sheet, P&L). Click &quot;Regenerate&quot; to create the GL entries.
      </Alert>

      {/* Summary Cards */}
      <Box sx={{ display: 'flex', gap: 2, mb: 3, flexWrap: 'wrap' }}>
        <StatCard
          label="Total Missing"
          value={filteredPayments.length.toString()}
          icon={<TotalIcon />}
          color="primary"
        />
        <StatCard
          label="Customer Receipts"
          value={customerCount.toString()}
          icon={<ReceiptIcon />}
          color="success"
        />
        <StatCard
          label="Vendor Payments"
          value={vendorCount.toString()}
          icon={<PaymentIcon />}
          color="error"
        />
        <StatCard
          label="Can Auto-Fix"
          value={`${eligibleCount} / ${filteredPayments.length}`}
          icon={<BuildIcon />}
          color="info"
        />
      </Box>

      {/* Filters */}
      <FilterBar onClear={handleClearFilters}>
        <TextField
          placeholder="Search by entity or number..."
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
          size="small"
          sx={{ minWidth: 300 }}
        />
        <FormControl size="small" sx={{ minWidth: 150 }}>
          <InputLabel>Type</InputLabel>
          <Select
            value={typeFilter}
            label="Type"
            onChange={(e) => setTypeFilter(e.target.value as 'all' | 'customer' | 'vendor')}
          >
            <MenuItem value="all">All Types</MenuItem>
            <MenuItem value="customer">Customer Receipts</MenuItem>
            <MenuItem value="vendor">Vendor Payments</MenuItem>
          </Select>
        </FormControl>
      </FilterBar>

      <TableContainer component={Paper}>
        <Table>
          <TableHead>
            <TableRow>
              <TableCell>Type</TableCell>
              <TableCell>Number</TableCell>
              <TableCell>Date</TableCell>
              <TableCell>Entity</TableCell>
              <TableCell align="right">Amount</TableCell>
              <TableCell>Bank Account</TableCell>
              <TableCell align="center">Action</TableCell>
            </TableRow>
          </TableHead>
          <TableBody>
            {filteredPayments.length === 0 ? (
              <EmptyState
                message="All posted transactions have GL entries."
                variant="table"
                colSpan={7}
              />
            ) : (
              filteredPayments
                .slice(page * rowsPerPage, page * rowsPerPage + rowsPerPage)
                .map((payment) => (
                  <TableRow key={payment.id} hover>
                    <TableCell>
                      <Chip
                        label={payment.paymentType === 'CUSTOMER_PAYMENT' ? 'Receipt' : 'Payment'}
                        size="small"
                        color={payment.paymentType === 'CUSTOMER_PAYMENT' ? 'success' : 'error'}
                        variant="outlined"
                      />
                    </TableCell>
                    <TableCell>
                      <Typography variant="body2" fontWeight="medium">
                        {payment.transactionNumber}
                      </Typography>
                    </TableCell>
                    <TableCell>{formatDate(payment.paymentDate)}</TableCell>
                    <TableCell>{payment.entityName}</TableCell>
                    <TableCell align="right">
                      <Typography
                        fontWeight="medium"
                        color={
                          payment.paymentType === 'CUSTOMER_PAYMENT' ? 'success.main' : 'error.main'
                        }
                      >
                        {formatCurrency(payment.totalAmount || payment.amount || 0, 'INR')}
                      </Typography>
                    </TableCell>
                    <TableCell>
                      {payment.hasBankAccount ? (
                        <Chip label="Yes" size="small" color="success" variant="outlined" />
                      ) : (
                        <Chip label="Missing" size="small" color="error" variant="outlined" />
                      )}
                    </TableCell>
                    <TableCell align="center">
                      <Button
                        variant="contained"
                        size="small"
                        color={payment.hasBankAccount ? 'primary' : 'inherit'}
                        disabled={!payment.hasBankAccount || regenerating[payment.id]}
                        onClick={() => handleRegenerate(payment)}
                        startIcon={
                          regenerating[payment.id] ? (
                            <CircularProgress size={16} />
                          ) : (
                            <RefreshIcon />
                          )
                        }
                      >
                        {regenerating[payment.id] ? 'Working...' : 'Regenerate'}
                      </Button>
                    </TableCell>
                  </TableRow>
                ))
            )}
          </TableBody>
        </Table>
        <TablePagination
          component="div"
          count={filteredPayments.length}
          page={page}
          onPageChange={(_, newPage) => setPage(newPage)}
          rowsPerPage={rowsPerPage}
          onRowsPerPageChange={(e) => {
            setRowsPerPage(parseInt(e.target.value, 10));
            setPage(0);
          }}
          rowsPerPageOptions={[10, 25, 50, 100]}
        />
      </TableContainer>

      <Snackbar
        open={snackbar.open}
        autoHideDuration={6000}
        onClose={() => setSnackbar((prev) => ({ ...prev, open: false }))}
      >
        <Alert
          severity={snackbar.severity}
          onClose={() => setSnackbar((prev) => ({ ...prev, open: false }))}
          icon={snackbar.severity === 'success' ? <SuccessIcon /> : <ErrorIcon />}
        >
          {snackbar.message}
        </Alert>
      </Snackbar>
    </Box>
  );
}
