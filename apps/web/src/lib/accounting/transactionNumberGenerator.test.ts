/**
 * Transaction Number Generator Tests
 *
 * Tests for transaction number parsing and validation functions
 */

import { parseTransactionNumber, isValidTransactionNumber } from './transactionNumberGenerator';

describe('Transaction Number Generator', () => {
  describe('parseTransactionNumber', () => {
    it('should parse valid invoice number', () => {
      const result = parseTransactionNumber('INV-0001');

      expect(result).not.toBeNull();
      expect(result?.prefix).toBe('INV');
      expect(result?.number).toBe(1);
    });

    it('should parse valid bill number', () => {
      const result = parseTransactionNumber('BILL-0042');

      expect(result).not.toBeNull();
      expect(result?.prefix).toBe('BILL');
      expect(result?.number).toBe(42);
    });

    it('should parse valid journal entry number', () => {
      const result = parseTransactionNumber('JE-0123');

      expect(result).not.toBeNull();
      expect(result?.prefix).toBe('JE');
      expect(result?.number).toBe(123);
    });

    it('should parse number with leading zeros', () => {
      const result = parseTransactionNumber('RCPT-0001');

      expect(result).not.toBeNull();
      expect(result?.number).toBe(1);
    });

    it('should parse large numbers', () => {
      const result = parseTransactionNumber('INV-9999');

      expect(result).not.toBeNull();
      expect(result?.number).toBe(9999);
    });

    it('should parse 5+ digit numbers', () => {
      const result = parseTransactionNumber('INV-12345');

      expect(result).not.toBeNull();
      expect(result?.prefix).toBe('INV');
      expect(result?.number).toBe(12345);
    });

    it('should return null for invalid format - no prefix', () => {
      expect(parseTransactionNumber('0001')).toBeNull();
    });

    it('should return null for invalid format - no hyphen', () => {
      expect(parseTransactionNumber('INV0001')).toBeNull();
    });

    it('should return null for invalid format - lowercase prefix', () => {
      expect(parseTransactionNumber('inv-0001')).toBeNull();
    });

    it('should return null for invalid format - no number', () => {
      expect(parseTransactionNumber('INV-')).toBeNull();
    });

    it('should return null for invalid format - non-numeric suffix', () => {
      expect(parseTransactionNumber('INV-ABC1')).toBeNull();
    });

    it('should return null for empty string', () => {
      expect(parseTransactionNumber('')).toBeNull();
    });

    it('should return null for random text', () => {
      expect(parseTransactionNumber('random text')).toBeNull();
    });

    it('should return null for numbers with special chars', () => {
      expect(parseTransactionNumber('INV-00.01')).toBeNull();
      expect(parseTransactionNumber('INV-00-01')).toBeNull();
    });
  });

  describe('isValidTransactionNumber', () => {
    describe('valid formats', () => {
      it('should return true for standard 4-digit invoice number', () => {
        expect(isValidTransactionNumber('INV-0001')).toBe(true);
      });

      it('should return true for bill number', () => {
        expect(isValidTransactionNumber('BILL-0042')).toBe(true);
      });

      it('should return true for journal entry', () => {
        expect(isValidTransactionNumber('JE-0123')).toBe(true);
      });

      it('should return true for receipt', () => {
        expect(isValidTransactionNumber('RCPT-0001')).toBe(true);
      });

      it('should return true for vendor payment', () => {
        expect(isValidTransactionNumber('VPAY-0001')).toBe(true);
      });

      it('should return true for transfer', () => {
        expect(isValidTransactionNumber('TRF-9999')).toBe(true);
      });

      it('should return true for expense claim', () => {
        expect(isValidTransactionNumber('EXP-0001')).toBe(true);
      });

      it('should return true for number with all zeros', () => {
        expect(isValidTransactionNumber('INV-0000')).toBe(true);
      });
    });

    describe('invalid formats', () => {
      it('should return false for 3-digit number', () => {
        expect(isValidTransactionNumber('INV-001')).toBe(false);
      });

      it('should return false for 5-digit number', () => {
        expect(isValidTransactionNumber('INV-00001')).toBe(false);
      });

      it('should return false for lowercase prefix', () => {
        expect(isValidTransactionNumber('inv-0001')).toBe(false);
      });

      it('should return false for mixed case prefix', () => {
        expect(isValidTransactionNumber('Inv-0001')).toBe(false);
      });

      it('should return false for number only', () => {
        expect(isValidTransactionNumber('0001')).toBe(false);
      });

      it('should return false for prefix only', () => {
        expect(isValidTransactionNumber('INV-')).toBe(false);
      });

      it('should return false for no hyphen', () => {
        expect(isValidTransactionNumber('INV0001')).toBe(false);
      });

      it('should return false for extra hyphen', () => {
        expect(isValidTransactionNumber('INV--0001')).toBe(false);
      });

      it('should return false for spaces', () => {
        expect(isValidTransactionNumber('INV - 0001')).toBe(false);
        expect(isValidTransactionNumber(' INV-0001')).toBe(false);
        expect(isValidTransactionNumber('INV-0001 ')).toBe(false);
      });

      it('should return false for empty string', () => {
        expect(isValidTransactionNumber('')).toBe(false);
      });

      it('should return false for special characters in number', () => {
        expect(isValidTransactionNumber('INV-00.1')).toBe(false);
        expect(isValidTransactionNumber('INV-00,1')).toBe(false);
      });

      it('should return false for underscore instead of hyphen', () => {
        expect(isValidTransactionNumber('INV_0001')).toBe(false);
      });
    });
  });

  describe('Integration scenarios', () => {
    it('should correctly parse and validate same number', () => {
      const validNumber = 'INV-0042';

      expect(isValidTransactionNumber(validNumber)).toBe(true);

      const parsed = parseTransactionNumber(validNumber);
      expect(parsed).not.toBeNull();
      expect(parsed?.prefix).toBe('INV');
      expect(parsed?.number).toBe(42);
    });

    it('should correctly reject and fail to parse invalid number', () => {
      const invalidNumber = 'invalid-format';

      expect(isValidTransactionNumber(invalidNumber)).toBe(false);
      expect(parseTransactionNumber(invalidNumber)).toBeNull();
    });

    it('should handle all standard transaction types', () => {
      const standardNumbers = [
        'INV-0001', // Customer Invoice
        'RCPT-0001', // Customer Payment
        'BILL-0001', // Vendor Bill
        'VPAY-0001', // Vendor Payment
        'JE-0001', // Journal Entry
        'TRF-0001', // Bank Transfer
        'EXP-0001', // Expense Claim
      ];

      standardNumbers.forEach((num) => {
        expect(isValidTransactionNumber(num)).toBe(true);
        expect(parseTransactionNumber(num)).not.toBeNull();
      });
    });

    it('should handle sequence of transaction numbers', () => {
      const sequence = ['INV-0001', 'INV-0002', 'INV-0003', 'INV-0010', 'INV-0100', 'INV-1000'];

      const numbers = sequence.map((num) => parseTransactionNumber(num)?.number);

      expect(numbers).toEqual([1, 2, 3, 10, 100, 1000]);
    });
  });
});
