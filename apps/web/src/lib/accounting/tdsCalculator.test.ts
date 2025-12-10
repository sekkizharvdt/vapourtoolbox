/**
 * TDS Calculator Tests
 *
 * Tests for Indian Tax Deducted at Source calculations including:
 * - TDS rate calculations for various sections
 * - Threshold applicability
 * - PAN validation
 * - Net payable calculations
 */

import {
  calculateTDS,
  isTDSApplicable,
  getTDSSectionInfo,
  getAllTDSSections,
  getCommonTDSSections,
  isValidPAN,
  calculateNetPayable,
  TDS_SECTIONS,
  type TDSSection,
} from './tdsCalculator';

describe('TDS Calculator', () => {
  describe('calculateTDS', () => {
    it('should calculate TDS for contractor payments (194C)', () => {
      const result = calculateTDS({
        amount: 100000,
        section: '194C',
        panNumber: 'ABCDE1234F',
      });

      expect(result.section).toBe('194C');
      expect(result.tdsRate).toBe(1);
      expect(result.tdsAmount).toBe(1000); // 1% of 100000
    });

    it('should calculate TDS for professional fees (194J)', () => {
      const result = calculateTDS({
        amount: 50000,
        section: '194J',
        panNumber: 'XYZPQ5678R',
      });

      expect(result.section).toBe('194J');
      expect(result.tdsRate).toBe(10);
      expect(result.tdsAmount).toBe(5000); // 10% of 50000
    });

    it('should calculate TDS for rent (194I)', () => {
      const result = calculateTDS({
        amount: 300000,
        section: '194I',
        panNumber: 'ABCPQ1234R',
      });

      expect(result.section).toBe('194I');
      expect(result.tdsRate).toBe(10);
      expect(result.tdsAmount).toBe(30000); // 10% of 300000
    });

    it('should calculate TDS for commission (194H)', () => {
      const result = calculateTDS({
        amount: 20000,
        section: '194H',
        panNumber: 'MNOPQ1234R',
      });

      expect(result.tdsRate).toBe(5);
      expect(result.tdsAmount).toBe(1000); // 5% of 20000
    });

    it('should apply higher rate (20%) when PAN is not provided', () => {
      const result = calculateTDS({
        amount: 100000,
        section: '194C',
        // No PAN provided
      });

      expect(result.tdsRate).toBe(20);
      expect(result.tdsAmount).toBe(20000); // 20% of 100000
      expect(result.panNumber).toBeUndefined();
    });

    it('should handle senior citizen exemption for 194A', () => {
      const result = calculateTDS({
        amount: 50000,
        section: '194A',
        panNumber: 'ABCDE1234F',
        isSeniorCitizen: true,
      });

      expect(result.tdsRate).toBe(0);
      expect(result.tdsAmount).toBe(0);
    });

    it('should apply normal rate for non-senior citizen on 194A', () => {
      const result = calculateTDS({
        amount: 50000,
        section: '194A',
        panNumber: 'ABCDE1234F',
        isSeniorCitizen: false,
      });

      expect(result.tdsRate).toBe(10);
      expect(result.tdsAmount).toBe(5000);
    });

    it('should throw error for invalid TDS section', () => {
      expect(() =>
        calculateTDS({
          amount: 100000,
          section: '999' as TDSSection,
          panNumber: 'ABCDE1234F',
        })
      ).toThrow('Invalid TDS section: 999');
    });

    it('should include PAN in result', () => {
      const result = calculateTDS({
        amount: 100000,
        section: '194C',
        panNumber: 'ABCDE1234F',
      });

      expect(result.panNumber).toBe('ABCDE1234F');
    });

    it('should round TDS amount to 2 decimal places', () => {
      const result = calculateTDS({
        amount: 33333,
        section: '194C',
        panNumber: 'ABCDE1234F',
      });

      // 1% of 33333 = 333.33
      expect(result.tdsAmount).toBe(333.33);
    });

    it('should handle lottery winnings (194B) at 30%', () => {
      const result = calculateTDS({
        amount: 100000,
        section: '194B',
        panNumber: 'ABCDE1234F',
      });

      expect(result.tdsRate).toBe(30);
      expect(result.tdsAmount).toBe(30000);
    });

    it('should handle dividend (194) at 10%', () => {
      const result = calculateTDS({
        amount: 10000,
        section: '194',
        panNumber: 'ABCDE1234F',
      });

      expect(result.tdsRate).toBe(10);
      expect(result.tdsAmount).toBe(1000);
    });
  });

  describe('isTDSApplicable', () => {
    it('should return true when amount exceeds threshold for 194C', () => {
      // 194C threshold is 30000
      expect(isTDSApplicable('194C', 35000)).toBe(true);
      expect(isTDSApplicable('194C', 30000)).toBe(true);
    });

    it('should return false when amount is below threshold', () => {
      // 194C threshold is 30000
      expect(isTDSApplicable('194C', 25000)).toBe(false);
      expect(isTDSApplicable('194C', 29999)).toBe(false);
    });

    it('should return true for 194J when amount >= 30000', () => {
      expect(isTDSApplicable('194J', 30000)).toBe(true);
      expect(isTDSApplicable('194J', 100000)).toBe(true);
    });

    it('should return true for 194I (rent) when amount >= 240000', () => {
      expect(isTDSApplicable('194I', 240000)).toBe(true);
      expect(isTDSApplicable('194I', 200000)).toBe(false);
    });

    it('should return true for 194H (commission) when amount >= 15000', () => {
      expect(isTDSApplicable('194H', 15000)).toBe(true);
      expect(isTDSApplicable('194H', 14999)).toBe(false);
    });

    it('should handle zero threshold sections', () => {
      // 194K has 0 threshold
      expect(isTDSApplicable('194K', 100)).toBe(true);
      expect(isTDSApplicable('194K', 0)).toBe(true);
    });

    it('should return false for invalid section', () => {
      expect(isTDSApplicable('INVALID' as TDSSection, 100000)).toBe(false);
    });

    it('should handle high-value thresholds', () => {
      // 194IA (immovable property) threshold is 5000000 (50 lakhs)
      expect(isTDSApplicable('194IA', 5000000)).toBe(true);
      expect(isTDSApplicable('194IA', 4999999)).toBe(false);
    });
  });

  describe('getTDSSectionInfo', () => {
    it('should return section information', () => {
      const info = getTDSSectionInfo('194C');

      expect(info).toEqual({
        description: 'Payment to contractors',
        rate: 1,
        threshold: 30000,
      });
    });

    it('should return info for professional services section', () => {
      const info = getTDSSectionInfo('194J');

      expect(info.description).toBe('Professional/technical services');
      expect(info.rate).toBe(10);
      expect(info.threshold).toBe(30000);
    });

    it('should return info for rent section', () => {
      const info = getTDSSectionInfo('194I');

      expect(info.description).toBe('Rent');
      expect(info.rate).toBe(10);
      expect(info.threshold).toBe(240000);
    });
  });

  describe('getAllTDSSections', () => {
    it('should return all TDS sections as array', () => {
      const sections = getAllTDSSections();

      expect(Array.isArray(sections)).toBe(true);
      expect(sections.length).toBe(Object.keys(TDS_SECTIONS).length);
    });

    it('should include section, description, rate, and threshold', () => {
      const sections = getAllTDSSections();
      const section194C = sections.find((s) => s.section === '194C');

      expect(section194C).toBeDefined();
      expect(section194C?.description).toBe('Payment to contractors');
      expect(section194C?.rate).toBe(1);
      expect(section194C?.threshold).toBe(30000);
    });

    it('should include all common sections', () => {
      const sections = getAllTDSSections();
      const sectionIds = sections.map((s) => s.section);

      expect(sectionIds).toContain('194C');
      expect(sectionIds).toContain('194J');
      expect(sectionIds).toContain('194I');
      expect(sectionIds).toContain('194H');
      expect(sectionIds).toContain('194A');
    });
  });

  describe('getCommonTDSSections', () => {
    it('should return common TDS sections', () => {
      const sections = getCommonTDSSections();

      expect(sections).toContain('194C');
      expect(sections).toContain('194J');
      expect(sections).toContain('194I');
      expect(sections).toContain('194H');
      expect(sections).toContain('194A');
    });

    it('should return 5 common sections', () => {
      const sections = getCommonTDSSections();
      expect(sections.length).toBe(5);
    });
  });

  describe('isValidPAN', () => {
    it('should validate correct PAN format', () => {
      expect(isValidPAN('ABCDE1234F')).toBe(true);
      expect(isValidPAN('XYZPQ5678R')).toBe(true);
      expect(isValidPAN('AAAPL1234C')).toBe(true);
    });

    it('should reject lowercase PAN', () => {
      expect(isValidPAN('abcde1234f')).toBe(false);
      expect(isValidPAN('ABCDE1234f')).toBe(false);
    });

    it('should reject wrong length PAN', () => {
      expect(isValidPAN('ABCDE123')).toBe(false);
      expect(isValidPAN('ABCDE12345F')).toBe(false);
    });

    it('should reject wrong format PAN', () => {
      expect(isValidPAN('12345ABCDE')).toBe(false);
      expect(isValidPAN('ABCDE123FG')).toBe(false);
      expect(isValidPAN('1BCDE1234F')).toBe(false);
    });

    it('should reject empty string', () => {
      expect(isValidPAN('')).toBe(false);
    });

    it('should reject PAN with special characters', () => {
      expect(isValidPAN('ABCD-1234F')).toBe(false);
      expect(isValidPAN('ABCDE@234F')).toBe(false);
    });
  });

  describe('calculateNetPayable', () => {
    it('should calculate net amount after TDS deduction', () => {
      const result = calculateNetPayable(100000, 1000);
      expect(result).toBe(99000);
    });

    it('should handle zero TDS', () => {
      const result = calculateNetPayable(50000, 0);
      expect(result).toBe(50000);
    });

    it('should round to 2 decimal places', () => {
      const result = calculateNetPayable(33333.33, 333.33);
      expect(result).toBe(33000);
    });

    it('should handle decimal amounts', () => {
      const result = calculateNetPayable(10000.5, 100.05);
      expect(result).toBe(9900.45);
    });
  });

  describe('TDS_SECTIONS constant', () => {
    it('should have all expected sections', () => {
      const expectedSections = [
        '192',
        '192A',
        '193',
        '194',
        '194A',
        '194B',
        '194C',
        '194D',
        '194DA',
        '194EE',
        '194F',
        '194G',
        '194H',
        '194I',
        '194IA',
        '194IB',
        '194IC',
        '194J',
        '194K',
        '194LA',
        '194M',
        '194N',
        '194O',
        '194Q',
      ];

      expectedSections.forEach((section) => {
        expect(TDS_SECTIONS).toHaveProperty(section);
      });
    });

    it('should have valid rate values (0-30)', () => {
      Object.values(TDS_SECTIONS).forEach((info) => {
        expect(info.rate).toBeGreaterThanOrEqual(0);
        expect(info.rate).toBeLessThanOrEqual(30);
      });
    });

    it('should have non-negative thresholds', () => {
      Object.values(TDS_SECTIONS).forEach((info) => {
        expect(info.threshold).toBeGreaterThanOrEqual(0);
      });
    });

    it('should have descriptions for all sections', () => {
      Object.values(TDS_SECTIONS).forEach((info) => {
        expect(info.description).toBeDefined();
        expect(info.description.length).toBeGreaterThan(0);
      });
    });
  });

  describe('Real-world TDS scenarios', () => {
    it('should calculate TDS for monthly rent payment', () => {
      // Monthly rent: 50000, Annual: 600000 (above 240000 threshold)
      const result = calculateTDS({
        amount: 50000,
        section: '194I',
        panNumber: 'ABCDE1234F',
      });

      expect(result.tdsAmount).toBe(5000); // 10% of 50000
      expect(calculateNetPayable(50000, result.tdsAmount)).toBe(45000);
    });

    it('should calculate TDS for contractor invoice', () => {
      // Contractor invoice: 150000
      const result = calculateTDS({
        amount: 150000,
        section: '194C',
        panNumber: 'XYZPQ5678R',
      });

      expect(result.tdsAmount).toBe(1500); // 1% of 150000
      expect(calculateNetPayable(150000, result.tdsAmount)).toBe(148500);
    });

    it('should calculate TDS for professional consultant fee', () => {
      // Consultant fee: 75000
      const result = calculateTDS({
        amount: 75000,
        section: '194J',
        panNumber: 'MNOPQ1234R',
      });

      expect(result.tdsAmount).toBe(7500); // 10% of 75000
      expect(calculateNetPayable(75000, result.tdsAmount)).toBe(67500);
    });

    it('should handle vendor without PAN', () => {
      // Vendor without PAN - higher TDS rate
      const result = calculateTDS({
        amount: 100000,
        section: '194C',
        // No PAN
      });

      expect(result.tdsRate).toBe(20);
      expect(result.tdsAmount).toBe(20000);
      expect(calculateNetPayable(100000, result.tdsAmount)).toBe(80000);
    });
  });
});
