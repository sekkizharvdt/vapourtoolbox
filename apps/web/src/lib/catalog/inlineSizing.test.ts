import { Timestamp } from 'firebase/firestore';
import { MaterialCategory, type Material, type MaterialVariant } from '@vapour/types';
import {
  buildCascade,
  buildMaterialOptions,
  materialOptionIdFor,
  parseMaterialOptionId,
  compareNpsValues,
  getKindForMaterial,
  getRawMaterialKinds,
  orderSizingForKind,
  resolveMaterial,
} from './inlineSizing';

const EPOCH = Timestamp.fromDate(new Date(0));
const AUDIT = { createdAt: EPOCH, updatedAt: EPOCH, createdBy: 't', updatedBy: 't' };

function material(overrides: Partial<Material>): Material {
  const base: Material = {
    ...AUDIT,
    id: 'm',
    materialCode: 'M',
    name: 'M',
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

function variant(id: string, code: string, thickness: number): MaterialVariant {
  const v: MaterialVariant = {
    ...AUDIT,
    id,
    variantCode: code,
    displayName: `${code} thickness`,
    dimensions: { thickness },
    isAvailable: true,
    priceHistory: [],
  };
  return v;
}

const plate = material({
  id: 'pl1',
  materialCode: 'PL-CS-A36',
  name: 'Carbon Steel A36 Plate',
  category: MaterialCategory.PLATES_CARBON_STEEL,
  baseUnit: 'kg',
  hasVariants: true,
  variants: [variant('v1', '3mm', 3), variant('v2', '6mm', 6)],
});

const pipe = (id: string, nps: string, schedule: string): Material =>
  material({
    id,
    materialCode: `PP-CS-A106-SMLS-${nps}-SCH${schedule}`,
    name: `Carbon Steel Pipe ASTM A106 Seamless NPS ${nps} Sch ${schedule}`,
    category: MaterialCategory.PIPES_CARBON_STEEL,
    baseUnit: 'meter',
    familyCode: 'PP-CS-A106-SMLS',
    nps,
    schedule,
  });

const pipes = [pipe('p1', '4', '40'), pipe('p2', '4', '80'), pipe('p3', '10', '40')];

describe('getRawMaterialKinds', () => {
  it('offers plates and pipes, and never a piece-priced group', () => {
    const keys = getRawMaterialKinds().map((k) => k.key);
    expect(keys).toEqual(expect.arrayContaining(['plates', 'pipes']));
    expect(keys).not.toContain('flanges');
    expect(keys).not.toContain('fittings');
    expect(keys).not.toContain('valves');
  });

  it('reports the pricing unit that made each kind qualify', () => {
    const kinds = getRawMaterialKinds();
    expect(kinds.find((k) => k.key === 'plates')?.pricingUnit).toBe('KG');
    expect(kinds.find((k) => k.key === 'pipes')?.pricingUnit).toBe('METER');
  });
});

describe('orderSizingForKind', () => {
  it('asks a plate for a shape and a pipe for a length', () => {
    const kinds = getRawMaterialKinds();
    expect(orderSizingForKind(kinds.find((k) => k.key === 'plates')!)).toBe('SHAPE');
    expect(orderSizingForKind(kinds.find((k) => k.key === 'pipes')!)).toBe('LENGTH');
  });
});

describe('getKindForMaterial', () => {
  it('places a plate and a pipe', () => {
    expect(getKindForMaterial(plate)?.key).toBe('plates');
    expect(getKindForMaterial(pipes[0]!)?.key).toBe('pipes');
  });

  it('returns null for something not inline-selectable', () => {
    expect(getKindForMaterial(material({ category: MaterialCategory.VALVE_GATE }))).toBeNull();
  });
});

describe('compareNpsValues', () => {
  it('orders fractions, mixed numbers and integers numerically', () => {
    expect(['10', '1/2', '2 1/2', '2', '1-1/4'].sort(compareNpsValues)).toEqual([
      '1/2',
      '1-1/4',
      '2',
      '2 1/2',
      '10',
    ]);
  });
});

describe('buildCascade — plates', () => {
  const kind = getRawMaterialKinds().find((k) => k.key === 'plates')!;

  it('starts with grade alone, before one is chosen', () => {
    const steps = buildCascade(kind, [plate], {});
    expect(steps.map((s) => s.field)).toEqual(['grade']);
    expect(steps[0]!.options).toEqual([{ value: 'pl1', label: 'Carbon Steel A36 Plate' }]);
  });

  it('adds thickness from the chosen grade’s variants', () => {
    const steps = buildCascade(kind, [plate], { grade: 'pl1' });
    expect(steps.map((s) => s.field)).toEqual(['grade', 'thickness']);
    // The stored displayName is "3mm thickness"; the option shows the code
    // alone, since the control is already labelled Thickness.
    expect(steps[1]!.options.map((o) => o.label)).toEqual(['3mm', '6mm']);
  });
});

describe('buildCascade — pipes', () => {
  const kind = getRawMaterialKinds().find((k) => k.key === 'pipes')!;

  it('leads with the family, then NPS, then schedule', () => {
    const steps = buildCascade(kind, pipes, {});
    expect(steps.map((s) => s.field)).toEqual(['family', 'nps', 'schedule']);
    expect(steps[0]!.options[0]!.label).toBe('Carbon Steel Pipe ASTM A106 Seamless');
  });

  it('narrows schedule to what the chosen NPS actually offers', () => {
    const all = buildCascade(kind, pipes, { family: 'PP-CS-A106-SMLS' });
    expect(all.find((s) => s.field === 'schedule')!.options.map((o) => o.value)).toEqual([
      '40',
      '80',
    ]);

    const at10 = buildCascade(kind, pipes, { family: 'PP-CS-A106-SMLS', nps: '10' });
    expect(at10.find((s) => s.field === 'schedule')!.options.map((o) => o.value)).toEqual(['40']);
  });

  it('sorts NPS numerically, not lexically', () => {
    const steps = buildCascade(kind, pipes, { family: 'PP-CS-A106-SMLS' });
    expect(steps.find((s) => s.field === 'nps')!.options.map((o) => o.value)).toEqual(['4', '10']);
  });
});

describe('resolveMaterial', () => {
  const plates = getRawMaterialKinds().find((k) => k.key === 'plates')!;
  const pipeKind = getRawMaterialKinds().find((k) => k.key === 'pipes')!;

  it('resolves a plate only once a thickness is chosen', () => {
    expect(resolveMaterial(plates, [plate], { grade: 'pl1' })).toBeNull();
    const got = resolveMaterial(plates, [plate], { grade: 'pl1', thickness: 'v2' });
    expect(got?.material.materialCode).toBe('PL-CS-A36');
    expect(got?.variant?.variantCode).toBe('6mm');
  });

  it('resolves a pipe to exactly one document', () => {
    const got = resolveMaterial(pipeKind, pipes, {
      family: 'PP-CS-A106-SMLS',
      nps: '4',
      schedule: '80',
    });
    expect(got?.material.materialCode).toBe('PP-CS-A106-SMLS-4-SCH80');
    expect(got?.variant).toBeUndefined();
  });

  it('is null while the cascade is incomplete', () => {
    expect(resolveMaterial(pipeKind, pipes, { family: 'PP-CS-A106-SMLS', nps: '4' })).toBeNull();
  });
});

describe('buildMaterialOptions — kind and grade merged into one control', () => {
  it('groups every plate grade and pipe family into a single list', () => {
    const groups = buildMaterialOptions([plate, ...pipes]);
    expect(groups.map((g) => g.label)).toEqual(['Plates', 'Pipes']);
    expect(groups[0]!.options.map((o) => o.label)).toEqual(['Carbon Steel A36 Plate']);
    // Three pipe documents, one family — the family is what you pick.
    expect(groups[1]!.options.map((o) => o.label)).toEqual([
      'Carbon Steel Pipe ASTM A106 Seamless',
    ]);
  });

  it('round-trips an option id through select and back', () => {
    const groups = buildMaterialOptions([plate, ...pipes]);
    const option = groups[0]!.options[0]!;

    const parsed = parseMaterialOptionId(option.id);
    expect(parsed).toEqual({ kindKey: 'plates', field: 'grade', value: 'pl1' });

    // What the component stores, and what it reads back to show the selection.
    const state = { kindKey: parsed!.kindKey, chosen: { [parsed!.field]: parsed!.value } };
    expect(materialOptionIdFor(state)).toBe(option.id);
  });

  it('round-trips a pipe family, whose first field is `family` not `grade`', () => {
    const groups = buildMaterialOptions([plate, ...pipes]);
    const option = groups[1]!.options[0]!;
    const parsed = parseMaterialOptionId(option.id)!;
    expect(parsed.field).toBe('family');
    expect(materialOptionIdFor({ kindKey: 'pipes', chosen: { family: parsed.value } })).toBe(
      option.id
    );
  });

  it('is empty for a state with nothing chosen, and for a bad id', () => {
    expect(materialOptionIdFor({ kindKey: '', chosen: {} })).toBe('');
    expect(materialOptionIdFor({ kindKey: 'plates', chosen: {} })).toBe('');
    expect(parseMaterialOptionId('nonsense')).toBeNull();
  });
});
