/**
 * GL Entry Generator Tests
 *
 * Tests the core double-entry bookkeeping engine that generates GL entries
 * for invoices, bills, and payments.
 */

import type { SystemAccountIds } from '../systemAccountResolver';
import type { InvoiceGLInput, BillGLInput, PaymentGLInput } from './types';

// Mock the system account resolver
jest.mock('../systemAccountResolver', () => ({
  getSystemAccountIds: jest.fn(),
}));

import { getSystemAccountIds } from '../systemAccountResolver';
import {
  generateInvoiceGLEntries,
  generateBillGLEntries,
  generateCustomerPaymentGLEntries,
  generateVendorPaymentGLEntries,
} from './generators';

const mockGetSystemAccountIds = getSystemAccountIds as jest.MockedFunction<
  typeof getSystemAccountIds
>;

const MOCK_ACCOUNTS: SystemAccountIds = {
  accountsReceivable: 'acc-ar',
  revenue: 'acc-rev',
  cgstPayable: 'acc-cgst-out',
  sgstPayable: 'acc-sgst-out',
  igstPayable: 'acc-igst-out',
  accountsPayable: 'acc-ap',
  expenses: 'acc-exp',
  cgstInput: 'acc-cgst-in',
  sgstInput: 'acc-sgst-in',
  igstInput: 'acc-igst-in',
  tdsPayable: 'acc-tds',
};

// eslint-disable-next-line @typescript-eslint/consistent-type-assertions
const db = {} as never;

beforeEach(() => {
  mockGetSystemAccountIds.mockResolvedValue(MOCK_ACCOUNTS);
});

afterEach(() => {
  jest.clearAllMocks();
});

// ─────────────────────────── Invoice GL Entries ───────────────────────────

describe('generateInvoiceGLEntries', () => {
  it('should generate balanced entries for a simple invoice (no GST)', async () => {
    const input: InvoiceGLInput = { subtotal: 10000 };

    const result = await generateInvoiceGLEntries(db, input);

    expect(result.success).toBe(true);
    expect(result.isBalanced).toBe(true);
    expect(result.totalDebit).toBe(10000);
    expect(result.totalCredit).toBe(10000);
    expect(result.entries).toHaveLength(2);

    // Dr. Accounts Receivable
    expect(result.entries[0]).toMatchObject({
      accountId: 'acc-ar',
      debit: 10000,
      credit: 0,
    });
    // Cr. Revenue
    expect(result.entries[1]).toMatchObject({
      accountId: 'acc-rev',
      debit: 0,
      credit: 10000,
    });
  });

  it('should generate entries with intra-state GST (CGST + SGST)', async () => {
    const input: InvoiceGLInput = {
      subtotal: 10000,
      gstDetails: {
        gstType: 'CGST_SGST',
        cgstAmount: 900,
        sgstAmount: 900,
        cgstRate: 9,
        sgstRate: 9,
        hsnCode: '8419',
        taxableAmount: 10000,
        totalGST: 1800,
      },
    };

    const result = await generateInvoiceGLEntries(db, input);

    expect(result.success).toBe(true);
    expect(result.isBalanced).toBe(true);
    expect(result.totalDebit).toBe(11800); // 10000 + 1800 GST
    expect(result.totalCredit).toBe(11800);
    expect(result.entries).toHaveLength(4);

    // Dr. Accounts Receivable = 11800
    expect(result.entries[0]).toMatchObject({
      accountId: 'acc-ar',
      debit: 11800,
    });
    // Cr. Revenue = 10000
    expect(result.entries[1]).toMatchObject({
      accountId: 'acc-rev',
      credit: 10000,
    });
    // Cr. CGST Payable = 900
    expect(result.entries[2]).toMatchObject({
      accountId: 'acc-cgst-out',
      credit: 900,
    });
    // Cr. SGST Payable = 900
    expect(result.entries[3]).toMatchObject({
      accountId: 'acc-sgst-out',
      credit: 900,
    });
  });

  it('should generate entries with inter-state GST (IGST)', async () => {
    const input: InvoiceGLInput = {
      subtotal: 10000,
      gstDetails: {
        gstType: 'IGST',
        igstAmount: 1800,
        igstRate: 18,
        hsnCode: '8419',
        taxableAmount: 10000,
        totalGST: 1800,
      },
    };

    const result = await generateInvoiceGLEntries(db, input);

    expect(result.success).toBe(true);
    expect(result.isBalanced).toBe(true);
    expect(result.totalDebit).toBe(11800);

    const igstEntry = result.entries.find((e) => e.accountId === 'acc-igst-out');
    expect(igstEntry).toBeDefined();
    expect(igstEntry!.credit).toBe(1800);
  });

  it('should use per-line-item revenue accounts when specified', async () => {
    const input: InvoiceGLInput = {
      subtotal: 15000,
      lineItems: [
        {
          description: 'Engineering',
          amount: 10000,
          accountId: 'acc-eng',
          accountCode: '4101',
          accountName: 'Engineering Revenue',
        },
        {
          description: 'Fabrication',
          amount: 5000,
          accountId: 'acc-fab',
          accountCode: '4102',
          accountName: 'Fabrication Revenue',
        },
      ],
    };

    const result = await generateInvoiceGLEntries(db, input);

    expect(result.success).toBe(true);
    expect(result.isBalanced).toBe(true);
    expect(result.entries).toHaveLength(3); // 1 AR + 2 revenue lines

    const engEntry = result.entries.find((e) => e.accountId === 'acc-eng');
    expect(engEntry).toMatchObject({ credit: 10000 });

    const fabEntry = result.entries.find((e) => e.accountId === 'acc-fab');
    expect(fabEntry).toMatchObject({ credit: 5000 });
  });

  it('should split between per-line-item and default revenue accounts', async () => {
    const input: InvoiceGLInput = {
      subtotal: 15000,
      lineItems: [
        { description: 'Engineering', amount: 10000, accountId: 'acc-eng' },
        { description: 'Misc', amount: 5000 }, // No specific account
      ],
    };

    const result = await generateInvoiceGLEntries(db, input);

    expect(result.success).toBe(true);

    // Should have entries for both specific and default revenue accounts
    const engEntry = result.entries.find((e) => e.accountId === 'acc-eng');
    expect(engEntry).toMatchObject({ credit: 10000 });

    const defaultRevEntry = result.entries.find((e) => e.accountId === 'acc-rev');
    expect(defaultRevEntry).toMatchObject({ credit: 5000 });
  });

  it('should fail when Accounts Receivable is missing', async () => {
    mockGetSystemAccountIds.mockResolvedValue({
      ...MOCK_ACCOUNTS,
      accountsReceivable: undefined,
    });

    const result = await generateInvoiceGLEntries(db, { subtotal: 10000 });

    expect(result.success).toBe(false);
    expect(result.errors).toContain('Accounts Receivable account not found in Chart of Accounts');
  });

  it('should fail when Revenue account is missing', async () => {
    mockGetSystemAccountIds.mockResolvedValue({
      ...MOCK_ACCOUNTS,
      revenue: undefined,
    });

    const result = await generateInvoiceGLEntries(db, { subtotal: 10000 });

    expect(result.success).toBe(false);
    expect(result.errors).toContain('Revenue account not found in Chart of Accounts');
  });

  it('should report missing GST accounts but still generate partial entries', async () => {
    mockGetSystemAccountIds.mockResolvedValue({
      ...MOCK_ACCOUNTS,
      cgstPayable: undefined,
    });

    const input: InvoiceGLInput = {
      subtotal: 10000,
      gstDetails: {
        gstType: 'CGST_SGST',
        cgstAmount: 900,
        sgstAmount: 900,
        cgstRate: 9,
        sgstRate: 9,
        hsnCode: '8419',
        taxableAmount: 10000,
        totalGST: 1800,
      },
    };

    const result = await generateInvoiceGLEntries(db, input);

    expect(result.success).toBe(false);
    expect(result.errors).toContain('CGST Payable account not found');
  });

  it('should handle error thrown by getSystemAccountIds', async () => {
    mockGetSystemAccountIds.mockRejectedValue(new Error('Firestore unavailable'));

    const result = await generateInvoiceGLEntries(db, { subtotal: 10000 });

    expect(result.success).toBe(false);
    expect(result.errors[0]).toContain('Failed to generate invoice GL entries');
  });

  it('should include projectId as costCentreId in all entries', async () => {
    const input: InvoiceGLInput = { subtotal: 10000, projectId: 'proj-123' };

    const result = await generateInvoiceGLEntries(db, input);

    expect(result.success).toBe(true);
    result.entries.forEach((entry) => {
      expect(entry.costCentreId).toBe('proj-123');
    });
  });
});

// ─────────────────────────── Bill GL Entries ──────────────────────────────

describe('generateBillGLEntries', () => {
  it('should generate balanced entries for a simple bill (no GST, no TDS)', async () => {
    const input: BillGLInput = { subtotal: 10000 };

    const result = await generateBillGLEntries(db, input);

    expect(result.success).toBe(true);
    expect(result.isBalanced).toBe(true);
    expect(result.totalDebit).toBe(10000);
    expect(result.totalCredit).toBe(10000);
    expect(result.entries).toHaveLength(2);

    // Dr. Expenses
    expect(result.entries[0]).toMatchObject({
      accountId: 'acc-exp',
      debit: 10000,
      credit: 0,
    });
    // Cr. Accounts Payable
    expect(result.entries[1]).toMatchObject({
      accountId: 'acc-ap',
      debit: 0,
      credit: 10000,
    });
  });

  it('should generate entries with intra-state GST', async () => {
    const input: BillGLInput = {
      subtotal: 10000,
      gstDetails: {
        gstType: 'CGST_SGST',
        cgstAmount: 900,
        sgstAmount: 900,
        cgstRate: 9,
        sgstRate: 9,
        hsnCode: '8419',
        taxableAmount: 10000,
        totalGST: 1800,
      },
    };

    const result = await generateBillGLEntries(db, input);

    expect(result.success).toBe(true);
    expect(result.isBalanced).toBe(true);
    // Dr: 10000 (exp) + 900 (CGST) + 900 (SGST) = 11800
    // Cr: 11800 (AP)
    expect(result.totalDebit).toBe(11800);
    expect(result.totalCredit).toBe(11800);
  });

  it('should generate entries with TDS deduction', async () => {
    const input: BillGLInput = {
      subtotal: 10000,
      tdsDetails: {
        tdsAmount: 200,
        tdsRate: 2,
        section: '194C',
      },
    };

    const result = await generateBillGLEntries(db, input);

    expect(result.success).toBe(true);
    expect(result.isBalanced).toBe(true);

    // Dr: 10000 (exp) = 10000
    // Cr: 9800 (AP) + 200 (TDS) = 10000
    const apEntry = result.entries.find((e) => e.accountId === 'acc-ap');
    expect(apEntry!.credit).toBe(9800); // payable after TDS

    const tdsEntry = result.entries.find((e) => e.accountId === 'acc-tds');
    expect(tdsEntry).toBeDefined();
    expect(tdsEntry!.credit).toBe(200);
  });

  it('should generate entries with GST + TDS combined', async () => {
    const input: BillGLInput = {
      subtotal: 10000,
      gstDetails: {
        gstType: 'IGST',
        igstAmount: 1800,
        igstRate: 18,
        hsnCode: '8419',
        taxableAmount: 10000,
        totalGST: 1800,
      },
      tdsDetails: {
        tdsAmount: 200,
        tdsRate: 2,
        section: '194C',
      },
    };

    const result = await generateBillGLEntries(db, input);

    expect(result.success).toBe(true);
    expect(result.isBalanced).toBe(true);

    // Dr: 10000 (exp) + 1800 (IGST input) = 11800
    // Cr: 11600 (AP = 11800 - 200 TDS) + 200 (TDS) = 11800
    expect(result.totalDebit).toBe(11800);
    expect(result.totalCredit).toBe(11800);

    const apEntry = result.entries.find((e) => e.accountId === 'acc-ap');
    expect(apEntry!.credit).toBe(11600);
  });

  it('should use per-line-item expense accounts when specified', async () => {
    const input: BillGLInput = {
      subtotal: 15000,
      lineItems: [
        { description: 'Raw Material', amount: 10000, accountId: 'acc-rm', accountCode: '5101' },
        { description: 'Transport', amount: 5000, accountId: 'acc-trans', accountCode: '5102' },
      ],
    };

    const result = await generateBillGLEntries(db, input);

    expect(result.success).toBe(true);
    expect(result.isBalanced).toBe(true);

    const rmEntry = result.entries.find((e) => e.accountId === 'acc-rm');
    expect(rmEntry).toMatchObject({ debit: 10000 });

    const transEntry = result.entries.find((e) => e.accountId === 'acc-trans');
    expect(transEntry).toMatchObject({ debit: 5000 });
  });

  it('should fail when Accounts Payable is missing', async () => {
    mockGetSystemAccountIds.mockResolvedValue({
      ...MOCK_ACCOUNTS,
      accountsPayable: undefined,
    });

    const result = await generateBillGLEntries(db, { subtotal: 10000 });

    expect(result.success).toBe(false);
    expect(result.errors).toContain('Accounts Payable account not found in Chart of Accounts');
  });

  it('should fail when Expense account is missing', async () => {
    mockGetSystemAccountIds.mockResolvedValue({
      ...MOCK_ACCOUNTS,
      expenses: undefined,
    });

    const result = await generateBillGLEntries(db, { subtotal: 10000 });

    expect(result.success).toBe(false);
    expect(result.errors).toContain('Expense account not found in Chart of Accounts');
  });

  it('should report missing TDS account when TDS is specified', async () => {
    mockGetSystemAccountIds.mockResolvedValue({
      ...MOCK_ACCOUNTS,
      tdsPayable: undefined,
    });

    const input: BillGLInput = {
      subtotal: 10000,
      tdsDetails: { tdsAmount: 200, tdsRate: 2, section: '194C' },
    };

    const result = await generateBillGLEntries(db, input);

    expect(result.success).toBe(false);
    expect(result.errors).toContain('TDS Payable account not found');
  });
});

// ─────────────────────── Customer Payment GL Entries ──────────────────────

describe('generateCustomerPaymentGLEntries', () => {
  it('should generate balanced entries for customer payment', async () => {
    const input: PaymentGLInput = {
      amount: 50000,
      bankAccountId: 'acc-bank-1',
    };

    const result = await generateCustomerPaymentGLEntries(db, input);

    expect(result.success).toBe(true);
    expect(result.isBalanced).toBe(true);
    expect(result.totalDebit).toBe(50000);
    expect(result.totalCredit).toBe(50000);
    expect(result.entries).toHaveLength(2);

    // Dr. Bank Account
    expect(result.entries[0]).toMatchObject({
      accountId: 'acc-bank-1',
      debit: 50000,
      credit: 0,
    });
    // Cr. Accounts Receivable
    expect(result.entries[1]).toMatchObject({
      accountId: 'acc-ar',
      debit: 0,
      credit: 50000,
    });
  });

  it('should use custom receivable account when provided', async () => {
    const input: PaymentGLInput = {
      amount: 50000,
      bankAccountId: 'acc-bank-1',
      receivableOrPayableAccountId: 'acc-custom-ar',
    };

    const result = await generateCustomerPaymentGLEntries(db, input);

    expect(result.success).toBe(true);
    const arEntry = result.entries.find((e) => e.credit > 0);
    expect(arEntry!.accountId).toBe('acc-custom-ar');
  });

  it('should return empty success when no bank account is provided', async () => {
    const input: PaymentGLInput = { amount: 50000 };

    const result = await generateCustomerPaymentGLEntries(db, input);

    expect(result.success).toBe(true);
    expect(result.entries).toHaveLength(0);
  });

  it('should fail when Accounts Receivable is missing and no custom account', async () => {
    mockGetSystemAccountIds.mockResolvedValue({
      ...MOCK_ACCOUNTS,
      accountsReceivable: undefined,
    });

    const input: PaymentGLInput = {
      amount: 50000,
      bankAccountId: 'acc-bank-1',
    };

    const result = await generateCustomerPaymentGLEntries(db, input);

    expect(result.success).toBe(false);
    expect(result.errors).toContain('Accounts Receivable account not found in Chart of Accounts');
  });
});

// ─────────────────────── Vendor Payment GL Entries ────────────────────────

describe('generateVendorPaymentGLEntries', () => {
  it('should generate balanced entries for vendor payment', async () => {
    const input: PaymentGLInput = {
      amount: 30000,
      bankAccountId: 'acc-bank-1',
    };

    const result = await generateVendorPaymentGLEntries(db, input);

    expect(result.success).toBe(true);
    expect(result.isBalanced).toBe(true);
    expect(result.totalDebit).toBe(30000);
    expect(result.totalCredit).toBe(30000);
    expect(result.entries).toHaveLength(2);

    // Dr. Accounts Payable
    expect(result.entries[0]).toMatchObject({
      accountId: 'acc-ap',
      debit: 30000,
      credit: 0,
    });
    // Cr. Bank Account
    expect(result.entries[1]).toMatchObject({
      accountId: 'acc-bank-1',
      debit: 0,
      credit: 30000,
    });
  });

  it('should use custom payable account when provided', async () => {
    const input: PaymentGLInput = {
      amount: 30000,
      bankAccountId: 'acc-bank-1',
      receivableOrPayableAccountId: 'acc-custom-ap',
    };

    const result = await generateVendorPaymentGLEntries(db, input);

    expect(result.success).toBe(true);
    const apEntry = result.entries.find((e) => e.debit > 0);
    expect(apEntry!.accountId).toBe('acc-custom-ap');
  });

  it('should return empty success when no bank account is provided', async () => {
    const input: PaymentGLInput = { amount: 30000 };

    const result = await generateVendorPaymentGLEntries(db, input);

    expect(result.success).toBe(true);
    expect(result.entries).toHaveLength(0);
  });

  it('should fail when Accounts Payable is missing and no custom account', async () => {
    mockGetSystemAccountIds.mockResolvedValue({
      ...MOCK_ACCOUNTS,
      accountsPayable: undefined,
    });

    const input: PaymentGLInput = {
      amount: 30000,
      bankAccountId: 'acc-bank-1',
    };

    const result = await generateVendorPaymentGLEntries(db, input);

    expect(result.success).toBe(false);
    expect(result.errors[0]).toContain('Accounts Payable account not found');
  });
});

// ─────────────────────── Cross-cutting Concerns ──────────────────────────

describe('Double-entry invariant', () => {
  it('should always produce balanced entries for invoice with full GST', async () => {
    const input: InvoiceGLInput = {
      subtotal: 123456.78,
      gstDetails: {
        gstType: 'CGST_SGST',
        cgstAmount: 11111.11,
        sgstAmount: 11111.11,
        cgstRate: 9,
        sgstRate: 9,
        hsnCode: '8419',
        taxableAmount: 123456.78,
        totalGST: 22222.22,
      },
    };

    const result = await generateInvoiceGLEntries(db, input);
    expect(result.isBalanced).toBe(true);
    expect(Math.abs(result.totalDebit - result.totalCredit)).toBeLessThan(0.01);
  });

  it('should always produce balanced entries for bill with GST + TDS', async () => {
    const input: BillGLInput = {
      subtotal: 87654.32,
      gstDetails: {
        gstType: 'CGST_SGST',
        cgstAmount: 7888.89,
        sgstAmount: 7888.89,
        cgstRate: 9,
        sgstRate: 9,
        hsnCode: '7304',
        taxableAmount: 87654.32,
        totalGST: 15777.78,
      },
      tdsDetails: {
        tdsAmount: 1753.09,
        tdsRate: 2,
        section: '194C',
      },
    };

    const result = await generateBillGLEntries(db, input);
    expect(result.isBalanced).toBe(true);
    expect(Math.abs(result.totalDebit - result.totalCredit)).toBeLessThan(0.01);
  });
});
