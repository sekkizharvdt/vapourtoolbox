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
  Typography,
  Button,
  Stack,
  TextField,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Chip,
  CircularProgress,
  Alert,
  MenuItem,
  Select,
  FormControl,
  InputLabel,
  type SelectChangeEvent,
} from '@mui/material';
import { Add as AddIcon, Search as SearchIcon } from '@mui/icons-material';
import type { PurchaseOrder, PurchaseOrderStatus } from '@vapour/types';
import { listPOs } from '@/lib/procurement/purchaseOrderService';
import {
  getPOStatusText,
  getPOStatusColor,
  formatCurrency,
  filterPOsBySearch,
  calculatePOStats,
  getDeliveryStatus,
  getPaymentStatus,
} from '@/lib/procurement/purchaseOrderHelpers';

export default function PurchaseOrdersPage() {
  const router = useRouter();

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [pos, setPOs] = useState<PurchaseOrder[]>([]);
  const [filteredPOs, setFilteredPOs] = useState<PurchaseOrder[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<PurchaseOrderStatus | 'ALL'>('ALL');

  useEffect(() => {
    loadPOs();
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

  return (
    <Box sx={{ p: 3 }}>
      <Stack spacing={3}>
        {/* Header */}
        <Box>
          <Stack direction="row" justifyContent="space-between" alignItems="center">
            <Box>
              <Typography variant="h4" gutterBottom>
                Purchase Orders
              </Typography>
              <Typography variant="body2" color="text.secondary">
                Manage purchase orders and track deliveries
              </Typography>
            </Box>
            <Button
              variant="contained"
              startIcon={<AddIcon />}
              onClick={() => router.push('/procurement/rfqs')}
            >
              New PO (via RFQ)
            </Button>
          </Stack>
        </Box>

        {error && <Alert severity="error">{error}</Alert>}

        {/* Stats */}
        <Stack
          direction="row"
          spacing={2}
          flexWrap="wrap"
          sx={{ '& > *': { flex: '1 1 calc(20% - 12px)', minWidth: 150 } }}
        >
          <Paper sx={{ p: 2 }} variant="outlined">
            <Typography variant="body2" color="text.secondary">
              Total POs
            </Typography>
            <Typography variant="h5">{stats.total}</Typography>
          </Paper>
          <Paper sx={{ p: 2 }} variant="outlined">
            <Typography variant="body2" color="text.secondary">
              Pending Approval
            </Typography>
            <Typography variant="h5">{stats.pendingApproval}</Typography>
          </Paper>
          <Paper sx={{ p: 2 }} variant="outlined">
            <Typography variant="body2" color="text.secondary">
              Issued
            </Typography>
            <Typography variant="h5">{stats.issued}</Typography>
          </Paper>
          <Paper sx={{ p: 2 }} variant="outlined">
            <Typography variant="body2" color="text.secondary">
              In Progress
            </Typography>
            <Typography variant="h5">{stats.inProgress}</Typography>
          </Paper>
          <Paper sx={{ p: 2 }} variant="outlined">
            <Typography variant="body2" color="text.secondary">
              Total Value
            </Typography>
            <Typography variant="h5">{formatCurrency(stats.totalValue)}</Typography>
          </Paper>
        </Stack>

        {/* Filters */}
        <Paper sx={{ p: 2 }}>
          <Stack direction={{ xs: 'column', md: 'row' }} spacing={2}>
            <TextField
              placeholder="Search by PO number, vendor, or offer..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              InputProps={{
                startAdornment: <SearchIcon sx={{ mr: 1, color: 'text.secondary' }} />,
              }}
              fullWidth
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
          </Stack>
        </Paper>

        {/* PO Table */}
        <Paper>
          {loading ? (
            <Box sx={{ display: 'flex', justifyContent: 'center', p: 4 }}>
              <CircularProgress />
            </Box>
          ) : filteredPOs.length === 0 ? (
            <Box sx={{ p: 4, textAlign: 'center' }}>
              <Typography variant="body1" color="text.secondary">
                No purchase orders found
              </Typography>
            </Box>
          ) : (
            <TableContainer>
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
                  </TableRow>
                </TableHead>
                <TableBody>
                  {filteredPOs.map((po) => {
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
                        <TableCell>{po.createdAt.toDate().toLocaleDateString()}</TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            </TableContainer>
          )}
        </Paper>
      </Stack>
    </Box>
  );
}
