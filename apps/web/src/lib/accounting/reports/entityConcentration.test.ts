import {
  computeConcentrationSide,
  computeEntityConcentration,
  priorPeriodOf,
  type ConcentrationDoc,
} from './entityConcentration';

const d = (iso: string) => new Date(iso + 'T00:00:00');
const PERIOD = { startDate: d('2025-04-01'), endDate: d('2026-03-31') };
const PRIOR = priorPeriodOf(PERIOD);

const doc = (entityId: string, amountInr: number, date = d('2025-06-01')): ConcentrationDoc => ({
  entityId,
  entityName: entityId.toUpperCase(),
  date,
  amountInr,
});

const side = (docs: ConcentrationDoc[]) =>
  computeConcentrationSide('CUSTOMER', docs, PERIOD, PRIOR);

describe('priorPeriodOf', () => {
  it('returns an equal-length window ending just before the period starts', () => {
    const p = priorPeriodOf({ startDate: d('2025-04-01'), endDate: d('2025-06-30') });
    expect(p.endDate.getTime()).toBe(d('2025-04-01').getTime() - 1);
    expect(p.endDate.getTime() - p.startDate.getTime()).toBe(
      d('2025-06-30').getTime() - d('2025-04-01').getTime()
    );
  });
});

describe('ranking and shares', () => {
  it('orders counterparties by size and accumulates share', () => {
    const s = side([doc('a', 60), doc('b', 30), doc('c', 10)]);
    expect(s.rows.map((r) => r.entityId)).toEqual(['a', 'b', 'c']);
    expect(s.rows.map((r) => r.sharePct)).toEqual([60, 30, 10]);
    expect(s.rows.map((r) => r.cumulativePct)).toEqual([60, 90, 100]);
  });

  it('aggregates several documents for the same counterparty', () => {
    const s = side([doc('a', 40), doc('a', 20), doc('b', 40)]);
    expect(s.rows[0]).toMatchObject({ entityId: 'a', amount: 60, documentCount: 2 });
    expect(s.counterpartyCount).toBe(2);
    expect(s.documentCount).toBe(3);
  });

  it('reports top-N concentration', () => {
    const s = side([doc('a', 50), doc('b', 30), doc('c', 15), doc('d', 5)]);
    expect(s.top1Pct).toBe(50);
    expect(s.top3Pct).toBe(95);
    expect(s.top5Pct).toBe(100);
  });

  it('counts how many counterparties make up half the total', () => {
    expect(side([doc('a', 60), doc('b', 40)]).countToHalf).toBe(1);
    expect(side([doc('a', 30), doc('b', 30), doc('c', 40)]).countToHalf).toBe(2);
  });
});

describe('Herfindahl index', () => {
  it('is 10000 for a single counterparty', () => {
    expect(side([doc('a', 100)]).hhi).toBe(10000);
  });

  it('falls as revenue spreads across more names', () => {
    const two = side([doc('a', 50), doc('b', 50)]).hhi;
    const four = side([doc('a', 25), doc('b', 25), doc('c', 25), doc('d', 25)]).hhi;
    expect(two).toBe(5000);
    expect(four).toBe(2500);
    expect(four).toBeLessThan(two);
  });

  it('separates a lopsided book from an even one at the same top-5 share', () => {
    const even = side([doc('a', 20), doc('b', 20), doc('c', 20), doc('d', 20), doc('e', 20)]);
    const skewed = side([doc('a', 80), doc('b', 5), doc('c', 5), doc('d', 5), doc('e', 5)]);
    expect(even.top5Pct).toBe(skewed.top5Pct);
    expect(skewed.hhi).toBeGreaterThan(even.hhi);
  });
});

describe('period movement', () => {
  it('compares against the same counterparty in the prior window', () => {
    const s = side([doc('a', 150), doc('a', 0.005), doc('a', 100, d('2024-06-01'))]);
    expect(s.rows[0]).toMatchObject({ amount: 150, priorAmount: 100, changeAmount: 50 });
    expect(s.rows[0]?.changePct).toBe(50);
  });

  it('reports a null change for a counterparty that is new this period', () => {
    const s = side([doc('a', 100)]);
    expect(s.rows[0]?.priorAmount).toBe(0);
    expect(s.rows[0]?.changePct).toBeNull();
  });

  it('excludes prior-period documents from the current total', () => {
    const s = side([doc('a', 100), doc('b', 500, d('2024-06-01'))]);
    expect(s.total).toBe(100);
    expect(s.priorTotal).toBe(500);
    expect(s.counterpartyCount).toBe(1);
  });
});

describe('edge cases', () => {
  it('handles an empty side without dividing by zero', () => {
    const s = side([]);
    expect(s).toMatchObject({ total: 0, counterpartyCount: 0, hhi: 0, top5Pct: 0, countToHalf: 0 });
  });

  it('ignores zero and sub-paisa amounts', () => {
    const s = side([doc('a', 100), doc('b', 0), doc('c', 0.004)]);
    expect(s.counterpartyCount).toBe(1);
  });

  it('falls back to the id when a counterparty has no name', () => {
    const s = side([{ entityId: 'x', entityName: '', date: d('2025-06-01'), amountInr: 10 }]);
    expect(s.rows[0]?.entityName).toBe('x');
  });
});

describe('report assembly', () => {
  it('computes both sides against the same windows', () => {
    const r = computeEntityConcentration([doc('cust', 100)], [doc('vend', 40)], PERIOD);
    expect(r.customers.kind).toBe('CUSTOMER');
    expect(r.vendors.kind).toBe('VENDOR');
    expect(r.customers.total).toBe(100);
    expect(r.vendors.total).toBe(40);
    expect(r.priorEndDate.getTime()).toBe(PERIOD.startDate.getTime() - 1);
  });
});
