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

// ============================================================================
// How a catalogue item is sized and priced (decided 2026-08-16)
// ============================================================================
//
// Three ORTHOGONAL questions. Conflating them is what produced the mess this
// model replaces — 33 documents misfiled, and a "priced per kg → raw material"
// rule that happens to give the right answer for pipes but not for the right
// reason.
//
//   1. discriminators — what makes this a distinct purchasable article.
//      Becomes a variant (or, for piping today, a document per combination).
//   2. orderSizing    — what the BUYER states on the order line.
//   3. pricingUnit    — how quantity × rate works.
//
//                 discriminators        orderSizing   pricingUnit
//   Plate         thickness             SHAPE         KG
//   Pipe          nps + schedule        LENGTH        METER
//   Fitting       nps + schedule        NONE          PIECE
//   Flange        nps + pressureClass   NONE          PIECE
//   Demister pad  size + thickness      NONE          PIECE
//
// Pipe is the case that proves the axes are independent: it has BOTH
// discriminators (like a fitting) and an order dimension (like a plate).
// Under a single-axis rule it looks like a contradiction; here it is just a
// row in the table.
//
// Because these are declared per category, the COLLECTION a document lives in
// (`materials` vs `bought_out_items`) is a filing convenience — schema fit and
// module pages — not a semantic decision. Misfiling becomes cosmetic instead
// of corrupting, which is the point.

/** How quantity × rate works for an item. */
export type CatalogPricingUnit = 'KG' | 'METER' | 'PIECE';

/** What size information the buyer supplies on the order line. */
export type CatalogOrderSizing =
  /** None — the variant fully determines the article (fitting, valve, demister pad). */
  | 'NONE'
  /** `quantity` IS the length, in metres (pipe). */
  | 'LENGTH'
  /** Buyer picks a shape and states its parameters — see `CatalogLineDimensions` (plate). */
  | 'SHAPE';

export interface CatalogSizing {
  /**
   * Field names that distinguish one purchasable article from another, e.g.
   * `['nps', 'schedule']`. These are the keys a variant fills in.
   */
  discriminators: string[];
  orderSizing: CatalogOrderSizing;
  pricingUnit: CatalogPricingUnit;
}

/**
 * Default for a discrete manufactured article you buy whole: one size per
 * variant, nothing stated on the line, priced per piece. Anything that departs
 * from this is listed explicitly below — silence means "ordinary article".
 */
const DEFAULT_SIZING: CatalogSizing = {
  discriminators: ['size'],
  orderSizing: 'NONE',
  pricingUnit: 'PIECE',
};

/**
 * Categories whose sizing differs from `DEFAULT_SIZING`. Keyed by the string
 * value of `MaterialCategory` so this file stays free of an import cycle.
 *
 * Only categories with real documents are listed. A category is added when it
 * gets data, not in anticipation — an unlisted category falls back to the
 * default and `check-catalog-taxonomy.js` reports any document whose
 * `baseUnit` contradicts it.
 */
const SIZING_OVERRIDES: Record<string, CatalogSizing> = {
  // Plates — bought by weight, cut to a shape the engineer states per line.
  PLATES_CARBON_STEEL: { discriminators: ['thickness'], orderSizing: 'SHAPE', pricingUnit: 'KG' },
  PLATES_STAINLESS_STEEL: {
    discriminators: ['thickness'],
    orderSizing: 'SHAPE',
    pricingUnit: 'KG',
  },
  PLATES_DUPLEX_STEEL: { discriminators: ['thickness'], orderSizing: 'SHAPE', pricingUnit: 'KG' },
  PLATES_ALLOY_STEEL: { discriminators: ['thickness'], orderSizing: 'SHAPE', pricingUnit: 'KG' },

  // Pipes — the document fixes NPS and schedule; `quantity` carries length.
  PIPES_CARBON_STEEL: {
    discriminators: ['nps', 'schedule'],
    orderSizing: 'LENGTH',
    pricingUnit: 'METER',
  },
  PIPES_STAINLESS_304L: {
    discriminators: ['nps', 'schedule'],
    orderSizing: 'LENGTH',
    pricingUnit: 'METER',
  },
  PIPES_STAINLESS_316L: {
    discriminators: ['nps', 'schedule'],
    orderSizing: 'LENGTH',
    pricingUnit: 'METER',
  },
  PIPES_ALLOY_STEEL: {
    discriminators: ['nps', 'schedule'],
    orderSizing: 'LENGTH',
    pricingUnit: 'METER',
  },
  PIPES_DUPLEX_2205: {
    discriminators: ['nps', 'schedule'],
    orderSizing: 'LENGTH',
    pricingUnit: 'METER',
  },
  PIPES_SUPER_DUPLEX_2507: {
    discriminators: ['nps', 'schedule'],
    orderSizing: 'LENGTH',
    pricingUnit: 'METER',
  },

  // Butt-weld fittings — wall follows the mating pipe schedule (ASME B16.9).
  FITTINGS_BUTT_WELD: {
    discriminators: ['nps', 'schedule'],
    orderSizing: 'NONE',
    pricingUnit: 'PIECE',
  },
  // Socket-weld and threaded fittings are rated by CLASS, not schedule
  // (ASME B16.11) — a distinction the old flat model could not express.
  FITTINGS_SOCKET_WELD: {
    discriminators: ['nps', 'pressureClass'],
    orderSizing: 'NONE',
    pricingUnit: 'PIECE',
  },
  FITTINGS_THREADED: {
    discriminators: ['nps', 'pressureClass'],
    orderSizing: 'NONE',
    pricingUnit: 'PIECE',
  },

  // Flanges — NPS plus pressure class.
  FLANGES: { discriminators: ['nps', 'pressureClass'], orderSizing: 'NONE', pricingUnit: 'PIECE' },
  FLANGES_WELD_NECK: {
    discriminators: ['nps', 'pressureClass'],
    orderSizing: 'NONE',
    pricingUnit: 'PIECE',
  },
  FLANGES_SLIP_ON: {
    discriminators: ['nps', 'pressureClass'],
    orderSizing: 'NONE',
    pricingUnit: 'PIECE',
  },
  FLANGES_BLIND: {
    discriminators: ['nps', 'pressureClass'],
    orderSizing: 'NONE',
    pricingUnit: 'PIECE',
  },

  // Demister pads — a face size and a pad thickness, priced per piece because
  // the vendor supplies the grid around it.
  DEMISTER_PAD: {
    discriminators: ['size', 'thickness'],
    orderSizing: 'NONE',
    pricingUnit: 'PIECE',
  },
  STRAINERS: { discriminators: ['size', 'service'], orderSizing: 'NONE', pricingUnit: 'PIECE' },
  EXPANSION_BELLOWS: {
    discriminators: ['nps', 'length'],
    orderSizing: 'NONE',
    pricingUnit: 'PIECE',
  },
};

/** The sizing model for a category. Never returns undefined. */
export function getCatalogSizing(category: string): CatalogSizing {
  return SIZING_OVERRIDES[category] ?? DEFAULT_SIZING;
}

/** Categories explicitly modelled (i.e. not falling back to the default). */
export function getModelledSizingCategories(): string[] {
  return Object.keys(SIZING_OVERRIDES);
}

/**
 * Shared vocabulary for "one purchasable size of a product".
 *
 * `MaterialVariant` and `BoughtOutVariant` both extend this rather than
 * restating it — they are ONE concept with two schema-specific extensions
 * (a material variant carries geometry and weight; a bought-out variant
 * carries a specification block and a unit rate), and rule 32 applies to our
 * own types as much as to services.
 */
export interface CatalogVariant {
  /** Stable id, unique within the parent item. */
  id: string;
  /** Short code, e.g. "6mm", "DN100-150". */
  variantCode: string;
  /** Human-readable, e.g. "6mm thickness", "NPS 4 150#". */
  displayName: string;
  /**
   * Values of the parent category's `discriminators`, e.g.
   * `{ nps: '4', schedule: '40' }`. The uniform read path — a consumer can
   * render or compare variants without knowing which collection they came from.
   */
  discriminators?: Record<string, string | number>;
  /** Price-history document ids. */
  priceHistory: string[];
  /** In stock or orderable. */
  isAvailable: boolean;
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
