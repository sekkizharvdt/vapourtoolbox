import { getCatalogSizing } from './catalog';
import {
  MaterialCategory,
  MATERIAL_CATEGORY_GROUPS,
  MATERIAL_MODULE_TILE_GROUPS,
} from './material';

describe('MATERIAL_CATEGORY_GROUPS partition', () => {
  const allCategories = Object.values(MaterialCategory);
  const grouped = MATERIAL_CATEGORY_GROUPS.flatMap((g) => g.categories);

  it('covers every MaterialCategory exactly once (no material is unreachable in the picker)', () => {
    const counts = new Map<MaterialCategory, number>();
    for (const c of grouped) counts.set(c, (counts.get(c) ?? 0) + 1);

    const missing = allCategories.filter((c) => !counts.has(c));
    const duplicated = [...counts.entries()].filter(([, n]) => n > 1).map(([c]) => c);

    expect({ missing, duplicated }).toEqual({ missing: [], duplicated: [] });
  });

  it('references only valid MaterialCategory values', () => {
    const valid = new Set<string>(allCategories);
    expect(grouped.filter((c) => !valid.has(c))).toEqual([]);
  });

  it('has unique group keys', () => {
    const keys = MATERIAL_CATEGORY_GROUPS.map((g) => g.key);
    expect(new Set(keys).size).toBe(keys.length);
  });

  it('module tile groups all carry a moduleRoute', () => {
    expect(MATERIAL_MODULE_TILE_GROUPS.every((g) => typeof g.moduleRoute === 'string')).toBe(true);
    // The module surfaces a strict subset of all groups.
    expect(MATERIAL_MODULE_TILE_GROUPS.length).toBeLessThanOrEqual(MATERIAL_CATEGORY_GROUPS.length);
  });

  // The Materials module is for RAW material — stock you cut and fabricate,
  // priced by weight or length. Finished articles priced per piece live in
  // `bought_out_items` since the Aug-2026 taxonomy split, so a tile for them
  // here opens onto an empty list. That is exactly how the module and the PR
  // picker came to look like two different databases (feedback huqiaePA).
  // Enforced rather than remembered: adding a tile for a PIECE-priced group
  // fails here.
  it('only surfaces tiles for groups that actually hold raw material', () => {
    const offenders = MATERIAL_MODULE_TILE_GROUPS.filter((g) =>
      g.categories.some((c) => getCatalogSizing(c).pricingUnit === 'PIECE')
    ).map((g) => g.key);

    expect(offenders).toEqual([]);
  });

  it('surfaces every raw-material group as a tile, so none becomes unreachable', () => {
    const rawGroups = MATERIAL_CATEGORY_GROUPS.filter(
      (g) =>
        g.categories.length > 0 &&
        g.categories.every((c) => getCatalogSizing(c).pricingUnit !== 'PIECE')
    ).map((g) => g.key);

    expect(MATERIAL_MODULE_TILE_GROUPS.map((g) => g.key).sort()).toEqual(rawGroups.sort());
  });
});
