'use client';

import React, { useState, useEffect } from 'react';
import { TextField, Grid, MenuItem, Box, Typography } from '@mui/material';
import { FormDialog, FormDialogActions } from '@vapour/ui';
import { EntitySelector } from '@/components/common/forms/EntitySelector';
import { ProjectSelector } from '@/components/common/forms/ProjectSelector';
import { AccountSelector } from '@/components/common/forms/AccountSelector';
import { getFirebase } from '@/lib/firebase';
import { Timestamp, query, collection, where, getDocs } from 'firebase/firestore';
import { useAuth } from '@/contexts/AuthContext';
import { COLLECTIONS } from '@vapour/firebase';
import type { VendorPayment, VendorBill, PaymentAllocation, PaymentMethod } from '@vapour/types';
import { generateTransactionNumber } from '@/lib/accounting/transactionNumberGenerator';
import {
  createPaymentWithAllocationsAtomic,
  updatePaymentWithAllocationsAtomic,
  OPENING_BALANCE_ALLOCATION_ID,
  isOpeningBalanceAllocation,
} from '@/lib/accounting/paymentHelpers';
import {
  BillAllocationTable,
  TDSSection,
  OutstandingBillsSummary,
  PAYMENT_METHODS,
  TDS_SECTIONS,
} from './vendor-payment';
import { logAuditEvent, createAuditContext } from '@/lib/audit/clientAuditService';

interface RecordVendorPaymentDialogProps {
  open: boolean;
  onClose: () => void;
  editingPayment?: VendorPayment | null;
}

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

  // Entity opening balance (CR = we owe vendor from prior year)
  const [entityOpeningBalance, setEntityOpeningBalance] = useState<number>(0);

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
          where('status', 'in', ['APPROVED', 'POSTED'])
        );

        const snapshot = await getDocs(q);
        const bills: VendorBill[] = [];
        let totalOutstandingAmount = 0;

        snapshot.forEach((doc) => {
          const data = doc.data() as VendorBill;
          // Filter soft-deleted bills (client-side per CLAUDE.md rule #3)
          if ('isDeleted' in data && data.isDeleted) return;
          // Use outstandingAmount for partially paid bills, fallback to baseAmount (INR) for forex
          const outstanding = data.outstandingAmount ?? data.baseAmount ?? data.totalAmount ?? 0;
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

        // When editing: restore bills this payment is allocated to.
        // Their Firestore outstanding already reflects this payment's allocation,
        // so we add it back to show the "effective outstanding as if this payment didn't exist".
        if (editingPayment?.billAllocations?.length) {
          const savedMap = new Map(
            editingPayment.billAllocations
              .filter((a) => !isOpeningBalanceAllocation(a) && a.allocatedAmount > 0)
              .map((a) => [a.invoiceId, a])
          );
          const fetchedBillIds = new Set(bills.map((b) => b.id));

          // Adjust outstanding for bills already in the list
          for (const bill of bills) {
            const saved = savedMap.get(bill.id!);
            if (saved) {
              bill.outstandingAmount = (bill.outstandingAmount ?? 0) + saved.allocatedAmount;
              totalOutstandingAmount += saved.allocatedAmount;
            }
          }

          // Add bills not in the list (fully paid by this payment, so outstanding=0 in Firestore)
          for (const [invoiceId, saved] of savedMap) {
            if (!fetchedBillIds.has(invoiceId)) {
              bills.push({
                id: invoiceId,
                transactionNumber: saved.invoiceNumber,
                totalAmount: saved.allocatedAmount,
                outstandingAmount: saved.allocatedAmount,
              } as VendorBill);
              totalOutstandingAmount += saved.allocatedAmount;
            }
          }
        }

        // Calculate remaining opening balance (subtract already-allocated amounts from other payments)
        let remainingOpeningBalance = 0;
        if (entityOpeningBalance > 0) {
          const paymentQuery = query(
            transactionsRef,
            where('type', '==', 'VENDOR_PAYMENT'),
            where('entityId', '==', entityId)
          );
          const paymentSnapshot = await getDocs(paymentQuery);
          let alreadyAllocated = 0;
          paymentSnapshot.forEach((paymentDoc) => {
            // When editing, skip the current payment's own allocations
            if (editingPayment?.id && paymentDoc.id === editingPayment.id) return;
            const paymentAllocations = paymentDoc.data().billAllocations || [];
            for (const a of paymentAllocations) {
              if (a.invoiceId === OPENING_BALANCE_ALLOCATION_ID) {
                alreadyAllocated += a.allocatedAmount || 0;
              }
            }
          });
          remainingOpeningBalance = Math.max(0, entityOpeningBalance - alreadyAllocated);
        }

        // Prepend virtual "Opening Balance" row if there's remaining balance
        const allBills = [...bills];
        const allAllocations: PaymentAllocation[] = [];

        if (remainingOpeningBalance > 0) {
          allBills.unshift({
            id: OPENING_BALANCE_ALLOCATION_ID,
            transactionNumber: 'Opening Balance',
            totalAmount: remainingOpeningBalance,
            outstandingAmount: remainingOpeningBalance,
          } as VendorBill);
          allAllocations.push({
            invoiceId: OPENING_BALANCE_ALLOCATION_ID,
            invoiceNumber: 'Opening Balance',
            originalAmount: remainingOpeningBalance,
            allocatedAmount: 0,
            remainingAmount: remainingOpeningBalance,
          });
          totalOutstandingAmount += remainingOpeningBalance;
        }

        // Add real bill allocations
        for (const bill of bills) {
          const outstanding = bill.outstandingAmount ?? bill.baseAmount ?? bill.totalAmount ?? 0;
          allAllocations.push({
            invoiceId: bill.id!,
            invoiceNumber: bill.transactionNumber || '',
            originalAmount: outstanding,
            allocatedAmount: 0,
            remainingAmount: outstanding,
          });
        }

        // If editing, restore saved allocation amounts
        if (editingPayment?.billAllocations?.length) {
          const savedMap = new Map(
            editingPayment.billAllocations.map((a) => [a.invoiceId, a.allocatedAmount])
          );
          for (const alloc of allAllocations) {
            const savedAmount = savedMap.get(alloc.invoiceId);
            if (savedAmount !== undefined && savedAmount > 0) {
              alloc.allocatedAmount = Math.min(savedAmount, alloc.originalAmount);
              alloc.remainingAmount = alloc.originalAmount - alloc.allocatedAmount;
            }
          }
        }

        setOutstandingBills(allBills);
        setTotalOutstanding(totalOutstandingAmount);
        setAllocations(allAllocations);
      } catch (err) {
        console.error('[RecordVendorPaymentDialog] Error fetching bills:', err);
      } finally {
        setLoadingBills(false);
      }
    }

    fetchOutstandingBills();
    // editingPayment?.id is sufficient — when the payment changes, the id changes
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [entityId, entityOpeningBalance, editingPayment?.id]);

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
        setEntityOpeningBalance(0);
      }
      setError('');
    }
  }, [open, editingPayment]);

  const handleAllocationChange = (billId: string, allocatedAmount: number) => {
    setAllocations((prev) =>
      prev.map((allocation) => {
        if (allocation.invoiceId === billId) {
          // Cap at outstanding amount to prevent over-allocation per bill
          const cappedAmount = Math.min(Math.max(0, allocatedAmount), allocation.originalAmount);
          return {
            ...allocation,
            allocatedAmount: cappedAmount,
            remainingAmount: allocation.originalAmount - cappedAmount,
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

  // Fill remaining balance for a specific bill
  const handleFillRemaining = (billId: string) => {
    const currentTotal = allocations.reduce((sum, a) => sum + a.allocatedAmount, 0);
    const unallocatedAmount = amount - currentTotal;

    if (unallocatedAmount <= 0) return;

    setAllocations((prev) =>
      prev.map((allocation) => {
        if (allocation.invoiceId === billId) {
          // Add unallocated amount to this bill, up to its remaining balance
          const additionalAmount = Math.min(unallocatedAmount, allocation.remainingAmount);
          const newAllocated = allocation.allocatedAmount + additionalAmount;
          return {
            ...allocation,
            allocatedAmount: newAllocated,
            remainingAmount: allocation.originalAmount - newAllocated,
          };
        }
        return allocation;
      })
    );
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
      // Separate real bill allocations from virtual opening balance allocations
      const realAllocations = validAllocations.filter((a) => !isOpeningBalanceAllocation(a));

      // Build payment data - only include fields with values (Firestore rejects undefined)
      const paymentData: Record<string, unknown> = {
        type: 'VENDOR_PAYMENT',
        transactionNumber: transactionNumber || '',
        transactionDate: Timestamp.fromDate(new Date(paymentDate)),
        entityId,
        entityName,
        paymentDate: Timestamp.fromDate(new Date(paymentDate)),
        paymentMethod,
        billAllocations: validAllocations, // Store full array (including opening balance)
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
        // Update existing payment with GL validation (only pass real allocations for bill updates)
        const oldAllocations = (editingPayment.billAllocations || []).filter(
          (a) => !isOpeningBalanceAllocation(a)
        );
        await updatePaymentWithAllocationsAtomic(
          db,
          editingPayment.id,
          paymentData,
          oldAllocations,
          realAllocations
        );

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
            `Vendor payment ${transactionNumber} updated for ${entityName}`,
            {
              entityName: transactionNumber || '',
              metadata: {
                entityId,
                entityName,
                amount,
                paymentMethod,
                allocationsCount: validAllocations.length,
              },
            }
          );
        }
      } else {
        // Create new payment with GL validation (only pass real allocations for bill updates)
        const paymentId = await createPaymentWithAllocationsAtomic(
          db,
          paymentData,
          realAllocations
        );

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
            paymentId,
            `Vendor payment ${transactionNumber} created for ${entityName}`,
            {
              entityName: transactionNumber || '',
              metadata: {
                entityId,
                entityName,
                amount,
                paymentMethod,
                allocationsCount: validAllocations.length,
              },
            }
          );
        }
      }

      onClose();
    } catch (err) {
      console.error('[RecordVendorPaymentDialog] Error saving payment:', err);
      // Show specific error message if available
      const errorMessage =
        err instanceof Error ? err.message : 'Failed to save payment. Please try again.';
      setError(errorMessage);
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
              onEntitySelect={(entity) => {
                setEntityName(entity?.name || '');
                // Capture opening balance (CR = we owe vendor from prior year)
                const ob = entity?.openingBalance ?? 0;
                const obType = entity?.openingBalanceType ?? 'DR';
                setEntityOpeningBalance(obType === 'CR' ? ob : 0);
              }}
              filterByRole="VENDOR"
              label="Vendor"
              required
            />
          </Grid>

          {/* Outstanding Bills Summary */}
          <Grid size={{ xs: 12 }}>
            <OutstandingBillsSummary
              entityId={entityId}
              loadingBills={loadingBills}
              outstandingBills={outstandingBills}
              totalOutstanding={totalOutstanding}
              onPayFullOutstanding={handlePayFullOutstanding}
            />
          </Grid>

          {/* Outstanding Bills Table */}
          {entityId && outstandingBills.length > 0 && !loadingBills && (
            <Grid size={{ xs: 12 }}>
              <BillAllocationTable
                outstandingBills={outstandingBills}
                allocations={allocations}
                totalOutstanding={totalOutstanding}
                totalAllocated={totalAllocated}
                amount={amount}
                unallocated={amount - totalAllocated}
                onAllocationChange={handleAllocationChange}
                onAutoAllocate={handleAutoAllocate}
                onFillRemaining={handleFillRemaining}
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
            <AccountSelector
              value={bankAccountId || null}
              onChange={(id) => setBankAccountId(id || '')}
              label="Bank Account (Paid from)"
              filterByBankAccount
              excludeGroups
              placeholder="Search bank accounts..."
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
          <TDSSection
            tdsDeducted={tdsDeducted}
            setTdsDeducted={setTdsDeducted}
            tdsSection={tdsSection}
            setTdsSection={setTdsSection}
            tdsAmount={tdsAmount}
            setTdsAmount={setTdsAmount}
            netPayment={netPayment}
            amount={amount}
          />
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
