'use client';

/**
 * Packing Lists Page
 *
 * Display all packing lists with filters and search
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
  TablePagination,
  Breadcrumbs,
  Link,
} from '@mui/material';
import {
  Add as AddIcon,
  Search as SearchIcon,
  LocalShipping as ShippingIcon,
  Home as HomeIcon,
} from '@mui/icons-material';
import type { PackingList, PackingListStatus } from '@vapour/types';
import { listPackingLists } from '@/lib/procurement/packingListService';
import {
  getPLStatusText,
  getPLStatusColor,
  getShippingMethodText,
  filterPLsBySearch,
  calculatePLStats,
} from '@/lib/procurement/packingListHelpers';
import { formatDate } from '@/lib/utils/formatters';

export default function PackingListsPage() {
  const router = useRouter();

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [packingLists, setPackingLists] = useState<PackingList[]>([]);
  const [filteredPLs, setFilteredPLs] = useState<PackingList[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<PackingListStatus | 'ALL'>('ALL');

  // Pagination state
  const [page, setPage] = useState(0);
  const [rowsPerPage, setRowsPerPage] = useState(50);

  useEffect(() => {
    loadPackingLists();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [statusFilter]);

  useEffect(() => {
    applyFilters();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [packingLists, searchQuery, statusFilter]);

  const loadPackingLists = async () => {
    setLoading(true);
    setError('');
    try {
      const filters = statusFilter !== 'ALL' ? { status: statusFilter } : {};
      const data = await listPackingLists(filters);
      setPackingLists(data);
    } catch (err) {
      console.error('[PackingListsPage] Error loading packing lists:', err);
      setError('Failed to load packing lists');
    } finally {
      setLoading(false);
    }
  };

  const applyFilters = () => {
    let filtered = [...packingLists];
    filtered = filterPLsBySearch(filtered, searchQuery);
    setFilteredPLs(filtered);
  };

  const handleStatusFilterChange = (event: SelectChangeEvent) => {
    setStatusFilter(event.target.value as PackingListStatus | 'ALL');
  };

  const stats = calculatePLStats(filteredPLs);

  // Pagination handlers
  const handleChangePage = (_event: unknown, newPage: number) => {
    setPage(newPage);
  };

  const handleChangeRowsPerPage = (event: React.ChangeEvent<HTMLInputElement>) => {
    setRowsPerPage(parseInt(event.target.value, 10));
    setPage(0);
  };

  const paginatedPLs = filteredPLs.slice(page * rowsPerPage, page * rowsPerPage + rowsPerPage);

  return (
    <Box sx={{ p: 3 }}>
      <Stack spacing={3}>
        {/* Breadcrumbs */}
        <Breadcrumbs sx={{ mb: 0 }}>
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
          <Typography color="text.primary">Packing Lists</Typography>
        </Breadcrumbs>

        {/* Header */}
        <Box>
          <Stack direction="row" justifyContent="space-between" alignItems="center">
            <Box>
              <Typography variant="h4" gutterBottom>
                Packing Lists
              </Typography>
              <Typography variant="body2" color="text.secondary">
                Manage shipment packing lists and track deliveries
              </Typography>
            </Box>
            <Button
              variant="contained"
              startIcon={<AddIcon />}
              onClick={() => router.push('/procurement/packing-lists/new')}
            >
              New Packing List
            </Button>
          </Stack>
        </Box>

        {error && <Alert severity="error">{error}</Alert>}

        {/* Stats */}
        <Stack
          direction="row"
          spacing={2}
          flexWrap="wrap"
          sx={{ '& > *': { flex: '1 1 calc(16.66% - 12px)', minWidth: 130 } }}
        >
          <Paper sx={{ p: 2 }} variant="outlined">
            <Typography variant="body2" color="text.secondary">
              Total
            </Typography>
            <Typography variant="h5">{stats.total}</Typography>
          </Paper>
          <Paper sx={{ p: 2 }} variant="outlined">
            <Typography variant="body2" color="text.secondary">
              Draft
            </Typography>
            <Typography variant="h5">{stats.draft}</Typography>
          </Paper>
          <Paper sx={{ p: 2 }} variant="outlined">
            <Typography variant="body2" color="text.secondary">
              Finalized
            </Typography>
            <Typography variant="h5">{stats.finalized}</Typography>
          </Paper>
          <Paper sx={{ p: 2 }} variant="outlined">
            <Typography variant="body2" color="text.secondary">
              Shipped
            </Typography>
            <Typography variant="h5">{stats.shipped}</Typography>
          </Paper>
          <Paper sx={{ p: 2 }} variant="outlined">
            <Typography variant="body2" color="text.secondary">
              Delivered
            </Typography>
            <Typography variant="h5">{stats.delivered}</Typography>
          </Paper>
          <Paper sx={{ p: 2 }} variant="outlined">
            <Typography variant="body2" color="text.secondary">
              Total Packages
            </Typography>
            <Typography variant="h5">{stats.totalPackages}</Typography>
          </Paper>
        </Stack>

        {/* Filters */}
        <Paper sx={{ p: 2 }}>
          <Stack direction={{ xs: 'column', md: 'row' }} spacing={2}>
            <TextField
              placeholder="Search by PL number, PO, vendor, or tracking..."
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
                <MenuItem value="FINALIZED">Finalized</MenuItem>
                <MenuItem value="SHIPPED">Shipped</MenuItem>
                <MenuItem value="DELIVERED">Delivered</MenuItem>
              </Select>
            </FormControl>
          </Stack>
        </Paper>

        {/* Packing Lists Table */}
        <Paper>
          {loading ? (
            <Box sx={{ display: 'flex', justifyContent: 'center', p: 4 }}>
              <CircularProgress />
            </Box>
          ) : filteredPLs.length === 0 ? (
            <Box sx={{ p: 4, textAlign: 'center' }}>
              <ShippingIcon sx={{ fontSize: 48, color: 'text.secondary', mb: 2 }} />
              <Typography variant="body1" color="text.secondary">
                No packing lists found
              </Typography>
              <Button
                variant="outlined"
                startIcon={<AddIcon />}
                onClick={() => router.push('/procurement/packing-lists/new')}
                sx={{ mt: 2 }}
              >
                Create Packing List
              </Button>
            </Box>
          ) : (
            <TableContainer>
              <Table>
                <TableHead>
                  <TableRow>
                    <TableCell>PL Number</TableCell>
                    <TableCell>PO Reference</TableCell>
                    <TableCell>Vendor</TableCell>
                    <TableCell>Project</TableCell>
                    <TableCell>Status</TableCell>
                    <TableCell>Packages</TableCell>
                    <TableCell>Shipping</TableCell>
                    <TableCell>Created</TableCell>
                  </TableRow>
                </TableHead>
                <TableBody>
                  {paginatedPLs.map((pl) => (
                    <TableRow
                      key={pl.id}
                      hover
                      sx={{ cursor: 'pointer' }}
                      onClick={() => router.push(`/procurement/packing-lists/${pl.id}`)}
                    >
                      <TableCell>
                        <Typography variant="body2" fontWeight="medium">
                          {pl.number}
                        </Typography>
                        {pl.trackingNumber && (
                          <Typography variant="caption" color="text.secondary">
                            Track: {pl.trackingNumber}
                          </Typography>
                        )}
                      </TableCell>
                      <TableCell>
                        <Typography variant="body2">{pl.poNumber}</Typography>
                      </TableCell>
                      <TableCell>{pl.vendorName}</TableCell>
                      <TableCell>
                        <Typography variant="body2" noWrap sx={{ maxWidth: 150 }}>
                          {pl.projectName}
                        </Typography>
                      </TableCell>
                      <TableCell>
                        <Chip
                          label={getPLStatusText(pl.status)}
                          color={getPLStatusColor(pl.status)}
                          size="small"
                        />
                      </TableCell>
                      <TableCell>{pl.numberOfPackages}</TableCell>
                      <TableCell>
                        <Typography variant="body2">
                          {getShippingMethodText(pl.shippingMethod)}
                        </Typography>
                        {pl.shippingCompany && (
                          <Typography variant="caption" color="text.secondary">
                            {pl.shippingCompany}
                          </Typography>
                        )}
                      </TableCell>
                      <TableCell>{formatDate(pl.createdAt)}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
              <TablePagination
                rowsPerPageOptions={[25, 50, 100]}
                component="div"
                count={filteredPLs.length}
                rowsPerPage={rowsPerPage}
                page={page}
                onPageChange={handleChangePage}
                onRowsPerPageChange={handleChangeRowsPerPage}
              />
            </TableContainer>
          )}
        </Paper>
      </Stack>
    </Box>
  );
}
