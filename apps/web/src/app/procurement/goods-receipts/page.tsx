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
  FormControlLabel,
  Switch,
  IconButton,
  Tooltip,
} from '@mui/material';
import { PageBreadcrumbs } from '@/components/common/PageBreadcrumbs';
import {
  Add as AddIcon,
  Search as SearchIcon,
  FactCheck as InspectionIcon,
  Home as HomeIcon,
  PictureAsPdf as PdfIcon,
  TableChart as CsvIcon,
  Delete as DeleteIcon,
} from '@mui/icons-material';
import type { GoodsReceipt, GoodsReceiptStatus } from '@vapour/types';
import { useAuth } from '@/contexts/AuthContext';
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
import { downloadGRListCSV } from '@/lib/procurement/goodsReceipt/exportGRList';
import { downloadGRListPDF } from '@/lib/procurement/goodsReceipt/grListPDF';
import { softDeleteGoodsReceipt } from '@/lib/procurement/procurementDeleteService';
import { useConfirmDialog } from '@/components/common/ConfirmDialog';
import { useToast } from '@/components/common/Toast';
import { getFirebase } from '@/lib/firebase';

export default function GoodsReceiptsPage() {
  const router = useRouter();
  const { user, claims } = useAuth();
  const { confirm } = useConfirmDialog();
  const { toast } = useToast();
  const { db } = getFirebase();

  const [loading, setLoading] = useState(true);
  const [exportingPDF, setExportingPDF] = useState(false);
  const [error, setError] = useState('');
  const [goodsReceipts, setGoodsReceipts] = useState<GoodsReceipt[]>([]);
  const [filteredGRs, setFilteredGRs] = useState<GoodsReceipt[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<GoodsReceiptStatus | 'ALL'>('ALL');
  // GRN-15: Filter for GRs sent to accounting
  const [sentToAccountingFilter, setSentToAccountingFilter] = useState(false);

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
  }, [goodsReceipts, searchQuery, statusFilter, sentToAccountingFilter]);

  const loadGoodsReceipts = async () => {
    setLoading(true);
    setError('');
    try {
      const filters = {
        ...(claims?.tenantId ? { tenantId: claims.tenantId } : {}),
        ...(statusFilter !== 'ALL' ? { status: statusFilter } : {}),
      };
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
    // GRN-15: Filter for sent to accounting
    if (sentToAccountingFilter) {
      filtered = filtered.filter((gr) => gr.status === 'COMPLETED' && gr.sentToAccountingAt);
    }
    setFilteredGRs(filtered);
  };

  const handleDelete = async (gr: GoodsReceipt) => {
    const confirmed = await confirm({
      title: 'Delete Goods Receipt',
      message: `Move "${gr.number}" to Trash? You can restore it later from the Trash.`,
      confirmText: 'Move to Trash',
      confirmColor: 'error',
    });
    if (!confirmed) return;
    const result = await softDeleteGoodsReceipt(db, {
      id: gr.id,
      userId: user?.uid || 'unknown',
      userName: user?.displayName || user?.email || 'Unknown',
      userPermissions: claims?.permissions || 0,
    });
    if (result.success) {
      setGoodsReceipts((prev) => prev.filter((g) => g.id !== gr.id));
    } else {
      toast.error(result.error || 'Failed to delete goods receipt');
    }
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
        {/* Breadcrumbs */}
        <PageBreadcrumbs
          items={[
            { label: 'Procurement', href: '/procurement', icon: <HomeIcon fontSize="small" /> },
            { label: 'Goods Receipts' },
          ]}
        />

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
            <FormControlLabel
              control={
                <Switch
                  checked={sentToAccountingFilter}
                  onChange={(e) => setSentToAccountingFilter(e.target.checked)}
                  size="small"
                />
              }
              label="Sent to Accounting"
              sx={{ whiteSpace: 'nowrap' }}
            />
            <Box sx={{ flexGrow: 1 }} />
            <Tooltip title="Export CSV">
              <IconButton
                aria-label="Export CSV"
                onClick={() => downloadGRListCSV(filteredGRs)}
                disabled={filteredGRs.length === 0}
              >
                <CsvIcon />
              </IconButton>
            </Tooltip>
            <Tooltip title="Export PDF">
              <IconButton
                aria-label="Export PDF"
                onClick={async () => {
                  setExportingPDF(true);
                  try {
                    await downloadGRListPDF(filteredGRs);
                  } finally {
                    setExportingPDF(false);
                  }
                }}
                disabled={filteredGRs.length === 0 || exportingPDF}
              >
                <PdfIcon />
              </IconButton>
            </Tooltip>
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
                    <TableCell>Payment Status</TableCell>
                    <TableCell>Inspection Date</TableCell>
                    <TableCell align="right">Actions</TableCell>
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
                        {gr.paymentStatus === 'CLEARED' ? (
                          <Chip label="Cleared" color="success" size="small" variant="outlined" />
                        ) : gr.paymentStatus === 'PARTLY_CLEARED' ? (
                          <Chip
                            label="Partly Cleared"
                            color="warning"
                            size="small"
                            variant="outlined"
                          />
                        ) : gr.paymentStatus === 'APPROVED' || gr.approvedForPayment ? (
                          <Chip label="Approved" color="info" size="small" variant="outlined" />
                        ) : gr.paymentRequestId ? (
                          <Chip label="Bill Created" color="info" size="small" variant="outlined" />
                        ) : gr.status === 'COMPLETED' ? (
                          <Chip label="Pending" color="warning" size="small" variant="outlined" />
                        ) : (
                          '-'
                        )}
                      </TableCell>
                      <TableCell>{formatDate(gr.inspectionDate)}</TableCell>
                      <TableCell align="right" onClick={(e) => e.stopPropagation()}>
                        {(['PENDING', 'IN_PROGRESS'] as string[]).includes(gr.status) && (
                          <IconButton
                            size="small"
                            color="error"
                            onClick={() => handleDelete(gr)}
                            title="Move to Trash"
                            aria-label="Move to Trash"
                          >
                            <DeleteIcon />
                          </IconButton>
                        )}
                      </TableCell>
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
