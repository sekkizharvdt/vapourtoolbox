'use client';

import { useState, useEffect } from 'react';
import { useParams, useRouter, usePathname } from 'next/navigation';
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
  Divider,
  IconButton,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  TextField,
} from '@mui/material';
import {
  Home as HomeIcon,
  Payments as PaymentsIcon,
  ArrowBack as BackIcon,
  Send as SubmitIcon,
  CheckCircle as ApproveIcon,
  Cancel as RejectIcon,
  PlayArrow as ExecuteIcon,
  Add as AddIcon,
  Delete as DeleteIcon,
  Warning as WarningIcon,
} from '@mui/icons-material';
import { useAuth } from '@/contexts/AuthContext';
import { canViewAccounting, canManageAccounting } from '@vapour/constants';
import { getFirebase } from '@/lib/firebase';
import {
  getPaymentBatch,
  createPaymentBatch,
  submitBatchForApproval,
  approveBatch,
  rejectBatch,
  removeBatchReceipt,
  removeBatchPayment,
  detectCrossProjectPayments,
} from '@/lib/accounting/paymentBatchService';
import type { PaymentBatch, PaymentBatchStatus } from '@vapour/types';
import AddReceiptDialog from '../components/AddReceiptDialog';
import AddPaymentDialog from '../components/AddPaymentDialog';

const STATUS_LABELS: Record<PaymentBatchStatus, string> = {
  DRAFT: 'Draft',
  PENDING_APPROVAL: 'Pending Approval',
  APPROVED: 'Approved',
  EXECUTING: 'Executing',
  COMPLETED: 'Completed',
  REJECTED: 'Rejected',
  CANCELLED: 'Cancelled',
};

const STATUS_COLORS: Record<
  PaymentBatchStatus,
  'default' | 'primary' | 'secondary' | 'success' | 'warning' | 'error' | 'info'
> = {
  DRAFT: 'default',
  PENDING_APPROVAL: 'warning',
  APPROVED: 'info',
  EXECUTING: 'primary',
  COMPLETED: 'success',
  REJECTED: 'error',
  CANCELLED: 'default',
};

export default function PaymentBatchDetailClient() {
  const params = useParams();
  const router = useRouter();
  const pathname = usePathname();
  const { claims, user } = useAuth();

  // Extract ID from pathname for static export compatibility
  const batchId = pathname?.split('/').pop() || (params?.id as string);
  const isNew = batchId === 'new';

  const [batch, setBatch] = useState<PaymentBatch | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Dialog states
  const [receiptDialogOpen, setReceiptDialogOpen] = useState(false);
  const [paymentDialogOpen, setPaymentDialogOpen] = useState(false);
  const [rejectDialogOpen, setRejectDialogOpen] = useState(false);
  const [rejectReason, setRejectReason] = useState('');

  const hasViewAccess = claims?.permissions ? canViewAccounting(claims.permissions) : false;
  const hasManageAccess = claims?.permissions ? canManageAccounting(claims.permissions) : false;
  const isDraft = batch?.status === 'DRAFT';
  const isPending = batch?.status === 'PENDING_APPROVAL';
  const isApproved = batch?.status === 'APPROVED';

  // Cross-project payments detection
  const crossProjectPayments = batch ? detectCrossProjectPayments(batch) : [];

  // Load data
  useEffect(() => {
    if (!hasViewAccess) {
      setLoading(false);
      return;
    }

    // Don't load if using placeholder ID
    if (batchId === 'placeholder') {
      setLoading(false);
      return;
    }

    const loadData = async () => {
      try {
        const { db } = getFirebase();

        if (isNew) {
          // Create a new batch
          if (!hasManageAccess || !user) {
            setError('You do not have permission to create payment batches');
            setLoading(false);
            return;
          }

          // TODO: Add bank account selector before creating
          // For now, create with placeholder
          const newBatch = await createPaymentBatch(
            db,
            {
              bankAccountId: 'primary-bank', // Placeholder
              bankAccountName: 'Primary Bank Account',
            },
            user.uid
          );

          // Redirect to the created batch
          router.replace(`/accounting/payment-batches/${newBatch.id}`);
          return;
        }

        const loadedBatch = await getPaymentBatch(db, batchId);
        if (!loadedBatch) {
          setError('Payment batch not found');
        } else {
          setBatch(loadedBatch);
        }
      } catch (err) {
        console.error('[PaymentBatchDetail] Error loading data:', err);
        setError('Failed to load payment batch');
      } finally {
        setLoading(false);
      }
    };

    loadData();
  }, [hasViewAccess, hasManageAccess, batchId, isNew, user, router]);

  const handleBack = () => {
    router.push('/accounting/payment-batches');
  };

  const handleSubmitForApproval = async () => {
    if (!batch) return;
    setSaving(true);
    setError(null);

    try {
      const { db } = getFirebase();
      await submitBatchForApproval(db, batch.id);
      const updated = await getPaymentBatch(db, batch.id);
      if (updated) setBatch(updated);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to submit batch');
    } finally {
      setSaving(false);
    }
  };

  const handleApprove = async () => {
    if (!batch || !user) return;
    setSaving(true);
    setError(null);

    try {
      const { db } = getFirebase();
      await approveBatch(db, batch.id, user.uid);
      const updated = await getPaymentBatch(db, batch.id);
      if (updated) setBatch(updated);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to approve batch');
    } finally {
      setSaving(false);
    }
  };

  const handleReject = async () => {
    if (!batch || !rejectReason.trim()) return;
    setSaving(true);
    setError(null);

    try {
      const { db } = getFirebase();
      await rejectBatch(db, batch.id, rejectReason);
      const updated = await getPaymentBatch(db, batch.id);
      if (updated) setBatch(updated);
      setRejectDialogOpen(false);
      setRejectReason('');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to reject batch');
    } finally {
      setSaving(false);
    }
  };

  const handleRemoveReceipt = async (receiptId: string) => {
    if (!batch) return;
    setSaving(true);

    try {
      const { db } = getFirebase();
      await removeBatchReceipt(db, batch.id, receiptId);
      const updated = await getPaymentBatch(db, batch.id);
      if (updated) setBatch(updated);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to remove receipt');
    } finally {
      setSaving(false);
    }
  };

  const handleRemovePayment = async (paymentId: string) => {
    if (!batch) return;
    setSaving(true);

    try {
      const { db } = getFirebase();
      await removeBatchPayment(db, batch.id, paymentId);
      const updated = await getPaymentBatch(db, batch.id);
      if (updated) setBatch(updated);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to remove payment');
    } finally {
      setSaving(false);
    }
  };

  const handleReceiptAdded = async () => {
    if (!batch) return;
    const { db } = getFirebase();
    const updated = await getPaymentBatch(db, batch.id);
    if (updated) setBatch(updated);
    setReceiptDialogOpen(false);
  };

  const handlePaymentAdded = async () => {
    if (!batch) return;
    const { db } = getFirebase();
    const updated = await getPaymentBatch(db, batch.id);
    if (updated) setBatch(updated);
    setPaymentDialogOpen(false);
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
        <Alert severity="warning">You do not have permission to view payment batches.</Alert>
      </Box>
    );
  }

  if (loading) {
    return (
      <Box sx={{ p: 3 }}>
        <LinearProgress />
      </Box>
    );
  }

  if (error && !batch) {
    return (
      <Box sx={{ p: 3 }}>
        <Alert severity="error">{error}</Alert>
        <Button startIcon={<BackIcon />} onClick={handleBack} sx={{ mt: 2 }}>
          Back to Batches
        </Button>
      </Box>
    );
  }

  if (!batch) {
    return null;
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
        <Link
          href="/accounting/payment-batches"
          underline="hover"
          color="inherit"
          sx={{ display: 'flex', alignItems: 'center' }}
        >
          <PaymentsIcon sx={{ mr: 0.5 }} fontSize="small" />
          Payment Batches
        </Link>
        <Typography color="text.primary">{batch.batchNumber}</Typography>
      </Breadcrumbs>

      {/* Header */}
      <Box
        sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', mb: 3 }}
      >
        <Box>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
            <Typography variant="h4">{batch.batchNumber}</Typography>
            <Chip label={STATUS_LABELS[batch.status]} color={STATUS_COLORS[batch.status]} />
          </Box>
          <Typography variant="body2" color="text.secondary">
            Created on {formatDate(batch.createdAt)}
            {batch.notes && ` - ${batch.notes}`}
          </Typography>
        </Box>
        <Box sx={{ display: 'flex', gap: 1 }}>
          {isDraft && hasManageAccess && (
            <Button
              variant="contained"
              startIcon={<SubmitIcon />}
              onClick={handleSubmitForApproval}
              disabled={saving || batch.receipts.length === 0 || batch.payments.length === 0}
            >
              Submit for Approval
            </Button>
          )}
          {isPending && hasManageAccess && (
            <>
              <Button
                variant="contained"
                color="success"
                startIcon={<ApproveIcon />}
                onClick={handleApprove}
                disabled={saving}
              >
                Approve
              </Button>
              <Button
                variant="outlined"
                color="error"
                startIcon={<RejectIcon />}
                onClick={() => setRejectDialogOpen(true)}
                disabled={saving}
              >
                Reject
              </Button>
            </>
          )}
          {isApproved && hasManageAccess && (
            <Button
              variant="contained"
              color="primary"
              startIcon={<ExecuteIcon />}
              disabled={saving}
            >
              Execute Payments
            </Button>
          )}
        </Box>
      </Box>

      {error && (
        <Alert severity="error" sx={{ mb: 2 }}>
          {error}
        </Alert>
      )}

      {saving && <LinearProgress sx={{ mb: 2 }} />}

      {/* Summary Cards */}
      <Grid container spacing={2} sx={{ mb: 3 }}>
        <Grid size={{ xs: 12, sm: 4 }}>
          <Card>
            <CardContent>
              <Typography color="text.secondary" gutterBottom>
                Total Receipts
              </Typography>
              <Typography variant="h5" color="success.main">
                {formatCurrency(batch.totalReceiptAmount)}
              </Typography>
              <Typography variant="body2">
                {batch.receipts.length} receipt{batch.receipts.length !== 1 ? 's' : ''}
              </Typography>
            </CardContent>
          </Card>
        </Grid>
        <Grid size={{ xs: 12, sm: 4 }}>
          <Card>
            <CardContent>
              <Typography color="text.secondary" gutterBottom>
                Total Payments
              </Typography>
              <Typography variant="h5" color="error.main">
                {formatCurrency(batch.totalPaymentAmount)}
              </Typography>
              <Typography variant="body2">
                {batch.payments.length} payment{batch.payments.length !== 1 ? 's' : ''}
              </Typography>
            </CardContent>
          </Card>
        </Grid>
        <Grid size={{ xs: 12, sm: 4 }}>
          <Card>
            <CardContent>
              <Typography color="text.secondary" gutterBottom>
                Remaining Balance
              </Typography>
              <Typography
                variant="h5"
                color={batch.remainingBalance >= 0 ? 'success.main' : 'error.main'}
              >
                {formatCurrency(batch.remainingBalance)}
              </Typography>
              <Typography variant="body2">After all payments</Typography>
            </CardContent>
          </Card>
        </Grid>
      </Grid>

      {/* Cross-Project Warning */}
      {crossProjectPayments.length > 0 && (
        <Alert severity="warning" icon={<WarningIcon />} sx={{ mb: 3 }}>
          <Typography variant="subtitle2" gutterBottom>
            Cross-Project Payments Detected
          </Typography>
          <Typography variant="body2">
            The following payments will create interproject loans when executed:
          </Typography>
          <Box component="ul" sx={{ mt: 1, mb: 0, pl: 2 }}>
            {crossProjectPayments.map((cp) => (
              <li key={cp.payment.id}>
                <Typography variant="body2">
                  {cp.payment.entityName} ({formatCurrency(cp.payment.amount)}) - Loan from{' '}
                  <strong>{cp.lendingProjectName}</strong> to{' '}
                  <strong>{cp.borrowingProjectName}</strong>
                </Typography>
              </li>
            ))}
          </Box>
        </Alert>
      )}

      {/* Receipts Section */}
      <Paper sx={{ p: 2, mb: 3 }}>
        <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 2 }}>
          <Typography variant="h6">Receipts (Fund Sources)</Typography>
          {isDraft && hasManageAccess && (
            <Button startIcon={<AddIcon />} onClick={() => setReceiptDialogOpen(true)} size="small">
              Add Receipt
            </Button>
          )}
        </Box>
        <Divider sx={{ mb: 2 }} />
        {batch.receipts.length === 0 ? (
          <Typography color="text.secondary" sx={{ py: 2, textAlign: 'center' }}>
            No receipts added yet. Add receipts to define the fund source.
          </Typography>
        ) : (
          batch.receipts.map((receipt) => (
            <Box
              key={receipt.id}
              sx={{
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
                py: 1,
                borderBottom: '1px solid',
                borderColor: 'divider',
                '&:last-child': { borderBottom: 'none' },
              }}
            >
              <Box>
                <Typography variant="body1" fontWeight="medium">
                  {receipt.description}
                </Typography>
                <Typography variant="body2" color="text.secondary">
                  {receipt.projectName || 'No project'} | {formatDate(receipt.receiptDate)}
                </Typography>
              </Box>
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
                <Typography variant="h6" color="success.main">
                  {formatCurrency(receipt.amount)}
                </Typography>
                {isDraft && hasManageAccess && (
                  <IconButton
                    size="small"
                    color="error"
                    onClick={() => handleRemoveReceipt(receipt.id)}
                  >
                    <DeleteIcon fontSize="small" />
                  </IconButton>
                )}
              </Box>
            </Box>
          ))
        )}
      </Paper>

      {/* Payments Section */}
      <Paper sx={{ p: 2 }}>
        <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 2 }}>
          <Typography variant="h6">Payments (Allocations)</Typography>
          {isDraft && hasManageAccess && (
            <Button startIcon={<AddIcon />} onClick={() => setPaymentDialogOpen(true)} size="small">
              Add Payment
            </Button>
          )}
        </Box>
        <Divider sx={{ mb: 2 }} />
        {batch.payments.length === 0 ? (
          <Typography color="text.secondary" sx={{ py: 2, textAlign: 'center' }}>
            No payments added yet. Add payments to allocate funds.
          </Typography>
        ) : (
          batch.payments.map((payment) => (
            <Box
              key={payment.id}
              sx={{
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
                py: 1,
                borderBottom: '1px solid',
                borderColor: 'divider',
                '&:last-child': { borderBottom: 'none' },
              }}
            >
              <Box>
                <Typography variant="body1" fontWeight="medium">
                  {payment.entityName}
                </Typography>
                <Typography variant="body2" color="text.secondary">
                  {payment.linkedReference || payment.payeeType}
                  {payment.projectName && ` | ${payment.projectName}`}
                  {payment.notes && ` | ${payment.notes}`}
                </Typography>
              </Box>
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
                <Box sx={{ textAlign: 'right' }}>
                  <Typography variant="h6" color="error.main">
                    {formatCurrency(payment.amount)}
                  </Typography>
                  {payment.tdsAmount && (
                    <Typography variant="caption" color="text.secondary">
                      TDS: {formatCurrency(payment.tdsAmount)}
                    </Typography>
                  )}
                </Box>
                {isDraft && hasManageAccess && (
                  <IconButton
                    size="small"
                    color="error"
                    onClick={() => handleRemovePayment(payment.id)}
                  >
                    <DeleteIcon fontSize="small" />
                  </IconButton>
                )}
              </Box>
            </Box>
          ))
        )}
      </Paper>

      {/* Add Receipt Dialog */}
      <AddReceiptDialog
        open={receiptDialogOpen}
        onClose={() => setReceiptDialogOpen(false)}
        batchId={batch.id}
        onAdded={handleReceiptAdded}
      />

      {/* Add Payment Dialog */}
      <AddPaymentDialog
        open={paymentDialogOpen}
        onClose={() => setPaymentDialogOpen(false)}
        batchId={batch.id}
        sourceProjectIds={batch.receipts.filter((r) => r.projectId).map((r) => r.projectId!)}
        onAdded={handlePaymentAdded}
      />

      {/* Reject Dialog */}
      <Dialog open={rejectDialogOpen} onClose={() => setRejectDialogOpen(false)}>
        <DialogTitle>Reject Payment Batch</DialogTitle>
        <DialogContent>
          <Typography variant="body2" sx={{ mb: 2 }}>
            Please provide a reason for rejecting this batch:
          </Typography>
          <TextField
            fullWidth
            multiline
            rows={3}
            value={rejectReason}
            onChange={(e) => setRejectReason(e.target.value)}
            placeholder="Enter rejection reason..."
          />
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setRejectDialogOpen(false)}>Cancel</Button>
          <Button
            variant="contained"
            color="error"
            onClick={handleReject}
            disabled={!rejectReason.trim() || saving}
          >
            Reject
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
}
