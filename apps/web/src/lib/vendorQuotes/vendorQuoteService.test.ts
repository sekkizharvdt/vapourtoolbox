/**
 * Vendor Quote Service Tests
 *
 * Tests for the unified vendor-quote CRUD layer:
 * - createVendorQuote (number generation, batched item writes, totals)
 * - listVendorQuotes / getVendorQuoteById / getVendorQuoteItems
 * - addVendorQuoteItem / updateVendorQuoteItem / removeVendorQuoteItem
 *   (recalcs parent totals after every mutation)
 * - updateVendorQuote (terms, dates, status passthrough)
 * - acceptQuoteItemPrice (4 paths: MATERIAL, SERVICE, BOUGHT_OUT, NOTE)
 * - Reverse lookups for material / service / bought-out detail pages
 *
 * Authorization: every mutating function calls requirePermission with
 * MANAGE_PROCUREMENT — the assertions below verify the call was made
 * with the right flag, not that the auth library itself enforces it.
 */

import { Timestamp } from 'firebase/firestore';
import { PERMISSION_FLAGS } from '@vapour/constants';
import type { VendorQuote, VendorQuoteItem } from '@vapour/types';

// ============================================================================
// Mocks
// ============================================================================

const mockGetDoc = jest.fn();
const mockGetDocs = jest.fn();
const mockUpdateDoc = jest.fn();
const mockAddDoc = jest.fn();
const mockDeleteDoc = jest.fn();

// writeBatch returns an object with .set / .update / .commit; we collect
// the writes so individual tests can assert what got staged.
const batchSets: Array<{ ref: unknown; data: unknown }> = [];
const batchUpdates: Array<{ ref: unknown; data: unknown }> = [];
const mockWriteBatch = jest.fn((..._args: unknown[]) => ({
  set: (ref: unknown, data: unknown) => batchSets.push({ ref, data }),
  update: (ref: unknown, data: unknown) => batchUpdates.push({ ref, data }),
  commit: jest.fn().mockResolvedValue(undefined),
}));

jest.mock('firebase/firestore', () => ({
  collection: jest.fn((_db: unknown, name: string) => ({ collection: name })),
  doc: jest.fn((_db: unknown, name: string, id?: string) => ({ doc: name, id: id ?? 'auto' })),
  getDoc: (...args: unknown[]) => mockGetDoc(...args),
  getDocs: (...args: unknown[]) => mockGetDocs(...args),
  updateDoc: (...args: unknown[]) => mockUpdateDoc(...args),
  addDoc: (...args: unknown[]) => mockAddDoc(...args),
  deleteDoc: (...args: unknown[]) => mockDeleteDoc(...args),
  writeBatch: (...args: unknown[]) => mockWriteBatch(...args),
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
    fromDate: jest.fn((date: Date) => ({
      toDate: () => date,
      seconds: Math.floor(date.getTime() / 1000),
      nanoseconds: 0,
      toMillis: () => date.getTime(),
    })),
  },
}));

jest.mock('@vapour/firebase', () => ({
  COLLECTIONS: {
    VENDOR_QUOTES: 'vendorQuotes',
    VENDOR_QUOTE_ITEMS: 'vendorQuoteItems',
    SERVICE_RATES: 'serviceRates',
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

const mockRequirePermission = jest.fn();
jest.mock('@/lib/auth', () => ({
  requirePermission: (...args: unknown[]) => mockRequirePermission(...args),
}));

const mockAddMaterialPrice = jest.fn().mockResolvedValue({ id: 'price-1' });
jest.mock('@/lib/materials/pricing', () => ({
  addMaterialPrice: (...args: unknown[]) => mockAddMaterialPrice(...args),
}));

const mockUpdateBoughtOutItem = jest.fn().mockResolvedValue(undefined);
jest.mock('@/lib/boughtOut/boughtOutService', () => ({
  updateBoughtOutItem: (...args: unknown[]) => mockUpdateBoughtOutItem(...args),
}));

const mockAddBoughtOutPrice = jest.fn().mockResolvedValue({ id: 'bo-price-1' });
jest.mock('@/lib/boughtOut/pricing', () => ({
  addBoughtOutPrice: (...args: unknown[]) => mockAddBoughtOutPrice(...args),
}));

// Import after mocks
import {
  createVendorQuote,
  listVendorQuotes,
  getVendorQuoteById,
  getVendorQuoteItems,
  addVendorQuoteItem,
  updateVendorQuoteItem,
  removeVendorQuoteItem,
  updateVendorQuote,
  acceptQuoteItemPrice,
  getQuotesByMaterialId,
  getQuotesByServiceId,
  getQuotesByBoughtOutItemId,
  getQuoteRowsByMaterialId,
  getQuoteRowsByBoughtOutItemId,
  type CreateVendorQuoteInput,
  type CreateVendorQuoteItemInput,
} from './vendorQuoteService';

// ============================================================================
// Fixtures
// ============================================================================

const MANAGE_PROCUREMENT_PERMISSIONS = PERMISSION_FLAGS.MANAGE_PROCUREMENT;

function makeTimestamp(date: Date): Timestamp {
  const stamp = {
    toDate: () => date,
    toMillis: () => date.getTime(),
    seconds: Math.floor(date.getTime() / 1000),
    nanoseconds: 0,
  };
  return stamp as unknown as Timestamp;
}

function makeQuote(overrides: Partial<VendorQuote> = {}): VendorQuote {
  const quote = {
    id: 'q-1',
    number: 'Q-2025-0001',
    tenantId: 'tenant-1',
    sourceType: 'OFFLINE_RFQ',
    vendorId: 'vendor-1',
    vendorName: 'Acme Pumps',
    subtotal: 0,
    taxAmount: 0,
    totalAmount: 0,
    currency: 'INR',
    status: 'DRAFT',
    isRecommended: false,
    itemCount: 0,
    acceptedCount: 0,
    isActive: true,
    createdBy: 'user-1',
    createdByName: 'Alice',
    createdAt: makeTimestamp(new Date('2025-01-01')),
    updatedAt: makeTimestamp(new Date('2025-01-01')),
    ...overrides,
  };
  return quote as unknown as VendorQuote;
}

function makeItem(overrides: Partial<VendorQuoteItem> = {}): VendorQuoteItem {
  const item = {
    id: 'qi-1',
    quoteId: 'q-1',
    itemType: 'MATERIAL',
    lineNumber: 1,
    description: 'Steel Plate 10mm',
    quantity: 100,
    unit: 'KG',
    unitPrice: 1000,
    amount: 100000,
    gstRate: 18,
    gstAmount: 18000,
    priceAccepted: false,
    createdAt: makeTimestamp(new Date('2025-01-01')),
    updatedAt: makeTimestamp(new Date('2025-01-01')),
    ...overrides,
  };
  return item as unknown as VendorQuoteItem;
}

beforeEach(() => {
  // mockReset (not mockClear) — clearAllMocks does NOT drop queued
  // mockResolvedValueOnce values, which pollute across tests.
  mockGetDoc.mockReset();
  mockGetDocs.mockReset();
  mockUpdateDoc.mockReset();
  mockAddDoc.mockReset();
  mockDeleteDoc.mockReset();
  mockWriteBatch.mockClear();
  mockRequirePermission.mockReset();
  mockAddMaterialPrice.mockReset().mockResolvedValue({ id: 'price-1' });
  mockUpdateBoughtOutItem.mockReset().mockResolvedValue(undefined);
  mockAddBoughtOutPrice.mockReset().mockResolvedValue({ id: 'bo-price-1' });
  // Default fall-through for the chained queries' final consumer
  // (e.g. recalcQuoteTotals after the last queued response).
  mockUpdateDoc.mockResolvedValue(undefined);
  batchSets.length = 0;
  batchUpdates.length = 0;
});

// ============================================================================
// createVendorQuote
// ============================================================================

describe('createVendorQuote', () => {
  function setupNumberGen(lastNumber?: string) {
    // First getDocs call: number-generator query (latest Q-YYYY-NNNN).
    if (lastNumber) {
      mockGetDocs.mockResolvedValueOnce({
        empty: false,
        docs: [{ data: () => ({ number: lastNumber }) }],
      });
    } else {
      mockGetDocs.mockResolvedValueOnce({ empty: true, docs: [] });
    }
  }

  const baseInput: CreateVendorQuoteInput = {
    tenantId: 'tenant-1',
    sourceType: 'OFFLINE_RFQ',
    vendorName: 'Acme Pumps',
    vendorId: 'vendor-1',
  };

  it('checks MANAGE_PROCUREMENT before doing anything', async () => {
    setupNumberGen();
    mockAddDoc.mockResolvedValueOnce({ id: 'q-new' });
    await createVendorQuote(
      {} as never,
      baseInput,
      [],
      'user-1',
      'Alice',
      MANAGE_PROCUREMENT_PERMISSIONS
    );
    expect(mockRequirePermission).toHaveBeenCalledWith(
      MANAGE_PROCUREMENT_PERMISSIONS,
      PERMISSION_FLAGS.MANAGE_PROCUREMENT,
      'user-1',
      'create vendor quote'
    );
  });

  it('rejects when vendorName is empty', async () => {
    await expect(
      createVendorQuote(
        {} as never,
        { ...baseInput, vendorName: '' },
        [],
        'user-1',
        'Alice',
        MANAGE_PROCUREMENT_PERMISSIONS
      )
    ).rejects.toThrow(/vendor name/i);
  });

  it('rejects when vendorName is whitespace-only', async () => {
    await expect(
      createVendorQuote(
        {} as never,
        { ...baseInput, vendorName: '   ' },
        [],
        'user-1',
        'Alice',
        MANAGE_PROCUREMENT_PERMISSIONS
      )
    ).rejects.toThrow(/vendor name/i);
  });

  it('requires rfqId for RFQ_RESPONSE quotes', async () => {
    await expect(
      createVendorQuote(
        {} as never,
        { ...baseInput, sourceType: 'RFQ_RESPONSE' },
        [],
        'user-1',
        'Alice',
        MANAGE_PROCUREMENT_PERMISSIONS
      )
    ).rejects.toThrow(/rfqId/i);
  });

  it('generates Q-YYYY-0001 for first quote of the year', async () => {
    setupNumberGen();
    mockAddDoc.mockResolvedValueOnce({ id: 'q-new' });
    await createVendorQuote(
      {} as never,
      baseInput,
      [],
      'user-1',
      'Alice',
      MANAGE_PROCUREMENT_PERMISSIONS
    );
    const written = mockAddDoc.mock.calls[0]?.[1] as { number: string };
    expect(written.number).toMatch(/^Q-\d{4}-0001$/);
  });

  it('increments quote number from the last existing one', async () => {
    // Use the current year so the test is stable across years (the number
    // generator scopes by `new Date().getFullYear()`).
    const year = new Date().getFullYear();
    setupNumberGen(`Q-${year}-0042`);
    mockAddDoc.mockResolvedValueOnce({ id: 'q-new' });
    await createVendorQuote(
      {} as never,
      baseInput,
      [],
      'user-1',
      'Alice',
      MANAGE_PROCUREMENT_PERMISSIONS
    );
    const written = mockAddDoc.mock.calls[0]?.[1] as { number: string };
    expect(written.number).toBe(`Q-${year}-0043`);
  });

  it('zero items → status DRAFT, totals all zero', async () => {
    setupNumberGen();
    mockAddDoc.mockResolvedValueOnce({ id: 'q-new' });
    await createVendorQuote(
      {} as never,
      baseInput,
      [],
      'user-1',
      'Alice',
      MANAGE_PROCUREMENT_PERMISSIONS
    );
    const written = mockAddDoc.mock.calls[0]?.[1] as {
      status: string;
      itemCount: number;
      subtotal: number;
      taxAmount: number;
      totalAmount: number;
    };
    expect(written.status).toBe('DRAFT');
    expect(written.itemCount).toBe(0);
    expect(written.subtotal).toBe(0);
    expect(written.taxAmount).toBe(0);
    expect(written.totalAmount).toBe(0);
  });

  it('with items → status UPLOADED, totals derived from lines', async () => {
    setupNumberGen();
    mockAddDoc.mockResolvedValueOnce({ id: 'q-new' });
    const items: CreateVendorQuoteItemInput[] = [
      {
        itemType: 'MATERIAL',
        description: 'Plate',
        quantity: 100,
        unit: 'KG',
        unitPrice: 1000,
        gstRate: 18,
      },
      {
        itemType: 'MATERIAL',
        description: 'Bar',
        quantity: 50,
        unit: 'KG',
        unitPrice: 800,
        gstRate: 18,
      },
    ];
    await createVendorQuote(
      {} as never,
      baseInput,
      items,
      'user-1',
      'Alice',
      MANAGE_PROCUREMENT_PERMISSIONS
    );
    const written = mockAddDoc.mock.calls[0]?.[1] as {
      status: string;
      itemCount: number;
      subtotal: number;
      taxAmount: number;
      totalAmount: number;
    };
    expect(written.status).toBe('UPLOADED');
    expect(written.itemCount).toBe(2);
    // 100*1000 + 50*800 = 140000
    expect(written.subtotal).toBe(140000);
    // 140000 * 18% = 25200
    expect(written.taxAmount).toBe(25200);
    expect(written.totalAmount).toBe(165200);
  });

  it('rounds money to paisa (2 decimals)', async () => {
    setupNumberGen();
    mockAddDoc.mockResolvedValueOnce({ id: 'q-new' });
    const items: CreateVendorQuoteItemInput[] = [
      {
        itemType: 'MATERIAL',
        description: 'X',
        quantity: 3,
        unit: 'NOS',
        unitPrice: 33.333,
        gstRate: 18,
      },
    ];
    await createVendorQuote(
      {} as never,
      baseInput,
      items,
      'user-1',
      'Alice',
      MANAGE_PROCUREMENT_PERMISSIONS
    );
    const written = mockAddDoc.mock.calls[0]?.[1] as { subtotal: number };
    // 3 * 33.333 = 99.999 → 100.00
    expect(written.subtotal).toBeCloseTo(100, 2);
  });

  it('writes a batch of items after the parent quote', async () => {
    setupNumberGen();
    mockAddDoc.mockResolvedValueOnce({ id: 'q-new' });
    const items: CreateVendorQuoteItemInput[] = [
      { itemType: 'MATERIAL', description: 'A', quantity: 1, unit: 'NOS', unitPrice: 10 },
      { itemType: 'MATERIAL', description: 'B', quantity: 2, unit: 'NOS', unitPrice: 20 },
    ];
    await createVendorQuote(
      {} as never,
      baseInput,
      items,
      'user-1',
      'Alice',
      MANAGE_PROCUREMENT_PERMISSIONS
    );
    expect(mockWriteBatch).toHaveBeenCalled();
    expect(batchSets).toHaveLength(2);
    expect(batchSets[0]?.data).toMatchObject({
      quoteId: 'q-new',
      tenantId: 'tenant-1',
      itemType: 'MATERIAL',
      description: 'A',
      lineNumber: 1,
    });
    expect(batchSets[1]?.data).toMatchObject({
      lineNumber: 2,
    });
  });

  it('passes through projectIds/projectNames denormalized from the linked RFQ', async () => {
    setupNumberGen();
    mockAddDoc.mockResolvedValueOnce({ id: 'q-new' });
    await createVendorQuote(
      {} as never,
      {
        ...baseInput,
        sourceType: 'RFQ_RESPONSE',
        rfqId: 'rfq-1',
        projectIds: ['p-1', 'p-2'],
        projectNames: ['Plant A', 'Plant B'],
      },
      [],
      'user-1',
      'Alice',
      MANAGE_PROCUREMENT_PERMISSIONS
    );
    const written = mockAddDoc.mock.calls[0]?.[1] as {
      projectIds?: string[];
      projectNames?: string[];
    };
    expect(written.projectIds).toEqual(['p-1', 'p-2']);
    expect(written.projectNames).toEqual(['Plant A', 'Plant B']);
  });

  it('omits projectIds when empty (Firestore rejects empty arrays here)', async () => {
    setupNumberGen();
    mockAddDoc.mockResolvedValueOnce({ id: 'q-new' });
    await createVendorQuote(
      {} as never,
      { ...baseInput, projectIds: [], projectNames: [] },
      [],
      'user-1',
      'Alice',
      MANAGE_PROCUREMENT_PERMISSIONS
    );
    const written = mockAddDoc.mock.calls[0]?.[1] as {
      projectIds?: string[];
      projectNames?: string[];
    };
    expect(written.projectIds).toBeUndefined();
    expect(written.projectNames).toBeUndefined();
  });

  it('returns the created document id', async () => {
    setupNumberGen();
    mockAddDoc.mockResolvedValueOnce({ id: 'q-new-42' });
    const id = await createVendorQuote(
      {} as never,
      baseInput,
      [],
      'user-1',
      'Alice',
      MANAGE_PROCUREMENT_PERMISSIONS
    );
    expect(id).toBe('q-new-42');
  });
});

// ============================================================================
// listVendorQuotes / getVendorQuoteById / getVendorQuoteItems
// ============================================================================

describe('listVendorQuotes', () => {
  it('returns mapped docs sorted as queried', async () => {
    mockGetDocs.mockResolvedValueOnce({
      docs: [
        { id: 'q-1', data: () => makeQuote({ id: 'q-1', number: 'Q-2025-0002' }) },
        { id: 'q-2', data: () => makeQuote({ id: 'q-2', number: 'Q-2025-0001' }) },
      ],
    });
    const result = await listVendorQuotes({} as never);
    expect(result).toHaveLength(2);
    expect(result[0]?.id).toBe('q-1');
    expect(result[1]?.id).toBe('q-2');
  });

  it('defaults to active quotes only (filters out isActive=false client-side)', async () => {
    // The implementation filters client-side rather than via a where()
    // constraint to keep the index footprint small.
    mockGetDocs.mockResolvedValueOnce({
      docs: [
        { id: 'q-1', data: () => makeQuote({ id: 'q-1', isActive: true }) },
        { id: 'q-2', data: () => makeQuote({ id: 'q-2', isActive: false }) },
      ],
    });
    const result = await listVendorQuotes({} as never);
    expect(result.map((q) => q.id)).toEqual(['q-1']);
  });

  it('opts out of active filter when activeOnly:false', async () => {
    mockGetDocs.mockResolvedValueOnce({
      docs: [
        { id: 'q-1', data: () => makeQuote({ id: 'q-1', isActive: true }) },
        { id: 'q-2', data: () => makeQuote({ id: 'q-2', isActive: false }) },
      ],
    });
    const result = await listVendorQuotes({} as never, { activeOnly: false });
    expect(result).toHaveLength(2);
  });

  it('applies rfqId / vendorId / sourceType / status filters when given', async () => {
    mockGetDocs.mockResolvedValueOnce({ docs: [] });
    await listVendorQuotes({} as never, {
      rfqId: 'rfq-1',
      vendorId: 'v-1',
      sourceType: 'RFQ_RESPONSE',
      status: 'EVALUATED',
    });
    const { where } = jest.requireMock('firebase/firestore') as {
      where: jest.Mock;
    };
    const fields = where.mock.calls.map((c: unknown[]) => c[0]);
    expect(fields).toEqual(expect.arrayContaining(['rfqId', 'vendorId', 'sourceType', 'status']));
  });
});

describe('getVendorQuoteById', () => {
  it('returns null when not found', async () => {
    mockGetDoc.mockResolvedValueOnce({ exists: () => false });
    expect(await getVendorQuoteById({} as never, 'q-missing')).toBeNull();
  });

  it('returns shaped quote when present', async () => {
    mockGetDoc.mockResolvedValueOnce({
      exists: () => true,
      id: 'q-1',
      data: () => makeQuote({ id: 'q-1' }),
    });
    const result = await getVendorQuoteById({} as never, 'q-1');
    expect(result?.id).toBe('q-1');
    expect(result?.number).toBe('Q-2025-0001');
  });
});

describe('getVendorQuoteItems', () => {
  it('returns lines ordered by lineNumber', async () => {
    mockGetDocs.mockResolvedValueOnce({
      docs: [
        { id: 'qi-1', data: () => makeItem({ id: 'qi-1', lineNumber: 1 }) },
        { id: 'qi-2', data: () => makeItem({ id: 'qi-2', lineNumber: 2 }) },
      ],
    });
    const items = await getVendorQuoteItems({} as never, 'q-1');
    expect(items).toHaveLength(2);
    expect(items[0]?.lineNumber).toBe(1);
  });
});

// ============================================================================
// Item CRUD — add / update / remove (with parent total recalc)
// ============================================================================

describe('addVendorQuoteItem', () => {
  it('checks MANAGE_PROCUREMENT', async () => {
    mockGetDoc.mockResolvedValueOnce({
      exists: () => true,
      data: () => ({ tenantId: 'tenant-1' }),
    });
    mockGetDocs.mockResolvedValueOnce({ docs: [] }); // existing items
    mockAddDoc.mockResolvedValueOnce({ id: 'qi-new' });
    mockGetDocs.mockResolvedValueOnce({ docs: [] }); // recalc fetch
    mockUpdateDoc.mockResolvedValueOnce(undefined);
    await addVendorQuoteItem(
      {} as never,
      'q-1',
      {
        itemType: 'MATERIAL',
        description: 'X',
        quantity: 1,
        unit: 'NOS',
        unitPrice: 100,
      },
      'user-1',
      MANAGE_PROCUREMENT_PERMISSIONS
    );
    expect(mockRequirePermission).toHaveBeenCalledWith(
      MANAGE_PROCUREMENT_PERMISSIONS,
      PERMISSION_FLAGS.MANAGE_PROCUREMENT,
      'user-1',
      'add quote item'
    );
  });

  it('throws when parent quote is missing', async () => {
    mockGetDoc.mockResolvedValueOnce({ exists: () => false });
    await expect(
      addVendorQuoteItem(
        {} as never,
        'q-missing',
        {
          itemType: 'MATERIAL',
          description: 'X',
          quantity: 1,
          unit: 'NOS',
          unitPrice: 100,
        },
        'user-1',
        MANAGE_PROCUREMENT_PERMISSIONS
      )
    ).rejects.toThrow(/not found/i);
  });

  it('inherits tenantId from parent quote', async () => {
    mockGetDoc.mockResolvedValueOnce({
      exists: () => true,
      data: () => ({ tenantId: 'tenant-9' }),
    });
    mockGetDocs.mockResolvedValueOnce({ docs: [] });
    mockAddDoc.mockResolvedValueOnce({ id: 'qi-new' });
    mockGetDocs.mockResolvedValueOnce({ docs: [] });
    mockUpdateDoc.mockResolvedValueOnce(undefined);
    await addVendorQuoteItem(
      {} as never,
      'q-1',
      { itemType: 'MATERIAL', description: 'X', quantity: 1, unit: 'NOS', unitPrice: 100 },
      'user-1',
      MANAGE_PROCUREMENT_PERMISSIONS
    );
    const written = mockAddDoc.mock.calls[0]?.[1] as { tenantId: string };
    expect(written.tenantId).toBe('tenant-9');
  });

  it('auto-numbers next line when lineNumber not given', async () => {
    mockGetDoc.mockResolvedValueOnce({ exists: () => true, data: () => ({}) });
    mockGetDocs.mockResolvedValueOnce({
      docs: [
        { id: 'qi-1', data: () => makeItem({ id: 'qi-1', lineNumber: 1 }) },
        { id: 'qi-2', data: () => makeItem({ id: 'qi-2', lineNumber: 2 }) },
      ],
    });
    mockAddDoc.mockResolvedValueOnce({ id: 'qi-new' });
    mockGetDocs.mockResolvedValueOnce({ docs: [] });
    mockUpdateDoc.mockResolvedValueOnce(undefined);
    await addVendorQuoteItem(
      {} as never,
      'q-1',
      { itemType: 'MATERIAL', description: 'X', quantity: 1, unit: 'NOS', unitPrice: 100 },
      'user-1',
      MANAGE_PROCUREMENT_PERMISSIONS
    );
    const written = mockAddDoc.mock.calls[0]?.[1] as { lineNumber: number };
    expect(written.lineNumber).toBe(3);
  });

  it('computes amount = qty × price and gstAmount when gstRate given', async () => {
    mockGetDoc.mockResolvedValueOnce({ exists: () => true, data: () => ({}) });
    mockGetDocs.mockResolvedValueOnce({ docs: [] });
    mockAddDoc.mockResolvedValueOnce({ id: 'qi-new' });
    mockGetDocs.mockResolvedValueOnce({ docs: [] });
    mockUpdateDoc.mockResolvedValueOnce(undefined);
    await addVendorQuoteItem(
      {} as never,
      'q-1',
      {
        itemType: 'MATERIAL',
        description: 'X',
        quantity: 10,
        unit: 'KG',
        unitPrice: 250,
        gstRate: 18,
      },
      'user-1',
      MANAGE_PROCUREMENT_PERMISSIONS
    );
    const written = mockAddDoc.mock.calls[0]?.[1] as {
      amount: number;
      gstAmount: number;
    };
    expect(written.amount).toBe(2500);
    expect(written.gstAmount).toBe(450);
  });
});

describe('updateVendorQuoteItem', () => {
  it('checks MANAGE_PROCUREMENT and recalcs after update', async () => {
    mockGetDoc.mockResolvedValueOnce({
      exists: () => true,
      id: 'qi-1',
      data: () => makeItem(),
    });
    mockUpdateDoc.mockResolvedValueOnce(undefined);
    mockGetDocs.mockResolvedValueOnce({ docs: [] }); // recalc fetch
    mockUpdateDoc.mockResolvedValueOnce(undefined); // recalc write
    await updateVendorQuoteItem(
      {} as never,
      'qi-1',
      { quantity: 200 },
      'user-1',
      MANAGE_PROCUREMENT_PERMISSIONS
    );
    expect(mockRequirePermission).toHaveBeenCalledWith(
      MANAGE_PROCUREMENT_PERMISSIONS,
      PERMISSION_FLAGS.MANAGE_PROCUREMENT,
      'user-1',
      'update quote item'
    );
    // First updateDoc — the item itself; second — recalc on parent quote.
    expect(mockUpdateDoc).toHaveBeenCalledTimes(2);
  });

  it('recomputes amount when quantity changes', async () => {
    mockGetDoc.mockResolvedValueOnce({
      exists: () => true,
      id: 'qi-1',
      data: () => makeItem({ quantity: 100, unitPrice: 1000, gstRate: 18 }),
    });
    mockUpdateDoc.mockResolvedValueOnce(undefined);
    mockGetDocs.mockResolvedValueOnce({ docs: [] });
    mockUpdateDoc.mockResolvedValueOnce(undefined);
    await updateVendorQuoteItem(
      {} as never,
      'qi-1',
      { quantity: 50 },
      'user-1',
      MANAGE_PROCUREMENT_PERMISSIONS
    );
    const written = mockUpdateDoc.mock.calls[0]?.[1] as {
      amount: number;
      gstAmount: number;
    };
    // 50 * 1000 = 50000; 50000 * 18% = 9000
    expect(written.amount).toBe(50000);
    expect(written.gstAmount).toBe(9000);
  });

  it('throws when item not found', async () => {
    mockGetDoc.mockResolvedValueOnce({ exists: () => false });
    await expect(
      updateVendorQuoteItem(
        {} as never,
        'qi-missing',
        { quantity: 5 },
        'user-1',
        MANAGE_PROCUREMENT_PERMISSIONS
      )
    ).rejects.toThrow(/not found/i);
  });
});

describe('removeVendorQuoteItem', () => {
  it('deletes the doc and recalcs the parent', async () => {
    mockGetDoc.mockResolvedValueOnce({
      exists: () => true,
      id: 'qi-1',
      data: () => makeItem(),
    });
    mockDeleteDoc.mockResolvedValueOnce(undefined);
    mockGetDocs.mockResolvedValueOnce({ docs: [] }); // recalc fetch
    mockUpdateDoc.mockResolvedValueOnce(undefined); // recalc write
    await removeVendorQuoteItem({} as never, 'qi-1', 'user-1', MANAGE_PROCUREMENT_PERMISSIONS);
    expect(mockDeleteDoc).toHaveBeenCalled();
    expect(mockUpdateDoc).toHaveBeenCalledTimes(1);
  });

  it('throws when item not found', async () => {
    mockGetDoc.mockResolvedValueOnce({ exists: () => false });
    await expect(
      removeVendorQuoteItem({} as never, 'qi-missing', 'user-1', MANAGE_PROCUREMENT_PERMISSIONS)
    ).rejects.toThrow(/not found/i);
  });
});

// ============================================================================
// updateVendorQuote — header / terms updates + date conversion
// ============================================================================

describe('updateVendorQuote', () => {
  it('checks MANAGE_PROCUREMENT', async () => {
    mockUpdateDoc.mockResolvedValueOnce(undefined);
    await updateVendorQuote(
      {} as never,
      'q-1',
      { vendorName: 'New Name' },
      'user-1',
      MANAGE_PROCUREMENT_PERMISSIONS
    );
    expect(mockRequirePermission).toHaveBeenCalledWith(
      MANAGE_PROCUREMENT_PERMISSIONS,
      PERMISSION_FLAGS.MANAGE_PROCUREMENT,
      'user-1',
      'update vendor quote'
    );
  });

  it('skips undefined fields (Firestore rejects undefined)', async () => {
    mockUpdateDoc.mockResolvedValueOnce(undefined);
    await updateVendorQuote(
      {} as never,
      'q-1',
      { vendorName: 'Acme', vendorOfferNumber: undefined, remarks: 'note' },
      'user-1',
      MANAGE_PROCUREMENT_PERMISSIONS
    );
    const written = mockUpdateDoc.mock.calls[0]?.[1] as Record<string, unknown>;
    expect(written.vendorName).toBe('Acme');
    expect(written.remarks).toBe('note');
    expect(written).not.toHaveProperty('vendorOfferNumber');
  });

  it('converts Date fields to Timestamp', async () => {
    mockUpdateDoc.mockResolvedValueOnce(undefined);
    const offerDate = new Date('2025-03-15');
    await updateVendorQuote(
      {} as never,
      'q-1',
      { vendorOfferDate: offerDate, validityDate: new Date('2025-04-15') },
      'user-1',
      MANAGE_PROCUREMENT_PERMISSIONS
    );
    const written = mockUpdateDoc.mock.calls[0]?.[1] as Record<string, unknown>;
    expect(written.vendorOfferDate).toBeDefined();
    expect(written.validityDate).toBeDefined();
    // Timestamp.fromDate was called for both
    const { Timestamp: T } = jest.requireMock('firebase/firestore') as {
      Timestamp: { fromDate: jest.Mock };
    };
    expect(T.fromDate).toHaveBeenCalledWith(offerDate);
  });

  it('always stamps updatedAt and updatedBy', async () => {
    mockUpdateDoc.mockResolvedValueOnce(undefined);
    await updateVendorQuote(
      {} as never,
      'q-1',
      { remarks: 'x' },
      'user-1',
      MANAGE_PROCUREMENT_PERMISSIONS
    );
    const written = mockUpdateDoc.mock.calls[0]?.[1] as Record<string, unknown>;
    expect(written.updatedBy).toBe('user-1');
    expect(written.updatedAt).toBeDefined();
  });
});

// ============================================================================
// acceptQuoteItemPrice — the cross-collection writeback
// ============================================================================

describe('acceptQuoteItemPrice', () => {
  function setupItem(item: VendorQuoteItem, quote: VendorQuote = makeQuote()) {
    mockGetDoc
      // first getDoc: load the item
      .mockResolvedValueOnce({ exists: () => true, id: item.id, data: () => item })
      // second getDoc: load parent quote
      .mockResolvedValueOnce({ exists: () => true, id: quote.id, data: () => quote });
  }

  it('throws if item already accepted (idempotent guard)', async () => {
    setupItem(makeItem({ priceAccepted: true }));
    await expect(
      acceptQuoteItemPrice({} as never, 'qi-1', 'user-1', MANAGE_PROCUREMENT_PERMISSIONS)
    ).rejects.toThrow(/already accepted/i);
  });

  it('MATERIAL line → calls addMaterialPrice with the right shape', async () => {
    setupItem(
      makeItem({
        itemType: 'MATERIAL',
        materialId: 'mat-1',
        unitPrice: 1000,
        unit: 'KG',
      }),
      makeQuote({ vendorId: 'v-1', vendorName: 'Acme', currency: 'INR' })
    );
    mockUpdateDoc.mockResolvedValue(undefined);
    mockGetDocs.mockResolvedValueOnce({ docs: [] }); // recalc fetch

    await acceptQuoteItemPrice({} as never, 'qi-1', 'user-1', MANAGE_PROCUREMENT_PERMISSIONS);

    expect(mockAddMaterialPrice).toHaveBeenCalledTimes(1);
    expect(mockAddMaterialPrice.mock.calls[0]?.[1]).toMatchObject({
      materialId: 'mat-1',
      pricePerUnit: { amount: 1000, currency: 'INR' },
      unit: 'KG',
      vendorId: 'v-1',
      vendorName: 'Acme',
      sourceType: 'VENDOR_QUOTE',
    });
    expect(mockAddBoughtOutPrice).not.toHaveBeenCalled();
  });

  it('SERVICE line → writes to serviceRates, NOT to material/bought-out paths', async () => {
    setupItem(
      makeItem({
        itemType: 'SERVICE',
        serviceId: 'svc-1',
        unitPrice: 5000,
        unit: 'LOT',
      })
    );
    mockAddDoc.mockResolvedValueOnce({ id: 'rate-1' });
    mockUpdateDoc.mockResolvedValue(undefined);
    mockGetDocs.mockResolvedValueOnce({ docs: [] });

    await acceptQuoteItemPrice({} as never, 'qi-1', 'user-1', MANAGE_PROCUREMENT_PERMISSIONS);

    expect(mockAddMaterialPrice).not.toHaveBeenCalled();
    expect(mockUpdateBoughtOutItem).not.toHaveBeenCalled();
    expect(mockAddDoc).toHaveBeenCalled();
    const written = mockAddDoc.mock.calls[0]?.[1] as {
      serviceId: string;
      rateValue: number;
    };
    expect(written.serviceId).toBe('svc-1');
    expect(written.rateValue).toBe(5000);
  });

  it('BOUGHT_OUT line → updates listPrice AND appends price-history record', async () => {
    setupItem(
      makeItem({
        itemType: 'BOUGHT_OUT',
        boughtOutItemId: 'bo-1',
        unitPrice: 12500,
        unit: 'NOS',
      }),
      makeQuote({ vendorId: 'v-1', vendorName: 'Acme', currency: 'INR' })
    );
    mockUpdateDoc.mockResolvedValue(undefined);
    mockGetDocs.mockResolvedValueOnce({ docs: [] });

    await acceptQuoteItemPrice({} as never, 'qi-1', 'user-1', MANAGE_PROCUREMENT_PERMISSIONS);

    expect(mockUpdateBoughtOutItem).toHaveBeenCalledTimes(1);
    expect(mockUpdateBoughtOutItem.mock.calls[0]?.[1]).toBe('bo-1');

    expect(mockAddBoughtOutPrice).toHaveBeenCalledTimes(1);
    expect(mockAddBoughtOutPrice.mock.calls[0]?.[1]).toMatchObject({
      boughtOutItemId: 'bo-1',
      unitPrice: 12500,
      unit: 'NOS',
      currency: 'INR',
      vendorId: 'v-1',
      vendorName: 'Acme',
      sourceType: 'VENDOR_QUOTE',
      isActive: true,
    });
  });

  it('NOTE line → no master writeback, just marks accepted', async () => {
    setupItem(makeItem({ itemType: 'NOTE', description: 'Discount 5%', unitPrice: -500 }));
    mockUpdateDoc.mockResolvedValue(undefined);
    mockGetDocs.mockResolvedValueOnce({ docs: [] });

    await acceptQuoteItemPrice({} as never, 'qi-1', 'user-1', MANAGE_PROCUREMENT_PERMISSIONS);

    expect(mockAddMaterialPrice).not.toHaveBeenCalled();
    expect(mockUpdateBoughtOutItem).not.toHaveBeenCalled();
    expect(mockAddBoughtOutPrice).not.toHaveBeenCalled();
    // priceAccepted update still issued
    expect(mockUpdateDoc).toHaveBeenCalled();
  });

  it('marks the item priceAccepted=true with audit fields', async () => {
    setupItem(makeItem({ itemType: 'MATERIAL', materialId: 'mat-1' }));
    mockUpdateDoc.mockResolvedValue(undefined);
    mockGetDocs.mockResolvedValueOnce({ docs: [] });

    await acceptQuoteItemPrice({} as never, 'qi-1', 'user-1', MANAGE_PROCUREMENT_PERMISSIONS);

    // Find the call that updates priceAccepted (last updateDoc on the item itself)
    const writes = mockUpdateDoc.mock.calls.map((c) => c[1] as Record<string, unknown>);
    const accepted = writes.find((w) => w.priceAccepted === true);
    expect(accepted).toBeDefined();
    expect(accepted?.priceAcceptedBy).toBe('user-1');
    expect(accepted?.priceAcceptedAt).toBeDefined();
  });
});

// ============================================================================
// Reverse lookups — material / service / bought-out detail pages
// ============================================================================

describe('reverse lookups (getQuotesBy*)', () => {
  it('getQuotesByMaterialId: queries items by materialId, fetches unique parent quotes', async () => {
    mockGetDocs.mockResolvedValueOnce({
      docs: [
        { id: 'qi-1', data: () => makeItem({ id: 'qi-1', quoteId: 'q-1' }) },
        { id: 'qi-2', data: () => makeItem({ id: 'qi-2', quoteId: 'q-1' }) }, // duplicate quote
        { id: 'qi-3', data: () => makeItem({ id: 'qi-3', quoteId: 'q-2' }) },
      ],
    });
    mockGetDoc
      .mockResolvedValueOnce({
        exists: () => true,
        id: 'q-1',
        data: () => makeQuote({ id: 'q-1' }),
      })
      .mockResolvedValueOnce({
        exists: () => true,
        id: 'q-2',
        data: () => makeQuote({ id: 'q-2' }),
      });

    const result = await getQuotesByMaterialId({} as never, 'mat-1');

    // Three items but only two distinct quotes
    expect(result).toHaveLength(2);
    const ids = result.map((q) => q.id).sort();
    expect(ids).toEqual(['q-1', 'q-2']);
  });

  it('getQuotesByServiceId: same shape, filters by serviceId', async () => {
    mockGetDocs.mockResolvedValueOnce({
      docs: [{ id: 'qi-1', data: () => makeItem({ quoteId: 'q-1' }) }],
    });
    mockGetDoc.mockResolvedValueOnce({
      exists: () => true,
      id: 'q-1',
      data: () => makeQuote({ id: 'q-1' }),
    });
    const result = await getQuotesByServiceId({} as never, 'svc-1');
    expect(result).toHaveLength(1);

    const { where } = jest.requireMock('firebase/firestore') as { where: jest.Mock };
    const fields = where.mock.calls.map((c: unknown[]) => c[0]);
    expect(fields).toContain('serviceId');
  });

  it('getQuotesByBoughtOutItemId: filters by boughtOutItemId (the new lookup)', async () => {
    mockGetDocs.mockResolvedValueOnce({
      docs: [{ id: 'qi-1', data: () => makeItem({ quoteId: 'q-1' }) }],
    });
    mockGetDoc.mockResolvedValueOnce({
      exists: () => true,
      id: 'q-1',
      data: () => makeQuote({ id: 'q-1' }),
    });
    const result = await getQuotesByBoughtOutItemId({} as never, 'bo-1');
    expect(result).toHaveLength(1);

    const { where } = jest.requireMock('firebase/firestore') as { where: jest.Mock };
    const fields = where.mock.calls.map((c: unknown[]) => c[0]);
    expect(fields).toContain('boughtOutItemId');
  });

  it('drops inactive quotes from reverse-lookup results', async () => {
    mockGetDocs.mockResolvedValueOnce({
      docs: [
        { id: 'qi-1', data: () => makeItem({ quoteId: 'q-active' }) },
        { id: 'qi-2', data: () => makeItem({ quoteId: 'q-archived' }) },
      ],
    });
    mockGetDoc
      .mockResolvedValueOnce({
        exists: () => true,
        id: 'q-active',
        data: () => makeQuote({ id: 'q-active', isActive: true }),
      })
      .mockResolvedValueOnce({
        exists: () => true,
        id: 'q-archived',
        data: () => makeQuote({ id: 'q-archived', isActive: false }),
      });

    const result = await getQuotesByMaterialId({} as never, 'mat-1');
    expect(result.map((q) => q.id)).toEqual(['q-active']);
  });

  it('returns empty array when no items reference the master record', async () => {
    mockGetDocs.mockResolvedValueOnce({ docs: [] });
    expect(await getQuotesByMaterialId({} as never, 'mat-x')).toEqual([]);
  });
});

describe('getQuoteRowsByMaterialId / getQuoteRowsByBoughtOutItemId', () => {
  it('material rows: pairs items with parents, sorted newest-first', async () => {
    mockGetDocs.mockResolvedValueOnce({
      docs: [
        {
          id: 'qi-1',
          data: () => makeItem({ id: 'qi-1', quoteId: 'q-old' }),
        },
        {
          id: 'qi-2',
          data: () => makeItem({ id: 'qi-2', quoteId: 'q-new' }),
        },
      ],
    });
    mockGetDoc
      .mockResolvedValueOnce({
        exists: () => true,
        id: 'q-old',
        data: () => makeQuote({ id: 'q-old', createdAt: makeTimestamp(new Date('2025-01-01')) }),
      })
      .mockResolvedValueOnce({
        exists: () => true,
        id: 'q-new',
        data: () => makeQuote({ id: 'q-new', createdAt: makeTimestamp(new Date('2025-06-01')) }),
      });
    const rows = await getQuoteRowsByMaterialId({} as never, 'mat-1');
    expect(rows).toHaveLength(2);
    expect(rows[0]?.quote.id).toBe('q-new');
    expect(rows[1]?.quote.id).toBe('q-old');
  });

  it('bought-out rows: same pairing for the bought-out path', async () => {
    mockGetDocs.mockResolvedValueOnce({
      docs: [{ id: 'qi-1', data: () => makeItem({ id: 'qi-1', quoteId: 'q-1' }) }],
    });
    mockGetDoc.mockResolvedValueOnce({
      exists: () => true,
      id: 'q-1',
      data: () => makeQuote({ id: 'q-1' }),
    });
    const rows = await getQuoteRowsByBoughtOutItemId({} as never, 'bo-1');
    expect(rows).toHaveLength(1);
    expect(rows[0]?.item.id).toBe('qi-1');
    expect(rows[0]?.quote.id).toBe('q-1');
  });
});
