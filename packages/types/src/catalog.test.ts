import {
  CATALOG_TAXONOMY,
  getCatalogCategoryOptions,
  itemTypeToCatalogKind,
  catalogKindToItemType,
  type CatalogKind,
} from './catalog';
import { MaterialCategory, MATERIAL_CATEGORY_GROUPS } from './material';
import { BOUGHT_OUT_CATEGORY_LABELS } from './boughtOut';
import { ServiceCategory } from './service';

const ALL_KINDS: CatalogKind[] = ['RAW_MATERIAL', 'BOUGHT_OUT', 'SERVICE'];

describe('CATALOG_TAXONOMY registry (design 2026-06-15 §3.4)', () => {
  it('RAW_MATERIAL mirrors MATERIAL_CATEGORY_GROUPS (same groups, same category values)', () => {
    expect(CATALOG_TAXONOMY.RAW_MATERIAL.map((g) => g.key)).toEqual(
      MATERIAL_CATEGORY_GROUPS.map((g) => g.key)
    );
    expect(CATALOG_TAXONOMY.RAW_MATERIAL.flatMap((g) => g.categories.map((c) => c.value))).toEqual(
      MATERIAL_CATEGORY_GROUPS.flatMap((g) => g.categories)
    );
  });

  it('RAW_MATERIAL covers every MaterialCategory exactly once', () => {
    const values = getCatalogCategoryOptions('RAW_MATERIAL').map((c) => c.value);
    expect([...values].sort()).toEqual(Object.values(MaterialCategory).sort());
    expect(new Set(values).size).toBe(values.length);
  });

  it('BOUGHT_OUT covers every BoughtOutCategory exactly once', () => {
    const values = getCatalogCategoryOptions('BOUGHT_OUT').map((c) => c.value);
    expect([...values].sort()).toEqual(Object.keys(BOUGHT_OUT_CATEGORY_LABELS).sort());
    expect(new Set(values).size).toBe(values.length);
  });

  it('SERVICE covers every ServiceCategory exactly once', () => {
    const values = getCatalogCategoryOptions('SERVICE').map((c) => c.value);
    expect([...values].sort()).toEqual(Object.values(ServiceCategory).sort());
    expect(new Set(values).size).toBe(values.length);
  });

  it('every category option carries a non-empty label', () => {
    for (const kind of ALL_KINDS) {
      for (const option of getCatalogCategoryOptions(kind)) {
        expect(option.label).toBeTruthy();
      }
    }
  });

  it('group keys are unique within each kind', () => {
    for (const kind of ALL_KINDS) {
      const keys = CATALOG_TAXONOMY[kind].map((g) => g.key);
      expect(new Set(keys).size).toBe(keys.length);
    }
  });
});

describe('itemType ↔ CatalogKind bridge', () => {
  it('round-trips every kind', () => {
    for (const kind of ALL_KINDS) {
      expect(itemTypeToCatalogKind(catalogKindToItemType(kind))).toBe(kind);
    }
  });
});
