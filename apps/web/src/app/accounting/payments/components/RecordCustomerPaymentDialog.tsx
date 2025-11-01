'use client';

import React, { useState, useEffect } from 'react';
import {
  TextField,
  Grid,
  MenuItem,
  Box,
  Typography,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Paper,
  Stack,
} from '@mui/material';
import { FormDialog, FormDialogActions } from '@/components/common/forms/FormDialog';
import { EntitySelector } from '@/components/common/forms/EntitySelector';
import { getFirebase } from '@/lib/firebase';
import { collection, addDoc, updateDoc, doc, Timestamp, query, where, getDocs } from 'firebase/firestore';
import { COLLECTIONS } from '@vapour/firebase';
import type { CustomerPayment, CustomerInvoice, PaymentAllocation, PaymentMethod } from '@vapour/types';
import { generateTransactionNumber } from '@/lib/accounting/transactionNumberGenerator';
import { formatCurrency } from '@/lib/accounting/transactionHelpers';
import { processPaymentAllocations } from '@/lib/accounting/paymentHelpers';

interface RecordCustomerPaymentDialogProps {
  open: boolean;
  onClose: () => void;
  editingPayment?: CustomerPayment | null;
}

const PAYMENT_METHODS: PaymentMethod[] = [
  'CASH',
  'CHEQUE',
  'BANK_TRANSFER',
  'UPI',
  'CREDIT_CARD',
  'DEBIT_CARD',
  'OTHER',
];

export function RecordCustomerPaymentDialog({
  open,
  onClose,
  editingPayment,
}: RecordCustomerPaymentDialogProps) {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  // Form fields
  const [paymentDate, setPaymentDate] = useState<string>(() => new Date().toISOString().split('T')[0] || '');
  const [entityId, setEntityId] = useState<string | null>(null);
  const [entityName, setEntityName] = useState<string>('');
  const [amount, setAmount] = useState<number>(0);
  const [paymentMethod, setPaymentMethod] = useState<PaymentMethod>('BANK_TRANSFER');
  const [chequeNumber, setChequeNumber] = useState<string>('');
  const [upiTransactionId, setUpiTransactionId] = useState<string>('');
  const [bankAccountId, setBankAccountId] = useState<string>('');
  const [description, setDescription] = useState<string>('');
  const [reference, setReference] = useState<string>('');

  // Invoice allocation
  const [outstandingInvoices, setOutstandingInvoices] = useState<CustomerInvoice[]>([]);
  const [allocations, setAllocations] = useState<PaymentAllocation[]>([]);

  // Fetch outstanding invoices when customer changes
  useEffect(() => {
    async function fetchOutstandingInvoices() {
      if (!entityId) {
        setOutstandingInvoices([]);
        setAllocations([]);
        return;
      }

      const { db } = getFirebase();
      const transactionsRef = collection(db, COLLECTIONS.TRANSACTIONS);
      const q = query(
        transactionsRef,
        where('type', '==', 'CUSTOMER_INVOICE'),
        where('entityId', '==', entityId),
        where('status', 'in', ['POSTED', 'APPROVED'])
      );

      const snapshot = await getDocs(q);
      const invoices: CustomerInvoice[] = [];
      snapshot.forEach((doc) => {
        const data = doc.data() as CustomerInvoice;
        // Only include invoices with outstanding amounts
        if ((data.totalAmount || 0) > 0) {
          invoices.push({ ...data, id: doc.id });
        }
      });

      setOutstandingInvoices(invoices);

      // Initialize allocations
      const initialAllocations: PaymentAllocation[] = invoices.map(invoice => ({
        invoiceId: invoice.id!,
        invoiceNumber: invoice.transactionNumber || '',
        originalAmount: invoice.totalAmount || 0,
        allocatedAmount: 0,
        remainingAmount: invoice.totalAmount || 0,
      }));
      setAllocations(initialAllocations);
    }

    fetchOutstandingInvoices();
  }, [entityId]);

  // Reset form when dialog opens/closes
  useEffect(() => {
    if (open) {
      if (editingPayment) {
        const dateStr = editingPayment.paymentDate instanceof Date
          ? (editingPayment.paymentDate.toISOString().split('T')[0] || '')
          : (typeof editingPayment.paymentDate === 'string' ? editingPayment.paymentDate : '');
        setPaymentDate(dateStr || (new Date().toISOString().split('T')[0] || ''));
        setEntityId(editingPayment.entityId ?? null);
        setEntityName(editingPayment.entityName || '');
        setAmount(editingPayment.totalAmount || 0);
        setPaymentMethod(editingPayment.paymentMethod);
        setChequeNumber(editingPayment.chequeNumber || '');
        setUpiTransactionId(editingPayment.upiTransactionId || '');
        setBankAccountId(editingPayment.bankAccountId || '');
        setDescription(editingPayment.description || '');
        setReference(editingPayment.reference || '');
        setAllocations(editingPayment.invoiceAllocations || []);
      } else {
        setPaymentDate(new Date().toISOString().split('T')[0] || '');
        setEntityId(null);
        setEntityName('');
        setAmount(0);
        setPaymentMethod('BANK_TRANSFER');
        setChequeNumber('');
        setUpiTransactionId('');
        setBankAccountId('');
        setDescription('');
        setReference('');
        setAllocations([]);
      }
      setError('');
    }
  }, [open, editingPayment]);

  const handleAllocationChange = (invoiceId: string, allocatedAmount: number) => {
    setAllocations(prev => prev.map(allocation => {
      if (allocation.invoiceId === invoiceId) {
        return {
          ...allocation,
          allocatedAmount,
          remainingAmount: allocation.originalAmount - allocatedAmount,
        };
      }
      return allocation;
    }));
  };

  // Auto-distribute payment across invoices
  const handleAutoAllocate = () => {
    let remaining = amount;
    const newAllocations = allocations.map(allocation => {
      if (remaining <= 0) {
        return { ...allocation, allocatedAmount: 0 };
      }

      const toAllocate = Math.min(remaining, allocation.originalAmount);
      remaining -= toAllocate;

      return {
        ...allocation,
        allocatedAmount: toAllocate,
        remainingAmount: allocation.originalAmount - toAllocate,
      };
    });

    setAllocations(newAllocations);
  };

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
        transactionNumber = await generateTransactionNumber('CUSTOMER_PAYMENT');
      }

      // Only include allocations with non-zero amounts
      const validAllocations = allocations.filter(a => a.allocatedAmount > 0);

      const paymentData = {
        type: 'CUSTOMER_PAYMENT',
        transactionNumber: transactionNumber || '',
        entityId,
        entityName,
        paymentDate,
        paymentMethod,
        chequeNumber: paymentMethod === 'CHEQUE' ? chequeNumber : undefined,
        upiTransactionId: paymentMethod === 'UPI' ? upiTransactionId : undefined,
        bankAccountId: bankAccountId || undefined,
        invoiceAllocations: validAllocations,
        depositedToBankAccountId: bankAccountId || '', // Required field
        totalAmount: amount,
        description: description || `Payment from ${entityName}`,
        reference,
        status: 'POSTED',
        createdAt: Timestamp.now() as any,
        updatedAt: Timestamp.now() as any,
        // Required BaseTransaction fields
        date: paymentDate as any,
        amount,
        currency: 'INR',
        baseAmount: amount,
        entries: [],
        attachments: [],
        createdBy: 'current-user', // TODO: Get from auth context
      } as any;

      if (editingPayment?.id) {
        // Update existing payment
        await updateDoc(doc(db, COLLECTIONS.TRANSACTIONS, editingPayment.id), {
          ...paymentData,
          updatedAt: Timestamp.now(),
        });
      } else {
        // Create new payment
        await addDoc(collection(db, COLLECTIONS.TRANSACTIONS), paymentData);
      }

      // Update invoice statuses based on allocations
      await processPaymentAllocations(db, validAllocations);

      onClose();
    } catch (err) {
      console.error('[RecordCustomerPaymentDialog] Error saving payment:', err);
      setError('Failed to save payment. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  const totalAllocated = allocations.reduce((sum, a) => sum + a.allocatedAmount, 0);
  const unallocated = amount - totalAllocated;

  return (
    <FormDialog
      open={open}
      onClose={onClose}
      title={editingPayment ? 'Edit Customer Receipt' : 'Record Customer Receipt'}
      maxWidth="lg"
    >
      <Box sx={{ p: 2 }}>
        {error && (
          <Typography color="error" sx={{ mb: 2 }}>
            {error}
          </Typography>
        )}

        <Grid container spacing={3}>
          {/* Payment Details */}
          <Grid size={{ xs: 12 }}>
            <Typography variant="h6" gutterBottom>Payment Details</Typography>
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
            <EntitySelector
              value={entityId}
              onChange={setEntityId}
              filterByRole="CUSTOMER"
              label="Customer"
              required
            />
          </Grid>

          <Grid size={{ xs: 12, md: 6 }}>
            <TextField
              fullWidth
              label="Amount Received"
              type="number"
              value={amount}
              onChange={(e) => setAmount(parseFloat(e.target.value) || 0)}
              slotProps={{ htmlInput: { min: 0, step: 0.01 } }}
              required
            />
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
            <TextField
              fullWidth
              label="Bank Account (Received in)"
              value={bankAccountId}
              onChange={(e) => setBankAccountId(e.target.value)}
              placeholder="Select bank account"
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
              placeholder="Payment description or notes"
            />
          </Grid>

          {/* Invoice Allocation */}
          {outstandingInvoices.length > 0 && (
            <>
              <Grid size={{ xs: 12 }}>
                <Stack direction="row" justifyContent="space-between" alignItems="center">
                  <Typography variant="h6">Allocate to Invoices</Typography>
                  <Box>
                    <Typography variant="body2" color="text.secondary">
                      Allocated: {formatCurrency(totalAllocated)} | Unallocated: {formatCurrency(unallocated)}
                    </Typography>
                    <button type="button" onClick={handleAutoAllocate} style={{ marginLeft: 8 }}>
                      Auto Allocate
                    </button>
                  </Box>
                </Stack>
              </Grid>

              <Grid size={{ xs: 12 }}>
                <TableContainer component={Paper} variant="outlined">
                  <Table size="small">
                    <TableHead>
                      <TableRow>
                        <TableCell>Invoice Number</TableCell>
                        <TableCell>Date</TableCell>
                        <TableCell align="right">Invoice Amount</TableCell>
                        <TableCell align="right">Allocate Amount</TableCell>
                        <TableCell align="right">Remaining</TableCell>
                      </TableRow>
                    </TableHead>
                    <TableBody>
                      {outstandingInvoices.map((invoice, index) => {
                        const allocation = allocations[index];
                        return (
                          <TableRow key={invoice.id}>
                            <TableCell>{invoice.transactionNumber}</TableCell>
                            <TableCell>
                              {new Date(invoice.date).toLocaleDateString()}
                            </TableCell>
                            <TableCell align="right">
                              {formatCurrency(allocation?.originalAmount || 0)}
                            </TableCell>
                            <TableCell align="right">
                              <TextField
                                type="number"
                                size="small"
                                value={allocation?.allocatedAmount || 0}
                                onChange={(e) => handleAllocationChange(
                                  invoice.id!,
                                  parseFloat(e.target.value) || 0
                                )}
                                slotProps={{ htmlInput: { min: 0, max: allocation?.originalAmount || 0, step: 0.01 } }}
                                sx={{ width: 120 }}
                              />
                            </TableCell>
                            <TableCell align="right">
                              {formatCurrency(allocation?.remainingAmount || 0)}
                            </TableCell>
                          </TableRow>
                        );
                      })}
                    </TableBody>
                  </Table>
                </TableContainer>
              </Grid>
            </>
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
