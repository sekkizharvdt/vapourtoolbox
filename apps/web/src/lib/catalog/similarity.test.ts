import { normalizeName, nameSimilarity, rankByNameSimilarity } from './similarity';

describe('normalizeName', () => {
  it('lowercases, strips punctuation, collapses whitespace', () => {
    expect(normalizeName('BASKET-Type  Strainer!')).toBe('basket type strainer');
    expect(normalizeName('  Y/Type   strainer ')).toBe('y type strainer');
  });
});

describe('nameSimilarity', () => {
  it('is 1 for identical normalized names', () => {
    expect(nameSimilarity('Basket Type Strainer', 'basket-type strainer')).toBe(1);
  });

  it('is 1 when one name contains the other', () => {
    expect(nameSimilarity('Pump', 'Centrifugal Pump')).toBe(1);
  });

  it('catches close variants at/above the default threshold', () => {
    // "control" + "valve" match (2), "motorized"/"motorised" differ → 2/4 = 0.5,
    // which still meets the default 0.5 threshold so it surfaces as a candidate.
    expect(
      nameSimilarity('Motorized Control Valve', 'Motorised Control Valve')
    ).toBeGreaterThanOrEqual(0.5);
  });

  it('is low for unrelated names', () => {
    expect(nameSimilarity('Centrifugal Pump', 'Pressure Gauge')).toBeLessThan(0.5);
  });

  it('returns 0 for empty input', () => {
    expect(nameSimilarity('', 'Pump')).toBe(0);
    expect(nameSimilarity('Pump', '')).toBe(0);
  });
});

describe('rankByNameSimilarity', () => {
  const items = [
    { id: '1', name: 'Basket Type Strainer' },
    { id: '2', name: 'Y Type Strainer' },
    { id: '3', name: 'Centrifugal Pump' },
  ];

  it('returns matches above threshold, highest first', () => {
    const out = rankByNameSimilarity(items, (i) => i.name, 'basket strainer');
    expect(out[0]?.item.id).toBe('1');
    expect(out.every((c) => c.score >= 0.5)).toBe(true);
  });

  it('returns empty when nothing is similar enough', () => {
    expect(rankByNameSimilarity(items, (i) => i.name, 'pressure transmitter')).toEqual([]);
  });

  it('respects the limit', () => {
    const many = Array.from({ length: 10 }, (_, i) => ({ id: String(i), name: 'gate valve' }));
    expect(rankByNameSimilarity(many, (i) => i.name, 'gate valve', { limit: 3 })).toHaveLength(3);
  });
});
