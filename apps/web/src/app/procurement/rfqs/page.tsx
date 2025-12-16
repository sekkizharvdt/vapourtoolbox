'use client';

/**
 * RFQ List Page
 *
 * Shows all RFQs with filters and search
 */

import { useState, useEffect } from 'react';
import {
  Box,
  Paper,
  Button,
  TextField,
  Stack,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Chip,
  MenuItem,
  Select,
  FormControl,
  InputLabel,
  TablePagination,
  Grid,
  Typography,
} from '@mui/material';
import {
  Add as AddIcon,
  Visibility as VisibilityIcon,
  PictureAsPdf as PdfIcon,
} from '@mui/icons-material';
import {
  PageHeader,
  LoadingState,
  EmptyState,
  TableActionCell,
  StatCard,
  FilterBar,
} from '@vapour/ui';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/contexts/AuthContext';
import type { RFQ } from '@vapour/types';
import { listRFQs } from '@/lib/procurement/rfq';
import {
  getRFQStatusText,
  getRFQStatusColor,
  formatDueDate,
  getOfferCompletionPercentage,
  calculateRFQStats,
  filterRFQsBySearch,
  sortRFQs,
} from '@/lib/procurement/rfqHelpers';
import { formatDate } from '@/lib/utils/formatters';

export default function RFQsPage() {
  const router = useRouter();
  const { user } = useAuth();
  const [loading, setLoading] = useState(true);
  const [rfqs, setRfqs] = useState<RFQ[]>([]);
  const [filteredRfqs, setFilteredRfqs] = useState<RFQ[]>([]);

  // Filters
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('ALL');
  const [sortBy, setSortBy] = useState<'number' | 'createdAt' | 'dueDate' | 'status'>('createdAt');
  const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('desc');

  // Pagination state
  const [page, setPage] = useState(0);
  const [rowsPerPage, setRowsPerPage] = useState(50);

  useEffect(() => {
    loadRFQs();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    applyFilters();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [rfqs, searchQuery, statusFilter, sortBy, sortOrder]);

  const loadRFQs = async () => {
    if (!user) return;

    setLoading(true);
    try {
      const data = await listRFQs({});
      setRfqs(data);
    } catch (error) {
      console.error('[RFQsPage] Error loading RFQs:', error);
    } finally {
      setLoading(false);
    }
  };

  const applyFilters = () => {
    let filtered = [...rfqs];

    // Search filter
    filtered = filterRFQsBySearch(filtered, searchQuery);

    // Status filter
    if (statusFilter !== 'ALL') {
      filtered = filtered.filter((rfq) => rfq.status === statusFilter);
    }

    // Sort
    filtered = sortRFQs(filtered, sortBy, sortOrder);

    setFilteredRfqs(filtered);
  };

  const stats = calculateRFQStats(rfqs);

  // Pagination handlers
  const handleChangePage = (_event: unknown, newPage: number) => {
    setPage(newPage);
  };

  const handleChangeRowsPerPage = (event: React.ChangeEvent<HTMLInputElement>) => {
    setRowsPerPage(parseInt(event.target.value, 10));
    setPage(0);
  };

  // Paginate RFQs in memory (client-side pagination)
  const paginatedRfqs = filteredRfqs.slice(page * rowsPerPage, page * rowsPerPage + rowsPerPage);

  return (
    <>
      <Box sx={{ mb: 4 }}>
        <PageHeader
          title="RFQs (Requests for Quotation)"
          subtitle="Manage quotation requests to vendors"
          action={
            <Button
              variant="contained"
              startIcon={<AddIcon />}
              onClick={() => router.push('/procurement/rfqs/new')}
            >
              Create RFQ
            </Button>
          }
        />

        {/* Stats Cards */}
        <Grid container spacing={2} sx={{ mb: 3 }}>
          <Grid size={{ xs: 12, sm: 6, md: 2.4 }}>
            <StatCard label="Total RFQs" value={stats.total} />
          </Grid>
          <Grid size={{ xs: 12, sm: 6, md: 2.4 }}>
            <StatCard label="Draft" value={stats.draft} />
          </Grid>
          <Grid size={{ xs: 12, sm: 6, md: 2.4 }}>
            <StatCard label="Issued" value={stats.issued} color="info" />
          </Grid>
          <Grid size={{ xs: 12, sm: 6, md: 2.4 }}>
            <StatCard label="Under Evaluation" value={stats.underEvaluation} color="warning" />
          </Grid>
          <Grid size={{ xs: 12, sm: 6, md: 2.4 }}>
            <StatCard label="Completed" value={stats.completed} color="success" />
          </Grid>
        </Grid>

        {/* Filters */}
        <FilterBar>
          <TextField
            label="Search RFQs"
            variant="outlined"
            size="small"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            sx={{ flexGrow: 1, minWidth: 300 }}
            placeholder="Search by number, title, vendor..."
          />

          <FormControl size="small" sx={{ minWidth: 150 }}>
            <InputLabel>Status</InputLabel>
            <Select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
              label="Status"
            >
              <MenuItem value="ALL">All Statuses</MenuItem>
              <MenuItem value="DRAFT">Draft</MenuItem>
              <MenuItem value="ISSUED">Issued</MenuItem>
              <MenuItem value="OFFERS_RECEIVED">Offers Received</MenuItem>
              <MenuItem value="UNDER_EVALUATION">Under Evaluation</MenuItem>
              <MenuItem value="COMPLETED">Completed</MenuItem>
              <MenuItem value="CANCELLED">Cancelled</MenuItem>
            </Select>
          </FormControl>

          <FormControl size="small" sx={{ minWidth: 150 }}>
            <InputLabel>Sort By</InputLabel>
            <Select
              value={sortBy}
              onChange={(e) =>
                setSortBy(e.target.value as 'number' | 'createdAt' | 'dueDate' | 'status')
              }
              label="Sort By"
            >
              <MenuItem value="createdAt">Created Date</MenuItem>
              <MenuItem value="dueDate">Due Date</MenuItem>
              <MenuItem value="number">RFQ Number</MenuItem>
              <MenuItem value="status">Status</MenuItem>
            </Select>
          </FormControl>

          <FormControl size="small" sx={{ minWidth: 120 }}>
            <InputLabel>Order</InputLabel>
            <Select
              value={sortOrder}
              onChange={(e) => setSortOrder(e.target.value as 'asc' | 'desc')}
              label="Order"
            >
              <MenuItem value="desc">Descending</MenuItem>
              <MenuItem value="asc">Ascending</MenuItem>
            </Select>
          </FormControl>
        </FilterBar>

        {/* RFQ Table */}
        <TableContainer component={Paper}>
          <Table>
            <TableHead>
              <TableRow>
                <TableCell>RFQ Number</TableCell>
                <TableCell>Title</TableCell>
                <TableCell>Vendors</TableCell>
                <TableCell>Status</TableCell>
                <TableCell>Offers</TableCell>
                <TableCell>Due Date</TableCell>
                <TableCell>Created</TableCell>
                <TableCell align="right">Actions</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {loading ? (
                <LoadingState message="Loading RFQs..." variant="table" colSpan={8} />
              ) : filteredRfqs.length === 0 ? (
                <EmptyState
                  message={
                    searchQuery || statusFilter !== 'ALL'
                      ? 'No RFQs match your filters'
                      : 'No RFQs yet. Create your first RFQ from approved purchase requests.'
                  }
                  variant="table"
                  colSpan={8}
                  action={
                    rfqs.length === 0 ? (
                      <Button
                        variant="contained"
                        startIcon={<AddIcon />}
                        onClick={() => router.push('/procurement/rfqs/new')}
                      >
                        Create RFQ
                      </Button>
                    ) : undefined
                  }
                />
              ) : (
                paginatedRfqs.map((rfq) => {
                  const dueDateInfo = formatDueDate(rfq);
                  const offerCompletion = getOfferCompletionPercentage(rfq);

                  return (
                    <TableRow key={rfq.id} hover>
                      <TableCell>
                        <Typography variant="body2" fontWeight="medium">
                          {rfq.number}
                        </Typography>
                      </TableCell>
                      <TableCell>
                        <Typography variant="body2">{rfq.title}</Typography>
                        {rfq.description && (
                          <Typography variant="caption" color="text.secondary" noWrap>
                            {rfq.description.substring(0, 50)}
                            {rfq.description.length > 50 ? '...' : ''}
                          </Typography>
                        )}
                      </TableCell>
                      <TableCell>
                        <Typography variant="body2">{rfq.vendorIds.length} vendor(s)</Typography>
                        <Typography variant="caption" color="text.secondary">
                          {rfq.vendorNames.slice(0, 2).join(', ')}
                          {rfq.vendorNames.length > 2 ? '...' : ''}
                        </Typography>
                      </TableCell>
                      <TableCell>
                        <Chip
                          label={getRFQStatusText(rfq.status)}
                          color={getRFQStatusColor(rfq.status)}
                          size="small"
                        />
                      </TableCell>
                      <TableCell>
                        <Stack spacing={0.5}>
                          <Typography variant="body2">
                            {rfq.offersReceived} / {rfq.vendorIds.length}
                          </Typography>
                          <Typography variant="caption" color="text.secondary">
                            {offerCompletion}% received
                          </Typography>
                        </Stack>
                      </TableCell>
                      <TableCell>
                        <Typography variant="body2" sx={{ color: dueDateInfo.color }}>
                          {dueDateInfo.text}
                        </Typography>
                      </TableCell>
                      <TableCell>
                        <Typography variant="body2">{formatDate(rfq.createdAt)}</Typography>
                        <Typography variant="caption" color="text.secondary">
                          {rfq.createdByName}
                        </Typography>
                      </TableCell>
                      <TableCell align="right">
                        <TableActionCell
                          actions={[
                            {
                              icon: <VisibilityIcon fontSize="small" />,
                              label: 'View Details',
                              onClick: () => router.push(`/procurement/rfqs/${rfq.id}`),
                            },
                            {
                              icon: <PdfIcon fontSize="small" />,
                              label: 'Download PDF',
                              onClick: () => window.open(rfq.latestPdfUrl, '_blank'),
                              show: !!rfq.latestPdfUrl,
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
            count={filteredRfqs.length}
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
