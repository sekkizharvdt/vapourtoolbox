'use client';

import { useState, useEffect } from 'react';
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
} from '@mui/material';
import {
  Visibility as ViewIcon,
  Edit as EditIcon,
  Delete as DeleteIcon,
  Receipt as ReceiptIcon,
  Payment as PaymentIcon,
} from '@mui/icons-material';
import { useAuth } from '@/contexts/AuthContext';
import { getFirebase } from '@/lib/firebase';
import { collection, query, orderBy, onSnapshot, doc, deleteDoc } from 'firebase/firestore';
import { COLLECTIONS } from '@vapour/firebase';
import { hasPermission, PERMISSION_FLAGS } from '@vapour/constants';
import type { CustomerPayment, VendorPayment } from '@vapour/types';
import { formatCurrency } from '@/lib/accounting/transactionHelpers';
import { RecordCustomerPaymentDialog } from './components/RecordCustomerPaymentDialog';
import { RecordVendorPaymentDialog } from './components/RecordVendorPaymentDialog';

type PaymentType = 'all' | 'customer' | 'vendor';
type Payment = CustomerPayment | VendorPayment;

export default function PaymentsPage() {
  const { claims } = useAuth();
  const [payments, setPayments] = useState<Payment[]>([]);
  const [loading, setLoading] = useState(true);
  const [paymentType, setPaymentType] = useState<PaymentType>('all');
  const [customerPaymentDialogOpen, setCustomerPaymentDialogOpen] = useState(false);
  const [vendorPaymentDialogOpen, setVendorPaymentDialogOpen] = useState(false);
  const [editingPayment, setEditingPayment] = useState<Payment | null>(null);
  const [page, setPage] = useState(0);
  const [rowsPerPage, setRowsPerPage] = useState(50);

  const canManage = hasPermission(claims?.permissions || 0, PERMISSION_FLAGS.MANAGE_ACCOUNTING);

  // Real-time listener for payments
  useEffect(() => {
    const { db } = getFirebase();
    const transactionsRef = collection(db, COLLECTIONS.TRANSACTIONS);
    const q = query(transactionsRef, orderBy('paymentDate', 'desc'));

    const unsubscribe = onSnapshot(q, (snapshot) => {
      const paymentsData: Payment[] = [];
      snapshot.forEach((doc) => {
        const data = doc.data();
        if (data.type === 'CUSTOMER_PAYMENT' || data.type === 'VENDOR_PAYMENT') {
          paymentsData.push({ id: doc.id, ...data } as Payment);
        }
      });
      setPayments(paymentsData);
      setLoading(false);
    });

    return () => unsubscribe();
  }, []);

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

  // Filter payments by type
  const filteredPayments = payments.filter((payment) => {
    if (paymentType === 'all') return true;
    if (paymentType === 'customer') return payment.type === 'CUSTOMER_PAYMENT';
    if (paymentType === 'vendor') return payment.type === 'VENDOR_PAYMENT';
    return true;
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

      {/* Filter Toggle */}
      <Box sx={{ mb: 2 }}>
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
      </Box>

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
                    No payments found. Click &quot;Customer Receipt&quot; or &quot;Vendor
                    Payment&quot; to record a payment.
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
                  <TableCell>{new Date(payment.paymentDate).toLocaleDateString()}</TableCell>
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
