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
  Box,
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
  Send as SendIcon,
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
import { collection, query, where, orderBy, doc, deleteDoc, Timestamp } from 'firebase/firestore';
import { COLLECTIONS } from '@vapour/firebase';
import { hasPermission, PERMISSION_FLAGS } from '@vapour/constants';
import type { CustomerInvoice } from '@vapour/types';
import { formatCurrency } from '@/lib/accounting/transactionHelpers';
import { CreateInvoiceDialog } from './components/CreateInvoiceDialog';
import { useFirestoreQuery } from '@/hooks/useFirestoreQuery';

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
  const { claims } = useAuth();
  const [createDialogOpen, setCreateDialogOpen] = useState(false);
  const [editingInvoice, setEditingInvoice] = useState<CustomerInvoice | null>(null);
  const [viewMode, setViewMode] = useState(false);
  const [page, setPage] = useState(0);
  const [rowsPerPage, setRowsPerPage] = useState(50);
  const [searchTerm, setSearchTerm] = useState('');
  const [filterStatus, setFilterStatus] = useState<string>('ALL');

  const canManage = hasPermission(claims?.permissions || 0, PERMISSION_FLAGS.MANAGE_ACCOUNTING);

  // Firestore query using custom hook
  const { db } = getFirebase();
  const invoicesQuery = useMemo(
    () =>
      query(
        collection(db, COLLECTIONS.TRANSACTIONS),
        where('type', '==', 'CUSTOMER_INVOICE'),
        orderBy('deletedAt', 'asc'), // Non-deleted invoices first (null sorts before dates)
        orderBy('date', 'desc')
      ),
    [db]
  );

  const { data: invoices, loading } = useFirestoreQuery<CustomerInvoice>(invoicesQuery);

  // Calculate stats (exclude deleted invoices)
  const stats = useMemo(() => {
    const activeInvoices = invoices.filter((inv) => !(inv as any).deletedAt);
    const totalInvoiced = activeInvoices.reduce((sum, inv) => sum + (inv.totalAmount || 0), 0);
    const outstanding = activeInvoices
      .filter((inv) => inv.status !== 'PAID' && inv.status !== 'DRAFT')
      .reduce((sum, inv) => sum + (inv.totalAmount || 0), 0);
    const overdue = activeInvoices
      .filter((inv) => {
        if (inv.status !== 'UNPAID' || !inv.dueDate) return false;
        const dueDate = toDate(inv.dueDate);
        return dueDate && dueDate < new Date();
      })
      .reduce((sum, inv) => sum + (inv.totalAmount || 0), 0);

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

      return matchesSearch && matchesStatus;
    });
  }, [invoices, searchTerm, filterStatus]);

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
    if (!confirm('Are you sure you want to delete this invoice? It will be moved to the bottom of the list for audit purposes.')) return;

    try {
      const { db } = getFirebase();
      const { updateDoc, Timestamp } = await import('firebase/firestore');
      await updateDoc(doc(db, COLLECTIONS.TRANSACTIONS, invoiceId), {
        deletedAt: Timestamp.now(),
        deletedBy: claims?.uid || 'unknown',
      });
    } catch (error) {
      console.error('[InvoicesPage] Error deleting invoice:', error);
      alert('Failed to delete invoice');
    }
  };

  const handleDialogClose = () => {
    setCreateDialogOpen(false);
    setEditingInvoice(null);
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
  };

  // Paginate filtered invoices
  const paginatedInvoices = filteredInvoices.slice(
    page * rowsPerPage,
    page * rowsPerPage + rowsPerPage
  );

  if (loading) {
    return (
      <Container maxWidth="xl" sx={{ py: 4 }}>
        <LoadingState message="Loading invoices..." variant="page" />
      </Container>
    );
  }

  return (
    <Container maxWidth="xl" sx={{ py: 4 }}>
      <PageHeader
        title="Customer Invoices"
        subtitle="Manage customer invoices and track payments"
        action={
          canManage && (
            <Button variant="contained" startIcon={<AddIcon />} onClick={handleCreate}>
              New Invoice
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
          label="Total Invoiced"
          value={formatCurrency(stats.totalInvoiced)}
          icon={<MoneyIcon />}
          color="primary"
        />
        <StatCard
          label="Outstanding Amount"
          value={formatCurrency(stats.outstanding)}
          icon={<PendingIcon />}
          color="warning"
        />
        <StatCard
          label="Overdue Amount"
          value={formatCurrency(stats.overdue)}
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
            <MenuItem value="SENT">Sent</MenuItem>
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
                const invoiceDate = toDate(invoice.date);
                const isDeleted = !!(invoice as any).deletedAt;

                return (
                  <TableRow
                    key={invoice.id}
                    hover
                    sx={{
                      opacity: isDeleted ? 0.5 : 1,
                      backgroundColor: isDeleted ? 'action.hover' : 'inherit',
                    }}
                  >
                    <TableCell>
                      {invoiceDate
                        ? invoiceDate.toLocaleDateString('en-GB', {
                            day: '2-digit',
                            month: '2-digit',
                            year: 'numeric',
                          })
                        : 'Invalid Date'}
                    </TableCell>
                    <TableCell>{invoice.transactionNumber}</TableCell>
                    <TableCell>{invoice.entityName || '-'}</TableCell>
                    <TableCell>{invoice.description || '-'}</TableCell>
                    <TableCell align="right">{formatCurrency(invoice.subtotal || 0)}</TableCell>
                    <TableCell align="right">
                      {formatCurrency(invoice.gstDetails?.totalGST || invoice.taxAmount || 0)}
                    </TableCell>
                    <TableCell align="right">{formatCurrency(invoice.totalAmount || 0)}</TableCell>
                    <TableCell>
                      <Chip
                        label={invoice.status}
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
                            icon: <SendIcon />,
                            label: 'Send Invoice',
                            onClick: () => {},
                            show: canManage,
                          },
                          {
                            icon: <DeleteIcon />,
                            label: 'Delete Invoice',
                            onClick: () => handleDelete(invoice.id!),
                            color: 'error',
                            show: canManage,
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

      <CreateInvoiceDialog
        open={createDialogOpen}
        onClose={handleDialogClose}
        editingInvoice={editingInvoice}
        viewOnly={viewMode}
      />
    </Container>
  );
}
