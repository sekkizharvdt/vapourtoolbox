/**
 * Year-End Closing Service Tests
 *
 * Tests for the year-end closing automation workflow
 */

import type { FiscalYear, AccountingPeriod, Account, YearEndClosingEntry } from '@vapour/types';

// Mock Firebase before imports
jest.mock('@vapour/firebase', () => ({
  COLLECTIONS: {
    FISCAL_YEARS: 'fiscalYears',
    ACCOUNTING_PERIODS: 'accountingPeriods',
    ACCOUNTS: 'accounts',
    TRANSACTIONS: 'transactions',
    YEAR_END_CLOSING_ENTRIES: 'yearEndClosingEntries',
  },
}));

// Mock Firebase Firestore
const mockGetDoc = jest.fn();
const mockGetDocs = jest.fn();
const mockRunTransaction = jest.fn();

jest.mock('firebase/firestore', () => ({
  doc: jest.fn((_db, _collection, id) => ({ id, path: `${_collection}/${id}` })),
  collection: jest.fn((_db, collectionName) => ({ path: collectionName })),
  query: jest.fn(),
  where: jest.fn(),
  getDoc: (...args: unknown[]) => mockGetDoc(...args),
  getDocs: (...args: unknown[]) => mockGetDocs(...args),
  addDoc: jest.fn().mockResolvedValue({ id: 'new-doc-id' }),
  updateDoc: jest.fn().mockResolvedValue(undefined),
  runTransaction: (...args: unknown[]) => mockRunTransaction(...args),
  Timestamp: {
    now: jest.fn(() => ({ seconds: Date.now() / 1000, nanoseconds: 0 })),
    fromDate: jest.fn((date: Date) => ({ seconds: date.getTime() / 1000, nanoseconds: 0 })),
  },
}));

// Mock transaction number generator
jest.mock('./transactionNumberGenerator', () => ({
  generateTransactionNumber: jest.fn().mockResolvedValue('JE-2024-0001'),
}));

// Mock audit logging
jest.mock('@/lib/audit', () => ({
  logAuditEvent: jest.fn().mockResolvedValue(undefined),
  createAuditContext: jest.fn().mockReturnValue({
    userId: 'user-1',
    tenantId: '',
    userName: 'Test User',
  }),
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

// Mock type helpers
jest.mock('@/lib/firebase/typeHelpers', () => ({
  docToTyped: <T>(id: string, data: unknown): T => {
    const dataObj = data as Record<string, unknown>;
    const result = { ...dataObj, id };
    return result as T;
  },
}));

import {
  checkYearEndClosingReadiness,
  previewYearEndClosing,
  executeYearEndClosing,
  reverseYearEndClosing,
  YearEndClosingError,
} from './yearEndClosingService';
import type { Firestore } from 'firebase/firestore';

describe('yearEndClosingService', () => {
  const mockDb = {} as unknown as Firestore;

  beforeEach(() => {
    jest.clearAllMocks();
  });

  // Helper to create mock fiscal year
  const createMockFiscalYear = (overrides?: Partial<FiscalYear>): FiscalYear => ({
    id: 'fy-2024-25',
    name: 'FY 2024-25',
    startDate: new Date('2024-04-01'),
    endDate: new Date('2025-03-31'),
    status: 'OPEN',
    isCurrent: true,
    isYearEndClosed: false,
    periods: ['period-1', 'period-2'],
    createdAt: new Date(),
    createdBy: 'user-1',
    updatedAt: new Date(),
    ...overrides,
  });

  // Helper to create mock accounting period
  const createMockPeriod = (overrides?: Partial<AccountingPeriod>): AccountingPeriod => ({
    id: 'period-1',
    fiscalYearId: 'fy-2024-25',
    name: 'Apr 2024',
    periodType: 'MONTH',
    startDate: new Date('2024-04-01'),
    endDate: new Date('2024-04-30'),
    status: 'CLOSED',
    periodNumber: 1,
    year: 2024,
    createdAt: new Date(),
    createdBy: 'user-1',
    updatedAt: new Date(),
    ...overrides,
  });

  // Helper to create mock account
  const createMockAccount = (overrides?: Partial<Account>): Account => ({
    id: 'acc-1',
    code: '4100',
    name: 'Sales Revenue',
    accountType: 'INCOME',
    accountCategory: 'OPERATING_REVENUE',
    level: 4,
    isGroup: false,
    isActive: true,
    isSystemAccount: false,
    openingBalance: 0,
    currentBalance: 100000,
    currency: 'INR',
    isGSTAccount: false,
    isTDSAccount: false,
    isBankAccount: false,
    createdAt: new Date(),
    createdBy: 'user-1',
    updatedAt: new Date(),
    ...overrides,
  });

  describe('checkYearEndClosingReadiness', () => {
    it('returns not ready when fiscal year is not found', async () => {
      mockGetDoc.mockResolvedValue({ exists: () => false });

      const result = await checkYearEndClosingReadiness(mockDb, 'non-existent');

      expect(result.isReady).toBe(false);
      expect(result.errors).toContain('Fiscal year not found');
    });

    it('returns not ready when fiscal year is already closed', async () => {
      mockGetDoc.mockResolvedValue({
        exists: () => true,
        id: 'fy-2024-25',
        data: () => createMockFiscalYear({ isYearEndClosed: true }),
      });

      mockGetDocs.mockResolvedValue({ docs: [] });

      const result = await checkYearEndClosingReadiness(mockDb, 'fy-2024-25');

      expect(result.isReady).toBe(false);
      expect(result.errors).toContain('Fiscal year has already been closed');
    });

    it('returns not ready when periods are still open', async () => {
      mockGetDoc.mockResolvedValue({
        exists: () => true,
        id: 'fy-2024-25',
        data: () => createMockFiscalYear(),
      });

      // First call for periods, second call for retained earnings
      mockGetDocs
        .mockResolvedValueOnce({
          docs: [
            { id: 'period-1', data: () => createMockPeriod({ status: 'OPEN', name: 'Apr 2024' }) },
            {
              id: 'period-2',
              data: () => createMockPeriod({ status: 'CLOSED', name: 'May 2024' }),
            },
          ],
        })
        .mockResolvedValueOnce({ docs: [], empty: true }) // code query
        .mockResolvedValueOnce({ docs: [], empty: true }) // category query
        .mockResolvedValueOnce({ docs: [] }); // equity query

      const result = await checkYearEndClosingReadiness(mockDb, 'fy-2024-25');

      expect(result.isReady).toBe(false);
      expect(result.openPeriods).toHaveLength(1);
      expect(result.errors.some((e) => e.includes('period(s) are still open'))).toBe(true);
    });

    it('returns not ready when retained earnings account is missing', async () => {
      mockGetDoc.mockResolvedValue({
        exists: () => true,
        id: 'fy-2024-25',
        data: () => createMockFiscalYear(),
      });

      mockGetDocs
        .mockResolvedValueOnce({
          docs: [{ id: 'period-1', data: () => createMockPeriod({ status: 'CLOSED' }) }],
        })
        .mockResolvedValueOnce({ docs: [], empty: true }) // code query
        .mockResolvedValueOnce({ docs: [], empty: true }) // category query
        .mockResolvedValueOnce({ docs: [] }); // equity query

      const result = await checkYearEndClosingReadiness(mockDb, 'fy-2024-25');

      expect(result.isReady).toBe(false);
      expect(result.errors.some((e) => e.includes('Retained Earnings account not found'))).toBe(
        true
      );
    });

    it('returns ready when all conditions are met', async () => {
      mockGetDoc.mockResolvedValue({
        exists: () => true,
        id: 'fy-2024-25',
        data: () => createMockFiscalYear(),
      });

      const retainedEarningsAccount = createMockAccount({
        id: 'acc-retained',
        code: '3100',
        name: 'Retained Earnings',
        accountType: 'EQUITY',
        accountCategory: 'RETAINED_EARNINGS',
      });

      mockGetDocs
        .mockResolvedValueOnce({
          docs: [
            { id: 'period-1', data: () => createMockPeriod({ status: 'LOCKED' }) },
            {
              id: 'period-2',
              data: () => createMockPeriod({ id: 'period-2', status: 'LOCKED', name: 'May 2024' }),
            },
          ],
        })
        .mockResolvedValueOnce({
          docs: [{ id: 'acc-retained', data: () => retainedEarningsAccount }],
          empty: false,
        });

      const result = await checkYearEndClosingReadiness(mockDb, 'fy-2024-25');

      expect(result.isReady).toBe(true);
      expect(result.errors).toHaveLength(0);
      expect(result.lockedPeriods).toHaveLength(2);
      expect(result.retainedEarningsAccount).not.toBeNull();
    });
  });

  describe('previewYearEndClosing', () => {
    it('throws error when fiscal year is not found', async () => {
      mockGetDoc.mockResolvedValue({ exists: () => false });

      await expect(previewYearEndClosing(mockDb, 'non-existent')).rejects.toThrow(
        YearEndClosingError
      );
    });

    it('throws error when retained earnings account is missing', async () => {
      mockGetDoc.mockResolvedValue({
        exists: () => true,
        id: 'fy-2024-25',
        data: () => createMockFiscalYear(),
      });

      mockGetDocs
        .mockResolvedValueOnce({ docs: [] }) // periods
        .mockResolvedValueOnce({ docs: [], empty: true }) // code query
        .mockResolvedValueOnce({ docs: [], empty: true }) // category query
        .mockResolvedValueOnce({ docs: [] }); // equity query

      await expect(previewYearEndClosing(mockDb, 'fy-2024-25')).rejects.toThrow(
        'Retained Earnings account not found'
      );
    });

    it('calculates preview correctly with revenue and expense accounts', async () => {
      const fiscalYear = createMockFiscalYear();
      const retainedEarningsAccount = createMockAccount({
        id: 'acc-retained',
        code: '3100',
        name: 'Retained Earnings',
        accountType: 'EQUITY',
        accountCategory: 'RETAINED_EARNINGS',
        currentBalance: 50000,
      });

      const revenueAccount = createMockAccount({
        id: 'acc-revenue',
        code: '4100',
        name: 'Sales Revenue',
        accountType: 'INCOME',
        currentBalance: 200000,
      });

      const expenseAccount = createMockAccount({
        id: 'acc-expense',
        code: '5100',
        name: 'Operating Expenses',
        accountType: 'EXPENSE',
        currentBalance: 150000,
      });

      mockGetDoc.mockResolvedValue({
        exists: () => true,
        id: 'fy-2024-25',
        data: () => fiscalYear,
      });

      mockGetDocs
        // Periods query (for readiness check)
        .mockResolvedValueOnce({
          docs: [{ id: 'period-1', data: () => createMockPeriod({ status: 'LOCKED' }) }],
        })
        // Retained earnings code query
        .mockResolvedValueOnce({
          docs: [{ id: 'acc-retained', data: () => retainedEarningsAccount }],
          empty: false,
        })
        // Accounts query (for getAccountsToClose)
        .mockResolvedValueOnce({
          docs: [
            { id: 'acc-revenue', data: () => revenueAccount },
            { id: 'acc-expense', data: () => expenseAccount },
            { id: 'acc-retained', data: () => retainedEarningsAccount },
          ],
        });

      const preview = await previewYearEndClosing(mockDb, 'fy-2024-25');

      expect(preview.totalRevenue).toBe(200000);
      expect(preview.totalExpenses).toBe(150000);
      expect(preview.netIncome).toBe(50000);
      expect(preview.revenueAccounts).toHaveLength(1);
      expect(preview.expenseAccounts).toHaveLength(1);
      expect(preview.closingEntries.length).toBeGreaterThan(0);

      // Verify closing entries balance
      const totalDebits = preview.closingEntries.reduce((sum, e) => sum + e.debit, 0);
      const totalCredits = preview.closingEntries.reduce((sum, e) => sum + e.credit, 0);
      expect(totalDebits).toBe(totalCredits);
    });
  });

  describe('executeYearEndClosing', () => {
    it('returns error when fiscal year is not ready', async () => {
      mockGetDoc.mockResolvedValue({
        exists: () => true,
        id: 'fy-2024-25',
        data: () => createMockFiscalYear({ isYearEndClosed: true }),
      });

      mockGetDocs.mockResolvedValue({ docs: [] });

      const result = await executeYearEndClosing(mockDb, {
        fiscalYearId: 'fy-2024-25',
        userId: 'user-1',
        userName: 'Test User',
      });

      expect(result.success).toBe(false);
      expect(result.error).toBe('Fiscal year is not ready for closing');
    });

    it('successfully executes year-end closing', async () => {
      const fiscalYear = createMockFiscalYear();
      const retainedEarningsAccount = createMockAccount({
        id: 'acc-retained',
        code: '3100',
        name: 'Retained Earnings',
        accountType: 'EQUITY',
        accountCategory: 'RETAINED_EARNINGS',
        currentBalance: 50000,
      });

      const revenueAccount = createMockAccount({
        id: 'acc-revenue',
        code: '4100',
        name: 'Sales Revenue',
        accountType: 'INCOME',
        currentBalance: 200000,
      });

      const expenseAccount = createMockAccount({
        id: 'acc-expense',
        code: '5100',
        name: 'Operating Expenses',
        accountType: 'EXPENSE',
        currentBalance: 150000,
      });

      mockGetDoc.mockResolvedValue({
        exists: () => true,
        id: 'fy-2024-25',
        data: () => fiscalYear,
      });

      mockGetDocs
        .mockResolvedValueOnce({
          docs: [{ id: 'period-1', data: () => createMockPeriod({ status: 'LOCKED' }) }],
        })
        .mockResolvedValueOnce({
          docs: [{ id: 'acc-retained', data: () => retainedEarningsAccount }],
          empty: false,
        })
        .mockResolvedValueOnce({
          docs: [
            { id: 'acc-revenue', data: () => revenueAccount },
            { id: 'acc-expense', data: () => expenseAccount },
            { id: 'acc-retained', data: () => retainedEarningsAccount },
          ],
        });

      // Mock transaction execution
      mockRunTransaction.mockImplementation(async (_db, callback) => {
        // Mock transaction object
        const mockTransaction = {
          set: jest.fn(),
          update: jest.fn(),
        };
        return callback(mockTransaction);
      });

      const result = await executeYearEndClosing(mockDb, {
        fiscalYearId: 'fy-2024-25',
        userId: 'user-1',
        userName: 'Test User',
        notes: 'Year-end closing test',
      });

      expect(result.success).toBe(true);
      expect(result.netIncome).toBe(50000);
      expect(mockRunTransaction).toHaveBeenCalled();
    });
  });

  describe('reverseYearEndClosing', () => {
    it('returns error when closing entry is not found', async () => {
      mockGetDoc.mockResolvedValue({ exists: () => false });

      const result = await reverseYearEndClosing(
        mockDb,
        'non-existent',
        'user-1',
        'Test User',
        'Correction needed'
      );

      expect(result.success).toBe(false);
      expect(result.error).toBe('Year-end closing entry not found');
    });

    it('returns error when closing entry is already reversed', async () => {
      const closingEntryData: YearEndClosingEntry = {
        id: 'closing-1',
        fiscalYearId: 'fy-2024-25',
        fiscalYearName: 'FY 2024-25',
        status: 'REVERSED',
        closingDate: new Date(),
        retainedEarningsAccountId: 'acc-retained',
        revenueAccounts: [],
        expenseAccounts: [],
        totalRevenue: 0,
        totalExpenses: 0,
        netIncome: 0,
        journalEntryId: 'je-1',
        journalEntryNumber: 'JE-001',
        preparedBy: 'user-1',
        createdAt: new Date(),
        createdBy: 'user-1',
        updatedAt: new Date(),
      };
      mockGetDoc.mockResolvedValue({
        exists: () => true,
        id: 'closing-1',
        data: () => closingEntryData,
      });

      const result = await reverseYearEndClosing(
        mockDb,
        'closing-1',
        'user-1',
        'Test User',
        'Correction needed'
      );

      expect(result.success).toBe(false);
      expect(result.error).toBe('Year-end closing entry has already been reversed');
    });

    it('successfully reverses year-end closing', async () => {
      const closingEntry: YearEndClosingEntry = {
        id: 'closing-1',
        fiscalYearId: 'fy-2024-25',
        fiscalYearName: 'FY 2024-25',
        closingDate: new Date(),
        retainedEarningsAccountId: 'acc-retained',
        revenueAccounts: [
          {
            accountId: 'acc-revenue',
            accountCode: '4100',
            accountName: 'Sales Revenue',
            accountType: 'INCOME',
            closingBalance: 200000,
          },
        ],
        expenseAccounts: [
          {
            accountId: 'acc-expense',
            accountCode: '5100',
            accountName: 'Operating Expenses',
            accountType: 'EXPENSE',
            closingBalance: 150000,
          },
        ],
        totalRevenue: 200000,
        totalExpenses: 150000,
        netIncome: 50000,
        journalEntryId: 'je-1',
        journalEntryNumber: 'JE-001',
        status: 'POSTED',
        preparedBy: 'user-1',
        createdAt: new Date(),
        createdBy: 'user-1',
        updatedAt: new Date(),
      };

      const originalJournal = {
        type: 'JOURNAL_ENTRY',
        transactionNumber: 'JE-001',
        entries: [
          { accountId: 'acc-revenue', debit: 200000, credit: 0 },
          { accountId: 'acc-expense', debit: 0, credit: 150000 },
          { accountId: 'acc-retained', debit: 0, credit: 50000 },
        ],
      };

      mockGetDoc
        .mockResolvedValueOnce({
          exists: () => true,
          id: 'closing-1',
          data: () => closingEntry,
        })
        .mockResolvedValueOnce({
          exists: () => true,
          id: 'je-1',
          data: () => originalJournal,
        });

      mockRunTransaction.mockImplementation(async (_db, callback) => {
        const mockTransaction = {
          set: jest.fn(),
          update: jest.fn(),
          get: jest.fn().mockResolvedValue({
            exists: () => true,
            data: () => ({ currentBalance: 0 }),
          }),
        };
        return callback(mockTransaction);
      });

      const result = await reverseYearEndClosing(
        mockDb,
        'closing-1',
        'user-1',
        'Test User',
        'Correction needed'
      );

      expect(result.success).toBe(true);
      expect(mockRunTransaction).toHaveBeenCalled();
    });
  });

  describe('closing entries generation', () => {
    it('generates balanced entries for profit scenario', async () => {
      const fiscalYear = createMockFiscalYear();
      const retainedEarningsAccount = createMockAccount({
        id: 'acc-retained',
        code: '3100',
        name: 'Retained Earnings',
        accountType: 'EQUITY',
        currentBalance: 0,
      });

      mockGetDoc.mockResolvedValue({
        exists: () => true,
        id: 'fy-2024-25',
        data: () => fiscalYear,
      });

      mockGetDocs
        .mockResolvedValueOnce({
          docs: [{ id: 'period-1', data: () => createMockPeriod({ status: 'LOCKED' }) }],
        })
        .mockResolvedValueOnce({
          docs: [{ id: 'acc-retained', data: () => retainedEarningsAccount }],
          empty: false,
        })
        .mockResolvedValueOnce({
          docs: [
            {
              id: 'acc-revenue',
              data: () =>
                createMockAccount({
                  id: 'acc-revenue',
                  accountType: 'INCOME',
                  currentBalance: 500000,
                }),
            },
            {
              id: 'acc-expense',
              data: () =>
                createMockAccount({
                  id: 'acc-expense',
                  accountType: 'EXPENSE',
                  currentBalance: 300000,
                }),
            },
          ],
        });

      const preview = await previewYearEndClosing(mockDb, 'fy-2024-25');

      // Profit scenario: revenue > expenses
      expect(preview.netIncome).toBe(200000);

      // Verify entries:
      // 1. Debit Revenue (to zero credit balance)
      // 2. Credit Expense (to zero debit balance)
      // 3. Credit Retained Earnings (profit)
      const revenueEntry = preview.closingEntries.find((e) => e.accountId === 'acc-revenue');
      const expenseEntry = preview.closingEntries.find((e) => e.accountId === 'acc-expense');
      const retainedEntry = preview.closingEntries.find((e) => e.accountId === 'acc-retained');

      expect(revenueEntry?.debit).toBe(500000);
      expect(revenueEntry?.credit).toBe(0);

      expect(expenseEntry?.debit).toBe(0);
      expect(expenseEntry?.credit).toBe(300000);

      expect(retainedEntry?.debit).toBe(0);
      expect(retainedEntry?.credit).toBe(200000); // Profit credited to retained earnings
    });

    it('generates balanced entries for loss scenario', async () => {
      const fiscalYear = createMockFiscalYear();
      const retainedEarningsAccount = createMockAccount({
        id: 'acc-retained',
        code: '3100',
        name: 'Retained Earnings',
        accountType: 'EQUITY',
        currentBalance: 100000,
      });

      mockGetDoc.mockResolvedValue({
        exists: () => true,
        id: 'fy-2024-25',
        data: () => fiscalYear,
      });

      mockGetDocs
        .mockResolvedValueOnce({
          docs: [{ id: 'period-1', data: () => createMockPeriod({ status: 'LOCKED' }) }],
        })
        .mockResolvedValueOnce({
          docs: [{ id: 'acc-retained', data: () => retainedEarningsAccount }],
          empty: false,
        })
        .mockResolvedValueOnce({
          docs: [
            {
              id: 'acc-revenue',
              data: () =>
                createMockAccount({
                  id: 'acc-revenue',
                  accountType: 'INCOME',
                  currentBalance: 200000,
                }),
            },
            {
              id: 'acc-expense',
              data: () =>
                createMockAccount({
                  id: 'acc-expense',
                  accountType: 'EXPENSE',
                  currentBalance: 350000,
                }),
            },
          ],
        });

      const preview = await previewYearEndClosing(mockDb, 'fy-2024-25');

      // Loss scenario: expenses > revenue
      expect(preview.netIncome).toBe(-150000);

      const retainedEntry = preview.closingEntries.find((e) => e.accountId === 'acc-retained');

      expect(retainedEntry?.debit).toBe(150000); // Loss debited from retained earnings
      expect(retainedEntry?.credit).toBe(0);
    });
  });
});
