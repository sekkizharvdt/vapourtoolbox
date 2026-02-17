'use client';

import React, { useState, useEffect } from 'react';
import { TextField, Grid, MenuItem, Box, Typography, Alert } from '@mui/material';
import { FormDialog, FormDialogActions } from '@vapour/ui';
import { AccountSelector } from '@/components/common/forms/AccountSelector';
import { ProjectSelector } from '@/components/common/forms/ProjectSelector';
import { getFirebase } from '@/lib/firebase';
import { Timestamp, collection, addDoc, updateDoc, doc } from 'firebase/firestore';
import { useAuth } from '@/contexts/AuthContext';
import { COLLECTIONS } from '@vapour/firebase';
import type { PaymentMethod, LedgerEntry } from '@vapour/types';
import { generateTransactionNumber } from '@/lib/accounting/transactionNumberGenerator';
import { logAuditEvent, createAuditContext } from '@/lib/audit/clientAuditService';

const PAYMENT_METHODS: PaymentMethod[] = [
  'CASH',
  'CHEQUE',
  'BANK_TRANSFER',
  'UPI',
  'CREDIT_CARD',
  'DEBIT_CARD',
];

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
        setAmount(editingPayment.amount || 0);
        setPaymentMethod(editingPayment.paymentMethod || 'BANK_TRANSFER');
        setChequeNumber(editingPayment.chequeNumber || '');
        setUpiTransactionId(editingPayment.upiTransactionId || '');
        setDescription(editingPayment.description || '');
        setReference(editingPayment.reference || '');
        setProjectId(editingPayment.projectId || null);
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
      }
      setError('');
    }
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

    if (paymentMethod === 'CHEQUE' && !chequeNumber) {
      setError('Please enter cheque number');
      return;
    }

    if (paymentMethod === 'UPI' && !upiTransactionId) {
      setError('Please enter UPI transaction ID');
      return;
    }

    setLoading(true);
    setError('');

    try {
      const { db } = getFirebase();

      // Generate transaction number for new payments
      let transactionNumber = editingPayment?.transactionNumber;
      if (!editingPayment) {
        transactionNumber = await generateTransactionNumber('DIRECT_PAYMENT');
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
          costCentreId: projectId || undefined,
        },
        {
          accountId: bankAccountId,
          accountCode: bankAccountCode,
          accountName: bankAccountName || 'Bank Account',
          debit: 0,
          credit: amount,
          description: description || 'Direct payment',
          costCentreId: projectId || undefined,
        },
      ];

      // Build payment data
      const paymentData: Record<string, unknown> = {
        type: 'DIRECT_PAYMENT',
        transactionNumber: transactionNumber || '',
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
        createdAt: editingPayment ? undefined : Timestamp.now(),
        updatedAt: Timestamp.now(),
        // Required BaseTransaction fields
        date: Timestamp.fromDate(new Date(paymentDate)),
        currency: 'INR',
        baseAmount: amount,
        attachments: [],
        createdBy: user?.uid || 'unknown',
      };

      // Conditionally add optional fields
      if (paymentMethod === 'CHEQUE' && chequeNumber) {
        paymentData.chequeNumber = chequeNumber;
      }
      if (paymentMethod === 'UPI' && upiTransactionId) {
        paymentData.upiTransactionId = upiTransactionId;
      }
      if (projectId) {
        paymentData.projectId = projectId;
        paymentData.costCentreId = projectId;
      }

      // Remove undefined values (Firestore doesn't accept undefined)
      Object.keys(paymentData).forEach((key) => {
        if (paymentData[key] === undefined) {
          delete paymentData[key];
        }
      });

      if (editingPayment?.id) {
        // Update existing payment
        await updateDoc(doc(db, COLLECTIONS.TRANSACTIONS, editingPayment.id), paymentData);

        // Audit log: payment updated
        if (user) {
          const auditContext = createAuditContext(
            user.uid,
            user.email || '',
            user.displayName || user.email || ''
          );
          await logAuditEvent(
            db,
            auditContext,
            'PAYMENT_UPDATED',
            'PAYMENT',
            editingPayment.id,
            `Direct payment ${transactionNumber} updated`,
            {
              entityName: transactionNumber,
              metadata: {
                amount,
                paymentMethod,
                expenseAccountId,
              },
            }
          );
        }
      } else {
        // Create new payment
        const docRef = await addDoc(collection(db, COLLECTIONS.TRANSACTIONS), paymentData);

        // Audit log: payment created
        if (user) {
          const auditContext = createAuditContext(
            user.uid,
            user.email || '',
            user.displayName || user.email || ''
          );
          await logAuditEvent(
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
          );
        }
      }

      onClose();
    } catch (err) {
      console.error('[RecordDirectPaymentDialog] Error saving payment:', err);
      setError('Failed to save payment. Please try again.');
    } finally {
      setLoading(false);
    }
  };

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
            />
          </Grid>

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
              label="Expense/Income Account"
              filterByType={['EXPENSE', 'ASSET']}
              excludeGroups
              required
              placeholder="Select account to debit"
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
            />
          </Grid>

          {/* Payment Method */}
          <Grid size={{ xs: 12 }}>
            <Typography variant="h6" gutterBottom sx={{ mt: 2 }}>
              Payment Method
            </Typography>
          </Grid>

          <Grid size={{ xs: 12, md: 6 }}>
            <TextField
              fullWidth
              select
              label="Payment Method"
              value={paymentMethod}
              onChange={(e) => setPaymentMethod(e.target.value as PaymentMethod)}
              required
            >
              {PAYMENT_METHODS.map((method) => (
                <MenuItem key={method} value={method}>
                  {method.replace('_', ' ')}
                </MenuItem>
              ))}
            </TextField>
          </Grid>

          {paymentMethod === 'CHEQUE' && (
            <Grid size={{ xs: 12, md: 6 }}>
              <TextField
                fullWidth
                label="Cheque Number"
                value={chequeNumber}
                onChange={(e) => setChequeNumber(e.target.value)}
                required
              />
            </Grid>
          )}

          {paymentMethod === 'UPI' && (
            <Grid size={{ xs: 12, md: 6 }}>
              <TextField
                fullWidth
                label="UPI Transaction ID"
                value={upiTransactionId}
                onChange={(e) => setUpiTransactionId(e.target.value)}
                required
              />
            </Grid>
          )}

          <Grid size={{ xs: 12, md: 6 }}>
            <ProjectSelector
              value={projectId}
              onChange={setProjectId}
              label="Project / Cost Centre"
              onlyActive
            />
          </Grid>

          <Grid size={{ xs: 12, md: 6 }}>
            <TextField
              fullWidth
              label="Reference"
              value={reference}
              onChange={(e) => setReference(e.target.value)}
              placeholder="External reference number"
            />
          </Grid>

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
