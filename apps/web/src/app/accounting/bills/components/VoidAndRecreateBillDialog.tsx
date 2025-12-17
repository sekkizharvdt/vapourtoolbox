'use client';

/**
 * Void and Recreate Bill Dialog
 *
 * Allows users to void a bill and optionally recreate it with a different vendor.
 * This is the recommended workflow for correcting vendor selection mistakes.
 */

import React, { useState } from 'react';
import {
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Button,
  TextField,
  Typography,
  Box,
  Alert,
  FormControlLabel,
  Switch,
  CircularProgress,
  Divider,
  Stack,
} from '@mui/material';
import { Warning as WarningIcon } from '@mui/icons-material';
import { EntitySelector } from '@/components/common/forms/EntitySelector';
import { getFirebase } from '@/lib/firebase';
import { useAuth } from '@/contexts/AuthContext';
import type { VendorBill } from '@vapour/types';
import { formatCurrency } from '@/lib/accounting/transactionHelpers';
import { voidBill, voidAndRecreateBill, canVoidBill } from '@/lib/accounting/billVoidService';

interface VoidAndRecreateBillDialogProps {
  open: boolean;
  onClose: () => void;
  bill: VendorBill | null;
}

export function VoidAndRecreateBillDialog({ open, onClose, bill }: VoidAndRecreateBillDialogProps) {
  const { user } = useAuth();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  // Form state
  const [reason, setReason] = useState('');
  const [recreateWithNewVendor, setRecreateWithNewVendor] = useState(true);
  const [newVendorId, setNewVendorId] = useState<string | null>(null);
  const [newVendorName, setNewVendorName] = useState('');

  // Reset form when dialog opens/closes
  React.useEffect(() => {
    if (open) {
      setReason('');
      setRecreateWithNewVendor(true);
      setNewVendorId(null);
      setNewVendorName('');
      setError('');
      setSuccess('');
    }
  }, [open]);

  // Check if void is allowed
  const voidCheck = bill ? canVoidBill(bill) : { canVoid: false, reason: 'No bill selected' };

  const handleSubmit = async () => {
    if (!bill || !user) return;

    // Validation
    if (!reason.trim()) {
      setError('Please provide a reason for voiding the bill');
      return;
    }

    if (recreateWithNewVendor && !newVendorId) {
      setError('Please select the correct vendor');
      return;
    }

    if (recreateWithNewVendor && newVendorId === bill.entityId) {
      setError('Please select a different vendor than the original');
      return;
    }

    setLoading(true);
    setError('');
    setSuccess('');

    try {
      const { db } = getFirebase();

      if (recreateWithNewVendor && newVendorId) {
        // Void and recreate with new vendor
        const result = await voidAndRecreateBill(db, {
          billId: bill.id,
          reason,
          userId: user.uid,
          userName: user.displayName || user.email || 'Unknown',
          newVendorId,
          newVendorName,
        });

        if (result.success) {
          setSuccess(
            `Bill voided and recreated successfully. New bill number: ${result.newTransactionNumber}`
          );
          setTimeout(() => {
            onClose();
          }, 2000);
        } else {
          setError(result.error || 'Failed to void and recreate bill');
        }
      } else {
        // Just void the bill
        const result = await voidBill(db, {
          billId: bill.id,
          reason,
          userId: user.uid,
          userName: user.displayName || user.email || 'Unknown',
        });

        if (result.success) {
          setSuccess('Bill voided successfully');
          setTimeout(() => {
            onClose();
          }, 2000);
        } else {
          setError(result.error || 'Failed to void bill');
        }
      }
    } catch (err) {
      console.error('[VoidAndRecreateBillDialog] Error:', err);
      setError(err instanceof Error ? err.message : 'An unexpected error occurred');
    } finally {
      setLoading(false);
    }
  };

  if (!bill) return null;

  return (
    <Dialog open={open} onClose={onClose} maxWidth="sm" fullWidth>
      <DialogTitle>
        <Stack direction="row" alignItems="center" spacing={1}>
          <WarningIcon color="warning" />
          <span>Void Bill</span>
        </Stack>
      </DialogTitle>

      <DialogContent>
        <Box sx={{ pt: 1 }}>
          {/* Error/Success Messages */}
          {error && (
            <Alert severity="error" sx={{ mb: 2 }}>
              {error}
            </Alert>
          )}
          {success && (
            <Alert severity="success" sx={{ mb: 2 }}>
              {success}
            </Alert>
          )}

          {/* Void Check Warning */}
          {!voidCheck.canVoid && (
            <Alert severity="error" sx={{ mb: 2 }}>
              {voidCheck.reason}
            </Alert>
          )}

          {/* Bill Summary */}
          <Box sx={{ mb: 3, p: 2, bgcolor: 'action.hover', borderRadius: 1 }}>
            <Typography variant="subtitle2" color="text.secondary" gutterBottom>
              Bill Details
            </Typography>
            <Typography variant="body1">
              <strong>Bill #:</strong> {bill.vendorInvoiceNumber || bill.transactionNumber}
            </Typography>
            <Typography variant="body1">
              <strong>Vendor:</strong> {bill.entityName || 'Unknown'}
            </Typography>
            <Typography variant="body1">
              <strong>Amount:</strong> {formatCurrency(bill.totalAmount || 0)}
            </Typography>
            <Typography variant="body1">
              <strong>Status:</strong> {bill.status}
            </Typography>
          </Box>

          {voidCheck.canVoid && (
            <>
              {/* Reason */}
              <TextField
                fullWidth
                label="Reason for Voiding"
                value={reason}
                onChange={(e) => setReason(e.target.value)}
                multiline
                rows={2}
                placeholder="e.g., Wrong vendor selected, duplicate entry, etc."
                required
                sx={{ mb: 3 }}
              />

              <Divider sx={{ my: 2 }} />

              {/* Recreate Option */}
              <FormControlLabel
                control={
                  <Switch
                    checked={recreateWithNewVendor}
                    onChange={(e) => setRecreateWithNewVendor(e.target.checked)}
                  />
                }
                label="Recreate with correct vendor"
              />

              <Typography variant="body2" color="text.secondary" sx={{ mb: 2, ml: 6 }}>
                {recreateWithNewVendor
                  ? 'A new bill will be created as a draft with the correct vendor, copying all line items.'
                  : 'The bill will be voided without creating a replacement.'}
              </Typography>

              {/* New Vendor Selector */}
              {recreateWithNewVendor && (
                <Box sx={{ mt: 2 }}>
                  <EntitySelector
                    value={newVendorId}
                    onChange={setNewVendorId}
                    onEntitySelect={(entity) => setNewVendorName(entity?.name || '')}
                    filterByRole="VENDOR"
                    label="Correct Vendor"
                    required
                    helperText={
                      bill.entityId === newVendorId
                        ? 'Please select a different vendor'
                        : 'Select the correct vendor for this bill'
                    }
                    error={bill.entityId === newVendorId}
                  />
                </Box>
              )}

              {/* Warning */}
              <Alert severity="warning" sx={{ mt: 3 }}>
                <Typography variant="body2">
                  <strong>Important:</strong> Voiding a bill will:
                </Typography>
                <ul style={{ margin: '8px 0', paddingLeft: '20px' }}>
                  <li>Change the bill status to VOID</li>
                  <li>Create reversing GL entries to cancel the original entries</li>
                  <li>The voided bill will remain in the system for audit purposes</li>
                  {recreateWithNewVendor && (
                    <li>Create a new draft bill with the correct vendor (requires re-approval)</li>
                  )}
                </ul>
              </Alert>
            </>
          )}
        </Box>
      </DialogContent>

      <DialogActions>
        <Button onClick={onClose} disabled={loading}>
          Cancel
        </Button>
        <Button
          onClick={handleSubmit}
          variant="contained"
          color="warning"
          disabled={loading || !voidCheck.canVoid || !reason.trim() || success !== ''}
          startIcon={loading ? <CircularProgress size={16} /> : null}
        >
          {loading ? 'Processing...' : recreateWithNewVendor ? 'Void & Recreate' : 'Void Bill'}
        </Button>
      </DialogActions>
    </Dialog>
  );
}
