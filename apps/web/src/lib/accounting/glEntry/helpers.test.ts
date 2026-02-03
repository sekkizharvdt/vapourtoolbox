/**
 * GL Entry Helpers Tests
 */

import { calculateGSTAmount, validateAndReturnEntries, validateGLEntries } from './helpers';

describe('GL Entry Helpers', () => {
  describe('calculateGSTAmount', () => {
    it('should return 0 when no gstDetails provided', () => {
      expect(calculateGSTAmount(undefined)).toBe(0);
    });

    it('should calculate total from CGST + SGST', () => {
      const result = calculateGSTAmount({
        cgstAmount: 900,
        sgstAmount: 900,
      } as never);
      expect(result).toBe(1800);
    });

    it('should calculate total from IGST', () => {
      const result = calculateGSTAmount({
        igstAmount: 1800,
      } as never);
      expect(result).toBe(1800);
    });

    it('should handle mixed GST components', () => {
      const result = calculateGSTAmount({
        cgstAmount: 500,
        sgstAmount: 500,
        igstAmount: 200,
      } as never);
      expect(result).toBe(1200);
    });

    it('should handle missing amount fields with 0 defaults', () => {
      const result = calculateGSTAmount({} as never);
      expect(result).toBe(0);
    });
  });

  describe('validateAndReturnEntries', () => {
    it('should return success for balanced entries', () => {
      const entries = [
        { accountId: 'acc-1', debit: 1000, credit: 0 },
        { accountId: 'acc-2', debit: 0, credit: 1000 },
      ];

      const result = validateAndReturnEntries(entries, []);

      expect(result.success).toBe(true);
      expect(result.isBalanced).toBe(true);
      expect(result.totalDebit).toBe(1000);
      expect(result.totalCredit).toBe(1000);
      expect(result.errors).toHaveLength(0);
    });

    it('should fail for unbalanced entries', () => {
      const entries = [
        { accountId: 'acc-1', debit: 1000, credit: 0 },
        { accountId: 'acc-2', debit: 0, credit: 500 },
      ];

      const result = validateAndReturnEntries(entries, []);

      expect(result.success).toBe(false);
      expect(result.isBalanced).toBe(false);
      expect(result.errors.length).toBeGreaterThan(0);
      expect(result.errors[0]).toContain('not balanced');
    });

    it('should allow 1 paisa rounding tolerance', () => {
      const entries = [
        { accountId: 'acc-1', debit: 1000.005, credit: 0 },
        { accountId: 'acc-2', debit: 0, credit: 1000 },
      ];

      const result = validateAndReturnEntries(entries, []);

      expect(result.isBalanced).toBe(true);
    });

    it('should sanitize entries by removing undefined optional fields', () => {
      const entries = [
        {
          accountId: 'acc-1',
          debit: 1000,
          credit: 0,
          accountCode: '1000',
          costCentreId: undefined as unknown as string,
        },
        { accountId: 'acc-2', debit: 0, credit: 1000 },
      ];

      const result = validateAndReturnEntries(entries, []);

      expect(result.entries[0]).not.toHaveProperty('costCentreId');
      expect(result.entries[0]).toHaveProperty('accountCode', '1000');
    });

    it('should exclude empty string costCentreId', () => {
      const entries = [
        { accountId: 'acc-1', debit: 1000, credit: 0, costCentreId: '' },
        { accountId: 'acc-2', debit: 0, credit: 1000 },
      ];

      const result = validateAndReturnEntries(entries, []);

      expect(result.entries[0]).not.toHaveProperty('costCentreId');
    });

    it('should preserve valid costCentreId', () => {
      const entries = [
        { accountId: 'acc-1', debit: 1000, credit: 0, costCentreId: 'cc-1' },
        { accountId: 'acc-2', debit: 0, credit: 1000 },
      ];

      const result = validateAndReturnEntries(entries, []);

      expect(result.entries[0]).toHaveProperty('costCentreId', 'cc-1');
    });

    it('should fail when pre-existing errors are passed', () => {
      const entries = [
        { accountId: 'acc-1', debit: 1000, credit: 0 },
        { accountId: 'acc-2', debit: 0, credit: 1000 },
      ];

      const result = validateAndReturnEntries(entries, ['Missing account']);

      expect(result.success).toBe(false);
      expect(result.isBalanced).toBe(true);
    });
  });

  describe('validateGLEntries', () => {
    it('should validate balanced entries with correct structure', () => {
      const entries = [
        { accountId: 'acc-1', debit: 5000, credit: 0 },
        { accountId: 'acc-2', debit: 0, credit: 5000 },
      ];

      const result = validateGLEntries(entries);

      expect(result.isValid).toBe(true);
      expect(result.errors).toHaveLength(0);
    });

    it('should reject empty entries', () => {
      const result = validateGLEntries([]);

      expect(result.isValid).toBe(false);
      expect(result.errors).toContain('Transaction must have at least one GL entry');
    });

    it('should reject unbalanced entries', () => {
      const entries = [
        { accountId: 'acc-1', debit: 5000, credit: 0 },
        { accountId: 'acc-2', debit: 0, credit: 3000 },
      ];

      const result = validateGLEntries(entries);

      expect(result.isValid).toBe(false);
      expect(result.errors.some((e) => e.includes('not balanced'))).toBe(true);
    });

    it('should reject entry without accountId', () => {
      const entries = [
        { accountId: '', debit: 1000, credit: 0 },
        { accountId: 'acc-2', debit: 0, credit: 1000 },
      ];

      const result = validateGLEntries(entries);

      expect(result.isValid).toBe(false);
      expect(result.errors.some((e) => e.includes('Account ID is required'))).toBe(true);
    });

    it('should reject negative amounts', () => {
      const entries = [
        { accountId: 'acc-1', debit: -1000, credit: 0 },
        { accountId: 'acc-2', debit: 0, credit: -1000 },
      ];

      const result = validateGLEntries(entries);

      expect(result.isValid).toBe(false);
      expect(result.errors.some((e) => e.includes('cannot be negative'))).toBe(true);
    });

    it('should reject entry with both debit and credit', () => {
      const entries = [
        { accountId: 'acc-1', debit: 1000, credit: 500 },
        { accountId: 'acc-2', debit: 0, credit: 500 },
      ];

      const result = validateGLEntries(entries);

      expect(result.isValid).toBe(false);
      expect(result.errors.some((e) => e.includes('both debit and credit'))).toBe(true);
    });

    it('should reject entry with zero debit and zero credit', () => {
      const entries = [
        { accountId: 'acc-1', debit: 1000, credit: 0 },
        { accountId: 'acc-2', debit: 0, credit: 1000 },
        { accountId: 'acc-3', debit: 0, credit: 0 },
      ];

      const result = validateGLEntries(entries);

      expect(result.isValid).toBe(false);
      expect(result.errors.some((e) => e.includes('must have either debit or credit'))).toBe(true);
    });

    it('should report multiple errors', () => {
      const entries = [
        { accountId: '', debit: -100, credit: 0 },
        { accountId: 'acc-2', debit: 500, credit: 500 },
      ];

      const result = validateGLEntries(entries);

      expect(result.isValid).toBe(false);
      expect(result.errors.length).toBeGreaterThanOrEqual(3);
    });
  });
});
