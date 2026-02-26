'use client';

/**
 * Purchase Orders List Page
 *
 * Display all purchase orders with filters and search
 */

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import {
  Box,
  Paper,
  Button,
  TextField,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Chip,
  Alert,
  MenuItem,
  Select,
  FormControl,
  InputLabel,
  type SelectChangeEvent,
  TablePagination,
  Grid,
  Typography,
  Breadcrumbs,
  Link,
} from '@mui/material';
import {
  Add as AddIcon,
  Search as SearchIcon,
  Home as HomeIcon,
  Visibility as VisibilityIcon,
  Delete as DeleteIcon,
} from '@mui/icons-material';
import {
  PageHeader,
  LoadingState,
  EmptyState,
  StatCard,
  FilterBar,
  TableActionCell,
} from '@vapour/ui';
import { purchaseOrderListHelp } from '@/lib/help/pageHelpContent';
import type { PurchaseOrder, PurchaseOrderStatus } from '@vapour/types';
import { listPOs } from '@/lib/procurement/purchaseOrderService';
import { useAuth } from '@/contexts/AuthContext';
import { useConfirmDialog } from '@/components/common/ConfirmDialog';
import { getFirebase } from '@/lib/firebase';
import { softDeletePurchaseOrder } from '@/lib/procurement/procurementDeleteService';
import {
  getPOStatusText,
  getPOStatusColor,
  formatCurrency,
  filterPOsBySearch,
  calculatePOStats,
  getDeliveryStatus,
  getPaymentStatus,
} from '@/lib/procurement/purchaseOrderHelpers';
import { formatDate } from '@/lib/utils/formatters';

export default function PurchaseOrdersPage() {
  const router = useRouter();
  const { user, claims } = useAuth();
  const { confirm } = useConfirmDialog();
  const { db } = getFirebase();

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [pos, setPOs] = useState<PurchaseOrder[]>([]);
  const [filteredPOs, setFilteredPOs] = useState<PurchaseOrder[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<PurchaseOrderStatus | 'ALL'>('ALL');

  // Pagination state
  const [page, setPage] = useState(0);
  const [rowsPerPage, setRowsPerPage] = useState(50);

  useEffect(() => {
    loadPOs();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [statusFilter]);

  useEffect(() => {
    applyFilters();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pos, searchQuery, statusFilter]);

  const loadPOs = async () => {
    setLoading(true);
    setError('');
    try {
      const filters = statusFilter !== 'ALL' ? { status: statusFilter } : {};
      const data = await listPOs(filters);
      setPOs(data);
    } catch (err) {
      console.error('[PurchaseOrdersPage] Error loading POs:', err);
      setError('Failed to load purchase orders');
    } finally {
      setLoading(false);
    }
  };

  const handleDelete = async (po: PurchaseOrder) => {
    const confirmed = await confirm({
      title: 'Delete Purchase Order',
      message: `Move "${po.number}" to Trash? You can restore it later from the Trash.`,
      confirmText: 'Move to Trash',
      confirmColor: 'error',
    });
    if (!confirmed) return;

    const result = await softDeletePurchaseOrder(db, {
      id: po.id,
      userId: user?.uid || 'unknown',
      userName: user?.displayName || user?.email || 'Unknown',
      userPermissions: claims?.permissions || 0,
    });
    if (result.success) {
      setPOs((prev) => prev.filter((p) => p.id !== po.id));
    } else {
      alert(result.error || 'Failed to delete purchase order');
    }
  };

  const applyFilters = () => {
    let filtered = [...pos];

    // Apply search
    filtered = filterPOsBySearch(filtered, searchQuery);

    setFilteredPOs(filtered);
  };

  const handleStatusFilterChange = (event: SelectChangeEvent) => {
    setStatusFilter(event.target.value as PurchaseOrderStatus | 'ALL');
  };

  const stats = calculatePOStats(filteredPOs);

  // Pagination handlers
  const handleChangePage = (_event: unknown, newPage: number) => {
    setPage(newPage);
  };

  const handleChangeRowsPerPage = (event: React.ChangeEvent<HTMLInputElement>) => {
    setRowsPerPage(parseInt(event.target.value, 10));
    setPage(0);
  };

  // Paginate POs in memory (client-side pagination)
  const paginatedPOs = filteredPOs.slice(page * rowsPerPage, page * rowsPerPage + rowsPerPage);

  return (
    <>
      <Box sx={{ mb: 4 }}>
        <Breadcrumbs sx={{ mb: 2 }}>
          <Link
            color="inherit"
            href="/procurement"
            onClick={(e: React.MouseEvent) => {
              e.preventDefault();
              router.push('/procurement');
            }}
            sx={{ display: 'flex', alignItems: 'center', cursor: 'pointer' }}
          >
            <HomeIcon sx={{ mr: 0.5 }} fontSize="small" />
            Procurement
          </Link>
          <Typography color="text.primary">Purchase Orders</Typography>
        </Breadcrumbs>

        <PageHeader
          title="Purchase Orders"
          subtitle="Manage purchase orders and track deliveries"
          help={purchaseOrderListHelp}
          action={
            <Button
              variant="contained"
              startIcon={<AddIcon />}
              onClick={() => router.push('/procurement/rfqs')}
            >
              New PO (via RFQ)
            </Button>
          }
        />

        {error && (
          <Alert severity="error" sx={{ mb: 2 }}>
            {error}
          </Alert>
        )}

        {/* Stats Cards */}
        <Grid container spacing={2} sx={{ mb: 3 }}>
          <Grid size={{ xs: 12, sm: 6, md: 2.4 }}>
            <StatCard label="Total POs" value={stats.total} />
          </Grid>
          <Grid size={{ xs: 12, sm: 6, md: 2.4 }}>
            <StatCard label="Pending Approval" value={stats.pendingApproval} color="warning" />
          </Grid>
          <Grid size={{ xs: 12, sm: 6, md: 2.4 }}>
            <StatCard label="Issued" value={stats.issued} color="info" />
          </Grid>
          <Grid size={{ xs: 12, sm: 6, md: 2.4 }}>
            <StatCard label="In Progress" value={stats.inProgress} color="primary" />
          </Grid>
          <Grid size={{ xs: 12, sm: 6, md: 2.4 }}>
            <StatCard label="Total Value" value={formatCurrency(stats.totalValue)} />
          </Grid>
        </Grid>

        {/* Filters */}
        <FilterBar>
          <TextField
            placeholder="Search by PO number, vendor, or offer..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            InputProps={{
              startAdornment: <SearchIcon sx={{ mr: 1, color: 'text.secondary' }} />,
            }}
            sx={{ flexGrow: 1, minWidth: 300 }}
          />
          <FormControl sx={{ minWidth: 200 }}>
            <InputLabel>Status</InputLabel>
            <Select value={statusFilter} onChange={handleStatusFilterChange} label="Status">
              <MenuItem value="ALL">All Statuses</MenuItem>
              <MenuItem value="DRAFT">Draft</MenuItem>
              <MenuItem value="PENDING_APPROVAL">Pending Approval</MenuItem>
              <MenuItem value="APPROVED">Approved</MenuItem>
              <MenuItem value="ISSUED">Issued</MenuItem>
              <MenuItem value="ACKNOWLEDGED">Acknowledged</MenuItem>
              <MenuItem value="IN_PROGRESS">In Progress</MenuItem>
              <MenuItem value="DELIVERED">Delivered</MenuItem>
              <MenuItem value="COMPLETED">Completed</MenuItem>
            </Select>
          </FormControl>
        </FilterBar>

        {/* PO Table */}
        <TableContainer component={Paper}>
          <Table>
            <TableHead>
              <TableRow>
                <TableCell>PO Number</TableCell>
                <TableCell>Vendor</TableCell>
                <TableCell>Status</TableCell>
                <TableCell align="right">Amount</TableCell>
                <TableCell>Delivery</TableCell>
                <TableCell>Payment</TableCell>
                <TableCell>Created</TableCell>
                <TableCell align="right">Actions</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {loading ? (
                <LoadingState message="Loading purchase orders..." variant="table" colSpan={8} />
              ) : filteredPOs.length === 0 ? (
                <EmptyState message="No purchase orders found" variant="table" colSpan={8} />
              ) : (
                paginatedPOs.map((po) => {
                  const deliveryStatus = getDeliveryStatus(po);
                  const paymentStatus = getPaymentStatus(po);

                  return (
                    <TableRow
                      key={po.id}
                      hover
                      sx={{ cursor: 'pointer' }}
                      onClick={() => router.push(`/procurement/pos/${po.id}`)}
                    >
                      <TableCell>
                        <Typography variant="body2" fontWeight="medium">
                          {po.number}
                        </Typography>
                        {po.title && (
                          <Typography variant="caption" color="text.secondary">
                            {po.title}
                          </Typography>
                        )}
                      </TableCell>
                      <TableCell>{po.vendorName}</TableCell>
                      <TableCell>
                        <Chip
                          label={getPOStatusText(po.status)}
                          color={getPOStatusColor(po.status)}
                          size="small"
                        />
                      </TableCell>
                      <TableCell align="right">
                        <Typography variant="body2" fontWeight="medium">
                          {formatCurrency(po.grandTotal, po.currency)}
                        </Typography>
                      </TableCell>
                      <TableCell>
                        <Chip
                          label={deliveryStatus.text}
                          color={deliveryStatus.color}
                          size="small"
                          variant="outlined"
                        />
                      </TableCell>
                      <TableCell>
                        <Chip
                          label={paymentStatus.text}
                          color={paymentStatus.color}
                          size="small"
                          variant="outlined"
                        />
                      </TableCell>
                      <TableCell>{formatDate(po.createdAt)}</TableCell>
                      <TableCell align="right" onClick={(e) => e.stopPropagation()}>
                        <TableActionCell
                          actions={[
                            {
                              icon: <VisibilityIcon fontSize="small" />,
                              label: 'View Details',
                              onClick: () => router.push(`/procurement/pos/${po.id}`),
                            },
                            {
                              icon: <DeleteIcon fontSize="small" />,
                              label: 'Move to Trash',
                              onClick: () => handleDelete(po),
                              show: po.status === 'DRAFT',
                              color: 'error',
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
            count={filteredPOs.length}
            rowsPerPage={rowsPerPage}
            page={page}
            onPageChange={handleChangePage}
            onRowsPerPageChange={handleChangeRowsPerPage}
          />
        </TableContainer>
      </Box>
    </>
  );
}
