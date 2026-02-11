'use client';

/**
 * GRN Bills Page
 *
 * Lists completed Goods Receipts that need vendor bills created.
 * Accounting users can create bills directly from this page.
 */

import { useState, useEffect, useMemo } from 'react';
import {
  Box,
  Paper,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  TablePagination,
  TableSortLabel,
  Button,
  Typography,
  Chip,
  CircularProgress,
  Alert,
  Breadcrumbs,
  Link,
  Stack,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  TextField,
  InputAdornment,
} from '@mui/material';
import {
  Home as HomeIcon,
  Receipt as ReceiptIcon,
  CheckCircle as CheckCircleIcon,
  OpenInNew as OpenInNewIcon,
  Search as SearchIcon,
} from '@mui/icons-material';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/contexts/AuthContext';
import { getFirebase } from '@/lib/firebase';
import {
  getGRNsPendingBilling,
  createBillFromGoodsReceipt,
  type GRNPendingBill,
} from '@/lib/procurement/accountingIntegration';
import { formatDate } from '@/lib/utils/formatters';

type SortField = 'grNumber' | 'poNumber' | 'vendor' | 'project' | 'amount' | 'dateSent';
type SortDirection = 'asc' | 'desc';

function getSortValue(item: GRNPendingBill, field: SortField): string | number {
  switch (field) {
    case 'grNumber':
      return item.gr.number || '';
    case 'poNumber':
      return item.gr.poNumber || '';
    case 'vendor':
      return item.vendorName || '';
    case 'project':
      return item.gr.projectName || '';
    case 'amount':
      return item.poTotalAmount || 0;
    case 'dateSent':
      return item.gr.sentToAccountingAt?.seconds ?? 0;
    default:
      return '';
  }
}

export default function GRNBillsPage() {
  const router = useRouter();
  const { user } = useAuth();

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [pendingGRs, setPendingGRs] = useState<GRNPendingBill[]>([]);
  const [creatingBillFor, setCreatingBillFor] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState('');
  const [confirmGR, setConfirmGR] = useState<GRNPendingBill | null>(null);

  // Phase0#10: Sort, filter, and pagination state
  const [searchQuery, setSearchQuery] = useState('');
  const [sortField, setSortField] = useState<SortField>('dateSent');
  const [sortDirection, setSortDirection] = useState<SortDirection>('desc');
  const [page, setPage] = useState(0);
  const [rowsPerPage, setRowsPerPage] = useState(25);

  useEffect(() => {
    loadPendingGRs();
  }, []);

  const loadPendingGRs = async () => {
    setLoading(true);
    setError('');
    try {
      const { db } = getFirebase();
      const grs = await getGRNsPendingBilling(db);
      setPendingGRs(grs);
    } catch (err) {
      console.error('[GRNBillsPage] Error loading pending GRNs:', err);
      setError('Failed to load pending goods receipts');
    } finally {
      setLoading(false);
    }
  };

  // Phase0#10: Filtered and sorted data
  const filteredAndSorted = useMemo(() => {
    let result = pendingGRs;

    // Filter by search query
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      result = result.filter(
        (item) =>
          item.gr.number?.toLowerCase().includes(q) ||
          item.gr.poNumber?.toLowerCase().includes(q) ||
          item.vendorName?.toLowerCase().includes(q) ||
          item.gr.projectName?.toLowerCase().includes(q) ||
          item.gr.accountingAssigneeName?.toLowerCase().includes(q)
      );
    }

    // Sort
    result = [...result].sort((a, b) => {
      const aVal = getSortValue(a, sortField);
      const bVal = getSortValue(b, sortField);
      const cmp =
        typeof aVal === 'number'
          ? aVal - (bVal as number)
          : String(aVal).localeCompare(String(bVal));
      return sortDirection === 'asc' ? cmp : -cmp;
    });

    return result;
  }, [pendingGRs, searchQuery, sortField, sortDirection]);

  const paginatedData = useMemo(
    () => filteredAndSorted.slice(page * rowsPerPage, page * rowsPerPage + rowsPerPage),
    [filteredAndSorted, page, rowsPerPage]
  );

  const handleSort = (field: SortField) => {
    if (sortField === field) {
      setSortDirection((prev) => (prev === 'asc' ? 'desc' : 'asc'));
    } else {
      setSortField(field);
      setSortDirection('asc');
    }
  };

  const handleCreateBill = async (item: GRNPendingBill) => {
    if (!user) return;

    setConfirmGR(null);
    setCreatingBillFor(item.gr.id);
    setError('');
    setSuccessMessage('');
    try {
      const { db } = getFirebase();
      const billId = await createBillFromGoodsReceipt(db, item.gr, user.uid, user.email || '');
      setSuccessMessage(`Bill created successfully for ${item.gr.number} (ID: ${billId})`);
      setPendingGRs((prev) => prev.filter((g) => g.gr.id !== item.gr.id));
    } catch (err) {
      console.error('[GRNBillsPage] Error creating bill:', err);
      const errMsg = err instanceof Error ? err.message : '';
      // AC-23: Provide actionable error with specific account info
      setError(
        `Failed to create bill for ${item.gr.number}. ${errMsg || 'Please verify that Accounts Payable, Purchase, and Tax system accounts are configured in Chart of Accounts.'}`
      );
    } finally {
      setCreatingBillFor(null);
    }
  };

  const formatAmount = (amount: number, currency: string) => {
    return new Intl.NumberFormat('en-IN', {
      style: 'currency',
      currency,
      maximumFractionDigits: 2,
    }).format(amount);
  };

  return (
    <Box sx={{ p: 3 }}>
      <Stack spacing={3}>
        {/* Breadcrumbs */}
        <Breadcrumbs>
          <Link
            color="inherit"
            href="/accounting"
            onClick={(e: React.MouseEvent) => {
              e.preventDefault();
              router.push('/accounting');
            }}
            sx={{ display: 'flex', alignItems: 'center', cursor: 'pointer' }}
          >
            <HomeIcon sx={{ mr: 0.5 }} fontSize="small" />
            Accounting
          </Link>
          <Typography color="text.primary">GRN Bills</Typography>
        </Breadcrumbs>

        {/* Header */}
        <Box>
          <Typography variant="h4" gutterBottom>
            GRN Bills
          </Typography>
          <Typography variant="body2" color="text.secondary">
            Create vendor bills from completed goods receipts sent by the procurement team.
          </Typography>
        </Box>

        {/* Messages */}
        {error && (
          <Alert severity="error" onClose={() => setError('')}>
            {error}
          </Alert>
        )}
        {successMessage && (
          <Alert severity="success" onClose={() => setSuccessMessage('')}>
            {successMessage}
          </Alert>
        )}

        {/* Content */}
        {loading ? (
          <Box sx={{ display: 'flex', justifyContent: 'center', p: 4 }}>
            <CircularProgress />
          </Box>
        ) : pendingGRs.length === 0 ? (
          <Paper sx={{ p: 4, textAlign: 'center' }}>
            <CheckCircleIcon sx={{ fontSize: 48, color: 'success.main', mb: 2 }} />
            <Typography variant="h6" gutterBottom>
              All caught up!
            </Typography>
            <Typography variant="body2" color="text.secondary">
              No pending goods receipts require bill creation.
            </Typography>
          </Paper>
        ) : (
          <Paper>
            {/* Phase0#10: Search filter */}
            <Box sx={{ p: 2, pb: 0 }}>
              <TextField
                size="small"
                placeholder="Search by GR number, PO, vendor, or project..."
                value={searchQuery}
                onChange={(e) => {
                  setSearchQuery(e.target.value);
                  setPage(0);
                }}
                slotProps={{
                  input: {
                    startAdornment: (
                      <InputAdornment position="start">
                        <SearchIcon fontSize="small" />
                      </InputAdornment>
                    ),
                  },
                }}
                sx={{ width: 400 }}
              />
              {searchQuery && (
                <Typography variant="caption" color="text.secondary" sx={{ ml: 2 }}>
                  {filteredAndSorted.length} of {pendingGRs.length} results
                </Typography>
              )}
            </Box>

            <TableContainer>
              <Table>
                <TableHead>
                  <TableRow>
                    <TableCell>
                      <TableSortLabel
                        active={sortField === 'grNumber'}
                        direction={sortField === 'grNumber' ? sortDirection : 'asc'}
                        onClick={() => handleSort('grNumber')}
                      >
                        GR Number
                      </TableSortLabel>
                    </TableCell>
                    <TableCell>
                      <TableSortLabel
                        active={sortField === 'poNumber'}
                        direction={sortField === 'poNumber' ? sortDirection : 'asc'}
                        onClick={() => handleSort('poNumber')}
                      >
                        PO Number
                      </TableSortLabel>
                    </TableCell>
                    <TableCell>
                      <TableSortLabel
                        active={sortField === 'vendor'}
                        direction={sortField === 'vendor' ? sortDirection : 'asc'}
                        onClick={() => handleSort('vendor')}
                      >
                        Vendor
                      </TableSortLabel>
                    </TableCell>
                    <TableCell>
                      <TableSortLabel
                        active={sortField === 'project'}
                        direction={sortField === 'project' ? sortDirection : 'asc'}
                        onClick={() => handleSort('project')}
                      >
                        Project
                      </TableSortLabel>
                    </TableCell>
                    <TableCell align="right">
                      <TableSortLabel
                        active={sortField === 'amount'}
                        direction={sortField === 'amount' ? sortDirection : 'asc'}
                        onClick={() => handleSort('amount')}
                      >
                        PO Amount
                      </TableSortLabel>
                    </TableCell>
                    <TableCell>Condition</TableCell>
                    <TableCell>Assigned To</TableCell>
                    <TableCell>
                      <TableSortLabel
                        active={sortField === 'dateSent'}
                        direction={sortField === 'dateSent' ? sortDirection : 'asc'}
                        onClick={() => handleSort('dateSent')}
                      >
                        Date Sent
                      </TableSortLabel>
                    </TableCell>
                    <TableCell align="right">Actions</TableCell>
                  </TableRow>
                </TableHead>
                <TableBody>
                  {paginatedData.map((item) => (
                    <TableRow key={item.gr.id}>
                      <TableCell>
                        <Link
                          href={`/procurement/goods-receipts/${item.gr.id}`}
                          onClick={(e: React.MouseEvent) => {
                            e.preventDefault();
                            router.push(`/procurement/goods-receipts/${item.gr.id}`);
                          }}
                          sx={{
                            cursor: 'pointer',
                            display: 'flex',
                            alignItems: 'center',
                            gap: 0.5,
                          }}
                        >
                          {item.gr.number}
                          <OpenInNewIcon fontSize="small" sx={{ fontSize: 14 }} />
                        </Link>
                      </TableCell>
                      <TableCell>{item.gr.poNumber}</TableCell>
                      <TableCell>{item.vendorName}</TableCell>
                      <TableCell>{item.gr.projectName}</TableCell>
                      <TableCell align="right">
                        {formatAmount(item.poTotalAmount, item.currency)}
                      </TableCell>
                      <TableCell>
                        <Chip
                          label={item.gr.overallCondition.replace('_', ' ')}
                          color={
                            item.gr.overallCondition === 'ACCEPTED'
                              ? 'success'
                              : item.gr.overallCondition === 'CONDITIONALLY_ACCEPTED'
                                ? 'warning'
                                : 'error'
                          }
                          size="small"
                        />
                      </TableCell>
                      <TableCell>{item.gr.accountingAssigneeName || '—'}</TableCell>
                      <TableCell>{formatDate(item.gr.sentToAccountingAt)}</TableCell>
                      <TableCell align="right">
                        <Button
                          variant="contained"
                          size="small"
                          startIcon={
                            creatingBillFor === item.gr.id ? (
                              <CircularProgress size={16} />
                            ) : (
                              <ReceiptIcon />
                            )
                          }
                          onClick={() => setConfirmGR(item)}
                          disabled={creatingBillFor !== null}
                        >
                          Create Bill
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))}
                  {paginatedData.length === 0 && (
                    <TableRow>
                      <TableCell colSpan={9} align="center" sx={{ py: 4 }}>
                        <Typography variant="body2" color="text.secondary">
                          No results match your search.
                        </Typography>
                      </TableCell>
                    </TableRow>
                  )}
                </TableBody>
              </Table>
            </TableContainer>
            <TablePagination
              component="div"
              count={filteredAndSorted.length}
              page={page}
              onPageChange={(_e, newPage) => setPage(newPage)}
              rowsPerPage={rowsPerPage}
              onRowsPerPageChange={(e) => {
                setRowsPerPage(parseInt(e.target.value, 10));
                setPage(0);
              }}
              rowsPerPageOptions={[10, 25, 50]}
            />
          </Paper>
        )}
      </Stack>

      {/* Confirmation Dialog */}
      <Dialog open={!!confirmGR} onClose={() => setConfirmGR(null)} maxWidth="sm" fullWidth>
        <DialogTitle>Create Vendor Bill</DialogTitle>
        <DialogContent>
          {confirmGR && (
            <Stack spacing={1} sx={{ mt: 1 }}>
              <Typography>This will create a vendor bill with GL entries for:</Typography>
              <Typography variant="body2" color="text.secondary">
                GR: {confirmGR.gr.number} &bull; PO: {confirmGR.gr.poNumber}
              </Typography>
              <Typography variant="body2" color="text.secondary">
                Vendor: {confirmGR.vendorName} &bull; Amount:{' '}
                {formatAmount(confirmGR.poTotalAmount, confirmGR.currency)}
              </Typography>
              <Alert severity="info" sx={{ mt: 1 }}>
                The bill amount will be calculated based on accepted quantities in the goods
                receipt, which may differ from the PO total shown above.
              </Alert>
            </Stack>
          )}
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setConfirmGR(null)}>Cancel</Button>
          <Button
            variant="contained"
            startIcon={<ReceiptIcon />}
            onClick={() => confirmGR && handleCreateBill(confirmGR)}
          >
            Create Bill
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
}
