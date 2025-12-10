/**
 * Transaction Helpers Tests
 *
 * Tests for transaction helper functions including:
 * - Invoice ledger entry generation
 * - Bill ledger entry generation
 * - Transaction validation
 * - Line item calculations
 * - Forex calculations
 * - Currency formatting
 */

import {
  generateInvoiceLedgerEntries,
  generateBillLedgerEntries,
  validateTransaction,
  calculateLineItemsTotal,
  validateLedgerBalance,
  calculateForexGainLoss,
  generateForexGainLossEntry,
  applyForexCalculation,
  addForexEntryToLedger,
  formatCurrency,
} from './transactionHelpers';
import type { CustomerInvoice, VendorBill, BaseTransaction, LedgerEntry } from '@vapour/types';

describe('Transaction Helpers', () => {
  describe('generateInvoiceLedgerEntries', () => {
    it('should generate entries for simple invoice without GST', () => {
      const invoice: Partial<CustomerInvoice> = {
        totalAmount: 10000,
        subtotal: 10000,
        transactionNumber: 'INV-001',
        projectId: 'proj-001',
      };

      const entries = generateInvoiceLedgerEntries(invoice, 'customer-acc', 'revenue-acc');

      expect(entries).toHaveLength(2);
      expect(entries[0]!.accountId).toBe('customer-acc');
      expect(entries[0]!.debit).toBe(10000);
      expect(entries[0]!.credit).toBe(0);
      expect(entries[1]!.accountId).toBe('revenue-acc');
      expect(entries[1]!.debit).toBe(0);
      expect(entries[1]!.credit).toBe(10000);
    });

    it('should generate entries with CGST and SGST', () => {
      const invoice: Partial<CustomerInvoice> = {
        totalAmount: 11800,
        subtotal: 10000,
        transactionNumber: 'INV-002',
        gstDetails: {
          gstType: 'CGST_SGST',
          cgstAmount: 900,
          sgstAmount: 900,
          totalGST: 1800,
          taxableAmount: 10000,
          cgstRate: 9,
          sgstRate: 9,
          placeOfSupply: 'KA',
        },
      };

      const entries = generateInvoiceLedgerEntries(invoice, 'customer-acc', 'revenue-acc', {
        cgst: 'cgst-payable',
        sgst: 'sgst-payable',
      });

      expect(entries).toHaveLength(4);
      expect(entries[0]!.debit).toBe(11800); // Customer receivable
      expect(entries[1]!.credit).toBe(10000); // Revenue
      expect(entries[2]!.credit).toBe(900); // CGST payable
      expect(entries[3]!.credit).toBe(900); // SGST payable
    });

    it('should generate entries with IGST', () => {
      const invoice: Partial<CustomerInvoice> = {
        totalAmount: 11800,
        subtotal: 10000,
        transactionNumber: 'INV-003',
        gstDetails: {
          gstType: 'IGST',
          igstAmount: 1800,
          totalGST: 1800,
          taxableAmount: 10000,
          igstRate: 18,
          placeOfSupply: 'MH',
        },
      };

      const entries = generateInvoiceLedgerEntries(invoice, 'customer-acc', 'revenue-acc', {
        igst: 'igst-payable',
      });

      expect(entries).toHaveLength(3);
      expect(entries[0]!.debit).toBe(11800);
      expect(entries[1]!.credit).toBe(10000);
      expect(entries[2]!.credit).toBe(1800); // IGST payable
    });

    it('should return empty array when amounts are missing', () => {
      const invoice: Partial<CustomerInvoice> = {
        transactionNumber: 'INV-004',
      };

      const entries = generateInvoiceLedgerEntries(invoice, 'customer-acc', 'revenue-acc');

      expect(entries).toHaveLength(0);
    });

    it('should include cost centre in entries', () => {
      const invoice: Partial<CustomerInvoice> = {
        totalAmount: 10000,
        subtotal: 10000,
        transactionNumber: 'INV-005',
        projectId: 'proj-001',
      };

      const entries = generateInvoiceLedgerEntries(invoice, 'customer-acc', 'revenue-acc');

      entries.forEach((entry) => {
        expect(entry.costCentreId).toBe('proj-001');
      });
    });
  });

  describe('generateBillLedgerEntries', () => {
    it('should generate entries for simple bill without GST', () => {
      const bill: Partial<VendorBill> = {
        subtotal: 10000,
        totalAmount: 10000,
        transactionNumber: 'BILL-001',
      };

      const entries = generateBillLedgerEntries(bill, 'vendor-acc', 'expense-acc');

      expect(entries).toHaveLength(2);
      expect(entries[0]!.accountId).toBe('expense-acc');
      expect(entries[0]!.debit).toBe(10000);
      expect(entries[1]!.accountId).toBe('vendor-acc');
      expect(entries[1]!.credit).toBe(10000);
    });

    it('should generate entries with GST input credit', () => {
      const bill: Partial<VendorBill> = {
        subtotal: 10000,
        totalAmount: 11800,
        transactionNumber: 'BILL-002',
        gstDetails: {
          gstType: 'CGST_SGST',
          cgstAmount: 900,
          sgstAmount: 900,
          totalGST: 1800,
          taxableAmount: 10000,
          cgstRate: 9,
          sgstRate: 9,
          placeOfSupply: 'KA',
        },
      };

      const entries = generateBillLedgerEntries(bill, 'vendor-acc', 'expense-acc', {
        cgst: 'cgst-input',
        sgst: 'sgst-input',
      });

      expect(entries).toHaveLength(4);
      expect(entries[0]!.debit).toBe(10000); // Expense
      expect(entries[1]!.debit).toBe(900); // CGST input
      expect(entries[2]!.debit).toBe(900); // SGST input
      expect(entries[3]!.credit).toBe(11800); // Vendor payable
    });

    it('should generate entries with TDS deduction', () => {
      const bill: Partial<VendorBill> = {
        subtotal: 100000,
        totalAmount: 100000,
        transactionNumber: 'BILL-003',
        tdsDeducted: true,
        tdsAmount: 1000,
      };

      const entries = generateBillLedgerEntries(
        bill,
        'vendor-acc',
        'expense-acc',
        undefined,
        'tds-payable'
      );

      expect(entries).toHaveLength(3);
      expect(entries[0]!.debit).toBe(100000); // Expense
      expect(entries[1]!.credit).toBe(99000); // Vendor payable (net)
      expect(entries[2]!.credit).toBe(1000); // TDS payable
    });

    it('should return empty array when subtotal is missing', () => {
      const bill: Partial<VendorBill> = {
        transactionNumber: 'BILL-004',
      };

      const entries = generateBillLedgerEntries(bill, 'vendor-acc', 'expense-acc');

      expect(entries).toHaveLength(0);
    });
  });

  describe('validateTransaction', () => {
    it('should return valid for complete transaction', () => {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const transaction: any = {
        type: 'CUSTOMER_INVOICE',
        date: { toDate: () => new Date() },
        amount: 10000,
        entries: [
          { accountId: 'acc-001', debit: 10000, credit: 0 },
          { accountId: 'acc-002', debit: 0, credit: 10000 },
        ],
      };

      const result = validateTransaction(transaction);

      expect(result.isValid).toBe(true);
      expect(result.errors).toHaveLength(0);
    });

    it('should error when type is missing', () => {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const transaction: any = {
        date: { toDate: () => new Date() },
        amount: 10000,
        entries: [{ accountId: 'acc-001', debit: 10000, credit: 0 }],
      };

      const result = validateTransaction(transaction);

      expect(result.isValid).toBe(false);
      expect(result.errors).toContain('Transaction type is required');
    });

    it('should error when date is missing', () => {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const transaction: any = {
        type: 'CUSTOMER_INVOICE',
        amount: 10000,
        entries: [{ accountId: 'acc-001', debit: 10000, credit: 0 }],
      };

      const result = validateTransaction(transaction);

      expect(result.isValid).toBe(false);
      expect(result.errors).toContain('Transaction date is required');
    });

    it('should error when amount is zero or negative', () => {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const transaction: any = {
        type: 'CUSTOMER_INVOICE',
        date: { toDate: () => new Date() },
        amount: 0,
        entries: [{ accountId: 'acc-001', debit: 10000, credit: 0 }],
      };

      const result = validateTransaction(transaction);

      expect(result.isValid).toBe(false);
      expect(result.errors).toContain('Amount must be greater than zero');
    });

    it('should error when entries are missing', () => {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const transaction: any = {
        type: 'CUSTOMER_INVOICE',
        date: { toDate: () => new Date() },
        amount: 10000,
        entries: [],
      };

      const result = validateTransaction(transaction);

      expect(result.isValid).toBe(false);
      expect(result.errors).toContain('At least one ledger entry is required');
    });
  });

  describe('calculateLineItemsTotal', () => {
    it('should calculate totals for simple line items', () => {
      const lineItems = [
        { quantity: 2, unitPrice: 100 },
        { quantity: 3, unitPrice: 200 },
      ];

      const result = calculateLineItemsTotal(lineItems);

      expect(result.subtotal).toBe(800); // 200 + 600
      expect(result.taxAmount).toBe(0);
      expect(result.total).toBe(800);
    });

    it('should calculate totals with GST', () => {
      const lineItems = [
        { quantity: 2, unitPrice: 100, gstRate: 18 },
        { quantity: 3, unitPrice: 200, gstRate: 18 },
      ];

      const result = calculateLineItemsTotal(lineItems);

      expect(result.subtotal).toBe(800);
      expect(result.taxAmount).toBe(144); // 18% of 800
      expect(result.total).toBe(944);
    });

    it('should handle mixed GST rates', () => {
      const lineItems = [
        { quantity: 1, unitPrice: 1000, gstRate: 5 },
        { quantity: 1, unitPrice: 1000, gstRate: 18 },
      ];

      const result = calculateLineItemsTotal(lineItems);

      expect(result.subtotal).toBe(2000);
      expect(result.taxAmount).toBe(230); // 50 + 180
      expect(result.total).toBe(2230);
    });

    it('should handle empty line items', () => {
      const result = calculateLineItemsTotal([]);

      expect(result.subtotal).toBe(0);
      expect(result.taxAmount).toBe(0);
      expect(result.total).toBe(0);
    });

    it('should round amounts to 2 decimal places', () => {
      const lineItems = [{ quantity: 3, unitPrice: 33.33, gstRate: 18 }];

      const result = calculateLineItemsTotal(lineItems);

      // 99.99 subtotal, 17.9982 tax
      expect(result.subtotal).toBe(99.99);
      expect(result.taxAmount).toBe(18);
      expect(result.total).toBe(117.99);
    });
  });

  describe('validateLedgerBalance', () => {
    it('should return balanced for equal debits and credits', () => {
      const entries: LedgerEntry[] = [
        { accountId: 'acc-001', debit: 1000, credit: 0 },
        { accountId: 'acc-002', debit: 0, credit: 1000 },
      ];

      const result = validateLedgerBalance(entries);

      expect(result.balanced).toBe(true);
      expect(result.totalDebits).toBe(1000);
      expect(result.totalCredits).toBe(1000);
    });

    it('should return unbalanced when totals differ', () => {
      const entries: LedgerEntry[] = [
        { accountId: 'acc-001', debit: 1000, credit: 0 },
        { accountId: 'acc-002', debit: 0, credit: 900 },
      ];

      const result = validateLedgerBalance(entries);

      expect(result.balanced).toBe(false);
      expect(result.totalDebits).toBe(1000);
      expect(result.totalCredits).toBe(900);
    });

    it('should handle multiple entries', () => {
      const entries: LedgerEntry[] = [
        { accountId: 'acc-001', debit: 500, credit: 0 },
        { accountId: 'acc-002', debit: 500, credit: 0 },
        { accountId: 'acc-003', debit: 0, credit: 600 },
        { accountId: 'acc-004', debit: 0, credit: 400 },
      ];

      const result = validateLedgerBalance(entries);

      expect(result.balanced).toBe(true);
      expect(result.totalDebits).toBe(1000);
      expect(result.totalCredits).toBe(1000);
    });
  });

  describe('calculateForexGainLoss', () => {
    it('should return no forex impact for INR transactions', () => {
      const result = calculateForexGainLoss({
        amount: 10000,
        currency: 'INR',
        baseAmount: 10000,
      });

      expect(result.forexGainLoss).toBe(0);
      expect(result.hasForexImpact).toBe(false);
    });

    it('should return no impact when bank settlement rate not provided', () => {
      const result = calculateForexGainLoss({
        amount: 1000,
        currency: 'USD',
        exchangeRate: 83,
        baseAmount: 83000,
      });

      expect(result.forexGainLoss).toBe(0);
      expect(result.hasForexImpact).toBe(false);
    });

    it('should calculate forex gain when bank gives more INR', () => {
      const result = calculateForexGainLoss({
        amount: 1000, // USD
        currency: 'USD',
        exchangeRate: 83,
        baseAmount: 83000,
        bankSettlementRate: 84, // Bank gives better rate
      });

      // 1000 * 84 = 84000, gain = 84000 - 83000 = 1000
      expect(result.forexGainLoss).toBe(1000);
      expect(result.calculatedBankAmount).toBe(84000);
      expect(result.hasForexImpact).toBe(true);
    });

    it('should calculate forex loss when bank gives less INR', () => {
      const result = calculateForexGainLoss({
        amount: 1000, // USD
        currency: 'USD',
        exchangeRate: 83,
        baseAmount: 83000,
        bankSettlementRate: 82, // Bank gives worse rate
      });

      // 1000 * 82 = 82000, loss = 82000 - 83000 = -1000
      expect(result.forexGainLoss).toBe(-1000);
      expect(result.calculatedBankAmount).toBe(82000);
      expect(result.hasForexImpact).toBe(true);
    });

    it('should use provided bank settlement amount if available', () => {
      const result = calculateForexGainLoss({
        amount: 1000,
        currency: 'USD',
        exchangeRate: 83,
        baseAmount: 83000,
        bankSettlementRate: 84,
        bankSettlementAmount: 84500, // Actual amount received
      });

      expect(result.forexGainLoss).toBe(1500); // 84500 - 83000
      expect(result.calculatedBankAmount).toBe(84500);
    });

    it('should ignore very small differences (< 0.01)', () => {
      const result = calculateForexGainLoss({
        amount: 1000,
        currency: 'USD',
        exchangeRate: 83,
        baseAmount: 83000,
        bankSettlementRate: 83.000009,
      });

      expect(result.hasForexImpact).toBe(false);
    });
  });

  describe('generateForexGainLossEntry', () => {
    it('should return null for amounts below threshold', () => {
      const entry = generateForexGainLossEntry(
        0.005,
        'TXN-001',
        'forex-gain-acc',
        'forex-loss-acc'
      );

      expect(entry).toBeNull();
    });

    it('should generate credit entry for forex gain', () => {
      const entry = generateForexGainLossEntry(
        1000,
        'TXN-001',
        'forex-gain-acc',
        'forex-loss-acc',
        'cost-centre-001'
      );

      expect(entry).not.toBeNull();
      expect(entry!.accountId).toBe('forex-gain-acc');
      expect(entry!.debit).toBe(0);
      expect(entry!.credit).toBe(1000);
      expect(entry!.description).toContain('Forex gain');
      expect(entry!.costCentreId).toBe('cost-centre-001');
    });

    it('should generate debit entry for forex loss', () => {
      const entry = generateForexGainLossEntry(-500, 'TXN-002', 'forex-gain-acc', 'forex-loss-acc');

      expect(entry).not.toBeNull();
      expect(entry!.accountId).toBe('forex-loss-acc');
      expect(entry!.debit).toBe(500);
      expect(entry!.credit).toBe(0);
      expect(entry!.description).toContain('Forex loss');
    });
  });

  describe('applyForexCalculation', () => {
    it('should return transaction unchanged if forex data missing', () => {
      const transaction: Partial<BaseTransaction> = {
        transactionNumber: 'TXN-001',
      };

      const result = applyForexCalculation(transaction);

      expect(result).toEqual(transaction);
    });

    it('should update transaction with forex calculations', () => {
      const transaction: Partial<BaseTransaction> = {
        transactionNumber: 'TXN-001',
        amount: 1000,
        currency: 'USD',
        baseAmount: 83000,
        bankSettlementRate: 84,
      };

      const result = applyForexCalculation(transaction);

      expect(result.bankSettlementAmount).toBe(84000);
      expect(result.forexGainLoss).toBe(1000);
    });
  });

  describe('addForexEntryToLedger', () => {
    it('should add forex entry to existing entries', () => {
      const transaction: Partial<BaseTransaction> = {
        transactionNumber: 'TXN-001',
        amount: 1000,
        currency: 'USD',
        baseAmount: 83000,
        bankSettlementRate: 84,
        entries: [
          { accountId: 'cash-acc', debit: 84000, credit: 0 },
          { accountId: 'receivable-acc', debit: 0, credit: 83000 },
        ],
      };

      const entries = addForexEntryToLedger(transaction, 'forex-gain-acc', 'forex-loss-acc');

      expect(entries).toHaveLength(3);
      expect(entries[2]!.accountId).toBe('forex-gain-acc');
      expect(entries[2]!.credit).toBe(1000);
    });

    it('should not add entry for no forex impact', () => {
      const transaction: Partial<BaseTransaction> = {
        transactionNumber: 'TXN-001',
        amount: 10000,
        currency: 'INR',
        baseAmount: 10000,
        entries: [
          { accountId: 'cash-acc', debit: 10000, credit: 0 },
          { accountId: 'revenue-acc', debit: 0, credit: 10000 },
        ],
      };

      const entries = addForexEntryToLedger(transaction, 'forex-gain-acc', 'forex-loss-acc');

      expect(entries).toHaveLength(2);
    });
  });

  describe('formatCurrency', () => {
    it('should format INR with Indian numbering system', () => {
      const formatted = formatCurrency(100000, 'INR');

      expect(formatted).toContain('₹');
      expect(formatted).toContain('1,00,000.00');
    });

    it('should format USD correctly', () => {
      const formatted = formatCurrency(100000, 'USD');

      expect(formatted).toContain('$');
      expect(formatted).toContain('100,000.00');
    });

    it('should default to INR when currency not specified', () => {
      const formatted = formatCurrency(50000);

      expect(formatted).toContain('₹');
    });

    it('should format decimal amounts', () => {
      const formatted = formatCurrency(1234.56, 'INR');

      expect(formatted).toContain('1,234.56');
    });

    it('should format zero correctly', () => {
      const formatted = formatCurrency(0, 'INR');

      expect(formatted).toContain('0.00');
    });
  });
});
