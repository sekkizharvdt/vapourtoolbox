/**
 * Tests for the receivables performance computation.
 *
 * The fetch layer is thin; the risk lives in the maths — amount-weighted
 * collection speed, ageing bands, and keeping paisa rounding honest. Outstanding
 * itself is supplied by the canonical `deriveOutstanding` helper, so these tests
 * assert how it is bucketed and attributed, not how it is derived.
 */

import {
  computeReceivablesPerformance,
  type ReceivableInvoice,
  type ReceivableSettlement,
} from './receivablesPerformance';

const d = (iso: string) => new Date(iso + 'T00:00:00');

const PERIOD = { startDate: d('2025-04-01'), endDate: d('2026-03-31') };
/** Pin the ageing reference so tests do not drift with the wall clock. */
const AS_OF = d('2026-03-31');

function invoice(over: Partial<ReceivableInvoice> & { id: string }): ReceivableInvoice {
  const base = {
    entityId: 'cust-a',
    entityName: 'Customer A',
    invoiceNumber: 'INV-' + over.id,
    invoiceDate: d('2025-04-10'),
    dueDate: d('2025-05-10') as Date | null,
    totalInr: 100000,
    ...over,
  };
  return { ...base, outstandingInr: over.outstandingInr ?? base.totalInr };
}

const run = (
  invoices: ReceivableInvoice[],
  settlements: ReceivableSettlement[] = [],
  period = PERIOD,
  options: Parameters<typeof computeReceivablesPerformance>[3] = {}
) => computeReceivablesPerformance(invoices, settlements, period, { asOf: AS_OF, ...options });

describe('outstanding attribution', () => {
  it('totals the canonical outstanding rather than re-deriving it', () => {
    const r = run([invoice({ id: 'i1', totalInr: 100000, outstandingInr: 40000 })]);
    expect(r.headline.closingReceivables).toBe(40000);
  });

  it('drops invoices settled to within a paisa', () => {
    const r = run([invoice({ id: 'i1', outstandingInr: 0.004 })]);
    expect(r.headline.closingReceivables).toBe(0);
    expect(r.aging.every((b) => b.count === 0)).toBe(true);
  });

  it('still counts a fully settled invoice as credit sales for the period', () => {
    const r = run([invoice({ id: 'i1', totalInr: 100000, outstandingInr: 0 })]);
    expect(r.headline.creditSales).toBe(100000);
    expect(r.headline.closingReceivables).toBe(0);
  });
});

describe('DSO', () => {
  it('scales outstanding by credit sales over the period length', () => {
    const r = run([invoice({ id: 'i1', totalInr: 400000, outstandingInr: 100000 })]);
    expect(r.headline.creditSales).toBe(400000);
    expect(r.headline.daysInPeriod).toBe(365);
    expect(r.headline.dso).toBe(91);
  });

  it('is null rather than zero when there were no credit sales in the period', () => {
    const r = run([invoice({ id: 'i1', invoiceDate: d('2024-01-01') })]);
    expect(r.headline.creditSales).toBe(0);
    expect(r.headline.dso).toBeNull();
  });
});

describe('collection speed', () => {
  it('weights days-to-collect by amount, not by invoice count', () => {
    const invoices = [
      invoice({ id: 'small', totalInr: 10000, invoiceDate: d('2025-04-01') }),
      invoice({ id: 'large', totalInr: 90000, invoiceDate: d('2025-04-01') }),
    ];
    const settlements: ReceivableSettlement[] = [
      { invoiceId: 'small', paymentDate: d('2025-04-11'), amountInr: 10000 }, // 10 days
      { invoiceId: 'large', paymentDate: d('2025-05-01'), amountInr: 90000 }, // 30 days
    ];
    const r = run(invoices, settlements);
    // Unweighted mean would be 20; weighted is (10*10000 + 30*90000)/100000 = 28
    expect(r.headline.avgDaysToCollect).toBe(28);
    expect(r.headline.medianDaysToCollect).toBe(20);
  });

  it('splits on-time rate by amount and by count independently', () => {
    const invoices = [
      invoice({ id: 'a', totalInr: 90000, dueDate: d('2025-05-10') }),
      invoice({ id: 'b', totalInr: 10000, dueDate: d('2025-05-10') }),
    ];
    const settlements: ReceivableSettlement[] = [
      { invoiceId: 'a', paymentDate: d('2025-05-01'), amountInr: 90000 }, // on time
      { invoiceId: 'b', paymentDate: d('2025-06-01'), amountInr: 10000 }, // late
    ];
    const r = run(invoices, settlements);
    expect(r.headline.onTimePctByAmount).toBe(90);
    expect(r.headline.onTimePctByCount).toBe(50);
  });

  it('excludes invoices without a due date from the on-time rate but not from speed', () => {
    const settlements: ReceivableSettlement[] = [
      { invoiceId: 'a', paymentDate: d('2025-06-01'), amountInr: 100000 },
    ];
    const r = run([invoice({ id: 'a', dueDate: null })], settlements);
    expect(r.headline.onTimePctByAmount).toBeNull();
    expect(r.headline.onTimePctByCount).toBeNull();
    expect(r.headline.avgDaysToCollect).not.toBeNull();
  });

  it('ignores settlements outside the period', () => {
    const settlements: ReceivableSettlement[] = [
      { invoiceId: 'a', paymentDate: d('2027-01-01'), amountInr: 100000 },
    ];
    const r = run([invoice({ id: 'a' })], settlements);
    expect(r.headline.collectedInPeriod).toBe(0);
    expect(r.headline.avgDaysToCollect).toBeNull();
  });
});

describe('ageing', () => {
  it('separates not-yet-due from overdue rather than lumping them together', () => {
    const invoices = [
      invoice({ id: 'future', dueDate: d('2026-06-01') }),
      invoice({ id: 'late', dueDate: d('2026-03-01') }), // 30 days before AS_OF
    ];
    const r = run(invoices);
    const byLabel = Object.fromEntries(r.aging.map((b) => [b.label, b]));
    expect(byLabel['Not yet due']?.amount).toBe(100000);
    expect(byLabel['Overdue 1–30 days']?.amount).toBe(100000);
    expect(r.headline.overdueAmount).toBe(100000);
    expect(r.headline.overduePct).toBe(50);
  });

  it('places a due-today invoice in not-yet-due, not in arrears', () => {
    const r = run([invoice({ id: 'x', dueDate: AS_OF })]);
    expect(r.aging[0]?.label).toBe('Not yet due');
    expect(r.aging[0]?.count).toBe(1);
    expect(r.headline.overdueAmount).toBe(0);
  });

  it('buckets by age band boundaries', () => {
    const invoices = [
      invoice({ id: 'b31', dueDate: d('2026-02-01') }), // 58 days
      invoice({ id: 'b91', dueDate: d('2025-10-01') }), // 181 days
    ];
    const r = run(invoices);
    const byLabel = Object.fromEntries(r.aging.map((b) => [b.label, b]));
    expect(byLabel['Overdue 31–60 days']?.count).toBe(1);
    expect(byLabel['Overdue over 90 days']?.count).toBe(1);
  });

  it('buckets an invoice with no due date as not yet due and flags it', () => {
    const r = run([invoice({ id: 'x', dueDate: null })]);
    expect(r.aging[0]?.amount).toBe(100000);
    expect(r.dataNotes.invoicesWithoutDueDate).toBe(1);
  });
});

describe('per-customer rows', () => {
  it('aggregates invoiced, collected and outstanding per counterparty', () => {
    const invoices = [
      invoice({ id: 'a1', entityId: 'A', entityName: 'Alpha', outstandingInr: 70000 }),
      invoice({ id: 'b1', entityId: 'B', entityName: 'Beta', totalInr: 50000 }),
    ];
    const settlements: ReceivableSettlement[] = [
      { invoiceId: 'a1', paymentDate: d('2025-05-01'), amountInr: 30000 },
    ];
    const r = run(invoices, settlements);
    expect(r.customers.find((c) => c.entityId === 'A')).toMatchObject({
      invoiced: 100000,
      collected: 30000,
      outstanding: 70000,
    });
    expect(r.customers.find((c) => c.entityId === 'B')).toMatchObject({
      collected: 0,
      outstanding: 50000,
    });
  });

  it('sorts the worst exposure first', () => {
    const r = run([
      invoice({ id: 'a1', entityId: 'A', totalInr: 10000 }),
      invoice({ id: 'b1', entityId: 'B', totalInr: 90000 }),
    ]);
    expect(r.customers[0]?.entityId).toBe('B');
  });

  it('records the oldest arrears per customer', () => {
    const r = run([
      invoice({ id: 'a1', entityId: 'A', dueDate: d('2026-03-01') }),
      invoice({ id: 'a2', entityId: 'A', dueDate: d('2025-12-01') }),
    ]);
    expect(r.customers[0]?.oldestOverdueDays).toBe(120);
  });
});

describe('data integrity notes', () => {
  it('counts settlements pointing at an unknown invoice', () => {
    const settlements: ReceivableSettlement[] = [
      { invoiceId: 'ghost', paymentDate: d('2025-05-01'), amountInr: 5000 },
    ];
    const r = run([invoice({ id: 'i1' })], settlements);
    expect(r.dataNotes.unmatchedSettlements).toBe(1);
    expect(r.headline.collectedInPeriod).toBe(0);
  });

  it('flags an invoice whose allocations do not reconcile with amountPaid', () => {
    const settlements: ReceivableSettlement[] = [
      { invoiceId: 'i1', paymentDate: d('2025-05-01'), amountInr: 40000 },
    ];
    const r = run([invoice({ id: 'i1' })], settlements, PERIOD, {
      storedPaidByInvoice: new Map([['i1', 55000]]),
    });
    expect(r.dataNotes.allocationReconciliationGaps).toBe(1);
  });

  it('does not flag agreement within a paisa', () => {
    const settlements: ReceivableSettlement[] = [
      { invoiceId: 'i1', paymentDate: d('2025-05-01'), amountInr: 40000 },
    ];
    const r = run([invoice({ id: 'i1' })], settlements, PERIOD, {
      storedPaidByInvoice: new Map([['i1', 40000.005]]),
    });
    expect(r.dataNotes.allocationReconciliationGaps).toBe(0);
  });

  it('warns when the ageing post-dates the requested period', () => {
    const past = { startDate: d('2024-04-01'), endDate: d('2025-03-31') };
    expect(run([invoice({ id: 'i1' })], [], past).dataNotes.asOfIsAfterPeriodEnd).toBe(true);
    expect(run([invoice({ id: 'i1' })]).dataNotes.asOfIsAfterPeriodEnd).toBe(false);
  });
});

describe('trend', () => {
  it('emits one point per month of the period', () => {
    const r = run([invoice({ id: 'i1' })], [], {
      startDate: d('2025-04-01'),
      endDate: d('2025-06-30'),
    });
    expect(r.trend.map((t) => t.label)).toEqual(['Apr 2025', 'May 2025', 'Jun 2025']);
  });

  it('reports invoiced against collected, and the net movement', () => {
    const settlements: ReceivableSettlement[] = [
      { invoiceId: 'i1', paymentDate: d('2025-05-15'), amountInr: 60000 },
    ];
    const r = run([invoice({ id: 'i1' })], settlements, {
      startDate: d('2025-04-01'),
      endDate: d('2025-06-30'),
    });
    expect(r.trend.map((t) => t.invoiced)).toEqual([100000, 0, 0]);
    expect(r.trend.map((t) => t.collected)).toEqual([0, 60000, 0]);
    expect(r.trend.map((t) => t.net)).toEqual([100000, -60000, 0]);
  });
});
