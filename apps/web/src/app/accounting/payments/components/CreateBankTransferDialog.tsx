'use client';

import React, { useState, useEffect, useRef, useCallback } from 'react';
import { TextField, Grid, Box, Typography, Alert } from '@mui/material';
import { FormDialog, FormDialogActions } from '@vapour/ui';
import { AccountSelector } from '@/components/common/forms/AccountSelector';
import { useTallyKeyboard } from '@/hooks/useTallyKeyboard';
import { getFirebase } from '@/lib/firebase';
import { retryOnStaleToken } from '@/lib/firebase/retryOnStaleToken';
import { Timestamp, collection, addDoc, updateDoc, doc, getDoc } from 'firebase/firestore';
import { useAuth } from '@/contexts/AuthContext';
import { COLLECTIONS } from '@vapour/firebase';
import { generateTransactionNumber } from '@/lib/accounting/transactionNumberGenerator';
import { generateBankTransferGLEntries } from '@/lib/accounting/glEntry';
import { roundToPaisa } from '@/lib/accounting/amountHelpers';
import { logAuditEvent, createAuditContext } from '@/lib/audit/clientAuditService';

interface BankTransferDoc {
  id?: string;
  type: 'BANK_TRANSFER';
  transactionNumber: string;
  transferDate: unknown; // Firestore Timestamp | Date | string
  fromBankAccountId: string;
  toBankAccountId: string;
  transferAmount?: number;
  amount?: number;
  reference?: string;
  description?: string;
}

interface CreateBankTransferDialogProps {
  open: boolean;
  onClose: () => void;
  editingTransfer?: BankTransferDoc | null;
}

/** Convert a Firestore Timestamp | Date | string to a yyyy-MM-dd input value (rule 14) */
function toDateInputValue(raw: unknown): string {
  if (!raw) return '';
  if (typeof raw === 'object' && 'toDate' in raw) {
    return (raw as { toDate: () => Date }).toDate().toISOString().split('T')[0] || '';
  }
  if (raw instanceof Date) {
    return raw.toISOString().split('T')[0] || '';
  }
  if (typeof raw === 'string') return raw.split('T')[0] || '';
  return '';
}

export function CreateBankTransferDialog({
  open,
  onClose,
  editingTransfer,
}: CreateBankTransferDialogProps) {
  const { user } = useAuth();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const submitRef = useRef<() => void>(() => {});
  const tallySubmit = useCallback(() => submitRef.current(), []);
  const { getFieldProps } = useTallyKeyboard({ onSubmit: tallySubmit, disabled: loading });

  // Form fields
  const [transferDate, setTransferDate] = useState<string>(
    () => new Date().toISOString().split('T')[0] || ''
  );
  const [fromBankAccountId, setFromBankAccountId] = useState<string | null>(null);
  const [toBankAccountId, setToBankAccountId] = useState<string | null>(null);
  const [amount, setAmount] = useState<number>(0);
  const [reference, setReference] = useState<string>('');
  const [description, setDescription] = useState<string>('');

  // Reset form when dialog opens/closes (rule 14b — re-sync every field)
  useEffect(() => {
    if (open) {
      if (editingTransfer) {
        setTransferDate(
          toDateInputValue(editingTransfer.transferDate) ||
            new Date().toISOString().split('T')[0] ||
            ''
        );
        setFromBankAccountId(editingTransfer.fromBankAccountId || null);
        setToBankAccountId(editingTransfer.toBankAccountId || null);
        setAmount(editingTransfer.transferAmount ?? editingTransfer.amount ?? 0);
        setReference(editingTransfer.reference || '');
        setDescription(editingTransfer.description || '');
      } else {
        setTransferDate(new Date().toISOString().split('T')[0] || '');
        setFromBankAccountId(null);
        setToBankAccountId(null);
        setAmount(0);
        setReference('');
        setDescription('');
      }
      setError('');
    }
  }, [open, editingTransfer]);

  const handleSubmit = async () => {
    // rule19-exempt: reads Chart of Accounts docs for GL leg code/name and writes a NEW transaction doc — different documents; the read does not mutate
    // Validation (rule 23 — descriptive errors naming attempted vs allowed)
    if (!transferDate) {
      setError('Please select a transfer date');
      return;
    }
    if (!fromBankAccountId) {
      setError('Please select the source bank account (transfer from)');
      return;
    }
    if (!toBankAccountId) {
      setError('Please select the destination bank account (transfer to)');
      return;
    }
    if (fromBankAccountId === toBankAccountId) {
      setError('Source and destination bank accounts must be different');
      return;
    }
    if (amount <= 0) {
      setError(`Transfer amount must be greater than zero (got ${amount})`);
      return;
    }

    setLoading(true);
    setError('');

    try {
      const { db } = getFirebase();
      const transferAmount = roundToPaisa(amount);

      // Generate transaction number for new transfers (first Firestore call — rule 35)
      let transactionNumber = editingTransfer?.transactionNumber;
      if (!editingTransfer) {
        transactionNumber = await retryOnStaleToken(() =>
          generateTransactionNumber('BANK_TRANSFER')
        );
      }

      // Fetch both account docs for code/name on the GL legs. Selector
      // callbacks don't fire for pre-populated values (rule 15), so read
      // the accounts directly instead of relying on onAccountSelect state.
      const [fromSnap, toSnap] = await Promise.all([
        retryOnStaleToken(() => getDoc(doc(db, COLLECTIONS.ACCOUNTS, fromBankAccountId))),
        retryOnStaleToken(() => getDoc(doc(db, COLLECTIONS.ACCOUNTS, toBankAccountId))),
      ]);
      if (!fromSnap.exists()) {
        setError('Source bank account no longer exists in the Chart of Accounts');
        setLoading(false);
        return;
      }
      if (!toSnap.exists()) {
        setError('Destination bank account no longer exists in the Chart of Accounts');
        setLoading(false);
        return;
      }
      const fromData = fromSnap.data() as { code?: string; name?: string };
      const toData = toSnap.data() as { code?: string; name?: string };

      // Generate GL entries: Dr destination bank, Cr source bank (equal legs)
      const glResult = generateBankTransferGLEntries({
        fromAccountId: fromBankAccountId,
        fromAccountCode: fromData.code || '',
        fromAccountName: fromData.name || 'Bank Account',
        toAccountId: toBankAccountId,
        toAccountCode: toData.code || '',
        toAccountName: toData.name || 'Bank Account',
        amount: transferAmount,
        description:
          (description ?? '').trim() || `Transfer from ${fromData.name} to ${toData.name}`,
      });
      if (!glResult.success) {
        setError(`Failed to generate GL entries: ${glResult.errors.join(', ')}`);
        setLoading(false);
        return;
      }

      const dateTs = Timestamp.fromDate(new Date(transferDate));

      // Build transfer data — no entityId: an internal transfer has no counterparty
      const transferData: Record<string, unknown> = {
        type: 'BANK_TRANSFER',
        transactionNumber: transactionNumber || '',
        date: dateTs,
        transferDate: dateTs,
        fromBankAccountId,
        toBankAccountId,
        transferAmount,
        amount: transferAmount,
        totalAmount: transferAmount,
        baseAmount: transferAmount,
        currency: 'INR',
        description:
          (description ?? '').trim() || `Transfer from ${fromData.name} to ${toData.name}`,
        reference: reference || '',
        // Conditional spread — Firestore rejects undefined (rule 12)
        ...((reference ?? '').trim() && { transactionReference: reference.trim() }),
        transferStatus: 'COMPLETED',
        completedDate: dateTs,
        status: 'POSTED',
        entries: glResult.entries,
        attachments: [],
        ...(editingTransfer
          ? {}
          : { createdAt: Timestamp.now(), createdBy: user?.uid || 'unknown' }),
        ...(editingTransfer ? { updatedBy: user?.uid || 'unknown' } : {}),
        updatedAt: Timestamp.now(),
      };

      const auditContext = user
        ? createAuditContext(user.uid, user.email || '', user.displayName || user.email || '')
        : null;

      if (editingTransfer?.id) {
        const editingId = editingTransfer.id;
        await retryOnStaleToken(() =>
          updateDoc(doc(db, COLLECTIONS.TRANSACTIONS, editingId), transferData)
        );

        if (auditContext) {
          await retryOnStaleToken(() =>
            logAuditEvent(
              db,
              auditContext,
              'TRANSACTION_UPDATED',
              'TRANSACTION',
              editingId,
              `Bank transfer ${transactionNumber} updated`,
              {
                entityName: transactionNumber || '',
                metadata: { amount: transferAmount, fromBankAccountId, toBankAccountId },
              }
            )
          );
        }
      } else {
        const docRef = await retryOnStaleToken(() =>
          addDoc(collection(db, COLLECTIONS.TRANSACTIONS), transferData)
        );

        if (auditContext) {
          await retryOnStaleToken(() =>
            logAuditEvent(
              db,
              auditContext,
              'TRANSACTION_CREATED',
              'TRANSACTION',
              docRef.id,
              `Bank transfer ${transactionNumber} created`,
              {
                entityName: transactionNumber || '',
                metadata: { amount: transferAmount, fromBankAccountId, toBankAccountId },
              }
            )
          );
        }
      }

      onClose();
    } catch (err) {
      console.error('[CreateBankTransferDialog] Error saving transfer:', err);
      setError(err instanceof Error ? err.message : 'Failed to save bank transfer');
    } finally {
      setLoading(false);
    }
  };
  submitRef.current = handleSubmit;

  return (
    <FormDialog
      open={open}
      onClose={onClose}
      title={editingTransfer ? 'Edit Bank Transfer' : 'Record Bank Transfer'}
      maxWidth="md"
    >
      <Box sx={{ p: 2 }}>
        {error && (
          <Typography color="error" sx={{ mb: 2 }}>
            {error}
          </Typography>
        )}

        <Alert severity="info" sx={{ mb: 3 }}>
          Use this form to record money moved between two of your own bank accounts. It is an
          internal transfer, not income or expense.
        </Alert>

        <Grid container spacing={3}>
          <Grid size={{ xs: 12 }}>
            <Typography variant="h6" gutterBottom>
              Transfer Details
            </Typography>
          </Grid>

          <Grid size={{ xs: 12, md: 6 }}>
            <TextField
              fullWidth
              label="Transfer Date"
              type="date"
              value={transferDate}
              onChange={(e) => setTransferDate(e.target.value)}
              slotProps={{ inputLabel: { shrink: true } }}
              required
              autoFocus
              {...getFieldProps(0)}
            />
          </Grid>

          <Grid size={{ xs: 12, md: 6 }}>
            <TextField
              fullWidth
              label="Amount"
              type="number"
              value={amount}
              onChange={(e) => setAmount(parseFloat(e.target.value) || 0)}
              slotProps={{ htmlInput: { min: 0, step: 0.01 } }}
              required
              {...getFieldProps(1)}
            />
          </Grid>

          <Grid size={{ xs: 12, md: 6 }}>
            <AccountSelector
              value={fromBankAccountId}
              onChange={setFromBankAccountId}
              label="From Bank Account (Source)"
              filterByBankAccount
              excludeGroups
              required
              placeholder="Search bank accounts..."
              {...getFieldProps(2, { isAutocomplete: true })}
            />
          </Grid>

          <Grid size={{ xs: 12, md: 6 }}>
            <AccountSelector
              value={toBankAccountId}
              onChange={setToBankAccountId}
              label="To Bank Account (Destination)"
              filterByBankAccount
              excludeGroups
              required
              error={Boolean(
                fromBankAccountId && toBankAccountId && fromBankAccountId === toBankAccountId
              )}
              helperText={
                fromBankAccountId && toBankAccountId && fromBankAccountId === toBankAccountId
                  ? 'Destination must differ from the source account'
                  : undefined
              }
              placeholder="Search bank accounts..."
              {...getFieldProps(3, { isAutocomplete: true })}
            />
          </Grid>

          <Grid size={{ xs: 12, md: 6 }}>
            <TextField
              fullWidth
              label="Reference (UTR / Transaction ID)"
              value={reference}
              onChange={(e) => setReference(e.target.value)}
              placeholder="Bank reference number"
              {...getFieldProps(4)}
            />
          </Grid>

          <Grid size={{ xs: 12 }}>
            <TextField
              fullWidth
              label="Description / Notes"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              multiline
              rows={2}
              placeholder="Purpose of the transfer (e.g., moving funds to payroll account)"
              {...getFieldProps(5, { multiline: true })}
            />
          </Grid>
        </Grid>
      </Box>

      <FormDialogActions
        onCancel={onClose}
        onSubmit={handleSubmit}
        submitLabel={editingTransfer ? 'Update Transfer' : 'Record Transfer'}
        loading={loading}
      />
    </FormDialog>
  );
}
