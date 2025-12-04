'use client';

/**
 * Purchase Requests List Page
 *
 * Shows all purchase requests with filters and search
 */

import { useState, useEffect, useMemo } from 'react';
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
  TablePagination,
} from '@mui/material';
import {
  Add as AddIcon,
  Visibility as VisibilityIcon,
  FilterList as FilterListIcon,
  Assignment as AssignmentIcon,
  Edit as EditIcon,
  Send as SendIcon,
  CheckCircle as CheckCircleIcon,
  Cancel as CancelIcon,
  HourglassEmpty as HourglassEmptyIcon,
} from '@mui/icons-material';
import { StatCard } from '@vapour/ui';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/contexts/AuthContext';
import type { PurchaseRequest } from '@vapour/types';
import { listPurchaseRequests } from '@/lib/procurement/purchaseRequestService';
import { formatDate } from '@/lib/utils/formatters';

export default function PurchaseRequestsPage() {
  const router = useRouter();
  const { user } = useAuth();
  const [loading, setLoading] = useState(true);
  const [requests, setRequests] = useState<PurchaseRequest[]>([]);
  const [filteredRequests, setFilteredRequests] = useState<PurchaseRequest[]>([]);

  // Filters
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('ALL');
  const [typeFilter, setTypeFilter] = useState<string>('ALL');
  const [categoryFilter, setCategoryFilter] = useState<string>('ALL');

  // Pagination state
  const [page, setPage] = useState(0);
  const [rowsPerPage, setRowsPerPage] = useState(50);

  // Compute stats from requests
  const stats = useMemo(() => {
    const counts = {
      total: requests.length,
      draft: 0,
      submitted: 0,
      underReview: 0,
      approved: 0,
      rejected: 0,
      pending: 0, // SUBMITTED + UNDER_REVIEW
    };

    requests.forEach((req) => {
      switch (req.status) {
        case 'DRAFT':
          counts.draft++;
          break;
        case 'SUBMITTED':
          counts.submitted++;
          counts.pending++;
          break;
        case 'UNDER_REVIEW':
          counts.underReview++;
          counts.pending++;
          break;
        case 'APPROVED':
          counts.approved++;
          break;
        case 'REJECTED':
          counts.rejected++;
          break;
      }
    });

    return counts;
  }, [requests]);

  useEffect(() => {
    loadRequests();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    applyFilters();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [requests, searchQuery, statusFilter, typeFilter, categoryFilter]);

  const loadRequests = async () => {
    if (!user) return;

    setLoading(true);
    try {
      const data = await listPurchaseRequests({});
      setRequests(data);
    } catch (error) {
      console.error('[PurchaseRequestsPage] Error loading requests:', error);
    } finally {
      setLoading(false);
    }
  };

  const applyFilters = () => {
    let filtered = [...requests];

    // Search filter
    if (searchQuery) {
      const query = searchQuery.toLowerCase();
      filtered = filtered.filter(
        (req) =>
          req.number.toLowerCase().includes(query) ||
          req.projectName?.toLowerCase().includes(query) ||
          req.description?.toLowerCase().includes(query)
      );
    }

    // Status filter
    if (statusFilter !== 'ALL') {
      if (statusFilter === 'PENDING') {
        // Special case: PENDING = SUBMITTED + UNDER_REVIEW
        filtered = filtered.filter(
          (req) => req.status === 'SUBMITTED' || req.status === 'UNDER_REVIEW'
        );
      } else {
        filtered = filtered.filter((req) => req.status === statusFilter);
      }
    }

    // Type filter
    if (typeFilter !== 'ALL') {
      filtered = filtered.filter((req) => req.type === typeFilter);
    }

    // Category filter
    if (categoryFilter !== 'ALL') {
      filtered = filtered.filter((req) => req.category === categoryFilter);
    }

    setFilteredRequests(filtered);
  };

  const getStatusColor = (
    status: string
  ): 'default' | 'primary' | 'secondary' | 'error' | 'info' | 'success' | 'warning' => {
    switch (status) {
      case 'DRAFT':
        return 'default';
      case 'SUBMITTED':
        return 'info';
      case 'APPROVED':
        return 'success';
      case 'REJECTED':
        return 'error';
      case 'RFQ_CREATED':
        return 'primary';
      case 'COMPLETED':
        return 'success';
      default:
        return 'default';
    }
  };

  const getPriorityColor = (
    priority: string
  ): 'default' | 'primary' | 'secondary' | 'error' | 'info' | 'success' | 'warning' => {
    switch (priority) {
      case 'URGENT':
        return 'error';
      case 'HIGH':
        return 'warning';
      case 'MEDIUM':
        return 'info';
      case 'LOW':
        return 'default';
      default:
        return 'default';
    }
  };

  // Pagination handlers
  const handleChangePage = (_event: unknown, newPage: number) => {
    setPage(newPage);
  };

  const handleChangeRowsPerPage = (event: React.ChangeEvent<HTMLInputElement>) => {
    setRowsPerPage(parseInt(event.target.value, 10));
    setPage(0);
  };

  // Paginate requests in memory (client-side pagination)
  const paginatedRequests = filteredRequests.slice(
    page * rowsPerPage,
    page * rowsPerPage + rowsPerPage
  );

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
              Purchase Requests
            </Typography>
            <Typography variant="body2" color="text.secondary">
              Manage and track all purchase requests
            </Typography>
          </Box>
          <Button
            variant="contained"
            startIcon={<AddIcon />}
            onClick={() => router.push('/procurement/purchase-requests/new')}
          >
            New Purchase Request
          </Button>
        </Stack>

        {/* Stats Dashboard */}
        <Box
          sx={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fit, minmax(160px, 1fr))',
            gap: 2,
          }}
        >
          <Box
            onClick={() => setStatusFilter('ALL')}
            sx={{ cursor: 'pointer', '&:hover': { opacity: 0.8 } }}
          >
            <StatCard
              label="Total PRs"
              value={stats.total}
              icon={<AssignmentIcon />}
              color="primary"
            />
          </Box>
          <Box
            onClick={() => setStatusFilter('DRAFT')}
            sx={{ cursor: 'pointer', '&:hover': { opacity: 0.8 } }}
          >
            <StatCard label="Draft" value={stats.draft} icon={<EditIcon />} color="secondary" />
          </Box>
          <Box
            onClick={() => setStatusFilter('SUBMITTED')}
            sx={{ cursor: 'pointer', '&:hover': { opacity: 0.8 } }}
          >
            <StatCard label="Submitted" value={stats.submitted} icon={<SendIcon />} color="info" />
          </Box>
          <Box
            onClick={() => setStatusFilter('APPROVED')}
            sx={{ cursor: 'pointer', '&:hover': { opacity: 0.8 } }}
          >
            <StatCard
              label="Approved"
              value={stats.approved}
              icon={<CheckCircleIcon />}
              color="success"
            />
          </Box>
          <Box
            onClick={() => setStatusFilter('REJECTED')}
            sx={{ cursor: 'pointer', '&:hover': { opacity: 0.8 } }}
          >
            <StatCard label="Rejected" value={stats.rejected} icon={<CancelIcon />} color="error" />
          </Box>
          <Box
            onClick={() => {
              // Filter to show both SUBMITTED and UNDER_REVIEW
              setStatusFilter('PENDING');
            }}
            sx={{ cursor: 'pointer', '&:hover': { opacity: 0.8 } }}
          >
            <StatCard
              label="Pending Approval"
              value={stats.pending}
              icon={<HourglassEmptyIcon />}
              color="warning"
            />
          </Box>
        </Box>

        {/* Filters */}
        <Paper sx={{ p: 3 }}>
          <Stack direction="row" spacing={2} alignItems="center" flexWrap="wrap">
            <TextField
              label="Search"
              placeholder="Search by number, project, or department"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              size="small"
              sx={{ minWidth: 300 }}
            />

            <FormControl size="small" sx={{ minWidth: 150 }}>
              <InputLabel>Status</InputLabel>
              <Select
                value={statusFilter}
                label="Status"
                onChange={(e) => setStatusFilter(e.target.value)}
              >
                <MenuItem value="ALL">All Status</MenuItem>
                <MenuItem value="DRAFT">Draft</MenuItem>
                <MenuItem value="SUBMITTED">Submitted</MenuItem>
                <MenuItem value="PENDING">Pending Approval</MenuItem>
                <MenuItem value="APPROVED">Approved</MenuItem>
                <MenuItem value="REJECTED">Rejected</MenuItem>
                <MenuItem value="RFQ_CREATED">RFQ Created</MenuItem>
                <MenuItem value="COMPLETED">Completed</MenuItem>
              </Select>
            </FormControl>

            <FormControl size="small" sx={{ minWidth: 150 }}>
              <InputLabel>Type</InputLabel>
              <Select
                value={typeFilter}
                label="Type"
                onChange={(e) => setTypeFilter(e.target.value)}
              >
                <MenuItem value="ALL">All Types</MenuItem>
                <MenuItem value="PROJECT">Project</MenuItem>
                <MenuItem value="BUDGETARY">Budgetary</MenuItem>
                <MenuItem value="INTERNAL">Internal</MenuItem>
              </Select>
            </FormControl>

            <FormControl size="small" sx={{ minWidth: 150 }}>
              <InputLabel>Category</InputLabel>
              <Select
                value={categoryFilter}
                label="Category"
                onChange={(e) => setCategoryFilter(e.target.value)}
              >
                <MenuItem value="ALL">All Categories</MenuItem>
                <MenuItem value="SERVICE">Service</MenuItem>
                <MenuItem value="RAW_MATERIAL">Raw Material</MenuItem>
                <MenuItem value="BOUGHT_OUT">Bought Out</MenuItem>
              </Select>
            </FormControl>

            <Button
              startIcon={<FilterListIcon />}
              onClick={() => {
                setSearchQuery('');
                setStatusFilter('ALL');
                setTypeFilter('ALL');
                setCategoryFilter('ALL');
              }}
            >
              Clear Filters
            </Button>
          </Stack>
        </Paper>

        {/* Table */}
        <TableContainer component={Paper}>
          <Table>
            <TableHead>
              <TableRow>
                <TableCell>PR Number</TableCell>
                <TableCell>Project</TableCell>
                <TableCell>Description</TableCell>
                <TableCell>Type</TableCell>
                <TableCell>Category</TableCell>
                <TableCell>Priority</TableCell>
                <TableCell>Status</TableCell>
                <TableCell>Date</TableCell>
                <TableCell align="center">Actions</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {filteredRequests.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={9} align="center" sx={{ py: 4 }}>
                    <Typography variant="body2" color="text.secondary">
                      {requests.length === 0
                        ? 'No purchase requests found. Create your first one!'
                        : 'No requests match the current filters'}
                    </Typography>
                  </TableCell>
                </TableRow>
              ) : (
                paginatedRequests.map((request) => (
                  <TableRow key={request.id} hover>
                    <TableCell>
                      <Typography variant="body2" fontWeight={600}>
                        {request.number}
                      </Typography>
                    </TableCell>
                    <TableCell>{request.projectName || '-'}</TableCell>
                    <TableCell>{request.description || '-'}</TableCell>
                    <TableCell>
                      <Chip label={request.type} size="small" variant="outlined" />
                    </TableCell>
                    <TableCell>
                      <Chip label={request.category} size="small" variant="outlined" />
                    </TableCell>
                    <TableCell>
                      <Chip
                        label={request.priority}
                        size="small"
                        color={getPriorityColor(request.priority)}
                      />
                    </TableCell>
                    <TableCell>
                      <Chip
                        label={request.status.replace('_', ' ')}
                        size="small"
                        color={getStatusColor(request.status)}
                      />
                    </TableCell>
                    <TableCell>{formatDate(request.createdAt)}</TableCell>
                    <TableCell align="center">
                      <IconButton
                        size="small"
                        onClick={() => router.push(`/procurement/purchase-requests/${request.id}`)}
                      >
                        <VisibilityIcon />
                      </IconButton>
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
          <TablePagination
            rowsPerPageOptions={[25, 50, 100]}
            component="div"
            count={filteredRequests.length}
            rowsPerPage={rowsPerPage}
            page={page}
            onPageChange={handleChangePage}
            onRowsPerPageChange={handleChangeRowsPerPage}
          />
        </TableContainer>
      </Stack>
    </Box>
  );
}
