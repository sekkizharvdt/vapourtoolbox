/**
 * Piping catalogue reads for the flange and fitting module pages.
 *
 * Flanges and fittings are priced per piece, so under the sizing model
 * (`CATALOG_SIZING`) they are bought-out items, and the taxonomy migration
 * moves them into `bought_out_items` as products carrying one variant per
 * NPS + class (flanges) or NPS + schedule (fittings).
 *
 * The module pages predate that and read flat `materials` documents. This
 * module gives them one row shape regardless of where the data currently
 * lives, so the pages keep their filters, table and pagination untouched.
 *
 * The `materials` fallback is deliberate and temporary: it exists only for the
 * window between this code shipping and the migration running, and its removal
 * point is documented in docs/reviews/2026-08-16-materials-taxonomy-cleanup.md.
 * Once `bought_out_items` carries the piping products, `loadPipingCatalog`
 * returns those and the fallback goes unused — delete it then.
 */

import { collection, getDocs, query, where, type Firestore } from 'firebase/firestore';
import { COLLECTIONS } from '@vapour/firebase';
import type { BoughtOutItem, Material, MaterialCategory } from '@vapour/types';
import { queryMaterials } from '@/lib/materials/queries';

/**
 * One orderable piping article, flattened. Field names match the `materials`
 * documents the pages were written against, so their table code is unchanged.
 */
export interface PipingCatalogRow {
  /** Unique per row: `${itemId}:${variantId}`, or the material id pre-migration. */
  id: string;
  /** Variant code post-migration, materialCode before it. */
  materialCode: string;
  /** Product name. */
  name: string;
  /** Original MaterialCategory string — drives the type filter on both pages. */
  category: string;
  specification?: { standard?: string; grade?: string };
  seedMetadata?: { standard?: string; specification?: string };
  isActive?: boolean;

  // Dimensional fields, declared rather than left to an index signature so the
  // pages keep their types. This is every field the migration carries — see
  // NON_DIMENSIONAL_FIELDS in scripts/analysis/migrate-boughtout-taxonomy.js.
  nps?: string;
  dn?: string;
  pressureClass?: string;
  schedule?: string;
  scheduleType?: string;
  fittingType?: string;
  applicableSchedules?: string | string[];
  outsideDiameter_mm?: number;
  outsideDiameter_inch?: number;
  wallThickness_mm?: number;
  thickness_mm?: number;
  thickness_inch?: number;
  boltCircle_mm?: number;
  boltCircle_inch?: number;
  boltHoles?: number;
  boltSize_inch?: string;
  raisedFace_mm?: number;
  raisedFace_inch?: number;
  centerToEnd_mm?: number;
  centerToEnd_inch?: number;
  endToEnd_mm?: number;
  endToEnd_inch?: number;
  largeEnd_mm?: number;
  largeEnd_inch?: number;
  smallEnd_mm?: number;
  smallEnd_inch?: number;
  weightPerPiece_kg?: number;
  weightPerMeter_kg?: number;
  certifications?: string[];
}

/** Which module page is asking. */
export type PipingKind = 'flanges' | 'fittings';

/**
 * True when a bought-out item came from the piping catalogue — its variants
 * carry `migratedFromMaterialCode` and an original `category`.
 */
function pipingRowsFromItem(item: BoughtOutItem, kind: PipingKind): PipingCatalogRow[] {
  const wanted = kind === 'flanges' ? /^FLANGES/ : /^FITTINGS/;
  return (item.variants ?? []).flatMap((variant) => {
    const spec = (variant.specifications ?? {}) as Record<string, unknown>;
    const category = String(spec.category ?? spec.sourceCategory ?? item.itemCode);
    // The migration keeps the original category on the variant only when it
    // differs per variant; otherwise infer from the product code.
    const resolved = wanted.test(category) ? category : inferCategory(item, kind);
    if (!resolved) return [];
    const row: PipingCatalogRow = {
      ...spec,
      id: `${item.id}:${variant.id}`,
      materialCode: variant.migratedFromMaterialCode ?? variant.variantCode,
      name: item.name,
      category: resolved,
      isActive: variant.isAvailable !== false,
    };
    return [row];
  });
}

/** Product code → original material category, e.g. `FL-WN-…` → FLANGES_WELD_NECK. */
function inferCategory(item: BoughtOutItem, kind: PipingKind): string | null {
  const code = String(item.itemCode);
  if (kind === 'flanges') {
    if (code.startsWith('FL-WN')) return 'FLANGES_WELD_NECK';
    if (code.startsWith('FL-SO')) return 'FLANGES_SLIP_ON';
    if (code.startsWith('FL-BL')) return 'FLANGES_BLIND';
    return code.startsWith('FL-') ? 'FLANGES' : null;
  }
  if (code.startsWith('FT-BW')) return 'FITTINGS_BUTT_WELD';
  if (code.startsWith('FT-SW')) return 'FITTINGS_SOCKET_WELD';
  return code.startsWith('FT-') ? 'FITTINGS_BUTT_WELD' : null;
}

/** Flatten a pre-migration `materials` document into the same row shape. */
function rowFromMaterial(material: Material): PipingCatalogRow {
  return { ...material, id: material.id, name: material.name } as unknown as PipingCatalogRow;
}

/**
 * Every orderable article for a piping kind, from wherever it currently lives.
 *
 * Prefers `bought_out_items`; falls back to `materials` while the migration is
 * pending. Never merges the two — a document that has moved is flagged
 * `isMigrated` and `queryMaterials` already drops it, so double-counting is
 * not possible either way.
 */
export async function loadPipingCatalog(
  db: Firestore,
  kind: PipingKind,
  fallbackCategories: MaterialCategory[]
): Promise<PipingCatalogRow[]> {
  const prefix = kind === 'flanges' ? 'FL-' : 'FT-';

  // `bought_out_items` is small (a few hundred docs) and the piping products
  // are identified by their itemCode prefix, so one unfiltered read is cheaper
  // than an index for a range query on itemCode.
  const snapshot = await getDocs(
    query(collection(db, COLLECTIONS.BOUGHT_OUT_ITEMS), where('isActive', '==', true))
  );
  const items: BoughtOutItem[] = snapshot.docs.map((d) => {
    const item: BoughtOutItem = { id: d.id, ...(d.data() as Omit<BoughtOutItem, 'id'>) };
    return item;
  });
  const products = items.filter(
    (i) => String(i.itemCode).startsWith(prefix) && (i.variants?.length ?? 0) > 0
  );

  if (products.length > 0) {
    return products.flatMap((item) => pipingRowsFromItem(item, kind));
  }

  const { materials } = await queryMaterials(db, {
    categories: fallbackCategories,
    sortField: 'materialCode',
    sortDirection: 'asc',
    limitResults: 1000,
  });
  return materials.filter((m) => m.isActive !== false).map(rowFromMaterial);
}
