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
  Checkbox,
  FormControlLabel,
  Button,
  Alert,
  Chip,
  CircularProgress,
} from '@mui/material';
import { FormDialog, FormDialogActions } from '@vapour/ui';
import { EntitySelector } from '@/components/common/forms/EntitySelector';
import { ProjectSelector } from '@/components/common/forms/ProjectSelector';
import { getFirebase } from '@/lib/firebase';
import { Timestamp, query, collection, where, getDocs } from 'firebase/firestore';
import { useAuth } from '@/contexts/AuthContext';
import { COLLECTIONS } from '@vapour/firebase';
import type { VendorPayment, VendorBill, PaymentAllocation, PaymentMethod } from '@vapour/types';
import { generateTransactionNumber } from '@/lib/accounting/transactionNumberGenerator';
import { formatCurrency } from '@/lib/accounting/transactionHelpers';
import {
  createPaymentWithAllocationsAtomic,
  updatePaymentWithAllocationsAtomic,
} from '@/lib/accounting/paymentHelpers';

interface RecordVendorPaymentDialogProps {
  open: boolean;
  onClose: () => void;
  editingPayment?: VendorPayment | null;
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

const TDS_SECTIONS = [
  { code: '194C', name: 'Contractors - 2%', rate: 2 },
  { code: '194J', name: 'Professional Services - 10%', rate: 10 },
  { code: '194H', name: 'Commission/Brokerage - 5%', rate: 5 },
  { code: '194I', name: 'Rent - 10%', rate: 10 },
  { code: '194A', name: 'Interest (Other than Securities) - 10%', rate: 10 },
];

export function RecordVendorPaymentDialog({
  open,
  onClose,
  editingPayment,
}: RecordVendorPaymentDialogProps) {
  const { user } = useAuth();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  // Form fields
  const [paymentDate, setPaymentDate] = useState<string>(
    () => new Date().toISOString().split('T')[0] || ''
  );
  const [entityId, setEntityId] = useState<string | null>(null);
  const [entityName, setEntityName] = useState<string>('');
  const [amount, setAmount] = useState<number>(0);
  const [paymentMethod, setPaymentMethod] = useState<PaymentMethod>('BANK_TRANSFER');
  const [chequeNumber, setChequeNumber] = useState<string>('');
  const [upiTransactionId, setUpiTransactionId] = useState<string>('');
  const [bankAccountId, setBankAccountId] = useState<string>('');
  const [description, setDescription] = useState<string>('');
  const [reference, setReference] = useState<string>('');
  const [projectId, setProjectId] = useState<string | null>(null);

  // TDS fields
  const [tdsDeducted, setTdsDeducted] = useState<boolean>(false);
  const [tdsSection, setTdsSection] = useState<string>('');
  const [tdsAmount, setTdsAmount] = useState<number>(0);

  // Bill allocation
  const [outstandingBills, setOutstandingBills] = useState<VendorBill[]>([]);
  const [allocations, setAllocations] = useState<PaymentAllocation[]>([]);
  const [loadingBills, setLoadingBills] = useState(false);
  const [totalOutstanding, setTotalOutstanding] = useState(0);

  // Fetch outstanding bills when vendor changes
  useEffect(() => {
    async function fetchOutstandingBills() {
      if (!entityId) {
        setOutstandingBills([]);
        setAllocations([]);
        setTotalOutstanding(0);
        return;
      }

      setLoadingBills(true);
      try {
        const { db } = getFirebase();
        const transactionsRef = collection(db, COLLECTIONS.TRANSACTIONS);
        const q = query(
          transactionsRef,
          where('type', '==', 'VENDOR_BILL'),
          where('entityId', '==', entityId),
          where('status', 'in', ['POSTED', 'APPROVED'])
        );

        const snapshot = await getDocs(q);
        const bills: VendorBill[] = [];
        let totalOutstandingAmount = 0;

        snapshot.forEach((doc) => {
          const data = doc.data() as VendorBill;
          // Use outstandingAmount for partially paid bills, fallback to totalAmount
          const outstanding = data.outstandingAmount ?? data.totalAmount ?? 0;
          // Only include bills with outstanding amounts > 0
          if (outstanding > 0) {
            bills.push({ ...data, id: doc.id, outstandingAmount: outstanding });
            totalOutstandingAmount += outstanding;
          }
        });

        // Sort bills by date (oldest first for FIFO payment)
        bills.sort((a, b) => {
          const getTime = (date: unknown): number => {
            if (!date) return 0;
            if (typeof (date as { toMillis?: () => number }).toMillis === 'function') {
              return (date as { toMillis: () => number }).toMillis();
            }
            return new Date(date as string | number).getTime();
          };
          return getTime(a.date) - getTime(b.date);
        });

        setOutstandingBills(bills);
        setTotalOutstanding(totalOutstandingAmount);

        // Initialize allocations using outstanding amount (not total amount)
        const initialAllocations: PaymentAllocation[] = bills.map((bill) => {
          const outstanding = bill.outstandingAmount ?? bill.totalAmount ?? 0;
          return {
            invoiceId: bill.id!,
            invoiceNumber: bill.transactionNumber || '',
            originalAmount: outstanding,
            allocatedAmount: 0,
            remainingAmount: outstanding,
          };
        });
        setAllocations(initialAllocations);
      } catch (err) {
        console.error('[RecordVendorPaymentDialog] Error fetching bills:', err);
      } finally {
        setLoadingBills(false);
      }
    }

    fetchOutstandingBills();
  }, [entityId]);

  // Calculate TDS when section changes
  useEffect(() => {
    if (tdsDeducted && tdsSection) {
      const section = TDS_SECTIONS.find((s) => s.code === tdsSection);
      if (section) {
        const totalBillAmount = allocations.reduce((sum, a) => sum + a.allocatedAmount, 0);
        const calculatedTds = (totalBillAmount * section.rate) / 100;
        setTdsAmount(calculatedTds);
      }
    } else {
      setTdsAmount(0);
    }
  }, [tdsDeducted, tdsSection, allocations]);

  // Reset form when dialog opens/closes
  useEffect(() => {
    if (open) {
      if (editingPayment) {
        const dateStr =
          editingPayment.paymentDate instanceof Date
            ? editingPayment.paymentDate.toISOString().split('T')[0] || ''
            : typeof editingPayment.paymentDate === 'string'
              ? editingPayment.paymentDate
              : '';
        setPaymentDate(dateStr || new Date().toISOString().split('T')[0] || '');
        setEntityId(editingPayment.entityId ?? null);
        setEntityName(editingPayment.entityName || '');
        setAmount(editingPayment.totalAmount || 0);
        setPaymentMethod(editingPayment.paymentMethod);
        setChequeNumber(editingPayment.chequeNumber || '');
        setUpiTransactionId(editingPayment.upiTransactionId || '');
        setBankAccountId(editingPayment.bankAccountId || '');
        setDescription(editingPayment.description || '');
        setReference(editingPayment.reference || '');
        setProjectId(editingPayment.projectId || null);
        setTdsDeducted(editingPayment.tdsDeducted);
        setTdsSection(editingPayment.tdsSection || '');
        setTdsAmount(editingPayment.tdsAmount || 0);
        setAllocations(editingPayment.billAllocations || []);
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
        setProjectId(null);
        setTdsDeducted(false);
        setTdsSection('');
        setTdsAmount(0);
        setAllocations([]);
      }
      setError('');
    }
  }, [open, editingPayment]);

  const handleAllocationChange = (billId: string, allocatedAmount: number) => {
    setAllocations((prev) =>
      prev.map((allocation) => {
        if (allocation.invoiceId === billId) {
          return {
            ...allocation,
            allocatedAmount,
            remainingAmount: allocation.originalAmount - allocatedAmount,
          };
        }
        return allocation;
      })
    );
  };

  // Auto-distribute payment across bills (FIFO - oldest bills first)
  const handleAutoAllocate = () => {
    let remaining = amount;
    const newAllocations = allocations.map((allocation) => {
      if (remaining <= 0) {
        return { ...allocation, allocatedAmount: 0, remainingAmount: allocation.originalAmount };
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

  // Pay full outstanding amount - sets amount and allocates to all bills
  const handlePayFullOutstanding = () => {
    setAmount(totalOutstanding);
    // Allocate full amount to each bill
    const newAllocations = allocations.map((allocation) => ({
      ...allocation,
      allocatedAmount: allocation.originalAmount,
      remainingAmount: 0,
    }));
    setAllocations(newAllocations);
  };

  const handleSubmit = async () => {
    // Validation
    if (!entityId) {
      setError('Please select a vendor');
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

    if (tdsDeducted && !tdsSection) {
      setError('Please select TDS section');
      return;
    }

    setLoading(true);
    setError('');

    try {
      const { db } = getFirebase();

      // Generate transaction number for new payments
      let transactionNumber = editingPayment?.transactionNumber;
      if (!editingPayment) {
        transactionNumber = await generateTransactionNumber('VENDOR_PAYMENT');
      }

      // Only include allocations with non-zero amounts
      const validAllocations = allocations.filter((a) => a.allocatedAmount > 0);

      // Build payment data - only include fields with values (Firestore rejects undefined)
      const paymentData: Record<string, unknown> = {
        type: 'VENDOR_PAYMENT',
        transactionNumber: transactionNumber || '',
        transactionDate: Timestamp.fromDate(new Date(paymentDate)),
        entityId,
        entityName,
        paymentDate: Timestamp.fromDate(new Date(paymentDate)),
        paymentMethod,
        billAllocations: validAllocations,
        tdsDeducted,
        totalAmount: amount,
        description: description || `Payment to ${entityName}`,
        reference: reference || '',
        status: 'POSTED',
        createdAt: Timestamp.now(),
        updatedAt: Timestamp.now(),
        // Required BaseTransaction fields
        date: Timestamp.fromDate(new Date(paymentDate)),
        amount,
        currency: 'INR',
        baseAmount: amount,
        attachments: [],
        createdBy: user?.uid || 'unknown',
      };

      // Conditionally add optional fields (avoid undefined values in Firestore)
      if (paymentMethod === 'CHEQUE' && chequeNumber) {
        paymentData.chequeNumber = chequeNumber;
      }
      if (paymentMethod === 'UPI' && upiTransactionId) {
        paymentData.upiTransactionId = upiTransactionId;
      }
      if (bankAccountId) {
        paymentData.bankAccountId = bankAccountId;
      }
      if (tdsDeducted) {
        paymentData.tdsAmount = tdsAmount;
        paymentData.tdsSection = tdsSection;
      }
      if (projectId) {
        paymentData.projectId = projectId;
        paymentData.costCentreId = projectId;
      }

      if (editingPayment?.id) {
        // Update existing payment with GL validation
        const oldAllocations = editingPayment.billAllocations || [];
        await updatePaymentWithAllocationsAtomic(
          db,
          editingPayment.id,
          paymentData,
          oldAllocations,
          validAllocations
        );
      } else {
        // Create new payment with GL validation
        await createPaymentWithAllocationsAtomic(db, paymentData, validAllocations);
      }

      onClose();
    } catch (err) {
      console.error('[RecordVendorPaymentDialog] Error saving payment:', err);
      setError('Failed to save payment. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  const totalAllocated = allocations.reduce((sum, a) => sum + a.allocatedAmount, 0);
  const netPayment = amount - (tdsDeducted ? tdsAmount : 0);

  return (
    <FormDialog
      open={open}
      onClose={onClose}
      title={editingPayment ? 'Edit Vendor Payment' : 'Record Vendor Payment'}
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
            <EntitySelector
              value={entityId}
              onChange={setEntityId}
              onEntitySelect={(entity) => setEntityName(entity?.name || '')}
              filterByRole="VENDOR"
              label="Vendor"
              required
            />
          </Grid>

          {/* Outstanding Bills Summary - shown immediately after vendor selection */}
          {entityId && (
            <Grid size={{ xs: 12 }}>
              {loadingBills ? (
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, py: 2 }}>
                  <CircularProgress size={20} />
                  <Typography variant="body2" color="text.secondary">
                    Loading outstanding bills...
                  </Typography>
                </Box>
              ) : outstandingBills.length > 0 ? (
                <Alert
                  severity="info"
                  sx={{ mb: 1 }}
                  action={
                    <Button color="inherit" size="small" onClick={handlePayFullOutstanding}>
                      Pay Full Amount
                    </Button>
                  }
                >
                  <Typography variant="body2">
                    <strong>{outstandingBills.length} outstanding bill(s)</strong> totalling{' '}
                    <strong>{formatCurrency(totalOutstanding)}</strong>
                  </Typography>
                </Alert>
              ) : (
                <Alert severity="success" sx={{ mb: 1 }}>
                  No outstanding bills for this vendor.
                </Alert>
              )}
            </Grid>
          )}

          {/* Outstanding Bills Table - shown right after vendor selection */}
          {entityId && outstandingBills.length > 0 && !loadingBills && (
            <Grid size={{ xs: 12 }}>
              <TableContainer component={Paper} variant="outlined" sx={{ mb: 2 }}>
                <Table size="small">
                  <TableHead>
                    <TableRow sx={{ bgcolor: 'action.hover' }}>
                      <TableCell>
                        <strong>Bill Number</strong>
                      </TableCell>
                      <TableCell>
                        <strong>Date</strong>
                      </TableCell>
                      <TableCell>
                        <strong>Description</strong>
                      </TableCell>
                      <TableCell align="right">
                        <strong>Outstanding</strong>
                      </TableCell>
                      <TableCell align="right">
                        <strong>Allocate</strong>
                      </TableCell>
                    </TableRow>
                  </TableHead>
                  <TableBody>
                    {outstandingBills.map((bill, index) => {
                      const allocation = allocations[index];
                      const billDate = bill.date
                        ? typeof (bill.date as unknown as { toDate?: () => Date }).toDate ===
                          'function'
                          ? (bill.date as unknown as { toDate: () => Date }).toDate()
                          : new Date(bill.date as unknown as string | number)
                        : null;
                      return (
                        <TableRow key={bill.id} hover>
                          <TableCell>
                            <Chip
                              label={bill.transactionNumber}
                              size="small"
                              variant="outlined"
                              color="primary"
                            />
                          </TableCell>
                          <TableCell>{billDate ? billDate.toLocaleDateString() : '-'}</TableCell>
                          <TableCell
                            sx={{ maxWidth: 200, overflow: 'hidden', textOverflow: 'ellipsis' }}
                          >
                            {bill.description || '-'}
                          </TableCell>
                          <TableCell align="right">
                            <Typography variant="body2" fontWeight="medium">
                              {formatCurrency(allocation?.originalAmount || 0)}
                            </Typography>
                          </TableCell>
                          <TableCell align="right">
                            <TextField
                              type="number"
                              size="small"
                              value={allocation?.allocatedAmount || 0}
                              onChange={(e) =>
                                handleAllocationChange(bill.id!, parseFloat(e.target.value) || 0)
                              }
                              slotProps={{
                                htmlInput: {
                                  min: 0,
                                  max: allocation?.originalAmount || 0,
                                  step: 0.01,
                                },
                              }}
                              sx={{ width: 120 }}
                            />
                          </TableCell>
                        </TableRow>
                      );
                    })}
                    {/* Summary row */}
                    <TableRow sx={{ bgcolor: 'action.selected' }}>
                      <TableCell colSpan={3}>
                        <Stack direction="row" spacing={1} alignItems="center">
                          <Typography variant="body2" fontWeight="bold">
                            Total
                          </Typography>
                          <Button
                            size="small"
                            variant="text"
                            onClick={handleAutoAllocate}
                            disabled={amount <= 0}
                          >
                            Auto Allocate
                          </Button>
                        </Stack>
                      </TableCell>
                      <TableCell align="right">
                        <Typography variant="body2" fontWeight="bold">
                          {formatCurrency(totalOutstanding)}
                        </Typography>
                      </TableCell>
                      <TableCell align="right">
                        <Typography
                          variant="body2"
                          fontWeight="bold"
                          color={totalAllocated > 0 ? 'success.main' : 'text.secondary'}
                        >
                          {formatCurrency(totalAllocated)}
                        </Typography>
                      </TableCell>
                    </TableRow>
                  </TableBody>
                </Table>
              </TableContainer>
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
              label="Payment Amount"
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
              label="Bank Account (Paid from)"
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

          {/* TDS Section */}
          <Grid size={{ xs: 12 }}>
            <Typography variant="h6" gutterBottom>
              TDS (Tax Deducted at Source)
            </Typography>
          </Grid>

          <Grid size={{ xs: 12 }}>
            <FormControlLabel
              control={
                <Checkbox
                  checked={tdsDeducted}
                  onChange={(e) => setTdsDeducted(e.target.checked)}
                />
              }
              label="TDS Deducted"
            />
          </Grid>

          {tdsDeducted && (
            <>
              <Grid size={{ xs: 12, md: 6 }}>
                <TextField
                  fullWidth
                  select
                  label="TDS Section"
                  value={tdsSection}
                  onChange={(e) => setTdsSection(e.target.value)}
                  required
                >
                  {TDS_SECTIONS.map((section) => (
                    <MenuItem key={section.code} value={section.code}>
                      {section.code} - {section.name}
                    </MenuItem>
                  ))}
                </TextField>
              </Grid>

              <Grid size={{ xs: 12, md: 6 }}>
                <TextField
                  fullWidth
                  label="TDS Amount"
                  type="number"
                  value={tdsAmount}
                  onChange={(e) => setTdsAmount(parseFloat(e.target.value) || 0)}
                  slotProps={{ htmlInput: { min: 0, step: 0.01 } }}
                  helperText="Auto-calculated based on TDS section rate"
                />
              </Grid>

              <Grid size={{ xs: 12 }}>
                <Paper sx={{ p: 2, bgcolor: 'info.light' }}>
                  <Typography variant="body2">
                    <strong>Net Payment to Vendor:</strong> {formatCurrency(netPayment)}
                    <br />
                    (Payment Amount: {formatCurrency(amount)} - TDS: {formatCurrency(tdsAmount)})
                  </Typography>
                </Paper>
              </Grid>
            </>
          )}
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
