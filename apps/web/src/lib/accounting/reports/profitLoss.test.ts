/**
 * Profit & Loss Report Tests
 */

// Mock Firebase before imports
jest.mock('@vapour/firebase', () => ({
  COLLECTIONS: {
    ACCOUNTS: 'accounts',
    TRANSACTIONS: 'transactions',
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
  query: jest.fn((...args) => args),
  where: jest.fn((field, op, value) => ({ field, op, value })),
  getDocs: (...args: unknown[]) => mockGetDocs(...args),
  Timestamp: {
    fromDate: jest.fn((date: Date) => ({
      seconds: date.getTime() / 1000,
      nanoseconds: 0,
      toDate: () => date,
    })),
  },
}));

import { generateProfitLossReport, generateComparativeProfitLossReport } from './profitLoss';

function mockDoc(id: string, data: Record<string, unknown>) {
  return { id, data: () => data };
}

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

describe('Profit & Loss Report', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('generateProfitLossReport', () => {
    it('should generate a P&L report with revenue and expenses', async () => {
      const accounts = [
        mockDoc('acc-sales', { code: '4000', name: 'Sales Revenue', accountType: 'REVENUE' }),
        mockDoc('acc-other', { code: '8500', name: 'Interest Income', accountType: 'INCOME' }),
        mockDoc('acc-cogs', { code: '5000', name: 'Cost of Goods Sold', accountType: 'EXPENSE' }),
        mockDoc('acc-rent', { code: '6000', name: 'Rent Expense', accountType: 'EXPENSE' }),
        mockDoc('acc-misc', {
          code: '8000',
          name: 'Miscellaneous Expense',
          accountType: 'EXPENSE',
        }),
      ];

      const transactions = [
        mockDoc('txn-1', {
          date: { toDate: () => new Date('2024-01-15') },
          entries: [
            { accountId: 'acc-sales', debit: 0, credit: 100000 },
            { accountId: 'acc-cogs', debit: 40000, credit: 0 },
            { accountId: 'acc-rent', debit: 10000, credit: 0 },
            { accountId: 'acc-other', debit: 0, credit: 5000 },
            { accountId: 'acc-misc', debit: 3000, credit: 0 },
          ],
        }),
      ];

      // First call: accounts, Second call: transactions
      mockGetDocs
        .mockResolvedValueOnce(mockSnapshot(accounts))
        .mockResolvedValueOnce(mockSnapshot(transactions));

      const report = await generateProfitLossReport(
        mockDb,
        new Date('2024-01-01'),
        new Date('2024-01-31')
      );

      // Revenue
      expect(report.revenue.sales).toBe(100000);
      expect(report.revenue.otherIncome).toBe(5000);
      expect(report.revenue.total).toBe(105000);
      expect(report.revenue.salesAccounts).toHaveLength(1);

      // Expenses
      expect(report.expenses.costOfGoodsSold).toBe(40000);
      expect(report.expenses.operatingExpenses).toBe(10000);
      expect(report.expenses.otherExpenses).toBe(3000);
      expect(report.expenses.total).toBe(53000);

      // Profits
      expect(report.grossProfit).toBe(60000); // sales - cogs = 100000 - 40000
      expect(report.operatingProfit).toBe(50000); // gross - operating = 60000 - 10000
      expect(report.netProfit).toBe(52000); // revenue - expenses = 105000 - 53000
      expect(report.profitMargin).toBeCloseTo(49.52, 1); // 52000/105000 * 100
    });

    it('should handle empty transactions', async () => {
      const accounts = [mockDoc('acc-1', { code: '4000', name: 'Sales', accountType: 'REVENUE' })];

      mockGetDocs
        .mockResolvedValueOnce(mockSnapshot(accounts))
        .mockResolvedValueOnce(mockSnapshot([]));

      const report = await generateProfitLossReport(
        mockDb,
        new Date('2024-01-01'),
        new Date('2024-01-31')
      );

      expect(report.revenue.total).toBe(0);
      expect(report.expenses.total).toBe(0);
      expect(report.netProfit).toBe(0);
      expect(report.profitMargin).toBe(0);
    });

    it('should skip entries without accountId', async () => {
      const accounts = [mockDoc('acc-1', { code: '4000', name: 'Sales', accountType: 'REVENUE' })];

      const transactions = [
        mockDoc('txn-1', {
          date: { toDate: () => new Date('2024-01-15') },
          entries: [
            { accountId: '', debit: 0, credit: 5000 },
            { debit: 0, credit: 3000 },
          ],
        }),
      ];

      mockGetDocs
        .mockResolvedValueOnce(mockSnapshot(accounts))
        .mockResolvedValueOnce(mockSnapshot(transactions));

      const report = await generateProfitLossReport(
        mockDb,
        new Date('2024-01-01'),
        new Date('2024-01-31')
      );

      expect(report.revenue.total).toBe(0);
    });

    it('should classify revenue by account code', async () => {
      const accounts = [
        mockDoc('acc-1', { code: '4000', name: 'Product Sales', accountType: 'REVENUE' }),
        mockDoc('acc-2', { code: '4100', name: 'Service Revenue', accountType: 'REVENUE' }),
        mockDoc('acc-3', { code: '8500', name: 'Interest Income', accountType: 'INCOME' }),
      ];

      const transactions = [
        mockDoc('txn-1', {
          entries: [
            { accountId: 'acc-1', debit: 0, credit: 50000 },
            { accountId: 'acc-2', debit: 0, credit: 30000 },
            { accountId: 'acc-3', debit: 0, credit: 2000 },
          ],
        }),
      ];

      mockGetDocs
        .mockResolvedValueOnce(mockSnapshot(accounts))
        .mockResolvedValueOnce(mockSnapshot(transactions));

      const report = await generateProfitLossReport(
        mockDb,
        new Date('2024-01-01'),
        new Date('2024-01-31')
      );

      // 4xxx codes go to sales
      expect(report.revenue.sales).toBe(80000);
      expect(report.revenue.salesAccounts).toHaveLength(2);

      // Non-4xxx income goes to otherIncome
      expect(report.revenue.otherIncome).toBe(2000);
      expect(report.revenue.otherIncomeAccounts).toHaveLength(1);
    });

    it('should classify expenses by account code', async () => {
      const accounts = [
        mockDoc('acc-1', { code: '5000', name: 'COGS', accountType: 'EXPENSE' }),
        mockDoc('acc-2', { code: '6000', name: 'Salary', accountType: 'EXPENSE' }),
        mockDoc('acc-3', { code: '7000', name: 'Depreciation', accountType: 'EXPENSE' }),
        mockDoc('acc-4', { code: '8000', name: 'Other Misc', accountType: 'EXPENSE' }),
      ];

      const transactions = [
        mockDoc('txn-1', {
          entries: [
            { accountId: 'acc-1', debit: 25000, credit: 0 },
            { accountId: 'acc-2', debit: 15000, credit: 0 },
            { accountId: 'acc-3', debit: 5000, credit: 0 },
            { accountId: 'acc-4', debit: 2000, credit: 0 },
          ],
        }),
      ];

      mockGetDocs
        .mockResolvedValueOnce(mockSnapshot(accounts))
        .mockResolvedValueOnce(mockSnapshot(transactions));

      const report = await generateProfitLossReport(
        mockDb,
        new Date('2024-01-01'),
        new Date('2024-01-31')
      );

      expect(report.expenses.costOfGoodsSold).toBe(25000); // 5xxx
      expect(report.expenses.operatingExpenses).toBe(20000); // 6xxx + 7xxx
      expect(report.expenses.otherExpenses).toBe(2000); // 8xxx
    });

    it('should sort account breakdowns by amount descending', async () => {
      const accounts = [
        mockDoc('acc-1', { code: '4000', name: 'Product A', accountType: 'REVENUE' }),
        mockDoc('acc-2', { code: '4100', name: 'Product B', accountType: 'REVENUE' }),
        mockDoc('acc-3', { code: '4200', name: 'Product C', accountType: 'REVENUE' }),
      ];

      const transactions = [
        mockDoc('txn-1', {
          entries: [
            { accountId: 'acc-1', debit: 0, credit: 10000 },
            { accountId: 'acc-2', debit: 0, credit: 50000 },
            { accountId: 'acc-3', debit: 0, credit: 30000 },
          ],
        }),
      ];

      mockGetDocs
        .mockResolvedValueOnce(mockSnapshot(accounts))
        .mockResolvedValueOnce(mockSnapshot(transactions));

      const report = await generateProfitLossReport(
        mockDb,
        new Date('2024-01-01'),
        new Date('2024-01-31')
      );

      expect(report.revenue.salesAccounts[0]!.amount).toBe(50000);
      expect(report.revenue.salesAccounts[1]!.amount).toBe(30000);
      expect(report.revenue.salesAccounts[2]!.amount).toBe(10000);
    });

    it('should set period dates correctly', async () => {
      mockGetDocs.mockResolvedValueOnce(mockSnapshot([])).mockResolvedValueOnce(mockSnapshot([]));

      const start = new Date('2024-01-01');
      const end = new Date('2024-03-31');
      const report = await generateProfitLossReport(mockDb, start, end);

      expect(report.period.startDate).toEqual(start);
      expect(report.period.endDate).toEqual(end);
    });

    it('should throw on Firestore error', async () => {
      mockGetDocs.mockRejectedValueOnce(new Error('Firestore error'));

      await expect(generateProfitLossReport(mockDb, new Date(), new Date())).rejects.toThrow(
        'Failed to generate Profit & Loss report'
      );
    });
  });

  describe('generateComparativeProfitLossReport', () => {
    it('should generate current and previous period reports with changes', async () => {
      const accounts = [
        mockDoc('acc-1', { code: '4000', name: 'Sales', accountType: 'REVENUE' }),
        mockDoc('acc-2', { code: '5000', name: 'COGS', accountType: 'EXPENSE' }),
      ];

      // Current period transactions
      const currentTransactions = [
        mockDoc('txn-1', {
          entries: [
            { accountId: 'acc-1', debit: 0, credit: 120000 },
            { accountId: 'acc-2', debit: 50000, credit: 0 },
          ],
        }),
      ];

      // Previous period transactions
      const previousTransactions = [
        mockDoc('txn-2', {
          entries: [
            { accountId: 'acc-1', debit: 0, credit: 100000 },
            { accountId: 'acc-2', debit: 40000, credit: 0 },
          ],
        }),
      ];

      // Promise.all interleaves: both functions start and hit their first await getDocs
      // Order: current accounts, previous accounts, current txns, previous txns
      mockGetDocs
        .mockResolvedValueOnce(mockSnapshot(accounts)) // current accounts (call 1)
        .mockResolvedValueOnce(mockSnapshot(accounts)) // previous accounts (call 2)
        .mockResolvedValueOnce(mockSnapshot(currentTransactions)) // current txns (call 3)
        .mockResolvedValueOnce(mockSnapshot(previousTransactions)); // previous txns (call 4)

      const result = await generateComparativeProfitLossReport(
        mockDb,
        new Date('2024-01-01'),
        new Date('2024-01-31')
      );

      expect(result.current.revenue.total).toBe(120000);
      expect(result.previous.revenue.total).toBe(100000);

      // Revenue change: +20000, +20%
      expect(result.changes.revenue.amount).toBe(20000);
      expect(result.changes.revenue.percentage).toBe(20);

      // Expense change: +10000, +25%
      expect(result.changes.expenses.amount).toBe(10000);
      expect(result.changes.expenses.percentage).toBe(25);

      // Net profit change: current (70000) - previous (60000) = +10000
      expect(result.changes.netProfit.amount).toBe(10000);
    });

    it('should handle zero previous period gracefully', async () => {
      const accounts = [mockDoc('acc-1', { code: '4000', name: 'Sales', accountType: 'REVENUE' })];

      const currentTransactions = [
        mockDoc('txn-1', {
          entries: [{ accountId: 'acc-1', debit: 0, credit: 50000 }],
        }),
      ];

      // Promise.all interleaving: accounts, accounts, current txns, previous txns
      mockGetDocs
        .mockResolvedValueOnce(mockSnapshot(accounts))
        .mockResolvedValueOnce(mockSnapshot(accounts))
        .mockResolvedValueOnce(mockSnapshot(currentTransactions))
        .mockResolvedValueOnce(mockSnapshot([]));

      const result = await generateComparativeProfitLossReport(
        mockDb,
        new Date('2024-01-01'),
        new Date('2024-01-31')
      );

      // Percentage should be 0 when previous is 0
      expect(result.changes.revenue.percentage).toBe(0);
      expect(result.changes.expenses.percentage).toBe(0);
    });
  });
});
