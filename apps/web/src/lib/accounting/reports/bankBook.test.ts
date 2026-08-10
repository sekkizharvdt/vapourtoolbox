import { computeBankBook, type BankAccountInfo, type BankMovement } from './bankBook';
import type { TransactionType } from '@vapour/types';

const d = (iso: string) => new Date(iso + 'T00:00:00');
const PERIOD = { startDate: d('2025-04-01'), endDate: d('2026-03-31') };

const acct = (id: string, openingBalance = 0): BankAccountInfo => ({
  id,
  code: '1103',
  name: 'SBI Savings',
  openingBalance,
});

const move = (over: Partial<BankMovement> & { id: string }): BankMovement => ({
  accountId: 'sbi',
  date: d('2025-06-01'),
  type: 'CUSTOMER_PAYMENT' as TransactionType,
  reference: 'RCPT-1',
  description: '',
  counterparty: 'Alpha',
  direction: 'IN',
  amountInr: 1000,
  paymentMethod: 'BANK_TRANSFER',
  ...over,
});

const accounts = new Map([['sbi', acct('sbi')]]);

describe('balances', () => {
  it('walks opening to closing through receipts and payments', () => {
    const r = computeBankBook(
      [
        move({ id: 'a', direction: 'IN', amountInr: 5000 }),
        move({ id: 'b', direction: 'OUT', amountInr: 2000 }),
      ],
      accounts,
      PERIOD
    );
    expect(r.accounts[0]).toMatchObject({
      openingBalance: 0,
      receipts: 5000,
      payments: 2000,
      closingBalance: 3000,
      receiptCount: 1,
      paymentCount: 1,
    });
  });

  it("seeds opening from the account's own opening balance", () => {
    const r = computeBankBook(
      [move({ id: 'a', amountInr: 500 })],
      new Map([['sbi', acct('sbi', 10000)]]),
      PERIOD
    );
    expect(r.accounts[0]?.openingBalance).toBe(10000);
    expect(r.accounts[0]?.closingBalance).toBe(10500);
  });

  it('carries pre-period movements into the opening balance rather than dropping them', () => {
    const r = computeBankBook(
      [
        move({ id: 'old', date: d('2025-01-01'), direction: 'IN', amountInr: 7000 }),
        move({ id: 'older-out', date: d('2025-02-01'), direction: 'OUT', amountInr: 1000 }),
        move({ id: 'now', direction: 'IN', amountInr: 500 }),
      ],
      accounts,
      PERIOD
    );
    expect(r.accounts[0]?.openingBalance).toBe(6000);
    expect(r.accounts[0]?.receipts).toBe(500);
    expect(r.accounts[0]?.closingBalance).toBe(6500);
  });

  it('excludes movements after the period end', () => {
    const r = computeBankBook(
      [move({ id: 'future', date: d('2027-01-01'), amountInr: 9000 })],
      accounts,
      PERIOD
    );
    expect(r.accounts[0]?.receipts).toBe(0);
    expect(r.accounts[0]?.movements).toHaveLength(0);
  });

  it('lists movements in date order', () => {
    const r = computeBankBook(
      [move({ id: 'late', date: d('2025-09-01') }), move({ id: 'early', date: d('2025-05-01') })],
      accounts,
      PERIOD
    );
    expect(r.accounts[0]?.movements.map((m) => m.id)).toEqual(['early', 'late']);
  });
});

describe('multiple accounts', () => {
  it('keeps each account separate and totals across them', () => {
    const two = new Map([
      ['sbi', acct('sbi')],
      ['cash', { id: 'cash', code: '1101', name: 'Cash in Hand', openingBalance: 500 }],
    ]);
    const r = computeBankBook(
      [
        move({ id: 'a', accountId: 'sbi', direction: 'IN', amountInr: 4000 }),
        move({ id: 'b', accountId: 'cash', direction: 'OUT', amountInr: 100 }),
      ],
      two,
      PERIOD
    );
    expect(r.accounts).toHaveLength(2);
    expect(r.totals).toMatchObject({
      openingBalance: 500,
      receipts: 4000,
      payments: 100,
      closingBalance: 4400,
    });
  });

  it('flags an account id that resolves to no account document', () => {
    const r = computeBankBook([move({ id: 'a', accountId: 'ghost' })], accounts, PERIOD);
    expect(r.unresolvedAccountCount).toBe(1);
    expect(r.accounts[0]?.unresolved).toBe(true);
    expect(r.accounts[0]?.accountName).toContain('ghost');
  });
});

describe('payment method breakdown', () => {
  it('splits receipts and payments by method, largest first', () => {
    const r = computeBankBook(
      [
        move({ id: 'a', paymentMethod: 'UPI', direction: 'IN', amountInr: 100 }),
        move({ id: 'b', paymentMethod: 'CHEQUE', direction: 'OUT', amountInr: 900 }),
        move({ id: 'c', paymentMethod: 'UPI', direction: 'IN', amountInr: 50 }),
      ],
      accounts,
      PERIOD
    );
    const methods = r.accounts[0]?.byMethod ?? [];
    expect(methods[0]).toMatchObject({ method: 'CHEQUE', payments: 900, count: 1 });
    expect(methods[1]).toMatchObject({ method: 'UPI', receipts: 150, count: 2 });
  });

  it('labels a missing method rather than dropping the movement', () => {
    const r = computeBankBook([move({ id: 'a', paymentMethod: '' })], accounts, PERIOD);
    expect(r.accounts[0]?.byMethod[0]?.method).toBe('Unspecified');
  });
});

describe('edge cases', () => {
  it('returns empty totals with no movements', () => {
    const r = computeBankBook([], accounts, PERIOD);
    expect(r.accounts).toHaveLength(0);
    expect(r.totals).toMatchObject({ openingBalance: 0, receipts: 0, closingBalance: 0 });
  });

  it('rounds to paisa rather than accumulating float residue', () => {
    const r = computeBankBook(
      [
        move({ id: 'a', direction: 'IN', amountInr: 0.1 }),
        move({ id: 'b', direction: 'IN', amountInr: 0.2 }),
      ],
      accounts,
      PERIOD
    );
    expect(r.accounts[0]?.receipts).toBe(0.3);
  });
});
