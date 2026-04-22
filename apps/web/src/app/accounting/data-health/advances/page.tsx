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
  Tooltip,
  Alert,
  TextField,
  FormControl,
  InputLabel,
  Select,
  MenuItem,
  Paper,
} from '@mui/material';
import { PageBreadcrumbs } from '@/components/common/PageBreadcrumbs';
import {
  Edit as EditIcon,
  ArrowBack as BackIcon,
  Home as HomeIcon,
  Savings as AdvanceIcon,
  Receipt as ReceiptIcon,
  Payment as PaymentIcon,
  AttachMoney as MoneyIcon,
  AccountBalance as TotalIcon,
} from '@mui/icons-material';
import { useRouter } from 'next/navigation';
import { PageHeader, LoadingState, StatCard, FilterBar, EmptyState } from '@vapour/ui';
import { useAuth } from '@/contexts/AuthContext';
import { getFirebase } from '@/lib/firebase';
import { collection, query, where, getDocs } from 'firebase/firestore';
import { COLLECTIONS } from '@vapour/firebase';
import type { CustomerPayment, VendorPayment } from '@vapour/types';
import { RecordCustomerPaymentDialog } from '../../payments/components/RecordCustomerPaymentDialog';
import { RecordVendorPaymentDialog } from '../../payments/components/RecordVendorPaymentDialog';
import { formatCurrency } from '@/lib/utils/formatters';

type AdvancePayment = (CustomerPayment | VendorPayment) & {
  id: string;
  paymentType: 'customer' | 'vendor';
};

export default function AdvancesPage() {
  const router = useRouter();
  useAuth();
  const [loading, setLoading] = useState(true);
  const [advances, setAdvances] = useState<AdvancePayment[]>([]);
  const [filteredAdvances, setFilteredAdvances] = useState<AdvancePayment[]>([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [typeFilter, setTypeFilter] = useState<'all' | 'customer' | 'vendor'>('all');
  const [page, setPage] = useState(0);
  const [rowsPerPage, setRowsPerPage] = useState(25);
  const [error, setError] = useState<string | null>(null);

  // Edit dialogs
  const [editingCustomerPayment, setEditingCustomerPayment] = useState<CustomerPayment | null>(
    null
  );
  const [editingVendorPayment, setEditingVendorPayment] = useState<VendorPayment | null>(null);
  const [customerDialogOpen, setCustomerDialogOpen] = useState(false);
  const [vendorDialogOpen, setVendorDialogOpen] = useState(false);

  const fetchAdvances = async () => {
    setLoading(true);
    setError(null);
    try {
      const { db } = getFirebase();
      const transactionsRef = collection(db, COLLECTIONS.TRANSACTIONS);

      const [customerSnap, vendorSnap] = await Promise.all([
        getDocs(query(transactionsRef, where('type', '==', 'CUSTOMER_PAYMENT'))),
        getDocs(query(transactionsRef, where('type', '==', 'VENDOR_PAYMENT'))),
      ]);

      const result: AdvancePayment[] = [];

      customerSnap.forEach((doc) => {
        const data = doc.data() as CustomerPayment;
        if (data.isDeleted) return;
        if (data.isAdvance === true) {
          result.push({ ...data, id: doc.id, paymentType: 'customer' });
        }
      });

      vendorSnap.forEach((doc) => {
        const data = doc.data() as VendorPayment;
        if (data.isDeleted) return;
        if (data.isAdvance === true) {
          result.push({ ...data, id: doc.id, paymentType: 'vendor' });
        }
      });

      // Sort by date descending
      result.sort((a, b) => {
        const rawA = a.paymentDate as unknown as { toDate?: () => Date } | string;
        const rawB = b.paymentDate as unknown as { toDate?: () => Date } | string;
        const dateA =
          typeof rawA === 'object' && rawA?.toDate ? rawA.toDate() : new Date(rawA as string);
        const dateB =
          typeof rawB === 'object' && rawB?.toDate ? rawB.toDate() : new Date(rawB as string);
        return dateB.getTime() - dateA.getTime();
      });

      setAdvances(result);
      setFilteredAdvances(result);
    } catch (err) {
      console.error('Error fetching advances:', err);
      setError(err instanceof Error ? err.message : 'Failed to fetch advances. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchAdvances();
  }, []);

  useEffect(() => {
    let filtered = advances;

    if (typeFilter !== 'all') {
      filtered = filtered.filter((p) => p.paymentType === typeFilter);
    }

    if (searchTerm) {
      const term = searchTerm.toLowerCase();
      filtered = filtered.filter(
        (p) =>
          p.entityName?.toLowerCase().includes(term) ||
          p.transactionNumber?.toLowerCase().includes(term) ||
          p.reference?.toLowerCase().includes(term)
      );
    }

    setFilteredAdvances(filtered);
    setPage(0);
  }, [advances, searchTerm, typeFilter]);

  const formatDate = (date: unknown): string => {
    if (!date) return '-';
    const d =
      typeof date === 'object' && 'toDate' in (date as object)
        ? (date as { toDate: () => Date }).toDate()
        : new Date(date as string);
    return d.toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' });
  };

  const handleClearFilters = () => {
    setSearchTerm('');
    setTypeFilter('all');
  };

  const handleApplyAdvance = (advance: AdvancePayment) => {
    if (advance.paymentType === 'customer') {
      setEditingCustomerPayment(advance as CustomerPayment);
      setCustomerDialogOpen(true);
    } else {
      setEditingVendorPayment(advance as VendorPayment);
      setVendorDialogOpen(true);
    }
  };

  const handleDialogClose = () => {
    setCustomerDialogOpen(false);
    setVendorDialogOpen(false);
    setEditingCustomerPayment(null);
    setEditingVendorPayment(null);
    fetchAdvances();
  };

  const totalAmount = filteredAdvances.reduce(
    (sum, p) => sum + (p.totalAmount || p.amount || 0),
    0
  );
  const customerCount = filteredAdvances.filter((p) => p.paymentType === 'customer').length;
  const vendorCount = filteredAdvances.filter((p) => p.paymentType === 'vendor').length;

  if (loading) {
    return <LoadingState variant="page" message="Loading advances..." />;
  }

  return (
    <Box sx={{ py: 4 }}>
      <PageBreadcrumbs
        items={[
          { label: 'Accounting', href: '/accounting', icon: <HomeIcon fontSize="small" /> },
          { label: 'Data Health', href: '/accounting/data-health' },
          { label: 'Advances' },
        ]}
      />

      <PageHeader
        title="Advances"
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

      {error && (
        <Alert severity="error" sx={{ mb: 3 }} onClose={() => setError(null)}>
          {error}
        </Alert>
      )}

      <Alert severity="info" sx={{ mb: 3 }} icon={<AdvanceIcon />}>
        These are advance receipts and payments recorded before a corresponding invoice or bill
        exists. They do not affect the Data Health score. Click <strong>Apply</strong> to allocate
        an advance once the invoice or bill is available.
      </Alert>

      {/* Summary Cards */}
      <Box sx={{ display: 'flex', gap: 2, mb: 3, flexWrap: 'wrap' }}>
        <StatCard
          label="Total Advances"
          value={filteredAdvances.length.toString()}
          icon={<TotalIcon />}
          color="primary"
        />
        <StatCard
          label="Customer Advances"
          value={customerCount.toString()}
          icon={<ReceiptIcon />}
          color="success"
        />
        <StatCard
          label="Vendor Advances"
          value={vendorCount.toString()}
          icon={<PaymentIcon />}
          color="error"
        />
        <StatCard
          label="Total Amount"
          value={formatCurrency(totalAmount, 'INR')}
          icon={<MoneyIcon />}
          color="info"
        />
      </Box>

      {/* Filters */}
      <FilterBar onClear={handleClearFilters}>
        <TextField
          placeholder="Search by entity, number, or reference..."
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
            <MenuItem value="customer">Customer Advances</MenuItem>
            <MenuItem value="vendor">Vendor Advances</MenuItem>
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
              <TableCell>Method</TableCell>
              <TableCell align="right">Amount</TableCell>
              <TableCell>Reference</TableCell>
              <TableCell align="center">Action</TableCell>
            </TableRow>
          </TableHead>
          <TableBody>
            {filteredAdvances.length === 0 ? (
              <EmptyState message="No advance payments recorded." variant="table" colSpan={8} />
            ) : (
              filteredAdvances
                .slice(page * rowsPerPage, page * rowsPerPage + rowsPerPage)
                .map((advance) => (
                  <TableRow key={advance.id} hover>
                    <TableCell>
                      <Chip
                        label={advance.paymentType === 'customer' ? 'Customer' : 'Vendor'}
                        size="small"
                        color={advance.paymentType === 'customer' ? 'success' : 'error'}
                        variant="outlined"
                      />
                    </TableCell>
                    <TableCell>
                      <Typography variant="body2" fontWeight="medium">
                        {advance.transactionNumber}
                      </Typography>
                    </TableCell>
                    <TableCell>{formatDate(advance.paymentDate)}</TableCell>
                    <TableCell>{advance.entityName}</TableCell>
                    <TableCell>
                      <Typography variant="body2" sx={{ textTransform: 'capitalize' }}>
                        {advance.paymentMethod?.replace('_', ' ').toLowerCase()}
                      </Typography>
                    </TableCell>
                    <TableCell align="right">
                      <Typography
                        fontWeight="medium"
                        color={advance.paymentType === 'customer' ? 'success.main' : 'error.main'}
                      >
                        {formatCurrency(advance.totalAmount || advance.amount || 0, 'INR')}
                      </Typography>
                    </TableCell>
                    <TableCell>
                      <Typography variant="body2" color="text.secondary">
                        {advance.reference || '-'}
                      </Typography>
                    </TableCell>
                    <TableCell align="center">
                      <Tooltip title="Apply to Invoice/Bill">
                        <Button
                          variant="outlined"
                          size="small"
                          startIcon={<EditIcon />}
                          onClick={() => handleApplyAdvance(advance)}
                        >
                          Apply
                        </Button>
                      </Tooltip>
                    </TableCell>
                  </TableRow>
                ))
            )}
          </TableBody>
        </Table>
        <TablePagination
          component="div"
          count={filteredAdvances.length}
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

      {/* Edit Dialogs */}
      <RecordCustomerPaymentDialog
        open={customerDialogOpen}
        onClose={handleDialogClose}
        editingPayment={editingCustomerPayment}
      />
      <RecordVendorPaymentDialog
        open={vendorDialogOpen}
        onClose={handleDialogClose}
        editingPayment={editingVendorPayment}
      />
    </Box>
  );
}
