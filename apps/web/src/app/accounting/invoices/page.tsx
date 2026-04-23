'use client';

import { useState, useMemo } from 'react';
import dynamic from 'next/dynamic';
import {
  Button,
  Paper,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Chip,
  TablePagination,
  Box,
  TextField,
  FormControl,
  InputLabel,
  Select,
  MenuItem,
  InputAdornment,
  Typography,
  IconButton,
  Tooltip,
  Card,
  CardContent,
  Stack,
} from '@mui/material';
import { PageBreadcrumbs } from '@/components/common/PageBreadcrumbs';
import {
  Add as AddIcon,
  Visibility as ViewIcon,
  Edit as EditIcon,
  Delete as DeleteIcon,
  Send as SendIcon,
  Search as SearchIcon,
  AttachMoney as MoneyIcon,
  PendingActions as PendingIcon,
  Warning as WarningIcon,
  CheckCircle as ApproveIcon,
  AssignmentTurnedIn as SubmitIcon,
  Home as HomeIcon,
  Block as VoidIcon,
  FileDownload as DownloadIcon,
} from '@mui/icons-material';
import {
  PageHeader,
  LoadingState,
  EmptyState,
  TableActionCell,
  getStatusColor,
  StatCard,
  FilterBar,
} from '@vapour/ui';
import { invoiceListHelp } from '@/lib/help/pageHelpContent';
import { useAuth } from '@/contexts/AuthContext';
import { getFirebase } from '@/lib/firebase';
import { collection, query, where, orderBy, Timestamp } from 'firebase/firestore';
import { COLLECTIONS } from '@vapour/firebase';
import { hasPermission, PERMISSION_FLAGS } from '@vapour/constants';
import type { CustomerInvoice } from '@vapour/types';
import { formatCurrency, formatDate } from '@/lib/utils/formatters';
import {
  downloadReportCSV,
  downloadReportExcel,
  type ExportSection,
} from '@/lib/accounting/reports/exportReport';
import { DualCurrencyAmount } from '@/components/accounting/DualCurrencyAmount';
import {
  FiscalYearFilter,
  useFiscalYearFilter,
  matchesFiscalYear,
} from '@/components/accounting/FiscalYearFilter';
import { useFirestoreQuery } from '@/hooks/useFirestoreQuery';
import { useConfirmDialog } from '@/components/common/ConfirmDialog';
import { useToast } from '@/components/common/Toast';
import { softDeleteTransaction } from '@/lib/accounting/transactionDeleteService';
import { SubmitForApprovalDialog } from './components/SubmitForApprovalDialog';
import { ApproveInvoiceDialog } from './components/ApproveInvoiceDialog';

// Lazy load heavy dialog components
const CreateInvoiceDialog = dynamic(
  () => import('./components/CreateInvoiceDialog').then((mod) => mod.CreateInvoiceDialog),
  { ssr: false }
);
const VoidAndRecreateInvoiceDialog = dynamic(
  () =>
    import('./components/VoidAndRecreateInvoiceDialog').then(
      (mod) => mod.VoidAndRecreateInvoiceDialog
    ),
  { ssr: false }
);

// Extended type for approval support
interface CustomerInvoiceWithExtras extends CustomerInvoice {
  assignedApproverId?: string;
  assignedApproverName?: string;
  submittedByUserId?: string;
  submittedByUserName?: string;
}

// Helper function to convert Firestore Timestamp to Date
function toDate(value: Date | Timestamp | unknown): Date | null {
  if (!value) return null;
  if (value instanceof Date) return value;
  if (value instanceof Timestamp) return value.toDate();
  if (typeof value === 'object' && 'toDate' in value && typeof value.toDate === 'function') {
    return value.toDate();
  }
  try {
    return new Date(value as string | number);
  } catch {
    return null;
  }
}

export default function InvoicesPage() {
  const { claims, user } = useAuth();
  const { confirm } = useConfirmDialog();
  const { toast } = useToast();
  const [createDialogOpen, setCreateDialogOpen] = useState(false);
  const [editingInvoice, setEditingInvoice] = useState<CustomerInvoice | null>(null);
  const [viewMode, setViewMode] = useState(false);
  const [page, setPage] = useState(0);
  const [rowsPerPage, setRowsPerPage] = useState(50);
  const [searchTerm, setSearchTerm] = useState('');
  const [filterStatus, setFilterStatus] = useState<string>('ALL');

  const fy = useFiscalYearFilter();

  // Approval dialog states
  const [submitDialogOpen, setSubmitDialogOpen] = useState(false);
  const [approveDialogOpen, setApproveDialogOpen] = useState(false);
  const [selectedInvoice, setSelectedInvoice] = useState<CustomerInvoiceWithExtras | null>(null);

  // Void dialog states
  const [voidDialogOpen, setVoidDialogOpen] = useState(false);
  const [selectedInvoiceForVoid, setSelectedInvoiceForVoid] =
    useState<CustomerInvoiceWithExtras | null>(null);

  const canManage = hasPermission(claims?.permissions || 0, PERMISSION_FLAGS.MANAGE_ACCOUNTING);
  const canApprove = hasPermission(claims?.permissions || 0, PERMISSION_FLAGS.MANAGE_ACCOUNTING);

  // Firestore query using custom hook
  const { db } = getFirebase();
  const invoicesQuery = useMemo(
    () =>
      query(
        collection(db, COLLECTIONS.TRANSACTIONS),
        where('type', '==', 'CUSTOMER_INVOICE'),
        orderBy('date', 'desc')
      ),
    [db]
  );

  const { data: rawInvoices, loading } =
    useFirestoreQuery<CustomerInvoiceWithExtras>(invoicesQuery);
  const invoices = useMemo(() => rawInvoices.filter((inv) => !inv.isDeleted), [rawInvoices]);

  // Calculate stats - always in INR (base currency)
  const stats = useMemo(() => {
    const activeInvoices = invoices;
    const totalInvoiced = activeInvoices.reduce(
      (sum, inv) => sum + (inv.baseAmount || inv.totalAmount || 0),
      0
    );
    const outstanding = activeInvoices
      .filter((inv) => inv.paymentStatus !== 'PAID' && inv.status !== 'DRAFT')
      .reduce((sum, inv) => sum + (inv.baseAmount || inv.totalAmount || 0), 0);
    const overdue = activeInvoices
      .filter((inv) => {
        if (inv.paymentStatus !== 'UNPAID' || !inv.dueDate) return false;
        const dueDate = toDate(inv.dueDate);
        return dueDate && dueDate < new Date();
      })
      .reduce((sum, inv) => sum + (inv.baseAmount || inv.totalAmount || 0), 0);

    return { totalInvoiced, outstanding, overdue };
  }, [invoices]);

  // Filter logic
  const filteredInvoices = useMemo(() => {
    return invoices.filter((invoice) => {
      const matchesSearch =
        searchTerm === '' ||
        invoice.transactionNumber.toLowerCase().includes(searchTerm.toLowerCase()) ||
        (invoice.entityName && invoice.entityName.toLowerCase().includes(searchTerm.toLowerCase()));

      const matchesStatus = filterStatus === 'ALL' || invoice.status === filterStatus;

      let invoiceDate: Date | null = null;
      if (invoice.date) {
        invoiceDate =
          typeof (invoice.date as unknown as { toDate?: () => Date }).toDate === 'function'
            ? (invoice.date as unknown as { toDate: () => Date }).toDate()
            : new Date(invoice.date as unknown as string | number);
      }
      const matchesFY = matchesFiscalYear(invoiceDate, fy.range);

      return matchesSearch && matchesStatus && matchesFY;
    });
  }, [invoices, searchTerm, filterStatus, fy.range]);

  const handleCreate = () => {
    setEditingInvoice(null);
    setViewMode(false);
    setCreateDialogOpen(true);
  };

  const handleView = (invoice: CustomerInvoice) => {
    setEditingInvoice(invoice);
    setViewMode(true);
    setCreateDialogOpen(true);
  };

  const handleEdit = (invoice: CustomerInvoice) => {
    setEditingInvoice(invoice);
    setViewMode(false);
    setCreateDialogOpen(true);
  };

  const handleDelete = async (invoiceId: string) => {
    const confirmed = await confirm({
      title: 'Move to Trash',
      message:
        'This invoice will be moved to the Trash. You can restore it later or permanently delete it from there.',
      confirmText: 'Move to Trash',
      confirmColor: 'error',
    });
    if (!confirmed) return;

    try {
      const result = await softDeleteTransaction(db, {
        transactionId: invoiceId,
        reason: 'Moved to trash by user',
        userId: user?.uid || 'unknown',
        userName: user?.displayName || user?.email || 'Unknown',
        userPermissions: claims?.permissions || 0,
      });
      if (!result.success) {
        toast.error(result.error || 'Failed to move invoice to trash');
      }
    } catch (error) {
      console.error('[InvoicesPage] Error moving invoice to trash:', error);
      toast.error('Failed to move invoice to trash');
    }
  };

  const handleDialogClose = () => {
    setCreateDialogOpen(false);
    setEditingInvoice(null);
    setViewMode(false);
  };

  // Approval workflow handlers
  const handleSubmitForApproval = (invoice: CustomerInvoiceWithExtras) => {
    setSelectedInvoice(invoice);
    setSubmitDialogOpen(true);
  };

  const handleApprove = (invoice: CustomerInvoiceWithExtras) => {
    setSelectedInvoice(invoice);
    setApproveDialogOpen(true);
  };

  const handleApprovalDialogClose = () => {
    setSubmitDialogOpen(false);
    setApproveDialogOpen(false);
    setSelectedInvoice(null);
  };

  // Void workflow handlers
  const handleVoidInvoice = (invoice: CustomerInvoiceWithExtras) => {
    setSelectedInvoiceForVoid(invoice);
    setVoidDialogOpen(true);
  };

  const handleCloseVoidDialog = () => {
    setVoidDialogOpen(false);
    setSelectedInvoiceForVoid(null);
  };

  // Check if current user is the assigned approver
  const isAssignedApprover = (invoice: CustomerInvoiceWithExtras): boolean => {
    return !!(user && invoice.assignedApproverId === user.uid);
  };

  const handleChangePage = (_event: unknown, newPage: number) => {
    setPage(newPage);
  };

  const handleChangeRowsPerPage = (event: React.ChangeEvent<HTMLInputElement>) => {
    setRowsPerPage(parseInt(event.target.value, 10));
    setPage(0);
  };

  const handleClearFilters = () => {
    setSearchTerm('');
    setFilterStatus('ALL');
    fy.setSelectedId('CURRENT');
  };

  // Paginate filtered invoices
  const paginatedInvoices = filteredInvoices.slice(
    page * rowsPerPage,
    page * rowsPerPage + rowsPerPage
  );

  const buildExportSections = (): ExportSection[] => {
    const columns = [
      { header: 'Date', key: 'date', width: 12 },
      { header: 'Invoice Number', key: 'number', width: 18 },
      { header: 'Customer', key: 'customer', width: 25 },
      { header: 'Description', key: 'description', width: 30 },
      {
        header: 'Subtotal',
        key: 'subtotal',
        width: 15,
        align: 'right' as const,
        format: 'currency' as const,
      },
      {
        header: 'GST',
        key: 'gst',
        width: 12,
        align: 'right' as const,
        format: 'currency' as const,
      },
      {
        header: 'Total (INR)',
        key: 'total',
        width: 15,
        align: 'right' as const,
        format: 'currency' as const,
      },
      { header: 'Currency', key: 'currency', width: 8 },
      { header: 'Status', key: 'status', width: 15 },
    ];
    return [
      {
        title: 'Customer Invoices',
        columns,
        rows: filteredInvoices.map((inv) => ({
          date: formatDate(inv.date),
          number: inv.transactionNumber,
          customer: inv.entityName || '',
          description: inv.description || '',
          subtotal: inv.subtotal || 0,
          gst: inv.gstDetails?.totalGST || inv.taxAmount || 0,
          total: inv.baseAmount || inv.totalAmount || 0,
          currency: inv.currency || 'INR',
          status: inv.status,
        })),
        summary: {
          date: '',
          number: '',
          customer: 'TOTAL',
          description: '',
          subtotal: filteredInvoices.reduce((s, i) => s + (i.subtotal || 0), 0),
          gst: filteredInvoices.reduce(
            (s, i) => s + (i.gstDetails?.totalGST || i.taxAmount || 0),
            0
          ),
          total: filteredInvoices.reduce((s, i) => s + (i.baseAmount || i.totalAmount || 0), 0),
          currency: '',
          status: '',
        },
      },
    ];
  };

  const handleExportCSV = () =>
    downloadReportCSV(
      buildExportSections(),
      `Customer_Invoices_${new Date().toISOString().slice(0, 10)}`
    );
  const handleExportExcel = () =>
    downloadReportExcel(
      buildExportSections(),
      `Customer_Invoices_${new Date().toISOString().slice(0, 10)}`,
      'Customer Invoices'
    );

  if (loading) {
    return (
      <Box sx={{ py: 4 }}>
        <LoadingState message="Loading invoices..." variant="page" />
      </Box>
    );
  }

  return (
    <Box sx={{ py: 4 }}>
      <PageBreadcrumbs
        items={[
          { label: 'Accounting', href: '/accounting', icon: <HomeIcon fontSize="small" /> },
          { label: 'Customer Invoices' },
        ]}
      />

      <PageHeader
        title="Customer Invoices"
        subtitle="Manage customer invoices and track payments"
        help={invoiceListHelp}
        action={
          <Box sx={{ display: 'flex', gap: 1, alignItems: 'center' }}>
            {filteredInvoices.length > 0 && (
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
              <Button variant="contained" startIcon={<AddIcon />} onClick={handleCreate}>
                New Invoice
              </Button>
            )}
          </Box>
        }
      />

      {/* Stats */}
      <Box
        sx={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(250px, 1fr))',
          gap: 2,
          mb: 3,
        }}
      >
        <StatCard
          label="Total Invoiced (INR)"
          value={formatCurrency(stats.totalInvoiced, 'INR')}
          icon={<MoneyIcon />}
          color="primary"
        />
        <StatCard
          label="Outstanding (INR)"
          value={formatCurrency(stats.outstanding, 'INR')}
          icon={<PendingIcon />}
          color="warning"
        />
        <StatCard
          label="Overdue (INR)"
          value={formatCurrency(stats.overdue, 'INR')}
          icon={<WarningIcon />}
          color="error"
        />
      </Box>

      {/* Filters */}
      <FilterBar onClear={handleClearFilters}>
        <TextField
          label="Search"
          size="small"
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
          placeholder="Search by number or customer..."
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
          <InputLabel>Status</InputLabel>
          <Select
            value={filterStatus}
            onChange={(e) => setFilterStatus(e.target.value)}
            label="Status"
          >
            <MenuItem value="ALL">All Status</MenuItem>
            <MenuItem value="DRAFT">Draft</MenuItem>
            <MenuItem value="PENDING_APPROVAL">Pending Approval</MenuItem>
            <MenuItem value="APPROVED">Approved</MenuItem>
            <MenuItem value="SENT">Sent</MenuItem>
            <MenuItem value="PAID">Paid</MenuItem>
            <MenuItem value="VOID">Void</MenuItem>
            <MenuItem value="OVERDUE">Overdue</MenuItem>
          </Select>
        </FormControl>
        <FiscalYearFilter
          options={fy.options}
          selectedId={fy.selectedId}
          onChange={fy.setSelectedId}
        />
      </FilterBar>

      {/* Desktop / tablet — table. UI-STANDARDS rule 8.2: mobile card
          fallback rendered below. */}
      <TableContainer
        component={Paper}
        sx={{ overflowX: 'auto', display: { xs: 'none', md: 'block' } }}
      >
        <Table sx={{ minWidth: 960 }}>
          <TableHead>
            <TableRow>
              <TableCell>Date</TableCell>
              <TableCell>Invoice Number</TableCell>
              <TableCell>Customer</TableCell>
              <TableCell>Description</TableCell>
              <TableCell align="right">Subtotal</TableCell>
              <TableCell align="right">GST</TableCell>
              <TableCell align="right">Total</TableCell>
              <TableCell>Status</TableCell>
              <TableCell align="right">Actions</TableCell>
            </TableRow>
          </TableHead>
          <TableBody>
            {paginatedInvoices.length === 0 ? (
              <EmptyState
                message={
                  searchTerm || filterStatus !== 'ALL'
                    ? 'No invoices match the selected filters.'
                    : 'No invoices found. Create your first customer invoice to get started.'
                }
                variant="table"
                colSpan={9}
                action={
                  canManage && !searchTerm && filterStatus === 'ALL' ? (
                    <Button variant="contained" startIcon={<AddIcon />} onClick={handleCreate}>
                      Create First Invoice
                    </Button>
                  ) : undefined
                }
              />
            ) : (
              paginatedInvoices.map((invoice) => {
                return (
                  <TableRow key={invoice.id} hover>
                    <TableCell>{formatDate(invoice.date)}</TableCell>
                    <TableCell>{invoice.transactionNumber}</TableCell>
                    <TableCell>{invoice.entityName || '-'}</TableCell>
                    <TableCell>{invoice.description || '-'}</TableCell>
                    <TableCell align="right">
                      {formatCurrency(invoice.subtotal || 0, invoice.currency || 'INR')}
                    </TableCell>
                    <TableCell align="right">
                      {formatCurrency(
                        invoice.gstDetails?.totalGST || invoice.taxAmount || 0,
                        invoice.currency || 'INR'
                      )}
                    </TableCell>
                    <TableCell align="right">
                      <DualCurrencyAmount
                        foreignAmount={invoice.totalAmount || 0}
                        foreignCurrency={invoice.currency || 'INR'}
                        baseAmount={invoice.baseAmount || invoice.totalAmount || 0}
                        exchangeRate={invoice.exchangeRate}
                        size="small"
                      />
                    </TableCell>
                    <TableCell>
                      <Chip
                        label={
                          invoice.status === 'PENDING_APPROVAL'
                            ? 'Pending Approval'
                            : invoice.status
                                .replace(/_/g, ' ')
                                .replace(/\b\w/g, (c) => c.toUpperCase())
                        }
                        size="small"
                        color={getStatusColor(invoice.status, 'invoice')}
                      />
                    </TableCell>
                    <TableCell align="right">
                      <TableActionCell
                        actions={[
                          {
                            icon: <ViewIcon />,
                            label: 'View Invoice',
                            onClick: () => handleView(invoice),
                          },
                          {
                            icon: <EditIcon />,
                            label: 'Edit Invoice',
                            onClick: () => handleEdit(invoice),
                            show: canManage && invoice.status === 'DRAFT',
                          },
                          {
                            icon: <SubmitIcon />,
                            label: 'Submit for Approval',
                            onClick: () => handleSubmitForApproval(invoice),
                            show: canManage && invoice.status === 'DRAFT',
                            color: 'primary',
                          },
                          {
                            icon: <ApproveIcon />,
                            label: 'Review & Approve',
                            onClick: () => handleApprove(invoice),
                            show:
                              invoice.status === 'PENDING_APPROVAL' &&
                              (canApprove || isAssignedApprover(invoice)),
                            color: 'success',
                          },
                          {
                            icon: <SendIcon />,
                            label: 'Send Invoice',
                            onClick: () => {},
                            show: canManage && invoice.status === 'APPROVED',
                          },
                          {
                            icon: <VoidIcon />,
                            label: 'Void / Change Customer',
                            onClick: () => handleVoidInvoice(invoice),
                            color: 'warning',
                            show:
                              canManage &&
                              invoice.status !== 'VOID' &&
                              invoice.status !== 'DRAFT' &&
                              invoice.paymentStatus !== 'PAID' &&
                              invoice.paymentStatus !== 'PARTIALLY_PAID',
                          },
                          {
                            icon: <DeleteIcon />,
                            label: 'Move to Trash',
                            onClick: () => handleDelete(invoice.id!),
                            color: 'error',
                            show: canManage && invoice.status !== 'VOID',
                          },
                        ]}
                      />
                    </TableCell>
                  </TableRow>
                );
              })
            )}
          </TableBody>
        </Table>
        <TablePagination
          rowsPerPageOptions={[25, 50, 100]}
          component="div"
          count={filteredInvoices.length}
          rowsPerPage={rowsPerPage}
          page={page}
          onPageChange={handleChangePage}
          onRowsPerPageChange={handleChangeRowsPerPage}
        />
      </TableContainer>

      {/* Mobile — card stack with the same data and actions */}
      <Box sx={{ display: { xs: 'block', md: 'none' } }}>
        {paginatedInvoices.length === 0 ? (
          <Paper sx={{ p: 3, textAlign: 'center' }}>
            <Typography variant="body2" color="text.secondary">
              {searchTerm || filterStatus !== 'ALL'
                ? 'No invoices match the selected filters.'
                : 'No invoices found.'}
            </Typography>
          </Paper>
        ) : (
          <Stack spacing={1.5}>
            {paginatedInvoices.map((invoice) => (
              <Card key={invoice.id}>
                <CardContent>
                  <Stack
                    direction="row"
                    justifyContent="space-between"
                    alignItems="flex-start"
                    sx={{ mb: 1 }}
                  >
                    <Box sx={{ minWidth: 0, flex: 1 }}>
                      <Typography variant="body1" fontWeight="medium" noWrap>
                        {invoice.transactionNumber}
                      </Typography>
                      <Typography variant="caption" color="text.secondary" noWrap>
                        {invoice.entityName || '-'}
                      </Typography>
                    </Box>
                    <Box>
                      <TableActionCell
                        actions={[
                          {
                            icon: <ViewIcon />,
                            label: 'View Invoice',
                            onClick: () => handleView(invoice),
                          },
                          {
                            icon: <EditIcon />,
                            label: 'Edit Invoice',
                            onClick: () => handleEdit(invoice),
                            show: canManage && invoice.status === 'DRAFT',
                          },
                          {
                            icon: <SubmitIcon />,
                            label: 'Submit for Approval',
                            onClick: () => handleSubmitForApproval(invoice),
                            show: canManage && invoice.status === 'DRAFT',
                            color: 'primary',
                          },
                          {
                            icon: <ApproveIcon />,
                            label: 'Review & Approve',
                            onClick: () => handleApprove(invoice),
                            show:
                              invoice.status === 'PENDING_APPROVAL' &&
                              (canApprove || isAssignedApprover(invoice)),
                            color: 'success',
                          },
                          {
                            icon: <DeleteIcon />,
                            label: 'Move to Trash',
                            onClick: () => handleDelete(invoice.id!),
                            color: 'error',
                            show: canManage && invoice.status !== 'VOID',
                          },
                        ]}
                      />
                    </Box>
                  </Stack>

                  <Stack direction="row" spacing={0.75} sx={{ mb: 1 }} flexWrap="wrap" useFlexGap>
                    <Chip
                      label={
                        invoice.status === 'PENDING_APPROVAL'
                          ? 'Pending Approval'
                          : invoice.status
                              .replace(/_/g, ' ')
                              .replace(/\b\w/g, (c) => c.toUpperCase())
                      }
                      size="small"
                      color={getStatusColor(invoice.status, 'invoice')}
                    />
                  </Stack>

                  <Stack direction="row" justifyContent="space-between" alignItems="center">
                    <Typography variant="caption" color="text.secondary">
                      {formatDate(invoice.date)}
                    </Typography>
                    <DualCurrencyAmount
                      foreignAmount={invoice.totalAmount || 0}
                      foreignCurrency={invoice.currency || 'INR'}
                      baseAmount={invoice.baseAmount || invoice.totalAmount || 0}
                      exchangeRate={invoice.exchangeRate}
                      size="small"
                    />
                  </Stack>
                </CardContent>
              </Card>
            ))}
            <TablePagination
              rowsPerPageOptions={[25, 50, 100]}
              component="div"
              count={filteredInvoices.length}
              rowsPerPage={rowsPerPage}
              page={page}
              onPageChange={handleChangePage}
              onRowsPerPageChange={handleChangeRowsPerPage}
            />
          </Stack>
        )}
      </Box>

      <CreateInvoiceDialog
        open={createDialogOpen}
        onClose={handleDialogClose}
        editingInvoice={editingInvoice}
        viewOnly={viewMode}
      />

      {/* Approval Workflow Dialogs */}
      <SubmitForApprovalDialog
        open={submitDialogOpen}
        onClose={handleApprovalDialogClose}
        invoice={selectedInvoice}
      />

      <ApproveInvoiceDialog
        open={approveDialogOpen}
        onClose={handleApprovalDialogClose}
        invoice={selectedInvoice}
      />

      <VoidAndRecreateInvoiceDialog
        open={voidDialogOpen}
        onClose={handleCloseVoidDialog}
        invoice={selectedInvoiceForVoid}
      />
    </Box>
  );
}
