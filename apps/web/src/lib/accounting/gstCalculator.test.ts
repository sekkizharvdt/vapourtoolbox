/**
 * GST Calculator Tests
 *
 * Tests for Indian GST calculations including:
 * - CGST + SGST (intra-state)
 * - IGST (inter-state)
 * - GSTIN validation
 * - Rate validation
 */

import {
  calculateGST,
  calculateReverseChargeGST,
  isValidGSTRate,
  getGSTRateSuggestions,
  getStateFromGSTIN,
  isValidGSTIN,
} from './gstCalculator';

describe('GST Calculator', () => {
  describe('calculateGST', () => {
    describe('intra-state transactions (CGST + SGST)', () => {
      it('should calculate 18% GST for same state', () => {
        const result = calculateGST({
          taxableAmount: 10000,
          gstRate: 18,
          sourceState: 'KA',
          destinationState: 'KA',
        });

        expect(result.gstType).toBe('CGST_SGST');
        expect(result.taxableAmount).toBe(10000);
        expect(result.cgstRate).toBe(9);
        expect(result.cgstAmount).toBe(900);
        expect(result.sgstRate).toBe(9);
        expect(result.sgstAmount).toBe(900);
        expect(result.totalGST).toBe(1800);
        expect(result.placeOfSupply).toBe('KA');
      });

      it('should calculate 12% GST correctly', () => {
        const result = calculateGST({
          taxableAmount: 5000,
          gstRate: 12,
          sourceState: 'MH',
          destinationState: 'MH',
        });

        expect(result.gstType).toBe('CGST_SGST');
        expect(result.cgstRate).toBe(6);
        expect(result.cgstAmount).toBe(300);
        expect(result.sgstRate).toBe(6);
        expect(result.sgstAmount).toBe(300);
        expect(result.totalGST).toBe(600);
      });

      it('should calculate 5% GST correctly', () => {
        const result = calculateGST({
          taxableAmount: 1000,
          gstRate: 5,
          sourceState: 'GJ',
          destinationState: 'GJ',
        });

        expect(result.cgstRate).toBe(2.5);
        expect(result.cgstAmount).toBe(25);
        expect(result.sgstRate).toBe(2.5);
        expect(result.sgstAmount).toBe(25);
        expect(result.totalGST).toBe(50);
      });

      it('should handle case-insensitive state codes', () => {
        const result = calculateGST({
          taxableAmount: 1000,
          gstRate: 18,
          sourceState: 'ka',
          destinationState: 'KA',
        });

        expect(result.gstType).toBe('CGST_SGST');
      });

      it('should include HSN code when provided', () => {
        const result = calculateGST({
          taxableAmount: 1000,
          gstRate: 18,
          sourceState: 'KA',
          destinationState: 'KA',
          hsnCode: '8471',
        });

        expect(result.hsnCode).toBe('8471');
      });

      it('should include SAC code when provided', () => {
        const result = calculateGST({
          taxableAmount: 1000,
          gstRate: 18,
          sourceState: 'KA',
          destinationState: 'KA',
          sacCode: '998311',
        });

        expect(result.sacCode).toBe('998311');
      });
    });

    describe('inter-state transactions (IGST)', () => {
      it('should calculate 18% IGST for different states', () => {
        const result = calculateGST({
          taxableAmount: 10000,
          gstRate: 18,
          sourceState: 'KA',
          destinationState: 'MH',
        });

        expect(result.gstType).toBe('IGST');
        expect(result.taxableAmount).toBe(10000);
        expect(result.igstRate).toBe(18);
        expect(result.igstAmount).toBe(1800);
        expect(result.totalGST).toBe(1800);
        expect(result.placeOfSupply).toBe('MH');
        expect(result.cgstRate).toBeUndefined();
        expect(result.sgstRate).toBeUndefined();
      });

      it('should calculate 28% IGST correctly', () => {
        const result = calculateGST({
          taxableAmount: 50000,
          gstRate: 28,
          sourceState: 'DL',
          destinationState: 'TN',
        });

        expect(result.gstType).toBe('IGST');
        expect(result.igstRate).toBe(28);
        expect(result.igstAmount).toBe(14000);
        expect(result.totalGST).toBe(14000);
      });

      it('should calculate 5% IGST correctly', () => {
        const result = calculateGST({
          taxableAmount: 2000,
          gstRate: 5,
          sourceState: 'WB',
          destinationState: 'OR',
        });

        expect(result.gstType).toBe('IGST');
        expect(result.igstRate).toBe(5);
        expect(result.igstAmount).toBe(100);
        expect(result.totalGST).toBe(100);
      });
    });

    describe('zero GST rate', () => {
      it('should handle 0% GST for exempt items', () => {
        const result = calculateGST({
          taxableAmount: 10000,
          gstRate: 0,
          sourceState: 'KA',
          destinationState: 'KA',
        });

        expect(result.totalGST).toBe(0);
      });
    });

    describe('decimal precision', () => {
      it('should round GST amounts to 2 decimal places', () => {
        const result = calculateGST({
          taxableAmount: 999,
          gstRate: 18,
          sourceState: 'KA',
          destinationState: 'KA',
        });

        // 999 * 9% = 89.91
        expect(result.cgstAmount).toBe(89.91);
        expect(result.sgstAmount).toBe(89.91);
        expect(result.totalGST).toBe(179.82);
      });

      it('should handle fractional GST rates', () => {
        const result = calculateGST({
          taxableAmount: 10000,
          gstRate: 0.25,
          sourceState: 'KA',
          destinationState: 'KA',
        });

        // 0.25% split = 0.125% each
        expect(result.cgstRate).toBe(0.125);
        expect(result.sgstRate).toBe(0.125);
        expect(result.totalGST).toBe(25);
      });
    });
  });

  describe('calculateReverseChargeGST', () => {
    it('should calculate same as regular GST', () => {
      const params = {
        taxableAmount: 10000,
        gstRate: 18,
        sourceState: 'KA',
        destinationState: 'MH',
      };

      const regular = calculateGST(params);
      const reverseCharge = calculateReverseChargeGST(params);

      expect(reverseCharge).toEqual(regular);
    });
  });

  describe('isValidGSTRate', () => {
    it('should return true for valid GST rates', () => {
      expect(isValidGSTRate(0)).toBe(true);
      expect(isValidGSTRate(0.25)).toBe(true);
      expect(isValidGSTRate(3)).toBe(true);
      expect(isValidGSTRate(5)).toBe(true);
      expect(isValidGSTRate(12)).toBe(true);
      expect(isValidGSTRate(18)).toBe(true);
      expect(isValidGSTRate(28)).toBe(true);
    });

    it('should return false for invalid GST rates', () => {
      expect(isValidGSTRate(1)).toBe(false);
      expect(isValidGSTRate(10)).toBe(false);
      expect(isValidGSTRate(15)).toBe(false);
      expect(isValidGSTRate(20)).toBe(false);
      expect(isValidGSTRate(-5)).toBe(false);
    });
  });

  describe('getGSTRateSuggestions', () => {
    it('should return all valid GST rates', () => {
      const rates = getGSTRateSuggestions();

      expect(rates).toContain(0);
      expect(rates).toContain(0.25);
      expect(rates).toContain(3);
      expect(rates).toContain(5);
      expect(rates).toContain(12);
      expect(rates).toContain(18);
      expect(rates).toContain(28);
      expect(rates).toHaveLength(7);
    });

    it('should return rates in ascending order', () => {
      const rates = getGSTRateSuggestions();
      const sorted = [...rates].sort((a, b) => a - b);
      expect(rates).toEqual(sorted);
    });
  });

  describe('getStateFromGSTIN', () => {
    it('should extract state code from valid GSTIN', () => {
      // Karnataka (29)
      expect(getStateFromGSTIN('29ABCDE1234F1Z5')).toBe('KA');
      // Maharashtra (27)
      expect(getStateFromGSTIN('27ABCDE1234F1Z5')).toBe('MH');
      // Tamil Nadu (33)
      expect(getStateFromGSTIN('33ABCDE1234F1Z5')).toBe('TN');
      // Gujarat (24)
      expect(getStateFromGSTIN('24ABCDE1234F1Z5')).toBe('GJ');
      // Delhi (07)
      expect(getStateFromGSTIN('07ABCDE1234F1Z5')).toBe('DL');
    });

    it('should return null for invalid GSTIN length', () => {
      expect(getStateFromGSTIN('')).toBeNull();
      expect(getStateFromGSTIN('29ABCDE')).toBeNull();
      expect(getStateFromGSTIN('29ABCDE1234F1Z51234')).toBeNull();
    });

    it('should return null for unknown state code', () => {
      expect(getStateFromGSTIN('99ABCDE1234F1Z5')).toBeNull();
    });
  });

  describe('isValidGSTIN', () => {
    it('should validate correct GSTIN format', () => {
      // Valid GSTIN patterns
      expect(isValidGSTIN('29AABCT1234F1Z5')).toBe(true);
      expect(isValidGSTIN('27AABCU9603R1ZM')).toBe(true);
      expect(isValidGSTIN('07AAGCM9603R1ZK')).toBe(true);
    });

    it('should reject invalid GSTIN formats', () => {
      // Wrong length
      expect(isValidGSTIN('')).toBe(false);
      expect(isValidGSTIN('29AABCT1234F1Z')).toBe(false);
      expect(isValidGSTIN('29AABCT1234F1Z55')).toBe(false);

      // Wrong pattern
      expect(isValidGSTIN('XXAABCT1234F1Z5')).toBe(false); // Letters instead of state code
      expect(isValidGSTIN('29aabct1234f1z5')).toBe(false); // Lowercase
      expect(isValidGSTIN('29AABCT1234F0Z5')).toBe(false); // 0 in entity number position
    });

    it('should reject GSTIN without Z in position 13', () => {
      expect(isValidGSTIN('29AABCT1234F1X5')).toBe(false);
    });
  });
});
