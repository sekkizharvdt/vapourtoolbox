'use client';

import React, { useState, useEffect, useRef, useCallback } from 'react';
import { TextField, Grid, Box, Typography, Alert } from '@mui/material';
import { FormDialog, FormDialogActions } from '@vapour/ui';
import { AccountSelector } from '@/components/common/forms/AccountSelector';
import { useTallyKeyboard } from '@/hooks/useTallyKeyboard';
import { getFirebase } from '@/lib/firebase';
import { retryOnStaleToken } from '@/lib/firebase/retryOnStaleToken';
import { Timestamp, collection, addDoc, updateDoc, doc } from 'firebase/firestore';
import { useAuth } from '@/contexts/AuthContext';
import { COLLECTIONS } from '@vapour/firebase';
import type { PaymentMethod, LedgerEntry } from '@vapour/types';
import { generateTransactionNumber } from '@/lib/accounting/transactionNumberGenerator';
import { getDefaultBankAccount } from '@/lib/accounting/defaultBankAccount';
import { logAuditEvent, createAuditContext } from '@/lib/audit/clientAuditService';

interface DirectReceipt {
  id?: string;
  type: 'DIRECT_RECEIPT';
  transactionNumber: string;
  receiptDate: unknown;
  revenueAccountId: string;
  revenueAccountName?: string;
  bankAccountId: string;
  bankAccountName?: string;
  paymentMethod: PaymentMethod;
  amount: number;
  description?: string;
  reference?: string;
  projectId?: string;
  chequeNumber?: string;
  upiTransactionId?: string;
  entityId?: string;
  entityName?: string;
}

interface RecordDirectReceiptDialogProps {
  open: boolean;
  onClose: () => void;
  editingReceipt?: DirectReceipt | null;
}

export function RecordDirectReceiptDialog({
  open,
  onClose,
  editingReceipt,
}: RecordDirectReceiptDialogProps) {
  const { user } = useAuth();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const submitRef = useRef<() => void>(() => {});
  const tallySubmit = useCallback(() => submitRef.current(), []);
  const { getFieldProps } = useTallyKeyboard({ onSubmit: tallySubmit, disabled: loading });

  // Form fields
  const [receiptDate, setReceiptDate] = useState<string>(
    () => new Date().toISOString().split('T')[0] || ''
  );
  const [revenueAccountId, setRevenueAccountId] = useState<string | null>(null);
  const [bankAccountId, setBankAccountId] = useState<string | null>(null);
  const [amount, setAmount] = useState<number>(0);
  const [paymentMethod, setPaymentMethod] = useState<PaymentMethod>('BANK_TRANSFER');
  const [chequeNumber, setChequeNumber] = useState<string>('');
  const [upiTransactionId, setUpiTransactionId] = useState<string>('');
  const [description, setDescription] = useState<string>('');
  const [reference, setReference] = useState<string>('');
  const [projectId, setProjectId] = useState<string | null>(null);
  const [entityId, setEntityId] = useState<string | null>(null);
  const [entityName, setEntityName] = useState<string>('');

  // Track selected bank account details for GL entries
  const [bankAccountCode, setBankAccountCode] = useState<string>('');
  const [bankAccountName, setBankAccountName] = useState<string>('');

  // Reset form when dialog opens/closes
  useEffect(() => {
    if (open) {
      if (editingReceipt) {
        const dateVal = editingReceipt.receiptDate;
        let dateStr = '';
        if (dateVal) {
          if (typeof (dateVal as { toDate?: () => Date }).toDate === 'function') {
            dateStr =
              (dateVal as { toDate: () => Date }).toDate().toISOString().split('T')[0] || '';
          } else if (dateVal instanceof Date) {
            dateStr = dateVal.toISOString().split('T')[0] || '';
          } else if (typeof dateVal === 'string') {
            dateStr = dateVal;
          }
        }
        setReceiptDate(dateStr || new Date().toISOString().split('T')[0] || '');
        setRevenueAccountId(editingReceipt.revenueAccountId || null);
        setBankAccountId(editingReceipt.bankAccountId || null);
        setBankAccountName(editingReceipt.bankAccountName || '');
        setAmount(editingReceipt.amount ?? 0);
        setPaymentMethod(editingReceipt.paymentMethod || 'BANK_TRANSFER');
        setChequeNumber(editingReceipt.chequeNumber || '');
        setUpiTransactionId(editingReceipt.upiTransactionId || '');
        setDescription(editingReceipt.description || '');
        setReference(editingReceipt.reference || '');
        setProjectId(editingReceipt.projectId || null);
        setEntityId(editingReceipt.entityId || null);
        setEntityName(editingReceipt.entityName || '');
      } else {
        setReceiptDate(new Date().toISOString().split('T')[0] || '');
        setRevenueAccountId(null);
        setBankAccountId(null);
        setBankAccountName('');
        setAmount(0);
        setPaymentMethod('BANK_TRANSFER');
        setChequeNumber('');
        setUpiTransactionId('');
        setDescription('');
        setReference('');
        setProjectId(null);
        setEntityId(null);
        setEntityName('');
      }
      setError('');
    }
  }, [open, editingReceipt]);

  // Pre-select the operating bank account on new receipts (feedback 2CzHpyR8).
  // Rule 15: AccountSelector's onAccountSelect fires only on user interaction,
  // so setting the id alone would leave bankAccountCode/bankAccountName empty —
  // and both feed the GL entry below. All three are set here.
  useEffect(() => {
    if (!open || editingReceipt) return;
    let cancelled = false;
    (async () => {
      const { db } = getFirebase();
      const account = await getDefaultBankAccount(db);
      if (cancelled || !account) return;
      setBankAccountId((current) => {
        if (current) return current; // user already picked one
        setBankAccountCode(account.code);
        setBankAccountName(account.name);
        return account.id;
      });
    })();
    return () => {
      cancelled = true;
    };
  }, [open, editingReceipt]);

  const handleSubmit = async () => {
    // Validation
    if (!revenueAccountId) {
      setError('Please select an income/revenue account');
      return;
    }

    if (!bankAccountId) {
      setError('Please select a bank account');
      return;
    }

    if (!receiptDate) {
      setError('Please select a receipt date');
      return;
    }

    if (amount <= 0) {
      setError('Amount must be greater than zero');
      return;
    }

    // Cheque / UPI validation removed with the Receipt Method selector
    // (feedback 2CzHpyR8) — paymentMethod can no longer be anything but
    // BANK_TRANSFER, so both branches were unreachable.

    setLoading(true);
    setError('');

    try {
      const { db } = getFirebase();

      // Generate transaction number for new receipts
      let transactionNumber = editingReceipt?.transactionNumber;
      if (!editingReceipt) {
        transactionNumber = await retryOnStaleToken(() =>
          generateTransactionNumber('DIRECT_RECEIPT')
        );
      }

      // Generate GL entries (reverse of Direct Payment)
      // Dr. Bank Account (asset increases — money received)
      // Cr. Revenue/Income Account (income increases)
      const entries: LedgerEntry[] = [
        {
          accountId: bankAccountId,
          accountCode: bankAccountCode,
          accountName: bankAccountName || 'Bank Account',
          debit: amount,
          credit: 0,
          description: description || 'Direct receipt',
          ...(projectId && { costCentreId: projectId }),
        },
        {
          accountId: revenueAccountId,
          accountCode: '',
          accountName: description || 'Direct receipt income',
          debit: 0,
          credit: amount,
          description: description || 'Direct receipt',
          ...(projectId && { costCentreId: projectId }),
        },
      ];

      // Build receipt data
      const receiptData: Record<string, unknown> = {
        type: 'DIRECT_RECEIPT',
        transactionNumber: transactionNumber || '',
        referenceNumber: transactionNumber || '',
        transactionDate: Timestamp.fromDate(new Date(receiptDate)),
        receiptDate: Timestamp.fromDate(new Date(receiptDate)),
        paymentDate: Timestamp.fromDate(new Date(receiptDate)), // For compatibility with payments query
        revenueAccountId,
        bankAccountId,
        paymentMethod,
        totalAmount: amount,
        amount,
        description: description || 'Direct receipt',
        reference: reference || '',
        status: 'POSTED',
        entries,
        ...(editingReceipt ? {} : { createdAt: Timestamp.now() }),
        updatedAt: Timestamp.now(),
        // Required BaseTransaction fields
        date: Timestamp.fromDate(new Date(receiptDate)),
        currency: 'INR',
        baseAmount: amount,
        attachments: [],
        createdBy: user?.uid || 'unknown',
      };

      // Conditionally add optional fields
      // No longer gated on paymentMethod (always BANK_TRANSFER) so a document
      // already carrying a cheque or UPI value keeps it when edited (rule 22).
      if (chequeNumber) {
        receiptData.chequeNumber = chequeNumber;
      }
      if (upiTransactionId) {
        receiptData.upiTransactionId = upiTransactionId;
      }
      if (projectId) {
        receiptData.projectId = projectId;
        receiptData.costCentreId = projectId;
      }
      if (entityId) {
        receiptData.entityId = entityId;
        receiptData.entityName = entityName;
      }

      // Remove undefined values (Firestore doesn't accept undefined)
      Object.keys(receiptData).forEach((key) => {
        if (receiptData[key] === undefined) {
          delete receiptData[key];
        }
      });

      if (editingReceipt?.id) {
        const editingReceiptId = editingReceipt.id;
        // Update existing receipt
        await retryOnStaleToken(() =>
          updateDoc(doc(db, COLLECTIONS.TRANSACTIONS, editingReceiptId), receiptData)
        );

        // Audit log: receipt updated
        if (user) {
          const auditContext = createAuditContext(
            user.uid,
            user.email || '',
            user.displayName || user.email || ''
          );
          await retryOnStaleToken(() =>
            logAuditEvent(
              db,
              auditContext,
              'PAYMENT_UPDATED',
              'PAYMENT',
              editingReceiptId,
              `Direct receipt ${transactionNumber} updated`,
              {
                entityName: transactionNumber,
                metadata: {
                  amount,
                  paymentMethod,
                  revenueAccountId,
                },
              }
            )
          );
        }
      } else {
        // Create new receipt
        const docRef = await retryOnStaleToken(() =>
          addDoc(collection(db, COLLECTIONS.TRANSACTIONS), receiptData)
        );

        // Audit log: receipt created
        if (user) {
          const auditContext = createAuditContext(
            user.uid,
            user.email || '',
            user.displayName || user.email || ''
          );
          await retryOnStaleToken(() =>
            logAuditEvent(
              db,
              auditContext,
              'PAYMENT_CREATED',
              'PAYMENT',
              docRef.id,
              `Direct receipt ${transactionNumber} created`,
              {
                entityName: transactionNumber,
                metadata: {
                  amount,
                  paymentMethod,
                  revenueAccountId,
                },
              }
            )
          );
        }
      }

      onClose();
    } catch (err) {
      console.error('[RecordDirectReceiptDialog] Error saving receipt:', err);
      setError(err instanceof Error ? err.message : 'Failed to save receipt. Please try again.');
    } finally {
      setLoading(false);
    }
  };
  submitRef.current = handleSubmit;

  return (
    <FormDialog
      open={open}
      onClose={onClose}
      title={editingReceipt ? 'Edit Direct Receipt' : 'Record Direct Receipt'}
      maxWidth="md"
    >
      <Box sx={{ p: 2 }}>
        {error && (
          <Typography color="error" sx={{ mb: 2 }}>
            {error}
          </Typography>
        )}

        <Alert severity="info" sx={{ mb: 3 }}>
          Use this form to record receipts directly to income/revenue accounts (e.g., miscellaneous
          income, interest received, insurance claims) without creating a customer invoice first.
        </Alert>

        <Grid container spacing={3}>
          {/* Receipt Details */}
          <Grid size={{ xs: 12 }}>
            <Typography variant="h6" gutterBottom>
              Receipt Details
            </Typography>
          </Grid>

          <Grid size={{ xs: 12, md: 6 }}>
            <TextField
              fullWidth
              label="Receipt Date"
              type="date"
              value={receiptDate}
              onChange={(e) => setReceiptDate(e.target.value)}
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

          {/* Customer / Payer selector removed (feedback rJWZINOx) — a direct
              receipt is by definition not tied to a customer record. State and
              persistence are kept so receipts created before the removal keep
              their stored entity when edited (rule 22). */}

          {/* Account Selection */}
          <Grid size={{ xs: 12 }}>
            <Typography variant="h6" gutterBottom sx={{ mt: 2 }}>
              Account Selection
            </Typography>
          </Grid>

          <Grid size={{ xs: 12, md: 6 }}>
            <AccountSelector
              value={revenueAccountId}
              onChange={setRevenueAccountId}
              label="Account to Credit"
              excludeGroups
              required
              placeholder="Search chart of accounts..."
              {...getFieldProps(2, { isAutocomplete: true })}
            />
          </Grid>

          <Grid size={{ xs: 12, md: 6 }}>
            <AccountSelector
              value={bankAccountId}
              onChange={setBankAccountId}
              onAccountSelect={(account) => {
                setBankAccountCode(account?.code || '');
                setBankAccountName(account?.name || '');
              }}
              label="Bank Account (Deposited to)"
              filterByBankAccount
              excludeGroups
              required
              placeholder="Search bank accounts..."
              {...getFieldProps(3, { isAutocomplete: true })}
            />
          </Grid>

          {/* Receipt Method selector removed (feedback 2CzHpyR8), along with the
              Cheque Number / UPI Transaction ID fields it revealed. Every one of
              the 520 payment transactions on record used BANK_TRANSFER, so the
              choice was noise; paymentMethod is still written as BANK_TRANSFER
              and the cheque/UPI values are still persisted if a document
              somehow carries them. */}

          {/* Cost Centre selector removed (feedback mEx1X1qlKRqkCM8DZEYx) —
              existing payments keep their stored project on edit. */}

          {/* Reference field removed (feedback rJWZINOx) — the transaction
              number already identifies the receipt. State and persistence are
              kept so existing receipts keep their stored reference on edit. */}

          <Grid size={{ xs: 12 }}>
            <TextField
              fullWidth
              label="Description"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              multiline
              rows={2}
              placeholder="Receipt description (e.g., Interest received from bank, Insurance claim)"
              required
              {...getFieldProps(8, { multiline: true })}
            />
          </Grid>
        </Grid>
      </Box>

      <FormDialogActions
        onCancel={onClose}
        onSubmit={handleSubmit}
        submitLabel={editingReceipt ? 'Update Receipt' : 'Record Receipt'}
        loading={loading}
      />
    </FormDialog>
  );
}
