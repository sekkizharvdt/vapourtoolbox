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

  // Helper to create a mock Firestore doc with a data() method
  function mockDoc(id: string, fields: Record<string, unknown>) {
    return { id, data: () => fields };
  }

  // All system account docs for a successful fetch
  function allSystemAccountDocs() {
    return [
      mockDoc('ar-account-id', { code: '1200', isSystemAccount: true }),
      mockDoc('revenue-account-id', { code: '4100', isSystemAccount: true }),
      mockDoc('cgst-payable-id', { code: '2201', gstType: 'CGST', gstDirection: 'OUTPUT' }),
      mockDoc('sgst-payable-id', { code: '2202', gstType: 'SGST', gstDirection: 'OUTPUT' }),
      mockDoc('igst-payable-id', { code: '2203', gstType: 'IGST', gstDirection: 'OUTPUT' }),
      mockDoc('ap-account-id', { code: '2100', isSystemAccount: true }),
      mockDoc('expenses-account-id', { code: '5100', isSystemAccount: true }),
      mockDoc('cgst-input-id', { code: '1301', gstType: 'CGST', gstDirection: 'INPUT' }),
      mockDoc('sgst-input-id', { code: '1302', gstType: 'SGST', gstDirection: 'INPUT' }),
      mockDoc('igst-input-id', { code: '1303', gstType: 'IGST', gstDirection: 'INPUT' }),
      mockDoc('tds-payable-id', { code: '2300', isTDSAccount: true }),
    ];
  }

  describe('getSystemAccountIds', () => {
    it('fetches all system accounts successfully', async () => {
      mockGetDocs.mockResolvedValueOnce({ docs: allSystemAccountDocs() });

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
      mockGetDocs.mockResolvedValueOnce({ docs: [] });

      const result = await getSystemAccountIds(mockDb);

      expect(result.accountsReceivable).toBeUndefined();
      expect(result.revenue).toBeUndefined();
      expect(result.cgstPayable).toBeUndefined();
    });

    it('uses cached results within TTL', async () => {
      mockGetDocs.mockResolvedValueOnce({ docs: allSystemAccountDocs() });

      // First call
      await getSystemAccountIds(mockDb);
      const callCount = mockGetDocs.mock.calls.length;

      // Second call should use cache
      await getSystemAccountIds(mockDb);

      // Should not have made additional calls
      expect(mockGetDocs.mock.calls.length).toBe(callCount);
    });

    it('refreshes cache when forceRefresh is true', async () => {
      mockGetDocs.mockResolvedValue({ docs: allSystemAccountDocs() });

      // First call
      await getSystemAccountIds(mockDb);
      const callCountAfterFirst = mockGetDocs.mock.calls.length;

      // Second call with forceRefresh
      await getSystemAccountIds(mockDb, true);

      // Should have made additional calls
      expect(mockGetDocs.mock.calls.length).toBeGreaterThan(callCountAfterFirst);
    });

    it('throws error when Firestore operation fails', async () => {
      mockGetDocs.mockRejectedValueOnce(new Error('Firestore error'));

      await expect(getSystemAccountIds(mockDb)).rejects.toThrow('Firestore error');
    });

    it('only makes a single Firestore query', async () => {
      mockGetDocs.mockResolvedValueOnce({ docs: allSystemAccountDocs() });

      await getSystemAccountIds(mockDb);

      expect(mockGetDocs).toHaveBeenCalledTimes(1);
    });

    it('validates GST properties client-side', async () => {
      // Return docs with correct codes but wrong GST properties
      mockGetDocs.mockResolvedValueOnce({
        docs: [
          mockDoc('wrong-cgst', { code: '2201', gstType: 'SGST', gstDirection: 'OUTPUT' }),
          mockDoc('correct-ap', { code: '2100', isSystemAccount: true }),
        ],
      });

      const result = await getSystemAccountIds(mockDb);

      expect(result.cgstPayable).toBeUndefined(); // Wrong gstType
      expect(result.accountsPayable).toBe('correct-ap'); // Correct
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
      mockGetDocs.mockResolvedValue({ docs: allSystemAccountDocs() });

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
      mockGetDocs.mockResolvedValueOnce({ docs: allSystemAccountDocs() });
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
