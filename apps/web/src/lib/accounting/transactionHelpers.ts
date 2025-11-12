/**
 * Transaction Helpers
 * Helper functions for creating and managing accounting transactions
 */

import type { BaseTransaction, CustomerInvoice, VendorBill, LedgerEntry } from '@vapour/types';

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
  // If TDS deducted, vendor gets net amount (totalAmount - TDS)
  const tdsAmount = bill.tdsDeducted && bill.tdsAmount ? bill.tdsAmount : 0;
  const vendorPayable = (bill.totalAmount || 0) - tdsAmount;

  entries.push({
    accountId: vendorAccountId,
    debit: 0,
    credit: vendorPayable,
    description: `Bill ${bill.transactionNumber || ''} - Vendor payable (net)`,
    costCentreId: bill.projectId,
  });

  // Credit: TDS Payable
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
 * Validate that ledger entries balance (total debits = total credits)
 */
export function validateLedgerBalance(entries: LedgerEntry[]): {
  balanced: boolean;
  totalDebits: number;
  totalCredits: number;
} {
  const totalDebits = entries.reduce((sum, entry) => sum + (entry.debit || 0), 0);
  const totalCredits = entries.reduce((sum, entry) => sum + (entry.credit || 0), 0);

  // Use toFixed for floating point comparison
  const balanced = parseFloat(totalDebits.toFixed(2)) === parseFloat(totalCredits.toFixed(2));

  return {
    balanced,
    totalDebits: parseFloat(totalDebits.toFixed(2)),
    totalCredits: parseFloat(totalCredits.toFixed(2)),
  };
}

/**
 * Calculate forex gain/loss for a transaction
 *
 * When a foreign currency transaction is settled, the actual bank settlement rate
 * may differ from the expected exchange rate, resulting in a forex gain or loss.
 *
 * Formula:
 * - forexGainLoss = bankSettlementAmount - baseAmount
 * - Positive value = Gain (actual received more than expected)
 * - Negative value = Loss (actual received less than expected)
 *
 * @param transaction - Transaction with forex data
 * @returns Calculated forex gain/loss amount in base currency
 */
export function calculateForexGainLoss(transaction: {
  amount: number;
  currency: string;
  exchangeRate?: number;
  baseAmount: number;
  bankSettlementRate?: number;
  bankSettlementAmount?: number;
}): {
  forexGainLoss: number;
  calculatedBankAmount: number;
  hasForexImpact: boolean;
} {
  // No forex impact if transaction is in base currency
  if (transaction.currency === 'INR') {
    return {
      forexGainLoss: 0,
      calculatedBankAmount: transaction.amount,
      hasForexImpact: false,
    };
  }

  // No forex impact if bank settlement rate not provided
  if (!transaction.bankSettlementRate) {
    return {
      forexGainLoss: 0,
      calculatedBankAmount: transaction.baseAmount,
      hasForexImpact: false,
    };
  }

  // Calculate actual bank settlement amount if not provided
  const calculatedBankAmount =
    transaction.bankSettlementAmount ||
    parseFloat((transaction.amount * transaction.bankSettlementRate).toFixed(2));

  // Calculate forex gain/loss
  // Gain (positive) if bank gave more INR than expected
  // Loss (negative) if bank gave less INR than expected
  const forexGainLoss = parseFloat((calculatedBankAmount - transaction.baseAmount).toFixed(2));

  return {
    forexGainLoss,
    calculatedBankAmount,
    hasForexImpact: Math.abs(forexGainLoss) > 0.01, // Consider impact if > 1 paisa
  };
}

/**
 * Generate ledger entry for forex gain/loss
 *
 * For Forex Gain (positive value):
 * - DR: Bank/Cash Account (already recorded in payment entry)
 * - CR: Foreign Exchange Gain Account
 *
 * For Forex Loss (negative value):
 * - DR: Foreign Exchange Loss Account
 * - CR: Bank/Cash Account (already recorded in payment entry)
 *
 * @param forexGainLoss - Amount of gain (positive) or loss (negative)
 * @param transactionNumber - Transaction reference number
 * @param forexGainAccountId - Chart of Accounts ID for forex gain account
 * @param forexLossAccountId - Chart of Accounts ID for forex loss account
 * @param costCentreId - Optional project/cost centre ID
 * @returns Ledger entry for forex gain/loss (null if no impact)
 */
export function generateForexGainLossEntry(
  forexGainLoss: number,
  transactionNumber: string,
  forexGainAccountId: string,
  forexLossAccountId: string,
  costCentreId?: string
): LedgerEntry | null {
  // Skip if no forex impact (less than 1 paisa)
  if (Math.abs(forexGainLoss) < 0.01) {
    return null;
  }

  const absAmount = Math.abs(forexGainLoss);

  if (forexGainLoss > 0) {
    // Forex Gain - Credit the gain account
    return {
      accountId: forexGainAccountId,
      debit: 0,
      credit: absAmount,
      description: `Forex gain on ${transactionNumber}`,
      costCentreId,
    };
  } else {
    // Forex Loss - Debit the loss account
    return {
      accountId: forexLossAccountId,
      debit: absAmount,
      credit: 0,
      description: `Forex loss on ${transactionNumber}`,
      costCentreId,
    };
  }
}

/**
 * Update transaction with forex gain/loss calculation
 *
 * This function should be called when:
 * 1. A foreign currency transaction is initially recorded
 * 2. Bank settlement details are updated (rate, amount, date)
 *
 * @param transaction - Transaction to update
 * @returns Updated transaction with calculated forex fields
 */
export function applyForexCalculation<T extends Partial<BaseTransaction>>(transaction: T): T {
  if (!transaction.amount || !transaction.currency || !transaction.baseAmount) {
    return transaction;
  }

  const forexCalc = calculateForexGainLoss({
    amount: transaction.amount,
    currency: transaction.currency,
    exchangeRate: transaction.exchangeRate,
    baseAmount: transaction.baseAmount,
    bankSettlementRate: transaction.bankSettlementRate,
    bankSettlementAmount: transaction.bankSettlementAmount,
  });

  return {
    ...transaction,
    bankSettlementAmount: forexCalc.calculatedBankAmount,
    forexGainLoss: forexCalc.forexGainLoss,
  };
}

/**
 * Add forex gain/loss entry to existing ledger entries
 *
 * This function adds the forex gain/loss ledger entry to the transaction's
 * existing entries array, ensuring proper double-entry accounting.
 *
 * @param transaction - Transaction with forex data
 * @param forexGainAccountId - Chart of Accounts ID for forex gain
 * @param forexLossAccountId - Chart of Accounts ID for forex loss
 * @returns Updated entries array including forex entry
 */
export function addForexEntryToLedger(
  transaction: Partial<BaseTransaction>,
  forexGainAccountId: string,
  forexLossAccountId: string
): LedgerEntry[] {
  const entries = [...(transaction.entries || [])];

  // Calculate forex gain/loss
  const updatedTx = applyForexCalculation(transaction);

  // Generate forex entry if there's an impact
  if (updatedTx.forexGainLoss && Math.abs(updatedTx.forexGainLoss) >= 0.01) {
    const forexEntry = generateForexGainLossEntry(
      updatedTx.forexGainLoss,
      transaction.transactionNumber || '',
      forexGainAccountId,
      forexLossAccountId,
      transaction.projectId || transaction.costCentreId
    );

    if (forexEntry) {
      entries.push(forexEntry);
    }
  }

  return entries;
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
