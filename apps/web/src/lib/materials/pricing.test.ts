/**
 * Material Pricing — procurement feedback loop tests (completion-plan A2)
 *
 * Covers:
 * - recordProcurementPrices: materialId lines → materialPrices (addDoc),
 *   boughtOutItemId lines → bought_out_prices (addBoughtOutPrice mock),
 *   returned { recorded, unlinked } counts
 * - countUnlinkedPriceLines: linkage counting incl. NOTE/service handling
 */

import type { CurrencyCode } from '@vapour/types';

const mockAddDoc = jest.fn();
const mockUpdateDoc = jest.fn();

jest.mock('firebase/firestore', () => ({
  collection: jest.fn((_db: unknown, name: string) => ({ collection: name })),
  doc: jest.fn((_db: unknown, name: string, id: string) => ({ doc: [name, id] })),
  addDoc: (...args: unknown[]) => mockAddDoc(...args),
  updateDoc: (...args: unknown[]) => mockUpdateDoc(...args),
  getDocs: jest.fn(),
  query: jest.fn((...args: unknown[]) => ({ query: args })),
  where: jest.fn(),
  orderBy: jest.fn(),
  limit: jest.fn(),
  Timestamp: {
    now: jest.fn(() => ({
      seconds: 1735689600,
      nanoseconds: 0,
      toDate: () => new Date('2025-01-01'),
      toMillis: () => 1735689600000,
    })),
  },
}));

jest.mock('@vapour/firebase', () => ({
  COLLECTIONS: {
    MATERIALS: 'materials',
    MATERIAL_PRICES: 'materialPrices',
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

const mockGetMaterialById = jest.fn();
jest.mock('./crud', () => ({
  getMaterialById: (...args: unknown[]) => mockGetMaterialById(...args),
}));

const mockAddBoughtOutPrice = jest.fn();
jest.mock('@/lib/boughtOut/pricing', () => ({
  addBoughtOutPrice: (...args: unknown[]) => mockAddBoughtOutPrice(...args),
}));

// Import after mocks
import {
  recordProcurementPrices,
  countUnlinkedPriceLines,
  type ProcurementPriceItem,
} from './pricing';

const CURRENCY: CurrencyCode = 'INR';

beforeEach(() => {
  mockAddDoc.mockReset().mockResolvedValue({ id: 'mp-1' });
  mockUpdateDoc.mockReset().mockResolvedValue(undefined);
  // No existing currentPrice → denorm always proceeds for active prices
  mockGetMaterialById.mockReset().mockResolvedValue({ id: 'mat-1' });
  mockAddBoughtOutPrice.mockReset().mockResolvedValue({ id: 'bop-1' });
});

function callRecord(items: ProcurementPriceItem[], priceType: 'budgetary' | 'confirmed') {
  return recordProcurementPrices(
    {} as never,
    items,
    'vendor-1',
    'Acme Pumps',
    'PO/2026/001',
    CURRENCY,
    priceType,
    'user-1',
    'tenant-1'
  );
}

describe('recordProcurementPrices', () => {
  it('writes materialPrices for materialId lines and returns recorded count', async () => {
    const result = await callRecord(
      [
        { materialId: 'mat-1', unitPrice: 100, unit: 'KG' },
        { materialId: 'mat-2', unitPrice: 250, unit: 'M' },
      ],
      'confirmed'
    );

    expect(mockAddDoc).toHaveBeenCalledTimes(2);
    const collections = mockAddDoc.mock.calls.map(
      (c) => (c[0] as { collection: string }).collection
    );
    expect(collections).toEqual(['materialPrices', 'materialPrices']);
    expect(result).toEqual({ recorded: 2, unlinked: 0 });
  });

  it('writes bought_out_prices for boughtOutItemId lines (A2 bridge)', async () => {
    const result = await callRecord(
      [{ boughtOutItemId: 'bo-1', unitPrice: 12500, unit: 'NOS' }],
      'confirmed'
    );

    expect(mockAddBoughtOutPrice).toHaveBeenCalledTimes(1);
    expect(mockAddBoughtOutPrice.mock.calls[0]?.[1]).toMatchObject({
      boughtOutItemId: 'bo-1',
      unitPrice: 12500,
      unit: 'NOS',
      currency: 'INR',
      vendorId: 'vendor-1',
      vendorName: 'Acme Pumps',
      sourceType: 'VENDOR_QUOTE',
      documentReference: 'PO/2026/001',
      isActive: true, // confirmed price → active → denorms listPrice
      tenantId: 'tenant-1',
    });
    expect(mockAddDoc).not.toHaveBeenCalled(); // no material lines
    expect(result).toEqual({ recorded: 1, unlinked: 0 });
  });

  it('budgetary prices are recorded as inactive (history only, no denorm)', async () => {
    await callRecord([{ boughtOutItemId: 'bo-1', unitPrice: 900, unit: 'NOS' }], 'budgetary');
    expect(mockAddBoughtOutPrice.mock.calls[0]?.[1]).toMatchObject({ isActive: false });
  });

  it('materialId wins when a line carries both material and bought-out links', async () => {
    await callRecord(
      [{ materialId: 'mat-1', boughtOutItemId: 'bo-1', unitPrice: 100, unit: 'KG' }],
      'confirmed'
    );
    expect(mockAddDoc).toHaveBeenCalledTimes(1);
    expect(mockAddBoughtOutPrice).not.toHaveBeenCalled();
  });

  it('counts unlinked lines (no material/bought-out/service link) and returns them', async () => {
    const result = await callRecord(
      [
        { materialId: 'mat-1', unitPrice: 100, unit: 'KG' },
        { unitPrice: 999, unit: 'LOT' }, // free-text leakage
        { unitPrice: 500, unit: 'NOS' }, // free-text leakage
      ],
      'confirmed'
    );
    expect(result).toEqual({ recorded: 1, unlinked: 2 });
  });

  it('service-linked lines are neither recorded here nor counted unlinked', async () => {
    const result = await callRecord(
      [{ serviceId: 'svc-1', unitPrice: 5000, unit: 'LOT' }],
      'confirmed'
    );
    expect(mockAddDoc).not.toHaveBeenCalled();
    expect(mockAddBoughtOutPrice).not.toHaveBeenCalled();
    expect(result).toEqual({ recorded: 0, unlinked: 0 });
  });

  it('returns unlinked count even when nothing is recordable', async () => {
    const result = await callRecord([{ unitPrice: 42, unit: 'NOS' }], 'confirmed');
    expect(result).toEqual({ recorded: 0, unlinked: 1 });
  });

  it('does not throw when an individual price write fails; reduces recorded count', async () => {
    mockAddBoughtOutPrice.mockRejectedValueOnce(new Error('permission-denied'));
    const result = await callRecord(
      [
        { boughtOutItemId: 'bo-1', unitPrice: 100, unit: 'NOS' },
        { materialId: 'mat-1', unitPrice: 100, unit: 'KG' },
      ],
      'confirmed'
    );
    expect(result.recorded).toBe(1);
  });
});

describe('countUnlinkedPriceLines', () => {
  it('counts only lines with no linkage of any kind', () => {
    expect(
      countUnlinkedPriceLines([
        { materialId: 'mat-1' },
        { boughtOutItemId: 'bo-1' },
        { serviceId: 'svc-1' },
        {}, // unlinked
        {}, // unlinked
      ])
    ).toBe(2);
  });

  it('ignores NOTE lines (they carry no price)', () => {
    expect(countUnlinkedPriceLines([{ itemType: 'NOTE' }, {}])).toBe(1);
  });

  it('returns 0 for an empty list', () => {
    expect(countUnlinkedPriceLines([])).toBe(0);
  });
});
