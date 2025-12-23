/**
 * Transaction Service Tests
 *
 * Tests for double-entry enforcement and transaction validation.
 * Note: These tests focus on the enforceDoubleEntry wrapper and error handling.
 * The underlying validation logic is tested in ledgerValidator.test.ts.
 */

import {
  enforceDoubleEntry,
  validateTransactionEntries,
  UnbalancedEntriesError,
} from './transactionService';
import type { LedgerEntry } from '@vapour/types';

// Helper to create valid balanced entries
const createBalancedEntries = (amount: number = 1000): LedgerEntry[] => [
  {
    accountId: 'acc-001',
    accountCode: '1001',
    accountName: 'Cash',
    debit: amount,
    credit: 0,
    description: 'Cash received',
  },
  {
    accountId: 'acc-002',
    accountCode: '4001',
    accountName: 'Sales Revenue',
    debit: 0,
    credit: amount,
    description: 'Sales revenue',
  },
];

// Helper to create unbalanced entries
const createUnbalancedEntries = (): LedgerEntry[] => [
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
    credit: 900, // Unbalanced - 100 short
    description: 'Sales revenue',
  },
];

describe('Transaction Service', () => {
  describe('UnbalancedEntriesError', () => {
    it('should be an instance of Error', () => {
      const error = new UnbalancedEntriesError('Test error', 1000, 900, ['Unbalanced']);

      expect(error).toBeInstanceOf(Error);
      expect(error.name).toBe('UnbalancedEntriesError');
    });

    it('should store debit and credit totals', () => {
      const error = new UnbalancedEntriesError('Test error', 1500, 1200, ['Unbalanced']);

      expect(error.totalDebit).toBe(1500);
      expect(error.totalCredit).toBe(1200);
    });

    it('should store validation errors array', () => {
      const errors = ['Error 1', 'Error 2', 'Error 3'];
      const error = new UnbalancedEntriesError('Test error', 1000, 800, errors);

      expect(error.errors).toEqual(errors);
      expect(error.errors).toHaveLength(3);
    });

    it('should have correct message', () => {
      const error = new UnbalancedEntriesError('Custom message', 1000, 900, []);

      expect(error.message).toBe('Custom message');
    });
  });

  describe('enforceDoubleEntry', () => {
    describe('with valid entries', () => {
      it('should not throw for balanced entries', () => {
        const entries = createBalancedEntries();

        expect(() => enforceDoubleEntry(entries)).not.toThrow();
      });

      it('should not throw for empty entries array', () => {
        // Empty entries are allowed for some transactions (e.g., payments without bank account)
        expect(() => enforceDoubleEntry([])).not.toThrow();
      });

      it('should not throw for undefined entries', () => {
        expect(() => enforceDoubleEntry(undefined)).not.toThrow();
      });

      it('should not throw for multiple balanced entries', () => {
        const entries: LedgerEntry[] = [
          { accountId: 'acc-001', debit: 5000, credit: 0 },
          { accountId: 'acc-002', debit: 3000, credit: 0 },
          { accountId: 'acc-003', debit: 0, credit: 6000 },
          { accountId: 'acc-004', debit: 0, credit: 2000 },
        ];

        expect(() => enforceDoubleEntry(entries)).not.toThrow();
      });

      it('should allow small floating point differences (within tolerance)', () => {
        const entries: LedgerEntry[] = [
          { accountId: 'acc-001', debit: 1000.004, credit: 0 },
          { accountId: 'acc-002', debit: 0, credit: 1000.005 },
        ];

        // Difference is 0.001, within 0.01 tolerance
        expect(() => enforceDoubleEntry(entries)).not.toThrow();
      });
    });

    describe('with invalid entries', () => {
      it('should throw UnbalancedEntriesError for unbalanced entries', () => {
        const entries = createUnbalancedEntries();

        expect(() => enforceDoubleEntry(entries)).toThrow(UnbalancedEntriesError);
      });

      it('should include totals in error when entries are unbalanced', () => {
        const entries = createUnbalancedEntries();

        try {
          enforceDoubleEntry(entries);
          // Should not reach here
          expect(true).toBe(false);
        } catch (error) {
          expect(error).toBeInstanceOf(UnbalancedEntriesError);
          if (error instanceof UnbalancedEntriesError) {
            expect(error.totalDebit).toBe(1000);
            expect(error.totalCredit).toBe(900);
          }
        }
      });

      it('should throw for single entry (needs at least 2 for double-entry)', () => {
        const entries: LedgerEntry[] = [{ accountId: 'acc-001', debit: 1000, credit: 0 }];

        expect(() => enforceDoubleEntry(entries)).toThrow(UnbalancedEntriesError);
      });

      it('should throw for missing account ID', () => {
        const entries: LedgerEntry[] = [
          { accountId: '', debit: 1000, credit: 0 },
          { accountId: 'acc-002', debit: 0, credit: 1000 },
        ];

        expect(() => enforceDoubleEntry(entries)).toThrow(UnbalancedEntriesError);
      });

      it('should throw for negative amounts', () => {
        const entries: LedgerEntry[] = [
          { accountId: 'acc-001', debit: -1000, credit: 0 },
          { accountId: 'acc-002', debit: 0, credit: 1000 },
        ];

        expect(() => enforceDoubleEntry(entries)).toThrow(UnbalancedEntriesError);
      });

      it('should throw for entry with both debit and credit', () => {
        const entries: LedgerEntry[] = [
          { accountId: 'acc-001', debit: 1000, credit: 500 },
          { accountId: 'acc-002', debit: 0, credit: 500 },
        ];

        expect(() => enforceDoubleEntry(entries)).toThrow(UnbalancedEntriesError);
      });

      it('should throw when difference exceeds tolerance', () => {
        const entries: LedgerEntry[] = [
          { accountId: 'acc-001', debit: 1000, credit: 0 },
          { accountId: 'acc-002', debit: 0, credit: 999.98 },
        ];

        // Difference is 0.02, exceeds 0.01 tolerance
        expect(() => enforceDoubleEntry(entries)).toThrow(UnbalancedEntriesError);
      });

      it('should include meaningful error messages', () => {
        const entries = createUnbalancedEntries();

        try {
          enforceDoubleEntry(entries);
        } catch (error) {
          expect(error).toBeInstanceOf(UnbalancedEntriesError);
          if (error instanceof UnbalancedEntriesError) {
            expect(error.message).toContain('Cannot save transaction');
            expect(error.errors.length).toBeGreaterThan(0);
          }
        }
      });
    });

    describe('edge cases', () => {
      it('should handle very large amounts', () => {
        const entries: LedgerEntry[] = [
          { accountId: 'acc-001', debit: 999999999.99, credit: 0 },
          { accountId: 'acc-002', debit: 0, credit: 999999999.99 },
        ];

        expect(() => enforceDoubleEntry(entries)).not.toThrow();
      });

      it('should handle very small amounts', () => {
        const entries: LedgerEntry[] = [
          { accountId: 'acc-001', debit: 0.01, credit: 0 },
          { accountId: 'acc-002', debit: 0, credit: 0.01 },
        ];

        expect(() => enforceDoubleEntry(entries)).not.toThrow();
      });

      it('should handle many entries (20+)', () => {
        const entries: LedgerEntry[] = [];
        // Create 22 balanced entries
        for (let i = 0; i < 11; i++) {
          entries.push({ accountId: `acc-debit-${i}`, debit: 100, credit: 0 });
          entries.push({ accountId: `acc-credit-${i}`, debit: 0, credit: 100 });
        }

        // Should not throw, but may have warnings
        expect(() => enforceDoubleEntry(entries)).not.toThrow();
      });
    });
  });

  describe('validateTransactionEntries', () => {
    it('should return valid result for balanced entries', () => {
      const entries = createBalancedEntries();
      const result = validateTransactionEntries(entries);

      expect(result.isValid).toBe(true);
      expect(result.totalDebit).toBe(1000);
      expect(result.totalCredit).toBe(1000);
      expect(result.difference).toBe(0);
      expect(result.errors).toHaveLength(0);
    });

    it('should return invalid result for unbalanced entries', () => {
      const entries = createUnbalancedEntries();
      const result = validateTransactionEntries(entries);

      expect(result.isValid).toBe(false);
      expect(result.totalDebit).toBe(1000);
      expect(result.totalCredit).toBe(900);
      expect(result.difference).toBe(100);
      expect(result.errors.length).toBeGreaterThan(0);
    });

    it('should include warnings for large entry count', () => {
      const entries: LedgerEntry[] = [];
      // Create 22 entries
      for (let i = 0; i < 11; i++) {
        entries.push({ accountId: `acc-debit-${i}`, debit: 100, credit: 0 });
        entries.push({ accountId: `acc-credit-${i}`, debit: 0, credit: 100 });
      }
      const result = validateTransactionEntries(entries);

      expect(result.isValid).toBe(true);
      expect(result.warnings.length).toBeGreaterThan(0);
      expect(result.warnings.some((w) => w.includes('Large number of entries'))).toBe(true);
    });

    it('should include warnings for duplicate accounts', () => {
      const entries: LedgerEntry[] = [
        { accountId: 'acc-001', debit: 500, credit: 0 },
        { accountId: 'acc-001', debit: 500, credit: 0 },
        { accountId: 'acc-002', debit: 0, credit: 1000 },
      ];
      const result = validateTransactionEntries(entries);

      expect(result.isValid).toBe(true);
      expect(result.warnings.some((w) => w.includes('Multiple entries for the same account'))).toBe(
        true
      );
    });

    it('should calculate correct difference for various amounts', () => {
      const entries: LedgerEntry[] = [
        { accountId: 'acc-001', debit: 1500.5, credit: 0 },
        { accountId: 'acc-002', debit: 0, credit: 1000.25 },
      ];
      const result = validateTransactionEntries(entries);

      expect(result.totalDebit).toBe(1500.5);
      expect(result.totalCredit).toBe(1000.25);
      expect(result.difference).toBe(500.25);
    });

    it('should handle empty entries array', () => {
      const result = validateTransactionEntries([]);

      expect(result.isValid).toBe(false);
      expect(result.errors.length).toBeGreaterThan(0);
    });
  });
});
