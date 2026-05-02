/**
 * Bought-Out Price Service Tests
 *
 * The price-history service mirrors `materials/pricing.ts` for the
 * bought-out catalog. Tests cover:
 * - addBoughtOutPrice: writes the doc, stamps audit fields, passes through tenantId
 * - getBoughtOutPriceHistory: orders newest-first, applies vendor / date / limit filters
 */

import { Timestamp } from 'firebase/firestore';
import type { BoughtOutPrice } from '@vapour/types';

const mockGetDocs = jest.fn();
const mockAddDoc = jest.fn();

jest.mock('firebase/firestore', () => ({
  collection: jest.fn((_db: unknown, name: string) => ({ collection: name })),
  addDoc: (...args: unknown[]) => mockAddDoc(...args),
  getDocs: (...args: unknown[]) => mockGetDocs(...args),
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
