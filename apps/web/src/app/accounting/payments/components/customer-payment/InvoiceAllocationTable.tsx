'use client';

/**
 * Invoice Allocation Table
 *
 * Wrapper around the generic TransactionAllocationTable for customer invoices.
 * Maintained for backward compatibility.
 */

import { TransactionAllocationTable } from '@/components/accounting';
import type { InvoiceAllocationTableProps } from './types';

export function InvoiceAllocationTable({
  outstandingInvoices,
  allocations,
  totalAllocated,
  unallocated,
  onAllocationChange,
  onAutoAllocate,
  onFillRemaining,
}: InvoiceAllocationTableProps) {
  return (
    <TransactionAllocationTable
      transactionType="invoice"
      transactions={outstandingInvoices}
      allocations={allocations}
      totalAllocated={totalAllocated}
      unallocated={unallocated}
      onAllocationChange={onAllocationChange}
      onAutoAllocate={onAutoAllocate}
      onFillRemaining={onFillRemaining}
      showForexColumn
      variant="standard"
    />
  );
}
