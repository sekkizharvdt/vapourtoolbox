'use client';

/**
 * Invoices Table for Cost Centre
 *
 * Wrapper around the generic CostCentreTransactionTable for invoices.
 * Maintained for backward compatibility.
 */

import { CostCentreTransactionTable } from '@/components/accounting';
import type { CustomerInvoice } from '@vapour/types';

interface InvoicesTableProps {
  invoices: CustomerInvoice[];
  formatCurrency: (amount: number | undefined | null, currency?: string) => string;
  formatDate: (date: Date | undefined) => string;
}

export function InvoicesTable({ invoices, formatCurrency, formatDate }: InvoicesTableProps) {
  return (
    <CostCentreTransactionTable
      transactionType="invoice"
      transactions={invoices}
      formatCurrency={formatCurrency}
      formatDate={formatDate}
    />
  );
}
