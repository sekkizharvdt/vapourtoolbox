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
        setAmount(editingReceipt.amount || 0);
        setPaymentMethod(editingReceipt.paymentMethod || 'BANK_TRANSFER');
        setChequeNumber(editingReceipt.chequeNumber || '');
        setUpiTransactionId(editingReceipt.upiTransactionId || '');
        setDescription(editingReceipt.description || '');
        setReference(editingReceipt.reference || '');
        setProjectId(editingReceipt.projectId || null);
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
      }
      setError('');
    }
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

      // Generate transaction number for new receipts
      let transactionNumber = editingReceipt?.transactionNumber;
      if (!editingReceipt) {
        transactionNumber = await generateTransactionNumber('DIRECT_RECEIPT');
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
      if (paymentMethod === 'CHEQUE' && chequeNumber) {
        receiptData.chequeNumber = chequeNumber;
      }
      if (paymentMethod === 'UPI' && upiTransactionId) {
        receiptData.upiTransactionId = upiTransactionId;
      }
      if (projectId) {
        receiptData.projectId = projectId;
        receiptData.costCentreId = projectId;
      }

      // Remove undefined values (Firestore doesn't accept undefined)
      Object.keys(receiptData).forEach((key) => {
        if (receiptData[key] === undefined) {
          delete receiptData[key];
        }
      });

      if (editingReceipt?.id) {
        // Update existing receipt
        await updateDoc(doc(db, COLLECTIONS.TRANSACTIONS, editingReceipt.id), receiptData);

        // Audit log: receipt updated
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
            editingReceipt.id,
            `Direct receipt ${transactionNumber} updated`,
            {
              entityName: transactionNumber,
              metadata: {
                amount,
                paymentMethod,
                revenueAccountId,
              },
            }
          );
        }
      } else {
        // Create new receipt
        const docRef = await addDoc(collection(db, COLLECTIONS.TRANSACTIONS), receiptData);

        // Audit log: receipt created
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
            `Direct receipt ${transactionNumber} created`,
            {
              entityName: transactionNumber,
              metadata: {
                amount,
                paymentMethod,
                revenueAccountId,
              },
            }
          );
        }
      }

      onClose();
    } catch (err) {
      console.error('[RecordDirectReceiptDialog] Error saving receipt:', err);
      setError('Failed to save receipt. Please try again.');
    } finally {
      setLoading(false);
    }
  };

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
              value={revenueAccountId}
              onChange={setRevenueAccountId}
              label="Income/Revenue Account"
              filterByType={['INCOME', 'ASSET']}
              excludeGroups
              required
              placeholder="Select account to credit"
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
            />
          </Grid>

          {/* Payment Method */}
          <Grid size={{ xs: 12 }}>
            <Typography variant="h6" gutterBottom sx={{ mt: 2 }}>
              Receipt Method
            </Typography>
          </Grid>

          <Grid size={{ xs: 12, md: 6 }}>
            <TextField
              fullWidth
              select
              label="Receipt Method"
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
              placeholder="Receipt description (e.g., Interest received from bank, Insurance claim)"
              required
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
