'use client';

/**
 * Void and Recreate Invoice Dialog
 *
 * Allows users to void an invoice and optionally recreate it with a different customer.
 * This is the recommended workflow for correcting customer selection mistakes.
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
import type { CustomerInvoice } from '@vapour/types';
import { formatCurrency } from '@/lib/accounting/transactionHelpers';
import {
  voidInvoice,
  voidAndRecreateInvoice,
  canVoidInvoice,
} from '@/lib/accounting/transactionVoidService';

interface VoidAndRecreateInvoiceDialogProps {
  open: boolean;
  onClose: () => void;
  invoice: CustomerInvoice | null;
}

export function VoidAndRecreateInvoiceDialog({
  open,
  onClose,
  invoice,
}: VoidAndRecreateInvoiceDialogProps) {
  const { user } = useAuth();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  // Form state
  const [reason, setReason] = useState('');
  const [recreateWithNewCustomer, setRecreateWithNewCustomer] = useState(true);
  const [newCustomerId, setNewCustomerId] = useState<string | null>(null);
  const [newCustomerName, setNewCustomerName] = useState('');

  // Reset form when dialog opens/closes
  React.useEffect(() => {
    if (open) {
      setReason('');
      setRecreateWithNewCustomer(true);
      setNewCustomerId(null);
      setNewCustomerName('');
      setError('');
      setSuccess('');
    }
  }, [open]);

  // Check if void is allowed
  const voidCheck = invoice
    ? canVoidInvoice(invoice)
    : { canVoid: false, reason: 'No invoice selected' };

  const handleSubmit = async () => {
    if (!invoice || !user) return;

    // Validation
    if (!reason.trim()) {
      setError('Please provide a reason for voiding the invoice');
      return;
    }

    if (recreateWithNewCustomer && !newCustomerId) {
      setError('Please select the correct customer');
      return;
    }

    if (recreateWithNewCustomer && newCustomerId === invoice.entityId) {
      setError('Please select a different customer than the original');
      return;
    }

    setLoading(true);
    setError('');
    setSuccess('');

    try {
      const { db } = getFirebase();

      if (recreateWithNewCustomer && newCustomerId) {
        // Void and recreate with new customer
        const result = await voidAndRecreateInvoice(db, {
          transactionId: invoice.id,
          reason,
          userId: user.uid,
          userName: user.displayName || user.email || 'Unknown',
          newEntityId: newCustomerId,
          newEntityName: newCustomerName,
        });

        if (result.success) {
          setSuccess(
            `Invoice voided and recreated successfully. New invoice number: ${result.newTransactionNumber}`
          );
          setTimeout(() => {
            onClose();
          }, 2000);
        } else {
          setError(result.error || 'Failed to void and recreate invoice');
        }
      } else {
        // Just void the invoice
        const result = await voidInvoice(db, {
          transactionId: invoice.id,
          reason,
          userId: user.uid,
          userName: user.displayName || user.email || 'Unknown',
        });

        if (result.success) {
          setSuccess('Invoice voided successfully');
          setTimeout(() => {
            onClose();
          }, 2000);
        } else {
          setError(result.error || 'Failed to void invoice');
        }
      }
    } catch (err) {
      console.error('[VoidAndRecreateInvoiceDialog] Error:', err);
      setError(err instanceof Error ? err.message : 'An unexpected error occurred');
    } finally {
      setLoading(false);
    }
  };

  if (!invoice) return null;

  return (
    <Dialog open={open} onClose={onClose} maxWidth="sm" fullWidth>
      <DialogTitle>
        <Stack direction="row" alignItems="center" spacing={1}>
          <WarningIcon color="warning" />
          <span>Void Invoice</span>
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

          {/* Invoice Summary */}
          <Box sx={{ mb: 3, p: 2, bgcolor: 'action.hover', borderRadius: 1 }}>
            <Typography variant="subtitle2" color="text.secondary" gutterBottom>
              Invoice Details
            </Typography>
            <Typography variant="body1">
              <strong>Invoice #:</strong> {invoice.transactionNumber}
            </Typography>
            <Typography variant="body1">
              <strong>Customer:</strong> {invoice.entityName || 'Unknown'}
            </Typography>
            <Typography variant="body1">
              <strong>Amount:</strong> {formatCurrency(invoice.totalAmount || 0)}
            </Typography>
            <Typography variant="body1">
              <strong>Status:</strong> {invoice.status}
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
                placeholder="e.g., Wrong customer selected, duplicate entry, etc."
                required
                sx={{ mb: 3 }}
              />

              <Divider sx={{ my: 2 }} />

              {/* Recreate Option */}
              <FormControlLabel
                control={
                  <Switch
                    checked={recreateWithNewCustomer}
                    onChange={(e) => setRecreateWithNewCustomer(e.target.checked)}
                  />
                }
                label="Recreate with correct customer"
              />

              <Typography variant="body2" color="text.secondary" sx={{ mb: 2, ml: 6 }}>
                {recreateWithNewCustomer
                  ? 'A new invoice will be created as a draft with the correct customer, copying all line items.'
                  : 'The invoice will be voided without creating a replacement.'}
              </Typography>

              {/* New Customer Selector */}
              {recreateWithNewCustomer && (
                <Box sx={{ mt: 2 }}>
                  <EntitySelector
                    value={newCustomerId}
                    onChange={setNewCustomerId}
                    onEntitySelect={(entity) => setNewCustomerName(entity?.name || '')}
                    filterByRole="CUSTOMER"
                    label="Correct Customer"
                    required
                    helperText={
                      invoice.entityId === newCustomerId
                        ? 'Please select a different customer'
                        : 'Select the correct customer for this invoice'
                    }
                    error={invoice.entityId === newCustomerId}
                  />
                </Box>
              )}

              {/* Warning */}
              <Alert severity="warning" sx={{ mt: 3 }}>
                <Typography variant="body2">
                  <strong>Important:</strong> Voiding an invoice will:
                </Typography>
                <ul style={{ margin: '8px 0', paddingLeft: '20px' }}>
                  <li>Change the invoice status to VOID</li>
                  <li>Create reversing GL entries to cancel the original entries</li>
                  <li>The voided invoice will remain in the system for audit purposes</li>
                  {recreateWithNewCustomer && (
                    <li>
                      Create a new draft invoice with the correct customer (requires re-approval)
                    </li>
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
          {loading ? 'Processing...' : recreateWithNewCustomer ? 'Void & Recreate' : 'Void Invoice'}
        </Button>
      </DialogActions>
    </Dialog>
  );
}
