'use client';

/**
 * Service Orders List Page
 *
 * Lists all service orders with status filters, search, and pagination.
 */

import { useState, useEffect, useMemo } from 'react';
import {
  Box,
  Typography,
  TextField,
  FormControl,
  InputLabel,
  Select,
  MenuItem,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Paper,
  Chip,
  TablePagination,
  Button,
  InputAdornment,
  CircularProgress,
  IconButton,
} from '@mui/material';
import {
  Search as SearchIcon,
  ArrowBack as ArrowBackIcon,
  Add as AddIcon,
} from '@mui/icons-material';
import { useRouter } from 'next/navigation';
import { getFirebase } from '@/lib/firebase';
import { SERVICE_ORDER_STATUS_LABELS, SERVICE_ORDER_STATUS_COLORS } from '@vapour/types';
import type { ServiceOrder, ServiceOrderStatus } from '@vapour/types';
import { listServiceOrders } from '@/lib/procurement/serviceOrder';

export default function ServiceOrdersPage() {
  const router = useRouter();
  const { db } = getFirebase();

  const [orders, setOrders] = useState<ServiceOrder[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('');
  const [page, setPage] = useState(0);
  const [rowsPerPage, setRowsPerPage] = useState(25);

  useEffect(() => {
    async function load() {
      if (!db) return;
      setLoading(true);
      try {
        const filters = statusFilter ? { status: statusFilter as ServiceOrderStatus } : undefined;
        const results = await listServiceOrders(db, filters);
        setOrders(results);
      } catch (error) {
        console.error('Error loading service orders:', error);
      } finally {
        setLoading(false);
      }
    }
    load();
  }, [db, statusFilter]);

  const filtered = useMemo(() => {
    if (!search.trim()) return orders;
    const term = search.toLowerCase();
    return orders.filter(
      (o) =>
        o.number.toLowerCase().includes(term) ||
        o.serviceName.toLowerCase().includes(term) ||
        o.vendorName.toLowerCase().includes(term) ||
        (o.poNumber ?? '').toLowerCase().includes(term)
    );
  }, [orders, search]);

  const paginated = filtered.slice(page * rowsPerPage, page * rowsPerPage + rowsPerPage);

  return (
    <Box>
      {/* Header */}
      <Box sx={{ display: 'flex', alignItems: 'center', gap: 2, mb: 3 }}>
        <IconButton onClick={() => router.push('/procurement')}>
          <ArrowBackIcon />
        </IconButton>
        <Box sx={{ flex: 1 }}>
          <Typography variant="h5" component="h1">
            Service Orders
          </Typography>
          <Typography variant="body2" color="text.secondary">
            Track service execution: sample submission, progress, and results
          </Typography>
        </Box>
        <Button
          variant="contained"
          startIcon={<AddIcon />}
          onClick={() => router.push('/procurement/service-orders/new')}
        >
          New Service Order
        </Button>
      </Box>

      {/* Filters */}
      <Box sx={{ display: 'flex', gap: 2, mb: 3, flexWrap: 'wrap' }}>
        <TextField
          placeholder="Search by SO number, service, vendor, PO..."
          value={search}
          onChange={(e) => {
            setSearch(e.target.value);
            setPage(0);
          }}
          size="small"
          sx={{ minWidth: 300, flex: 1 }}
          InputProps={{
            startAdornment: (
              <InputAdornment position="start">
                <SearchIcon />
              </InputAdornment>
            ),
          }}
        />
        <FormControl size="small" sx={{ minWidth: 180 }}>
          <InputLabel>Status</InputLabel>
          <Select
            value={statusFilter}
            label="Status"
            onChange={(e) => {
              setStatusFilter(e.target.value);
              setPage(0);
            }}
          >
            <MenuItem value="">All Statuses</MenuItem>
            {Object.entries(SERVICE_ORDER_STATUS_LABELS).map(([key, label]) => (
              <MenuItem key={key} value={key}>
                {label}
              </MenuItem>
            ))}
          </Select>
        </FormControl>
      </Box>

      {/* Table */}
      {loading ? (
        <Box sx={{ display: 'flex', justifyContent: 'center', py: 6 }}>
          <CircularProgress />
        </Box>
      ) : filtered.length === 0 ? (
        <Paper sx={{ p: 4, textAlign: 'center' }}>
          <Typography color="text.secondary">
            {search ? 'No service orders match your search' : 'No service orders found'}
          </Typography>
        </Paper>
      ) : (
        <Paper>
          <TableContainer>
            <Table size="small">
              <TableHead>
                <TableRow>
                  <TableCell>SO #</TableCell>
                  <TableCell>Service</TableCell>
                  <TableCell>Vendor</TableCell>
                  <TableCell>PO #</TableCell>
                  <TableCell>Project</TableCell>
                  <TableCell>Status</TableCell>
                  <TableCell>Turnaround</TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {paginated.map((order) => (
                  <TableRow
                    key={order.id}
                    hover
                    sx={{ cursor: 'pointer' }}
                    onClick={() => router.push(`/procurement/service-orders/${order.id}`)}
                  >
                    <TableCell>
                      <Typography variant="body2" fontFamily="monospace" fontWeight={500}>
                        {order.number}
                      </Typography>
                    </TableCell>
                    <TableCell>
                      <Typography variant="body2" fontWeight={500}>
                        {order.serviceName}
                      </Typography>
                      {order.serviceCode && (
                        <Typography variant="caption" color="text.secondary">
                          {order.serviceCode}
                        </Typography>
                      )}
                    </TableCell>
                    <TableCell>{order.vendorName}</TableCell>
                    <TableCell>
                      <Typography variant="body2" fontFamily="monospace">
                        {order.poNumber}
                      </Typography>
                    </TableCell>
                    <TableCell>{order.projectName ?? '-'}</TableCell>
                    <TableCell>
                      <Chip
                        label={SERVICE_ORDER_STATUS_LABELS[order.status]}
                        size="small"
                        color={
                          SERVICE_ORDER_STATUS_COLORS[order.status] as
                            | 'default'
                            | 'info'
                            | 'warning'
                            | 'success'
                            | 'error'
                        }
                        variant="outlined"
                      />
                    </TableCell>
                    <TableCell>
                      {order.estimatedTurnaroundDays ? `${order.estimatedTurnaroundDays}d` : '-'}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </TableContainer>
          <TablePagination
            component="div"
            count={filtered.length}
            page={page}
            onPageChange={(_, newPage) => setPage(newPage)}
            rowsPerPage={rowsPerPage}
            onRowsPerPageChange={(e) => {
              setRowsPerPage(parseInt(e.target.value, 10));
              setPage(0);
            }}
            rowsPerPageOptions={[10, 25, 50]}
          />
        </Paper>
      )}
    </Box>
  );
}
