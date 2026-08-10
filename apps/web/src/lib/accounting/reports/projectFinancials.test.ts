/**
 * Tests for the project financial computation.
 *
 * The first three cases pin the bugs this replaced: double-counting an invoice
 * against its own receipt, summing native-currency face values, and silently
 * excluding types that were nonetheless listed.
 */

import { computeProjectFinancials, type ProjectTransaction } from './projectFinancials';
import type { TransactionType } from '@vapour/types';

const d = (iso: string) => new Date(iso + 'T00:00:00');
const PERIOD = { startDate: d('2025-04-01'), endDate: d('2026-03-31') };
const META = { projectId: 'p1', projectName: 'Thermal Oxidizer' };

const txn = (
  type: TransactionType,
  amountInr: number,
  over: Partial<ProjectTransaction> = {}
): ProjectTransaction => ({
  id: `${type}-${amountInr}-${over.reference ?? ''}`,
  type,
  reference: 'REF',
  date: d('2025-06-01'),
  description: '',
  counterparty: 'Desolenator',
  currency: 'INR',
  nativeAmount: amountInr,
  amountInr,
  ...over,
});

describe('the bugs this replaced', () => {
  it('does not count an invoice and the receipt settling it as revenue twice', () => {
    const r = computeProjectFinancials(
      [txn('CUSTOMER_INVOICE', 100000), txn('CUSTOMER_PAYMENT', 100000)],
      PERIOD,
      META
    );
    expect(r.accrual.revenue).toBe(100000);
    expect(r.cash.receipts).toBe(100000);
  });

  it('does not count a bill and the payment settling it as expense twice', () => {
    const r = computeProjectFinancials(
      [txn('VENDOR_BILL', 40000), txn('VENDOR_PAYMENT', 40000)],
      PERIOD,
      META
    );
    expect(r.accrual.expenses).toBe(40000);
    expect(r.cash.payments).toBe(40000);
  });

  it('uses the INR value, not the native face value, for a forex invoice', () => {
    const r = computeProjectFinancials(
      [txn('CUSTOMER_INVOICE', 528403.28, { currency: 'USD', nativeAmount: 6072.78 })],
      PERIOD,
      META
    );
    expect(r.accrual.revenue).toBe(528403.28);
  });

  it('lists journal entries but keeps them out of both bases', () => {
    const r = computeProjectFinancials(
      [txn('CUSTOMER_INVOICE', 100000), txn('JOURNAL_ENTRY', 5000)],
      PERIOD,
      META
    );
    expect(r.accrual.revenue).toBe(100000);
    expect(r.accrual.expenses).toBe(0);
    expect(r.cash.net).toBe(0);
    expect(r.excludedCount).toBe(1);
    expect(r.excludedTotal).toBe(5000);
    expect(r.groups.some((g) => g.type === 'JOURNAL_ENTRY')).toBe(true);
  });
});

describe('accrual and cash are kept apart', () => {
  it('reports profit from invoices against bills and direct payments', () => {
    const r = computeProjectFinancials(
      [txn('CUSTOMER_INVOICE', 100000), txn('VENDOR_BILL', 30000), txn('DIRECT_PAYMENT', 10000)],
      PERIOD,
      META
    );
    expect(r.accrual).toMatchObject({ revenue: 100000, expenses: 40000, profit: 60000 });
    expect(r.accrual.marginPct).toBe(60);
  });

  it('counts a direct payment as both an expense and an outflow', () => {
    const r = computeProjectFinancials([txn('DIRECT_PAYMENT', 10000)], PERIOD, META);
    expect(r.accrual.expenses).toBe(10000);
    expect(r.cash.payments).toBe(10000);
  });

  it('can show a profitable project that has collected nothing', () => {
    const r = computeProjectFinancials(
      [txn('CUSTOMER_INVOICE', 100000), txn('VENDOR_BILL', 20000)],
      PERIOD,
      META
    );
    expect(r.accrual.profit).toBe(80000);
    expect(r.cash.net).toBe(0);
  });

  it('has a null margin rather than zero when there is no revenue', () => {
    const r = computeProjectFinancials([txn('VENDOR_BILL', 5000)], PERIOD, META);
    expect(r.accrual.marginPct).toBeNull();
  });
});

describe('budget', () => {
  it('reports utilisation and variance against accrual expenses', () => {
    const r = computeProjectFinancials([txn('VENDOR_BILL', 25000)], PERIOD, {
      ...META,
      budget: 100000,
    });
    expect(r.budget).toMatchObject({ amount: 100000, utilisationPct: 25, variance: 75000 });
  });

  it('reports a negative variance on overspend', () => {
    const r = computeProjectFinancials([txn('VENDOR_BILL', 120000)], PERIOD, {
      ...META,
      budget: 100000,
    });
    expect(r.budget.variance).toBe(-20000);
    expect(r.budget.utilisationPct).toBe(120);
  });

  it('is all null when no budget is set', () => {
    const r = computeProjectFinancials([txn('VENDOR_BILL', 5000)], PERIOD, META);
    expect(r.budget).toMatchObject({ amount: null, utilisationPct: null, variance: null });
  });
});

describe('grouping', () => {
  it('groups by type in reading order with a subtotal each', () => {
    const r = computeProjectFinancials(
      [txn('VENDOR_PAYMENT', 5000), txn('CUSTOMER_INVOICE', 100000), txn('VENDOR_BILL', 30000)],
      PERIOD,
      META
    );
    expect(r.groups.map((g) => g.type)).toEqual([
      'CUSTOMER_INVOICE',
      'VENDOR_BILL',
      'VENDOR_PAYMENT',
    ]);
    expect(r.groups[0]?.total).toBe(100000);
  });

  it('omits groups with nothing in them', () => {
    const r = computeProjectFinancials([txn('CUSTOMER_INVOICE', 1000)], PERIOD, META);
    expect(r.groups).toHaveLength(1);
  });

  it('labels what each group feeds, so the listing reconciles to the totals', () => {
    const r = computeProjectFinancials(
      [txn('DIRECT_PAYMENT', 100), txn('JOURNAL_ENTRY', 50)],
      PERIOD,
      META
    );
    expect(r.groups.find((g) => g.type === 'DIRECT_PAYMENT')?.contributesTo).toBe(
      'expense · cash out'
    );
    expect(r.groups.find((g) => g.type === 'JOURNAL_ENTRY')?.contributesTo).toBe('not in totals');
  });

  it('orders transactions within a group by date', () => {
    const r = computeProjectFinancials(
      [
        txn('CUSTOMER_INVOICE', 1, { date: d('2025-09-01'), reference: 'late' }),
        txn('CUSTOMER_INVOICE', 2, { date: d('2025-05-01'), reference: 'early' }),
      ],
      PERIOD,
      META
    );
    expect(r.groups[0]?.transactions.map((t) => t.reference)).toEqual(['early', 'late']);
  });
});

describe('period and edge cases', () => {
  it('excludes transactions outside the period', () => {
    const r = computeProjectFinancials(
      [txn('CUSTOMER_INVOICE', 1000, { date: d('2024-01-01') })],
      PERIOD,
      META
    );
    expect(r.transactionCount).toBe(0);
    expect(r.accrual.revenue).toBe(0);
  });

  it('ignores zero and sub-paisa amounts', () => {
    const r = computeProjectFinancials(
      [txn('CUSTOMER_INVOICE', 0), txn('VENDOR_BILL', 0.004)],
      PERIOD,
      META
    );
    expect(r.transactionCount).toBe(0);
  });

  it('carries the project name through rather than leaving it blank', () => {
    const r = computeProjectFinancials([], PERIOD, META);
    expect(r.projectName).toBe('Thermal Oxidizer');
  });

  it('handles an empty project without dividing by zero', () => {
    const r = computeProjectFinancials([], PERIOD, META);
    expect(r.accrual).toMatchObject({ revenue: 0, expenses: 0, profit: 0, marginPct: null });
    expect(r.groups).toHaveLength(0);
  });
});
