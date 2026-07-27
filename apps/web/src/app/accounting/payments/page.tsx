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
  Tabs,
  Tab,
  TablePagination,
  FormControl,
  InputLabel,
  Select,
  MenuItem,
  TextField,
  InputAdornment,
} from '@mui/material';
import { PageBreadcrumbs } from '@/components/common/PageBreadcrumbs';
import {
  Visibility as ViewIcon,
  Edit as EditIcon,
  Delete as DeleteIcon,
  Receipt as ReceiptIcon,
  Payment as PaymentIcon,
  Home as HomeIcon,
  AccountBalance as DirectPaymentIcon,
  SwapHoriz as BankTransferIcon,
  RequestQuote as ExpenseClaimIcon,
  Search as SearchIcon,
  FileDownload as DownloadIcon,
} from '@mui/icons-material';
import { useAuth } from '@/contexts/AuthContext';
import { getFirebase } from '@/lib/firebase';
import { collection, query, where, orderBy } from 'firebase/firestore';
import { COLLECTIONS } from '@vapour/firebase';
import { hasPermission, PERMISSION_FLAGS } from '@vapour/constants';
import type { CustomerPayment, VendorPayment, PaymentMethod } from '@vapour/types';
import { formatCurrency } from '@/lib/accounting/transactionHelpers';
import { useFirestoreQuery } from '@/hooks/useFirestoreQuery';
import { formatDate } from '@/lib/utils/formatters';
import {
  FiscalYearFilter,
  useFiscalYearFilter,
  matchesFiscalYear,
} from '@/components/accounting/FiscalYearFilter';
import {
  downloadReportCSV,
  downloadReportExcel,
  type ExportSection,
} from '@/lib/accounting/reports/exportReport';

import { useConfirmDialog } from '@/components/common/ConfirmDialog';
import { useToast } from '@/components/common/Toast';
import { softDeleteTransaction } from '@/lib/accounting/transactionDeleteService';

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
const RecordDirectPaymentDialog = dynamic(
  () =>
    import('./components/RecordDirectPaymentDialog').then((mod) => mod.RecordDirectPaymentDialog),
  { ssr: false }
);
const RecordDirectReceiptDialog = dynamic(
  () =>
    import('./components/RecordDirectReceiptDialog').then((mod) => mod.RecordDirectReceiptDialog),
  { ssr: false }
);
const CreateBankTransferDialog = dynamic(
  () => import('./components/CreateBankTransferDialog').then((mod) => mod.CreateBankTransferDialog),
  { ssr: false }
);
const CreateExpenseClaimDialog = dynamic(
  () => import('./components/CreateExpenseClaimDialog').then((mod) => mod.CreateExpenseClaimDialog),
  { ssr: false }
);

type Payment = CustomerPayment | VendorPayment;

// Receipts (money in) vs Payments (money out) split — feedback lk1VnORTsUwATbsPuDRX.
// Bank transfers are neither, so they get their own tab.
type PaymentsTab = 'all' | 'receipts' | 'payments' | 'transfers';
const RECEIPT_TYPES = new Set(['CUSTOMER_PAYMENT', 'DIRECT_RECEIPT']);
const PAYMENT_TYPES = new Set(['VENDOR_PAYMENT', 'DIRECT_PAYMENT', 'EXPENSE_CLAIM']);
const TRANSFER_TYPES = new Set(['BANK_TRANSFER']);

const TYPE_CHIP: Record<
  string,
  { label: string; color: 'success' | 'primary' | 'secondary' | 'warning' | 'info' }
> = {
  CUSTOMER_PAYMENT: { label: 'Receipt', color: 'success' },
  DIRECT_RECEIPT: { label: 'Direct Rcpt', color: 'success' },
  VENDOR_PAYMENT: { label: 'Payment', color: 'primary' },
  DIRECT_PAYMENT: { label: 'Direct Pmt', color: 'secondary' },
  EXPENSE_CLAIM: { label: 'Expense Claim', color: 'warning' },
  BANK_TRANSFER: { label: 'Bank Transfer', color: 'info' },
};

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
  const { claims, user } = useAuth();
  const { confirm } = useConfirmDialog();
  const { toast } = useToast();
  const [tab, setTab] = useState<PaymentsTab>('all');
  const [customerPaymentDialogOpen, setCustomerPaymentDialogOpen] = useState(false);
  const [vendorPaymentDialogOpen, setVendorPaymentDialogOpen] = useState(false);
  const [directPaymentDialogOpen, setDirectPaymentDialogOpen] = useState(false);
  const [directReceiptDialogOpen, setDirectReceiptDialogOpen] = useState(false);
  const [bankTransferDialogOpen, setBankTransferDialogOpen] = useState(false);
  const [expenseClaimDialogOpen, setExpenseClaimDialogOpen] = useState(false);
  const [editingPayment, setEditingPayment] = useState<Payment | null>(null);
  const [page, setPage] = useState(0);
  const [rowsPerPage, setRowsPerPage] = useState(50);
  const [filterMonth, setFilterMonth] = useState<string>('ALL');
  const [searchTerm, setSearchTerm] = useState('');
  const fy = useFiscalYearFilter();
  const monthOptions = useMemo(() => getMonthOptions(), []);

  const canManage = hasPermission(claims?.permissions || 0, PERMISSION_FLAGS.MANAGE_ACCOUNTING);

  // Firestore query using custom hook
  const { db } = getFirebase();
  const paymentsQuery = useMemo(
    () =>
      query(
        collection(db, COLLECTIONS.TRANSACTIONS),
        where('type', 'in', [
          'CUSTOMER_PAYMENT',
          'VENDOR_PAYMENT',
          'DIRECT_PAYMENT',
          'DIRECT_RECEIPT',
          'BANK_TRANSFER',
          'EXPENSE_CLAIM',
        ]),
        // Ordered by `date` (universal) — bank transfers and expense claims
        // carry no paymentDate, and orderBy silently drops docs missing the
        // field, which is why they never appeared on this page.
        orderBy('date', 'desc')
      ),
    [db]
  );

  const { data: rawPayments, loading } = useFirestoreQuery<Payment>(paymentsQuery);
  const payments = useMemo(() => rawPayments.filter((p) => !p.isDeleted), [rawPayments]);

  const handleCreateCustomerPayment = () => {
    setEditingPayment(null);
    setCustomerPaymentDialogOpen(true);
  };

  const handleCreateVendorPayment = () => {
    setEditingPayment(null);
    setVendorPaymentDialogOpen(true);
  };

  const handleCreateDirectPayment = () => {
    setEditingPayment(null);
    setDirectPaymentDialogOpen(true);
  };

  const handleCreateDirectReceipt = () => {
    setEditingPayment(null);
    setDirectReceiptDialogOpen(true);
  };

  const handleCreateBankTransfer = () => {
    setEditingPayment(null);
    setBankTransferDialogOpen(true);
  };

  const handleCreateExpenseClaim = () => {
    setEditingPayment(null);
    setExpenseClaimDialogOpen(true);
  };

  const handleEdit = (payment: Payment) => {
    setEditingPayment(payment);
    const paymentType = (payment as unknown as { type: string }).type;
    if (payment.type === 'CUSTOMER_PAYMENT') {
      setCustomerPaymentDialogOpen(true);
    } else if (payment.type === 'VENDOR_PAYMENT') {
      setVendorPaymentDialogOpen(true);
    } else if (paymentType === 'DIRECT_PAYMENT') {
      setDirectPaymentDialogOpen(true);
    } else if (paymentType === 'DIRECT_RECEIPT') {
      setDirectReceiptDialogOpen(true);
    } else {
      // Bank transfers and expense claims are newly listed here but their
      // dialogs don't support editing an existing entry yet — say so instead
      // of a button that silently does nothing.
      toast.info(
        'Editing this entry type is not supported yet — void and re-create it if changes are needed.'
      );
    }
  };

  const handleDelete = async (paymentId: string) => {
    const confirmed = await confirm({
      title: 'Move to Trash',
      message:
        'This payment will be moved to the Trash. You can restore it later or permanently delete it from there.',
      confirmText: 'Move to Trash',
      confirmColor: 'error',
    });
    if (!confirmed) return;

    try {
      const result = await softDeleteTransaction(db, {
        transactionId: paymentId,
        reason: 'Moved to trash by user',
        userId: user?.uid || 'unknown',
        userName: user?.displayName || user?.email || 'Unknown',
        userPermissions: claims?.permissions || 0,
      });
      if (!result.success) {
        toast.error(result.error || 'Failed to move payment to trash');
      }
    } catch (error) {
      console.error('[PaymentsPage] Error moving payment to trash:', error);
      toast.error('Failed to move payment to trash');
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

  const handleDirectPaymentDialogClose = () => {
    setDirectPaymentDialogOpen(false);
    setEditingPayment(null);
  };

  const handleDirectReceiptDialogClose = () => {
    setDirectReceiptDialogOpen(false);
    setEditingPayment(null);
  };

  const handleBankTransferDialogClose = () => {
    setBankTransferDialogOpen(false);
  };

  const handleExpenseClaimDialogClose = () => {
    setExpenseClaimDialogOpen(false);
  };

  // Filter payments by type, month, and search term
  const filteredPayments = payments.filter((payment) => {
    // Filter by tab (inflows / outflows / transfers)
    const txnType = (payment as unknown as { type: string }).type;
    const matchesType =
      tab === 'all' ||
      (tab === 'receipts' && RECEIPT_TYPES.has(txnType)) ||
      (tab === 'payments' && PAYMENT_TYPES.has(txnType)) ||
      (tab === 'transfers' && TRANSFER_TYPES.has(txnType));

    // Resolve payment date for both FY and month filters (bank transfers and
    // expense claims have no paymentDate — fall back to the transaction date)
    const rawDate: unknown = payment.paymentDate ?? (payment as unknown as { date?: unknown }).date;
    let paymentDate: Date | null = null;
    if (rawDate) {
      paymentDate =
        typeof (rawDate as { toDate?: () => Date }).toDate === 'function'
          ? (rawDate as { toDate: () => Date }).toDate()
          : new Date(rawDate as string | number);
    }

    const matchesFY = matchesFiscalYear(paymentDate, fy.range);

    // Filter by month
    let matchesMonth = true;
    if (filterMonth !== 'ALL' && paymentDate) {
      const paymentYearMonth = `${paymentDate.getFullYear()}-${String(paymentDate.getMonth() + 1).padStart(2, '0')}`;
      matchesMonth = paymentYearMonth === filterMonth;
    }

    // Filter by search term
    const matchesSearch =
      searchTerm === '' ||
      payment.transactionNumber?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      payment.entityName?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      payment.reference?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      payment.chequeNumber?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      payment.upiTransactionId?.toLowerCase().includes(searchTerm.toLowerCase());

    return matchesType && matchesFY && matchesMonth && matchesSearch;
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

  const buildExportSections = (): ExportSection[] => {
    const columns = [
      { header: 'Type', key: 'type', width: 12 },
      { header: 'Date', key: 'date', width: 12 },
      { header: 'Payment Number', key: 'number', width: 18 },
      { header: 'Entity', key: 'entity', width: 25 },
      { header: 'Payment Method', key: 'method', width: 15 },
      {
        header: 'Amount',
        key: 'amount',
        width: 15,
        align: 'right' as const,
        format: 'currency' as const,
      },
      { header: 'Reference', key: 'reference', width: 20 },
      { header: 'Status', key: 'status', width: 12 },
    ];
    return [
      {
        title: 'Payments',
        columns,
        rows: filteredPayments.map((p) => ({
          type:
            p.type === 'CUSTOMER_PAYMENT'
              ? 'Receipt'
              : (p as unknown as { type: string }).type === 'DIRECT_PAYMENT'
                ? 'Direct Payment'
                : (p as unknown as { type: string }).type === 'DIRECT_RECEIPT'
                  ? 'Direct Receipt'
                  : 'Payment',
          date: formatDate(p.paymentDate),
          number: p.transactionNumber || '',
          entity: p.entityName || '',
          method: p.paymentMethod || '',
          amount: p.totalAmount ?? 0,
          reference:
            p.paymentMethod === 'CHEQUE' && p.chequeNumber
              ? `Cheque #${p.chequeNumber}`
              : p.paymentMethod === 'UPI' && p.upiTransactionId
                ? `UPI: ${p.upiTransactionId}`
                : p.reference || '',
          status: p.status,
        })),
        summary: {
          type: '',
          date: '',
          number: '',
          entity: 'TOTAL',
          method: '',
          amount: filteredPayments.reduce((s, p) => s + (p.totalAmount ?? 0), 0),
          reference: '',
          status: '',
        },
      },
    ];
  };

  const handleExportCSV = () =>
    downloadReportCSV(buildExportSections(), `Payments_${new Date().toISOString().slice(0, 10)}`);
  const handleExportExcel = () =>
    downloadReportExcel(
      buildExportSections(),
      `Payments_${new Date().toISOString().slice(0, 10)}`,
      'Payments'
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
      <PageBreadcrumbs
        items={[
          { label: 'Accounting', href: '/accounting', icon: <HomeIcon fontSize="small" /> },
          { label: 'Payments' },
        ]}
      />

      <Stack direction="row" justifyContent="space-between" alignItems="center" sx={{ mb: 3 }}>
        <Typography variant="h4">Payments</Typography>
        <Stack direction="row" spacing={1} alignItems="center">
          {filteredPayments.length > 0 && (
            <>
              <Tooltip title="Export CSV">
                <IconButton onClick={handleExportCSV} size="small" aria-label="Export CSV">
                  <DownloadIcon fontSize="small" />
                </IconButton>
              </Tooltip>
              <Tooltip title="Export Excel">
                <IconButton
                  onClick={handleExportExcel}
                  size="small"
                  color="primary"
                  aria-label="Export Excel"
                >
                  <DownloadIcon fontSize="small" />
                </IconButton>
              </Tooltip>
            </>
          )}
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
              <Button
                variant="outlined"
                startIcon={<DirectPaymentIcon />}
                onClick={handleCreateDirectPayment}
                color="secondary"
              >
                Direct Payment
              </Button>
              <Button
                variant="outlined"
                startIcon={<ReceiptIcon />}
                onClick={handleCreateDirectReceipt}
                color="success"
              >
                Direct Receipt
              </Button>
              <Button
                variant="outlined"
                startIcon={<BankTransferIcon />}
                onClick={handleCreateBankTransfer}
              >
                Bank Transfer
              </Button>
              <Button
                variant="outlined"
                startIcon={<ExpenseClaimIcon />}
                onClick={handleCreateExpenseClaim}
                color="warning"
              >
                Expense Claim
              </Button>
            </Stack>
          )}
        </Stack>
      </Stack>

      {/* Filters */}
      <Stack direction="row" spacing={2} sx={{ mb: 2 }} alignItems="center" flexWrap="wrap">
        <Tabs
          value={tab}
          onChange={(_, v) => {
            setTab(v);
            setPage(0);
          }}
        >
          <Tab label={`All (${payments.length})`} value="all" />
          <Tab
            label={`Receipts (${payments.filter((p) => RECEIPT_TYPES.has((p as unknown as { type: string }).type)).length})`}
            value="receipts"
          />
          <Tab
            label={`Payments (${payments.filter((p) => PAYMENT_TYPES.has((p as unknown as { type: string }).type)).length})`}
            value="payments"
          />
          <Tab
            label={`Bank Transfers (${payments.filter((p) => TRANSFER_TYPES.has((p as unknown as { type: string }).type)).length})`}
            value="transfers"
          />
        </Tabs>

        <TextField
          size="small"
          placeholder="Search by number, entity, reference..."
          value={searchTerm}
          onChange={(e) => {
            setSearchTerm(e.target.value);
            setPage(0);
          }}
          sx={{ minWidth: 300 }}
          InputProps={{
            startAdornment: (
              <InputAdornment position="start">
                <SearchIcon fontSize="small" />
              </InputAdornment>
            ),
          }}
        />

        <FiscalYearFilter
          options={fy.options}
          selectedId={fy.selectedId}
          onChange={(id) => {
            fy.setSelectedId(id);
            setPage(0);
          }}
        />

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

        {(filterMonth !== 'ALL' || searchTerm) && (
          <Button
            size="small"
            onClick={() => {
              setFilterMonth('ALL');
              setSearchTerm('');
              setPage(0);
            }}
          >
            Clear Filters
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
                    {filterMonth !== 'ALL' || tab !== 'all'
                      ? 'No entries found matching your filters.'
                      : 'No entries found. Click "Customer Receipt" or "Vendor Payment" to record one.'}
                  </Typography>
                </TableCell>
              </TableRow>
            ) : (
              paginatedPayments.map((payment) => (
                <TableRow key={payment.id} hover>
                  <TableCell>
                    <Chip
                      icon={
                        RECEIPT_TYPES.has((payment as unknown as { type: string }).type) ? (
                          <ReceiptIcon />
                        ) : (payment as unknown as { type: string }).type === 'DIRECT_PAYMENT' ? (
                          <DirectPaymentIcon />
                        ) : (payment as unknown as { type: string }).type === 'BANK_TRANSFER' ? (
                          <BankTransferIcon />
                        ) : (
                          <PaymentIcon />
                        )
                      }
                      label={
                        TYPE_CHIP[(payment as unknown as { type: string }).type]?.label ?? 'Payment'
                      }
                      size="small"
                      color={
                        TYPE_CHIP[(payment as unknown as { type: string }).type]?.color ?? 'primary'
                      }
                    />
                  </TableCell>
                  <TableCell>
                    {formatDate(
                      payment.paymentDate ?? (payment as unknown as { date?: Date }).date
                    )}
                  </TableCell>
                  <TableCell>{payment.transactionNumber}</TableCell>
                  <TableCell>{payment.entityName || '-'}</TableCell>
                  <TableCell>{payment.paymentMethod || '-'}</TableCell>
                  <TableCell align="right">{formatCurrency(payment.totalAmount ?? 0)}</TableCell>
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
                    {canManage ? (
                      <>
                        <Tooltip title="Edit">
                          <IconButton
                            size="small"
                            onClick={() => handleEdit(payment)}
                            aria-label="Edit"
                          >
                            <EditIcon fontSize="small" />
                          </IconButton>
                        </Tooltip>
                        <Tooltip title="Move to Trash">
                          <IconButton
                            size="small"
                            onClick={() => handleDelete(payment.id!)}
                            color="error"
                            aria-label="Move to Trash"
                          >
                            <DeleteIcon fontSize="small" />
                          </IconButton>
                        </Tooltip>
                      </>
                    ) : (
                      <Tooltip title="View">
                        <IconButton
                          size="small"
                          onClick={() => handleEdit(payment)}
                          aria-label="View"
                        >
                          <ViewIcon fontSize="small" />
                        </IconButton>
                      </Tooltip>
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

      <RecordDirectPaymentDialog
        open={directPaymentDialogOpen}
        onClose={handleDirectPaymentDialogClose}
        editingPayment={
          (editingPayment as unknown as { type: string })?.type === 'DIRECT_PAYMENT'
            ? (editingPayment as unknown as {
                id?: string;
                type: 'DIRECT_PAYMENT';
                transactionNumber: string;
                paymentDate: unknown;
                expenseAccountId: string;
                bankAccountId: string;
                paymentMethod: PaymentMethod;
                amount: number;
                description?: string;
                reference?: string;
                projectId?: string;
                chequeNumber?: string;
                upiTransactionId?: string;
              })
            : null
        }
      />

      <RecordDirectReceiptDialog
        open={directReceiptDialogOpen}
        onClose={handleDirectReceiptDialogClose}
        editingReceipt={
          (editingPayment as unknown as { type: string })?.type === 'DIRECT_RECEIPT'
            ? (editingPayment as unknown as {
                id?: string;
                type: 'DIRECT_RECEIPT';
                transactionNumber: string;
                receiptDate: unknown;
                revenueAccountId: string;
                bankAccountId: string;
                bankAccountName?: string;
                paymentMethod: PaymentMethod;
                amount: number;
                description?: string;
                reference?: string;
                projectId?: string;
                chequeNumber?: string;
                upiTransactionId?: string;
              })
            : null
        }
      />

      <CreateBankTransferDialog
        open={bankTransferDialogOpen}
        onClose={handleBankTransferDialogClose}
      />

      <CreateExpenseClaimDialog
        open={expenseClaimDialogOpen}
        onClose={handleExpenseClaimDialogClose}
      />
    </Box>
  );
}
