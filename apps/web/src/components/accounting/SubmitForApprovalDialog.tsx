'use client';

/**
 * Generic Submit for Approval Dialog
 *
 * Allows user to select an approver and submit invoices or bills for approval.
 * Consolidates SubmitForApprovalDialog (invoices) and SubmitBillForApprovalDialog.
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
import {
  submitTransactionForApproval,
  type ApprovableTransactionType,
  TRANSACTION_CONFIGS,
} from '@/lib/accounting/transactionApprovalService';
import { formatCurrency } from '@/lib/accounting/transactionHelpers';

export interface SubmittableTransaction {
  id?: string;
  transactionNumber?: string;
  vendorInvoiceNumber?: string;
  entityName?: string;
  totalAmount?: number;
  currency?: string;
}

interface SubmitForApprovalDialogProps {
  open: boolean;
  onClose: () => void;
  transaction: SubmittableTransaction | null;
  transactionType: ApprovableTransactionType;
  onSuccess?: () => void;
  showAmountSummary?: boolean;
}

export function SubmitForApprovalDialog({
  open,
  onClose,
  transaction,
  transactionType,
  onSuccess,
  showAmountSummary = false,
}: SubmitForApprovalDialogProps) {
  const { user } = useAuth();
  const [approverId, setApproverId] = useState<string | null>(null);
  const [approverName, setApproverName] = useState<string>('');
  const [comments, setComments] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const config = TRANSACTION_CONFIGS[transactionType];

  const getDisplayNumber = () => {
    if (transactionType === 'VENDOR_BILL') {
      return transaction?.vendorInvoiceNumber || transaction?.transactionNumber;
    }
    return transaction?.transactionNumber;
  };

  const handleSubmit = async () => {
    if (!transaction?.id || !user || !approverId) {
      setError('Please select an approver');
      return;
    }

    setLoading(true);
    setError('');

    try {
      const { db } = getFirebase();
      const userName = user.displayName || user.email || 'Unknown';

      await submitTransactionForApproval(
        db,
        transactionType,
        transaction.id,
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

  const handleApproverChange = (userId: string | null) => {
    setApproverId(userId);
  };

  const handleApproverChangeWithName = (userId: string | null, displayName: string) => {
    setApproverId(userId);
    setApproverName(displayName);
  };

  if (!transaction) return null;

  return (
    <Dialog open={open} onClose={handleClose} maxWidth="sm" fullWidth>
      <DialogTitle>Submit {config.entityLabel} for Approval</DialogTitle>
      <DialogContent>
        <Box sx={{ pt: 1 }}>
          {error && (
            <Alert severity="error" sx={{ mb: 2 }}>
              {error}
            </Alert>
          )}

          <Typography variant="body2" color="text.secondary" sx={{ mb: showAmountSummary ? 2 : 3 }}>
            Submit {config.entityLabelLower} <strong>{getDisplayNumber()}</strong>{' '}
            {transactionType === 'VENDOR_BILL' ? 'from' : 'for'}{' '}
            <strong>{transaction.entityName || config.counterpartyLabelLower}</strong> to be
            approved.
          </Typography>

          {showAmountSummary && (
            <Box sx={{ mb: 2, p: 2, bgcolor: 'action.hover', borderRadius: 1 }}>
              <Typography variant="caption" color="text.secondary">
                Amount
              </Typography>
              <Typography variant="h6">
                {formatCurrency(transaction.totalAmount || 0, transaction.currency || 'INR')}
              </Typography>
            </Box>
          )}

          <Box sx={{ mb: 3 }}>
            <ApproverSelector
              value={approverId}
              onChange={handleApproverChange}
              onChangeWithName={handleApproverChangeWithName}
              label="Select Approver"
              approvalType="transaction"
              required
              placeholder={`Choose who should approve this ${config.entityLabelLower}...`}
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
