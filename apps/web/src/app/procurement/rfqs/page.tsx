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
  Typography,
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
  IconButton,
  MenuItem,
  Select,
  FormControl,
  InputLabel,
  CircularProgress,
  Tooltip,
} from '@mui/material';
import {
  Add as AddIcon,
  Visibility as VisibilityIcon,
  PictureAsPdf as PdfIcon,
  FilterList as FilterListIcon,
} from '@mui/icons-material';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/contexts/AuthContext';
import type { RFQ } from '@vapour/types';
import { listRFQs } from '@/lib/procurement/rfqService';
import {
  getRFQStatusText,
  getRFQStatusColor,
  formatDueDate,
  getOfferCompletionPercentage,
  calculateRFQStats,
  filterRFQsBySearch,
  sortRFQs,
} from '@/lib/procurement/rfqHelpers';

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

  if (loading) {
    return (
      <Box sx={{ display: 'flex', justifyContent: 'center', alignItems: 'center', minHeight: 400 }}>
        <CircularProgress />
      </Box>
    );
  }

  return (
    <Box sx={{ p: 3 }}>
      <Stack spacing={3}>
        {/* Header */}
        <Stack direction="row" justifyContent="space-between" alignItems="center">
          <Box>
            <Typography variant="h4" gutterBottom>
              RFQs (Requests for Quotation)
            </Typography>
            <Typography variant="body2" color="text.secondary">
              Manage quotation requests to vendors
            </Typography>
          </Box>
          <Button
            variant="contained"
            startIcon={<AddIcon />}
            onClick={() => router.push('/procurement/rfqs/new')}
          >
            Create RFQ
          </Button>
        </Stack>

        {/* Stats Cards */}
        <Stack direction={{ xs: 'column', sm: 'row' }} spacing={2}>
          <Paper sx={{ p: 2, flex: 1 }}>
            <Typography variant="body2" color="text.secondary">
              Total RFQs
            </Typography>
            <Typography variant="h4">{stats.total}</Typography>
          </Paper>
          <Paper sx={{ p: 2, flex: 1 }}>
            <Typography variant="body2" color="text.secondary">
              Draft
            </Typography>
            <Typography variant="h4" color="default">
              {stats.draft}
            </Typography>
          </Paper>
          <Paper sx={{ p: 2, flex: 1 }}>
            <Typography variant="body2" color="text.secondary">
              Issued
            </Typography>
            <Typography variant="h4" color="info.main">
              {stats.issued}
            </Typography>
          </Paper>
          <Paper sx={{ p: 2, flex: 1 }}>
            <Typography variant="body2" color="text.secondary">
              Under Evaluation
            </Typography>
            <Typography variant="h4" color="warning.main">
              {stats.underEvaluation}
            </Typography>
          </Paper>
          <Paper sx={{ p: 2, flex: 1 }}>
            <Typography variant="body2" color="text.secondary">
              Completed
            </Typography>
            <Typography variant="h4" color="success.main">
              {stats.completed}
            </Typography>
          </Paper>
        </Stack>

        {/* Filters */}
        <Paper sx={{ p: 2 }}>
          <Stack direction={{ xs: 'column', sm: 'row' }} spacing={2}>
            <TextField
              label="Search RFQs"
              variant="outlined"
              size="small"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              sx={{ flex: 1 }}
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
                onChange={(e) => setSortBy(e.target.value as any)}
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
                onChange={(e) => setSortOrder(e.target.value as any)}
                label="Order"
              >
                <MenuItem value="desc">Descending</MenuItem>
                <MenuItem value="asc">Ascending</MenuItem>
              </Select>
            </FormControl>
          </Stack>
        </Paper>

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
              {filteredRfqs.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={8} align="center" sx={{ py: 4 }}>
                    <Typography variant="body2" color="text.secondary">
                      {searchQuery || statusFilter !== 'ALL'
                        ? 'No RFQs match your filters'
                        : 'No RFQs yet. Create one to get started.'}
                    </Typography>
                  </TableCell>
                </TableRow>
              ) : (
                filteredRfqs.map((rfq) => {
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
                        <Typography variant="body2">
                          {rfq.createdAt.toDate().toLocaleDateString()}
                        </Typography>
                        <Typography variant="caption" color="text.secondary">
                          {rfq.createdByName}
                        </Typography>
                      </TableCell>
                      <TableCell align="right">
                        <Stack direction="row" spacing={1} justifyContent="flex-end">
                          <Tooltip title="View Details">
                            <IconButton
                              size="small"
                              onClick={() => router.push(`/procurement/rfqs/${rfq.id}`)}
                            >
                              <VisibilityIcon fontSize="small" />
                            </IconButton>
                          </Tooltip>
                          {rfq.latestPdfUrl && (
                            <Tooltip title="Download PDF">
                              <IconButton
                                size="small"
                                onClick={() => window.open(rfq.latestPdfUrl, '_blank')}
                              >
                                <PdfIcon fontSize="small" />
                              </IconButton>
                            </Tooltip>
                          )}
                        </Stack>
                      </TableCell>
                    </TableRow>
                  );
                })
              )}
            </TableBody>
          </Table>
        </TableContainer>

        {/* Empty State for New Users */}
        {rfqs.length === 0 && (
          <Paper sx={{ p: 6, textAlign: 'center' }}>
            <FilterListIcon sx={{ fontSize: 60, color: 'text.secondary', mb: 2 }} />
            <Typography variant="h6" gutterBottom>
              No RFQs Yet
            </Typography>
            <Typography variant="body2" color="text.secondary" sx={{ mb: 3 }}>
              Create your first RFQ from approved purchase requests
            </Typography>
            <Button
              variant="contained"
              startIcon={<AddIcon />}
              onClick={() => router.push('/procurement/rfqs/new')}
            >
              Create RFQ
            </Button>
          </Paper>
        )}
      </Stack>
    </Box>
  );
}
