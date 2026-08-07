'use client';

import React, { useState, useEffect, useRef, useCallback } from 'react';
import {
  TextField,
  Grid,
  MenuItem,
  Box,
  Typography,
  Alert,
  Checkbox,
  FormControlLabel,
} from '@mui/material';
import { FormDialog, FormDialogActions } from '@vapour/ui';
import { EntitySelector } from '@/components/common/forms/EntitySelector';
import { AccountSelector } from '@/components/common/forms/AccountSelector';
import { getFirebase } from '@/lib/firebase';
import { getDefaultBankAccount } from '@/lib/accounting/defaultBankAccount';
import { retryOnStaleToken } from '@/lib/firebase/retryOnStaleToken';
import { Timestamp } from 'firebase/firestore';
import type { CustomerPayment, PaymentMethod } from '@vapour/types';
import { generateTransactionNumber } from '@/lib/accounting/transactionNumberGenerator';
import {
  createPaymentWithAllocationsAtomic,
  updatePaymentWithAllocationsAtomic,
  isOpeningBalanceAllocation,
} from '@/lib/accounting/paymentHelpers';
import { useAuth } from '@/contexts/AuthContext';
import {
  logPaymentCreated,
  logPaymentUpdated,
  createAuditFieldChanges,
  type AuditUserContext,
} from '@/lib/accounting/auditLogger';
import { InvoiceAllocationTable, CURRENCIES, useOutstandingInvoices } from './customer-payment';
import { useTallyKeyboard } from '@/hooks/useTallyKeyboard';
import { getInrAmount } from '@/lib/accounting/amountHelpers';

interface RecordCustomerPaymentDialogProps {
  open: boolean;
  onClose: () => void;
  editingPayment?: CustomerPayment | null;
}

export function RecordCustomerPaymentDialog({
  open,
  onClose,
  editingPayment,
}: RecordCustomerPaymentDialogProps) {
  const { user, claims } = useAuth();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const submitRef = useRef<() => void>(() => {});
  const tallySubmit = useCallback(() => submitRef.current(), []);
  const { getFieldProps } = useTallyKeyboard({ onSubmit: tallySubmit, disabled: loading });

  // Form fields
  const [paymentDate, setPaymentDate] = useState<string>(
    () => new Date().toISOString().split('T')[0] || ''
  );
  const [entityId, setEntityId] = useState<string | null>(null);
  const [entityName, setEntityName] = useState<string>('');
  const [amount, setAmount] = useState<string>(''); // Changed to string to avoid leading zero
  const [currency, setCurrency] = useState<string>('INR');
  const [exchangeRate, setExchangeRate] = useState<string>('1');
  const [baseAmount, setBaseAmount] = useState<number>(0); // Amount in INR
  const [paymentMethod, setPaymentMethod] = useState<PaymentMethod>('BANK_TRANSFER');
  const [chequeNumber, setChequeNumber] = useState<string>('');
  const [upiTransactionId, setUpiTransactionId] = useState<string>('');
  const [bankAccountId, setBankAccountId] = useState<string>('');
  const [description, setDescription] = useState<string>('');
  const [reference, setReference] = useState<string>('');
  const [projectId, setProjectId] = useState<string | null>(null);
  const [isAdvance, setIsAdvance] = useState<boolean>(false);

  // Calculate base amount (INR) when amount or exchange rate changes
  useEffect(() => {
    const amountNum = parseFloat(amount) || 0;
    const rateNum = parseFloat(exchangeRate) || 1;
    setBaseAmount(amountNum * rateNum);
  }, [amount, exchangeRate]);

  // Invoice allocation (fetching, forex detection, opening balance, allocation helpers)
  const {
    outstandingInvoices,
    allocations,
    totalAllocated,
    unallocated,
    fetchError,
    handleAllocationChange,
    handleAutoAllocate,
    handleFillRemaining,
    setAllocations,
  } = useOutstandingInvoices({ entityId, editingPayment, baseAmount });

  // Reset form when dialog opens/closes
  useEffect(() => {
    if (open) {
      if (editingPayment) {
        const rawDate = editingPayment.paymentDate;
        const dateStr =
          rawDate && typeof rawDate === 'object' && 'toDate' in rawDate
            ? (rawDate as { toDate: () => Date }).toDate().toISOString().split('T')[0]
            : rawDate instanceof Date
              ? rawDate.toISOString().split('T')[0]
              : typeof rawDate === 'string'
                ? rawDate
                : '';
        setPaymentDate(dateStr || new Date().toISOString().split('T')[0] || '');
        setEntityId(editingPayment.entityId ?? null);
        setEntityName(editingPayment.entityName || '');
        setAmount(String(editingPayment.totalAmount || ''));
        setCurrency(editingPayment.currency || 'INR');
        setExchangeRate(String(editingPayment.exchangeRate || '1'));
        setBaseAmount(getInrAmount(editingPayment));
        setPaymentMethod(editingPayment.paymentMethod);
        setChequeNumber(editingPayment.chequeNumber || '');
        setUpiTransactionId(editingPayment.upiTransactionId || '');
        setBankAccountId(editingPayment.bankAccountId || '');
        setDescription(editingPayment.description || '');
        setReference(editingPayment.reference || '');
        setProjectId(editingPayment.projectId || null);
        setIsAdvance(editingPayment.isAdvance ?? false);
        setAllocations(editingPayment.invoiceAllocations || []);
      } else {
        setPaymentDate(new Date().toISOString().split('T')[0] || '');
        setEntityId(null);
        setEntityName('');
        setAmount('');
        setCurrency('INR');
        setExchangeRate('1');
        setBaseAmount(0);
        setPaymentMethod('BANK_TRANSFER');
        setChequeNumber('');
        setUpiTransactionId('');
        setBankAccountId('');
        setDescription('');
        setReference('');
        setProjectId(null);
        setIsAdvance(false);
        setAllocations([]);
      }
      setError('');
    }
  }, [open, editingPayment, setAllocations]);

  // Pre-select the operating bank account on new receipts (feedback 2CzHpyR8).
  // Rule 15: the selector's callbacks fire only on user interaction, so the id
  // is set directly here.
  useEffect(() => {
    if (!open || editingPayment) return;
    let cancelled = false;
    (async () => {
      const { db } = getFirebase();
      const account = await getDefaultBankAccount(db);
      if (cancelled || !account) return;
      setBankAccountId((current) => current || account.id);
    })();
    return () => {
      cancelled = true;
    };
  }, [open, editingPayment]);

  const handleSubmit = async () => {
    // Validation
    if (!entityId) {
      setError('Please select a customer');
      return;
    }

    if (!paymentDate) {
      setError('Please select a payment date');
      return;
    }

    const amountNum = parseFloat(amount);
    if (!amountNum || amountNum <= 0) {
      setError('Amount must be greater than zero');
      return;
    }

    if (currency !== 'INR') {
      const rateNum = parseFloat(exchangeRate);
      if (!rateNum || rateNum <= 0) {
        setError('Exchange rate must be greater than zero');
        return;
      }
    }

    // Cheque / UPI validation removed with the Payment Method selector
    // (feedback 2CzHpyR8) — paymentMethod can no longer be anything but
    // BANK_TRANSFER, so both branches were unreachable.

    // Require allocation unless marked as advance
    const validAllocationsCheck = allocations.filter((a) => a.allocatedAmount > 0);
    if (!isAdvance && validAllocationsCheck.length === 0) {
      setError(
        'Please allocate the payment to at least one invoice, or mark it as an advance payment.'
      );
      return;
    }

    setLoading(true);
    setError('');

    try {
      const { db } = getFirebase();

      // Generate transaction number for new payments
      let transactionNumber = editingPayment?.transactionNumber;
      if (!editingPayment) {
        transactionNumber = await retryOnStaleToken(() =>
          generateTransactionNumber('CUSTOMER_PAYMENT')
        );
      }

      // Only include allocations with non-zero amounts
      const validAllocations = allocations.filter((a) => a.allocatedAmount > 0);
      // Separate real invoice allocations from virtual opening balance allocations
      const realAllocations = validAllocations.filter((a) => !isOpeningBalanceAllocation(a));

      const paymentData: Record<string, unknown> = {
        type: 'CUSTOMER_PAYMENT',
        transactionNumber: transactionNumber || '',
        entityId,
        entityName,
        paymentDate: Timestamp.fromDate(new Date(paymentDate)),
        paymentMethod,
        invoiceAllocations: validAllocations, // Store full array (including opening balance)
        depositedToBankAccountId: bankAccountId || '', // Required field
        totalAmount: baseAmount,
        description: description || `Payment from ${entityName}`,
        reference,
        status: 'POSTED',
        createdAt: Timestamp.now(),
        updatedAt: Timestamp.now(),
        // Required BaseTransaction fields
        date: Timestamp.fromDate(new Date(paymentDate)),
        amount: parseFloat(amount) || 0,
        currency,
        baseAmount,
        entries: [],
        attachments: [],
        createdBy: user?.uid || 'system',
      };

      // Add exchange rate if foreign currency
      if (currency !== 'INR') {
        paymentData.exchangeRate = parseFloat(exchangeRate) || 1;
      }

      // Mark as advance if user indicated no invoice exists yet
      if (isAdvance) {
        paymentData.isAdvance = true;
      }

      // Only add optional fields if they have values
      // No longer gated on paymentMethod (always BANK_TRANSFER) so a document
      // already carrying a cheque or UPI value keeps it when edited (rule 22).
      if (chequeNumber) {
        paymentData.chequeNumber = chequeNumber;
      }
      if (upiTransactionId) {
        paymentData.upiTransactionId = upiTransactionId;
      }
      if (bankAccountId) {
        paymentData.bankAccountId = bankAccountId;
      }
      if (projectId) {
        paymentData.projectId = projectId;
        paymentData.costCentreId = projectId; // Same as projectId for consistency
      }

      // Prepare audit user context
      const auditUser: AuditUserContext = {
        userId: user?.uid || 'system',
        userEmail: user?.email || 'unknown',
        userName: user?.displayName || user?.email || 'Unknown User',
        userPermissions: claims?.permissions || 0,
        tenantId: claims?.tenantId || 'default-entity',
      };

      if (editingPayment?.id) {
        // Update existing payment atomically (only pass real allocations for invoice updates)
        const oldAllocations = (editingPayment.invoiceAllocations || []).filter(
          (a) => !isOpeningBalanceAllocation(a)
        );
        await retryOnStaleToken(() =>
          updatePaymentWithAllocationsAtomic(
            db,
            editingPayment.id,
            {
              ...paymentData,
              updatedAt: Timestamp.now(),
            },
            oldAllocations,
            realAllocations
          )
        );

        // Log payment update to audit trail
        const changes = createAuditFieldChanges(
          editingPayment as unknown as Record<string, unknown>,
          paymentData as Record<string, unknown>
        );
        await retryOnStaleToken(() =>
          logPaymentUpdated(db, auditUser, editingPayment.id, transactionNumber || '', changes)
        );
      } else {
        // Create new payment atomically (only pass real allocations for invoice updates)
        const paymentId = await retryOnStaleToken(() =>
          createPaymentWithAllocationsAtomic(db, paymentData, realAllocations)
        );

        // Log payment creation to audit trail
        await retryOnStaleToken(() =>
          logPaymentCreated(
            db,
            auditUser,
            paymentId,
            transactionNumber || '',
            parseFloat(amount) || 0,
            currency,
            entityId || ''
          )
        );
      }

      onClose();
    } catch (err) {
      console.error('[RecordCustomerPaymentDialog] Error saving payment:', err);
      // Show specific error message if available
      const errorMessage =
        err instanceof Error ? err.message : 'Failed to save payment. Please try again.';
      setError(errorMessage);
    } finally {
      setLoading(false);
    }
  };
  submitRef.current = handleSubmit;

  return (
    <FormDialog
      open={open}
      onClose={onClose}
      title={editingPayment ? 'Edit Customer Receipt' : 'Record Customer Receipt'}
      maxWidth="lg"
    >
      <Box sx={{ p: 2 }}>
        {(error || fetchError) && (
          <Typography color="error" sx={{ mb: 2 }}>
            {error || fetchError}
          </Typography>
        )}

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
            <EntitySelector
              value={entityId}
              onChange={setEntityId}
              onEntitySelect={(entity) => {
                setEntityName(entity?.name || '');
              }}
              filterByRole="CUSTOMER"
              label="Customer"
              required
              {...getFieldProps(1, { isAutocomplete: true })}
            />
          </Grid>

          {/* Cost Centre selector removed (feedback mEx1X1qlKRqkCM8DZEYx) —
              existing payments keep their stored project on edit. */}

          <Grid size={{ xs: 12, md: 6 }}>
            <TextField
              fullWidth
              label="Amount Received"
              type="number"
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
              slotProps={{ htmlInput: { min: 0, step: 0.01 } }}
              required
              {...getFieldProps(3)}
            />
          </Grid>

          <Grid size={{ xs: 12, md: 6 }}>
            <TextField
              fullWidth
              select
              label="Currency"
              value={currency}
              onChange={(e) => setCurrency(e.target.value)}
              required
              {...getFieldProps(4)}
            >
              {CURRENCIES.map((curr) => (
                <MenuItem key={curr.code} value={curr.code}>
                  {curr.code} - {curr.name}
                </MenuItem>
              ))}
            </TextField>
          </Grid>

          {currency !== 'INR' && (
            <>
              <Grid size={{ xs: 12, md: 6 }}>
                <TextField
                  fullWidth
                  label="Exchange Rate (Bank Conversion)"
                  type="number"
                  value={exchangeRate}
                  onChange={(e) => setExchangeRate(e.target.value)}
                  slotProps={{ htmlInput: { min: 0, step: 0.0001 } }}
                  helperText={`1 ${currency} = ${exchangeRate} INR`}
                  required
                />
              </Grid>

              <Grid size={{ xs: 12, md: 6 }}>
                <TextField
                  fullWidth
                  label="Base Amount (INR)"
                  type="number"
                  value={baseAmount.toFixed(2)}
                  disabled
                  helperText="Calculated amount in INR"
                />
              </Grid>
            </>
          )}

          {/* Payment Method selector removed (feedback 2CzHpyR8), along with the
              Cheque Number / UPI Transaction ID fields it revealed. Every one of
              the 520 payment transactions on record used BANK_TRANSFER, so the
              choice was noise; paymentMethod is still written as BANK_TRANSFER
              and the cheque/UPI values are still persisted if a document
              somehow carries them. */}

          <Grid size={{ xs: 12, md: 6 }}>
            <AccountSelector
              value={bankAccountId || null}
              onChange={(id) => setBankAccountId(id || '')}
              label="Bank Account (Received in)"
              filterByBankAccount
              excludeGroups
              placeholder="Search bank accounts..."
              {...getFieldProps(7, { isAutocomplete: true })}
            />
          </Grid>

          <Grid size={{ xs: 12, md: 6 }}>
            <TextField
              fullWidth
              label="Reference"
              value={reference}
              onChange={(e) => setReference(e.target.value)}
              placeholder="External reference number"
              {...getFieldProps(8)}
            />
          </Grid>

          {/* Description input removed (feedback cV8qdAn3Ejo0lnoZb0Xm): the
              narrative lives on the customer invoice; the payment stores an
              auto-generated "Payment from <customer>" (edits keep any existing
              custom text via the state restore). */}

          {/* Invoice Allocation */}
          <InvoiceAllocationTable
            outstandingInvoices={outstandingInvoices}
            allocations={allocations}
            totalAllocated={totalAllocated}
            unallocated={unallocated}
            onAllocationChange={handleAllocationChange}
            onAutoAllocate={handleAutoAllocate}
            onFillRemaining={handleFillRemaining}
          />

          {unallocated > 0.01 && outstandingInvoices.length > 0 && baseAmount > 0 && (
            <Grid size={{ xs: 12 }}>
              <Alert severity="info">
                Unallocated amount of{' '}
                {unallocated.toLocaleString('en-IN', {
                  style: 'currency',
                  currency: 'INR',
                })}{' '}
                will be recorded as advance/credit for this customer.
              </Alert>
            </Grid>
          )}

          {totalAllocated === 0 && baseAmount > 0 && (
            <Grid size={{ xs: 12 }}>
              <FormControlLabel
                control={
                  <Checkbox checked={isAdvance} onChange={(e) => setIsAdvance(e.target.checked)} />
                }
                label="Mark as advance receipt (payment received before invoice is raised)"
              />
            </Grid>
          )}
        </Grid>
      </Box>

      <FormDialogActions
        onCancel={onClose}
        onSubmit={handleSubmit}
        submitLabel={editingPayment ? 'Update Receipt' : 'Record Receipt'}
        loading={loading}
      />
    </FormDialog>
  );
}
