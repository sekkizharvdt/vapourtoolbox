/**
 * Balance Sheet Report Tests
 */

// Mock Firebase before imports
jest.mock('@vapour/firebase', () => ({
  COLLECTIONS: {
    ACCOUNTS: 'accounts',
  },
}));

jest.mock('@vapour/logger', () => ({
  createLogger: () => ({
    info: jest.fn(),
    error: jest.fn(),
    warn: jest.fn(),
    debug: jest.fn(),
  }),
}));

const mockGetDocs = jest.fn();
jest.mock('firebase/firestore', () => ({
  collection: jest.fn((_db, name) => ({ path: name })),
  getDocs: (...args: unknown[]) => mockGetDocs(...args),
}));

import { generateBalanceSheet, validateAccountingEquation } from './balanceSheet';
import type { BalanceSheetReport } from './balanceSheet';

// Helper to create mock Firestore doc
function mockDoc(id: string, data: Record<string, unknown>) {
  return { id, data: () => data };
}

// Helper to create mock Firestore snapshot
function mockSnapshot(docs: ReturnType<typeof mockDoc>[]) {
  return {
    forEach: (cb: (doc: ReturnType<typeof mockDoc>) => void) => docs.forEach(cb),
    docs,
    size: docs.length,
    empty: docs.length === 0,
  };
}

// eslint-disable-next-line @typescript-eslint/consistent-type-assertions
const mockDb = {} as never;

describe('Balance Sheet Report', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('generateBalanceSheet', () => {
    it('should generate a balanced report with assets, liabilities, and equity', async () => {
      const accounts = [
        // Current asset - Cash (code 1000)
        mockDoc('acc-1', { code: '1000', name: 'Cash', debit: 50000, credit: 10000 }),
        // Current asset - Receivables (code 1100)
        mockDoc('acc-2', { code: '1100', name: 'Accounts Receivable', debit: 20000, credit: 5000 }),
        // Current liability (code 2000)
        mockDoc('acc-4', { code: '2000', name: 'Accounts Payable', debit: 5000, credit: 25000 }),
        // Long-term liability (code 2500 - outside current range, no current keywords)
        mockDoc('acc-5', { code: '2500', name: 'Long Term Loan', debit: 0, credit: 10000 }),
        // Equity - Capital (code 3000)
        mockDoc('acc-6', { code: '3000', name: 'Share Capital', debit: 0, credit: 30000 }),
        // Equity - Retained (code 3100)
        mockDoc('acc-7', { code: '3100', name: 'Retained Earnings', debit: 0, credit: 10000 }),
        // Revenue (code 4000)
        mockDoc('acc-8', { code: '4000', name: 'Sales Revenue', debit: 5000, credit: 40000 }),
        // Expense (code 5000)
        mockDoc('acc-9', { code: '5000', name: 'Cost of Goods Sold', debit: 15000, credit: 0 }),
        // Expense (code 6000)
        mockDoc('acc-10', { code: '6000', name: 'Rent Expense', debit: 5000, credit: 0 }),
      ];

      mockGetDocs.mockResolvedValueOnce(mockSnapshot(accounts));

      const report = await generateBalanceSheet(mockDb, new Date('2024-03-31'));

      // All 1xxx codes are classified as current assets:
      // Cash (50000-10000=40000) + Receivables (20000-5000=15000) = 55000
      expect(report.assets.totalCurrentAssets).toBe(55000);
      expect(report.assets.totalAssets).toBe(55000);

      // Current liabilities: Payable (20000) + Loan (10000) = 30000
      // Code 2500 is in range 2000-2999, so it's classified as current
      expect(report.liabilities.totalCurrentLiabilities).toBe(30000);
      expect(report.liabilities.totalLiabilities).toBe(30000);

      // Equity: Capital (30000) + Retained (10000) + Current Year Profit
      // Current year profit = Revenue (40000-5000=35000) - Expenses (15000+5000=20000) = 15000
      expect(report.equity.capital).toBe(30000);
      expect(report.equity.retainedEarnings).toBe(10000);
      expect(report.equity.currentYearProfit).toBe(15000);

      expect(report.asOfDate).toEqual(new Date('2024-03-31'));
    });

    it('should handle empty accounts', async () => {
      mockGetDocs.mockResolvedValueOnce(mockSnapshot([]));

      const report = await generateBalanceSheet(mockDb, new Date('2024-03-31'));

      expect(report.assets.totalAssets).toBe(0);
      expect(report.liabilities.totalLiabilities).toBe(0);
      expect(report.equity.totalEquity).toBe(0);
      expect(report.balanced).toBe(true);
      expect(report.difference).toBe(0);
    });

    it('should skip accounts with zero balance', async () => {
      const accounts = [
        mockDoc('acc-1', { code: '1000', name: 'Cash', debit: 1000, credit: 1000 }),
        mockDoc('acc-2', { code: '2000', name: 'Payable', debit: 500, credit: 500 }),
      ];

      mockGetDocs.mockResolvedValueOnce(mockSnapshot(accounts));

      const report = await generateBalanceSheet(mockDb, new Date('2024-03-31'));

      expect(report.assets.currentAssets).toHaveLength(0);
      expect(report.liabilities.currentLiabilities).toHaveLength(0);
    });

    it('should handle missing data fields with defaults', async () => {
      const accounts = [
        mockDoc('acc-1', { code: '1000', name: 'Cash', debit: 5000 }),
        mockDoc('acc-2', { name: 'Unknown Account' }),
      ];

      mockGetDocs.mockResolvedValueOnce(mockSnapshot(accounts));

      const report = await generateBalanceSheet(mockDb, new Date('2024-03-31'));

      expect(report.assets.currentAssets).toHaveLength(1);
      expect(report.assets.currentAssets[0]!.balance).toBe(5000);
    });

    it('should classify all 1xxx codes as current assets', async () => {
      // All codes in range 1000-1999 are classified as current assets
      // regardless of name keywords like "building" or "vehicle"
      const accounts = [
        mockDoc('acc-1', { code: '1200', name: 'Inventory Stock', debit: 10000, credit: 0 }),
        mockDoc('acc-2', { code: '1300', name: 'Prepaid Insurance', debit: 5000, credit: 0 }),
        mockDoc('acc-3', { code: '1800', name: 'Building', debit: 50000, credit: 0 }),
        mockDoc('acc-4', { code: '1900', name: 'Vehicle', debit: 20000, credit: 0 }),
      ];

      mockGetDocs.mockResolvedValueOnce(mockSnapshot(accounts));

      const report = await generateBalanceSheet(mockDb, new Date('2024-03-31'));

      // All 1xxx accounts go to current assets since isCurrentAsset checks code range first
      expect(report.assets.currentAssets).toHaveLength(4);
      expect(report.assets.totalCurrentAssets).toBe(85000);
      expect(report.assets.fixedAssets).toHaveLength(0);
    });

    it('should classify liabilities by name keywords', async () => {
      const accounts = [
        mockDoc('acc-1', { code: '2100', name: 'GST Payable', debit: 0, credit: 5000 }),
        mockDoc('acc-2', { code: '2200', name: 'TDS Payable', debit: 0, credit: 3000 }),
        mockDoc('acc-3', { code: '2300', name: 'Accrued Expenses', debit: 0, credit: 2000 }),
      ];

      mockGetDocs.mockResolvedValueOnce(mockSnapshot(accounts));

      const report = await generateBalanceSheet(mockDb, new Date('2024-03-31'));

      // All 2xxx codes are current liabilities
      expect(report.liabilities.currentLiabilities).toHaveLength(3);
      expect(report.liabilities.totalCurrentLiabilities).toBe(10000);
    });

    it('should calculate current year profit from revenue and expenses', async () => {
      const accounts = [
        // Revenue accounts
        mockDoc('acc-1', { code: '4000', name: 'Sales', debit: 0, credit: 100000 }),
        mockDoc('acc-2', { code: '4100', name: 'Service Revenue', debit: 0, credit: 50000 }),
        // COGS (5xxx)
        mockDoc('acc-3', { code: '5000', name: 'COGS', debit: 40000, credit: 0 }),
        // Operating expenses (6xxx)
        mockDoc('acc-4', { code: '6000', name: 'Rent', debit: 10000, credit: 0 }),
        // Other expenses (7xxx)
        mockDoc('acc-5', { code: '7000', name: 'Interest', debit: 5000, credit: 0 }),
      ];

      mockGetDocs.mockResolvedValueOnce(mockSnapshot(accounts));

      const report = await generateBalanceSheet(mockDb, new Date('2024-03-31'));

      // Revenue: 100000 + 50000 = 150000
      // Expenses: 40000 + 10000 + 5000 = 55000
      // Profit: 150000 - 55000 = 95000
      expect(report.equity.currentYearProfit).toBe(95000);
    });

    it('should throw on Firestore error', async () => {
      mockGetDocs.mockRejectedValueOnce(new Error('Firestore error'));

      await expect(generateBalanceSheet(mockDb, new Date())).rejects.toThrow(
        'Failed to generate Balance Sheet'
      );
    });
  });

  describe('validateAccountingEquation', () => {
    it('should validate a balanced report', () => {
      const report: BalanceSheetReport = {
        asOfDate: new Date(),
        assets: {
          currentAssets: [],
          fixedAssets: [],
          otherAssets: [],
          totalCurrentAssets: 50000,
          totalFixedAssets: 30000,
          totalOtherAssets: 0,
          totalAssets: 80000,
        },
        liabilities: {
          currentLiabilities: [],
          longTermLiabilities: [],
          totalCurrentLiabilities: 20000,
          totalLongTermLiabilities: 10000,
          totalLiabilities: 30000,
        },
        equity: {
          capital: 30000,
          retainedEarnings: 10000,
          currentYearProfit: 10000,
          totalEquity: 50000,
        },
        balanced: true,
        difference: 0,
      };

      const result = validateAccountingEquation(report);

      expect(result.valid).toBe(true);
      expect(result.message).toContain('balanced');
    });

    it('should report assets exceeding liabilities + equity', () => {
      const report: BalanceSheetReport = {
        asOfDate: new Date(),
        assets: {
          currentAssets: [],
          fixedAssets: [],
          otherAssets: [],
          totalCurrentAssets: 0,
          totalFixedAssets: 0,
          totalOtherAssets: 0,
          totalAssets: 100000,
        },
        liabilities: {
          currentLiabilities: [],
          longTermLiabilities: [],
          totalCurrentLiabilities: 0,
          totalLongTermLiabilities: 0,
          totalLiabilities: 30000,
        },
        equity: {
          capital: 30000,
          retainedEarnings: 0,
          currentYearProfit: 0,
          totalEquity: 30000,
        },
        balanced: false,
        difference: 40000,
      };

      const result = validateAccountingEquation(report);

      expect(result.valid).toBe(false);
      expect(result.message).toContain('Assets exceed');
      expect(result.message).toContain('40000.00');
    });

    it('should report liabilities + equity exceeding assets', () => {
      const report: BalanceSheetReport = {
        asOfDate: new Date(),
        assets: {
          currentAssets: [],
          fixedAssets: [],
          otherAssets: [],
          totalCurrentAssets: 0,
          totalFixedAssets: 0,
          totalOtherAssets: 0,
          totalAssets: 50000,
        },
        liabilities: {
          currentLiabilities: [],
          longTermLiabilities: [],
          totalCurrentLiabilities: 0,
          totalLongTermLiabilities: 0,
          totalLiabilities: 40000,
        },
        equity: {
          capital: 30000,
          retainedEarnings: 0,
          currentYearProfit: 0,
          totalEquity: 30000,
        },
        balanced: false,
        difference: -20000,
      };

      const result = validateAccountingEquation(report);

      expect(result.valid).toBe(false);
      expect(result.message).toContain('Liabilities + Equity exceed Assets');
      expect(result.message).toContain('20000.00');
    });
  });
});
