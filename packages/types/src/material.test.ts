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
});
