'use client';

/**
 * Update Completion Status dialog (feedback JPniHKT59RWVgksV70iq).
 *
 * Lets the user confirm outstanding completion flags on an issued WCC — most
 * commonly flipping "All Payments Completed" to Yes once the final payment is
 * released. Flags already confirmed are locked (never rolled back), and a
 * fully complete certificate cannot be reopened.
 */

import { useState, useEffect } from 'react';
import {
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Button,
  FormControlLabel,
  Checkbox,
  TextField,
  Alert,
  Stack,
} from '@mui/material';
import type { WorkCompletionCertificate } from '@vapour/types';
import {
  updateWCCCompletion,
  arePOPaymentsComplete,
} from '@/lib/procurement/workCompletionService';
import { useAuth } from '@/contexts/AuthContext';
import { useToast } from '@/components/common/Toast';

interface UpdateCompletionDialogProps {
  open: boolean;
  onClose: () => void;
  wcc: WorkCompletionCertificate;
  /** Called after a successful save so the parent can reload. */
  onUpdated: () => void;
}

export function UpdateCompletionDialog({
  open,
  onClose,
  wcc,
  onUpdated,
}: UpdateCompletionDialogProps) {
  const { user } = useAuth();
  const { toast } = useToast();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const [allItemsDelivered, setAllItemsDelivered] = useState(false);
  const [allItemsAccepted, setAllItemsAccepted] = useState(false);
  const [allPaymentsCompleted, setAllPaymentsCompleted] = useState(false);
  const [remarks, setRemarks] = useState('');
  const [paymentsLookComplete, setPaymentsLookComplete] = useState<boolean | null>(null);

  // Re-sync every field when the dialog opens or the WCC changes (rule 14b)
  useEffect(() => {
    if (open && wcc) {
      setAllItemsDelivered(wcc.allItemsDelivered);
      setAllItemsAccepted(wcc.allItemsAccepted);
      setAllPaymentsCompleted(wcc.allPaymentsCompleted);
      setRemarks(wcc.remarks ?? '');
      setError('');
      setPaymentsLookComplete(null);
      // Advisory pre-check: do the PO's bills say payments are done?
      arePOPaymentsComplete(wcc.purchaseOrderId)
        .then(setPaymentsLookComplete)
        .catch(() => setPaymentsLookComplete(null));
    }
  }, [open, wcc]);

  const handleSave = async () => {
    if (!user) {
      setError('You must be logged in to update the certificate');
      return;
    }
    setLoading(true);
    setError('');
    try {
      await updateWCCCompletion(
        wcc.id,
        {
          // Only send flags that actually changed (confirmed flags stay locked)
          ...(allItemsDelivered !== wcc.allItemsDelivered && { allItemsDelivered }),
          ...(allItemsAccepted !== wcc.allItemsAccepted && { allItemsAccepted }),
          ...(allPaymentsCompleted !== wcc.allPaymentsCompleted && { allPaymentsCompleted }),
          ...(remarks !== (wcc.remarks ?? '') && { remarks }),
        },
        user.uid,
        user.displayName || user.email || ''
      );
      toast.success(`WCC ${wcc.number} updated`);
      onUpdated();
      onClose();
    } catch (err) {
      console.error('[UpdateCompletionDialog] Error saving:', err);
      setError(err instanceof Error ? err.message : 'Failed to update certificate');
    } finally {
      setLoading(false);
    }
  };

  return (
    <Dialog open={open} onClose={loading ? undefined : onClose} maxWidth="sm" fullWidth>
      <DialogTitle>Update Completion Status — {wcc.number}</DialogTitle>
      <DialogContent>
        <Stack spacing={2} sx={{ pt: 1 }}>
          {allPaymentsCompleted && !wcc.allPaymentsCompleted && paymentsLookComplete === false && (
            <Alert severity="warning">
              The bills against PO {wcc.poNumber} do not all show as paid yet. Confirm the final
              payment has actually been released before marking payments complete.
            </Alert>
          )}
          {!wcc.allPaymentsCompleted && paymentsLookComplete === true && (
            <Alert severity="info">
              All bills against PO {wcc.poNumber} are marked paid — payments look complete.
            </Alert>
          )}

          <FormControlLabel
            control={
              <Checkbox
                checked={allItemsDelivered}
                onChange={(e) => setAllItemsDelivered(e.target.checked)}
                disabled={wcc.allItemsDelivered}
              />
            }
            label="All Items Delivered"
          />
          <FormControlLabel
            control={
              <Checkbox
                checked={allItemsAccepted}
                onChange={(e) => setAllItemsAccepted(e.target.checked)}
                disabled={wcc.allItemsAccepted}
              />
            }
            label="All Items Accepted"
          />
          <FormControlLabel
            control={
              <Checkbox
                checked={allPaymentsCompleted}
                onChange={(e) => setAllPaymentsCompleted(e.target.checked)}
                disabled={wcc.allPaymentsCompleted}
              />
            }
            label="All Payments Completed"
          />

          <TextField
            label="Remarks"
            value={remarks}
            onChange={(e) => setRemarks(e.target.value)}
            fullWidth
            multiline
            rows={2}
          />

          {error && <Alert severity="error">{error}</Alert>}
        </Stack>
      </DialogContent>
      <DialogActions>
        <Button onClick={onClose} disabled={loading}>
          Cancel
        </Button>
        <Button onClick={handleSave} variant="contained" disabled={loading}>
          {loading ? 'Saving...' : 'Save'}
        </Button>
      </DialogActions>
    </Dialog>
  );
}
