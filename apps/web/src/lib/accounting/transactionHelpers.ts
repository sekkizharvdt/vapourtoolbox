/**
 * Transaction Helpers
 * Helper functions for creating and managing accounting transactions
 */

import type {
  BaseTransaction,
  CustomerInvoice,
  VendorBill,
  LedgerEntry,
} from '@vapour/types';

/**
 * Auto-generate ledger entries for a customer invoice
 * DR: Customer Account (Accounts Receivable)
 * CR: Sales/Revenue Account
 * CR: GST Payable (if applicable)
 */
export function generateInvoiceLedgerEntries(
  invoice: Partial<CustomerInvoice>,
  customerAccountId: string,
  revenueAccountId: string,
  gstPayableAccountIds?: {
    cgst?: string;
    sgst?: string;
    igst?: string;
  }
): LedgerEntry[] {
  const entries: LedgerEntry[] = [];

  if (!invoice.totalAmount || !invoice.subtotal) {
    return entries;
  }

  // Debit: Customer Account (Accounts Receivable)
  entries.push({
    accountId: customerAccountId,
    debit: invoice.totalAmount,
    credit: 0,
    description: `Invoice ${invoice.transactionNumber || ''} - Customer receivable`,
    costCentreId: invoice.projectId,
  });

  // Credit: Revenue Account
  entries.push({
    accountId: revenueAccountId,
    debit: 0,
    credit: invoice.subtotal,
    description: `Invoice ${invoice.transactionNumber || ''} - Sales revenue`,
    costCentreId: invoice.projectId,
  });

  // Credit: GST Payable
  if (invoice.gstDetails) {
    const { gstType, cgstAmount, sgstAmount, igstAmount } = invoice.gstDetails;

    if (gstType === 'CGST_SGST' && cgstAmount && sgstAmount) {
      // CGST
      if (gstPayableAccountIds?.cgst) {
        entries.push({
          accountId: gstPayableAccountIds.cgst,
          debit: 0,
          credit: cgstAmount,
          description: `Invoice ${invoice.transactionNumber || ''} - CGST payable`,
          costCentreId: invoice.projectId,
        });
      }

      // SGST
      if (gstPayableAccountIds?.sgst) {
        entries.push({
          accountId: gstPayableAccountIds.sgst,
          debit: 0,
          credit: sgstAmount,
          description: `Invoice ${invoice.transactionNumber || ''} - SGST payable`,
          costCentreId: invoice.projectId,
        });
      }
    } else if (gstType === 'IGST' && igstAmount) {
      // IGST
      if (gstPayableAccountIds?.igst) {
        entries.push({
          accountId: gstPayableAccountIds.igst,
          debit: 0,
          credit: igstAmount,
          description: `Invoice ${invoice.transactionNumber || ''} - IGST payable`,
          costCentreId: invoice.projectId,
        });
      }
    }
  }

  return entries;
}

/**
 * Auto-generate ledger entries for a vendor bill
 * DR: Expense Account
 * DR: GST Input (if applicable)
 * CR: Vendor Account (Accounts Payable)
 * CR: TDS Payable (if applicable)
 */
export function generateBillLedgerEntries(
  bill: Partial<VendorBill>,
  vendorAccountId: string,
  expenseAccountId: string,
  gstInputAccountIds?: {
    cgst?: string;
    sgst?: string;
    igst?: string;
  },
  tdsPayableAccountId?: string
): LedgerEntry[] {
  const entries: LedgerEntry[] = [];

  if (!bill.subtotal) {
    return entries;
  }

  // Debit: Expense Account
  entries.push({
    accountId: expenseAccountId,
    debit: bill.subtotal,
    credit: 0,
    description: `Bill ${bill.transactionNumber || ''} - Expense`,
    costCentreId: bill.projectId,
  });

  // Debit: GST Input
  if (bill.gstDetails) {
    const { gstType, cgstAmount, sgstAmount, igstAmount } = bill.gstDetails;

    if (gstType === 'CGST_SGST' && cgstAmount && sgstAmount) {
      // CGST Input
      if (gstInputAccountIds?.cgst) {
        entries.push({
          accountId: gstInputAccountIds.cgst,
          debit: cgstAmount,
          credit: 0,
          description: `Bill ${bill.transactionNumber || ''} - CGST input`,
          costCentreId: bill.projectId,
        });
      }

      // SGST Input
      if (gstInputAccountIds?.sgst) {
        entries.push({
          accountId: gstInputAccountIds.sgst,
          debit: sgstAmount,
          credit: 0,
          description: `Bill ${bill.transactionNumber || ''} - SGST input`,
          costCentreId: bill.projectId,
        });
      }
    } else if (gstType === 'IGST' && igstAmount) {
      // IGST Input
      if (gstInputAccountIds?.igst) {
        entries.push({
          accountId: gstInputAccountIds.igst,
          debit: igstAmount,
          credit: 0,
          description: `Bill ${bill.transactionNumber || ''} - IGST input`,
          costCentreId: bill.projectId,
        });
      }
    }
  }

  // Credit: Vendor Account (Accounts Payable)
  const vendorPayable = bill.totalAmount || 0;
  entries.push({
    accountId: vendorAccountId,
    debit: 0,
    credit: vendorPayable,
    description: `Bill ${bill.transactionNumber || ''} - Vendor payable`,
    costCentreId: bill.projectId,
  });

  // Credit: TDS Payable (reduces vendor payable)
  if (bill.tdsDeducted && bill.tdsAmount && tdsPayableAccountId) {
    entries.push({
      accountId: tdsPayableAccountId,
      debit: 0,
      credit: bill.tdsAmount,
      description: `Bill ${bill.transactionNumber || ''} - TDS payable`,
      costCentreId: bill.projectId,
    });
  }

  return entries;
}

/**
 * Validate transaction before saving
 */
export function validateTransaction(transaction: Partial<BaseTransaction>): {
  isValid: boolean;
  errors: string[];
} {
  const errors: string[] = [];

  if (!transaction.type) {
    errors.push('Transaction type is required');
  }

  if (!transaction.date) {
    errors.push('Transaction date is required');
  }

  if (!transaction.amount || transaction.amount <= 0) {
    errors.push('Amount must be greater than zero');
  }

  if (!transaction.entries || transaction.entries.length === 0) {
    errors.push('At least one ledger entry is required');
  }

  return {
    isValid: errors.length === 0,
    errors,
  };
}

/**
 * Calculate total from line items
 */
export function calculateLineItemsTotal(
  lineItems: Array<{ quantity: number; unitPrice: number; gstRate?: number }>
): {
  subtotal: number;
  taxAmount: number;
  total: number;
} {
  let subtotal = 0;
  let taxAmount = 0;

  lineItems.forEach((item) => {
    const itemAmount = item.quantity * item.unitPrice;
    subtotal += itemAmount;

    if (item.gstRate) {
      taxAmount += (itemAmount * item.gstRate) / 100;
    }
  });

  return {
    subtotal: parseFloat(subtotal.toFixed(2)),
    taxAmount: parseFloat(taxAmount.toFixed(2)),
    total: parseFloat((subtotal + taxAmount).toFixed(2)),
  };
}

/**
 * Format currency for display
 */
export function formatCurrency(amount: number, currency: string = 'INR'): string {
  if (currency === 'INR') {
    // Indian numbering system (lakhs and crores)
    return new Intl.NumberFormat('en-IN', {
      style: 'currency',
      currency: 'INR',
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    }).format(amount);
  }

  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency,
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(amount);
}
