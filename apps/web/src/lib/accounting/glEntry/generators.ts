/**
 * GL Entry Generators
 *
 * Main GL entry generation functions for different transaction types
 *
 * Key Principles:
 * 1. Every transaction must have balanced entries (total debits = total credits)
 * 2. Entries follow Indian Accounting Standards
 * 3. GST and TDS are handled according to Indian tax laws
 * 4. All entries are validated before being saved
 */

import type { Firestore } from 'firebase/firestore';
import type { LedgerEntry } from '@vapour/types';
import { getSystemAccountIds } from '../systemAccountResolver';
import type { InvoiceGLInput, BillGLInput, PaymentGLInput, GLGenerationResult } from './types';
import { calculateGSTAmount, validateAndReturnEntries } from './helpers';

/**
 * Generate GL entries for a customer invoice
 *
 * Double-entry pattern:
 * Dr. Accounts Receivable    (Total including GST)
 *     Cr. Sales Revenue      (Subtotal)
 *     Cr. CGST Payable       (CGST amount)
 *     Cr. SGST Payable       (SGST amount)
 *     Cr. IGST Payable       (IGST amount)
 *
 * @param db - Firestore instance
 * @param input - Invoice data
 * @returns GL entries
 */
export async function generateInvoiceGLEntries(
  db: Firestore,
  input: InvoiceGLInput
): Promise<GLGenerationResult> {
  const errors: string[] = [];
  const entries: LedgerEntry[] = [];

  try {
    // Fetch system accounts
    const accounts = await getSystemAccountIds(db);

    // Validate required accounts exist
    if (!accounts.accountsReceivable) {
      errors.push('Accounts Receivable account not found in Chart of Accounts');
    }
    if (!accounts.revenue) {
      errors.push('Revenue account not found in Chart of Accounts');
    }

    if (errors.length > 0) {
      return {
        success: false,
        entries: [],
        totalDebit: 0,
        totalCredit: 0,
        isBalanced: false,
        errors,
      };
    }

    // Calculate total (subtotal + GST)
    const gstAmount = calculateGSTAmount(input.gstDetails);
    const totalAmount = input.subtotal + gstAmount;

    // Entry 1: Debit Accounts Receivable (Asset increases)
    entries.push({
      accountId: accounts.accountsReceivable!,
      accountCode: '1200',
      accountName: 'Trade Receivables (Debtors)',
      debit: totalAmount,
      credit: 0,
      description: 'Invoice raised',
      costCentreId: input.projectId,
    });

    // Entry 2: Credit Revenue (Income increases)
    entries.push({
      accountId: accounts.revenue!,
      accountCode: '4100',
      accountName: 'Sales Revenue',
      debit: 0,
      credit: input.subtotal,
      description: 'Revenue from invoice',
      costCentreId: input.projectId,
    });

    // Entry 3-5: Credit GST accounts (if GST applicable)
    if (input.gstDetails) {
      if (input.gstDetails.cgstAmount && input.gstDetails.cgstAmount > 0) {
        if (!accounts.cgstPayable) {
          errors.push('CGST Payable account not found');
        } else {
          entries.push({
            accountId: accounts.cgstPayable,
            accountCode: '2201',
            accountName: 'CGST Payable (Output)',
            debit: 0,
            credit: input.gstDetails.cgstAmount,
            description: 'CGST on invoice',
            costCentreId: input.projectId,
          });
        }
      }

      if (input.gstDetails.sgstAmount && input.gstDetails.sgstAmount > 0) {
        if (!accounts.sgstPayable) {
          errors.push('SGST Payable account not found');
        } else {
          entries.push({
            accountId: accounts.sgstPayable,
            accountCode: '2202',
            accountName: 'SGST Payable (Output)',
            debit: 0,
            credit: input.gstDetails.sgstAmount,
            description: 'SGST on invoice',
            costCentreId: input.projectId,
          });
        }
      }

      if (input.gstDetails.igstAmount && input.gstDetails.igstAmount > 0) {
        if (!accounts.igstPayable) {
          errors.push('IGST Payable account not found');
        } else {
          entries.push({
            accountId: accounts.igstPayable,
            accountCode: '2203',
            accountName: 'IGST Payable (Output)',
            debit: 0,
            credit: input.gstDetails.igstAmount,
            description: 'IGST on invoice',
            costCentreId: input.projectId,
          });
        }
      }
    }

    return validateAndReturnEntries(entries, errors);
  } catch (error) {
    console.error('[generateInvoiceGLEntries] Error:', error);
    return {
      success: false,
      entries: [],
      totalDebit: 0,
      totalCredit: 0,
      isBalanced: false,
      errors: [
        'Failed to generate GL entries: ' +
          (error instanceof Error ? error.message : 'Unknown error'),
      ],
    };
  }
}

/**
 * Generate GL entries for a vendor bill
 *
 * Double-entry pattern:
 * Dr. Expenses               (Subtotal)
 * Dr. CGST Input Tax Credit  (CGST amount)
 * Dr. SGST Input Tax Credit  (SGST amount)
 * Dr. IGST Input Tax Credit  (IGST amount)
 *     Cr. Accounts Payable   (Total - TDS)
 *     Cr. TDS Payable        (TDS amount)
 *
 * @param db - Firestore instance
 * @param input - Bill data
 * @returns GL entries
 */
export async function generateBillGLEntries(
  db: Firestore,
  input: BillGLInput
): Promise<GLGenerationResult> {
  const errors: string[] = [];
  const entries: LedgerEntry[] = [];

  try {
    // Fetch system accounts
    const accounts = await getSystemAccountIds(db);

    // Validate required accounts
    if (!accounts.expenses) {
      errors.push('Expense account not found in Chart of Accounts');
    }
    if (!accounts.accountsPayable) {
      errors.push('Accounts Payable account not found in Chart of Accounts');
    }

    if (errors.length > 0) {
      return {
        success: false,
        entries: [],
        totalDebit: 0,
        totalCredit: 0,
        isBalanced: false,
        errors,
      };
    }

    // Calculate amounts
    const gstAmount = calculateGSTAmount(input.gstDetails);
    const tdsAmount = input.tdsDetails?.tdsAmount || 0;
    const totalAmount = input.subtotal + gstAmount;
    const payableAmount = totalAmount - tdsAmount; // Net payable after TDS deduction

    // Entry 1: Debit Expenses (Expense increases)
    entries.push({
      accountId: accounts.expenses!,
      accountCode: '5100',
      accountName: 'Cost of Goods Sold',
      debit: input.subtotal,
      credit: 0,
      description: 'Expense from bill',
      costCentreId: input.projectId,
    });

    // Entry 2-4: Debit GST Input Tax Credit accounts (if GST applicable)
    if (input.gstDetails) {
      if (input.gstDetails.cgstAmount && input.gstDetails.cgstAmount > 0) {
        if (!accounts.cgstInput) {
          errors.push('CGST Input account not found');
        } else {
          entries.push({
            accountId: accounts.cgstInput,
            accountCode: '1301',
            accountName: 'CGST Input Tax Credit',
            debit: input.gstDetails.cgstAmount,
            credit: 0,
            description: 'CGST on bill',
            costCentreId: input.projectId,
          });
        }
      }

      if (input.gstDetails.sgstAmount && input.gstDetails.sgstAmount > 0) {
        if (!accounts.sgstInput) {
          errors.push('SGST Input account not found');
        } else {
          entries.push({
            accountId: accounts.sgstInput,
            accountCode: '1302',
            accountName: 'SGST Input Tax Credit',
            debit: input.gstDetails.sgstAmount,
            credit: 0,
            description: 'SGST on bill',
            costCentreId: input.projectId,
          });
        }
      }

      if (input.gstDetails.igstAmount && input.gstDetails.igstAmount > 0) {
        if (!accounts.igstInput) {
          errors.push('IGST Input account not found');
        } else {
          entries.push({
            accountId: accounts.igstInput,
            accountCode: '1303',
            accountName: 'IGST Input Tax Credit',
            debit: input.gstDetails.igstAmount,
            credit: 0,
            description: 'IGST on bill',
            costCentreId: input.projectId,
          });
        }
      }
    }

    // Entry 5: Credit Accounts Payable (Liability increases)
    entries.push({
      accountId: accounts.accountsPayable!,
      accountCode: '2100',
      accountName: 'Trade Payables (Creditors)',
      debit: 0,
      credit: payableAmount,
      description: 'Amount payable to vendor',
      costCentreId: input.projectId,
    });

    // Entry 6: Credit TDS Payable (if TDS applicable)
    if (tdsAmount > 0) {
      if (!accounts.tdsPayable) {
        errors.push('TDS Payable account not found');
      } else {
        entries.push({
          accountId: accounts.tdsPayable,
          accountCode: '2300',
          accountName: 'TDS Payable',
          debit: 0,
          credit: tdsAmount,
          description: 'TDS deducted on bill',
          costCentreId: input.projectId,
        });
      }
    }

    return validateAndReturnEntries(entries, errors);
  } catch (error) {
    console.error('[generateBillGLEntries] Error:', error);
    return {
      success: false,
      entries: [],
      totalDebit: 0,
      totalCredit: 0,
      isBalanced: false,
      errors: [
        'Failed to generate GL entries: ' +
          (error instanceof Error ? error.message : 'Unknown error'),
      ],
    };
  }
}

/**
 * Generate GL entries for a customer payment
 *
 * Double-entry pattern:
 * Dr. Bank Account           (Payment received)
 *     Cr. Accounts Receivable    (Asset decreases)
 *
 * @param db - Firestore instance
 * @param input - Payment data
 * @returns GL entries
 */
export async function generateCustomerPaymentGLEntries(
  _db: Firestore, // Reserved for future use to fetch system account IDs
  input: PaymentGLInput
): Promise<GLGenerationResult> {
  const errors: string[] = [];
  const entries: LedgerEntry[] = [];

  try {
    // Validate accounts
    if (!input.bankAccountId) {
      errors.push('Bank account ID is required');
    }
    if (!input.receivableOrPayableAccountId) {
      errors.push('Accounts Receivable account ID is required');
    }

    if (errors.length > 0) {
      return {
        success: false,
        entries: [],
        totalDebit: 0,
        totalCredit: 0,
        isBalanced: false,
        errors,
      };
    }

    // Entry 1: Debit Bank Account (Asset increases)
    entries.push({
      accountId: input.bankAccountId!,
      accountName: 'Bank Account',
      debit: input.amount,
      credit: 0,
      description: 'Customer payment received',
      costCentreId: input.projectId,
    });

    // Entry 2: Credit Accounts Receivable (Asset decreases)
    entries.push({
      accountId: input.receivableOrPayableAccountId!,
      accountCode: '1200',
      accountName: 'Trade Receivables (Debtors)',
      debit: 0,
      credit: input.amount,
      description: 'Payment against invoice',
      costCentreId: input.projectId,
    });

    return validateAndReturnEntries(entries, errors);
  } catch (error) {
    console.error('[generateCustomerPaymentGLEntries] Error:', error);
    return {
      success: false,
      entries: [],
      totalDebit: 0,
      totalCredit: 0,
      isBalanced: false,
      errors: [
        'Failed to generate GL entries: ' +
          (error instanceof Error ? error.message : 'Unknown error'),
      ],
    };
  }
}

/**
 * Generate GL entries for a vendor payment
 *
 * Double-entry pattern:
 * Dr. Accounts Payable       (Liability decreases)
 *     Cr. Bank Account           (Asset decreases)
 *
 * @param db - Firestore instance
 * @param input - Payment data
 * @returns GL entries
 */
export async function generateVendorPaymentGLEntries(
  _db: Firestore, // Reserved for future use to fetch system account IDs
  input: PaymentGLInput
): Promise<GLGenerationResult> {
  const errors: string[] = [];
  const entries: LedgerEntry[] = [];

  try {
    // Validate accounts
    if (!input.bankAccountId) {
      errors.push('Bank account ID is required');
    }
    if (!input.receivableOrPayableAccountId) {
      errors.push('Accounts Payable account ID is required');
    }

    if (errors.length > 0) {
      return {
        success: false,
        entries: [],
        totalDebit: 0,
        totalCredit: 0,
        isBalanced: false,
        errors,
      };
    }

    // Entry 1: Debit Accounts Payable (Liability decreases)
    entries.push({
      accountId: input.receivableOrPayableAccountId!,
      accountCode: '2100',
      accountName: 'Trade Payables (Creditors)',
      debit: input.amount,
      credit: 0,
      description: 'Payment to vendor',
      costCentreId: input.projectId,
    });

    // Entry 2: Credit Bank Account (Asset decreases)
    entries.push({
      accountId: input.bankAccountId!,
      accountName: 'Bank Account',
      debit: 0,
      credit: input.amount,
      description: 'Payment made to vendor',
      costCentreId: input.projectId,
    });

    return validateAndReturnEntries(entries, errors);
  } catch (error) {
    console.error('[generateVendorPaymentGLEntries] Error:', error);
    return {
      success: false,
      entries: [],
      totalDebit: 0,
      totalCredit: 0,
      isBalanced: false,
      errors: [
        'Failed to generate GL entries: ' +
          (error instanceof Error ? error.message : 'Unknown error'),
      ],
    };
  }
}
