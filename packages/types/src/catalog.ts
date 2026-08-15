/**
 * Catalog Facade Types
 *
 * The procurement catalog is a FACADE over three specialized, schema-divergent
 * Firestore collections that stay separate (no merge, no migration):
 *   - `materials`        → kind 'RAW_MATERIAL' (code = materialCode)
 *   - `bought_out_items` → kind 'BOUGHT_OUT'   (code = itemCode)
 *   - `services`         → kind 'SERVICE'      (code = serviceCode)
 *
 * Every consumer line (PR, RFQ, Quote, PO, BOM) carries one `CatalogRef`
 * instead of branching on per-kind id triplets.
 *
 * Design of record: docs/reviews/2026-06-15-procurement-catalog-unification.md §3.1
 */

import type { PurchaseRequestItemType } from './procurement/purchaseRequest';
import { MATERIAL_CATEGORY_GROUPS, MATERIAL_CATEGORY_LABELS } from './material';
import { BOUGHT_OUT_CATEGORY_LABELS } from './boughtOut';
import { SERVICE_CATEGORY_LABELS } from './service';

export type CatalogKind = 'RAW_MATERIAL' | 'BOUGHT_OUT' | 'SERVICE';

/**
 * Discriminated reference to a catalog item, denormalized per rule 26 so
 * downstream reads (dashboards, PDFs) don't re-fetch the backing document.
 */
export interface CatalogRef {
  kind: CatalogKind;
  /** Doc id in the backing collection (materials / bought_out_items / services). */
  id: string;
  /** Human-readable code: materialCode | itemCode | serviceCode. */
  code: string;
  /** Denormalized display name. */
  name: string;
}

/**
 * How a raw-material line is dimensioned — the plate/section size the engineer
 * actually wants, captured structurally instead of typed into `specification`.
 *
 * Only RAW_MATERIAL lines whose material uses the variants model (plates —
 * `usesVariantModel(category)`) carry this. Piping needs none: a pipe document
 * IS its NPS + schedule, so picking the material already fixes the section, and
 * length rides on `quantity` in metres.
 *
 * The shape/parameter vocabulary is the existing shapes dataset
 * (`apps/web/src/data/shapes`, ids like `plate-rectangular`), and the weights
 * are produced by the same `calculateShape` the BOM editor uses — this is a
 * second CONSUMER of that model, not a second copy of it (rule 32).
 *
 * Weights are denormalized (rule 26) so PDFs, vendor comparison and reports
 * never re-run the calculator or re-fetch the shape.
 */
export interface CatalogLineDimensions {
  /** Shape id from the shapes dataset, e.g. `plate-rectangular`. */
  shapeId: string;
  /** Denormalized shape name for display, e.g. "Rectangular Plate". */
  shapeName: string;

  /** Selected `MaterialVariant.id` — for plates, the thickness variant. */
  variantId?: string;
  /** Denormalized variant code, e.g. "6mm". */
  variantCode?: string;

  /**
   * Shape parameter values in **mm**, keyed by the shape's own parameter names
   * (`{ L: 2000, W: 1000, t: 6 }`). Same shape as `BOMItem.component.parameters`.
   */
  parameters: Record<string, number>;

  /** Weight of ONE piece, kg — derived, rounded to 3 decimals. */
  unitWeightKg?: number;
  /** `unitWeightKg × quantity`, kg — derived, rounded to 3 decimals. */
  totalWeightKg?: number;
}

// ============================================================================
// Phase-1 `itemType` ↔ CatalogKind mapping
// ============================================================================
//
// Phase 1 (commit c86c0c38) shipped PR line items with
// `itemType: 'MATERIAL' | 'BOUGHT_OUT' | 'SERVICE'` — note 'MATERIAL', not
// this design's 'RAW_MATERIAL'. That vocabulary is already persisted on live
// PR line documents, so it is NOT renamed. These helpers convert at the
// boundary; new code should speak CatalogKind.

/** Convert a Phase-1 PR line `itemType` into the catalog facade's kind. */
export function itemTypeToCatalogKind(itemType: PurchaseRequestItemType): CatalogKind {
  switch (itemType) {
    case 'MATERIAL':
      return 'RAW_MATERIAL';
    case 'BOUGHT_OUT':
      return 'BOUGHT_OUT';
    case 'SERVICE':
      return 'SERVICE';
  }
}

/** Convert a CatalogKind back into the Phase-1 PR line `itemType` vocabulary. */
export function catalogKindToItemType(kind: CatalogKind): PurchaseRequestItemType {
  switch (kind) {
    case 'RAW_MATERIAL':
      return 'MATERIAL';
    case 'BOUGHT_OUT':
      return 'BOUGHT_OUT';
    case 'SERVICE':
      return 'SERVICE';
  }
}

// ============================================================================
// CATALOG_TAXONOMY — single category registry per kind (design §3.4, Phase 3)
// ============================================================================
//
// One source for "which categories exist for kind X, grouped how, labelled
// what" — consumed by the unified picker's category filters and the
// standalone module pages. It CONSOLIDATES the existing canonical per-kind
// constants (it derives from them at module load, so it can never drift and
// it never invents new category values):
//   - RAW_MATERIAL ← MATERIAL_CATEGORY_GROUPS × MATERIAL_CATEGORY_LABELS
//     (material.ts — already the single source for the ~60 MaterialCategory
//     values; a unit test guards that partition)
//   - BOUGHT_OUT   ← BOUGHT_OUT_CATEGORY_LABELS (boughtOut.ts, 10 values, flat)
//   - SERVICE      ← SERVICE_CATEGORY_LABELS (service.ts, 12 values, flat)
//
// Category VALUES stay kind-specific enums (`MaterialCategory` |
// `BoughtOutCategory` | `ServiceCategory`) — the registry exposes them as
// strings because the facade's `CatalogItem.category` is a string.

/** One selectable category value with its user-facing label. */
export interface CatalogCategoryOption {
  /** The persisted enum value (MaterialCategory | BoughtOutCategory | ServiceCategory). */
  value: string;
  label: string;
}

/** A user-facing family of categories (e.g. "Pipes", "Valves"). */
export interface CategoryGroup {
  key: string;
  label: string;
  categories: CatalogCategoryOption[];
}

export const CATALOG_TAXONOMY: Record<CatalogKind, CategoryGroup[]> = {
  RAW_MATERIAL: MATERIAL_CATEGORY_GROUPS.map((group) => ({
    key: group.key,
    label: group.label,
    categories: group.categories.map((category) => ({
      value: category,
      label: MATERIAL_CATEGORY_LABELS[category],
    })),
  })),
  // Bought-out and service taxonomies are flat (no families) — one group each.
  BOUGHT_OUT: [
    {
      key: 'bought-out',
      label: 'Bought-Out Items',
      categories: Object.entries(BOUGHT_OUT_CATEGORY_LABELS).map(([value, label]) => ({
        value,
        label,
      })),
    },
  ],
  SERVICE: [
    {
      key: 'services',
      label: 'Services',
      categories: Object.entries(SERVICE_CATEGORY_LABELS).map(([value, label]) => ({
        value,
        label,
      })),
    },
  ],
};

/** Flat category options for a kind — for single-select filter dropdowns. */
export function getCatalogCategoryOptions(kind: CatalogKind): CatalogCategoryOption[] {
  return CATALOG_TAXONOMY[kind].flatMap((group) => group.categories);
}
