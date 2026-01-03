'use client';

/**
 * PO Amendments List Page
 *
 * List and manage purchase order amendments
 */

import { useState, useEffect, useMemo } from 'react';
import { useRouter } from 'next/navigation';
import {
  Box,
  Paper,
  Typography,
  TextField,
  InputAdornment,
  Button,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  TablePagination,
  Chip,
  Stack,
  CircularProgress,
  Alert,
  Card,
  CardContent,
  FormControl,
  InputLabel,
  Select,
  MenuItem,
  Breadcrumbs,
  Link,
} from '@mui/material';
import {
  Search as SearchIcon,
  Add as AddIcon,
  Edit as EditIcon,
  CheckCircle as CheckCircleIcon,
  HourglassEmpty as HourglassEmptyIcon,
  Cancel as CancelIcon,
  Home as HomeIcon,
} from '@mui/icons-material';
import type { PurchaseOrderAmendment } from '@vapour/types';
import { listAmendments } from '@/lib/procurement/amendment';
import { getFirebase } from '@/lib/firebase';
import {
  filterAmendments,
  filterAmendmentsByStatus,
  calculateAmendmentStats,
  getAmendmentStatusText,
  getAmendmentStatusColor,
  getAmendmentTypeText,
  formatCurrency,
} from '@/lib/procurement/amendmentHelpers';
import { formatDate } from '@/lib/utils/formatters';

type AmendmentStatus = PurchaseOrderAmendment['status'];

export default function AmendmentsListPage() {
  const router = useRouter();

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [amendments, setAmendments] = useState<PurchaseOrderAmendment[]>([]);

  // Filters
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState<AmendmentStatus | 'ALL'>('ALL');

  // Pagination
  const [page, setPage] = useState(0);
  const [rowsPerPage, setRowsPerPage] = useState(10);

  useEffect(() => {
    loadAmendments();
  }, []);

  const loadAmendments = async () => {
    setLoading(true);
    setError('');
    try {
      const { db } = getFirebase();
      const data = await listAmendments(db, {});
      setAmendments(data);
    } catch (err) {
      console.error('[AmendmentsListPage] Error loading amendments:', err);
      setError('Failed to load amendments');
    } finally {
      setLoading(false);
    }
  };

  // Apply filters
  const filteredAmendments = useMemo(() => {
    let result = amendments;
    result = filterAmendmentsByStatus(result, statusFilter);
    result = filterAmendments(result, searchTerm);
    return result;
  }, [amendments, searchTerm, statusFilter]);

  // Calculate stats
  const stats = useMemo(() => calculateAmendmentStats(amendments), [amendments]);

  // Paginate
  const paginatedAmendments = useMemo(() => {
    const start = page * rowsPerPage;
    return filteredAmendments.slice(start, start + rowsPerPage);
  }, [filteredAmendments, page, rowsPerPage]);

  const handleChangePage = (_: unknown, newPage: number) => {
    setPage(newPage);
  };

  const handleChangeRowsPerPage = (event: React.ChangeEvent<HTMLInputElement>) => {
    setRowsPerPage(parseInt(event.target.value, 10));
    setPage(0);
  };

  if (loading) {
    return (
      <Box sx={{ display: 'flex', justifyContent: 'center', p: 4 }}>
        <CircularProgress />
      </Box>
    );
  }

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
          <Typography color="text.primary">PO Amendments</Typography>
        </Breadcrumbs>

        {/* Header */}
        <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <Box>
            <Typography variant="h4" gutterBottom>
              PO Amendments
            </Typography>
            <Typography variant="body2" color="text.secondary">
              Manage amendments to approved purchase orders
            </Typography>
          </Box>
          <Button
            variant="contained"
            startIcon={<AddIcon />}
            onClick={() => router.push('/procurement/amendments/new')}
          >
            New Amendment
          </Button>
        </Box>

        {error && <Alert severity="error">{error}</Alert>}

        {/* Stats */}
        <Box sx={{ display: 'flex', gap: 2, flexWrap: 'wrap' }}>
          <Card sx={{ minWidth: 150 }}>
            <CardContent>
              <Stack direction="row" alignItems="center" spacing={1}>
                <EditIcon color="primary" />
                <Box>
                  <Typography variant="h5">{stats.total}</Typography>
                  <Typography variant="body2" color="text.secondary">
                    Total Amendments
                  </Typography>
                </Box>
              </Stack>
            </CardContent>
          </Card>
          <Card sx={{ minWidth: 150 }}>
            <CardContent>
              <Stack direction="row" alignItems="center" spacing={1}>
                <HourglassEmptyIcon color="warning" />
                <Box>
                  <Typography variant="h5">{stats.pendingApproval}</Typography>
                  <Typography variant="body2" color="text.secondary">
                    Pending Approval
                  </Typography>
                </Box>
              </Stack>
            </CardContent>
          </Card>
          <Card sx={{ minWidth: 150 }}>
            <CardContent>
              <Stack direction="row" alignItems="center" spacing={1}>
                <CheckCircleIcon color="success" />
                <Box>
                  <Typography variant="h5">{stats.approved}</Typography>
                  <Typography variant="body2" color="text.secondary">
                    Approved
                  </Typography>
                </Box>
              </Stack>
            </CardContent>
          </Card>
          <Card sx={{ minWidth: 150 }}>
            <CardContent>
              <Stack direction="row" alignItems="center" spacing={1}>
                <CancelIcon color="error" />
                <Box>
                  <Typography variant="h5">{stats.rejected}</Typography>
                  <Typography variant="body2" color="text.secondary">
                    Rejected
                  </Typography>
                </Box>
              </Stack>
            </CardContent>
          </Card>
        </Box>

        {/* Filters */}
        <Paper sx={{ p: 2 }}>
          <Stack direction={{ xs: 'column', sm: 'row' }} spacing={2}>
            <TextField
              placeholder="Search by PO number, reason, or requester..."
              value={searchTerm}
              onChange={(e) => {
                setSearchTerm(e.target.value);
                setPage(0);
              }}
              sx={{ flex: 1 }}
              InputProps={{
                startAdornment: (
                  <InputAdornment position="start">
                    <SearchIcon />
                  </InputAdornment>
                ),
              }}
            />
            <FormControl sx={{ minWidth: 180 }}>
              <InputLabel>Status</InputLabel>
              <Select
                value={statusFilter}
                label="Status"
                onChange={(e) => {
                  setStatusFilter(e.target.value as AmendmentStatus | 'ALL');
                  setPage(0);
                }}
              >
                <MenuItem value="ALL">All Statuses</MenuItem>
                <MenuItem value="DRAFT">Draft</MenuItem>
                <MenuItem value="PENDING_APPROVAL">Pending Approval</MenuItem>
                <MenuItem value="APPROVED">Approved</MenuItem>
                <MenuItem value="REJECTED">Rejected</MenuItem>
              </Select>
            </FormControl>
          </Stack>
        </Paper>

        {/* Amendments Table */}
        <Paper>
          <TableContainer>
            <Table>
              <TableHead>
                <TableRow>
                  <TableCell>PO Number</TableCell>
                  <TableCell>Amendment #</TableCell>
                  <TableCell>Type</TableCell>
                  <TableCell>Reason</TableCell>
                  <TableCell align="right">Value Change</TableCell>
                  <TableCell>Status</TableCell>
                  <TableCell>Requested By</TableCell>
                  <TableCell>Date</TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {paginatedAmendments.map((amendment) => (
                  <TableRow
                    key={amendment.id}
                    hover
                    sx={{ cursor: 'pointer' }}
                    onClick={() => router.push(`/procurement/amendments/${amendment.id}`)}
                  >
                    <TableCell>
                      <Typography variant="body2" fontWeight="medium">
                        {amendment.purchaseOrderNumber}
                      </Typography>
                    </TableCell>
                    <TableCell>
                      <Chip
                        label={`#${amendment.amendmentNumber}`}
                        size="small"
                        variant="outlined"
                      />
                    </TableCell>
                    <TableCell>
                      <Chip label={getAmendmentTypeText(amendment.amendmentType)} size="small" />
                    </TableCell>
                    <TableCell>
                      <Typography variant="body2" noWrap sx={{ maxWidth: 200 }}>
                        {amendment.reason}
                      </Typography>
                    </TableCell>
                    <TableCell align="right">
                      <Typography
                        variant="body2"
                        color={amendment.totalChange >= 0 ? 'success.main' : 'error.main'}
                      >
                        {amendment.totalChange >= 0 ? '+' : ''}
                        {formatCurrency(amendment.totalChange)}
                      </Typography>
                    </TableCell>
                    <TableCell>
                      <Chip
                        label={getAmendmentStatusText(amendment.status)}
                        color={getAmendmentStatusColor(amendment.status)}
                        size="small"
                      />
                    </TableCell>
                    <TableCell>{amendment.requestedByName}</TableCell>
                    <TableCell>{formatDate(amendment.amendmentDate)}</TableCell>
                  </TableRow>
                ))}
                {paginatedAmendments.length === 0 && (
                  <TableRow>
                    <TableCell colSpan={8} align="center">
                      <Typography color="text.secondary" sx={{ py: 4 }}>
                        {searchTerm || statusFilter !== 'ALL'
                          ? 'No amendments found with current filters'
                          : 'No amendments found'}
                      </Typography>
                    </TableCell>
                  </TableRow>
                )}
              </TableBody>
            </Table>
          </TableContainer>
          <TablePagination
            component="div"
            count={filteredAmendments.length}
            page={page}
            onPageChange={handleChangePage}
            rowsPerPage={rowsPerPage}
            onRowsPerPageChange={handleChangeRowsPerPage}
            rowsPerPageOptions={[5, 10, 25, 50]}
          />
        </Paper>
      </Stack>
    </Box>
  );
}
