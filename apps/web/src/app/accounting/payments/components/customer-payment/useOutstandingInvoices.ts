'use client';

/**
 * useOutstandingInvoices
 *
 * Fetches outstanding customer invoices for a given entity, handles forex
 * outstanding-amount detection, opening-balance virtual rows, and provides
 * allocation manipulation helpers (auto-allocate, fill-remaining, per-row edit).
 */

import { useState, useEffect, useCallback, useMemo } from 'react';
import { collection, doc, getDoc, query, where, getDocs } from 'firebase/firestore';
import { COLLECTIONS } from '@vapour/firebase';
import { getFirebase } from '@/lib/firebase';
import type { CustomerInvoice, CustomerPayment, PaymentAllocation } from '@vapour/types';
import {
  OPENING_BALANCE_ALLOCATION_ID,
  isOpeningBalanceAllocation,
} from '@/lib/accounting/paymentHelpers';

interface UseOutstandingInvoicesOptions {
  entityId: string | null;
  editingPayment?: CustomerPayment | null;
  baseAmount: number;
}

interface UseOutstandingInvoicesResult {
  outstandingInvoices: CustomerInvoice[];
  allocations: PaymentAllocation[];
  totalAllocated: number;
  unallocated: number;
  fetchError: string | null;
  handleAllocationChange: (invoiceId: string, allocatedAmount: number) => void;
  handleAutoAllocate: () => void;
  handleFillRemaining: (invoiceId: string) => void;
  setAllocations: React.Dispatch<React.SetStateAction<PaymentAllocation[]>>;
}

/**
 * Calculate outstanding amount in INR for a customer invoice.
 *
 * Handles both new invoices (outstandingAmount in INR) and legacy invoices
 * (outstandingAmount in foreign currency) by comparing ratios against
 * reference values.
 */
function calculateOutstandingINR(data: CustomerInvoice): number {
  const invoiceCurrency = data.currency || 'INR';
  const invoiceExchangeRate = data.exchangeRate ?? 1;
  const totalAmount = data.totalAmount ?? 0;

  // INR invoices — straightforward
  if (invoiceCurrency === 'INR') {
    if (data.outstandingAmount != null) return data.outstandingAmount;
    const amountPaidINR = (data as unknown as Record<string, number>).amountPaid ?? 0;
    return Math.max(0, (data.baseAmount ?? totalAmount) - amountPaidINR);
  }

  // Forex invoice — determine if outstandingAmount is stored in INR or foreign currency
  const baseAmountINR = data.baseAmount ?? totalAmount * invoiceExchangeRate;

  if (data.outstandingAmount !== undefined && data.outstandingAmount !== null) {
    const outstanding = data.outstandingAmount;

    const ratioToBase = baseAmountINR > 0 ? outstanding / baseAmountINR : 0;
    const ratioToTotal = totalAmount > 0 ? outstanding / totalAmount : 0;

    const isLikelyINR = ratioToBase >= 0 && ratioToBase <= 1.01;
    const isLikelyForex = ratioToTotal >= 0 && ratioToTotal <= 1.01;

    if (isLikelyINR && !isLikelyForex) {
      return outstanding;
    } else if (isLikelyForex && !isLikelyINR) {
      return outstanding * invoiceExchangeRate;
    } else if (isLikelyINR && isLikelyForex) {
      const distToBase = Math.abs(outstanding - baseAmountINR);
      const distToTotal = Math.abs(outstanding - totalAmount);
      return distToBase <= distToTotal ? outstanding : outstanding * invoiceExchangeRate;
    }
  }

  // Fallback: compute from total − paid (both in INR)
  const paidINR = (data as unknown as Record<string, number>).amountPaid ?? 0;
  return Math.max(0, baseAmountINR - paidINR);
}

export function useOutstandingInvoices({
  entityId,
  editingPayment,
  baseAmount,
}: UseOutstandingInvoicesOptions): UseOutstandingInvoicesResult {
  const [outstandingInvoices, setOutstandingInvoices] = useState<CustomerInvoice[]>([]);
  const [allocations, setAllocations] = useState<PaymentAllocation[]>([]);
  const [hasAutoAllocated, setHasAutoAllocated] = useState(false);
  const [fetchError, setFetchError] = useState<string | null>(null);

  // Fetch outstanding invoices when customer changes
  useEffect(() => {
    setHasAutoAllocated(false); // Reset auto-allocation on entity/payment change

    async function fetchOutstandingInvoices() {
      if (!entityId) {
        setOutstandingInvoices([]);
        setAllocations([]);
        return;
      }

      try {
        setFetchError(null);
        const { db } = getFirebase();

        // Fetch entity document to get opening balance directly
        // (EntitySelector's onEntitySelect only fires on user interaction, not on pre-fill)
        let openingBal = 0;
        const entityDoc = await getDoc(doc(db, COLLECTIONS.ENTITIES, entityId));
        if (entityDoc.exists()) {
          const entityData = entityDoc.data();
          const obType = entityData?.openingBalanceType ?? 'DR';
          openingBal = obType === 'DR' ? (entityData?.openingBalance ?? 0) : 0;
        }

        const transactionsRef = collection(db, COLLECTIONS.TRANSACTIONS);
        const q = query(
          transactionsRef,
          where('type', '==', 'CUSTOMER_INVOICE'),
          where('entityId', '==', entityId),
          where('status', 'in', ['APPROVED', 'POSTED'])
        );

        const snapshot = await getDocs(q);
        const invoices: CustomerInvoice[] = [];

        snapshot.forEach((d) => {
          const data = d.data() as CustomerInvoice;
          // Filter soft-deleted invoices (client-side per CLAUDE.md rule #3)
          if ('isDeleted' in data && data.isDeleted) return;
          const outstandingINR = calculateOutstandingINR(data);
          if (outstandingINR > 0) {
            invoices.push({ ...data, id: d.id });
          }
        });

        // When editing: restore invoices this payment is allocated to.
        // Their Firestore outstanding already reflects this payment's allocation,
        // so we add it back to show the "effective outstanding as if this payment didn't exist".
        if (editingPayment?.invoiceAllocations?.length) {
          const savedMap = new Map(
            editingPayment.invoiceAllocations
              .filter((a) => !isOpeningBalanceAllocation(a) && a.allocatedAmount > 0)
              .map((a) => [a.invoiceId, a])
          );
          const fetchedInvoiceIds = new Set(invoices.map((inv) => inv.id));

          // Adjust outstanding for invoices already in the list
          for (const invoice of invoices) {
            const saved = savedMap.get(invoice.id!);
            if (saved) {
              const currentOutstanding =
                invoice.outstandingAmount ?? calculateOutstandingINR(invoice);
              const invoiceTotalINR = invoice.baseAmount ?? invoice.totalAmount ?? 0;
              invoice.outstandingAmount = Math.min(
                invoiceTotalINR,
                currentOutstanding + saved.allocatedAmount
              );
            }
          }

          // Add invoices not in the list (fully paid by this payment)
          for (const [invoiceId, saved] of savedMap) {
            if (!fetchedInvoiceIds.has(invoiceId)) {
              invoices.push({
                id: invoiceId,
                transactionNumber: saved.invoiceNumber,
                totalAmount: saved.allocatedAmount,
                outstandingAmount: saved.allocatedAmount,
              } as CustomerInvoice);
            }
          }
        }

        // Calculate remaining opening balance (subtract already-allocated amounts from other payments)
        let remainingOpeningBalance = 0;
        if (openingBal > 0) {
          const paymentQuery = query(
            transactionsRef,
            where('type', '==', 'CUSTOMER_PAYMENT'),
            where('entityId', '==', entityId)
          );
          const paymentSnapshot = await getDocs(paymentQuery);
          let alreadyAllocated = 0;
          paymentSnapshot.forEach((paymentDoc) => {
            if (editingPayment?.id && paymentDoc.id === editingPayment.id) return;
            const paymentAllocations = paymentDoc.data().invoiceAllocations || [];
            for (const a of paymentAllocations) {
              if (a.invoiceId === OPENING_BALANCE_ALLOCATION_ID) {
                alreadyAllocated += a.allocatedAmount || 0;
              }
            }
          });
          remainingOpeningBalance = Math.max(0, openingBal - alreadyAllocated);
        }

        // Prepend virtual "Opening Balance" row if there's remaining balance
        const allInvoices = [...invoices];
        const allAllocations: PaymentAllocation[] = [];

        if (remainingOpeningBalance > 0) {
          allInvoices.unshift({
            id: OPENING_BALANCE_ALLOCATION_ID,
            transactionNumber: 'Opening Balance',
            totalAmount: remainingOpeningBalance,
          } as CustomerInvoice);
          allAllocations.push({
            invoiceId: OPENING_BALANCE_ALLOCATION_ID,
            invoiceNumber: 'Opening Balance',
            originalAmount: remainingOpeningBalance,
            allocatedAmount: 0,
            remainingAmount: remainingOpeningBalance,
          });
        }

        // Add real invoice allocations
        for (const invoice of invoices) {
          const outstandingInINR =
            invoice.outstandingAmount !== undefined && editingPayment?.invoiceAllocations?.length
              ? invoice.outstandingAmount
              : calculateOutstandingINR(invoice);
          allAllocations.push({
            invoiceId: invoice.id!,
            invoiceNumber: invoice.transactionNumber || '',
            originalAmount: outstandingInINR,
            allocatedAmount: 0,
            remainingAmount: outstandingInINR,
          });
        }

        // If editing, restore saved allocation amounts
        if (editingPayment?.invoiceAllocations?.length) {
          const savedMap = new Map(
            editingPayment.invoiceAllocations.map((a) => [a.invoiceId, a.allocatedAmount])
          );
          for (const alloc of allAllocations) {
            const savedAmount = savedMap.get(alloc.invoiceId);
            if (savedAmount !== undefined && savedAmount > 0) {
              alloc.allocatedAmount = Math.min(savedAmount, alloc.originalAmount);
              alloc.remainingAmount = alloc.originalAmount - alloc.allocatedAmount;
            }
          }
        }

        setOutstandingInvoices(allInvoices);
        setAllocations(allAllocations);
      } catch (err) {
        console.error('[useOutstandingInvoices] Error fetching outstanding invoices:', err);
        setFetchError('Failed to load outstanding invoices. Please try again.');
      }
    }

    fetchOutstandingInvoices();
    // editingPayment?.id is sufficient — when the payment changes, the id changes
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [entityId, editingPayment?.id]);

  // Per-row allocation change
  const handleAllocationChange = useCallback((invoiceId: string, allocatedAmount: number) => {
    setAllocations((prev) =>
      prev.map((allocation) => {
        if (allocation.invoiceId === invoiceId) {
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
  }, []);

  // Auto-distribute payment across invoices (oldest first)
  const handleAutoAllocate = useCallback(() => {
    setHasAutoAllocated(true);
    setAllocations((prev) => {
      let remaining = baseAmount;
      return prev.map((allocation) => {
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
    });
  }, [baseAmount]);

  // Re-run auto-allocation when baseAmount changes (e.g., exchange rate correction)
  useEffect(() => {
    if (hasAutoAllocated && baseAmount > 0 && allocations.length > 0) {
      let remaining = baseAmount;
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
    }
    // Only re-run when baseAmount changes, not when allocations change
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [baseAmount, hasAutoAllocated]);

  // Fill remaining unallocated balance into a specific invoice
  const handleFillRemaining = useCallback(
    (invoiceId: string) => {
      setAllocations((prev) => {
        const currentTotal = prev.reduce((sum, a) => sum + a.allocatedAmount, 0);
        const unallocatedAmount = baseAmount - currentTotal;
        if (unallocatedAmount <= 0) return prev;

        return prev.map((allocation) => {
          if (allocation.invoiceId === invoiceId) {
            const additionalAmount = Math.min(unallocatedAmount, allocation.remainingAmount);
            const newAllocated = allocation.allocatedAmount + additionalAmount;
            return {
              ...allocation,
              allocatedAmount: newAllocated,
              remainingAmount: allocation.originalAmount - newAllocated,
            };
          }
          return allocation;
        });
      });
    },
    [baseAmount]
  );

  const totalAllocated = useMemo(
    () => allocations.reduce((sum, a) => sum + a.allocatedAmount, 0),
    [allocations]
  );
  const unallocated = baseAmount - totalAllocated;

  return {
    outstandingInvoices,
    allocations,
    totalAllocated,
    unallocated,
    fetchError,
    handleAllocationChange,
    handleAutoAllocate,
    handleFillRemaining,
    setAllocations,
  };
}
