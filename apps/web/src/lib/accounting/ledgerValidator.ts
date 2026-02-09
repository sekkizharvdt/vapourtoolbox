/**
 * Ledger Entry Validator
 * Validates double-entry bookkeeping rules
 */

import type { LedgerEntry } from '@vapour/types';

export interface ValidationResult {
  isValid: boolean;
  errors: string[];
  warnings: string[];
}

/**
 * Extended ledger entry that may have entityId without accountId
 * The accountId will be resolved from the entity's control account before saving
 */
export interface LedgerEntryWithEntity extends Omit<LedgerEntry, 'accountId'> {
  accountId?: string;
  entityId?: string;
  entityName?: string;
}

/**
 * Validate ledger entries for double-entry bookkeeping
 * Ensures debits = credits and all required fields are present
 *
 * Note: Entries can have either accountId OR entityId (for entity-based entries).
 * When entityId is provided without accountId, the control account will be
 * resolved based on the entity's role (Customer → Accounts Receivable,
 * Vendor → Accounts Payable) before saving.
 */
export function validateLedgerEntries(entries: LedgerEntryWithEntity[]): ValidationResult {
  const errors: string[] = [];
  const warnings: string[] = [];

  // Check if entries exist
  if (!entries || entries.length === 0) {
    errors.push('At least one ledger entry is required');
    return { isValid: false, errors, warnings };
  }

  // Check for minimum entries (need at least 2 for double-entry)
  if (entries.length < 2) {
    errors.push('At least two ledger entries are required for double-entry bookkeeping');
  }

  // Validate each entry
  entries.forEach((entry, index) => {
    // Check for account ID or entity ID (at least one must be present)
    const hasAccount = !!entry.accountId;
    const hasEntity = !!entry.entityId;

    if (!hasAccount && !hasEntity) {
      errors.push(`Entry ${index + 1}: Account or Entity is required`);
    }

    // Check that debit or credit (but not both) is specified
    const hasDebit = entry.debit > 0;
    const hasCredit = entry.credit > 0;

    if (!hasDebit && !hasCredit) {
      errors.push(`Entry ${index + 1}: Either debit or credit amount must be greater than zero`);
    }

    if (hasDebit && hasCredit) {
      errors.push(`Entry ${index + 1}: Cannot have both debit and credit amounts`);
    }

    // Check for negative amounts
    if (entry.debit < 0 || entry.credit < 0) {
      errors.push(`Entry ${index + 1}: Amounts cannot be negative`);
    }
  });

  // Calculate totals
  const totalDebits = entries.reduce((sum, entry) => sum + (entry.debit || 0), 0);
  const totalCredits = entries.reduce((sum, entry) => sum + (entry.credit || 0), 0);

  // Check if debits equal credits (with small tolerance for floating point errors)
  const difference = Math.abs(totalDebits - totalCredits);
  const tolerance = 0.01; // 1 paisa tolerance

  if (difference > tolerance) {
    errors.push(
      `Total debits (${totalDebits.toFixed(2)}) must equal total credits (${totalCredits.toFixed(2)}). Difference: ${difference.toFixed(2)}`
    );
  }

  // Warnings for best practices
  if (entries.length > 20) {
    warnings.push('Large number of entries. Consider splitting into multiple journal entries.');
  }

  // Check for duplicate accounts
  const accountIds = entries.map((e) => e.accountId).filter(Boolean);
  const duplicates = accountIds.filter((id, index) => accountIds.indexOf(id) !== index);
  if (duplicates.length > 0) {
    warnings.push('Multiple entries for the same account detected. This may be intentional.');
  }

  return {
    isValid: errors.length === 0,
    errors,
    warnings,
  };
}

/**
 * Calculate balance from ledger entries
 */
export function calculateBalance(entries: LedgerEntry[]): {
  totalDebits: number;
  totalCredits: number;
  balance: number;
  isBalanced: boolean;
} {
  const totalDebits = entries.reduce((sum, entry) => sum + (entry.debit || 0), 0);
  const totalCredits = entries.reduce((sum, entry) => sum + (entry.credit || 0), 0);
  const balance = totalDebits - totalCredits;
  const tolerance = 0.01;

  return {
    totalDebits: parseFloat(totalDebits.toFixed(2)),
    totalCredits: parseFloat(totalCredits.toFixed(2)),
    balance: parseFloat(balance.toFixed(2)),
    isBalanced: Math.abs(balance) <= tolerance,
  };
}

/**
 * Validate single ledger entry
 */
export function validateSingleEntry(entry: LedgerEntryWithEntity): ValidationResult {
  const errors: string[] = [];
  const warnings: string[] = [];

  // Check for account ID or entity ID (at least one must be present)
  const hasAccount = !!entry.accountId;
  const hasEntity = !!entry.entityId;

  if (!hasAccount && !hasEntity) {
    errors.push('Account or Entity is required');
  }

  const hasDebit = entry.debit > 0;
  const hasCredit = entry.credit > 0;

  if (!hasDebit && !hasCredit) {
    errors.push('Either debit or credit amount must be greater than zero');
  }

  if (hasDebit && hasCredit) {
    errors.push('Cannot have both debit and credit amounts');
  }

  if (entry.debit < 0 || entry.credit < 0) {
    errors.push('Amounts cannot be negative');
  }

  return {
    isValid: errors.length === 0,
    errors,
    warnings,
  };
}

// ============================================================================
// AC-10: TRANSACTION-TYPE BUSINESS LOGIC VALIDATION
// ============================================================================

/**
 * Expected account patterns for each transaction type.
 *
 * Account codes follow Indian Accounting Standards:
 * - 1200: Accounts Receivable (Trade Receivables / Debtors)
 * - 2100: Accounts Payable (Trade Payables / Creditors)
 * - 4100: Sales Revenue
 * - 5100: Cost of Goods Sold / Expenses
 */
const EXPECTED_PATTERNS: Record<
  string,
  { requiredDebitCodes?: string[]; requiredCreditCodes?: string[]; description: string }
> = {
  CUSTOMER_INVOICE: {
    requiredDebitCodes: ['1200'],
    requiredCreditCodes: ['4100'],
    description: 'Customer Invoice must debit Accounts Receivable (1200) and credit Revenue (4100)',
  },
  VENDOR_BILL: {
    requiredCreditCodes: ['2100'],
    requiredDebitCodes: ['5100'],
    description: 'Vendor Bill must debit Expenses (5100) and credit Accounts Payable (2100)',
  },
  CUSTOMER_PAYMENT: {
    requiredCreditCodes: ['1200'],
    description: 'Customer Payment must credit Accounts Receivable (1200)',
  },
  VENDOR_PAYMENT: {
    requiredDebitCodes: ['2100'],
    description: 'Vendor Payment must debit Accounts Payable (2100)',
  },
};

/**
 * Validate GL entries against expected business rules for a transaction type.
 * Returns warnings (not errors) since GST/TDS entries may alter expected patterns.
 */
export function validateTransactionBusinessRules(
  entries: LedgerEntryWithEntity[],
  transactionType: string
): ValidationResult {
  const errors: string[] = [];
  const warnings: string[] = [];

  const pattern = EXPECTED_PATTERNS[transactionType];
  if (!pattern) {
    return { isValid: true, errors, warnings };
  }

  const debitCodes = entries.filter((e) => e.debit > 0).map((e) => e.accountCode);
  const creditCodes = entries.filter((e) => e.credit > 0).map((e) => e.accountCode);

  if (pattern.requiredDebitCodes) {
    for (const code of pattern.requiredDebitCodes) {
      if (!debitCodes.includes(code)) {
        warnings.push(
          `Expected debit entry for account ${code} in ${transactionType}. ${pattern.description}`
        );
      }
    }
  }

  if (pattern.requiredCreditCodes) {
    for (const code of pattern.requiredCreditCodes) {
      if (!creditCodes.includes(code)) {
        warnings.push(
          `Expected credit entry for account ${code} in ${transactionType}. ${pattern.description}`
        );
      }
    }
  }

  return { isValid: errors.length === 0, errors, warnings };
}

/**
 * Format ledger entries for display
 */
export function formatLedgerEntriesForDisplay(entries: LedgerEntry[]): string {
  let output = 'Account\t\t\tDebit\t\tCredit\n';
  output += '='.repeat(60) + '\n';

  entries.forEach((entry) => {
    const accountName = entry.accountName || entry.accountCode || entry.accountId;
    const debit = entry.debit > 0 ? entry.debit.toFixed(2) : '-';
    const credit = entry.credit > 0 ? entry.credit.toFixed(2) : '-';
    output += `${accountName}\t\t${debit}\t\t${credit}\n`;
  });

  const { totalDebits, totalCredits } = calculateBalance(entries);
  output += '='.repeat(60) + '\n';
  output += `Total\t\t\t${totalDebits.toFixed(2)}\t\t${totalCredits.toFixed(2)}\n`;

  return output;
}
