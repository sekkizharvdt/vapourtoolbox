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
  Tooltip,
  Alert,
  TextField,
  InputAdornment,
  FormControl,
  InputLabel,
  Select,
  MenuItem,
  Breadcrumbs,
  Link,
} from '@mui/material';
import {
  Edit as EditIcon,
  Search as SearchIcon,
  ArrowBack as BackIcon,
  Home as HomeIcon,
} from '@mui/icons-material';
import { useRouter } from 'next/navigation';
import { PageHeader, LoadingState } from '@vapour/ui';
import { useAuth } from '@/contexts/AuthContext';
import { getFirebase } from '@/lib/firebase';
import { collection, query, where, getDocs } from 'firebase/firestore';
import { COLLECTIONS } from '@vapour/firebase';
import type { CustomerPayment, VendorPayment } from '@vapour/types';
import { RecordCustomerPaymentDialog } from '../../payments/components/RecordCustomerPaymentDialog';
import { RecordVendorPaymentDialog } from '../../payments/components/RecordVendorPaymentDialog';

type UnappliedPayment = (CustomerPayment | VendorPayment) & {
  id: string;
  paymentType: 'customer' | 'vendor';
};

export default function UnappliedPaymentsPage() {
  const router = useRouter();
  useAuth();
  const [loading, setLoading] = useState(true);
  const [payments, setPayments] = useState<UnappliedPayment[]>([]);
  const [filteredPayments, setFilteredPayments] = useState<UnappliedPayment[]>([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [typeFilter, setTypeFilter] = useState<'all' | 'customer' | 'vendor'>('all');
  const [page, setPage] = useState(0);
  const [rowsPerPage, setRowsPerPage] = useState(25);

  // Edit dialogs
  const [editingCustomerPayment, setEditingCustomerPayment] = useState<CustomerPayment | null>(
    null
  );
  const [editingVendorPayment, setEditingVendorPayment] = useState<VendorPayment | null>(null);
  const [customerDialogOpen, setCustomerDialogOpen] = useState(false);
  const [vendorDialogOpen, setVendorDialogOpen] = useState(false);

  const fetchUnappliedPayments = async () => {
    setLoading(true);
    try {
      const { db } = getFirebase();
      const transactionsRef = collection(db, COLLECTIONS.TRANSACTIONS);

      const [customerSnap, vendorSnap] = await Promise.all([
        getDocs(query(transactionsRef, where('type', '==', 'CUSTOMER_PAYMENT'))),
        getDocs(query(transactionsRef, where('type', '==', 'VENDOR_PAYMENT'))),
      ]);

      const unapplied: UnappliedPayment[] = [];

      customerSnap.forEach((doc) => {
        const data = doc.data() as CustomerPayment;
        const allocations = data.invoiceAllocations || [];
        const totalAllocated = allocations.reduce((sum, a) => sum + (a.allocatedAmount || 0), 0);
        if (totalAllocated === 0) {
          unapplied.push({
            ...data,
            id: doc.id,
            paymentType: 'customer',
          });
        }
      });

      vendorSnap.forEach((doc) => {
        const data = doc.data() as VendorPayment;
        const allocations = data.billAllocations || [];
        const totalAllocated = allocations.reduce((sum, a) => sum + (a.allocatedAmount || 0), 0);
        if (totalAllocated === 0) {
          unapplied.push({
            ...data,
            id: doc.id,
            paymentType: 'vendor',
          });
        }
      });

      // Sort by date descending
      unapplied.sort((a, b) => {
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

      setPayments(unapplied);
      setFilteredPayments(unapplied);
    } catch (err) {
      console.error('Error fetching unapplied payments:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchUnappliedPayments();
  }, []);

  useEffect(() => {
    let filtered = payments;

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

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('en-IN', {
      style: 'currency',
      currency: 'INR',
      maximumFractionDigits: 2,
    }).format(amount);
  };

  const handleEditPayment = (payment: UnappliedPayment) => {
    if (payment.paymentType === 'customer') {
      setEditingCustomerPayment(payment as CustomerPayment);
      setCustomerDialogOpen(true);
    } else {
      setEditingVendorPayment(payment as VendorPayment);
      setVendorDialogOpen(true);
    }
  };

  const handleDialogClose = () => {
    setCustomerDialogOpen(false);
    setVendorDialogOpen(false);
    setEditingCustomerPayment(null);
    setEditingVendorPayment(null);
    // Refresh the list
    fetchUnappliedPayments();
  };

  const totalAmount = filteredPayments.reduce(
    (sum, p) => sum + (p.totalAmount || p.amount || 0),
    0
  );

  const customerCount = filteredPayments.filter((p) => p.paymentType === 'customer').length;
  const vendorCount = filteredPayments.filter((p) => p.paymentType === 'vendor').length;

  if (loading) {
    return <LoadingState message="Loading unapplied payments..." />;
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
        <Typography color="text.primary">Unapplied Payments</Typography>
      </Breadcrumbs>

      <PageHeader
        title="Unapplied Payments"
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
        These payments have been recorded but not applied to any invoice or bill. Click
        &quot;Apply&quot; to allocate the payment to outstanding invoices/bills.
      </Alert>

      {/* Summary Cards */}
      <Box sx={{ display: 'flex', gap: 2, mb: 3, flexWrap: 'wrap' }}>
        <Card sx={{ minWidth: 150 }}>
          <CardContent sx={{ py: 1.5 }}>
            <Typography variant="body2" color="text.secondary">
              Total Unapplied
            </Typography>
            <Typography variant="h5" fontWeight="bold">
              {filteredPayments.length}
            </Typography>
          </CardContent>
        </Card>
        <Card sx={{ minWidth: 150 }}>
          <CardContent sx={{ py: 1.5 }}>
            <Typography variant="body2" color="text.secondary">
              Customer Receipts
            </Typography>
            <Typography variant="h5" fontWeight="bold" color="success.main">
              {customerCount}
            </Typography>
          </CardContent>
        </Card>
        <Card sx={{ minWidth: 150 }}>
          <CardContent sx={{ py: 1.5 }}>
            <Typography variant="body2" color="text.secondary">
              Vendor Payments
            </Typography>
            <Typography variant="h5" fontWeight="bold" color="error.main">
              {vendorCount}
            </Typography>
          </CardContent>
        </Card>
        <Card sx={{ minWidth: 200 }}>
          <CardContent sx={{ py: 1.5 }}>
            <Typography variant="body2" color="text.secondary">
              Total Amount
            </Typography>
            <Typography variant="h5" fontWeight="bold">
              {formatCurrency(totalAmount)}
            </Typography>
          </CardContent>
        </Card>
      </Box>

      {/* Filters */}
      <Card sx={{ mb: 3 }}>
        <CardContent sx={{ py: 2 }}>
          <Box sx={{ display: 'flex', gap: 2, flexWrap: 'wrap' }}>
            <TextField
              placeholder="Search by entity, number, or reference..."
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
                onChange={(e) => setTypeFilter(e.target.value as 'all' | 'customer' | 'vendor')}
              >
                <MenuItem value="all">All Types</MenuItem>
                <MenuItem value="customer">Customer Receipts</MenuItem>
                <MenuItem value="vendor">Vendor Payments</MenuItem>
              </Select>
            </FormControl>
          </Box>
        </CardContent>
      </Card>

      {filteredPayments.length === 0 ? (
        <Box sx={{ textAlign: 'center', py: 4 }}>
          <Typography variant="h6">No Unapplied Payments</Typography>
          <Typography color="text.secondary">
            All payments have been applied to invoices or bills.
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
                  <TableCell>Method</TableCell>
                  <TableCell align="right">Amount</TableCell>
                  <TableCell>Reference</TableCell>
                  <TableCell align="center">Action</TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {filteredPayments
                  .slice(page * rowsPerPage, page * rowsPerPage + rowsPerPage)
                  .map((payment) => (
                    <TableRow key={payment.id} hover>
                      <TableCell>
                        <Chip
                          label={payment.paymentType === 'customer' ? 'Receipt' : 'Payment'}
                          size="small"
                          color={payment.paymentType === 'customer' ? 'success' : 'error'}
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
                      <TableCell>
                        <Typography variant="body2" sx={{ textTransform: 'capitalize' }}>
                          {payment.paymentMethod?.replace('_', ' ').toLowerCase()}
                        </Typography>
                      </TableCell>
                      <TableCell align="right">
                        <Typography
                          fontWeight="medium"
                          color={payment.paymentType === 'customer' ? 'success.main' : 'error.main'}
                        >
                          {formatCurrency(payment.totalAmount || payment.amount || 0)}
                        </Typography>
                      </TableCell>
                      <TableCell>
                        <Typography variant="body2" color="text.secondary">
                          {payment.reference || '-'}
                        </Typography>
                      </TableCell>
                      <TableCell align="center">
                        <Tooltip title="Apply to Invoice/Bill">
                          <Button
                            variant="contained"
                            size="small"
                            startIcon={<EditIcon />}
                            onClick={() => handleEditPayment(payment)}
                          >
                            Apply
                          </Button>
                        </Tooltip>
                      </TableCell>
                    </TableRow>
                  ))}
              </TableBody>
            </Table>
          </TableContainer>
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
        </Card>
      )}

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
    </>
  );
}
