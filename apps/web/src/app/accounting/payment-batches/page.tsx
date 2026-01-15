'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import {
  Typography,
  Box,
  Button,
  Alert,
  Chip,
  LinearProgress,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Paper,
  Breadcrumbs,
  Link,
  Card,
  CardContent,
  Grid,
  ToggleButton,
  ToggleButtonGroup,
} from '@mui/material';
import {
  Add as AddIcon,
  Home as HomeIcon,
  Payments as PaymentsIcon,
  CheckCircle as ApprovedIcon,
  HourglassEmpty as PendingIcon,
  Edit as DraftIcon,
} from '@mui/icons-material';
import { useAuth } from '@/contexts/AuthContext';
import { canViewAccounting, canManageAccounting } from '@vapour/constants';
import { getFirebase } from '@/lib/firebase';
import {
  listPaymentBatches,
  getPaymentBatchStats,
} from '@/lib/accounting/paymentBatchService';
import type { PaymentBatch, PaymentBatchStatus, PaymentBatchStats } from '@vapour/types';

const STATUS_LABELS: Record<PaymentBatchStatus, string> = {
  DRAFT: 'Draft',
  PENDING_APPROVAL: 'Pending Approval',
  APPROVED: 'Approved',
  EXECUTING: 'Executing',
  COMPLETED: 'Completed',
  REJECTED: 'Rejected',
  CANCELLED: 'Cancelled',
};

const STATUS_COLORS: Record<PaymentBatchStatus, 'default' | 'primary' | 'secondary' | 'success' | 'warning' | 'error' | 'info'> = {
  DRAFT: 'default',
  PENDING_APPROVAL: 'warning',
  APPROVED: 'info',
  EXECUTING: 'primary',
  COMPLETED: 'success',
  REJECTED: 'error',
  CANCELLED: 'default',
};

type FilterStatus = 'ALL' | 'DRAFT' | 'PENDING_APPROVAL' | 'APPROVED' | 'COMPLETED';

export default function PaymentBatchesPage() {
  const router = useRouter();
  const { claims } = useAuth();
  const [batches, setBatches] = useState<PaymentBatch[]>([]);
  const [stats, setStats] = useState<PaymentBatchStats | null>(null);
  const [loading, setLoading] = useState(true);
  const [statusFilter, setStatusFilter] = useState<FilterStatus>('ALL');

  const hasViewAccess = claims?.permissions ? canViewAccounting(claims.permissions) : false;
  const hasManageAccess = claims?.permissions ? canManageAccounting(claims.permissions) : false;

  // Load data
  useEffect(() => {
    if (!hasViewAccess) {
      setLoading(false);
      return;
    }

    const loadData = async () => {
      try {
        const { db } = getFirebase();

        // Determine status filter
        const statusOptions: PaymentBatchStatus[] | undefined =
          statusFilter === 'ALL'
            ? undefined
            : [statusFilter as PaymentBatchStatus];

        const [batchList, batchStats] = await Promise.all([
          listPaymentBatches(db, {
            status: statusOptions ? statusOptions[0] : undefined,
            orderBy: 'createdAt',
            orderDirection: 'desc',
          }),
          getPaymentBatchStats(db),
        ]);

        setBatches(batchList);
        setStats(batchStats);
      } catch (error) {
        console.error('[PaymentBatches] Error loading data:', error);
      } finally {
        setLoading(false);
      }
    };

    loadData();
  }, [hasViewAccess, statusFilter]);

  const handleCreate = () => {
    router.push('/accounting/payment-batches/new');
  };

  const handleRowClick = (batch: PaymentBatch) => {
    router.push(`/accounting/payment-batches/${batch.id}`);
  };

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('en-IN', {
      style: 'currency',
      currency: 'INR',
      maximumFractionDigits: 0,
    }).format(amount);
  };

  const formatDate = (date: Date | string | undefined) => {
    if (!date) return '-';
    const d = typeof date === 'string' ? new Date(date) : date;
    return d.toLocaleDateString('en-IN', {
      day: '2-digit',
      month: 'short',
      year: 'numeric',
    });
  };

  // Access control
  if (!hasViewAccess) {
    return (
      <Box sx={{ p: 3 }}>
        <Alert severity="warning">
          You do not have permission to view payment batches. Please contact your administrator.
        </Alert>
      </Box>
    );
  }

  return (
    <Box sx={{ p: 3 }}>
      {/* Breadcrumbs */}
      <Breadcrumbs sx={{ mb: 2 }}>
        <Link
          href="/accounting"
          underline="hover"
          color="inherit"
          sx={{ display: 'flex', alignItems: 'center' }}
        >
          <HomeIcon sx={{ mr: 0.5 }} fontSize="small" />
          Accounting
        </Link>
        <Typography color="text.primary" sx={{ display: 'flex', alignItems: 'center' }}>
          <PaymentsIcon sx={{ mr: 0.5 }} fontSize="small" />
          Payment Batches
        </Typography>
      </Breadcrumbs>

      {/* Header */}
      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 3 }}>
        <Typography variant="h4">Payment Batches</Typography>
        {hasManageAccess && (
          <Button variant="contained" startIcon={<AddIcon />} onClick={handleCreate}>
            New Batch
          </Button>
        )}
      </Box>

      {loading && <LinearProgress sx={{ mb: 2 }} />}

      {/* Summary Cards */}
      {stats && (
        <Grid container spacing={2} sx={{ mb: 3 }}>
          <Grid size={{ xs: 12, sm: 6, md: 3 }}>
            <Card>
              <CardContent>
                <Typography color="text.secondary" gutterBottom>
                  Pending Approval
                </Typography>
                <Typography variant="h5">{stats.byStatus.PENDING_APPROVAL}</Typography>
                <Typography variant="body2" color="warning.main">
                  {formatCurrency(stats.pendingApprovalAmount)}
                </Typography>
              </CardContent>
            </Card>
          </Grid>
          <Grid size={{ xs: 12, sm: 6, md: 3 }}>
            <Card>
              <CardContent>
                <Typography color="text.secondary" gutterBottom>
                  Ready to Execute
                </Typography>
                <Typography variant="h5">{stats.byStatus.APPROVED}</Typography>
                <Typography variant="body2" color="info.main">
                  {formatCurrency(stats.approvedAmount)}
                </Typography>
              </CardContent>
            </Card>
          </Grid>
          <Grid size={{ xs: 12, sm: 6, md: 3 }}>
            <Card>
              <CardContent>
                <Typography color="text.secondary" gutterBottom>
                  Completed This Month
                </Typography>
                <Typography variant="h5">{stats.completedThisMonth}</Typography>
                <Typography variant="body2" color="success.main">
                  {formatCurrency(stats.paidThisMonthAmount)}
                </Typography>
              </CardContent>
            </Card>
          </Grid>
          <Grid size={{ xs: 12, sm: 6, md: 3 }}>
            <Card>
              <CardContent>
                <Typography color="text.secondary" gutterBottom>
                  Drafts
                </Typography>
                <Typography variant="h5">{stats.byStatus.DRAFT}</Typography>
                <Typography variant="body2" color="text.secondary">
                  In progress
                </Typography>
              </CardContent>
            </Card>
          </Grid>
        </Grid>
      )}

      {/* Filter Tabs */}
      <Box sx={{ mb: 2 }}>
        <ToggleButtonGroup
          value={statusFilter}
          exclusive
          onChange={(_, value) => value && setStatusFilter(value)}
          size="small"
        >
          <ToggleButton value="ALL">All</ToggleButton>
          <ToggleButton value="DRAFT">
            <DraftIcon fontSize="small" sx={{ mr: 0.5 }} />
            Draft
          </ToggleButton>
          <ToggleButton value="PENDING_APPROVAL">
            <PendingIcon fontSize="small" sx={{ mr: 0.5 }} />
            Pending
          </ToggleButton>
          <ToggleButton value="APPROVED">
            <ApprovedIcon fontSize="small" sx={{ mr: 0.5 }} />
            Approved
          </ToggleButton>
          <ToggleButton value="COMPLETED">
            <ApprovedIcon fontSize="small" sx={{ mr: 0.5 }} />
            Completed
          </ToggleButton>
        </ToggleButtonGroup>
      </Box>

      {/* Batches Table */}
      <TableContainer component={Paper}>
        <Table>
          <TableHead>
            <TableRow>
              <TableCell>Batch Number</TableCell>
              <TableCell>Date</TableCell>
              <TableCell>Receipts</TableCell>
              <TableCell>Payments</TableCell>
              <TableCell align="right">Total Amount</TableCell>
              <TableCell align="right">Balance</TableCell>
              <TableCell>Status</TableCell>
            </TableRow>
          </TableHead>
          <TableBody>
            {batches.length === 0 && !loading ? (
              <TableRow>
                <TableCell colSpan={7} align="center">
                  <Typography color="text.secondary" sx={{ py: 4 }}>
                    No payment batches found. Create your first batch to get started.
                  </Typography>
                </TableCell>
              </TableRow>
            ) : (
              batches.map((batch) => (
                <TableRow
                  key={batch.id}
                  hover
                  sx={{ cursor: 'pointer' }}
                  onClick={() => handleRowClick(batch)}
                >
                  <TableCell>
                    <Typography variant="body2" fontWeight="medium">
                      {batch.batchNumber}
                    </Typography>
                    {batch.notes && (
                      <Typography variant="caption" color="text.secondary" sx={{ display: 'block' }}>
                        {batch.notes.length > 40 ? `${batch.notes.substring(0, 40)}...` : batch.notes}
                      </Typography>
                    )}
                  </TableCell>
                  <TableCell>{formatDate(batch.createdAt)}</TableCell>
                  <TableCell>
                    {batch.receipts.length} receipt{batch.receipts.length !== 1 ? 's' : ''}
                  </TableCell>
                  <TableCell>
                    {batch.payments.length} payment{batch.payments.length !== 1 ? 's' : ''}
                  </TableCell>
                  <TableCell align="right">
                    <Typography fontWeight="medium">
                      {formatCurrency(batch.totalPaymentAmount)}
                    </Typography>
                  </TableCell>
                  <TableCell align="right">
                    <Typography
                      color={batch.remainingBalance >= 0 ? 'success.main' : 'error.main'}
                    >
                      {formatCurrency(batch.remainingBalance)}
                    </Typography>
                  </TableCell>
                  <TableCell>
                    <Chip
                      label={STATUS_LABELS[batch.status]}
                      color={STATUS_COLORS[batch.status]}
                      size="small"
                    />
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </TableContainer>
    </Box>
  );
}
