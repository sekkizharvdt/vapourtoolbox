/**
 * Thermal material mapping service tests (completion plan A3).
 *
 * Mocked-firestore repo style (mirrors bomService.test.ts): upsert
 * create/update semantics, idempotent doc ids, and batch lookup.
 */

/* eslint-disable @typescript-eslint/consistent-type-assertions */

import type { Firestore, Timestamp } from 'firebase/firestore';

const mockDoc = jest.fn();
const mockGetDoc = jest.fn();
const mockSetDoc = jest.fn();
const mockTimestampNow = jest.fn();

jest.mock('firebase/firestore', () => ({
  doc: (...args: unknown[]) => mockDoc(...args),
  getDoc: (...args: unknown[]) => mockGetDoc(...args),
  // runTransaction stub: delegates get/set to the single-doc mocks so the
  // real transaction code path runs without standing up a full tx.
  runTransaction: (_db: unknown, fn: (tx: unknown) => Promise<unknown>) =>
    fn({
      get: (...args: unknown[]) => mockGetDoc(...args),
      set: (ref: unknown, data: unknown) => mockSetDoc(ref, data),
    }),
  Timestamp: {
    now: () => mockTimestampNow(),
  },
}));

jest.mock('@vapour/firebase', () => ({
  COLLECTIONS: {
    THERMAL_MATERIAL_MAPPINGS: 'thermalMaterialMappings',
  },
}));

jest.mock('@vapour/logger', () => ({
  createLogger: () => ({
    info: jest.fn(),
    error: jest.fn(),
    debug: jest.fn(),
    warn: jest.fn(),
  }),
}));

import {
  getThermalMappings,
  upsertThermalMapping,
  normalizeThermalKey,
  thermalMappingDocId,
  mappingToCatalogRef,
  type ThermalMaterialMapping,
} from './thermalMaterialMappings';

describe('thermalMaterialMappings service', () => {
  const mockDb = {} as Firestore;
  const now = { seconds: 1703318400, nanoseconds: 0 } as Timestamp;
  const earlier = { seconds: 1600000000, nanoseconds: 0 } as Timestamp;
  const userId = 'user-123';

  beforeEach(() => {
    jest.clearAllMocks();
    mockTimestampNow.mockReturnValue(now);
    mockDoc.mockImplementation((_db: unknown, collectionName: unknown, id: unknown) => ({
      path: `${collectionName}/${id}`,
      id,
    }));
    mockSetDoc.mockResolvedValue(undefined);
  });

  describe('upsertThermalMapping', () => {
    const input = {
      sourceText: '  Duplex SS  UNS S32304 ',
      kind: 'RAW_MATERIAL' as const,
      targetId: 'mat-1',
      targetCode: 'RM-0042',
      targetName: 'Duplex SS Plate',
    };

    it('creates a new mapping with audit fields and the normalized key', async () => {
      mockGetDoc.mockResolvedValue({ exists: () => false });

      const saved = await upsertThermalMapping(mockDb, input, userId);

      expect(saved).toMatchObject({
        sourceText: 'Duplex SS  UNS S32304',
        normalizedKey: 'duplex ss uns s32304',
        kind: 'RAW_MATERIAL',
        targetId: 'mat-1',
        targetCode: 'RM-0042',
        targetName: 'Duplex SS Plate',
        createdBy: userId,
        createdAt: now,
        updatedBy: userId,
        updatedAt: now,
      });
      // Written to the deterministic doc id
      const expectedId = thermalMappingDocId('duplex ss uns s32304');
      expect(mockDoc).toHaveBeenCalledWith(mockDb, 'thermalMaterialMappings', expectedId);
      expect(mockSetDoc).toHaveBeenCalledWith(
        expect.objectContaining({ id: expectedId }),
        expect.objectContaining({ normalizedKey: 'duplex ss uns s32304' })
      );
    });

    it('preserves createdBy/createdAt when remapping an existing key', async () => {
      mockGetDoc.mockResolvedValue({
        exists: () => true,
        data: () => ({
          sourceText: 'Duplex SS UNS S32304',
          normalizedKey: 'duplex ss uns s32304',
          kind: 'RAW_MATERIAL',
          targetId: 'mat-old',
          targetCode: 'RM-0001',
          targetName: 'Old Target',
          createdBy: 'original-user',
          createdAt: earlier,
          updatedBy: 'original-user',
          updatedAt: earlier,
        }),
      });

      const saved = await upsertThermalMapping(
        mockDb,
        { ...input, targetId: 'boi-9', targetCode: 'BO-0009', kind: 'BOUGHT_OUT' },
        userId
      );

      expect(saved.createdBy).toBe('original-user');
      expect(saved.createdAt).toBe(earlier);
      expect(saved.updatedBy).toBe(userId);
      expect(saved.updatedAt).toBe(now);
      expect(saved.targetId).toBe('boi-9');
      expect(saved.kind).toBe('BOUGHT_OUT');
    });

    it('is idempotent — same source text always hits the same doc id', async () => {
      mockGetDoc.mockResolvedValue({ exists: () => false });

      await upsertThermalMapping(mockDb, input, userId);
      await upsertThermalMapping(mockDb, { ...input, sourceText: 'duplex ss uns s32304' }, userId);

      const ids = mockDoc.mock.calls.map((call) => call[2]);
      expect(ids[0]).toBe(ids[1]);
    });

    it('rejects an empty source string', async () => {
      await expect(
        upsertThermalMapping(mockDb, { ...input, sourceText: '   ' }, userId)
      ).rejects.toThrow('Cannot map an empty material string');
      expect(mockSetDoc).not.toHaveBeenCalled();
    });
  });

  describe('getThermalMappings', () => {
    it('returns a map keyed by normalizedKey, omitting missing docs', async () => {
      const mappingData = {
        sourceText: 'SS 316L',
        normalizedKey: 'ss 316l',
        kind: 'RAW_MATERIAL',
        targetId: 'mat-316',
        targetCode: 'RM-0316',
        targetName: 'SS 316L Plate',
        createdBy: userId,
        createdAt: now,
        updatedBy: userId,
        updatedAt: now,
      };

      mockGetDoc.mockImplementation((ref: { id: string }) =>
        Promise.resolve(
          ref.id === thermalMappingDocId('ss 316l')
            ? { exists: (): boolean => true, data: () => mappingData }
            : { exists: (): boolean => false }
        )
      );

      const result = await getThermalMappings(mockDb, ['ss 316l', 'unknown material', 'ss 316l']);

      expect(result.size).toBe(1);
      expect(result.get('ss 316l')).toMatchObject({ targetCode: 'RM-0316' });
      expect(result.has('unknown material')).toBe(false);
      // Duplicate keys deduped — 2 lookups, not 3
      expect(mockGetDoc).toHaveBeenCalledTimes(2);
    });
  });

  describe('mappingToCatalogRef', () => {
    it('projects the mapping onto the CatalogRef shape', () => {
      const mapping = {
        sourceText: 'x',
        normalizedKey: 'x',
        kind: 'BOUGHT_OUT',
        targetId: 'boi-1',
        targetCode: 'BO-0001',
        targetName: 'Pump',
        createdBy: userId,
        createdAt: now,
        updatedBy: userId,
        updatedAt: now,
      } as ThermalMaterialMapping;

      expect(mappingToCatalogRef(mapping)).toEqual({
        kind: 'BOUGHT_OUT',
        id: 'boi-1',
        code: 'BO-0001',
        name: 'Pump',
      });
    });
  });

  describe('normalizeThermalKey', () => {
    it('lowercases, trims, and collapses whitespace', () => {
      expect(normalizeThermalKey('  Titanium  SB 338\t Gr 2 ')).toBe('titanium sb 338 gr 2');
    });
  });
});
