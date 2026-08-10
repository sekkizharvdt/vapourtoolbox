import { computeExpenseAnalysis, priorPeriodOf, type ExpenseLine } from './expenseAnalysis';
import type { TransactionType } from '@vapour/types';

const d = (iso: string) => new Date(iso + 'T00:00:00');
const PERIOD = { startDate: d('2025-04-01'), endDate: d('2026-03-31') };

const line = (over: Partial<ExpenseLine> & { transactionId: string }): ExpenseLine => ({
  reference: 'PAY-1',
  date: d('2025-06-01'),
  type: 'DIRECT_PAYMENT' as TransactionType,
  accountId: 'travel',
  accountName: 'Travel',
  counterparty: 'Indigo',
  projectId: 'p1',
  projectName: 'Thermal Oxidizer',
  amountInr: 1000,
  ...over,
});

describe('totals and breakdowns', () => {
  it('groups by account, largest first, with shares', () => {
    const r = computeExpenseAnalysis(
      [
        line({ transactionId: 'a', accountId: 'travel', accountName: 'Travel', amountInr: 300 }),
        line({ transactionId: 'b', accountId: 'rent', accountName: 'Rent', amountInr: 700 }),
      ],
      PERIOD
    );
    expect(r.total).toBe(1000);
    expect(r.byAccount.map((x) => x.label)).toEqual(['Rent', 'Travel']);
    expect(r.byAccount[0]?.sharePct).toBe(70);
  });

  it('groups the same spend by project and by counterparty too', () => {
    const r = computeExpenseAnalysis(
      [
        line({ transactionId: 'a', projectId: 'p1', projectName: 'Alpha', counterparty: 'X' }),
        line({ transactionId: 'b', projectId: 'p2', projectName: 'Beta', counterparty: 'X' }),
      ],
      PERIOD
    );
    expect(r.byProject).toHaveLength(2);
    expect(r.byCounterparty).toHaveLength(1);
    expect(r.byCounterparty[0]).toMatchObject({ label: 'X', amount: 2000, lineCount: 2 });
  });

  it('buckets unallocated spend rather than dropping it', () => {
    const r = computeExpenseAnalysis(
      [line({ transactionId: 'a', projectId: null, projectName: '(unallocated)' })],
      PERIOD
    );
    expect(r.byProject[0]).toMatchObject({ key: '(unallocated)', amount: 1000 });
  });

  it('counts unclassified lines separately', () => {
    const r = computeExpenseAnalysis(
      [
        line({ transactionId: 'a', accountId: '(unclassified)', accountName: 'Unclassified' }),
        line({ transactionId: 'b' }),
      ],
      PERIOD
    );
    expect(r.unclassifiedLineCount).toBe(1);
    expect(r.lineCount).toBe(2);
  });
});

describe('period filtering and movement', () => {
  it('excludes spend outside the period from the total', () => {
    const r = computeExpenseAnalysis(
      [line({ transactionId: 'a' }), line({ transactionId: 'old', date: d('2024-06-01') })],
      PERIOD
    );
    expect(r.total).toBe(1000);
    expect(r.lineCount).toBe(1);
  });

  it('compares each account against the prior window', () => {
    const r = computeExpenseAnalysis(
      [
        line({ transactionId: 'now', amountInr: 1500 }),
        line({ transactionId: 'then', date: d('2024-06-01'), amountInr: 1000 }),
      ],
      PERIOD
    );
    expect(r.priorTotal).toBe(1000);
    expect(r.byAccount[0]).toMatchObject({ amount: 1500, priorAmount: 1000, changeAmount: 500 });
    expect(r.byAccount[0]?.changePct).toBe(50);
  });

  it('reports a null change for a category that is new this period', () => {
    const r = computeExpenseAnalysis([line({ transactionId: 'a' })], PERIOD);
    expect(r.byAccount[0]?.changePct).toBeNull();
  });

  it('derives the prior window as the equal-length span just before', () => {
    const p = priorPeriodOf(PERIOD);
    expect(p.endDate.getTime()).toBe(PERIOD.startDate.getTime() - 1);
  });
});

describe('trend', () => {
  it('emits every month of the period, including empty ones', () => {
    const r = computeExpenseAnalysis([line({ transactionId: 'a', date: d('2025-05-10') })], {
      startDate: d('2025-04-01'),
      endDate: d('2025-06-30'),
    });
    expect(r.trend.map((t) => t.label)).toEqual(['Apr 2025', 'May 2025', 'Jun 2025']);
    expect(r.trend.map((t) => t.amount)).toEqual([0, 1000, 0]);
  });
});

describe('edge cases', () => {
  it('handles no spend without dividing by zero', () => {
    const r = computeExpenseAnalysis([], PERIOD);
    expect(r).toMatchObject({ total: 0, lineCount: 0, unclassifiedLineCount: 0 });
    expect(r.byAccount).toHaveLength(0);
  });

  it('ignores zero and sub-paisa lines', () => {
    const r = computeExpenseAnalysis(
      [line({ transactionId: 'a', amountInr: 0 }), line({ transactionId: 'b', amountInr: 0.004 })],
      PERIOD
    );
    expect(r.lineCount).toBe(0);
  });

  it('sums several debit legs of one transaction into their own categories', () => {
    const r = computeExpenseAnalysis(
      [
        line({ transactionId: 't1', accountId: 'travel', accountName: 'Travel', amountInr: 400 }),
        line({ transactionId: 't1', accountId: 'meals', accountName: 'Meals', amountInr: 100 }),
      ],
      PERIOD
    );
    expect(r.total).toBe(500);
    expect(r.byAccount.map((x) => x.label)).toEqual(['Travel', 'Meals']);
  });
});
