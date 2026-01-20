/**
 * Fiscal Year Service Tests
 *
 * Tests for fiscal year and accounting period operations
 */

// Mock Firebase before imports
jest.mock('@vapour/firebase', () => ({
  COLLECTIONS: {
    FISCAL_YEARS: 'fiscalYears',
    ACCOUNTING_PERIODS: 'accountingPeriods',
    PERIOD_LOCK_AUDIT: 'periodLockAudit',
    ACCOUNTS: 'accounts',
  },
}));

// Mock Firebase Firestore
const mockGetDoc = jest.fn();
const mockGetDocs = jest.fn();
const mockUpdateDoc = jest.fn().mockResolvedValue(undefined);
const mockAddDoc = jest.fn().mockResolvedValue({ id: 'new-audit-id' });

jest.mock('firebase/firestore', () => ({
  collection: jest.fn((_db, collectionName) => ({ path: collectionName })),
  doc: jest.fn((_db, _collection, id) => ({ id, path: `${_collection}/${id}` })),
  query: jest.fn((...args) => args),
  where: jest.fn((field, op, value) => ({ field, op, value })),
  getDoc: (...args: unknown[]) => mockGetDoc(...args),
  getDocs: (...args: unknown[]) => mockGetDocs(...args),
  updateDoc: (...args: unknown[]) => mockUpdateDoc(...args),
  addDoc: (...args: unknown[]) => mockAddDoc(...args),
  serverTimestamp: jest.fn(() => ({ _serverTimestamp: true })),
  Timestamp: {
    fromDate: jest.fn((date: Date) => ({ seconds: date.getTime() / 1000, toDate: () => date })),
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

// Mock type helpers
jest.mock('@/lib/firebase/typeHelpers', () => ({
  docToTyped: <T>(id: string, data: Record<string, unknown>): T => {
    const result: T = { id, ...data } as unknown as T;
    return result;
  },
}));

import {
  getCurrentFiscalYear,
  getFiscalYear,
  getAccountingPeriods,
  isPeriodOpen,
  validateTransactionDate,
  closePeriod,
  lockPeriod,
  reopenPeriod,
  calculateYearEndBalances,
  getPeriodLockAudit,
} from './fiscalYearService';
import type { Firestore } from 'firebase/firestore';

describe('fiscalYearService', () => {
  const mockDb = {} as unknown as Firestore;

  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('getCurrentFiscalYear', () => {
    it('returns current fiscal year when found', async () => {
      mockGetDocs.mockResolvedValue({
        empty: false,
        docs: [
          {
            id: 'fy-2025-26',
            data: () => ({
              name: 'FY 2025-26',
              isCurrent: true,
              status: 'OPEN',
            }),
          },
        ],
      });

      const result = await getCurrentFiscalYear(mockDb);

      expect(result).not.toBeNull();
      expect(result?.id).toBe('fy-2025-26');
      expect(result?.name).toBe('FY 2025-26');
      expect(result?.isCurrent).toBe(true);
    });

    it('returns null when no current fiscal year exists', async () => {
      mockGetDocs.mockResolvedValue({
        empty: true,
        docs: [],
      });

      const result = await getCurrentFiscalYear(mockDb);

      expect(result).toBeNull();
    });

    it('throws error when Firestore operation fails', async () => {
      mockGetDocs.mockRejectedValue(new Error('Firestore error'));

      await expect(getCurrentFiscalYear(mockDb)).rejects.toThrow(
        'Failed to get current fiscal year'
      );
    });
  });

  describe('getFiscalYear', () => {
    it('returns fiscal year when found', async () => {
      mockGetDoc.mockResolvedValue({
        exists: () => true,
        id: 'fy-2025-26',
        data: () => ({
          name: 'FY 2025-26',
          status: 'OPEN',
        }),
      });

      const result = await getFiscalYear(mockDb, 'fy-2025-26');

      expect(result).not.toBeNull();
      expect(result?.id).toBe('fy-2025-26');
    });

    it('returns null when fiscal year not found', async () => {
      mockGetDoc.mockResolvedValue({
        exists: () => false,
      });

      const result = await getFiscalYear(mockDb, 'non-existent');

      expect(result).toBeNull();
    });
  });

  describe('getAccountingPeriods', () => {
    it('returns periods sorted by period number', async () => {
      mockGetDocs.mockResolvedValue({
        docs: [
          { id: 'p3', data: () => ({ periodNumber: 3, name: 'Jun 2025' }) },
          { id: 'p1', data: () => ({ periodNumber: 1, name: 'Apr 2025' }) },
          { id: 'p2', data: () => ({ periodNumber: 2, name: 'May 2025' }) },
        ],
      });

      const result = await getAccountingPeriods(mockDb, 'fy-2025-26');

      expect(result).toHaveLength(3);
      expect(result[0]?.periodNumber).toBe(1);
      expect(result[1]?.periodNumber).toBe(2);
      expect(result[2]?.periodNumber).toBe(3);
    });

    it('returns empty array when no periods exist', async () => {
      mockGetDocs.mockResolvedValue({
        docs: [],
      });

      const result = await getAccountingPeriods(mockDb, 'fy-2025-26');

      expect(result).toHaveLength(0);
    });
  });

  describe('isPeriodOpen', () => {
    it('returns true when period is open', async () => {
      // First query for fiscal year
      mockGetDocs.mockResolvedValueOnce({
        empty: false,
        docs: [
          {
            id: 'fy-2025-26',
            data: () => ({
              name: 'FY 2025-26',
              status: 'OPEN',
            }),
          },
        ],
      });

      // Second query for accounting period
      mockGetDocs.mockResolvedValueOnce({
        empty: false,
        docs: [
          {
            id: 'period-1',
            data: () => ({
              name: 'Apr 2025',
              status: 'OPEN',
            }),
          },
        ],
      });

      const result = await isPeriodOpen(mockDb, new Date('2025-04-15'));

      expect(result).toBe(true);
    });

    it('returns false when fiscal year is closed', async () => {
      mockGetDocs.mockResolvedValueOnce({
        empty: false,
        docs: [
          {
            id: 'fy-2024-25',
            data: () => ({
              name: 'FY 2024-25',
              status: 'CLOSED',
            }),
          },
        ],
      });

      const result = await isPeriodOpen(mockDb, new Date('2024-04-15'));

      expect(result).toBe(false);
    });

    it('returns false when fiscal year is locked', async () => {
      mockGetDocs.mockResolvedValueOnce({
        empty: false,
        docs: [
          {
            id: 'fy-2024-25',
            data: () => ({
              name: 'FY 2024-25',
              status: 'LOCKED',
            }),
          },
        ],
      });

      const result = await isPeriodOpen(mockDb, new Date('2024-04-15'));

      expect(result).toBe(false);
    });

    it('returns false when period is closed', async () => {
      mockGetDocs.mockResolvedValueOnce({
        empty: false,
        docs: [
          {
            id: 'fy-2025-26',
            data: () => ({
              name: 'FY 2025-26',
              status: 'OPEN',
            }),
          },
        ],
      });

      mockGetDocs.mockResolvedValueOnce({
        empty: false,
        docs: [
          {
            id: 'period-1',
            data: () => ({
              name: 'Apr 2025',
              status: 'CLOSED',
            }),
          },
        ],
      });

      const result = await isPeriodOpen(mockDb, new Date('2025-04-15'));

      expect(result).toBe(false);
    });

    it('returns false when no fiscal year found for date', async () => {
      mockGetDocs.mockResolvedValueOnce({
        empty: true,
        docs: [],
      });

      const result = await isPeriodOpen(mockDb, new Date('2020-01-01'));

      expect(result).toBe(false);
    });

    it('returns false when no period found for date', async () => {
      mockGetDocs.mockResolvedValueOnce({
        empty: false,
        docs: [
          {
            id: 'fy-2025-26',
            data: () => ({
              name: 'FY 2025-26',
              status: 'OPEN',
            }),
          },
        ],
      });

      mockGetDocs.mockResolvedValueOnce({
        empty: true,
        docs: [],
      });

      const result = await isPeriodOpen(mockDb, new Date('2025-04-15'));

      expect(result).toBe(false);
    });
  });

  describe('validateTransactionDate', () => {
    it('does not throw when period is open', async () => {
      mockGetDocs.mockResolvedValueOnce({
        empty: false,
        docs: [{ id: 'fy', data: () => ({ status: 'OPEN' }) }],
      });
      mockGetDocs.mockResolvedValueOnce({
        empty: false,
        docs: [{ id: 'period', data: () => ({ status: 'OPEN' }) }],
      });

      await expect(validateTransactionDate(mockDb, new Date('2025-04-15'))).resolves.not.toThrow();
    });

    it('throws error when period is closed', async () => {
      mockGetDocs.mockResolvedValueOnce({
        empty: false,
        docs: [{ id: 'fy', data: () => ({ status: 'OPEN' }) }],
      });
      mockGetDocs.mockResolvedValueOnce({
        empty: false,
        docs: [{ id: 'period', data: () => ({ status: 'CLOSED' }) }],
      });

      await expect(validateTransactionDate(mockDb, new Date('2025-04-15'))).rejects.toThrow(
        'Cannot post transaction'
      );
    });
  });

  describe('closePeriod', () => {
    it('closes an open period', async () => {
      mockGetDoc.mockResolvedValue({
        exists: () => true,
        data: () => ({
          name: 'Apr 2025',
          status: 'OPEN',
          fiscalYearId: 'fy-2025-26',
        }),
      });

      await closePeriod(mockDb, 'period-1', 'user-123', 'Month-end closing');

      expect(mockUpdateDoc).toHaveBeenCalledTimes(1);
      expect(mockUpdateDoc.mock.calls[0][1]).toMatchObject({
        status: 'CLOSED',
        closedBy: 'user-123',
        closingNotes: 'Month-end closing',
      });

      expect(mockAddDoc).toHaveBeenCalledTimes(1);
      expect(mockAddDoc.mock.calls[0][1]).toMatchObject({
        periodId: 'period-1',
        action: 'CLOSE',
        previousStatus: 'OPEN',
        newStatus: 'CLOSED',
      });
    });

    it('throws error when period not found', async () => {
      mockGetDoc.mockResolvedValue({
        exists: () => false,
      });

      await expect(closePeriod(mockDb, 'non-existent', 'user-123')).rejects.toThrow(
        'Accounting period not found'
      );
    });

    it('throws error when period is not open', async () => {
      mockGetDoc.mockResolvedValue({
        exists: () => true,
        data: () => ({
          name: 'Apr 2025',
          status: 'CLOSED',
        }),
      });

      await expect(closePeriod(mockDb, 'period-1', 'user-123')).rejects.toThrow(
        'Period cannot be closed: current status is CLOSED'
      );
    });
  });

  describe('lockPeriod', () => {
    it('locks a closed period', async () => {
      mockGetDoc.mockResolvedValue({
        exists: () => true,
        data: () => ({
          name: 'Apr 2025',
          status: 'CLOSED',
          fiscalYearId: 'fy-2025-26',
        }),
      });

      await lockPeriod(mockDb, 'period-1', 'user-123', 'Audit completed');

      expect(mockUpdateDoc).toHaveBeenCalledTimes(1);
      expect(mockUpdateDoc.mock.calls[0][1]).toMatchObject({
        status: 'LOCKED',
        lockedBy: 'user-123',
        lockReason: 'Audit completed',
      });

      expect(mockAddDoc).toHaveBeenCalledTimes(1);
      expect(mockAddDoc.mock.calls[0][1]).toMatchObject({
        action: 'LOCK',
        previousStatus: 'CLOSED',
        newStatus: 'LOCKED',
      });
    });

    it('throws error when period is not closed', async () => {
      mockGetDoc.mockResolvedValue({
        exists: () => true,
        data: () => ({
          name: 'Apr 2025',
          status: 'OPEN',
        }),
      });

      await expect(lockPeriod(mockDb, 'period-1', 'user-123', 'Audit')).rejects.toThrow(
        'Only closed periods can be locked'
      );
    });
  });

  describe('reopenPeriod', () => {
    it('reopens a closed period', async () => {
      mockGetDoc.mockResolvedValue({
        exists: () => true,
        data: () => ({
          name: 'Apr 2025',
          status: 'CLOSED',
          fiscalYearId: 'fy-2025-26',
        }),
      });

      await reopenPeriod(mockDb, 'period-1', 'user-123', 'Need to post adjustment');

      expect(mockUpdateDoc).toHaveBeenCalledTimes(1);
      expect(mockUpdateDoc.mock.calls[0][1]).toMatchObject({
        status: 'OPEN',
      });

      expect(mockAddDoc).toHaveBeenCalledTimes(1);
      expect(mockAddDoc.mock.calls[0][1]).toMatchObject({
        action: 'UNLOCK',
        reason: 'Need to post adjustment',
        previousStatus: 'CLOSED',
        newStatus: 'OPEN',
      });
    });

    it('throws error when period is locked', async () => {
      mockGetDoc.mockResolvedValue({
        exists: () => true,
        data: () => ({
          name: 'Apr 2025',
          status: 'LOCKED',
        }),
      });

      await expect(reopenPeriod(mockDb, 'period-1', 'user-123', 'Need access')).rejects.toThrow(
        'Cannot reopen a locked period'
      );
    });

    it('throws error when period is not closed', async () => {
      mockGetDoc.mockResolvedValue({
        exists: () => true,
        data: () => ({
          name: 'Apr 2025',
          status: 'OPEN',
        }),
      });

      await expect(reopenPeriod(mockDb, 'period-1', 'user-123', 'Need access')).rejects.toThrow(
        'Only closed periods can be reopened'
      );
    });
  });

  describe('calculateYearEndBalances', () => {
    it('calculates revenue and expense balances correctly', async () => {
      mockGetDocs.mockResolvedValue({
        docs: [
          {
            id: 'acc-1',
            data: () => ({
              code: '4000',
              name: 'Sales Revenue',
              accountType: 'INCOME',
              currentBalance: 500000,
            }),
          },
          {
            id: 'acc-2',
            data: () => ({
              code: '4100',
              name: 'Service Revenue',
              accountType: 'INCOME',
              currentBalance: 200000,
            }),
          },
          {
            id: 'acc-3',
            data: () => ({
              code: '5000',
              name: 'Cost of Goods Sold',
              accountType: 'EXPENSE',
              currentBalance: 300000,
            }),
          },
          {
            id: 'acc-4',
            data: () => ({
              code: '6000',
              name: 'Salaries',
              accountType: 'EXPENSE',
              currentBalance: 150000,
            }),
          },
          {
            id: 'acc-5',
            data: () => ({
              code: '1000',
              name: 'Cash',
              accountType: 'ASSET',
              currentBalance: 100000,
            }),
          },
        ],
      });

      const result = await calculateYearEndBalances(mockDb, 'fy-2025-26');

      expect(result.revenueAccounts).toHaveLength(2);
      expect(result.expenseAccounts).toHaveLength(2);
      expect(result.totalRevenue).toBe(700000);
      expect(result.totalExpenses).toBe(450000);
      expect(result.netIncome).toBe(250000);
    });

    it('excludes accounts with zero balance', async () => {
      mockGetDocs.mockResolvedValue({
        docs: [
          {
            id: 'acc-1',
            data: () => ({
              code: '4000',
              name: 'Sales Revenue',
              accountType: 'INCOME',
              currentBalance: 0,
            }),
          },
          {
            id: 'acc-2',
            data: () => ({
              code: '5000',
              name: 'COGS',
              accountType: 'EXPENSE',
              currentBalance: 100000,
            }),
          },
        ],
      });

      const result = await calculateYearEndBalances(mockDb, 'fy-2025-26');

      expect(result.revenueAccounts).toHaveLength(0);
      expect(result.expenseAccounts).toHaveLength(1);
      expect(result.totalRevenue).toBe(0);
      expect(result.totalExpenses).toBe(100000);
      expect(result.netIncome).toBe(-100000);
    });
  });

  describe('getPeriodLockAudit', () => {
    it('returns audit entries for period', async () => {
      mockGetDocs.mockResolvedValue({
        docs: [
          {
            id: 'audit-1',
            data: () => ({
              periodId: 'period-1',
              action: 'CLOSE',
              previousStatus: 'OPEN',
              newStatus: 'CLOSED',
            }),
          },
          {
            id: 'audit-2',
            data: () => ({
              periodId: 'period-1',
              action: 'UNLOCK',
              previousStatus: 'CLOSED',
              newStatus: 'OPEN',
            }),
          },
        ],
      });

      const result = await getPeriodLockAudit(mockDb, 'period-1');

      expect(result).toHaveLength(2);
      expect(result[0]?.action).toBe('CLOSE');
      expect(result[1]?.action).toBe('UNLOCK');
    });
  });
});
