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
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  CircularProgress,
  Breadcrumbs,
  Link,
  Typography,
} from '@mui/material';
import {
  Add as AddIcon,
  Visibility as ViewIcon,
  Edit as EditIcon,
  Delete as DeleteIcon,
  Search as SearchIcon,
  AttachMoney as MoneyIcon,
  PendingActions as PendingIcon,
  Warning as WarningIcon,
  Numbers as NumbersIcon,
  Send as SendIcon,
  Check as CheckIcon,
  Block as VoidIcon,
  Home as HomeIcon,
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
import { useAuth } from '@/contexts/AuthContext';
import { getFirebase } from '@/lib/firebase';
import {
  collection,
  query,
  where,
  orderBy,
  doc,
  deleteDoc,
  updateDoc,
  Timestamp,
} from 'firebase/firestore';
import { COLLECTIONS } from '@vapour/firebase';
import { hasPermission, PERMISSION_FLAGS } from '@vapour/constants';
import type { VendorBill } from '@vapour/types';
import { formatCurrency, formatDate } from '@/lib/utils/formatters';
import { DualCurrencyAmount } from '@/components/accounting/DualCurrencyAmount';
import { useFirestoreQuery } from '@/hooks/useFirestoreQuery';
import { useRouter } from 'next/navigation';
import { useConfirmDialog } from '@/components/common/ConfirmDialog';

// Lazy load heavy dialog components
const CreateBillDialog = dynamic(
  () => import('./components/CreateBillDialog').then((mod) => mod.CreateBillDialog),
  { ssr: false }
);
const SubmitBillForApprovalDialog = dynamic(
  () =>
    import('./components/SubmitBillForApprovalDialog').then(
      (mod) => mod.SubmitBillForApprovalDialog
    ),
  { ssr: false }
);
const ApproveBillDialog = dynamic(
  () => import('./components/ApproveBillDialog').then((mod) => mod.ApproveBillDialog),
  { ssr: false }
);
const VoidAndRecreateBillDialog = dynamic(
  () =>
    import('./components/VoidAndRecreateBillDialog').then((mod) => mod.VoidAndRecreateBillDialog),
  { ssr: false }
);

// Generate month options for the filter (current month and 11 previous months)
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

export default function BillsPage() {
  const router = useRouter();
  const { claims, user } = useAuth();
  const { confirm } = useConfirmDialog();
  const [createDialogOpen, setCreateDialogOpen] = useState(false);
  const [editingBill, setEditingBill] = useState<VendorBill | null>(null);
  const [viewMode, setViewMode] = useState(false);
  const [page, setPage] = useState(0);
  const [rowsPerPage, setRowsPerPage] = useState(50);
  const [searchTerm, setSearchTerm] = useState('');
  const [filterStatus, setFilterStatus] = useState<string>('ALL');
  const [filterMonth, setFilterMonth] = useState<string>('ALL');

  const monthOptions = useMemo(() => getMonthOptions(), []);

  // Update Bill Number Dialog state
  const [updateBillNumberDialogOpen, setUpdateBillNumberDialogOpen] = useState(false);
  const [billToUpdate, setBillToUpdate] = useState<VendorBill | null>(null);
  const [newBillNumber, setNewBillNumber] = useState('');
  const [updatingBillNumber, setUpdatingBillNumber] = useState(false);

  // Approval dialogs state
  const [submitForApprovalDialogOpen, setSubmitForApprovalDialogOpen] = useState(false);
  const [approveBillDialogOpen, setApproveBillDialogOpen] = useState(false);
  const [selectedBillForApproval, setSelectedBillForApproval] = useState<VendorBill | null>(null);

  // Void dialog state
  const [voidDialogOpen, setVoidDialogOpen] = useState(false);
  const [selectedBillForVoid, setSelectedBillForVoid] = useState<VendorBill | null>(null);

  const canManage = hasPermission(claims?.permissions || 0, PERMISSION_FLAGS.MANAGE_ACCOUNTING);

  // Firestore query using custom hook
  const { db } = getFirebase();
  const billsQuery = useMemo(
    () =>
      query(
        collection(db, COLLECTIONS.TRANSACTIONS),
        where('type', '==', 'VENDOR_BILL'),
        orderBy('date', 'desc')
      ),
    [db]
  );

  const { data: bills, loading } = useFirestoreQuery<VendorBill>(billsQuery);

  // Calculate stats - always in INR (base currency)
  const stats = useMemo(() => {
    const totalBilled = bills.reduce(
      (sum, bill) => sum + (bill.baseAmount || bill.totalAmount || 0),
      0
    );
    const outstanding = bills
      .filter((bill) => bill.paymentStatus !== 'PAID' && bill.status !== 'DRAFT')
      .reduce((sum, bill) => sum + (bill.baseAmount || bill.totalAmount || 0), 0);
    const overdue = bills
      .filter(
        (bill) =>
          bill.paymentStatus === 'UNPAID' && bill.dueDate && new Date(bill.dueDate) < new Date()
      )
      .reduce((sum, bill) => sum + (bill.baseAmount || bill.totalAmount || 0), 0);

    return { totalBilled, outstanding, overdue };
  }, [bills]);

  // Filter logic
  const filteredBills = useMemo(() => {
    return bills.filter((bill) => {
      const matchesSearch =
        searchTerm === '' ||
        bill.transactionNumber.toLowerCase().includes(searchTerm.toLowerCase()) ||
        (bill.vendorInvoiceNumber &&
          bill.vendorInvoiceNumber.toLowerCase().includes(searchTerm.toLowerCase())) ||
        (bill.entityName && bill.entityName.toLowerCase().includes(searchTerm.toLowerCase()));

      const matchesStatus = filterStatus === 'ALL' || bill.status === filterStatus;

      // Month filter - compare year-month of bill date
      let matchesMonth = true;
      if (filterMonth !== 'ALL' && bill.date) {
        // Handle both Firestore Timestamp and Date objects
        const billDate =
          typeof (bill.date as unknown as { toDate?: () => Date }).toDate === 'function'
            ? (bill.date as unknown as { toDate: () => Date }).toDate()
            : new Date(bill.date as unknown as string | number);
        const billYearMonth = `${billDate.getFullYear()}-${String(billDate.getMonth() + 1).padStart(2, '0')}`;
        matchesMonth = billYearMonth === filterMonth;
      }

      return matchesSearch && matchesStatus && matchesMonth;
    });
  }, [bills, searchTerm, filterStatus, filterMonth]);

  // Calculate month-wise totals for filtered bills (Basic Amount and GST)
  const monthTotals = useMemo(() => {
    const subtotal = filteredBills.reduce((sum, bill) => sum + (bill.subtotal || 0), 0);
    const gst = filteredBills.reduce((sum, bill) => sum + (bill.gstDetails?.totalGST || 0), 0);
    const total = filteredBills.reduce(
      (sum, bill) => sum + (bill.baseAmount || bill.totalAmount || 0),
      0
    );
    const tds = filteredBills.reduce(
      (sum, bill) => sum + (bill.tdsDeducted ? bill.tdsAmount || 0 : 0),
      0
    );
    const count = filteredBills.length;

    return { subtotal, gst, total, tds, count };
  }, [filteredBills]);

  const handleCreate = () => {
    setEditingBill(null);
    setViewMode(false);
    setCreateDialogOpen(true);
  };

  const handleView = (bill: VendorBill) => {
    setEditingBill(bill);
    setViewMode(true);
    setCreateDialogOpen(true);
  };

  const handleEdit = (bill: VendorBill) => {
    setEditingBill(bill);
    setViewMode(false);
    setCreateDialogOpen(true);
  };

  const handleDelete = async (billId: string) => {
    const confirmed = await confirm({
      title: 'Delete Bill',
      message: 'Are you sure you want to delete this bill? This action cannot be undone.',
      confirmText: 'Delete',
      confirmColor: 'error',
    });
    if (!confirmed) return;

    try {
      const { db } = getFirebase();
      await deleteDoc(doc(db, COLLECTIONS.TRANSACTIONS, billId));
    } catch (error) {
      console.error('[BillsPage] Error deleting bill:', error);
      alert('Failed to delete bill');
    }
  };

  const handleDialogClose = () => {
    setCreateDialogOpen(false);
    setEditingBill(null);
    setViewMode(false);
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
    setFilterMonth('ALL');
  };

  // Update Bill Number handlers
  const handleOpenUpdateBillNumber = (bill: VendorBill) => {
    setBillToUpdate(bill);
    setNewBillNumber(bill.vendorInvoiceNumber || '');
    setUpdateBillNumberDialogOpen(true);
  };

  const handleCloseUpdateBillNumber = () => {
    setUpdateBillNumberDialogOpen(false);
    setBillToUpdate(null);
    setNewBillNumber('');
  };

  const handleSaveUpdateBillNumber = async () => {
    if (!billToUpdate?.id || !newBillNumber.trim()) return;

    setUpdatingBillNumber(true);
    try {
      const { db } = getFirebase();
      await updateDoc(doc(db, COLLECTIONS.TRANSACTIONS, billToUpdate.id), {
        vendorInvoiceNumber: newBillNumber.trim(),
        updatedAt: Timestamp.now(),
      });
      handleCloseUpdateBillNumber();
    } catch (error) {
      console.error('[BillsPage] Error updating bill number:', error);
      alert('Failed to update bill number');
    } finally {
      setUpdatingBillNumber(false);
    }
  };

  // Approval handlers
  const handleSubmitForApproval = (bill: VendorBill) => {
    setSelectedBillForApproval(bill);
    setSubmitForApprovalDialogOpen(true);
  };

  const handleApproveBill = (bill: VendorBill) => {
    setSelectedBillForApproval(bill);
    setApproveBillDialogOpen(true);
  };

  const handleCloseApprovalDialogs = () => {
    setSubmitForApprovalDialogOpen(false);
    setApproveBillDialogOpen(false);
    setSelectedBillForApproval(null);
  };

  // Void handlers
  const handleVoidBill = (bill: VendorBill) => {
    setSelectedBillForVoid(bill);
    setVoidDialogOpen(true);
  };

  const handleCloseVoidDialog = () => {
    setVoidDialogOpen(false);
    setSelectedBillForVoid(null);
  };

  // Paginate filtered bills
  const paginatedBills = filteredBills.slice(page * rowsPerPage, page * rowsPerPage + rowsPerPage);

  if (loading) {
    return (
      <Box sx={{ py: 4 }}>
        <LoadingState message="Loading bills..." variant="page" />
      </Box>
    );
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
        <Typography color="text.primary">Vendor Bills</Typography>
      </Breadcrumbs>

      <PageHeader
        title="Vendor Bills"
        subtitle="Track vendor bills and manage payments"
        action={
          canManage && (
            <Button variant="contained" startIcon={<AddIcon />} onClick={handleCreate}>
              Record Bill
            </Button>
          )
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
          label="Total Billed (INR)"
          value={formatCurrency(stats.totalBilled, 'INR')}
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
          placeholder="Search by number or vendor..."
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
            <MenuItem value="PAID">Paid</MenuItem>
            <MenuItem value="OVERDUE">Overdue</MenuItem>
            <MenuItem value="VOID">Voided</MenuItem>
          </Select>
        </FormControl>
        <FormControl size="small" sx={{ minWidth: 180 }}>
          <InputLabel>Month</InputLabel>
          <Select
            value={filterMonth}
            onChange={(e) => setFilterMonth(e.target.value)}
            label="Month"
          >
            <MenuItem value="ALL">All Months</MenuItem>
            {monthOptions.map((option) => (
              <MenuItem key={option.value} value={option.value}>
                {option.label}
              </MenuItem>
            ))}
          </Select>
        </FormControl>
      </FilterBar>

      {/* Month/Filter Totals Summary */}
      {filteredBills.length > 0 && (
        <Paper sx={{ p: 2, mb: 2 }}>
          <Box
            sx={{
              display: 'flex',
              flexWrap: 'wrap',
              gap: 3,
              alignItems: 'center',
              justifyContent: 'space-between',
            }}
          >
            <Box sx={{ display: 'flex', gap: 4, flexWrap: 'wrap' }}>
              <Box>
                <Box component="span" sx={{ color: 'text.secondary', fontSize: '0.875rem' }}>
                  Bills Count:{' '}
                </Box>
                <Box component="span" sx={{ fontWeight: 'medium' }}>
                  {monthTotals.count}
                </Box>
              </Box>
              <Box>
                <Box component="span" sx={{ color: 'text.secondary', fontSize: '0.875rem' }}>
                  Basic Amount:{' '}
                </Box>
                <Box component="span" sx={{ fontWeight: 'medium' }}>
                  {formatCurrency(monthTotals.subtotal, 'INR')}
                </Box>
              </Box>
              <Box>
                <Box component="span" sx={{ color: 'text.secondary', fontSize: '0.875rem' }}>
                  GST Total:{' '}
                </Box>
                <Box component="span" sx={{ fontWeight: 'medium' }}>
                  {formatCurrency(monthTotals.gst, 'INR')}
                </Box>
              </Box>
              <Box>
                <Box component="span" sx={{ color: 'text.secondary', fontSize: '0.875rem' }}>
                  TDS Total:{' '}
                </Box>
                <Box component="span" sx={{ fontWeight: 'medium' }}>
                  {formatCurrency(monthTotals.tds, 'INR')}
                </Box>
              </Box>
              <Box>
                <Box component="span" sx={{ color: 'text.secondary', fontSize: '0.875rem' }}>
                  Grand Total:{' '}
                </Box>
                <Box component="span" sx={{ fontWeight: 'bold', color: 'primary.main' }}>
                  {formatCurrency(monthTotals.total, 'INR')}
                </Box>
              </Box>
            </Box>
          </Box>
        </Paper>
      )}

      <TableContainer component={Paper}>
        <Table>
          <TableHead>
            <TableRow>
              <TableCell>Date</TableCell>
              <TableCell>Bill Number</TableCell>
              <TableCell>Vendor</TableCell>
              <TableCell>Description</TableCell>
              <TableCell align="right">Subtotal</TableCell>
              <TableCell align="right">GST</TableCell>
              <TableCell align="right">TDS</TableCell>
              <TableCell align="right">Total</TableCell>
              <TableCell>Status</TableCell>
              <TableCell align="right">Actions</TableCell>
            </TableRow>
          </TableHead>
          <TableBody>
            {paginatedBills.length === 0 ? (
              <EmptyState
                message={
                  searchTerm || filterStatus !== 'ALL' || filterMonth !== 'ALL'
                    ? 'No bills match the selected filters.'
                    : 'No bills found. Record your first vendor bill to get started.'
                }
                variant="table"
                colSpan={10}
                action={
                  canManage && !searchTerm && filterStatus === 'ALL' && filterMonth === 'ALL' ? (
                    <Button variant="contained" startIcon={<AddIcon />} onClick={handleCreate}>
                      Record First Bill
                    </Button>
                  ) : undefined
                }
              />
            ) : (
              paginatedBills.map((bill) => (
                <TableRow key={bill.id} hover>
                  <TableCell>{formatDate(bill.date)}</TableCell>
                  <TableCell>{bill.vendorInvoiceNumber || bill.transactionNumber}</TableCell>
                  <TableCell>{bill.entityName || '-'}</TableCell>
                  <TableCell>{bill.description || '-'}</TableCell>
                  <TableCell align="right">
                    {formatCurrency(bill.subtotal || 0, bill.currency || 'INR')}
                  </TableCell>
                  <TableCell align="right">
                    {formatCurrency(bill.gstDetails?.totalGST || 0, bill.currency || 'INR')}
                  </TableCell>
                  <TableCell align="right">
                    {bill.tdsDeducted
                      ? formatCurrency(bill.tdsAmount || 0, bill.currency || 'INR')
                      : '-'}
                  </TableCell>
                  <TableCell align="right">
                    <DualCurrencyAmount
                      foreignAmount={bill.totalAmount || 0}
                      foreignCurrency={bill.currency || 'INR'}
                      baseAmount={bill.baseAmount || bill.totalAmount || 0}
                      exchangeRate={bill.exchangeRate}
                      size="small"
                    />
                  </TableCell>
                  <TableCell>
                    <Chip
                      label={
                        bill.status === 'PENDING_APPROVAL'
                          ? 'Pending Approval'
                          : bill.status.replace(/_/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase())
                      }
                      size="small"
                      color={getStatusColor(bill.status, 'bill')}
                    />
                  </TableCell>
                  <TableCell align="right">
                    <TableActionCell
                      actions={[
                        {
                          icon: <ViewIcon />,
                          label: 'View Bill',
                          onClick: () => handleView(bill),
                        },
                        {
                          icon: <EditIcon />,
                          label: 'Edit Bill',
                          onClick: () => handleEdit(bill),
                          show: canManage && bill.status === 'DRAFT',
                        },
                        {
                          icon: <SendIcon />,
                          label: 'Submit for Approval',
                          onClick: () => handleSubmitForApproval(bill),
                          show: canManage && bill.status === 'DRAFT',
                          color: 'primary',
                        },
                        {
                          icon: <CheckIcon />,
                          label: 'Review & Approve',
                          onClick: () => handleApproveBill(bill),
                          color: 'success',
                          show:
                            bill.status === 'PENDING_APPROVAL' &&
                            (canManage || bill.assignedApproverId === user?.uid),
                        },
                        {
                          icon: <NumbersIcon />,
                          label: 'Update Bill Number',
                          onClick: () => handleOpenUpdateBillNumber(bill),
                          show: canManage && bill.status !== 'DRAFT',
                        },
                        {
                          icon: <VoidIcon />,
                          label: 'Void / Change Vendor',
                          onClick: () => handleVoidBill(bill),
                          color: 'warning',
                          show:
                            canManage &&
                            bill.status !== 'VOID' &&
                            bill.paymentStatus !== 'PAID' &&
                            bill.paymentStatus !== 'PARTIALLY_PAID',
                        },
                        {
                          icon: <DeleteIcon />,
                          label: 'Delete Bill',
                          onClick: () => handleDelete(bill.id!),
                          color: 'error',
                          show: canManage && bill.status !== 'VOID',
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
          rowsPerPageOptions={[25, 50, 100]}
          component="div"
          count={filteredBills.length}
          rowsPerPage={rowsPerPage}
          page={page}
          onPageChange={handleChangePage}
          onRowsPerPageChange={handleChangeRowsPerPage}
        />
      </TableContainer>

      <CreateBillDialog
        open={createDialogOpen}
        onClose={handleDialogClose}
        editingBill={editingBill}
        viewOnly={viewMode}
      />

      {/* Update Bill Number Dialog */}
      <Dialog
        open={updateBillNumberDialogOpen}
        onClose={handleCloseUpdateBillNumber}
        maxWidth="sm"
        fullWidth
      >
        <DialogTitle>Update Bill Number</DialogTitle>
        <DialogContent>
          <Box sx={{ pt: 1 }}>
            <TextField
              fullWidth
              label="Vendor Bill/Invoice Number"
              value={newBillNumber}
              onChange={(e) => setNewBillNumber(e.target.value)}
              placeholder="Enter vendor's bill number"
              helperText={
                billToUpdate
                  ? `Vendor: ${billToUpdate.entityName || 'Unknown'} | System Ref: ${billToUpdate.transactionNumber}`
                  : ''
              }
              autoFocus
            />
          </Box>
        </DialogContent>
        <DialogActions>
          <Button onClick={handleCloseUpdateBillNumber} disabled={updatingBillNumber}>
            Cancel
          </Button>
          <Button
            onClick={handleSaveUpdateBillNumber}
            variant="contained"
            disabled={updatingBillNumber || !newBillNumber.trim()}
            startIcon={updatingBillNumber ? <CircularProgress size={16} /> : null}
          >
            {updatingBillNumber ? 'Saving...' : 'Save'}
          </Button>
        </DialogActions>
      </Dialog>

      {/* Approval Dialogs */}
      <SubmitBillForApprovalDialog
        open={submitForApprovalDialogOpen}
        onClose={handleCloseApprovalDialogs}
        bill={selectedBillForApproval}
      />
      <ApproveBillDialog
        open={approveBillDialogOpen}
        onClose={handleCloseApprovalDialogs}
        bill={selectedBillForApproval}
      />

      {/* Void and Recreate Dialog */}
      <VoidAndRecreateBillDialog
        open={voidDialogOpen}
        onClose={handleCloseVoidDialog}
        bill={selectedBillForVoid}
      />
    </>
  );
}
