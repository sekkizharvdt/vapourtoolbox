'use client';

/**
 * Approve/Reject Bill Dialog
 *
 * Allows approvers to approve or reject bills pending their approval.
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
import { approveBill, rejectBill } from '@/lib/accounting/billApprovalService';
import { formatCurrency } from '@/lib/accounting/transactionHelpers';
import type { VendorBill } from '@vapour/types';

interface ApproveBillDialogProps {
  open: boolean;
  onClose: () => void;
  bill: VendorBill | null;
  onSuccess?: () => void;
}

export function ApproveBillDialog({ open, onClose, bill, onSuccess }: ApproveBillDialogProps) {
  const { user } = useAuth();
  const [comments, setComments] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [action, setAction] = useState<'approve' | 'reject' | null>(null);

  const handleApprove = async () => {
    if (!bill?.id || !user) return;

    setAction('approve');
    setLoading(true);
    setError('');

    try {
      const { db } = getFirebase();
      const userName = user.displayName || user.email || 'Unknown';

      await approveBill(db, bill.id, user.uid, userName, comments || undefined);

      // Reset form
      setComments('');
      setAction(null);

      onSuccess?.();
      onClose();
    } catch (err) {
      console.error('[ApproveBillDialog] Error approving:', err);
      setError(err instanceof Error ? err.message : 'Failed to approve bill');
    } finally {
      setLoading(false);
    }
  };

  const handleReject = async () => {
    if (!bill?.id || !user) return;

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

      await rejectBill(db, bill.id, user.uid, userName, comments);

      // Reset form
      setComments('');
      setAction(null);

      onSuccess?.();
      onClose();
    } catch (err) {
      console.error('[ApproveBillDialog] Error rejecting:', err);
      setError(err instanceof Error ? err.message : 'Failed to reject bill');
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

  if (!bill) return null;

  return (
    <Dialog open={open} onClose={handleClose} maxWidth="sm" fullWidth>
      <DialogTitle>Review Bill</DialogTitle>
      <DialogContent>
        <Box sx={{ pt: 1 }}>
          {error && (
            <Alert severity="error" sx={{ mb: 2 }}>
              {error}
            </Alert>
          )}

          {/* Bill Summary */}
          <Box sx={{ mb: 3, p: 2, bgcolor: 'grey.50', borderRadius: 1 }}>
            <Stack direction="row" justifyContent="space-between" alignItems="flex-start">
              <Box>
                <Typography variant="subtitle2" color="text.secondary">
                  Bill Number
                </Typography>
                <Typography variant="h6">
                  {bill.vendorInvoiceNumber || bill.transactionNumber}
                </Typography>
              </Box>
              <Chip label="Pending Approval" color="warning" size="small" />
            </Stack>

            <Stack direction="row" spacing={4} sx={{ mt: 2 }}>
              <Box>
                <Typography variant="caption" color="text.secondary">
                  Vendor
                </Typography>
                <Typography variant="body2">{bill.entityName || '-'}</Typography>
              </Box>
              <Box>
                <Typography variant="caption" color="text.secondary">
                  Amount
                </Typography>
                <Typography variant="body2" fontWeight="medium">
                  {formatCurrency(bill.totalAmount || 0, bill.currency || 'INR')}
                </Typography>
              </Box>
            </Stack>

            {bill.description && (
              <Box sx={{ mt: 2 }}>
                <Typography variant="caption" color="text.secondary">
                  Description
                </Typography>
                <Typography variant="body2">{bill.description}</Typography>
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
                ? 'Please explain why this bill is being rejected...'
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
