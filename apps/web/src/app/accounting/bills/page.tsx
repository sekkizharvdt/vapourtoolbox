'use client';

import { useState, useMemo } from 'react';
import {
  Container,
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
  Grid,
  TextField,
  FormControl,
  InputLabel,
  Select,
  MenuItem,
  InputAdornment,
} from '@mui/material';
import {
  Add as AddIcon,
  Visibility as ViewIcon,
  Edit as EditIcon,
  Delete as DeleteIcon,
  Payment as PaymentIcon,
  Search as SearchIcon,
  AttachMoney as MoneyIcon,
  PendingActions as PendingIcon,
  Warning as WarningIcon,
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
import { collection, query, where, orderBy, doc, deleteDoc } from 'firebase/firestore';
import { COLLECTIONS } from '@vapour/firebase';
import { hasPermission, PERMISSION_FLAGS } from '@vapour/constants';
import type { VendorBill } from '@vapour/types';
import { formatCurrency } from '@/lib/accounting/transactionHelpers';
import { CreateBillDialog } from './components/CreateBillDialog';
import { useFirestoreQuery } from '@/hooks/useFirestoreQuery';

export default function BillsPage() {
  const { claims } = useAuth();
  const [createDialogOpen, setCreateDialogOpen] = useState(false);
  const [editingBill, setEditingBill] = useState<VendorBill | null>(null);
  const [page, setPage] = useState(0);
  const [rowsPerPage, setRowsPerPage] = useState(50);
  const [searchTerm, setSearchTerm] = useState('');
  const [filterStatus, setFilterStatus] = useState<string>('ALL');

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

  // Calculate stats
  const stats = useMemo(() => {
    const totalBilled = bills.reduce((sum, bill) => sum + (bill.totalAmount || 0), 0);
    const outstanding = bills
      .filter((bill) => bill.status !== 'PAID' && bill.status !== 'DRAFT')
      .reduce((sum, bill) => sum + (bill.totalAmount || 0), 0);
    const overdue = bills
      .filter((bill) => bill.status === 'OVERDUE')
      .reduce((sum, bill) => sum + (bill.totalAmount || 0), 0);

    return { totalBilled, outstanding, overdue };
  }, [bills]);

  // Filter logic
  const filteredBills = useMemo(() => {
    return bills.filter((bill) => {
      const matchesSearch =
        searchTerm === '' ||
        bill.transactionNumber.toLowerCase().includes(searchTerm.toLowerCase()) ||
        (bill.entityName && bill.entityName.toLowerCase().includes(searchTerm.toLowerCase()));

      const matchesStatus = filterStatus === 'ALL' || bill.status === filterStatus;

      return matchesSearch && matchesStatus;
    });
  }, [bills, searchTerm, filterStatus]);

  const handleCreate = () => {
    setEditingBill(null);
    setCreateDialogOpen(true);
  };

  const handleEdit = (bill: VendorBill) => {
    setEditingBill(bill);
    setCreateDialogOpen(true);
  };

  const handleDelete = async (billId: string) => {
    if (!confirm('Are you sure you want to delete this bill?')) return;

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
  };

  // Paginate filtered bills
  const paginatedBills = filteredBills.slice(page * rowsPerPage, page * rowsPerPage + rowsPerPage);

  if (loading) {
    return (
      <Container maxWidth="xl" sx={{ py: 4 }}>
        <LoadingState message="Loading bills..." variant="page" />
      </Container>
    );
  }

  return (
    <Container maxWidth="xl" sx={{ py: 4 }}>
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

      {/* Stats Cards */}
      <Grid container spacing={3} sx={{ mb: 4 }}>
        <Grid item xs={12} md={4}>
          <StatCard
            title="Total Billed"
            value={formatCurrency(stats.totalBilled)}
            icon={<MoneyIcon />}
            color="primary"
          />
        </Grid>
        <Grid item xs={12} md={4}>
          <StatCard
            title="Outstanding Amount"
            value={formatCurrency(stats.outstanding)}
            icon={<PendingIcon />}
            color="warning"
          />
        </Grid>
        <Grid item xs={12} md={4}>
          <StatCard
            title="Overdue Amount"
            value={formatCurrency(stats.overdue)}
            icon={<WarningIcon />}
            color="error"
          />
        </Grid>
      </Grid>

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
            <MenuItem value="APPROVED">Approved</MenuItem>
            <MenuItem value="PAID">Paid</MenuItem>
            <MenuItem value="OVERDUE">Overdue</MenuItem>
          </Select>
        </FormControl>
      </FilterBar>

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
                  searchTerm || filterStatus !== 'ALL'
                    ? 'No bills match the selected filters.'
                    : 'No bills found. Record your first vendor bill to get started.'
                }
                variant="table"
                colSpan={10}
                action={
                  canManage && !searchTerm && filterStatus === 'ALL' ? (
                    <Button variant="contained" startIcon={<AddIcon />} onClick={handleCreate}>
                      Record First Bill
                    </Button>
                  ) : undefined
                }
              />
            ) : (
              paginatedBills.map((bill) => (
                <TableRow key={bill.id} hover>
                  <TableCell>{new Date(bill.date).toLocaleDateString()}</TableCell>
                  <TableCell>{bill.transactionNumber}</TableCell>
                  <TableCell>{bill.entityName || '-'}</TableCell>
                  <TableCell>{bill.description || '-'}</TableCell>
                  <TableCell align="right">{formatCurrency(bill.subtotal || 0)}</TableCell>
                  <TableCell align="right">
                    {formatCurrency(bill.gstDetails?.totalGST || 0)}
                  </TableCell>
                  <TableCell align="right">
                    {bill.tdsDeducted ? formatCurrency(bill.tdsAmount || 0) : '-'}
                  </TableCell>
                  <TableCell align="right">{formatCurrency(bill.totalAmount || 0)}</TableCell>
                  <TableCell>
                    <Chip
                      label={bill.status}
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
                          onClick: () => handleEdit(bill),
                        },
                        {
                          icon: <EditIcon />,
                          label: 'Edit Bill',
                          onClick: () => handleEdit(bill),
                          show: canManage && bill.status === 'DRAFT',
                        },
                        {
                          icon: <PaymentIcon />,
                          label: 'Record Payment',
                          onClick: () => {},
                          show: canManage,
                        },
                        {
                          icon: <DeleteIcon />,
                          label: 'Delete Bill',
                          onClick: () => handleDelete(bill.id!),
                          color: 'error',
                          show: canManage,
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
      />
    </Container>
  );
}
