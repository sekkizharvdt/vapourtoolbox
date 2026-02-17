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
import { listPaymentBatches, getPaymentBatchStats } from '@/lib/accounting/paymentBatchService';
import type { PaymentBatch, PaymentBatchStatus, PaymentBatchStats } from '@vapour/types';
import { formatCurrency } from '@/lib/utils/formatters';
import { getStatusColor } from '@vapour/ui';

const STATUS_LABELS: Record<PaymentBatchStatus, string> = {
  DRAFT: 'Draft',
  PENDING_APPROVAL: 'Pending Approval',
  APPROVED: 'Approved',
  EXECUTING: 'Executing',
  COMPLETED: 'Completed',
  REJECTED: 'Rejected',
  CANCELLED: 'Cancelled',
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
          statusFilter === 'ALL' ? undefined : [statusFilter as PaymentBatchStatus];

        const entityId = claims?.entityId;
        const [batchList, batchStats] = await Promise.all([
          listPaymentBatches(db, {
            entityId,
            status: statusOptions ? statusOptions[0] : undefined,
            orderBy: 'createdAt',
            orderDirection: 'desc',
          }),
          getPaymentBatchStats(db, entityId),
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
  }, [hasViewAccess, statusFilter, claims?.entityId]);

  const handleCreate = () => {
    router.push('/accounting/payment-batches/new');
  };

  const handleRowClick = (batch: PaymentBatch) => {
    router.push(`/accounting/payment-batches/${batch.id}`);
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

      {/* Batches List - Vertical Layout */}
      {batches.length === 0 && !loading ? (
        <Paper sx={{ p: 4, textAlign: 'center' }}>
          <Typography color="text.secondary">
            No payment batches found. Create your first batch to get started.
          </Typography>
        </Paper>
      ) : (
        <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
          {batches.map((batch) => (
            <Paper
              key={batch.id}
              sx={{
                p: 2,
                cursor: 'pointer',
                '&:hover': { bgcolor: 'action.hover' },
                transition: 'background-color 0.2s',
              }}
              onClick={() => handleRowClick(batch)}
            >
              {/* Batch Header */}
              <Box
                sx={{
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'flex-start',
                  mb: 2,
                }}
              >
                <Box>
                  <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                    <Typography variant="h6">{batch.batchNumber}</Typography>
                    <Chip
                      label={STATUS_LABELS[batch.status]}
                      color={getStatusColor(batch.status)}
                      size="small"
                    />
                  </Box>
                  <Typography variant="body2" color="text.secondary">
                    {formatDate(batch.createdAt)}
                    {batch.notes && ` - ${batch.notes}`}
                  </Typography>
                </Box>
                <Box sx={{ textAlign: 'right' }}>
                  <Typography variant="body2" color="text.secondary">
                    Balance
                  </Typography>
                  <Typography
                    variant="h6"
                    color={batch.remainingBalance >= 0 ? 'success.main' : 'error.main'}
                  >
                    {formatCurrency(batch.remainingBalance)}
                  </Typography>
                </Box>
              </Box>

              {/* Two-Column Layout: Receipts & Payments */}
              <Grid container spacing={2}>
                {/* Receipts Column */}
                <Grid size={{ xs: 12, md: 6 }}>
                  <Box
                    sx={{
                      bgcolor: 'success.lighter',
                      borderRadius: 1,
                      p: 1.5,
                      border: '1px solid',
                      borderColor: 'success.light',
                    }}
                  >
                    <Typography
                      variant="subtitle2"
                      color="success.dark"
                      sx={{ mb: 1, display: 'flex', justifyContent: 'space-between' }}
                    >
                      <span>Receipts ({batch.receipts.length})</span>
                      <span>{formatCurrency(batch.totalReceiptAmount)}</span>
                    </Typography>
                    {batch.receipts.length === 0 ? (
                      <Typography
                        variant="body2"
                        color="text.secondary"
                        sx={{ fontStyle: 'italic' }}
                      >
                        No receipts added
                      </Typography>
                    ) : (
                      <Box sx={{ display: 'flex', flexDirection: 'column', gap: 0.5 }}>
                        {batch.receipts.slice(0, 3).map((receipt) => (
                          <Box
                            key={receipt.id}
                            sx={{
                              display: 'flex',
                              justifyContent: 'space-between',
                              alignItems: 'center',
                            }}
                          >
                            <Typography variant="body2" noWrap sx={{ maxWidth: '60%' }}>
                              {receipt.description || receipt.projectName || 'Receipt'}
                            </Typography>
                            <Typography variant="body2" fontWeight="medium" color="success.main">
                              {formatCurrency(receipt.amount)}
                            </Typography>
                          </Box>
                        ))}
                        {batch.receipts.length > 3 && (
                          <Typography variant="caption" color="text.secondary">
                            +{batch.receipts.length - 3} more
                          </Typography>
                        )}
                      </Box>
                    )}
                  </Box>
                </Grid>

                {/* Payments Column */}
                <Grid size={{ xs: 12, md: 6 }}>
                  <Box
                    sx={{
                      bgcolor: 'error.lighter',
                      borderRadius: 1,
                      p: 1.5,
                      border: '1px solid',
                      borderColor: 'error.light',
                    }}
                  >
                    <Typography
                      variant="subtitle2"
                      color="error.dark"
                      sx={{ mb: 1, display: 'flex', justifyContent: 'space-between' }}
                    >
                      <span>Payments ({batch.payments.length})</span>
                      <span>{formatCurrency(batch.totalPaymentAmount)}</span>
                    </Typography>
                    {batch.payments.length === 0 ? (
                      <Typography
                        variant="body2"
                        color="text.secondary"
                        sx={{ fontStyle: 'italic' }}
                      >
                        No payments added
                      </Typography>
                    ) : (
                      <Box sx={{ display: 'flex', flexDirection: 'column', gap: 0.5 }}>
                        {batch.payments.slice(0, 3).map((payment) => (
                          <Box
                            key={payment.id}
                            sx={{
                              display: 'flex',
                              justifyContent: 'space-between',
                              alignItems: 'center',
                            }}
                          >
                            <Typography variant="body2" noWrap sx={{ maxWidth: '60%' }}>
                              {payment.entityName}
                            </Typography>
                            <Typography variant="body2" fontWeight="medium" color="error.main">
                              {formatCurrency(payment.amount)}
                            </Typography>
                          </Box>
                        ))}
                        {batch.payments.length > 3 && (
                          <Typography variant="caption" color="text.secondary">
                            +{batch.payments.length - 3} more
                          </Typography>
                        )}
                      </Box>
                    )}
                  </Box>
                </Grid>
              </Grid>
            </Paper>
          ))}
        </Box>
      )}
    </Box>
  );
}
