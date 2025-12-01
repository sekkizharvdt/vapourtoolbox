'use client';

/**
 * Approve/Reject Invoice Dialog
 *
 * Allows approvers to approve or reject invoices pending their approval.
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
import { approveInvoice, rejectInvoice } from '@/lib/accounting/invoiceApprovalService';
import { formatCurrency } from '@/lib/accounting/transactionHelpers';
import type { CustomerInvoice } from '@vapour/types';

interface ApproveInvoiceDialogProps {
  open: boolean;
  onClose: () => void;
  invoice: CustomerInvoice | null;
  onSuccess?: () => void;
}

export function ApproveInvoiceDialog({
  open,
  onClose,
  invoice,
  onSuccess,
}: ApproveInvoiceDialogProps) {
  const { user } = useAuth();
  const [comments, setComments] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [action, setAction] = useState<'approve' | 'reject' | null>(null);

  const handleApprove = async () => {
    if (!invoice?.id || !user) return;

    setAction('approve');
    setLoading(true);
    setError('');

    try {
      const { db } = getFirebase();
      const userName = user.displayName || user.email || 'Unknown';

      await approveInvoice(db, invoice.id, user.uid, userName, comments || undefined);

      // Reset form
      setComments('');
      setAction(null);

      onSuccess?.();
      onClose();
    } catch (err) {
      console.error('[ApproveInvoiceDialog] Error approving:', err);
      setError(err instanceof Error ? err.message : 'Failed to approve invoice');
    } finally {
      setLoading(false);
    }
  };

  const handleReject = async () => {
    if (!invoice?.id || !user) return;

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

      await rejectInvoice(db, invoice.id, user.uid, userName, comments);

      // Reset form
      setComments('');
      setAction(null);

      onSuccess?.();
      onClose();
    } catch (err) {
      console.error('[ApproveInvoiceDialog] Error rejecting:', err);
      setError(err instanceof Error ? err.message : 'Failed to reject invoice');
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

  if (!invoice) return null;

  return (
    <Dialog open={open} onClose={handleClose} maxWidth="sm" fullWidth>
      <DialogTitle>Review Invoice</DialogTitle>
      <DialogContent>
        <Box sx={{ pt: 1 }}>
          {error && (
            <Alert severity="error" sx={{ mb: 2 }}>
              {error}
            </Alert>
          )}

          {/* Invoice Summary */}
          <Box sx={{ mb: 3, p: 2, bgcolor: 'grey.50', borderRadius: 1 }}>
            <Stack direction="row" justifyContent="space-between" alignItems="flex-start">
              <Box>
                <Typography variant="subtitle2" color="text.secondary">
                  Invoice Number
                </Typography>
                <Typography variant="h6">{invoice.transactionNumber}</Typography>
              </Box>
              <Chip label="Pending Approval" color="warning" size="small" />
            </Stack>

            <Stack direction="row" spacing={4} sx={{ mt: 2 }}>
              <Box>
                <Typography variant="caption" color="text.secondary">
                  Customer
                </Typography>
                <Typography variant="body2">{invoice.entityName || '-'}</Typography>
              </Box>
              <Box>
                <Typography variant="caption" color="text.secondary">
                  Amount
                </Typography>
                <Typography variant="body2" fontWeight="medium">
                  {formatCurrency(invoice.totalAmount || 0, invoice.currency || 'INR')}
                </Typography>
              </Box>
            </Stack>

            {invoice.description && (
              <Box sx={{ mt: 2 }}>
                <Typography variant="caption" color="text.secondary">
                  Description
                </Typography>
                <Typography variant="body2">{invoice.description}</Typography>
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
                ? 'Please explain why this invoice is being rejected...'
                : 'Add any comments about this approval...'
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
