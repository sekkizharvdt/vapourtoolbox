import { computeFxExposure, type FxTransaction } from './fxExposure';
import type { TransactionType } from '@vapour/types';

const d = (iso: string) => new Date(iso + 'T00:00:00');
const PERIOD = { startDate: d('2025-04-01'), endDate: d('2026-03-31') };

const txn = (over: Partial<FxTransaction> & { id: string }): FxTransaction => ({
  type: 'CUSTOMER_INVOICE' as TransactionType,
  reference: 'INV-' + over.id,
  date: d('2025-06-01'),
  counterparty: 'Desolenator',
  currency: 'USD',
  foreignAmount: 1000,
  inrAmount: 84000,
  exchangeRate: 84,
  openInr: 0,
  side: 'RECEIVABLE',
  hasSettlementData: false,
  ...over,
});

describe('grouping by currency', () => {
  it('separates currencies and orders by INR value', () => {
    const r = computeFxExposure(
      [
        txn({ id: 'a', currency: 'EUR', inrAmount: 10000, foreignAmount: 100 }),
        txn({ id: 'b', currency: 'USD', inrAmount: 90000, foreignAmount: 1000 }),
      ],
      PERIOD
    );
    expect(r.currencies.map((c) => c.currency)).toEqual(['USD', 'EUR']);
    expect(r.totals.inrTotal).toBe(100000);
    expect(r.totals.transactionCount).toBe(2);
  });

  it('excludes transactions outside the period', () => {
    const r = computeFxExposure([txn({ id: 'old', date: d('2024-01-01') })], PERIOD);
    expect(r.currencies).toHaveLength(0);
    expect(r.totals.transactionCount).toBe(0);
  });
});

describe('effective rate', () => {
  it('weights the rate by INR value rather than averaging the rates', () => {
    const r = computeFxExposure(
      [
        txn({ id: 'small', foreignAmount: 100, inrAmount: 8000, exchangeRate: 80 }),
        txn({ id: 'large', foreignAmount: 900, inrAmount: 81000, exchangeRate: 90 }),
      ],
      PERIOD
    );
    // Plain mean of the rates is 85; value-weighted is 89000/1000 = 89
    expect(r.currencies[0]?.weightedRate).toBe(89);
  });

  it('reports the booking-rate spread as a risk proxy', () => {
    const r = computeFxExposure(
      [txn({ id: 'a', exchangeRate: 80 }), txn({ id: 'b', exchangeRate: 88 })],
      PERIOD
    );
    expect(r.currencies[0]?.minRate).toBe(80);
    expect(r.currencies[0]?.maxRate).toBe(88);
    expect(r.currencies[0]?.rateSpreadPct).toBe(10);
  });

  it('has no spread with a single rate', () => {
    const r = computeFxExposure([txn({ id: 'a', exchangeRate: 84 })], PERIOD);
    expect(r.currencies[0]?.rateSpreadPct).toBeNull();
  });
});

describe('open exposure', () => {
  it('nets receivables against payables per currency', () => {
    const r = computeFxExposure(
      [
        txn({ id: 'inv', side: 'RECEIVABLE', openInr: 50000 }),
        txn({
          id: 'bill',
          side: 'PAYABLE',
          openInr: 20000,
          type: 'VENDOR_BILL' as TransactionType,
        }),
      ],
      PERIOD
    );
    expect(r.currencies[0]).toMatchObject({
      openReceivableInr: 50000,
      openPayableInr: 20000,
      netOpenInr: 30000,
    });
  });

  it('ignores open amounts on types that carry no balance', () => {
    const r = computeFxExposure(
      [
        txn({
          id: 'pay',
          side: 'NONE',
          openInr: 9999,
          type: 'CUSTOMER_PAYMENT' as TransactionType,
        }),
      ],
      PERIOD
    );
    expect(r.totals.netOpenInr).toBe(0);
  });
});

describe('settlement coverage', () => {
  it('reports zero coverage when no transaction carries settlement data', () => {
    const r = computeFxExposure([txn({ id: 'a' }), txn({ id: 'b' })], PERIOD);
    expect(r.settlementCoverage).toEqual({ withSettlementData: 0, total: 2 });
  });

  it('counts the transactions that do carry it', () => {
    const r = computeFxExposure(
      [txn({ id: 'a', hasSettlementData: true }), txn({ id: 'b' })],
      PERIOD
    );
    expect(r.settlementCoverage).toEqual({ withSettlementData: 1, total: 2 });
  });
});

describe('edge cases', () => {
  it('returns empty totals with no foreign-currency activity', () => {
    const r = computeFxExposure([], PERIOD);
    expect(r.currencies).toHaveLength(0);
    expect(r.totals).toMatchObject({ inrTotal: 0, netOpenInr: 0 });
    expect(r.settlementCoverage.total).toBe(0);
  });

  it('does not divide by zero when a foreign amount is missing', () => {
    const r = computeFxExposure([txn({ id: 'a', foreignAmount: 0, exchangeRate: null })], PERIOD);
    expect(r.currencies[0]?.weightedRate).toBeNull();
    expect(r.currencies[0]?.rateSpreadPct).toBeNull();
  });

  it('lists transactions newest first', () => {
    const r = computeFxExposure(
      [txn({ id: 'old', date: d('2025-05-01') }), txn({ id: 'new', date: d('2025-09-01') })],
      PERIOD
    );
    expect(r.transactions.map((t) => t.id)).toEqual(['new', 'old']);
  });
});
