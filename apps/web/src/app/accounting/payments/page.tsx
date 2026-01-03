'use client';

import { useState, useMemo } from 'react';
import dynamic from 'next/dynamic';
import {
  Box,
  Button,
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
  ToggleButtonGroup,
  ToggleButton,
  TablePagination,
  FormControl,
  InputLabel,
  Select,
  MenuItem,
  Breadcrumbs,
  Link,
} from '@mui/material';
import {
  Visibility as ViewIcon,
  Edit as EditIcon,
  Delete as DeleteIcon,
  Receipt as ReceiptIcon,
  Payment as PaymentIcon,
  Home as HomeIcon,
} from '@mui/icons-material';
import { useAuth } from '@/contexts/AuthContext';
import { getFirebase } from '@/lib/firebase';
import { collection, query, where, orderBy, doc, deleteDoc } from 'firebase/firestore';
import { COLLECTIONS } from '@vapour/firebase';
import { hasPermission, PERMISSION_FLAGS } from '@vapour/constants';
import type { CustomerPayment, VendorPayment } from '@vapour/types';
import { formatCurrency } from '@/lib/accounting/transactionHelpers';
import { useFirestoreQuery } from '@/hooks/useFirestoreQuery';
import { formatDate } from '@/lib/utils/formatters';
import { useRouter } from 'next/navigation';

// Lazy load heavy dialog components
const RecordCustomerPaymentDialog = dynamic(
  () =>
    import('./components/RecordCustomerPaymentDialog').then(
      (mod) => mod.RecordCustomerPaymentDialog
    ),
  { ssr: false }
);
const RecordVendorPaymentDialog = dynamic(
  () =>
    import('./components/RecordVendorPaymentDialog').then((mod) => mod.RecordVendorPaymentDialog),
  { ssr: false }
);

type PaymentType = 'all' | 'customer' | 'vendor';
type Payment = CustomerPayment | VendorPayment;

/** Generate month options for the last 12 months */
function getMonthOptions() {
  const options: Array<{ value: string; label: string }> = [];
  const now = new Date();

  for (let i = 0; i < 12; i++) {
    const date = new Date(now.getFullYear(), now.getMonth() - i, 1);
    const value = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;
    const label = date.toLocaleDateString('en-US', { year: 'numeric', month: 'long' });
    options.push({ value, label });
  }

  return options;
}

export default function PaymentsPage() {
  const router = useRouter();
  const { claims } = useAuth();
  const [paymentType, setPaymentType] = useState<PaymentType>('all');
  const [customerPaymentDialogOpen, setCustomerPaymentDialogOpen] = useState(false);
  const [vendorPaymentDialogOpen, setVendorPaymentDialogOpen] = useState(false);
  const [editingPayment, setEditingPayment] = useState<Payment | null>(null);
  const [page, setPage] = useState(0);
  const [rowsPerPage, setRowsPerPage] = useState(50);
  const [filterMonth, setFilterMonth] = useState<string>('ALL');
  const monthOptions = useMemo(() => getMonthOptions(), []);

  const canManage = hasPermission(claims?.permissions || 0, PERMISSION_FLAGS.MANAGE_ACCOUNTING);

  // Firestore query using custom hook
  const { db } = getFirebase();
  const paymentsQuery = useMemo(
    () =>
      query(
        collection(db, COLLECTIONS.TRANSACTIONS),
        where('type', 'in', ['CUSTOMER_PAYMENT', 'VENDOR_PAYMENT']),
        orderBy('paymentDate', 'desc')
      ),
    [db]
  );

  const { data: payments, loading } = useFirestoreQuery<Payment>(paymentsQuery);

  const handleCreateCustomerPayment = () => {
    setEditingPayment(null);
    setCustomerPaymentDialogOpen(true);
  };

  const handleCreateVendorPayment = () => {
    setEditingPayment(null);
    setVendorPaymentDialogOpen(true);
  };

  const handleEdit = (payment: Payment) => {
    setEditingPayment(payment);
    if (payment.type === 'CUSTOMER_PAYMENT') {
      setCustomerPaymentDialogOpen(true);
    } else {
      setVendorPaymentDialogOpen(true);
    }
  };

  const handleDelete = async (paymentId: string) => {
    if (!confirm('Are you sure you want to delete this payment?')) return;

    try {
      const { db } = getFirebase();
      await deleteDoc(doc(db, COLLECTIONS.TRANSACTIONS, paymentId));
    } catch (error) {
      console.error('[PaymentsPage] Error deleting payment:', error);
      alert('Failed to delete payment');
    }
  };

  const handleCustomerPaymentDialogClose = () => {
    setCustomerPaymentDialogOpen(false);
    setEditingPayment(null);
  };

  const handleVendorPaymentDialogClose = () => {
    setVendorPaymentDialogOpen(false);
    setEditingPayment(null);
  };

  // Filter payments by type and month
  const filteredPayments = payments.filter((payment) => {
    // Filter by type
    let matchesType = true;
    if (paymentType === 'customer') matchesType = payment.type === 'CUSTOMER_PAYMENT';
    else if (paymentType === 'vendor') matchesType = payment.type === 'VENDOR_PAYMENT';

    // Filter by month
    let matchesMonth = true;
    if (filterMonth !== 'ALL' && payment.paymentDate) {
      const paymentDate =
        typeof (payment.paymentDate as unknown as { toDate?: () => Date }).toDate === 'function'
          ? (payment.paymentDate as unknown as { toDate: () => Date }).toDate()
          : new Date(payment.paymentDate as unknown as string | number);
      const paymentYearMonth = `${paymentDate.getFullYear()}-${String(paymentDate.getMonth() + 1).padStart(2, '0')}`;
      matchesMonth = paymentYearMonth === filterMonth;
    }

    return matchesType && matchesMonth;
  });

  const handleChangePage = (_event: unknown, newPage: number) => {
    setPage(newPage);
  };

  const handleChangeRowsPerPage = (event: React.ChangeEvent<HTMLInputElement>) => {
    setRowsPerPage(parseInt(event.target.value, 10));
    setPage(0);
  };

  // Paginate filtered payments
  const paginatedPayments = filteredPayments.slice(
    page * rowsPerPage,
    page * rowsPerPage + rowsPerPage
  );

  if (loading) {
    return (
      <Box sx={{ p: 3 }}>
        <Typography>Loading payments...</Typography>
      </Box>
    );
  }

  return (
    <Box sx={{ p: 3 }}>
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
        <Typography color="text.primary">Payments</Typography>
      </Breadcrumbs>

      <Stack direction="row" justifyContent="space-between" alignItems="center" sx={{ mb: 3 }}>
        <Typography variant="h4">Payments</Typography>
        {canManage && (
          <Stack direction="row" spacing={2}>
            <Button
              variant="contained"
              startIcon={<ReceiptIcon />}
              onClick={handleCreateCustomerPayment}
              color="success"
            >
              Customer Receipt
            </Button>
            <Button
              variant="contained"
              startIcon={<PaymentIcon />}
              onClick={handleCreateVendorPayment}
              color="primary"
            >
              Vendor Payment
            </Button>
          </Stack>
        )}
      </Stack>

      {/* Filters */}
      <Stack direction="row" spacing={2} sx={{ mb: 2 }} alignItems="center" flexWrap="wrap">
        <ToggleButtonGroup
          value={paymentType}
          exclusive
          onChange={(_, newValue) => newValue && setPaymentType(newValue)}
          size="small"
        >
          <ToggleButton value="all">All Payments</ToggleButton>
          <ToggleButton value="customer">Customer Receipts</ToggleButton>
          <ToggleButton value="vendor">Vendor Payments</ToggleButton>
        </ToggleButtonGroup>

        <FormControl size="small" sx={{ minWidth: 180 }}>
          <InputLabel>Month</InputLabel>
          <Select
            value={filterMonth}
            label="Month"
            onChange={(e) => {
              setFilterMonth(e.target.value);
              setPage(0);
            }}
          >
            <MenuItem value="ALL">All Months</MenuItem>
            {monthOptions.map((option) => (
              <MenuItem key={option.value} value={option.value}>
                {option.label}
              </MenuItem>
            ))}
          </Select>
        </FormControl>

        {filterMonth !== 'ALL' && (
          <Button size="small" onClick={() => setFilterMonth('ALL')}>
            Clear Filter
          </Button>
        )}
      </Stack>

      <TableContainer component={Paper}>
        <Table>
          <TableHead>
            <TableRow>
              <TableCell>Type</TableCell>
              <TableCell>Date</TableCell>
              <TableCell>Payment Number</TableCell>
              <TableCell>Entity</TableCell>
              <TableCell>Payment Method</TableCell>
              <TableCell align="right">Amount</TableCell>
              <TableCell>Reference</TableCell>
              <TableCell>Status</TableCell>
              <TableCell align="right">Actions</TableCell>
            </TableRow>
          </TableHead>
          <TableBody>
            {filteredPayments.length === 0 ? (
              <TableRow>
                <TableCell colSpan={9} align="center">
                  <Typography variant="body2" color="text.secondary" sx={{ py: 4 }}>
                    {filterMonth !== 'ALL' || paymentType !== 'all'
                      ? 'No payments found matching your filters.'
                      : 'No payments found. Click "Customer Receipt" or "Vendor Payment" to record a payment.'}
                  </Typography>
                </TableCell>
              </TableRow>
            ) : (
              paginatedPayments.map((payment) => (
                <TableRow key={payment.id} hover>
                  <TableCell>
                    <Chip
                      icon={payment.type === 'CUSTOMER_PAYMENT' ? <ReceiptIcon /> : <PaymentIcon />}
                      label={payment.type === 'CUSTOMER_PAYMENT' ? 'Receipt' : 'Payment'}
                      size="small"
                      color={payment.type === 'CUSTOMER_PAYMENT' ? 'success' : 'primary'}
                    />
                  </TableCell>
                  <TableCell>{formatDate(payment.paymentDate)}</TableCell>
                  <TableCell>{payment.transactionNumber}</TableCell>
                  <TableCell>{payment.entityName || '-'}</TableCell>
                  <TableCell>{payment.paymentMethod}</TableCell>
                  <TableCell align="right">{formatCurrency(payment.totalAmount || 0)}</TableCell>
                  <TableCell>
                    {payment.paymentMethod === 'CHEQUE' && payment.chequeNumber
                      ? `Cheque #${payment.chequeNumber}`
                      : payment.paymentMethod === 'UPI' && payment.upiTransactionId
                        ? `UPI: ${payment.upiTransactionId}`
                        : payment.reference || '-'}
                  </TableCell>
                  <TableCell>
                    <Chip
                      label={payment.status}
                      size="small"
                      color={
                        payment.status === 'POSTED'
                          ? 'success'
                          : payment.status === 'APPROVED'
                            ? 'info'
                            : payment.status === 'DRAFT'
                              ? 'default'
                              : 'warning'
                      }
                    />
                  </TableCell>
                  <TableCell align="right">
                    <Tooltip title="View">
                      <IconButton size="small" onClick={() => handleEdit(payment)}>
                        <ViewIcon fontSize="small" />
                      </IconButton>
                    </Tooltip>
                    {canManage && (
                      <>
                        <Tooltip title="Edit">
                          <IconButton size="small" onClick={() => handleEdit(payment)}>
                            <EditIcon fontSize="small" />
                          </IconButton>
                        </Tooltip>
                        <Tooltip title="Delete">
                          <IconButton
                            size="small"
                            onClick={() => handleDelete(payment.id!)}
                            color="error"
                          >
                            <DeleteIcon fontSize="small" />
                          </IconButton>
                        </Tooltip>
                      </>
                    )}
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
        <TablePagination
          rowsPerPageOptions={[25, 50, 100]}
          component="div"
          count={filteredPayments.length}
          rowsPerPage={rowsPerPage}
          page={page}
          onPageChange={handleChangePage}
          onRowsPerPageChange={handleChangeRowsPerPage}
        />
      </TableContainer>

      <RecordCustomerPaymentDialog
        open={customerPaymentDialogOpen}
        onClose={handleCustomerPaymentDialogClose}
        editingPayment={
          editingPayment?.type === 'CUSTOMER_PAYMENT' ? (editingPayment as CustomerPayment) : null
        }
      />

      <RecordVendorPaymentDialog
        open={vendorPaymentDialogOpen}
        onClose={handleVendorPaymentDialogClose}
        editingPayment={
          editingPayment?.type === 'VENDOR_PAYMENT' ? (editingPayment as VendorPayment) : null
        }
      />
    </Box>
  );
}
