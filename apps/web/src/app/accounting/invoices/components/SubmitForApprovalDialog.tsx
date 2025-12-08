'use client';

/**
 * Submit Invoice for Approval Dialog
 *
 * Allows user to select an approver and submit the invoice for approval.
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
import { submitInvoiceForApproval } from '@/lib/accounting/invoiceApprovalService';
import type { CustomerInvoice } from '@vapour/types';

interface SubmitForApprovalDialogProps {
  open: boolean;
  onClose: () => void;
  invoice: CustomerInvoice | null;
  onSuccess?: () => void;
}

export function SubmitForApprovalDialog({
  open,
  onClose,
  invoice,
  onSuccess,
}: SubmitForApprovalDialogProps) {
  const { user } = useAuth();
  const [approverId, setApproverId] = useState<string | null>(null);
  const [approverName, setApproverName] = useState<string>('');
  const [comments, setComments] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const handleSubmit = async () => {
    if (!invoice?.id || !user || !approverId) {
      setError('Please select an approver');
      return;
    }

    setLoading(true);
    setError('');

    try {
      const { db } = getFirebase();
      const userName = user.displayName || user.email || 'Unknown';

      await submitInvoiceForApproval(
        db,
        invoice.id,
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
      console.error('[SubmitForApprovalDialog] Error:', err);
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

  // Handler to capture both approver ID and name from the selector
  const handleApproverChange = (userId: string | null) => {
    setApproverId(userId);
  };

  const handleApproverChangeWithName = (userId: string | null, displayName: string) => {
    setApproverId(userId);
    setApproverName(displayName);
  };

  if (!invoice) return null;

  return (
    <Dialog open={open} onClose={handleClose} maxWidth="sm" fullWidth>
      <DialogTitle>Submit Invoice for Approval</DialogTitle>
      <DialogContent>
        <Box sx={{ pt: 1 }}>
          {error && (
            <Alert severity="error" sx={{ mb: 2 }}>
              {error}
            </Alert>
          )}

          <Typography variant="body2" color="text.secondary" sx={{ mb: 3 }}>
            Submit invoice <strong>{invoice.transactionNumber}</strong> for{' '}
            <strong>{invoice.entityName}</strong> to be approved.
          </Typography>

          <Box sx={{ mb: 3 }}>
            <ApproverSelector
              value={approverId}
              onChange={handleApproverChange}
              onChangeWithName={handleApproverChangeWithName}
              label="Select Approver"
              approvalType="transaction"
              required
              placeholder="Choose who should approve this invoice..."
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
