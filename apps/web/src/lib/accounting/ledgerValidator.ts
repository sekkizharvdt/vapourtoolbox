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
 * Validate ledger entries for double-entry bookkeeping
 * Ensures debits = credits and all required fields are present
 */
export function validateLedgerEntries(entries: LedgerEntry[]): ValidationResult {
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
    // Check for account ID
    if (!entry.accountId) {
      errors.push(`Entry ${index + 1}: Account is required`);
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
export function validateSingleEntry(entry: LedgerEntry): ValidationResult {
  const errors: string[] = [];
  const warnings: string[] = [];

  if (!entry.accountId) {
    errors.push('Account is required');
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
