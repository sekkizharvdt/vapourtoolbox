'use client';

/**
 * Goods Receipts Page
 *
 * Display all goods receipts with filters and search
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
} from '@mui/material';
import {
  Add as AddIcon,
  Search as SearchIcon,
  FactCheck as InspectionIcon,
} from '@mui/icons-material';
import type { GoodsReceipt, GoodsReceiptStatus } from '@vapour/types';
import { listGoodsReceipts } from '@/lib/procurement/goodsReceiptService';
import {
  getGRStatusText,
  getGRStatusColor,
  getOverallConditionText,
  getOverallConditionColor,
  filterGRsBySearch,
  calculateGRStats,
} from '@/lib/procurement/goodsReceiptHelpers';
import { formatDate } from '@/lib/utils/formatters';

export default function GoodsReceiptsPage() {
  const router = useRouter();

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [goodsReceipts, setGoodsReceipts] = useState<GoodsReceipt[]>([]);
  const [filteredGRs, setFilteredGRs] = useState<GoodsReceipt[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<GoodsReceiptStatus | 'ALL'>('ALL');

  // Pagination state
  const [page, setPage] = useState(0);
  const [rowsPerPage, setRowsPerPage] = useState(50);

  useEffect(() => {
    loadGoodsReceipts();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [statusFilter]);

  useEffect(() => {
    applyFilters();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [goodsReceipts, searchQuery, statusFilter]);

  const loadGoodsReceipts = async () => {
    setLoading(true);
    setError('');
    try {
      const filters = statusFilter !== 'ALL' ? { status: statusFilter } : {};
      const data = await listGoodsReceipts(filters);
      setGoodsReceipts(data);
    } catch (err) {
      console.error('[GoodsReceiptsPage] Error loading goods receipts:', err);
      setError('Failed to load goods receipts');
    } finally {
      setLoading(false);
    }
  };

  const applyFilters = () => {
    let filtered = [...goodsReceipts];
    filtered = filterGRsBySearch(filtered, searchQuery);
    setFilteredGRs(filtered);
  };

  const handleStatusFilterChange = (event: SelectChangeEvent) => {
    setStatusFilter(event.target.value as GoodsReceiptStatus | 'ALL');
  };

  const stats = calculateGRStats(filteredGRs);

  // Pagination handlers
  const handleChangePage = (_event: unknown, newPage: number) => {
    setPage(newPage);
  };

  const handleChangeRowsPerPage = (event: React.ChangeEvent<HTMLInputElement>) => {
    setRowsPerPage(parseInt(event.target.value, 10));
    setPage(0);
  };

  const paginatedGRs = filteredGRs.slice(page * rowsPerPage, page * rowsPerPage + rowsPerPage);

  return (
    <Box sx={{ p: 3 }}>
      <Stack spacing={3}>
        {/* Header */}
        <Box>
          <Stack direction="row" justifyContent="space-between" alignItems="center">
            <Box>
              <Typography variant="h4" gutterBottom>
                Goods Receipts
              </Typography>
              <Typography variant="body2" color="text.secondary">
                Inspect and receive goods from purchase orders
              </Typography>
            </Box>
            <Button
              variant="contained"
              startIcon={<AddIcon />}
              onClick={() => router.push('/procurement/goods-receipts/new')}
            >
              New Goods Receipt
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
              Pending
            </Typography>
            <Typography variant="h5">{stats.pending}</Typography>
          </Paper>
          <Paper sx={{ p: 2 }} variant="outlined">
            <Typography variant="body2" color="text.secondary">
              In Progress
            </Typography>
            <Typography variant="h5">{stats.inProgress}</Typography>
          </Paper>
          <Paper sx={{ p: 2 }} variant="outlined">
            <Typography variant="body2" color="text.secondary">
              Completed
            </Typography>
            <Typography variant="h5">{stats.completed}</Typography>
          </Paper>
          <Paper sx={{ p: 2 }} variant="outlined">
            <Typography variant="body2" color="text.secondary">
              With Issues
            </Typography>
            <Typography variant="h5" color="error.main">
              {stats.withIssues}
            </Typography>
          </Paper>
          <Paper sx={{ p: 2 }} variant="outlined">
            <Typography variant="body2" color="text.secondary">
              Awaiting Payment
            </Typography>
            <Typography variant="h5" color="warning.main">
              {stats.awaitingPaymentApproval}
            </Typography>
          </Paper>
        </Stack>

        {/* Filters */}
        <Paper sx={{ p: 2 }}>
          <Stack direction={{ xs: 'column', md: 'row' }} spacing={2}>
            <TextField
              placeholder="Search by GR number, PO, or project..."
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
                <MenuItem value="PENDING">Pending</MenuItem>
                <MenuItem value="IN_PROGRESS">In Progress</MenuItem>
                <MenuItem value="COMPLETED">Completed</MenuItem>
                <MenuItem value="ISSUES_FOUND">Issues Found</MenuItem>
              </Select>
            </FormControl>
          </Stack>
        </Paper>

        {/* Goods Receipts Table */}
        <Paper>
          {loading ? (
            <Box sx={{ display: 'flex', justifyContent: 'center', p: 4 }}>
              <CircularProgress />
            </Box>
          ) : filteredGRs.length === 0 ? (
            <Box sx={{ p: 4, textAlign: 'center' }}>
              <InspectionIcon sx={{ fontSize: 48, color: 'text.secondary', mb: 2 }} />
              <Typography variant="body1" color="text.secondary">
                No goods receipts found
              </Typography>
              <Button
                variant="outlined"
                startIcon={<AddIcon />}
                onClick={() => router.push('/procurement/goods-receipts/new')}
                sx={{ mt: 2 }}
              >
                Create Goods Receipt
              </Button>
            </Box>
          ) : (
            <TableContainer>
              <Table>
                <TableHead>
                  <TableRow>
                    <TableCell>GR Number</TableCell>
                    <TableCell>PO Reference</TableCell>
                    <TableCell>Project</TableCell>
                    <TableCell>Status</TableCell>
                    <TableCell>Condition</TableCell>
                    <TableCell>Issues</TableCell>
                    <TableCell>Payment</TableCell>
                    <TableCell>Inspection Date</TableCell>
                  </TableRow>
                </TableHead>
                <TableBody>
                  {paginatedGRs.map((gr) => (
                    <TableRow
                      key={gr.id}
                      hover
                      sx={{ cursor: 'pointer' }}
                      onClick={() => router.push(`/procurement/goods-receipts/${gr.id}`)}
                    >
                      <TableCell>
                        <Typography variant="body2" fontWeight="medium">
                          {gr.number}
                        </Typography>
                      </TableCell>
                      <TableCell>
                        <Typography variant="body2">{gr.poNumber}</Typography>
                      </TableCell>
                      <TableCell>
                        <Typography variant="body2" noWrap sx={{ maxWidth: 150 }}>
                          {gr.projectName}
                        </Typography>
                      </TableCell>
                      <TableCell>
                        <Chip
                          label={getGRStatusText(gr.status)}
                          color={getGRStatusColor(gr.status)}
                          size="small"
                        />
                      </TableCell>
                      <TableCell>
                        <Chip
                          label={getOverallConditionText(gr.overallCondition)}
                          color={getOverallConditionColor(gr.overallCondition)}
                          size="small"
                          variant="outlined"
                        />
                      </TableCell>
                      <TableCell>
                        {gr.hasIssues ? (
                          <Chip label="Issues" color="error" size="small" variant="outlined" />
                        ) : (
                          '-'
                        )}
                      </TableCell>
                      <TableCell>
                        {gr.approvedForPayment ? (
                          <Chip label="Approved" color="success" size="small" variant="outlined" />
                        ) : gr.status === 'COMPLETED' ? (
                          <Chip label="Pending" color="warning" size="small" variant="outlined" />
                        ) : (
                          '-'
                        )}
                      </TableCell>
                      <TableCell>{formatDate(gr.inspectionDate)}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
              <TablePagination
                rowsPerPageOptions={[25, 50, 100]}
                component="div"
                count={filteredGRs.length}
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
