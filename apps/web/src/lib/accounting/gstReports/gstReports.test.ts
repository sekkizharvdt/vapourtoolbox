/**
 * GST Reports Module Tests
 *
 * Tests for GST report utilities, generators, and exporters
 */

// Mock Firebase before imports
jest.mock('@vapour/firebase', () => ({
  COLLECTIONS: {
    TRANSACTIONS: 'transactions',
  },
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

import { createEmptyGSTSummary, calculateGSTFromLineItems } from './utils';
import { generateGSTR1, generateGSTR2, generateGSTR3B } from './generators';
import { exportGSTR1ToJSON, exportGSTR3BToJSON } from './exporters';
import type { GSTR1Data, GSTR3BData } from './types';

describe('GST Reports Module', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  // ============================================================================
  // UTILITY FUNCTIONS
  // ============================================================================
  describe('createEmptyGSTSummary', () => {
    it('should create an empty GST summary with all zeros', () => {
      const summary = createEmptyGSTSummary();

      expect(summary).toEqual({
        taxableValue: 0,
        cgst: 0,
        sgst: 0,
        igst: 0,
        cess: 0,
        total: 0,
        transactionCount: 0,
      });
    });

    it('should create independent instances', () => {
      const summary1 = createEmptyGSTSummary();
      const summary2 = createEmptyGSTSummary();

      summary1.cgst = 100;

      expect(summary2.cgst).toBe(0);
    });
  });

  describe('calculateGSTFromLineItems', () => {
    it('should return zeros when no gstDetails provided', () => {
      const result = calculateGSTFromLineItems(undefined);

      expect(result).toEqual({ cgst: 0, sgst: 0, igst: 0 });
    });

    it('should calculate CGST/SGST when gstType is CGST_SGST', () => {
      const result = calculateGSTFromLineItems({
        gstType: 'CGST_SGST',
        cgstAmount: 900,
        sgstAmount: 900,
      });

      expect(result).toEqual({ cgst: 900, sgst: 900, igst: 0 });
    });

    it('should calculate IGST when gstType is IGST', () => {
      const result = calculateGSTFromLineItems({
        gstType: 'IGST',
        igstAmount: 1800,
      });

      expect(result).toEqual({ cgst: 0, sgst: 0, igst: 1800 });
    });

    it('should handle missing amount fields with defaults', () => {
      const result = calculateGSTFromLineItems({
        gstType: 'CGST_SGST',
      });

      expect(result).toEqual({ cgst: 0, sgst: 0, igst: 0 });
    });
  });

  // ============================================================================
  // GENERATORS
  // ============================================================================
  describe('generateGSTR1', () => {
    // eslint-disable-next-line @typescript-eslint/consistent-type-assertions
    const mockDb = {} as never;
    const mockStart = {
      toDate: () => new Date('2024-01-01'),
      seconds: 0,
      nanoseconds: 0,
    };
    const mockEnd = {
      toDate: () => new Date('2024-01-31'),
      seconds: 0,
      nanoseconds: 0,
    };

    it('should return empty report when no invoices found', async () => {
      mockGetDocs.mockResolvedValueOnce({
        forEach: jest.fn(),
      });

      const result = await generateGSTR1(
        mockDb,
        mockStart as never,
        mockEnd as never,
        'GSTIN123',
        'Test Company'
      );

      expect(result.period.month).toBe(1);
      expect(result.period.year).toBe(2024);
      expect(result.gstin).toBe('GSTIN123');
      expect(result.legalName).toBe('Test Company');
      expect(result.b2b.invoices).toHaveLength(0);
      expect(result.b2c.invoices).toHaveLength(0);
      expect(result.total.transactionCount).toBe(0);
    });

    it('should categorize B2B invoices when customer has GSTIN', async () => {
      mockGetDocs.mockResolvedValueOnce({
        forEach: (callback: (doc: { id: string; data: () => unknown }) => void) => {
          callback({
            id: 'inv-1',
            data: () => ({
              transactionNumber: 'INV/2024/001',
              date: { toDate: () => new Date('2024-01-15') },
              customerGSTIN: '27AABCU9603R1ZM',
              entityName: 'B2B Customer',
              totalAmount: 11800,
              subtotal: 10000,
              gstDetails: {
                gstType: 'CGST_SGST',
                cgstAmount: 900,
                sgstAmount: 900,
              },
              lineItems: [],
            }),
          });
        },
      });

      const result = await generateGSTR1(mockDb, mockStart as never, mockEnd as never);

      expect(result.b2b.invoices).toHaveLength(1);
      expect(result.b2c.invoices).toHaveLength(0);
      expect(result.b2b.invoices[0]?.customerGSTIN).toBe('27AABCU9603R1ZM');
      expect(result.b2b.summary.cgst).toBe(900);
      expect(result.b2b.summary.sgst).toBe(900);
    });

    it('should categorize B2C invoices when customer has no GSTIN', async () => {
      mockGetDocs.mockResolvedValueOnce({
        forEach: (callback: (doc: { id: string; data: () => unknown }) => void) => {
          callback({
            id: 'inv-2',
            data: () => ({
              transactionNumber: 'INV/2024/002',
              date: { toDate: () => new Date('2024-01-20') },
              customerGSTIN: '',
              entityName: 'Retail Customer',
              totalAmount: 5900,
              subtotal: 5000,
              gstDetails: {
                gstType: 'CGST_SGST',
                cgstAmount: 450,
                sgstAmount: 450,
              },
              lineItems: [{ gstRate: 18 }],
            }),
          });
        },
      });

      const result = await generateGSTR1(mockDb, mockStart as never, mockEnd as never);

      expect(result.b2b.invoices).toHaveLength(0);
      expect(result.b2c.invoices).toHaveLength(1);
      expect(result.b2c.invoices[0]?.gstRate).toBe(18);
    });

    it('should aggregate HSN summary from line items', async () => {
      mockGetDocs.mockResolvedValueOnce({
        forEach: (callback: (doc: { id: string; data: () => unknown }) => void) => {
          callback({
            id: 'inv-3',
            data: () => ({
              transactionNumber: 'INV/2024/003',
              date: { toDate: () => new Date('2024-01-25') },
              customerGSTIN: '27AABCU9603R1ZM',
              entityName: 'Test Customer',
              totalAmount: 23600,
              subtotal: 20000,
              gstDetails: {
                gstType: 'CGST_SGST',
                cgstAmount: 1800,
                sgstAmount: 1800,
              },
              lineItems: [
                {
                  hsnCode: '84212100',
                  description: 'Water Filters',
                  amount: 10000,
                  quantity: 5,
                  gstRate: 18,
                },
                {
                  hsnCode: '84212100',
                  description: 'Water Filters',
                  amount: 10000,
                  quantity: 5,
                  gstRate: 18,
                },
              ],
            }),
          });
        },
      });

      const result = await generateGSTR1(mockDb, mockStart as never, mockEnd as never);

      expect(result.hsnSummary).toHaveLength(1);
      expect(result.hsnSummary[0]?.hsnCode).toBe('84212100');
      expect(result.hsnSummary[0]?.totalQuantity).toBe(10);
      expect(result.hsnSummary[0]?.totalValue).toBe(20000);
    });
  });

  describe('generateGSTR2', () => {
    // eslint-disable-next-line @typescript-eslint/consistent-type-assertions
    const mockDb = {} as never;
    const mockStart = {
      toDate: () => new Date('2024-01-01'),
      seconds: 0,
      nanoseconds: 0,
    };
    const mockEnd = {
      toDate: () => new Date('2024-01-31'),
      seconds: 0,
      nanoseconds: 0,
    };

    it('should return empty report when no bills found', async () => {
      mockGetDocs.mockResolvedValueOnce({
        forEach: jest.fn(),
      });

      const result = await generateGSTR2(mockDb, mockStart as never, mockEnd as never);

      expect(result.period.month).toBe(1);
      expect(result.period.year).toBe(2024);
      expect(result.purchases.bills).toHaveLength(0);
      expect(result.total.transactionCount).toBe(0);
    });

    it('should process vendor bills correctly', async () => {
      mockGetDocs.mockResolvedValueOnce({
        forEach: (callback: (doc: { id: string; data: () => unknown }) => void) => {
          callback({
            id: 'bill-1',
            data: () => ({
              transactionNumber: 'BILL/2024/001',
              date: { toDate: () => new Date('2024-01-10') },
              vendorGSTIN: '27AABCU9603R1ZM',
              entityName: 'Vendor ABC',
              totalAmount: 59000,
              subtotal: 50000,
              gstDetails: {
                gstType: 'CGST_SGST',
                cgstAmount: 4500,
                sgstAmount: 4500,
              },
            }),
          });
        },
      });

      const result = await generateGSTR2(mockDb, mockStart as never, mockEnd as never);

      expect(result.purchases.bills).toHaveLength(1);
      expect(result.purchases.bills[0]?.vendorGSTIN).toBe('27AABCU9603R1ZM');
      expect(result.purchases.summary.cgst).toBe(4500);
      expect(result.purchases.summary.sgst).toBe(4500);
      expect(result.total.taxableValue).toBe(50000);
    });
  });

  describe('generateGSTR3B', () => {
    // eslint-disable-next-line @typescript-eslint/consistent-type-assertions
    const mockDb = {} as never;
    const mockStart = {
      toDate: () => new Date('2024-01-01'),
      seconds: 0,
      nanoseconds: 0,
    };
    const mockEnd = {
      toDate: () => new Date('2024-01-31'),
      seconds: 0,
      nanoseconds: 0,
    };

    it('should combine GSTR1 and GSTR2 data', async () => {
      // Mock for GSTR1 (invoices)
      mockGetDocs.mockResolvedValueOnce({
        forEach: (callback: (doc: { id: string; data: () => unknown }) => void) => {
          callback({
            id: 'inv-1',
            data: () => ({
              transactionNumber: 'INV/2024/001',
              date: { toDate: () => new Date('2024-01-15') },
              customerGSTIN: '27AABCU9603R1ZM',
              entityName: 'Customer',
              totalAmount: 11800,
              subtotal: 10000,
              gstDetails: { gstType: 'CGST_SGST', cgstAmount: 900, sgstAmount: 900 },
              lineItems: [],
            }),
          });
        },
      });

      // Mock for GSTR2 (bills)
      mockGetDocs.mockResolvedValueOnce({
        forEach: (callback: (doc: { id: string; data: () => unknown }) => void) => {
          callback({
            id: 'bill-1',
            data: () => ({
              transactionNumber: 'BILL/2024/001',
              date: { toDate: () => new Date('2024-01-10') },
              vendorGSTIN: '27AABCU9603R1ZM',
              entityName: 'Vendor',
              totalAmount: 5900,
              subtotal: 5000,
              gstDetails: { gstType: 'CGST_SGST', cgstAmount: 450, sgstAmount: 450 },
            }),
          });
        },
      });

      const result = await generateGSTR3B(
        mockDb,
        mockStart as never,
        mockEnd as never,
        'GSTIN123',
        'Test Company'
      );

      expect(result.gstin).toBe('GSTIN123');
      expect(result.outwardSupplies.cgst).toBe(900);
      expect(result.inwardSupplies.cgst).toBe(450);
      expect(result.itcAvailable.cgst).toBe(450);
      expect(result.gstPayable.cgst).toBe(450); // 900 - 450
    });
  });

  // ============================================================================
  // EXPORTERS
  // ============================================================================
  describe('exportGSTR1ToJSON', () => {
    it('should export GSTR1 data to JSON format', () => {
      const data: GSTR1Data = {
        period: { month: 1, year: 2024 },
        gstin: '27AABCU9603R1ZM',
        legalName: 'Test Company',
        b2b: {
          invoices: [
            {
              id: 'inv-1',
              invoiceNumber: 'INV/2024/001',
              invoiceDate: new Date('2024-01-15'),
              customerName: 'Customer A',
              customerGSTIN: '27AABCU9603R1ZN',
              placeOfSupply: '27',
              reverseCharge: false,
              invoiceValue: 11800,
              taxableValue: 10000,
              cgst: 900,
              sgst: 900,
              igst: 0,
              cess: 0,
            },
          ],
          summary: {
            taxableValue: 10000,
            cgst: 900,
            sgst: 900,
            igst: 0,
            cess: 0,
            total: 1800,
            transactionCount: 1,
          },
        },
        b2c: {
          invoices: [],
          summary: {
            taxableValue: 0,
            cgst: 0,
            sgst: 0,
            igst: 0,
            cess: 0,
            total: 0,
            transactionCount: 0,
          },
        },
        hsnSummary: [],
        total: {
          taxableValue: 10000,
          cgst: 900,
          sgst: 900,
          igst: 0,
          cess: 0,
          total: 1800,
          transactionCount: 1,
        },
      };

      const jsonStr = exportGSTR1ToJSON(data);
      const json = JSON.parse(jsonStr);

      expect(json.gstin).toBe('27AABCU9603R1ZM');
      expect(json.fp).toBe('012024');
      expect(json.b2b).toHaveLength(1);
      expect(json.b2b[0].ctin).toBe('27AABCU9603R1ZN');
    });

    it('should separate B2CL invoices over 250000', () => {
      const data: GSTR1Data = {
        period: { month: 1, year: 2024 },
        gstin: '27AABCU9603R1ZM',
        legalName: 'Test Company',
        b2b: { invoices: [], summary: createEmptyGSTSummary() },
        b2c: {
          invoices: [
            {
              id: 'inv-1',
              invoiceNumber: 'INV/2024/001',
              invoiceDate: new Date('2024-01-15'),
              placeOfSupply: '27',
              invoiceValue: 300000,
              taxableValue: 254237.29,
              gstRate: 18,
              cgst: 22881.36,
              sgst: 22881.36,
              igst: 0,
              cess: 0,
            },
            {
              id: 'inv-2',
              invoiceNumber: 'INV/2024/002',
              invoiceDate: new Date('2024-01-20'),
              placeOfSupply: '27',
              invoiceValue: 5000,
              taxableValue: 4237.29,
              gstRate: 18,
              cgst: 381.36,
              sgst: 381.36,
              igst: 0,
              cess: 0,
            },
          ],
          summary: {
            taxableValue: 258474.58,
            cgst: 23262.72,
            sgst: 23262.72,
            igst: 0,
            cess: 0,
            total: 46525.44,
            transactionCount: 2,
          },
        },
        hsnSummary: [],
        total: {
          taxableValue: 258474.58,
          cgst: 23262.72,
          sgst: 23262.72,
          igst: 0,
          cess: 0,
          total: 46525.44,
          transactionCount: 2,
        },
      };

      const jsonStr = exportGSTR1ToJSON(data);
      const json = JSON.parse(jsonStr);

      // B2CL should only have invoices > 250000
      expect(json.b2cl).toHaveLength(1);
      expect(json.b2cl[0].inv[0].val).toBe(300000);
    });
  });

  describe('exportGSTR3BToJSON', () => {
    it('should export GSTR3B data to JSON format', () => {
      const data: GSTR3BData = {
        period: { month: 1, year: 2024 },
        gstin: '27AABCU9603R1ZM',
        legalName: 'Test Company',
        outwardSupplies: {
          taxableValue: 100000,
          cgst: 9000,
          sgst: 9000,
          igst: 0,
          cess: 0,
          total: 18000,
          transactionCount: 5,
        },
        inwardSupplies: {
          taxableValue: 50000,
          cgst: 4500,
          sgst: 4500,
          igst: 0,
          cess: 0,
          total: 9000,
          transactionCount: 3,
        },
        itcAvailable: { cgst: 4500, sgst: 4500, igst: 0, cess: 0, total: 9000 },
        itcReversed: { cgst: 0, sgst: 0, igst: 0, cess: 0, total: 0 },
        netITC: { cgst: 4500, sgst: 4500, igst: 0, cess: 0, total: 9000 },
        interestLatePayment: { cgst: 0, sgst: 0, igst: 0, cess: 0, total: 0 },
        gstPayable: { cgst: 4500, sgst: 4500, igst: 0, cess: 0, total: 9000 },
      };

      const jsonStr = exportGSTR3BToJSON(data);
      const json = JSON.parse(jsonStr);

      expect(json.gstin).toBe('27AABCU9603R1ZM');
      expect(json.ret_period).toBe('012024');
      expect(json.sup_details.osup_det.txval).toBe(100000);
      expect(json.itc_elg.itc_net.camt).toBe(4500);
    });
  });
});
