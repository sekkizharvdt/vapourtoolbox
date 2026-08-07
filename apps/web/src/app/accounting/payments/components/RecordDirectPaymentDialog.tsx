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

interface DirectPayment {
  id?: string;
  type: 'DIRECT_PAYMENT';
  transactionNumber: string;
  paymentDate: unknown;
  expenseAccountId: string;
  expenseAccountName?: string;
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

interface RecordDirectPaymentDialogProps {
  open: boolean;
  onClose: () => void;
  editingPayment?: DirectPayment | null;
}

export function RecordDirectPaymentDialog({
  open,
  onClose,
  editingPayment,
}: RecordDirectPaymentDialogProps) {
  const { user } = useAuth();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const submitRef = useRef<() => void>(() => {});
  const tallySubmit = useCallback(() => submitRef.current(), []);
  const { getFieldProps } = useTallyKeyboard({ onSubmit: tallySubmit, disabled: loading });

  // Form fields
  const [paymentDate, setPaymentDate] = useState<string>(
    () => new Date().toISOString().split('T')[0] || ''
  );
  const [expenseAccountId, setExpenseAccountId] = useState<string | null>(null);
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
      if (editingPayment) {
        const dateVal = editingPayment.paymentDate;
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
        setPaymentDate(dateStr || new Date().toISOString().split('T')[0] || '');
        setExpenseAccountId(editingPayment.expenseAccountId || null);
        setBankAccountId(editingPayment.bankAccountId || null);
        setAmount(editingPayment.amount ?? 0);
        setPaymentMethod(editingPayment.paymentMethod || 'BANK_TRANSFER');
        setChequeNumber(editingPayment.chequeNumber || '');
        setUpiTransactionId(editingPayment.upiTransactionId || '');
        setDescription(editingPayment.description || '');
        setReference(editingPayment.reference || '');
        setProjectId(editingPayment.projectId || null);
        setEntityId(editingPayment.entityId || null);
        setEntityName(editingPayment.entityName || '');
      } else {
        setPaymentDate(new Date().toISOString().split('T')[0] || '');
        setExpenseAccountId(null);
        setBankAccountId(null);
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
  }, [open, editingPayment]);

  // Pre-select the operating bank account on new payments (feedback 2CzHpyR8).
  // Rule 15: AccountSelector's onAccountSelect fires only on user interaction,
  // so setting the id alone would leave bankAccountCode/bankAccountName empty —
  // and both feed the GL entry below. All three are set here.
  useEffect(() => {
    if (!open || editingPayment) return;
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
  }, [open, editingPayment]);

  const handleSubmit = async () => {
    // Validation
    if (!expenseAccountId) {
      setError('Please select an expense/income account');
      return;
    }

    if (!bankAccountId) {
      setError('Please select a bank account');
      return;
    }

    if (!paymentDate) {
      setError('Please select a payment date');
      return;
    }

    if (amount <= 0) {
      setError('Amount must be greater than zero');
      return;
    }

    // Cheque / UPI validation removed with the Payment Method selector
    // (feedback 2CzHpyR8) — paymentMethod can no longer be anything but
    // BANK_TRANSFER, so both branches were unreachable.

    setLoading(true);
    setError('');

    try {
      const { db } = getFirebase();

      // Generate transaction number for new payments
      let transactionNumber = editingPayment?.transactionNumber;
      if (!editingPayment) {
        transactionNumber = await retryOnStaleToken(() =>
          generateTransactionNumber('DIRECT_PAYMENT')
        );
      }

      // Generate GL entries
      // Dr. Expense Account (expense increases)
      // Cr. Bank Account (asset decreases)
      const entries: LedgerEntry[] = [
        {
          accountId: expenseAccountId,
          accountCode: '',
          accountName: description || 'Direct payment expense',
          debit: amount,
          credit: 0,
          description: description || 'Direct payment',
          ...(projectId && { costCentreId: projectId }),
        },
        {
          accountId: bankAccountId,
          accountCode: bankAccountCode,
          accountName: bankAccountName || 'Bank Account',
          debit: 0,
          credit: amount,
          description: description || 'Direct payment',
          ...(projectId && { costCentreId: projectId }),
        },
      ];

      // Build payment data
      const paymentData: Record<string, unknown> = {
        type: 'DIRECT_PAYMENT',
        transactionNumber: transactionNumber || '',
        referenceNumber: transactionNumber || '',
        transactionDate: Timestamp.fromDate(new Date(paymentDate)),
        paymentDate: Timestamp.fromDate(new Date(paymentDate)),
        expenseAccountId,
        bankAccountId,
        paymentMethod,
        totalAmount: amount,
        amount,
        description: description || 'Direct payment',
        reference: reference || '',
        status: 'POSTED',
        entries,
        ...(editingPayment ? {} : { createdAt: Timestamp.now() }),
        updatedAt: Timestamp.now(),
        // Required BaseTransaction fields
        date: Timestamp.fromDate(new Date(paymentDate)),
        currency: 'INR',
        baseAmount: amount,
        attachments: [],
        createdBy: user?.uid || 'unknown',
      };

      // Conditionally add optional fields. No longer gated on paymentMethod
      // (which is now always BANK_TRANSFER) so that a document already carrying
      // a cheque or UPI value keeps it when edited (rule 22).
      if (chequeNumber) {
        paymentData.chequeNumber = chequeNumber;
      }
      if (upiTransactionId) {
        paymentData.upiTransactionId = upiTransactionId;
      }
      if (projectId) {
        paymentData.projectId = projectId;
        paymentData.costCentreId = projectId;
      }
      if (entityId) {
        paymentData.entityId = entityId;
        paymentData.entityName = entityName;
      }

      // Remove undefined values (Firestore doesn't accept undefined)
      Object.keys(paymentData).forEach((key) => {
        if (paymentData[key] === undefined) {
          delete paymentData[key];
        }
      });

      if (editingPayment?.id) {
        const editingPaymentId = editingPayment.id;
        // Update existing payment
        await retryOnStaleToken(() =>
          updateDoc(doc(db, COLLECTIONS.TRANSACTIONS, editingPaymentId), paymentData)
        );

        // Audit log: payment updated
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
              editingPaymentId,
              `Direct payment ${transactionNumber} updated`,
              {
                entityName: transactionNumber,
                metadata: {
                  amount,
                  paymentMethod,
                  expenseAccountId,
                },
              }
            )
          );
        }
      } else {
        // Create new payment
        const docRef = await retryOnStaleToken(() =>
          addDoc(collection(db, COLLECTIONS.TRANSACTIONS), paymentData)
        );

        // Audit log: payment created
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
              `Direct payment ${transactionNumber} created`,
              {
                entityName: transactionNumber,
                metadata: {
                  amount,
                  paymentMethod,
                  expenseAccountId,
                },
              }
            )
          );
        }
      }

      onClose();
    } catch (err) {
      console.error('[RecordDirectPaymentDialog] Error saving payment:', err);
      setError(err instanceof Error ? err.message : 'Failed to save payment. Please try again.');
    } finally {
      setLoading(false);
    }
  };
  submitRef.current = handleSubmit;

  return (
    <FormDialog
      open={open}
      onClose={onClose}
      title={editingPayment ? 'Edit Direct Payment' : 'Record Direct Payment'}
      maxWidth="md"
    >
      <Box sx={{ p: 2 }}>
        {error && (
          <Typography color="error" sx={{ mb: 2 }}>
            {error}
          </Typography>
        )}

        <Alert severity="info" sx={{ mb: 3 }}>
          Use this form to record payments directly to expense accounts (e.g., travel expenses,
          utilities, subscriptions) without creating a vendor bill first.
        </Alert>

        <Grid container spacing={3}>
          {/* Payment Details */}
          <Grid size={{ xs: 12 }}>
            <Typography variant="h6" gutterBottom>
              Payment Details
            </Typography>
          </Grid>

          <Grid size={{ xs: 12, md: 6 }}>
            <TextField
              fullWidth
              label="Payment Date"
              type="date"
              value={paymentDate}
              onChange={(e) => setPaymentDate(e.target.value)}
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

          {/* Vendor / Payee selector removed (feedback rJWZINOx) — a direct
              payment is by definition not tied to a vendor record. State and
              persistence are kept so payments created before the removal keep
              their stored entity when edited (rule 22). */}

          {/* Account Selection */}
          <Grid size={{ xs: 12 }}>
            <Typography variant="h6" gutterBottom sx={{ mt: 2 }}>
              Account Selection
            </Typography>
          </Grid>

          <Grid size={{ xs: 12, md: 6 }}>
            <AccountSelector
              value={expenseAccountId}
              onChange={setExpenseAccountId}
              label="Account to Debit"
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
              label="Bank Account (Paid from)"
              filterByBankAccount
              excludeGroups
              required
              placeholder="Search bank accounts..."
              {...getFieldProps(3, { isAutocomplete: true })}
            />
          </Grid>

          {/* Payment Method selector removed (feedback 2CzHpyR8), along with the
              Cheque Number / UPI Transaction ID fields it revealed. Every one of
              the 520 payment transactions on record used BANK_TRANSFER, so the
              choice was noise; paymentMethod is still written as BANK_TRANSFER
              and the cheque/UPI values are still persisted if a document
              somehow carries them. */}

          {/* Cost Centre selector removed (feedback mEx1X1qlKRqkCM8DZEYx) —
              existing payments keep their stored project on edit. */}

          {/* Reference field removed (feedback rJWZINOx) — the transaction
              number already identifies the payment. State and persistence are
              kept so existing payments keep their stored reference on edit. */}

          <Grid size={{ xs: 12 }}>
            <TextField
              fullWidth
              label="Description"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              multiline
              rows={2}
              placeholder="Payment description (e.g., Taxi fare for client meeting)"
              required
              {...getFieldProps(8, { multiline: true })}
            />
          </Grid>
        </Grid>
      </Box>

      <FormDialogActions
        onCancel={onClose}
        onSubmit={handleSubmit}
        submitLabel={editingPayment ? 'Update Payment' : 'Record Payment'}
        loading={loading}
      />
    </FormDialog>
  );
}
