/**
 * GL Entry Generator Helpers
 *
 * Helper functions for GL entry calculations and validation
 */

import type { LedgerEntry, GSTDetails } from '@vapour/types';
import type { GLGenerationResult } from './types';

/**
 * Calculate total GST amount from GST details
 */
export function calculateGSTAmount(gstDetails?: GSTDetails): number {
  if (!gstDetails) return 0;

  const cgst = gstDetails.cgstAmount || 0;
  const sgst = gstDetails.sgstAmount || 0;
  const igst = gstDetails.igstAmount || 0;

  return cgst + sgst + igst;
}

/**
 * Validate GL entries and calculate totals
 * Ensures debits = credits (fundamental accounting principle)
 */
export function validateAndReturnEntries(
  entries: LedgerEntry[],
  errors: string[]
): GLGenerationResult {
  // Calculate totals
  const totalDebit = entries.reduce((sum, entry) => sum + entry.debit, 0);
  const totalCredit = entries.reduce((sum, entry) => sum + entry.credit, 0);

  // Check if balanced (allow for small rounding errors)
  const difference = Math.abs(totalDebit - totalCredit);
  const isBalanced = difference < 0.01; // Allow 1 paisa difference due to rounding

  if (!isBalanced) {
    errors.push(
      `GL entries are not balanced: Debits (${totalDebit.toFixed(2)}) ≠ Credits (${totalCredit.toFixed(2)})`
    );
  }

  return {
    success: isBalanced && errors.length === 0,
    entries,
    totalDebit,
    totalCredit,
    isBalanced,
    errors,
  };
}

/**
 * Validate GL entries before saving
 * This is a safety check that should be called before persisting any transaction
 */
export function validateGLEntries(entries: LedgerEntry[]): {
  isValid: boolean;
  errors: string[];
} {
  const errors: string[] = [];

  // Check if entries exist
  if (!entries || entries.length === 0) {
    errors.push('Transaction must have at least one GL entry');
    return { isValid: false, errors };
  }

  // Check if entries are balanced
  const totalDebit = entries.reduce((sum, entry) => sum + entry.debit, 0);
  const totalCredit = entries.reduce((sum, entry) => sum + entry.credit, 0);
  const difference = Math.abs(totalDebit - totalCredit);

  if (difference >= 0.01) {
    errors.push(
      `GL entries not balanced: Debits (${totalDebit.toFixed(2)}) ≠ Credits (${totalCredit.toFixed(2)})`
    );
  }

  // Check each entry
  entries.forEach((entry, index) => {
    if (!entry.accountId) {
      errors.push(`Entry ${index + 1}: Account ID is required`);
    }

    if (entry.debit < 0 || entry.credit < 0) {
      errors.push(`Entry ${index + 1}: Debit and credit amounts cannot be negative`);
    }

    if (entry.debit > 0 && entry.credit > 0) {
      errors.push(`Entry ${index + 1}: Entry cannot have both debit and credit`);
    }

    if (entry.debit === 0 && entry.credit === 0) {
      errors.push(`Entry ${index + 1}: Entry must have either debit or credit amount`);
    }
  });

  return {
    isValid: errors.length === 0,
    errors,
  };
}
