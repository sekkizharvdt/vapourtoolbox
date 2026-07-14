/**
 * Thermal → BOM converter tests (completion plan A3).
 *
 * Covers: mapped material line (weight → kg quantity), mapped bought-out
 * line (piece-count quantity), unmapped → flagged zero-cost, normalization
 * idempotence, and the MED adapter's kind hints.
 */

/* eslint-disable @typescript-eslint/consistent-type-assertions */

import type { Timestamp } from 'firebase/firestore';
import { BOMItemType } from '@vapour/types';

jest.mock('firebase/firestore', () => ({
  doc: jest.fn(),
  getDoc: jest.fn(),
  runTransaction: jest.fn(),
  Timestamp: { now: jest.fn() },
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
  convertThermalLinesToBOMItems,
  distinctThermalKeys,
  medEquipmentToThermalLines,
  UNMAPPED_ITEM_PREFIX,
  type ThermalBOMLine,
} from './thermalBomImport';
import {
  normalizeThermalKey,
  thermalMappingDocId,
  type ThermalMaterialMapping,
} from './thermalMaterialMappings';
import type { MEDCompleteBOM } from '@/lib/thermal/medBOMGenerator';

const mockTimestamp = { seconds: 1703318400, nanoseconds: 0 } as Timestamp;

function makeMapping(overrides: Partial<ThermalMaterialMapping>): ThermalMaterialMapping {
  return {
    sourceText: 'Duplex SS UNS S32304',
    normalizedKey: 'duplex ss uns s32304',
    kind: 'RAW_MATERIAL',
    targetId: 'mat-duplex-1',
    targetCode: 'RM-0042',
    targetName: 'Duplex SS Plate UNS S32304',
    createdBy: 'user-1',
    createdAt: mockTimestamp,
    updatedBy: 'user-1',
    updatedAt: mockTimestamp,
    ...overrides,
  };
}

const materialLine: ThermalBOMLine = {
  description: 'Evaporator Shell E-01',
  materialText: 'Duplex SS UNS S32304',
  formHint: 'OD 1200mm × 3000mm L × 8mm thk',
  weightKg: 2255.5, // total gross weight for the line
  quantity: 1,
  unit: 'nos',
  kindHint: 'RAW_MATERIAL',
  notes: 'Tag: E-01',
};

const boughtOutLine: ThermalBOMLine = {
  description: 'Brine Recirculation Pump',
  materialText: 'Duplex SS Pump',
  weightKg: 0,
  quantity: 2,
  unit: 'nos',
  kindHint: 'BOUGHT_OUT',
};

describe('convertThermalLinesToBOMItems', () => {
  it('converts a mapped material line as a weight-priced kg quantity', () => {
    const mappings = new Map([['duplex ss uns s32304', makeMapping({})]]);

    const { items, unmappedLines } = convertThermalLinesToBOMItems([materialLine], mappings);

    expect(unmappedLines).toHaveLength(0);
    expect(items).toHaveLength(1);
    const item = items[0]!;
    expect(item.itemType).toBe(BOMItemType.MATERIAL);
    expect(item.name).toBe('Evaporator Shell E-01');
    // Weight-based: quantity is TOTAL kg so pricePerKg × quantity is the cost
    expect(item.quantity).toBe(2255.5);
    expect(item.unit).toBe('kg');
    // Material-backed component — the AddBOMItemDialog Materials-tab shape
    expect(item.componentType).toBe('BOUGHT_OUT');
    expect(item.materialId).toBe('mat-duplex-1');
    expect(item.boughtOutItemId).toBeUndefined();
    expect(item.catalogRef).toEqual({
      kind: 'RAW_MATERIAL',
      id: 'mat-duplex-1',
      code: 'RM-0042',
      name: 'Duplex SS Plate UNS S32304',
    });
    // Original design quantity survives in the description
    expect(item.description).toContain('Design qty: 1 nos');
    expect(item.description).toContain('2255.5 kg');
  });

  it('converts a mapped bought-out line with piece-count quantity (A2 bridge shape)', () => {
    const mappings = new Map([
      [
        'duplex ss pump',
        makeMapping({
          sourceText: 'Duplex SS Pump',
          normalizedKey: 'duplex ss pump',
          kind: 'BOUGHT_OUT',
          targetId: 'boi-77',
          targetCode: 'BO-0077',
          targetName: 'Recirc Pump 45 kW',
        }),
      ],
    ]);

    const { items, unmappedLines } = convertThermalLinesToBOMItems([boughtOutLine], mappings);

    expect(unmappedLines).toHaveLength(0);
    const item = items[0]!;
    expect(item.itemType).toBe(BOMItemType.PART);
    expect(item.quantity).toBe(2); // pieces, NOT kg
    expect(item.unit).toBe('nos');
    expect(item.componentType).toBe('BOUGHT_OUT');
    expect(item.boughtOutItemId).toBe('boi-77');
    expect(item.materialId).toBeUndefined(); // A2 bridge: no materialId
    expect(item.catalogRef?.kind).toBe('BOUGHT_OUT');
  });

  it('the saved mapping kind wins over the line kind hint', () => {
    // A "material" string the user mapped to a bought-out catalog item
    const mappings = new Map([
      [
        'duplex ss uns s32304',
        makeMapping({ kind: 'BOUGHT_OUT', targetId: 'boi-9', targetCode: 'BO-0009' }),
      ],
    ]);

    const { items } = convertThermalLinesToBOMItems([materialLine], mappings);
    const item = items[0]!;
    expect(item.boughtOutItemId).toBe('boi-9');
    expect(item.materialId).toBeUndefined();
    // Bought-out pricing is per piece — quantity stays the piece count
    expect(item.quantity).toBe(1);
    expect(item.unit).toBe('nos');
  });

  it('exports unmapped lines as flagged zero-cost items without blocking', () => {
    const { items, unmappedLines } = convertThermalLinesToBOMItems(
      [materialLine, boughtOutLine],
      new Map()
    );

    expect(items).toHaveLength(2);
    expect(unmappedLines).toHaveLength(2);

    const material = items[0]!;
    expect(material.name).toBe(`${UNMAPPED_ITEM_PREFIX} Evaporator Shell E-01`);
    expect(material.description).toContain('Material (unmapped): Duplex SS UNS S32304');
    // No component linkage at all → cost calculation skips → zero cost
    expect(material.componentType).toBeUndefined();
    expect(material.materialId).toBeUndefined();
    expect(material.boughtOutItemId).toBeUndefined();
    expect(material.catalogRef).toBeUndefined();
    // Weight-based hint keeps kg quantities so a later mapping prices as-is
    expect(material.quantity).toBe(2255.5);
    expect(material.unit).toBe('kg');

    const pump = items[1]!;
    expect(pump.name).toBe(`${UNMAPPED_ITEM_PREFIX} Brine Recirculation Pump`);
    expect(pump.quantity).toBe(2);
    expect(pump.unit).toBe('nos');
    expect(pump.componentType).toBeUndefined();
  });

  it('falls back to the generator quantity for a mapped material line without weight', () => {
    const weightless: ThermalBOMLine = { ...materialLine, weightKg: 0, quantity: 3, unit: 'nos' };
    const mappings = new Map([['duplex ss uns s32304', makeMapping({})]]);

    const { items } = convertThermalLinesToBOMItems([weightless], mappings);
    expect(items[0]!.quantity).toBe(3);
    expect(items[0]!.unit).toBe('nos');
  });
});

describe('normalizeThermalKey / thermalMappingDocId', () => {
  it('normalizes case, trim, and internal whitespace', () => {
    expect(normalizeThermalKey('  Duplex   SS\tUNS S32304 ')).toBe('duplex ss uns s32304');
  });

  it('is idempotent', () => {
    const once = normalizeThermalKey('  Titanium  SB 338  Gr 2 ');
    expect(normalizeThermalKey(once)).toBe(once);
  });

  it('doc ids are deterministic and distinguish colliding slugs', () => {
    const a = thermalMappingDocId(normalizeThermalKey('SS 316L'));
    const b = thermalMappingDocId(normalizeThermalKey('SS-316L'));
    expect(a).toBe(thermalMappingDocId(normalizeThermalKey('ss 316l')));
    // Same slug ('ss-316l') but different normalized keys → different ids
    expect(a).not.toBe(b);
    expect(a).not.toContain('/');
  });
});

describe('distinctThermalKeys', () => {
  it('dedupes by normalized key and counts lines', () => {
    const lines: ThermalBOMLine[] = [
      materialLine,
      { ...materialLine, materialText: ' duplex ss  UNS S32304' }, // same after normalize
      boughtOutLine,
    ];
    const distinct = distinctThermalKeys(lines);
    expect(distinct).toHaveLength(2);
    expect(distinct[0]).toMatchObject({
      normalizedKey: 'duplex ss uns s32304',
      lineCount: 2,
      kindHint: 'RAW_MATERIAL',
    });
    expect(distinct[1]).toMatchObject({ normalizedKey: 'duplex ss pump', lineCount: 1 });
  });
});

describe('medEquipmentToThermalLines (MED adapter)', () => {
  const medBOM = {
    equipment: [
      {
        itemNumber: '1.1.1',
        category: 'EVAPORATOR',
        description: 'Evaporator Shell E-01',
        tagNumber: 'E-01',
        quantity: 1,
        unit: 'nos',
        material: 'Duplex SS UNS S32304',
        specification: 'SA 240',
        netWeightKg: 2050,
        wastagePercent: 10,
        grossWeightKg: 2255,
        totalWeightKg: 2255,
        size: 'OD 1200mm × 3000mm L × 8mm thk',
        shapeType: 'CYLINDRICAL_SHELL',
      },
      {
        itemNumber: '4.1',
        category: 'PUMP',
        description: 'Brine Recirculation Pump',
        tagNumber: 'P-01',
        quantity: 2,
        unit: 'nos',
        material: 'Duplex SS',
        specification: '120 m³/h, 25 m TDH',
        netWeightKg: 0,
        wastagePercent: 0,
        grossWeightKg: 0,
        totalWeightKg: 0,
        size: '45 kW motor',
      },
      {
        itemNumber: '9.9',
        category: 'MISCELLANEOUS',
        description: 'Zero-qty placeholder',
        tagNumber: 'X-00',
        quantity: 0,
        unit: 'nos',
        material: 'N/A',
        specification: '',
        netWeightKg: 0,
        wastagePercent: 0,
        grossWeightKg: 0,
        totalWeightKg: 0,
        size: '',
      },
    ],
    instruments: [],
    valves: [],
    materialSummary: [],
    summary: {
      totalEquipmentItems: 3,
      totalInstruments: 0,
      totalValves: 0,
      totalWeight: 2255,
      categories: [],
    },
  } as unknown as MEDCompleteBOM;

  it('maps fabricated (shape-backed, weighed) items to RAW_MATERIAL hints', () => {
    const lines = medEquipmentToThermalLines(medBOM);
    expect(lines).toHaveLength(2); // zero-qty line dropped
    expect(lines[0]).toMatchObject({
      description: 'Evaporator Shell E-01',
      materialText: 'Duplex SS UNS S32304',
      weightKg: 2255,
      quantity: 1,
      unit: 'nos',
      kindHint: 'RAW_MATERIAL',
    });
    expect(lines[0]!.notes).toContain('Tag: E-01');
    expect(lines[0]!.notes).toContain('Spec: SA 240');
  });

  it('maps unweighed / shape-less items to BOUGHT_OUT hints', () => {
    const lines = medEquipmentToThermalLines(medBOM);
    expect(lines[1]).toMatchObject({
      description: 'Brine Recirculation Pump',
      materialText: 'Duplex SS',
      weightKg: 0,
      quantity: 2,
      kindHint: 'BOUGHT_OUT',
    });
  });
});
