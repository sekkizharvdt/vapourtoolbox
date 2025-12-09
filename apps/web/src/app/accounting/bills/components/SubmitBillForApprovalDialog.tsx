'use client';

/**
 * Submit Bill for Approval Dialog
 *
 * Allows user to select an approver and submit the bill for approval.
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
} from '@mui/material';
import { ApproverSelector } from '@/components/common/forms/ApproverSelector';
import { useAuth } from '@/contexts/AuthContext';
import { getFirebase } from '@/lib/firebase';
import { submitBillForApproval } from '@/lib/accounting/billApprovalService';
import { formatCurrency } from '@/lib/accounting/transactionHelpers';
import type { VendorBill } from '@vapour/types';

interface SubmitBillForApprovalDialogProps {
  open: boolean;
  onClose: () => void;
  bill: VendorBill | null;
  onSuccess?: () => void;
}

export function SubmitBillForApprovalDialog({
  open,
  onClose,
  bill,
  onSuccess,
}: SubmitBillForApprovalDialogProps) {
  const { user } = useAuth();
  const [approverId, setApproverId] = useState<string | null>(null);
  const [approverName, setApproverName] = useState<string>('');
  const [comments, setComments] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const handleSubmit = async () => {
    if (!bill?.id || !user || !approverId) {
      setError('Please select an approver');
      return;
    }

    setLoading(true);
    setError('');

    try {
      const { db } = getFirebase();
      const userName = user.displayName || user.email || 'Unknown';

      await submitBillForApproval(
        db,
        bill.id,
        approverId,
        approverName,
        user.uid,
        userName,
        comments || undefined
      );

      // Reset form
      setApproverId(null);
      setApproverName('');
      setComments('');

      onSuccess?.();
      onClose();
    } catch (err) {
      console.error('[SubmitBillForApprovalDialog] Error:', err);
      setError(err instanceof Error ? err.message : 'Failed to submit for approval');
    } finally {
      setLoading(false);
    }
  };

  const handleClose = () => {
    if (!loading) {
      setApproverId(null);
      setApproverName('');
      setComments('');
      setError('');
      onClose();
    }
  };

  const handleApproverChange = (userId: string | null) => {
    setApproverId(userId);
  };

  const handleApproverChangeWithName = (userId: string | null, displayName: string) => {
    setApproverId(userId);
    setApproverName(displayName);
  };

  if (!bill) return null;

  return (
    <Dialog open={open} onClose={handleClose} maxWidth="sm" fullWidth>
      <DialogTitle>Submit Bill for Approval</DialogTitle>
      <DialogContent>
        <Box sx={{ pt: 1 }}>
          {error && (
            <Alert severity="error" sx={{ mb: 2 }}>
              {error}
            </Alert>
          )}

          <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
            Submit bill <strong>{bill.vendorInvoiceNumber || bill.transactionNumber}</strong> from{' '}
            <strong>{bill.entityName || 'vendor'}</strong> for approval.
          </Typography>

          <Box sx={{ mb: 2, p: 2, bgcolor: 'grey.50', borderRadius: 1 }}>
            <Typography variant="caption" color="text.secondary">
              Amount
            </Typography>
            <Typography variant="h6">
              {formatCurrency(bill.totalAmount || 0, bill.currency || 'INR')}
            </Typography>
          </Box>

          <Box sx={{ mb: 3 }}>
            <ApproverSelector
              value={approverId}
              onChange={handleApproverChange}
              onChangeWithName={handleApproverChangeWithName}
              label="Select Approver"
              approvalType="transaction"
              required
              placeholder="Choose who should approve this bill..."
              excludeUserIds={user ? [user.uid] : []}
            />
          </Box>

          <TextField
            fullWidth
            label="Comments (Optional)"
            value={comments}
            onChange={(e) => setComments(e.target.value)}
            multiline
            rows={3}
            placeholder="Add any notes for the approver..."
            disabled={loading}
          />
        </Box>
      </DialogContent>
      <DialogActions>
        <Button onClick={handleClose} disabled={loading}>
          Cancel
        </Button>
        <Button
          onClick={handleSubmit}
          variant="contained"
          disabled={loading || !approverId}
          startIcon={loading ? <CircularProgress size={20} /> : null}
        >
          {loading ? 'Submitting...' : 'Submit for Approval'}
        </Button>
      </DialogActions>
    </Dialog>
  );
}
