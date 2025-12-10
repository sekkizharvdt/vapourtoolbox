/**
 * Ledger Validator Tests
 *
 * Tests for double-entry bookkeeping validation including:
 * - Balance validation (debits = credits)
 * - Entry validation
 * - Balance calculations
 * - Format display
 */

import {
  validateLedgerEntries,
  calculateBalance,
  validateSingleEntry,
  formatLedgerEntriesForDisplay,
} from './ledgerValidator';
import type { LedgerEntry } from '@vapour/types';

// Helper to create valid ledger entries
const createValidEntries = (): LedgerEntry[] => [
  {
    accountId: 'acc-001',
    accountCode: '1001',
    accountName: 'Cash',
    debit: 1000,
    credit: 0,
    description: 'Cash received',
  },
  {
    accountId: 'acc-002',
    accountCode: '4001',
    accountName: 'Sales Revenue',
    debit: 0,
    credit: 1000,
    description: 'Sales revenue',
  },
];

describe('Ledger Validator', () => {
  describe('validateLedgerEntries', () => {
    describe('with valid entries', () => {
      it('should return valid for balanced entries', () => {
        const entries = createValidEntries();
        const result = validateLedgerEntries(entries);

        expect(result.isValid).toBe(true);
        expect(result.errors).toHaveLength(0);
      });

      it('should validate entries with multiple debits and credits', () => {
        const entries: LedgerEntry[] = [
          { accountId: 'acc-001', debit: 5000, credit: 0 },
          { accountId: 'acc-002', debit: 3000, credit: 0 },
          { accountId: 'acc-003', debit: 0, credit: 6000 },
          { accountId: 'acc-004', debit: 0, credit: 2000 },
        ];
        const result = validateLedgerEntries(entries);

        expect(result.isValid).toBe(true);
        expect(result.errors).toHaveLength(0);
      });

      it('should handle decimal amounts that balance', () => {
        const entries: LedgerEntry[] = [
          { accountId: 'acc-001', debit: 1000.5, credit: 0 },
          { accountId: 'acc-002', debit: 0, credit: 1000.5 },
        ];
        const result = validateLedgerEntries(entries);

        expect(result.isValid).toBe(true);
      });
    });

    describe('with empty or missing entries', () => {
      it('should error when entries array is empty', () => {
        const result = validateLedgerEntries([]);

        expect(result.isValid).toBe(false);
        expect(result.errors).toContain('At least one ledger entry is required');
      });

      it('should error when entries is null/undefined', () => {
        const result = validateLedgerEntries(null as unknown as LedgerEntry[]);

        expect(result.isValid).toBe(false);
        expect(result.errors).toContain('At least one ledger entry is required');
      });

      it('should error with single entry (need at least 2 for double-entry)', () => {
        const entries: LedgerEntry[] = [{ accountId: 'acc-001', debit: 1000, credit: 0 }];
        const result = validateLedgerEntries(entries);

        expect(result.isValid).toBe(false);
        expect(result.errors).toContain(
          'At least two ledger entries are required for double-entry bookkeeping'
        );
      });
    });

    describe('entry field validation', () => {
      it('should error when account ID is missing', () => {
        const entries: LedgerEntry[] = [
          { accountId: '', debit: 1000, credit: 0 },
          { accountId: 'acc-002', debit: 0, credit: 1000 },
        ];
        const result = validateLedgerEntries(entries);

        expect(result.isValid).toBe(false);
        expect(result.errors).toContain('Entry 1: Account is required');
      });

      it('should error when both debit and credit are zero', () => {
        const entries: LedgerEntry[] = [
          { accountId: 'acc-001', debit: 0, credit: 0 },
          { accountId: 'acc-002', debit: 1000, credit: 0 },
          { accountId: 'acc-003', debit: 0, credit: 1000 },
        ];
        const result = validateLedgerEntries(entries);

        expect(result.isValid).toBe(false);
        expect(result.errors).toContain(
          'Entry 1: Either debit or credit amount must be greater than zero'
        );
      });

      it('should error when entry has both debit and credit', () => {
        const entries: LedgerEntry[] = [
          { accountId: 'acc-001', debit: 1000, credit: 500 },
          { accountId: 'acc-002', debit: 0, credit: 500 },
        ];
        const result = validateLedgerEntries(entries);

        expect(result.isValid).toBe(false);
        expect(result.errors).toContain('Entry 1: Cannot have both debit and credit amounts');
      });

      it('should error when amounts are negative', () => {
        const entries: LedgerEntry[] = [
          { accountId: 'acc-001', debit: -1000, credit: 0 },
          { accountId: 'acc-002', debit: 0, credit: 1000 },
        ];
        const result = validateLedgerEntries(entries);

        expect(result.isValid).toBe(false);
        expect(result.errors).toContain('Entry 1: Amounts cannot be negative');
      });
    });

    describe('balance validation', () => {
      it('should error when debits do not equal credits', () => {
        const entries: LedgerEntry[] = [
          { accountId: 'acc-001', debit: 1000, credit: 0 },
          { accountId: 'acc-002', debit: 0, credit: 900 },
        ];
        const result = validateLedgerEntries(entries);

        expect(result.isValid).toBe(false);
        expect(result.errors.some((e) => e.includes('must equal'))).toBe(true);
      });

      it('should allow small floating point differences (within 0.01 tolerance)', () => {
        const entries: LedgerEntry[] = [
          { accountId: 'acc-001', debit: 1000.004, credit: 0 },
          { accountId: 'acc-002', debit: 0, credit: 1000.005 },
        ];
        const result = validateLedgerEntries(entries);

        // Difference is 0.001, within 0.01 tolerance
        expect(result.isValid).toBe(true);
      });

      it('should error when difference exceeds tolerance', () => {
        const entries: LedgerEntry[] = [
          { accountId: 'acc-001', debit: 1000, credit: 0 },
          { accountId: 'acc-002', debit: 0, credit: 999.98 },
        ];
        const result = validateLedgerEntries(entries);

        // Difference is 0.02, exceeds 0.01 tolerance
        expect(result.isValid).toBe(false);
      });
    });

    describe('warnings', () => {
      it('should warn when entries exceed 20', () => {
        const entries: LedgerEntry[] = [];
        // Create 22 entries (11 debits, 11 credits)
        for (let i = 0; i < 11; i++) {
          entries.push({ accountId: `acc-debit-${i}`, debit: 100, credit: 0 });
          entries.push({ accountId: `acc-credit-${i}`, debit: 0, credit: 100 });
        }
        const result = validateLedgerEntries(entries);

        expect(result.warnings).toContain(
          'Large number of entries. Consider splitting into multiple journal entries.'
        );
      });

      it('should warn when duplicate accounts detected', () => {
        const entries: LedgerEntry[] = [
          { accountId: 'acc-001', debit: 500, credit: 0 },
          { accountId: 'acc-001', debit: 500, credit: 0 },
          { accountId: 'acc-002', debit: 0, credit: 1000 },
        ];
        const result = validateLedgerEntries(entries);

        expect(result.warnings).toContain(
          'Multiple entries for the same account detected. This may be intentional.'
        );
      });
    });
  });

  describe('calculateBalance', () => {
    it('should calculate totals and balance for valid entries', () => {
      const entries: LedgerEntry[] = [
        { accountId: 'acc-001', debit: 1000, credit: 0 },
        { accountId: 'acc-002', debit: 0, credit: 1000 },
      ];
      const result = calculateBalance(entries);

      expect(result.totalDebits).toBe(1000);
      expect(result.totalCredits).toBe(1000);
      expect(result.balance).toBe(0);
      expect(result.isBalanced).toBe(true);
    });

    it('should return unbalanced result when debits > credits', () => {
      const entries: LedgerEntry[] = [
        { accountId: 'acc-001', debit: 1500, credit: 0 },
        { accountId: 'acc-002', debit: 0, credit: 1000 },
      ];
      const result = calculateBalance(entries);

      expect(result.totalDebits).toBe(1500);
      expect(result.totalCredits).toBe(1000);
      expect(result.balance).toBe(500);
      expect(result.isBalanced).toBe(false);
    });

    it('should return unbalanced result when credits > debits', () => {
      const entries: LedgerEntry[] = [
        { accountId: 'acc-001', debit: 800, credit: 0 },
        { accountId: 'acc-002', debit: 0, credit: 1000 },
      ];
      const result = calculateBalance(entries);

      expect(result.totalDebits).toBe(800);
      expect(result.totalCredits).toBe(1000);
      expect(result.balance).toBe(-200);
      expect(result.isBalanced).toBe(false);
    });

    it('should handle empty entries', () => {
      const result = calculateBalance([]);

      expect(result.totalDebits).toBe(0);
      expect(result.totalCredits).toBe(0);
      expect(result.balance).toBe(0);
      expect(result.isBalanced).toBe(true);
    });

    it('should round totals to 2 decimal places', () => {
      const entries: LedgerEntry[] = [
        { accountId: 'acc-001', debit: 100.333, credit: 0 },
        { accountId: 'acc-002', debit: 100.333, credit: 0 },
        { accountId: 'acc-003', debit: 0, credit: 200.666 },
      ];
      const result = calculateBalance(entries);

      expect(result.totalDebits).toBe(200.67);
      expect(result.totalCredits).toBe(200.67);
      expect(result.balance).toBe(0);
    });

    it('should consider balanced when difference within 0.01 tolerance', () => {
      const entries: LedgerEntry[] = [
        { accountId: 'acc-001', debit: 1000.004, credit: 0 },
        { accountId: 'acc-002', debit: 0, credit: 1000.005 },
      ];
      const result = calculateBalance(entries);

      expect(result.isBalanced).toBe(true);
    });
  });

  describe('validateSingleEntry', () => {
    it('should return valid for correct entry', () => {
      const entry: LedgerEntry = {
        accountId: 'acc-001',
        debit: 1000,
        credit: 0,
      };
      const result = validateSingleEntry(entry);

      expect(result.isValid).toBe(true);
      expect(result.errors).toHaveLength(0);
    });

    it('should error when account ID is missing', () => {
      const entry: LedgerEntry = {
        accountId: '',
        debit: 1000,
        credit: 0,
      };
      const result = validateSingleEntry(entry);

      expect(result.isValid).toBe(false);
      expect(result.errors).toContain('Account is required');
    });

    it('should error when both debit and credit are zero', () => {
      const entry: LedgerEntry = {
        accountId: 'acc-001',
        debit: 0,
        credit: 0,
      };
      const result = validateSingleEntry(entry);

      expect(result.isValid).toBe(false);
      expect(result.errors).toContain('Either debit or credit amount must be greater than zero');
    });

    it('should error when both debit and credit have values', () => {
      const entry: LedgerEntry = {
        accountId: 'acc-001',
        debit: 1000,
        credit: 500,
      };
      const result = validateSingleEntry(entry);

      expect(result.isValid).toBe(false);
      expect(result.errors).toContain('Cannot have both debit and credit amounts');
    });

    it('should error when amounts are negative', () => {
      const entry: LedgerEntry = {
        accountId: 'acc-001',
        debit: -100,
        credit: 0,
      };
      const result = validateSingleEntry(entry);

      expect(result.isValid).toBe(false);
      expect(result.errors).toContain('Amounts cannot be negative');
    });

    it('should allow credit-only entries', () => {
      const entry: LedgerEntry = {
        accountId: 'acc-001',
        debit: 0,
        credit: 1000,
      };
      const result = validateSingleEntry(entry);

      expect(result.isValid).toBe(true);
    });
  });

  describe('formatLedgerEntriesForDisplay', () => {
    it('should format entries with account names', () => {
      const entries: LedgerEntry[] = [
        { accountId: 'acc-001', accountName: 'Cash', debit: 1000, credit: 0 },
        { accountId: 'acc-002', accountName: 'Sales Revenue', debit: 0, credit: 1000 },
      ];
      const output = formatLedgerEntriesForDisplay(entries);

      expect(output).toContain('Cash');
      expect(output).toContain('Sales Revenue');
      expect(output).toContain('1000.00');
    });

    it('should use account code when name is not available', () => {
      const entries: LedgerEntry[] = [
        { accountId: 'acc-001', accountCode: '1001', debit: 1000, credit: 0 },
        { accountId: 'acc-002', accountCode: '4001', debit: 0, credit: 1000 },
      ];
      const output = formatLedgerEntriesForDisplay(entries);

      expect(output).toContain('1001');
      expect(output).toContain('4001');
    });

    it('should fall back to account ID when no name or code', () => {
      const entries: LedgerEntry[] = [
        { accountId: 'acc-001', debit: 1000, credit: 0 },
        { accountId: 'acc-002', debit: 0, credit: 1000 },
      ];
      const output = formatLedgerEntriesForDisplay(entries);

      expect(output).toContain('acc-001');
      expect(output).toContain('acc-002');
    });

    it('should include totals row', () => {
      const entries: LedgerEntry[] = [
        { accountId: 'acc-001', debit: 1000, credit: 0 },
        { accountId: 'acc-002', debit: 0, credit: 1000 },
      ];
      const output = formatLedgerEntriesForDisplay(entries);

      expect(output).toContain('Total');
    });

    it('should show dash for zero amounts', () => {
      const entries: LedgerEntry[] = [
        { accountId: 'acc-001', debit: 1000, credit: 0 },
        { accountId: 'acc-002', debit: 0, credit: 1000 },
      ];
      const output = formatLedgerEntriesForDisplay(entries);

      expect(output).toContain('-');
    });
  });
});
