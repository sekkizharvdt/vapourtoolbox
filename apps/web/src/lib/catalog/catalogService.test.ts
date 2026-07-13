/**
 * Catalog service (facade) tests — mapping + kind dispatch with the
 * per-kind backend services mocked. The facade must not reimplement
 * queries (rule 32), so these tests pin that it delegates and maps.
 */

import type { Firestore } from 'firebase/firestore';
import type { Material, BoughtOutItem, Service } from '@vapour/types';
import { itemTypeToCatalogKind, catalogKindToItemType } from '@vapour/types';
import { queryMaterials, searchMaterials } from '@/lib/materials/queries';
import { getMaterialById, createMaterial } from '@/lib/materials/crud';
import {
  listBoughtOutItems,
  getBoughtOutItemById,
  createBoughtOutItem,
} from '@/lib/boughtOut/boughtOutService';
import { listServices, getServiceById, createService } from '@/lib/services/crud';
import {
  materialToCatalogItem,
  boughtOutToCatalogItem,
  serviceToCatalogItem,
  toCatalogRef,
  searchCatalog,
  getCatalogItem,
  createCatalogItem,
} from './catalogService';

jest.mock('@/lib/materials/queries');
jest.mock('@/lib/materials/crud');
jest.mock('@/lib/boughtOut/boughtOutService');
jest.mock('@/lib/services/crud');

const db = {} as unknown as Firestore;

const material = {
  id: 'mat-1',
  materialCode: 'PL-SS-316L',
  name: 'SS Plate 316L',
  category: 'PLATES_SHEETS',
  baseUnit: 'kg',
  specification: { standard: 'ASTM A240', grade: '316L' },
} as unknown as Material;

const boughtOut = {
  id: 'bo-1',
  itemCode: 'BO-2026-0001',
  name: 'Gate Valve 2in SS316',
  category: 'VALVE',
  specCode: 'VLV-GATE-SS316-DN50-150-FLG-MAN',
  description: 'Flanged gate valve',
} as unknown as BoughtOutItem;

const service = {
  id: 'svc-1',
  serviceCode: 'SVC-TST-001',
  name: 'Hydrostatic Testing',
  category: 'TESTING',
  unit: 'per test',
  description: 'Hydro test per ASME',
} as unknown as Service;

beforeEach(() => {
  jest.resetAllMocks();
});

// ============================================================================
// Mapping
// ============================================================================

describe('mappers', () => {
  it('maps Material → CatalogItem (materialCode → code, formatted spec)', () => {
    expect(materialToCatalogItem(material)).toEqual({
      kind: 'RAW_MATERIAL',
      id: 'mat-1',
      code: 'PL-SS-316L',
      name: 'SS Plate 316L',
      category: 'PLATES_SHEETS',
      baseUnit: 'kg',
      specification: 'ASTM A240 · 316L',
    });
  });

  it('omits empty optional fields on materials', () => {
    const bare = { ...material, baseUnit: undefined, specification: {} } as unknown as Material;
    const item = materialToCatalogItem(bare);
    expect(item).not.toHaveProperty('baseUnit');
    expect(item).not.toHaveProperty('specification');
  });

  it('maps BoughtOutItem → CatalogItem (itemCode → code, specCode preferred)', () => {
    expect(boughtOutToCatalogItem(boughtOut)).toEqual({
      kind: 'BOUGHT_OUT',
      id: 'bo-1',
      code: 'BO-2026-0001',
      name: 'Gate Valve 2in SS316',
      category: 'VALVE',
      specification: 'VLV-GATE-SS316-DN50-150-FLG-MAN',
    });
  });

  it('falls back to description when a bought-out item has no specCode', () => {
    const noSpecCode = { ...boughtOut, specCode: undefined } as unknown as BoughtOutItem;
    expect(boughtOutToCatalogItem(noSpecCode).specification).toBe('Flanged gate valve');
  });

  it('maps Service → CatalogItem (serviceCode → code, unit → baseUnit)', () => {
    expect(serviceToCatalogItem(service)).toEqual({
      kind: 'SERVICE',
      id: 'svc-1',
      code: 'SVC-TST-001',
      name: 'Hydrostatic Testing',
      category: 'TESTING',
      baseUnit: 'per test',
      specification: 'Hydro test per ASME',
    });
  });

  it('toCatalogRef keeps only the denormalized reference fields', () => {
    expect(toCatalogRef(serviceToCatalogItem(service))).toEqual({
      kind: 'SERVICE',
      id: 'svc-1',
      code: 'SVC-TST-001',
      name: 'Hydrostatic Testing',
    });
  });
});

// ============================================================================
// itemType ↔ CatalogKind mapping (Phase-1 vocabulary bridge)
// ============================================================================

describe('itemType ↔ CatalogKind', () => {
  it('maps MATERIAL ↔ RAW_MATERIAL and round-trips every value', () => {
    expect(itemTypeToCatalogKind('MATERIAL')).toBe('RAW_MATERIAL');
    expect(itemTypeToCatalogKind('BOUGHT_OUT')).toBe('BOUGHT_OUT');
    expect(itemTypeToCatalogKind('SERVICE')).toBe('SERVICE');
    (['MATERIAL', 'BOUGHT_OUT', 'SERVICE'] as const).forEach((t) => {
      expect(catalogKindToItemType(itemTypeToCatalogKind(t))).toBe(t);
    });
  });
});

// ============================================================================
// searchCatalog — kind dispatch + delegation
// ============================================================================

describe('searchCatalog', () => {
  it('kind SERVICE only hits the services backend', async () => {
    (listServices as jest.Mock).mockResolvedValue([service]);

    const results = await searchCatalog(db, { kind: 'SERVICE' });

    expect(results).toEqual([serviceToCatalogItem(service)]);
    expect(listServices).toHaveBeenCalledTimes(1);
    expect(queryMaterials).not.toHaveBeenCalled();
    expect(searchMaterials).not.toHaveBeenCalled();
    expect(listBoughtOutItems).not.toHaveBeenCalled();
  });

  it('no kind fans out to all three backends and concatenates', async () => {
    (queryMaterials as jest.Mock).mockResolvedValue({ materials: [material], hasMore: false });
    (listBoughtOutItems as jest.Mock).mockResolvedValue([boughtOut]);
    (listServices as jest.Mock).mockResolvedValue([service]);

    const results = await searchCatalog(db, {});

    expect(results.map((r) => r.kind)).toEqual(['RAW_MATERIAL', 'BOUGHT_OUT', 'SERVICE']);
    expect(queryMaterials).toHaveBeenCalledWith(db, { isActive: true, limitResults: 50 });
    expect(listBoughtOutItems).toHaveBeenCalledWith(db, {
      tenantId: 'default-entity',
      isActive: true,
    });
    expect(listServices).toHaveBeenCalledWith(db, {});
  });

  it('materials use searchMaterials when a query is given, with client-side category filter', async () => {
    const other = { ...material, id: 'mat-2', category: 'PIPES' } as unknown as Material;
    (searchMaterials as jest.Mock).mockResolvedValue([material, other]);

    const results = await searchCatalog(db, {
      kind: 'RAW_MATERIAL',
      query: 'plate',
      category: 'PLATES_SHEETS',
    });

    expect(searchMaterials).toHaveBeenCalledWith(db, 'plate', 50);
    expect(queryMaterials).not.toHaveBeenCalled();
    expect(results.map((r) => r.id)).toEqual(['mat-1']);
  });

  it('materials without a query delegate to queryMaterials with isActive + category', async () => {
    (queryMaterials as jest.Mock).mockResolvedValue({ materials: [material], hasMore: false });

    await searchCatalog(db, { kind: 'RAW_MATERIAL', category: 'PLATES_SHEETS', limit: 25 });

    expect(queryMaterials).toHaveBeenCalledWith(db, {
      isActive: true,
      categories: ['PLATES_SHEETS'],
      limitResults: 25,
    });
  });

  it('bought-out passes tenantId + category to the backend and filters query client-side', async () => {
    const pump = {
      ...boughtOut,
      id: 'bo-2',
      itemCode: 'BO-2026-0002',
      name: 'Centrifugal Pump',
      specCode: undefined,
      description: undefined,
    } as unknown as BoughtOutItem;
    (listBoughtOutItems as jest.Mock).mockResolvedValue([boughtOut, pump]);

    const results = await searchCatalog(db, {
      kind: 'BOUGHT_OUT',
      query: 'valve',
      category: 'VALVE',
      tenantId: 'tenant-x',
    });

    expect(listBoughtOutItems).toHaveBeenCalledWith(db, {
      tenantId: 'tenant-x',
      isActive: true,
      category: 'VALVE',
    });
    expect(results.map((r) => r.id)).toEqual(['bo-1']);
  });

  it('services filter query client-side against name/code/description', async () => {
    const other = {
      ...service,
      id: 'svc-2',
      serviceCode: 'SVC-ENG-001',
      name: 'Drawing Generation',
      description: undefined,
    } as unknown as Service;
    (listServices as jest.Mock).mockResolvedValue([service, other]);

    const results = await searchCatalog(db, { kind: 'SERVICE', query: 'hydro' });

    expect(results.map((r) => r.id)).toEqual(['svc-1']);
  });
});

// ============================================================================
// getCatalogItem — ref dispatch
// ============================================================================

describe('getCatalogItem', () => {
  it('dispatches on ref.kind to the right backend', async () => {
    (getBoughtOutItemById as jest.Mock).mockResolvedValue(boughtOut);

    const item = await getCatalogItem(db, {
      kind: 'BOUGHT_OUT',
      id: 'bo-1',
      code: 'BO-2026-0001',
      name: 'Gate Valve 2in SS316',
    });

    expect(getBoughtOutItemById).toHaveBeenCalledWith(db, 'bo-1');
    expect(getMaterialById).not.toHaveBeenCalled();
    expect(getServiceById).not.toHaveBeenCalled();
    expect(item).toEqual(boughtOutToCatalogItem(boughtOut));
  });

  it('returns null when the backing document is gone', async () => {
    (getMaterialById as jest.Mock).mockResolvedValue(null);

    const item = await getCatalogItem(db, {
      kind: 'RAW_MATERIAL',
      id: 'missing',
      code: 'X',
      name: 'X',
    });

    expect(item).toBeNull();
  });
});

// ============================================================================
// createCatalogItem — kind dispatch, returns CatalogRef
// ============================================================================

describe('createCatalogItem', () => {
  it('creates a material and returns its CatalogRef', async () => {
    (createMaterial as jest.Mock).mockResolvedValue(material);

    const input = { name: 'SS Plate 316L' } as unknown as never;
    const ref = await createCatalogItem(db, 'RAW_MATERIAL', input, 'user-1');

    expect(createMaterial).toHaveBeenCalledWith(db, input, 'user-1');
    expect(ref).toEqual({
      kind: 'RAW_MATERIAL',
      id: 'mat-1',
      code: 'PL-SS-316L',
      name: 'SS Plate 316L',
    });
  });

  it('creates a bought-out item via boughtOutService', async () => {
    (createBoughtOutItem as jest.Mock).mockResolvedValue(boughtOut);

    const input = { name: 'Gate Valve' } as unknown as never;
    const ref = await createCatalogItem(db, 'BOUGHT_OUT', input, 'user-1');

    expect(createBoughtOutItem).toHaveBeenCalledWith(db, input, 'user-1');
    expect(ref.kind).toBe('BOUGHT_OUT');
    expect(ref.code).toBe('BO-2026-0001');
  });

  it('creates a service, passing the payload tenantId through', async () => {
    (createService as jest.Mock).mockResolvedValue(service);

    const input = { name: 'Hydrostatic Testing', tenantId: 'tenant-x' } as unknown as never;
    const ref = await createCatalogItem(db, 'SERVICE', input, 'user-1');

    expect(createService).toHaveBeenCalledWith(db, input, 'user-1', 'tenant-x');
    expect(ref).toEqual({
      kind: 'SERVICE',
      id: 'svc-1',
      code: 'SVC-TST-001',
      name: 'Hydrostatic Testing',
    });
  });
});
