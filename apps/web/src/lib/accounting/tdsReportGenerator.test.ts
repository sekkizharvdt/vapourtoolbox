/**
 * TDS Report Generator Tests
 *
 * Tests for TDS report utilities and generators
 */

// Mock Firebase before imports
jest.mock('@vapour/firebase', () => ({
  COLLECTIONS: {
    TRANSACTIONS: 'transactions',
  },
}));

// Mock logger
jest.mock('@vapour/logger', () => ({
  createLogger: () => ({
    error: jest.fn(),
    warn: jest.fn(),
    info: jest.fn(),
    debug: jest.fn(),
  }),
}));

// Mock Firestore
const mockGetDocs = jest.fn();
jest.mock('firebase/firestore', () => ({
  collection: jest.fn((_db, collectionName) => ({ path: collectionName })),
  query: jest.fn((...args) => args),
  where: jest.fn((field, op, value) => ({ field, op, value })),
  getDocs: (...args: unknown[]) => mockGetDocs(...args),
  Timestamp: {
    now: jest.fn(() => ({
      seconds: Date.now() / 1000,
      nanoseconds: 0,
      toDate: () => new Date(),
    })),
    fromDate: jest.fn((date: Date) => ({
      seconds: date.getTime() / 1000,
      nanoseconds: 0,
      toDate: () => date,
    })),
  },
}));

import {
  getQuarter,
  getFinancialYear,
  getAssessmentYear,
  getQuarterDateRange,
  generateForm16A,
  generateForm26Q,
  getDeducteesWithTDS,
  exportForm16AToJSON,
  exportForm26QToJSON,
  TDS_SECTIONS,
  TDS_RATES,
  type Form16AData,
  type Form26QData,
} from './tdsReportGenerator';

describe('TDS Report Generator', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  // ============================================================================
  // UTILITY FUNCTIONS
  // ============================================================================
  describe('getQuarter', () => {
    it('should return Q1 for April-June', () => {
      expect(getQuarter(new Date('2024-04-15'))).toBe(1);
      expect(getQuarter(new Date('2024-05-01'))).toBe(1);
      expect(getQuarter(new Date('2024-06-30'))).toBe(1);
    });

    it('should return Q2 for July-September', () => {
      expect(getQuarter(new Date('2024-07-01'))).toBe(2);
      expect(getQuarter(new Date('2024-08-15'))).toBe(2);
      expect(getQuarter(new Date('2024-09-30'))).toBe(2);
    });

    it('should return Q3 for October-December', () => {
      expect(getQuarter(new Date('2024-10-01'))).toBe(3);
      expect(getQuarter(new Date('2024-11-15'))).toBe(3);
      expect(getQuarter(new Date('2024-12-31'))).toBe(3);
    });

    it('should return Q4 for January-March', () => {
      expect(getQuarter(new Date('2025-01-01'))).toBe(4);
      expect(getQuarter(new Date('2025-02-15'))).toBe(4);
      expect(getQuarter(new Date('2025-03-31'))).toBe(4);
    });
  });

  describe('getFinancialYear', () => {
    it('should return correct FY for April-March period', () => {
      // FY starts from April
      expect(getFinancialYear(new Date('2024-04-01'))).toBe('2024-25');
      expect(getFinancialYear(new Date('2024-12-31'))).toBe('2024-25');
      expect(getFinancialYear(new Date('2025-03-31'))).toBe('2024-25');
    });

    it('should return previous FY for January-March', () => {
      expect(getFinancialYear(new Date('2024-01-15'))).toBe('2023-24');
      expect(getFinancialYear(new Date('2024-02-28'))).toBe('2023-24');
      expect(getFinancialYear(new Date('2024-03-31'))).toBe('2023-24');
    });
  });

  describe('getAssessmentYear', () => {
    it('should return next year as assessment year', () => {
      expect(getAssessmentYear('2024-25')).toBe('2025-26');
      expect(getAssessmentYear('2023-24')).toBe('2024-25');
    });

    it('should throw error for invalid format', () => {
      expect(() => getAssessmentYear('')).toThrow('Invalid financial year format');
    });
  });

  describe('getQuarterDateRange', () => {
    it('should return correct dates for Q1 (Apr-Jun)', () => {
      const { start, end } = getQuarterDateRange(1, '2024-25');

      expect(start.getMonth()).toBe(3); // April (0-indexed)
      expect(start.getDate()).toBe(1);
      expect(start.getFullYear()).toBe(2024);

      expect(end.getMonth()).toBe(5); // June
      expect(end.getDate()).toBe(30);
      expect(end.getFullYear()).toBe(2024);
    });

    it('should return correct dates for Q2 (Jul-Sep)', () => {
      const { start, end } = getQuarterDateRange(2, '2024-25');

      expect(start.getMonth()).toBe(6); // July
      expect(end.getMonth()).toBe(8); // September
    });

    it('should return correct dates for Q3 (Oct-Dec)', () => {
      const { start, end } = getQuarterDateRange(3, '2024-25');

      expect(start.getMonth()).toBe(9); // October
      expect(end.getMonth()).toBe(11); // December
    });

    it('should return correct dates for Q4 (Jan-Mar)', () => {
      const { start, end } = getQuarterDateRange(4, '2024-25');

      expect(start.getMonth()).toBe(0); // January
      expect(start.getFullYear()).toBe(2025);
      expect(end.getMonth()).toBe(2); // March
      expect(end.getFullYear()).toBe(2025);
    });
  });

  describe('TDS_SECTIONS constant', () => {
    it('should contain all standard TDS sections', () => {
      expect(TDS_SECTIONS['194A']).toBe('Interest other than on securities');
      expect(TDS_SECTIONS['194C']).toBe('Payment to contractors');
      expect(TDS_SECTIONS['194H']).toBe('Commission or brokerage');
      expect(TDS_SECTIONS['194I']).toBe('Rent');
      expect(TDS_SECTIONS['194J']).toBe('Professional or technical services');
    });
  });

  describe('TDS_RATES constant', () => {
    it('should contain correct TDS rates', () => {
      expect(TDS_RATES['194A']).toBe(10.0);
      expect(TDS_RATES['194C']).toBe(1.0);
      expect(TDS_RATES['194J']).toBe(10.0);
    });
  });

  // ============================================================================
  // REPORT GENERATORS
  // ============================================================================
  describe('generateForm16A', () => {
    // eslint-disable-next-line @typescript-eslint/consistent-type-assertions
    const mockDb = {} as never;
    const mockDeductorDetails = {
      name: 'Test Company',
      tan: 'ABCD12345E',
      pan: 'AABCT1234A',
      address: '123 Test Street',
      city: 'Chennai',
      state: 'Tamil Nadu',
      pincode: '600001',
    };

    it('should throw error when no transactions found for deductee', async () => {
      mockGetDocs.mockResolvedValueOnce({
        docs: [],
      });

      await expect(
        generateForm16A(mockDb, 'vendor-123', 1, '2024-25', mockDeductorDetails)
      ).rejects.toThrow('No TDS transactions found for this deductee');
    });

    it('should generate Form 16A with correct summary', async () => {
      mockGetDocs.mockResolvedValueOnce({
        docs: [
          {
            id: 'bill-1',
            data: () => ({
              date: { toDate: () => new Date('2024-05-15') },
              tdsAmount: 1000,
              total: 10000,
              vendorId: 'vendor-123',
              vendorName: 'Test Vendor',
              vendorPAN: 'AAACT1234A',
              category: 'professional',
              tdsRate: 10,
            }),
          },
          {
            id: 'bill-2',
            data: () => ({
              date: { toDate: () => new Date('2024-06-20') },
              tdsAmount: 500,
              total: 5000,
              vendorId: 'vendor-123',
              vendorName: 'Test Vendor',
              vendorPAN: 'AAACT1234A',
              category: 'professional',
              tdsRate: 10,
            }),
          },
        ],
      });

      const result = await generateForm16A(mockDb, 'vendor-123', 1, '2024-25', mockDeductorDetails);

      expect(result.summary.totalPayment).toBe(15000);
      expect(result.summary.totalTDS).toBe(1500);
      expect(result.summary.transactionCount).toBe(2);
      expect(result.deductee.name).toBe('Test Vendor');
      expect(result.deductee.pan).toBe('AAACT1234A');
      expect(result.quarter).toBe(1);
      expect(result.financialYear).toBe('2024-25');
      expect(result.assessmentYear).toBe('2025-26');
    });

    it('should filter transactions by deductee ID', async () => {
      mockGetDocs.mockResolvedValueOnce({
        docs: [
          {
            id: 'bill-1',
            data: () => ({
              date: { toDate: () => new Date('2024-05-15') },
              tdsAmount: 1000,
              total: 10000,
              vendorId: 'vendor-123',
              vendorName: 'Vendor A',
              vendorPAN: 'AAACT1234A',
            }),
          },
          {
            id: 'bill-2',
            data: () => ({
              date: { toDate: () => new Date('2024-05-20') },
              tdsAmount: 2000,
              total: 20000,
              vendorId: 'vendor-456',
              vendorName: 'Vendor B',
              vendorPAN: 'BBACT5678B',
            }),
          },
        ],
      });

      const result = await generateForm16A(mockDb, 'vendor-123', 1, '2024-25', mockDeductorDetails);

      expect(result.summary.transactionCount).toBe(1);
      expect(result.summary.totalTDS).toBe(1000);
    });
  });

  describe('generateForm26Q', () => {
    // eslint-disable-next-line @typescript-eslint/consistent-type-assertions
    const mockDb = {} as never;
    const mockDeductorDetails = {
      name: 'Test Company',
      tan: 'ABCD12345E',
      pan: 'AABCT1234A',
      address: '123 Test Street',
    };

    it('should generate empty report when no transactions', async () => {
      mockGetDocs.mockResolvedValueOnce({ docs: [] });

      const result = await generateForm26Q(mockDb, 1, '2024-25', mockDeductorDetails);

      expect(result.summary.totalTransactions).toBe(0);
      expect(result.summary.totalTDS).toBe(0);
      expect(result.summary.totalDeductees).toBe(0);
    });

    it('should aggregate transactions by section', async () => {
      mockGetDocs.mockResolvedValueOnce({
        docs: [
          {
            id: 'bill-1',
            data: () => ({
              date: { toDate: () => new Date('2024-05-15') },
              tdsAmount: 1000,
              total: 10000,
              vendorId: 'vendor-1',
              vendorName: 'Vendor A',
              category: 'professional',
            }),
          },
          {
            id: 'bill-2',
            data: () => ({
              date: { toDate: () => new Date('2024-05-20') },
              tdsAmount: 2000,
              total: 20000,
              vendorId: 'vendor-2',
              vendorName: 'Vendor B',
              category: 'rent',
            }),
          },
          {
            id: 'bill-3',
            data: () => ({
              date: { toDate: () => new Date('2024-06-10') },
              tdsAmount: 500,
              total: 5000,
              vendorId: 'vendor-1',
              vendorName: 'Vendor A',
              category: 'professional',
            }),
          },
        ],
      });

      const result = await generateForm26Q(mockDb, 1, '2024-25', mockDeductorDetails);

      expect(result.summary.totalTransactions).toBe(3);
      expect(result.summary.totalTDS).toBe(3500);
      expect(result.summary.totalDeductees).toBe(2);
      expect(result.summary.bySectionSummary.length).toBeGreaterThan(0);
    });
  });

  describe('getDeducteesWithTDS', () => {
    // eslint-disable-next-line @typescript-eslint/consistent-type-assertions
    const mockDb = {} as never;

    it('should return empty array when no deductees', async () => {
      mockGetDocs.mockResolvedValueOnce({ docs: [] });

      const result = await getDeducteesWithTDS(mockDb, 1, '2024-25');

      expect(result).toEqual([]);
    });

    it('should aggregate TDS by deductee and sort by total', async () => {
      mockGetDocs.mockResolvedValueOnce({
        docs: [
          {
            id: 'bill-1',
            data: () => ({
              date: { toDate: () => new Date('2024-05-15') },
              tdsAmount: 1000,
              total: 10000,
              vendorId: 'vendor-1',
              vendorName: 'Vendor A',
              vendorPAN: 'AAACT1234A',
            }),
          },
          {
            id: 'bill-2',
            data: () => ({
              date: { toDate: () => new Date('2024-05-20') },
              tdsAmount: 5000,
              total: 50000,
              vendorId: 'vendor-2',
              vendorName: 'Vendor B',
              vendorPAN: 'BBACT5678B',
            }),
          },
          {
            id: 'bill-3',
            data: () => ({
              date: { toDate: () => new Date('2024-06-10') },
              tdsAmount: 2000,
              total: 20000,
              vendorId: 'vendor-1',
              vendorName: 'Vendor A',
              vendorPAN: 'AAACT1234A',
            }),
          },
        ],
      });

      const result = await getDeducteesWithTDS(mockDb, 1, '2024-25');

      expect(result).toHaveLength(2);
      // Should be sorted by totalTDS descending
      expect(result[0]?.id).toBe('vendor-2');
      expect(result[0]?.totalTDS).toBe(5000);
      expect(result[1]?.id).toBe('vendor-1');
      expect(result[1]?.totalTDS).toBe(3000); // 1000 + 2000
    });
  });

  // ============================================================================
  // EXPORTERS
  // ============================================================================
  describe('exportForm16AToJSON', () => {
    it('should export Form 16A to JSON string', () => {
      const data: Form16AData = {
        deductor: {
          name: 'Test Company',
          tan: 'ABCD12345E',
          pan: 'AABCT1234A',
          address: '123 Test St',
          city: 'Chennai',
          state: 'Tamil Nadu',
          pincode: '600001',
        },
        deductee: {
          name: 'Vendor A',
          pan: 'AAACT1234A',
          address: '456 Vendor St',
          city: 'Mumbai',
          state: 'Maharashtra',
          pincode: '400001',
        },
        quarter: 1,
        financialYear: '2024-25',
        assessmentYear: '2025-26',
        transactions: [],
        summary: {
          totalPayment: 10000,
          totalTDS: 1000,
          transactionCount: 1,
        },
        challanDetails: [],
        certificateNumber: 'CERT-001',
        generatedDate: new Date('2024-07-01'),
      };

      const jsonStr = exportForm16AToJSON(data);
      const parsed = JSON.parse(jsonStr);

      expect(parsed.deductor.tan).toBe('ABCD12345E');
      expect(parsed.summary.totalTDS).toBe(1000);
    });
  });

  describe('exportForm26QToJSON', () => {
    it('should export Form 26Q to JSON string', () => {
      const data: Form26QData = {
        deductor: {
          name: 'Test Company',
          tan: 'ABCD12345E',
          pan: 'AABCT1234A',
          address: '123 Test St',
        },
        quarter: 1,
        financialYear: '2024-25',
        assessmentYear: '2025-26',
        transactions: [],
        summary: {
          totalPayment: 100000,
          totalTDS: 10000,
          totalDeductees: 5,
          totalTransactions: 10,
          bySectionSummary: [],
        },
        challanSummary: [],
        generatedDate: new Date('2024-07-01'),
      };

      const jsonStr = exportForm26QToJSON(data);
      const parsed = JSON.parse(jsonStr);

      expect(parsed.deductor.tan).toBe('ABCD12345E');
      expect(parsed.summary.totalTDS).toBe(10000);
    });
  });
});
