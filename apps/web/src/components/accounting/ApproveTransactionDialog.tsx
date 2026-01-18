'use client';

/**
 * Generic Approve/Reject Transaction Dialog
 *
 * Allows approvers to approve or reject invoices or bills pending their approval.
 * Consolidates ApproveInvoiceDialog and ApproveBillDialog.
 */

import { useState } from 'react';
import {
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Button,
  TextField,
  Box,
  Typography,
  Alert,
  CircularProgress,
  Stack,
  Chip,
} from '@mui/material';
import { Check as ApproveIcon, Close as RejectIcon } from '@mui/icons-material';
import { useAuth } from '@/contexts/AuthContext';
import { getFirebase } from '@/lib/firebase';
import {
  approveTransaction,
  rejectTransaction,
  type ApprovableTransactionType,
  TRANSACTION_CONFIGS,
} from '@/lib/accounting/transactionApprovalService';
import { formatCurrency } from '@/lib/accounting/transactionHelpers';

export interface ApprovableTransaction {
  id?: string;
  transactionNumber?: string;
  vendorInvoiceNumber?: string;
  entityName?: string;
  totalAmount?: number;
  currency?: string;
  description?: string;
}

interface ApproveTransactionDialogProps {
  open: boolean;
  onClose: () => void;
  transaction: ApprovableTransaction | null;
  transactionType: ApprovableTransactionType;
  onSuccess?: () => void;
}

export function ApproveTransactionDialog({
  open,
  onClose,
  transaction,
  transactionType,
  onSuccess,
}: ApproveTransactionDialogProps) {
  const { user } = useAuth();
  const [comments, setComments] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [action, setAction] = useState<'approve' | 'reject' | null>(null);

  const config = TRANSACTION_CONFIGS[transactionType];

  const getDisplayNumber = () => {
    if (transactionType === 'VENDOR_BILL') {
      return transaction?.vendorInvoiceNumber || transaction?.transactionNumber;
    }
    return transaction?.transactionNumber;
  };

  const handleApprove = async () => {
    if (!transaction?.id || !user) return;

    setAction('approve');
    setLoading(true);
    setError('');

    try {
      const { db } = getFirebase();
      const userName = user.displayName || user.email || 'Unknown';

      await approveTransaction(
        db,
        transactionType,
        transaction.id,
        user.uid,
        userName,
        comments || undefined
      );

      // Reset form
      setComments('');
      setAction(null);

      onSuccess?.();
      onClose();
    } catch (err) {
      console.error(`[ApproveTransactionDialog] Error approving:`, err);
      setError(err instanceof Error ? err.message : `Failed to approve ${config.entityLabelLower}`);
    } finally {
      setLoading(false);
    }
  };

  const handleReject = async () => {
    if (!transaction?.id || !user) return;

    if (!comments.trim()) {
      setError('Please provide a reason for rejection');
      return;
    }

    setAction('reject');
    setLoading(true);
    setError('');

    try {
      const { db } = getFirebase();
      const userName = user.displayName || user.email || 'Unknown';

      await rejectTransaction(db, transactionType, transaction.id, user.uid, userName, comments);

      // Reset form
      setComments('');
      setAction(null);

      onSuccess?.();
      onClose();
    } catch (err) {
      console.error(`[ApproveTransactionDialog] Error rejecting:`, err);
      setError(err instanceof Error ? err.message : `Failed to reject ${config.entityLabelLower}`);
    } finally {
      setLoading(false);
    }
  };

  const handleClose = () => {
    if (!loading) {
      setComments('');
      setError('');
      setAction(null);
      onClose();
    }
  };

  if (!transaction) return null;

  return (
    <Dialog open={open} onClose={handleClose} maxWidth="sm" fullWidth>
      <DialogTitle>Review {config.entityLabel}</DialogTitle>
      <DialogContent>
        <Box sx={{ pt: 1 }}>
          {error && (
            <Alert severity="error" sx={{ mb: 2 }}>
              {error}
            </Alert>
          )}

          {/* Transaction Summary */}
          <Box sx={{ mb: 3, p: 2, bgcolor: 'grey.50', borderRadius: 1 }}>
            <Stack direction="row" justifyContent="space-between" alignItems="flex-start">
              <Box>
                <Typography variant="subtitle2" color="text.secondary">
                  {config.entityLabel} Number
                </Typography>
                <Typography variant="h6">{getDisplayNumber()}</Typography>
              </Box>
              <Chip label="Pending Approval" color="warning" size="small" />
            </Stack>

            <Stack direction="row" spacing={4} sx={{ mt: 2 }}>
              <Box>
                <Typography variant="caption" color="text.secondary">
                  {config.counterpartyLabel}
                </Typography>
                <Typography variant="body2">{transaction.entityName || '-'}</Typography>
              </Box>
              <Box>
                <Typography variant="caption" color="text.secondary">
                  Amount
                </Typography>
                <Typography variant="body2" fontWeight="medium">
                  {formatCurrency(transaction.totalAmount || 0, transaction.currency || 'INR')}
                </Typography>
              </Box>
            </Stack>

            {transaction.description && (
              <Box sx={{ mt: 2 }}>
                <Typography variant="caption" color="text.secondary">
                  Description
                </Typography>
                <Typography variant="body2">{transaction.description}</Typography>
              </Box>
            )}
          </Box>

          <TextField
            fullWidth
            label={action === 'reject' ? 'Rejection Reason (Required)' : 'Comments (Optional)'}
            value={comments}
            onChange={(e) => setComments(e.target.value)}
            multiline
            rows={3}
            placeholder={
              action === 'reject'
                ? `Please explain why this ${config.entityLabelLower} is being rejected...`
                : `Add any comments about this approval...`
            }
            disabled={loading}
            required={action === 'reject'}
            error={action === 'reject' && !comments.trim() && !!error}
          />
        </Box>
      </DialogContent>
      <DialogActions sx={{ px: 3, pb: 2 }}>
        <Button onClick={handleClose} disabled={loading}>
          Cancel
        </Button>
        <Button
          onClick={handleReject}
          color="error"
          variant="outlined"
          disabled={loading}
          startIcon={
            loading && action === 'reject' ? <CircularProgress size={20} /> : <RejectIcon />
          }
        >
          {loading && action === 'reject' ? 'Rejecting...' : 'Reject'}
        </Button>
        <Button
          onClick={handleApprove}
          color="success"
          variant="contained"
          disabled={loading}
          startIcon={
            loading && action === 'approve' ? <CircularProgress size={20} /> : <ApproveIcon />
          }
        >
          {loading && action === 'approve' ? 'Approving...' : 'Approve'}
        </Button>
      </DialogActions>
    </Dialog>
  );
}
