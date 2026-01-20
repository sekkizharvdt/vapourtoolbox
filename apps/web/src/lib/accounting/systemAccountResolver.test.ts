/**
 * System Account Resolver Tests
 *
 * Tests for system account resolution and validation
 */

// Mock Firebase before imports
jest.mock('@vapour/firebase', () => ({
  COLLECTIONS: {
    ACCOUNTS: 'accounts',
  },
}));

// Mock Firebase Firestore
const mockGetDocs = jest.fn();

jest.mock('firebase/firestore', () => ({
  collection: jest.fn((_db, collectionName) => ({ path: collectionName })),
  query: jest.fn((...args) => args),
  where: jest.fn((field, op, value) => ({ field, op, value })),
  getDocs: (...args: unknown[]) => mockGetDocs(...args),
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
  getSystemAccountIds,
  validateSystemAccounts,
  clearSystemAccountsCache,
  getEntityControlAccount,
  type SystemAccountIds,
} from './systemAccountResolver';
import type { Firestore } from 'firebase/firestore';

describe('systemAccountResolver', () => {
  const mockDb = {} as unknown as Firestore;

  beforeEach(() => {
    jest.clearAllMocks();
    clearSystemAccountsCache(); // Clear cache before each test
  });

  describe('getSystemAccountIds', () => {
    it('fetches all system accounts successfully', async () => {
      // Setup mock to return different accounts for each query
      mockGetDocs
        // Accounts Receivable (code 1200)
        .mockResolvedValueOnce({
          empty: false,
          docs: [{ id: 'ar-account-id' }],
        })
        // Revenue (code 4100)
        .mockResolvedValueOnce({
          empty: false,
          docs: [{ id: 'revenue-account-id' }],
        })
        // CGST Payable (code 2201)
        .mockResolvedValueOnce({
          empty: false,
          docs: [{ id: 'cgst-payable-id' }],
        })
        // SGST Payable (code 2202)
        .mockResolvedValueOnce({
          empty: false,
          docs: [{ id: 'sgst-payable-id' }],
        })
        // IGST Payable (code 2203)
        .mockResolvedValueOnce({
          empty: false,
          docs: [{ id: 'igst-payable-id' }],
        })
        // Accounts Payable (code 2100)
        .mockResolvedValueOnce({
          empty: false,
          docs: [{ id: 'ap-account-id' }],
        })
        // Expenses (code 5100)
        .mockResolvedValueOnce({
          empty: false,
          docs: [{ id: 'expenses-account-id' }],
        })
        // CGST Input (code 1301)
        .mockResolvedValueOnce({
          empty: false,
          docs: [{ id: 'cgst-input-id' }],
        })
        // SGST Input (code 1302)
        .mockResolvedValueOnce({
          empty: false,
          docs: [{ id: 'sgst-input-id' }],
        })
        // IGST Input (code 1303)
        .mockResolvedValueOnce({
          empty: false,
          docs: [{ id: 'igst-input-id' }],
        })
        // TDS Payable (code 2300)
        .mockResolvedValueOnce({
          empty: false,
          docs: [{ id: 'tds-payable-id' }],
        });

      const result = await getSystemAccountIds(mockDb);

      expect(result.accountsReceivable).toBe('ar-account-id');
      expect(result.revenue).toBe('revenue-account-id');
      expect(result.cgstPayable).toBe('cgst-payable-id');
      expect(result.sgstPayable).toBe('sgst-payable-id');
      expect(result.igstPayable).toBe('igst-payable-id');
      expect(result.accountsPayable).toBe('ap-account-id');
      expect(result.expenses).toBe('expenses-account-id');
      expect(result.cgstInput).toBe('cgst-input-id');
      expect(result.sgstInput).toBe('sgst-input-id');
      expect(result.igstInput).toBe('igst-input-id');
      expect(result.tdsPayable).toBe('tds-payable-id');
    });

    it('handles missing accounts gracefully', async () => {
      // All queries return empty
      mockGetDocs.mockResolvedValue({
        empty: true,
        docs: [],
      });

      const result = await getSystemAccountIds(mockDb);

      expect(result.accountsReceivable).toBeUndefined();
      expect(result.revenue).toBeUndefined();
      expect(result.cgstPayable).toBeUndefined();
    });

    it('uses cached results within TTL', async () => {
      // First call - setup mock
      mockGetDocs.mockResolvedValue({
        empty: false,
        docs: [{ id: 'cached-id' }],
      });

      // First call
      await getSystemAccountIds(mockDb);
      const callCount = mockGetDocs.mock.calls.length;

      // Second call should use cache
      await getSystemAccountIds(mockDb);

      // Should not have made additional calls
      expect(mockGetDocs.mock.calls.length).toBe(callCount);
    });

    it('refreshes cache when forceRefresh is true', async () => {
      mockGetDocs.mockResolvedValue({
        empty: false,
        docs: [{ id: 'some-id' }],
      });

      // First call
      await getSystemAccountIds(mockDb);
      const callCountAfterFirst = mockGetDocs.mock.calls.length;

      // Second call with forceRefresh
      await getSystemAccountIds(mockDb, true);

      // Should have made additional calls
      expect(mockGetDocs.mock.calls.length).toBeGreaterThan(callCountAfterFirst);
    });

    it('throws error when Firestore operation fails', async () => {
      mockGetDocs.mockRejectedValue(new Error('Firestore error'));

      await expect(getSystemAccountIds(mockDb)).rejects.toThrow('Firestore error');
    });
  });

  describe('validateSystemAccounts', () => {
    it('validates customer invoice accounts - all present', () => {
      const accounts: SystemAccountIds = {
        accountsReceivable: 'ar-id',
        revenue: 'rev-id',
        cgstPayable: 'cgst-id',
        sgstPayable: 'sgst-id',
        igstPayable: 'igst-id',
      };

      const result = validateSystemAccounts(accounts, 'CUSTOMER_INVOICE');

      expect(result.valid).toBe(true);
      expect(result.missingAccounts).toHaveLength(0);
    });

    it('validates customer invoice accounts - missing some', () => {
      const accounts: SystemAccountIds = {
        accountsReceivable: 'ar-id',
        // Missing revenue and GST accounts
      };

      const result = validateSystemAccounts(accounts, 'CUSTOMER_INVOICE');

      expect(result.valid).toBe(false);
      expect(result.missingAccounts).toContain('Sales Revenue');
      expect(result.missingAccounts).toContain('CGST Output');
      expect(result.missingAccounts).toContain('SGST Output');
      expect(result.missingAccounts).toContain('IGST Output');
    });

    it('validates vendor bill accounts - all present', () => {
      const accounts: SystemAccountIds = {
        accountsPayable: 'ap-id',
        expenses: 'exp-id',
        cgstInput: 'cgst-id',
        sgstInput: 'sgst-id',
        igstInput: 'igst-id',
        tdsPayable: 'tds-id',
      };

      const result = validateSystemAccounts(accounts, 'VENDOR_BILL');

      expect(result.valid).toBe(true);
      expect(result.missingAccounts).toHaveLength(0);
    });

    it('validates vendor bill accounts - missing some', () => {
      const accounts: SystemAccountIds = {
        accountsPayable: 'ap-id',
        // Missing expenses, GST, and TDS accounts
      };

      const result = validateSystemAccounts(accounts, 'VENDOR_BILL');

      expect(result.valid).toBe(false);
      expect(result.missingAccounts).toContain('Cost of Goods Sold');
      expect(result.missingAccounts).toContain('CGST Input');
      expect(result.missingAccounts).toContain('SGST Input');
      expect(result.missingAccounts).toContain('IGST Input');
      expect(result.missingAccounts).toContain('TDS Payable');
    });
  });

  describe('clearSystemAccountsCache', () => {
    it('clears the cache forcing next call to fetch', async () => {
      mockGetDocs.mockResolvedValue({
        empty: false,
        docs: [{ id: 'some-id' }],
      });

      // First call
      await getSystemAccountIds(mockDb);
      const callCountAfterFirst = mockGetDocs.mock.calls.length;

      // Clear cache
      clearSystemAccountsCache();

      // Next call should fetch again
      await getSystemAccountIds(mockDb);

      expect(mockGetDocs.mock.calls.length).toBeGreaterThan(callCountAfterFirst);
    });
  });

  describe('getEntityControlAccount', () => {
    beforeEach(() => {
      // Setup mock to return system accounts
      mockGetDocs
        .mockResolvedValueOnce({ empty: false, docs: [{ id: 'ar-account-id' }] })
        .mockResolvedValueOnce({ empty: false, docs: [{ id: 'revenue-id' }] })
        .mockResolvedValueOnce({ empty: false, docs: [{ id: 'cgst-payable-id' }] })
        .mockResolvedValueOnce({ empty: false, docs: [{ id: 'sgst-payable-id' }] })
        .mockResolvedValueOnce({ empty: false, docs: [{ id: 'igst-payable-id' }] })
        .mockResolvedValueOnce({ empty: false, docs: [{ id: 'ap-account-id' }] })
        .mockResolvedValueOnce({ empty: false, docs: [{ id: 'expenses-id' }] })
        .mockResolvedValueOnce({ empty: false, docs: [{ id: 'cgst-input-id' }] })
        .mockResolvedValueOnce({ empty: false, docs: [{ id: 'sgst-input-id' }] })
        .mockResolvedValueOnce({ empty: false, docs: [{ id: 'igst-input-id' }] })
        .mockResolvedValueOnce({ empty: false, docs: [{ id: 'tds-payable-id' }] });
    });

    it('returns Accounts Receivable for CUSTOMER role', async () => {
      const result = await getEntityControlAccount(mockDb, ['CUSTOMER'], true);

      expect(result).not.toBeNull();
      expect(result?.accountId).toBe('ar-account-id');
      expect(result?.accountCode).toBe('1200');
      expect(result?.accountName).toBe('Trade Receivables (Debtors)');
    });

    it('returns Accounts Payable for VENDOR role', async () => {
      const result = await getEntityControlAccount(mockDb, ['VENDOR'], false);

      expect(result).not.toBeNull();
      expect(result?.accountId).toBe('ap-account-id');
      expect(result?.accountCode).toBe('2100');
      expect(result?.accountName).toBe('Trade Payables (Creditors)');
    });

    it('returns Accounts Receivable for BOTH role with debit entry', async () => {
      const result = await getEntityControlAccount(mockDb, ['BOTH'], true);

      expect(result).not.toBeNull();
      expect(result?.accountId).toBe('ar-account-id');
      expect(result?.accountCode).toBe('1200');
    });

    it('returns Accounts Payable for BOTH role with credit entry', async () => {
      const result = await getEntityControlAccount(mockDb, ['BOTH'], false);

      expect(result).not.toBeNull();
      expect(result?.accountId).toBe('ap-account-id');
      expect(result?.accountCode).toBe('2100');
    });

    it('returns Accounts Receivable for dual CUSTOMER+VENDOR role with debit entry', async () => {
      const result = await getEntityControlAccount(mockDb, ['CUSTOMER', 'VENDOR'], true);

      expect(result).not.toBeNull();
      expect(result?.accountId).toBe('ar-account-id');
    });

    it('returns Accounts Payable for dual CUSTOMER+VENDOR role with credit entry', async () => {
      const result = await getEntityControlAccount(mockDb, ['CUSTOMER', 'VENDOR'], false);

      expect(result).not.toBeNull();
      expect(result?.accountId).toBe('ap-account-id');
    });
  });
});
