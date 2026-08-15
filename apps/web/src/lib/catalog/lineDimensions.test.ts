import { Timestamp } from 'firebase/firestore';
import { MaterialCategory, type Material, type MaterialVariant } from '@vapour/types';
import { getShapeById } from '@/lib/shapes/shapeData';
import {
  buildLineDimensions,
  describeLineDimensions,
  formatLineDimensions,
  getShapesForMaterial,
  getUserParameters,
  getVariantThickness,
  needsDimensions,
  withQuantity,
} from './lineDimensions';

// `fromDate` is what the firebase/firestore mock in jest.setup.ts provides.
const EPOCH = Timestamp.fromDate(new Date(0));
const AUDIT = {
  createdAt: EPOCH,
  updatedAt: EPOCH,
  createdBy: 'test',
  updatedBy: 'test',
};

/** Baseline material — the module only reads category, properties and variants. */
function material(overrides: Partial<Material>): Material {
  const base: Material = {
    ...AUDIT,
    id: 'mat-0',
    materialCode: 'MAT-0',
    name: 'Material',
    description: '',
    category: MaterialCategory.OTHER,
    materialType: 'RAW_MATERIAL',
    specification: {},
    properties: {},
    hasVariants: false,
    baseUnit: 'NOS',
    preferredVendors: [],
    priceHistory: [],
    trackInventory: false,
    tags: [],
    isActive: true,
    isStandard: false,
  };
  return { ...base, ...overrides };
}

function plateMaterial(overrides: Partial<Material> = {}): Material {
  return material({
    id: 'mat-1',
    materialCode: 'PL-CS-516-70',
    name: 'Carbon Steel SA 516 Gr 70 Plate',
    category: MaterialCategory.PLATES_CARBON_STEEL,
    properties: { density: 7850, densityUnit: 'kg/m3' },
    hasVariants: true,
    baseUnit: 'kg',
    ...overrides,
  });
}

function pipeMaterial(): Material {
  return material({
    id: 'mat-2',
    materialCode: 'PP-CS-A106-SMLS-4-SCH40',
    name: 'Carbon Steel Pipe ASTM A106 Seamless NPS 4 Sch 40',
    category: MaterialCategory.PIPES_CARBON_STEEL,
    properties: { density: 7850 },
    baseUnit: 'meter',
  });
}

const sixMm: MaterialVariant = {
  ...AUDIT,
  id: 'v004',
  variantCode: '6mm',
  displayName: '6mm thickness',
  dimensions: { thickness: 6 },
  weightPerUnit: 47.1,
  isAvailable: true,
  priceHistory: [],
};

describe('needsDimensions', () => {
  it('is true for plates (the variants model)', () => {
    expect(needsDimensions(plateMaterial())).toBe(true);
  });

  it('is false for piping — the material doc already fixes NPS and schedule', () => {
    expect(needsDimensions(pipeMaterial())).toBe(false);
  });
});

describe('getShapesForMaterial', () => {
  it('offers the three plate shapes for a carbon steel plate', () => {
    const ids = getShapesForMaterial(plateMaterial()).map((s) => s.id);
    expect(ids).toEqual(
      expect.arrayContaining(['plate-rectangular', 'plate-circular', 'plate-custom'])
    );
  });

  it('does not offer plate shapes for a pipe', () => {
    // Piping is claimed by tube/nozzle shapes, so the list is not empty — but
    // a pipe must never be offered a plate. `needsDimensions` is what gates the
    // step; this only guards the offer list itself.
    const ids = getShapesForMaterial(pipeMaterial()).map((s) => s.id);
    expect(ids).not.toContain('plate-rectangular');
    expect(ids).not.toContain('plate-circular');
  });
});

describe('getUserParameters', () => {
  it('asks only for length and width — thickness comes from the variant, and the optional cutting allowance is not a procurement callout', () => {
    const shape = getShapeById('plate-rectangular')!;
    expect(getUserParameters(shape).map((p) => p.name)).toEqual(['L', 'W']);
  });

  it('asks for diameter alone on a circular plate', () => {
    const shape = getShapeById('plate-circular')!;
    expect(getUserParameters(shape).map((p) => p.name)).toEqual(['D']);
  });
});

describe('getVariantThickness', () => {
  it('reads the variant thickness', () => {
    expect(getVariantThickness(sixMm)).toBe(6);
  });

  it('is undefined when no variant is chosen', () => {
    expect(getVariantThickness(undefined)).toBeUndefined();
  });
});

describe('buildLineDimensions', () => {
  const shape = getShapeById('plate-rectangular')!;

  it('derives per-piece and total weight from L × W × t × density', () => {
    const dims = buildLineDimensions({
      shape,
      material: plateMaterial(),
      variant: sixMm,
      parameters: { L: 2000, W: 1000 },
      quantity: 2,
    });

    // 2.0 m × 1.0 m × 0.006 m × 7850 kg/m³ = 94.2 kg per piece
    expect(dims.unitWeightKg).toBe(94.2);
    expect(dims.totalWeightKg).toBe(188.4);
  });

  it('folds the variant thickness into the stored parameters', () => {
    const dims = buildLineDimensions({
      shape,
      material: plateMaterial(),
      variant: sixMm,
      parameters: { L: 2000, W: 1000 },
      quantity: 1,
    });

    expect(dims.parameters).toEqual({ L: 2000, W: 1000, t: 6 });
    expect(dims.shapeId).toBe('plate-rectangular');
    expect(dims.shapeName).toBe('Rectangular Plate');
    expect(dims.variantId).toBe('v004');
    expect(dims.variantCode).toBe('6mm');
  });

  it('uses the material density, not a steel constant', () => {
    const stainless = buildLineDimensions({
      shape,
      material: plateMaterial({ properties: { density: 8000, densityUnit: 'kg/m3' } }),
      variant: sixMm,
      parameters: { L: 2000, W: 1000 },
      quantity: 1,
    });

    // Same geometry, 8000 kg/m³ → 96.0 kg rather than 94.2 kg.
    expect(stainless.unitWeightKg).toBe(96);
  });

  it('omits weights rather than storing zero when a dimension is missing', () => {
    const dims = buildLineDimensions({
      shape,
      material: plateMaterial(),
      variant: sixMm,
      parameters: { L: 0, W: 0 },
      quantity: 1,
    });

    expect(dims.unitWeightKg).toBeUndefined();
    expect(dims.totalWeightKg).toBeUndefined();
  });

  it('handles a circular plate', () => {
    const circular = getShapeById('plate-circular')!;
    const dims = buildLineDimensions({
      shape: circular,
      material: plateMaterial(),
      variant: sixMm,
      parameters: { D: 1000 },
      quantity: 1,
    });

    // π/4 × 1.0² m² × 0.006 m × 7850 = 36.99 kg
    expect(dims.unitWeightKg).toBeCloseTo(36.99, 1);
  });
});

describe('withQuantity', () => {
  it('rescales the total without touching the unit weight', () => {
    const dims = {
      shapeId: 'plate-rectangular',
      shapeName: 'Rectangular Plate',
      parameters: { L: 2000, W: 1000, t: 6 },
      unitWeightKg: 94.2,
      totalWeightKg: 94.2,
    };
    expect(withQuantity(dims, 3)).toMatchObject({ unitWeightKg: 94.2, totalWeightKg: 282.6 });
  });

  it('leaves a weightless record alone', () => {
    const dims = { shapeId: 'plate-rectangular', shapeName: 'Rectangular Plate', parameters: {} };
    expect(withQuantity(dims, 5)).toBe(dims);
  });
});

describe('formatLineDimensions', () => {
  it('prints parameters in shape order with thickness last', () => {
    // Stored key order is deliberately scrambled here — the shape's own
    // parameter order is what must drive the output.
    expect(
      formatLineDimensions({
        shapeId: 'plate-rectangular',
        shapeName: 'Rectangular Plate',
        parameters: { t: 6, W: 1000, L: 2000 },
      })
    ).toBe('2000 × 1000 × 6 mm');
  });

  it('falls back to stored order for an unknown shape', () => {
    expect(
      formatLineDimensions({
        shapeId: 'shape-that-was-deleted',
        shapeName: 'Gone',
        parameters: { L: 100, t: 5 },
      })
    ).toBe('100 × 5 mm');
  });

  it('is empty when there are no parameters', () => {
    expect(
      formatLineDimensions({
        shapeId: 'plate-rectangular',
        shapeName: 'Rectangular Plate',
        parameters: {},
      })
    ).toBe('');
  });
});

describe('describeLineDimensions', () => {
  it('reads as a document line', () => {
    expect(
      describeLineDimensions({
        shapeId: 'plate-rectangular',
        shapeName: 'Rectangular Plate',
        parameters: { L: 2000, W: 1000, t: 6 },
        unitWeightKg: 94.2,
        totalWeightKg: 188.4,
      })
    ).toBe('Rectangular Plate 2000 × 1000 × 6 mm — 188.4 kg total');
  });

  it('drops the weight clause when none was derived', () => {
    expect(
      describeLineDimensions({
        shapeId: 'plate-rectangular',
        shapeName: 'Rectangular Plate',
        parameters: { L: 2000, W: 1000, t: 6 },
      })
    ).toBe('Rectangular Plate 2000 × 1000 × 6 mm');
  });
});
