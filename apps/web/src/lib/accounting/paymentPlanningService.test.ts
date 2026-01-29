/**
 * Payment Planning Service Tests
 *
 * Tests for cash flow forecasting and manual cash flow item CRUD operations
 */

// Mock Firebase before imports
jest.mock('@vapour/firebase', () => ({
  COLLECTIONS: {
    MANUAL_CASH_FLOW_ITEMS: 'manualCashFlowItems',
    TRANSACTIONS: 'transactions',
  },
}));

// Mock Firebase Firestore
const mockAddDoc = jest.fn().mockResolvedValue({ id: 'new-item-id' });
const mockUpdateDoc = jest.fn().mockResolvedValue(undefined);
const mockDeleteDoc = jest.fn().mockResolvedValue(undefined);
const mockGetDocs = jest.fn();

jest.mock('firebase/firestore', () => ({
  collection: jest.fn((_db, collectionName) => ({ path: collectionName })),
  doc: jest.fn((_db, _collection, id) => ({ id, path: `manualCashFlowItems/${id}` })),
  addDoc: (...args: unknown[]) => mockAddDoc(...args),
  updateDoc: (...args: unknown[]) => mockUpdateDoc(...args),
  deleteDoc: (...args: unknown[]) => mockDeleteDoc(...args),
  getDocs: (...args: unknown[]) => mockGetDocs(...args),
  query: jest.fn((...args) => args),
  where: jest.fn((field, op, value) => ({ field, op, value })),
  orderBy: jest.fn((field, direction) => ({ field, direction })),
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

// Mock recurringTransactionService
jest.mock('./recurringTransactionService', () => ({
  getUpcomingOccurrences: jest.fn().mockResolvedValue([]),
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

import {
  createManualCashFlowItem,
  updateManualCashFlowItem,
  deleteManualCashFlowItem,
  getManualCashFlowItems,
  generateCashFlowForecast,
  getCashFlowSummary,
  getCategoryLabel,
  getCategoriesByDirection,
} from './paymentPlanningService';
import type { Firestore } from 'firebase/firestore';
import type { ForecastOptions } from '@vapour/types';

// Default forecast options for tests
const defaultForecastOptions: Omit<ForecastOptions, 'startDate' | 'endDate'> = {
  includeOverdue: false,
  includeInvoices: true,
  includeBills: true,
  includeRecurring: true,
  includeManual: true,
};

describe('paymentPlanningService', () => {
  const mockDb = {} as unknown as Firestore;

  beforeEach(() => {
    jest.clearAllMocks();
  });

  // ============================================
  // Helper Function Tests (Pure Functions)
  // ============================================

  describe('getCategoryLabel', () => {
    it('returns correct label for inflow categories', () => {
      expect(getCategoryLabel('PROJECT_RECEIPT')).toBe('Project Receipt');
      expect(getCategoryLabel('LOAN_RECEIPT')).toBe('Loan Received');
      expect(getCategoryLabel('INTEREST_INCOME')).toBe('Interest Income');
      expect(getCategoryLabel('OTHER_INCOME')).toBe('Other Income');
    });

    it('returns correct label for outflow categories', () => {
      expect(getCategoryLabel('SALARY_WAGES')).toBe('Salary & Wages');
      expect(getCategoryLabel('RENT_LEASE')).toBe('Rent / Lease');
      expect(getCategoryLabel('UTILITIES')).toBe('Utilities');
      expect(getCategoryLabel('LOAN_REPAYMENT')).toBe('Loan Repayment');
      expect(getCategoryLabel('TAX_PAYMENT')).toBe('Tax Payment');
      expect(getCategoryLabel('VENDOR_PAYMENT')).toBe('Vendor Payment');
      expect(getCategoryLabel('CAPITAL_EXPENSE')).toBe('Capital Expense');
      expect(getCategoryLabel('OTHER_EXPENSE')).toBe('Other Expense');
    });

    it('returns category itself for unknown category', () => {
      expect(getCategoryLabel('UNKNOWN_CATEGORY' as any)).toBe('UNKNOWN_CATEGORY');
    });
  });

  describe('getCategoriesByDirection', () => {
    it('returns inflow categories for INFLOW direction', () => {
      const categories = getCategoriesByDirection('INFLOW');
      expect(categories).toEqual([
        'PROJECT_RECEIPT',
        'LOAN_RECEIPT',
        'INTEREST_INCOME',
        'OTHER_INCOME',
      ]);
    });

    it('returns outflow categories for OUTFLOW direction', () => {
      const categories = getCategoriesByDirection('OUTFLOW');
      expect(categories).toEqual([
        'SALARY_WAGES',
        'RENT_LEASE',
        'UTILITIES',
        'LOAN_REPAYMENT',
        'TAX_PAYMENT',
        'VENDOR_PAYMENT',
        'CAPITAL_EXPENSE',
        'OTHER_EXPENSE',
      ]);
    });
  });

  // ============================================
  // Manual Cash Flow Item CRUD Tests
  // ============================================

  describe('createManualCashFlowItem', () => {
    it('creates a manual cash flow item with correct data', async () => {
      const itemData = {
        name: 'Monthly Rent',
        direction: 'OUTFLOW' as const,
        category: 'RENT_LEASE' as const,
        amount: 50000,
        currency: 'INR' as const,
        expectedDate: new Date('2024-02-01'),
        isRecurring: true,
        recurrenceFrequency: 'MONTHLY' as const,
        status: 'PLANNED' as const,
        createdBy: 'user-123',
      };

      const id = await createManualCashFlowItem(mockDb, itemData);

      expect(id).toBe('new-item-id');
      expect(mockAddDoc).toHaveBeenCalledTimes(1);
      expect(mockAddDoc).toHaveBeenCalledWith(
        expect.anything(),
        expect.objectContaining({
          name: 'Monthly Rent',
          direction: 'OUTFLOW',
          category: 'RENT_LEASE',
          amount: 50000,
          isRecurring: true,
        })
      );
    });

    it('handles expectedDate as Timestamp', async () => {
      const itemData = {
        name: 'Payment',
        direction: 'OUTFLOW' as const,
        category: 'OTHER_EXPENSE' as const,
        amount: 10000,
        currency: 'INR' as const,
        expectedDate: { toDate: () => new Date('2024-02-01') } as any,
        isRecurring: false,
        status: 'PLANNED' as const,
        createdBy: 'user-123',
      };

      await createManualCashFlowItem(mockDb, itemData);

      expect(mockAddDoc).toHaveBeenCalledTimes(1);
    });
  });

  describe('updateManualCashFlowItem', () => {
    it('updates a manual cash flow item', async () => {
      const updates = {
        amount: 60000,
        notes: 'Increased rent',
      };

      await updateManualCashFlowItem(mockDb, 'item-123', updates);

      expect(mockUpdateDoc).toHaveBeenCalledTimes(1);
      expect(mockUpdateDoc).toHaveBeenCalledWith(
        expect.anything(),
        expect.objectContaining({
          amount: 60000,
          notes: 'Increased rent',
        })
      );
    });

    it('converts expectedDate to Timestamp when updating', async () => {
      const updates = {
        expectedDate: new Date('2024-03-01'),
      };

      await updateManualCashFlowItem(mockDb, 'item-123', updates);

      expect(mockUpdateDoc).toHaveBeenCalledTimes(1);
    });
  });

  describe('deleteManualCashFlowItem', () => {
    it('deletes a manual cash flow item', async () => {
      await deleteManualCashFlowItem(mockDb, 'item-123');

      expect(mockDeleteDoc).toHaveBeenCalledTimes(1);
    });
  });

  describe('getManualCashFlowItems', () => {
    it('returns all items when no filters provided', async () => {
      mockGetDocs.mockResolvedValue({
        docs: [
          {
            id: 'item-1',
            data: () => ({
              name: 'Rent',
              direction: 'OUTFLOW',
              category: 'RENT_LEASE',
              amount: 50000,
              currency: 'INR',
              isRecurring: true,
              status: 'PLANNED',
              createdBy: 'user-123',
              expectedDate: { toDate: () => new Date('2024-02-01') },
              createdAt: { toDate: () => new Date() },
              updatedAt: { toDate: () => new Date() },
            }),
          },
          {
            id: 'item-2',
            data: () => ({
              name: 'Salary',
              direction: 'OUTFLOW',
              category: 'SALARY_WAGES',
              amount: 100000,
              currency: 'INR',
              isRecurring: true,
              status: 'PLANNED',
              createdBy: 'user-123',
              expectedDate: { toDate: () => new Date('2024-02-05') },
              createdAt: { toDate: () => new Date() },
              updatedAt: { toDate: () => new Date() },
            }),
          },
        ],
      });

      const items = await getManualCashFlowItems(mockDb);

      expect(items).toHaveLength(2);
      expect(items[0]?.name).toBe('Rent');
      expect(items[1]?.name).toBe('Salary');
    });

    it('filters by direction', async () => {
      mockGetDocs.mockResolvedValue({
        docs: [
          {
            id: 'item-1',
            data: () => ({
              name: 'Rent',
              direction: 'OUTFLOW',
              category: 'RENT_LEASE',
              amount: 50000,
              currency: 'INR',
              isRecurring: false,
              status: 'PLANNED',
              createdBy: 'user-123',
              expectedDate: { toDate: () => new Date('2024-02-01') },
            }),
          },
          {
            id: 'item-2',
            data: () => ({
              name: 'Client Payment',
              direction: 'INFLOW',
              category: 'PROJECT_RECEIPT',
              amount: 200000,
              currency: 'INR',
              isRecurring: false,
              status: 'PLANNED',
              createdBy: 'user-123',
              expectedDate: { toDate: () => new Date('2024-02-05') },
            }),
          },
        ],
      });

      const items = await getManualCashFlowItems(mockDb, { direction: 'INFLOW' });

      expect(items).toHaveLength(1);
      expect(items[0]?.name).toBe('Client Payment');
    });

    it('filters by status', async () => {
      mockGetDocs.mockResolvedValue({
        docs: [
          {
            id: 'item-1',
            data: () => ({
              name: 'Rent',
              direction: 'OUTFLOW',
              category: 'RENT_LEASE',
              amount: 50000,
              currency: 'INR',
              isRecurring: false,
              status: 'PLANNED',
              createdBy: 'user-123',
              expectedDate: { toDate: () => new Date('2024-02-01') },
            }),
          },
          {
            id: 'item-2',
            data: () => ({
              name: 'Old Payment',
              direction: 'OUTFLOW',
              category: 'OTHER_EXPENSE',
              amount: 10000,
              currency: 'INR',
              isRecurring: false,
              status: 'COMPLETED',
              createdBy: 'user-123',
              expectedDate: { toDate: () => new Date('2024-01-15') },
            }),
          },
        ],
      });

      const items = await getManualCashFlowItems(mockDb, { status: 'PLANNED' });

      expect(items).toHaveLength(1);
      expect(items[0]?.name).toBe('Rent');
    });

    it('filters by date range', async () => {
      const startDate = new Date('2024-02-01');
      const endDate = new Date('2024-02-28');

      mockGetDocs.mockResolvedValue({
        docs: [
          {
            id: 'item-1',
            data: () => ({
              name: 'January Item',
              direction: 'OUTFLOW',
              category: 'RENT_LEASE',
              amount: 50000,
              currency: 'INR',
              isRecurring: false,
              status: 'PLANNED',
              createdBy: 'user-123',
              expectedDate: { toDate: () => new Date('2024-01-15') },
            }),
          },
          {
            id: 'item-2',
            data: () => ({
              name: 'February Item',
              direction: 'OUTFLOW',
              category: 'OTHER_EXPENSE',
              amount: 10000,
              currency: 'INR',
              isRecurring: false,
              status: 'PLANNED',
              createdBy: 'user-123',
              expectedDate: { toDate: () => new Date('2024-02-15') },
            }),
          },
          {
            id: 'item-3',
            data: () => ({
              name: 'March Item',
              direction: 'OUTFLOW',
              category: 'UTILITIES',
              amount: 5000,
              currency: 'INR',
              isRecurring: false,
              status: 'PLANNED',
              createdBy: 'user-123',
              expectedDate: { toDate: () => new Date('2024-03-15') },
            }),
          },
        ],
      });

      const items = await getManualCashFlowItems(mockDb, { startDate, endDate });

      expect(items).toHaveLength(1);
      expect(items[0]?.name).toBe('February Item');
    });
  });

  // ============================================
  // Forecast Generation Tests
  // ============================================

  describe('generateCashFlowForecast', () => {
    beforeEach(() => {
      // Mock empty results for all data sources by default
      mockGetDocs.mockResolvedValue({ docs: [] });
    });

    it('generates empty forecast when no data exists', async () => {
      const startDate = new Date('2024-02-01');
      const endDate = new Date('2024-02-07');

      const forecast = await generateCashFlowForecast(mockDb, {
        ...defaultForecastOptions,
        startDate,
        endDate,
        openingBalance: 100000,
      });

      expect(forecast.openingCashBalance).toBe(100000);
      expect(forecast.totalProjectedReceipts).toBe(0);
      expect(forecast.totalProjectedPayments).toBe(0);
      expect(forecast.netForecastedCashFlow).toBe(0);
      expect(forecast.projectedClosingBalance).toBe(100000);
      expect(forecast.dailyForecasts).toHaveLength(7); // 7 days
    });

    it('includes outstanding invoices as inflows', async () => {
      const startDate = new Date('2024-02-01');
      const endDate = new Date('2024-02-07');

      // First call: invoices, second call: bills, third call: manual items
      mockGetDocs
        .mockResolvedValueOnce({
          docs: [
            {
              id: 'inv-1',
              data: () => ({
                type: 'CUSTOMER_INVOICE',
                transactionNumber: 'INV-001',
                entityName: 'Customer A',
                totalAmount: 50000,
                paidAmount: 0,
                dueDate: { toDate: () => new Date('2024-02-05') },
                currency: 'INR',
              }),
            },
          ],
        })
        .mockResolvedValueOnce({ docs: [] }) // bills
        .mockResolvedValueOnce({ docs: [] }); // manual items

      const forecast = await generateCashFlowForecast(mockDb, {
        ...defaultForecastOptions,
        startDate,
        endDate,
        openingBalance: 100000,
        includeInvoices: true,
        includeBills: false,
        includeRecurring: false,
        includeManual: false,
      });

      expect(forecast.totalProjectedReceipts).toBe(50000);
      expect(forecast.receiptsBySource.invoices).toBe(50000);
    });

    // Note: Tests for outstanding bills, net cash flow calculations,
    // daily forecasts, overdue detection, and cash flow summary require
    // a more sophisticated mock setup with proper isolation between tests.
    // These are better suited for integration tests with Firebase emulators.
  });
});
