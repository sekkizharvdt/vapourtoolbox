/**
 * Fiscal Year Service Tests
 *
 * Fiscal years are now derived from dates — these tests cover:
 * - Derived helpers (pure functions)
 * - Lazy period creation on close / lock
 * - Period validation on transaction dates
 */

// Mock Firebase before imports
jest.mock('@vapour/firebase', () => ({
  COLLECTIONS: {
    FISCAL_YEARS: 'fiscalYears',
    ACCOUNTING_PERIODS: 'accountingPeriods',
    PERIOD_LOCK_AUDIT: 'periodLockAudit',
    ACCOUNTS: 'accounts',
    TRANSACTIONS: 'transactions',
  },
}));

// Mock Firebase Firestore
const mockGetDocs = jest.fn();
const mockUpdateDoc = jest.fn().mockResolvedValue(undefined);
const mockAddDoc = jest.fn().mockResolvedValue({ id: 'new-doc-id' });

jest.mock('firebase/firestore', () => ({
  collection: jest.fn((_db, name) => ({ path: name })),
  doc: jest.fn((_db, _col, id) => ({ id, path: `${_col}/${id}` })),
  query: jest.fn((...args) => args),
  where: jest.fn((field, op, value) => ({ field, op, value })),
  orderBy: jest.fn((field, dir) => ({ field, dir })),
  limit: jest.fn((n) => ({ limit: n })),
  getDocs: (...args: unknown[]) => mockGetDocs(...args),
  updateDoc: (...args: unknown[]) => mockUpdateDoc(...args),
  addDoc: (...args: unknown[]) => mockAddDoc(...args),
  serverTimestamp: jest.fn(() => ({ _serverTimestamp: true })),
  Timestamp: {
    fromDate: jest.fn((date: Date) => ({ seconds: date.getTime() / 1000, toDate: () => date })),
    now: jest.fn(() => ({ toDate: () => new Date() })),
  },
}));

jest.mock('@vapour/logger', () => ({
  createLogger: () => ({ error: jest.fn(), warn: jest.fn(), info: jest.fn(), debug: jest.fn() }),
}));

import {
  computeFiscalYearForDate,
  getAvailableFiscalYears,
  getCurrentFiscalYear,
  getAccountingPeriods,
  closePeriod,
  lockPeriod,
  reopenPeriod,
  isPeriodOpen,
  validateTransactionDate,
} from './fiscalYearService';
import type { Firestore } from 'firebase/firestore';

const mockDb = {} as unknown as Firestore;

function snapWithDocs(
  docs: Array<{ id: string; data: () => Record<string, unknown>; ref?: unknown }>
) {
  const ensuredDocs = docs.map((d) => ({ ref: { id: d.id }, ...d }));
  return { empty: ensuredDocs.length === 0, size: ensuredDocs.length, docs: ensuredDocs };
}

describe('fiscalYearService (derived model)', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockGetDocs.mockReset();
    mockAddDoc.mockResolvedValue({ id: 'new-doc-id' });
  });

  describe('computeFiscalYearForDate', () => {
    it('April 2025 → FY 2025-26', () => {
      const fy = computeFiscalYearForDate(new Date(2025, 3, 1));
      expect(fy.id).toBe('FY-2025-26');
      expect(fy.name).toBe('FY 2025-26');
      expect(fy.fyStartYear).toBe(2025);
      expect(fy.startDate.getMonth()).toBe(3); // April
      expect(fy.endDate.getMonth()).toBe(2); // March
      expect(fy.endDate.getFullYear()).toBe(2026);
    });

    it('March 2026 → FY 2025-26 (same FY)', () => {
      const fy = computeFiscalYearForDate(new Date(2026, 2, 31));
      expect(fy.id).toBe('FY-2025-26');
    });

    it('April 2026 → FY 2026-27 (next FY)', () => {
      const fy = computeFiscalYearForDate(new Date(2026, 3, 1));
      expect(fy.id).toBe('FY-2026-27');
    });

    it('January 2025 → FY 2024-25 (pre-April dates belong to prior FY)', () => {
      const fy = computeFiscalYearForDate(new Date(2025, 0, 15));
      expect(fy.id).toBe('FY-2024-25');
    });
  });

  describe('getCurrentFiscalYear', () => {
    it('returns the FY containing today, marked current', () => {
      const fy = getCurrentFiscalYear();
      expect(fy.isCurrent).toBe(true);
      expect(fy.id).toMatch(/^FY-\d{4}-\d{2}$/);
    });
  });

  describe('getAvailableFiscalYears', () => {
    it('returns current + next when no transactions exist', async () => {
      mockGetDocs.mockResolvedValueOnce(snapWithDocs([])); // empty transactions query
      const years = await getAvailableFiscalYears(mockDb);
      expect(years.length).toBeGreaterThanOrEqual(2);
      expect(years.some((y) => y.isCurrent)).toBe(true);
    });

    it('extends back to the earliest transaction date', async () => {
      const earliest = new Date(2023, 5, 1); // Jun 2023 → FY 2023-24
      mockGetDocs.mockResolvedValueOnce(
        snapWithDocs([{ id: 't1', data: () => ({ date: { toDate: () => earliest } }) }])
      );
      const years = await getAvailableFiscalYears(mockDb);
      expect(years.some((y) => y.id === 'FY-2023-24')).toBe(true);
    });
  });

  describe('getAccountingPeriods', () => {
    it('returns 12 OPEN periods by default when no docs exist', async () => {
      mockGetDocs.mockResolvedValueOnce(snapWithDocs([]));
      const periods = await getAccountingPeriods(mockDb, 'FY-2025-26');
      expect(periods).toHaveLength(12);
      expect(periods[0]?.periodNumber).toBe(1);
      expect(periods[0]?.name).toContain('Apr');
      expect(periods.every((p) => p.status === 'OPEN')).toBe(true);
    });

    it('overlays persisted close/lock state on derived periods', async () => {
      mockGetDocs.mockResolvedValueOnce(
        snapWithDocs([
          {
            id: 'persisted-apr',
            data: () => ({
              fiscalYearId: 'FY-2025-26',
              periodNumber: 1,
              name: 'Apr 2025',
              periodType: 'MONTH',
              status: 'CLOSED',
              startDate: new Date(2025, 3, 1),
              endDate: new Date(2025, 3, 30),
              year: 2025,
              createdAt: new Date(),
              createdBy: 'u1',
              updatedAt: new Date(),
            }),
          },
        ])
      );
      const periods = await getAccountingPeriods(mockDb, 'FY-2025-26');
      expect(periods[0]?.status).toBe('CLOSED');
      expect(periods[0]?.id).toBe('persisted-apr');
      expect(periods[1]?.status).toBe('OPEN'); // rest still default
    });
  });

  describe('closePeriod', () => {
    it('creates a new period doc if one does not exist', async () => {
      mockGetDocs.mockResolvedValueOnce(snapWithDocs([])); // findPeriodDoc returns empty
      await closePeriod(mockDb, 'FY-2025-26', 1, 'user-1', 'tenant-1', 'End of month');
      expect(mockAddDoc).toHaveBeenCalledTimes(2); // period + audit log
      const periodCall = mockAddDoc.mock.calls[0]?.[1] as Record<string, unknown>;
      expect(periodCall.status).toBe('CLOSED');
      expect(periodCall.periodNumber).toBe(1);
    });

    it('updates an existing period doc with status OPEN', async () => {
      mockGetDocs.mockResolvedValueOnce(
        snapWithDocs([
          {
            id: 'p-apr',
            data: () => ({
              fiscalYearId: 'FY-2025-26',
              periodNumber: 1,
              status: 'OPEN',
              periodType: 'MONTH',
            }),
          },
        ])
      );
      await closePeriod(mockDb, 'FY-2025-26', 1, 'user-1', 'tenant-1');
      expect(mockUpdateDoc).toHaveBeenCalledTimes(1);
      expect(mockAddDoc).toHaveBeenCalledTimes(1); // audit log only
    });

    it('rejects closing an already-CLOSED period', async () => {
      mockGetDocs.mockResolvedValueOnce(
        snapWithDocs([
          {
            id: 'p-apr',
            data: () => ({
              fiscalYearId: 'FY-2025-26',
              periodNumber: 1,
              status: 'CLOSED',
              periodType: 'MONTH',
            }),
          },
        ])
      );
      await expect(closePeriod(mockDb, 'FY-2025-26', 1, 'user-1', 'tenant-1')).rejects.toThrow(
        /current status is CLOSED/
      );
    });
  });

  describe('lockPeriod', () => {
    it('requires the period to already be CLOSED', async () => {
      mockGetDocs.mockResolvedValueOnce(snapWithDocs([])); // no doc yet ⇒ still OPEN
      await expect(
        lockPeriod(mockDb, 'FY-2025-26', 1, 'user-1', 'tenant-1', 'reason')
      ).rejects.toThrow(/close the period first/);
    });

    it('locks a closed period', async () => {
      mockGetDocs.mockResolvedValueOnce(
        snapWithDocs([
          {
            id: 'p-apr',
            data: () => ({
              fiscalYearId: 'FY-2025-26',
              periodNumber: 1,
              status: 'CLOSED',
              periodType: 'MONTH',
            }),
          },
        ])
      );
      await lockPeriod(mockDb, 'FY-2025-26', 1, 'user-1', 'tenant-1', 'Year-end lock');
      expect(mockUpdateDoc).toHaveBeenCalled();
      const [, payload] = mockUpdateDoc.mock.calls[0] as unknown[];
      expect((payload as Record<string, unknown>).status).toBe('LOCKED');
    });
  });

  describe('reopenPeriod', () => {
    it('refuses to reopen a LOCKED period', async () => {
      mockGetDocs.mockResolvedValueOnce(
        snapWithDocs([
          {
            id: 'p-apr',
            data: () => ({
              fiscalYearId: 'FY-2025-26',
              periodNumber: 1,
              status: 'LOCKED',
              periodType: 'MONTH',
            }),
          },
        ])
      );
      await expect(
        reopenPeriod(mockDb, 'FY-2025-26', 1, 'user-1', 'tenant-1', 'oops')
      ).rejects.toThrow(/locked period/);
    });

    it('reopens a CLOSED period', async () => {
      mockGetDocs.mockResolvedValueOnce(
        snapWithDocs([
          {
            id: 'p-apr',
            data: () => ({
              fiscalYearId: 'FY-2025-26',
              periodNumber: 1,
              status: 'CLOSED',
              periodType: 'MONTH',
            }),
          },
        ])
      );
      await reopenPeriod(mockDb, 'FY-2025-26', 1, 'user-1', 'tenant-1', 'need correction');
      const [, payload] = mockUpdateDoc.mock.calls[0] as unknown[];
      expect((payload as Record<string, unknown>).status).toBe('OPEN');
    });
  });

  describe('isPeriodOpen', () => {
    it('returns true when no period doc exists (default OPEN)', async () => {
      mockGetDocs.mockResolvedValueOnce(snapWithDocs([]));
      expect(await isPeriodOpen(mockDb, new Date(2025, 5, 15))).toBe(true);
    });

    it('returns false when the period is CLOSED and no adjustment period covers the date', async () => {
      mockGetDocs
        .mockResolvedValueOnce(
          snapWithDocs([
            {
              id: 'p-jun',
              data: () => ({
                fiscalYearId: 'FY-2025-26',
                periodNumber: 3,
                status: 'CLOSED',
                periodType: 'MONTH',
              }),
            },
          ])
        )
        .mockResolvedValueOnce(snapWithDocs([])); // no adjustment periods

      expect(await isPeriodOpen(mockDb, new Date(2025, 5, 15))).toBe(false);
    });

    it('validateTransactionDate throws if period is closed', async () => {
      mockGetDocs
        .mockResolvedValueOnce(
          snapWithDocs([
            {
              id: 'p-jun',
              data: () => ({
                fiscalYearId: 'FY-2025-26',
                periodNumber: 3,
                status: 'CLOSED',
                periodType: 'MONTH',
              }),
            },
          ])
        )
        .mockResolvedValueOnce(snapWithDocs([]));

      await expect(validateTransactionDate(mockDb, new Date(2025, 5, 15))).rejects.toThrow(
        /accounting period.+is closed/
      );
    });
  });
});
