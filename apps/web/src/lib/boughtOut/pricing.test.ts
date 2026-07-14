/**
 * Bought-Out Price Service Tests
 *
 * The price-history service mirrors `materials/pricing.ts` for the
 * bought-out catalog. Tests cover:
 * - addBoughtOutPrice: writes the doc, stamps audit fields, passes through tenantId,
 *   denormalizes the latest active price onto bought_out_items.pricing (A2)
 * - getBoughtOutPriceHistory: orders newest-first, applies vendor / date / limit filters
 */

import { Timestamp } from 'firebase/firestore';
import type { BoughtOutPrice } from '@vapour/types';

const mockGetDocs = jest.fn();
const mockAddDoc = jest.fn();
const mockGetDoc = jest.fn();
const mockUpdateDoc = jest.fn();

jest.mock('firebase/firestore', () => ({
  collection: jest.fn((_db: unknown, name: string) => ({ collection: name })),
  doc: jest.fn((_db: unknown, name: string, id: string) => ({ doc: [name, id] })),
  addDoc: (...args: unknown[]) => mockAddDoc(...args),
  getDoc: (...args: unknown[]) => mockGetDoc(...args),
  getDocs: (...args: unknown[]) => mockGetDocs(...args),
  updateDoc: (...args: unknown[]) => mockUpdateDoc(...args),
  // The denorm path runs in a transaction (rule 19); bridge tx.get/tx.update
  // to the same mocks so the assertions below keep their meaning. tx.update
  // is sync in the real API, so any simulated rejection from mockUpdateDoc
  // is captured and re-awaited here (otherwise Node kills the worker on the
  // unhandled rejection).
  runTransaction: async (_db: unknown, cb: (tx: unknown) => Promise<unknown>) => {
    let pendingUpdate: unknown;
    await cb({
      get: (...args: unknown[]) => mockGetDoc(...args),
      update: (...args: unknown[]) => {
        pendingUpdate = mockUpdateDoc(...args);
      },
    });
    if (pendingUpdate instanceof Promise) await pendingUpdate;
  },
  query: jest.fn((...args: unknown[]) => ({ query: args })),
  where: jest.fn((field: string, op: string, value: unknown) => ({ where: [field, op, value] })),
  orderBy: jest.fn((field: string, dir?: string) => ({ orderBy: [field, dir] })),
  limit: jest.fn((n: number) => ({ limit: n })),
  Timestamp: {
    now: jest.fn(() => ({
      seconds: 1735689600,
      nanoseconds: 0,
      toDate: () => new Date('2025-01-01'),
      toMillis: () => 1735689600000,
    })),
    fromDate: jest.fn((d: Date) => ({
      toDate: () => d,
      toMillis: () => d.getTime(),
      seconds: Math.floor(d.getTime() / 1000),
      nanoseconds: 0,
    })),
  },
}));

jest.mock('@vapour/logger', () => ({
  createLogger: () => ({
    error: jest.fn(),
    warn: jest.fn(),
    info: jest.fn(),
    debug: jest.fn(),
  }),
}));

import {
  addBoughtOutPrice,
  getBoughtOutPriceHistory,
  BOUGHT_OUT_PRICES_COLLECTION,
} from './pricing';

function ts(date: Date): Timestamp {
  const stamp = {
    toDate: () => date,
    toMillis: () => date.getTime(),
    seconds: Math.floor(date.getTime() / 1000),
    nanoseconds: 0,
  };
  return stamp as unknown as Timestamp;
}

beforeEach(() => {
  mockGetDocs.mockReset();
  mockAddDoc.mockReset().mockResolvedValue({ id: 'price-new' });
  // Default: parent item exists with no priced pricing block → denorm proceeds
  mockGetDoc.mockReset().mockResolvedValue({
    exists: () => true,
    data: () => ({ pricing: { listPrice: { amount: 0, currency: 'INR' }, currency: 'INR' } }),
  });
  mockUpdateDoc.mockReset().mockResolvedValue(undefined);
});

// ============================================================================
// addBoughtOutPrice
// ============================================================================

describe('addBoughtOutPrice', () => {
  const baseInput: Omit<
    BoughtOutPrice,
    'id' | 'createdAt' | 'updatedAt' | 'createdBy' | 'updatedBy'
  > = {
    boughtOutItemId: 'bo-1',
    unitPrice: 12500,
    unit: 'NOS',
    currency: 'INR',
    sourceType: 'VENDOR_QUOTE',
    effectiveDate: ts(new Date('2025-01-15')),
    isActive: true,
  };

  it('writes to the bought_out_prices collection', async () => {
    await addBoughtOutPrice({} as never, baseInput, 'user-1');
    expect(mockAddDoc).toHaveBeenCalledTimes(1);
    expect(BOUGHT_OUT_PRICES_COLLECTION).toBe('bought_out_prices');
  });

  it('stamps createdAt / createdBy / updatedAt / updatedBy', async () => {
    await addBoughtOutPrice({} as never, baseInput, 'user-1');
    const written = mockAddDoc.mock.calls[0]?.[1] as {
      createdBy: string;
      updatedBy: string;
      createdAt: unknown;
      updatedAt: unknown;
    };
    expect(written.createdBy).toBe('user-1');
    expect(written.updatedBy).toBe('user-1');
    expect(written.createdAt).toBeDefined();
    expect(written.updatedAt).toBeDefined();
  });

  it('returns the input shape with the generated id', async () => {
    mockAddDoc.mockResolvedValueOnce({ id: 'p-42' });
    const result = await addBoughtOutPrice({} as never, baseInput, 'user-1');
    expect(result.id).toBe('p-42');
    expect(result.boughtOutItemId).toBe('bo-1');
    expect(result.unitPrice).toBe(12500);
  });

  it('passes tenantId through when caller provided one', async () => {
    await addBoughtOutPrice({} as never, { ...baseInput, tenantId: 'tenant-9' }, 'user-1');
    const written = mockAddDoc.mock.calls[0]?.[1] as { tenantId?: string };
    expect(written.tenantId).toBe('tenant-9');
  });

  it('does NOT fabricate a tenantId when none was provided', async () => {
    await addBoughtOutPrice({} as never, baseInput, 'user-1');
    const written = mockAddDoc.mock.calls[0]?.[1] as { tenantId?: string };
    expect(written.tenantId).toBeUndefined();
  });

  it('preserves vendor / source linkage fields', async () => {
    await addBoughtOutPrice(
      {} as never,
      {
        ...baseInput,
        vendorId: 'v-1',
        vendorName: 'Acme',
        documentReference: 'Q-2025-0001',
        sourceQuoteId: 'q-1',
        sourceQuoteItemId: 'qi-1',
      },
      'user-1'
    );
    const written = mockAddDoc.mock.calls[0]?.[1] as {
      vendorId: string;
      vendorName: string;
      documentReference: string;
      sourceQuoteId: string;
      sourceQuoteItemId: string;
    };
    expect(written.vendorId).toBe('v-1');
    expect(written.vendorName).toBe('Acme');
    expect(written.documentReference).toBe('Q-2025-0001');
    expect(written.sourceQuoteId).toBe('q-1');
    expect(written.sourceQuoteItemId).toBe('qi-1');
  });

  it('denormalizes an active price onto the parent bought_out_items pricing block', async () => {
    await addBoughtOutPrice({} as never, baseInput, 'user-1');
    expect(mockUpdateDoc).toHaveBeenCalledTimes(1);
    const written = mockUpdateDoc.mock.calls[0]?.[1] as Record<string, unknown>;
    expect(written['pricing.listPrice']).toEqual({ amount: 12500, currency: 'INR' });
    expect(written['pricing.currency']).toBe('INR');
    expect(written['pricing.effectiveDate']).toBe(baseInput.effectiveDate);
    expect(written['pricing.lastUpdated']).toBeDefined();
    expect(written.updatedBy).toBe('user-1');
    // Dot-path update — must NOT replace the whole pricing map (would drop leadTime/moq)
    expect(written.pricing).toBeUndefined();
  });

  it('does NOT denormalize an inactive (budgetary/forecast) price', async () => {
    await addBoughtOutPrice({} as never, { ...baseInput, isActive: false }, 'user-1');
    expect(mockUpdateDoc).not.toHaveBeenCalled();
    // History row is still written
    expect(mockAddDoc).toHaveBeenCalledTimes(1);
  });

  it('does NOT overwrite a newer current price with an older-dated one', async () => {
    mockGetDoc.mockResolvedValueOnce({
      exists: () => true,
      data: () => ({
        pricing: {
          listPrice: { amount: 99999, currency: 'INR' },
          currency: 'INR',
          effectiveDate: ts(new Date('2025-06-01')), // newer than the incoming 2025-01-15
        },
      }),
    });
    await addBoughtOutPrice({} as never, baseInput, 'user-1');
    expect(mockUpdateDoc).not.toHaveBeenCalled();
  });

  it('still returns the history row when the parent item is missing (denorm skipped)', async () => {
    mockGetDoc.mockResolvedValueOnce({ exists: () => false });
    const result = await addBoughtOutPrice({} as never, baseInput, 'user-1');
    expect(result.id).toBe('price-new');
    expect(mockUpdateDoc).not.toHaveBeenCalled();
  });

  it('does not throw when the denorm update fails (history row already written)', async () => {
    mockUpdateDoc.mockRejectedValueOnce(new Error('permission-denied'));
    await expect(addBoughtOutPrice({} as never, baseInput, 'user-1')).resolves.toMatchObject({
      boughtOutItemId: 'bo-1',
    });
  });

  it('handles each PriceSourceType value', async () => {
    const sourceTypes: BoughtOutPrice['sourceType'][] = [
      'VENDOR_QUOTE',
      'VENDOR_INVOICE',
      'CONTRACT_RATE',
      'MARKET_RATE',
      'MANUAL',
    ];
    for (const sourceType of sourceTypes) {
      mockAddDoc.mockResolvedValueOnce({ id: `p-${sourceType}` });
      const result = await addBoughtOutPrice({} as never, { ...baseInput, sourceType }, 'user-1');
      expect(result.sourceType).toBe(sourceType);
    }
    expect(mockAddDoc).toHaveBeenCalledTimes(sourceTypes.length);
  });
});

// ============================================================================
// getBoughtOutPriceHistory
// ============================================================================

describe('getBoughtOutPriceHistory', () => {
  function priceDoc(overrides: Partial<BoughtOutPrice> & { id: string }) {
    const { id, ...rest } = overrides;
    const data: BoughtOutPrice = {
      id,
      boughtOutItemId: 'bo-1',
      unitPrice: 100,
      unit: 'NOS',
      currency: 'INR',
      sourceType: 'VENDOR_QUOTE',
      effectiveDate: ts(new Date('2025-01-01')),
      isActive: true,
      createdAt: ts(new Date('2025-01-01')),
      createdBy: 'user-1',
      updatedAt: ts(new Date('2025-01-01')),
      updatedBy: 'user-1',
      ...rest,
    };
    return { id: data.id, data: () => data };
  }

  it('returns mapped docs in the order Firestore yielded them', async () => {
    mockGetDocs.mockResolvedValueOnce({
      docs: [
        priceDoc({ id: 'p-2', effectiveDate: ts(new Date('2025-06-01')) }),
        priceDoc({ id: 'p-1', effectiveDate: ts(new Date('2025-01-01')) }),
      ],
    });
    const result = await getBoughtOutPriceHistory({} as never, 'bo-1');
    expect(result.map((p) => p.id)).toEqual(['p-2', 'p-1']);
  });

  it('returns empty array when no prices exist for the item', async () => {
    mockGetDocs.mockResolvedValueOnce({ docs: [] });
    expect(await getBoughtOutPriceHistory({} as never, 'bo-1')).toEqual([]);
  });

  it('filters by vendorId when given', async () => {
    mockGetDocs.mockResolvedValueOnce({ docs: [] });
    await getBoughtOutPriceHistory({} as never, 'bo-1', { vendorId: 'v-7' });
    const { where } = jest.requireMock('firebase/firestore') as { where: jest.Mock };
    const fields = where.mock.calls.map((c: unknown[]) => c[0]);
    expect(fields).toContain('boughtOutItemId');
    expect(fields).toContain('vendorId');
  });

  it('filters out prices before startDate (client-side)', async () => {
    mockGetDocs.mockResolvedValueOnce({
      docs: [
        priceDoc({ id: 'p-old', effectiveDate: ts(new Date('2024-12-01')) }),
        priceDoc({ id: 'p-new', effectiveDate: ts(new Date('2025-06-01')) }),
      ],
    });
    const result = await getBoughtOutPriceHistory({} as never, 'bo-1', {
      startDate: new Date('2025-01-01'),
    });
    expect(result.map((p) => p.id)).toEqual(['p-new']);
  });

  it('filters out prices after endDate (client-side)', async () => {
    mockGetDocs.mockResolvedValueOnce({
      docs: [
        priceDoc({ id: 'p-2024', effectiveDate: ts(new Date('2024-06-01')) }),
        priceDoc({ id: 'p-2025', effectiveDate: ts(new Date('2025-06-01')) }),
      ],
    });
    const result = await getBoughtOutPriceHistory({} as never, 'bo-1', {
      endDate: new Date('2024-12-31'),
    });
    expect(result.map((p) => p.id)).toEqual(['p-2024']);
  });

  it('applies the limit constraint when given', async () => {
    mockGetDocs.mockResolvedValueOnce({ docs: [] });
    await getBoughtOutPriceHistory({} as never, 'bo-1', { limitResults: 5 });
    const { limit } = jest.requireMock('firebase/firestore') as { limit: jest.Mock };
    expect(limit).toHaveBeenCalledWith(5);
  });

  it('always orders by effectiveDate desc', async () => {
    mockGetDocs.mockResolvedValueOnce({ docs: [] });
    await getBoughtOutPriceHistory({} as never, 'bo-1');
    const { orderBy } = jest.requireMock('firebase/firestore') as { orderBy: jest.Mock };
    const orderByCalls = orderBy.mock.calls;
    expect(orderByCalls.some((c: unknown[]) => c[0] === 'effectiveDate' && c[1] === 'desc')).toBe(
      true
    );
  });
});
