# Design — Procurement Catalog Unification (Materials + Bought-Out + Services)

**Date:** 2026-06-15
**Source:** In-session request triggered by feedback `Jit9vLshG7oIZpt9Qhka` (Kumaran A) — "Material Database Linking Issues in PR Module and Category-Based Database Display." Investigation widened it into an architecture question: what is the long-term sustainable model for linking procurable items across the app?
**Status (updated 2026-07-07):** PARTIALLY LANDED — the Phase 1 user-visible fix shipped (`c86c0c38` per-line material/bought-out/service linking, `ebec0246` spec on link, `c4904a8e` canonical material-category taxonomy), but via the tactical per-line `itemType` + id-triplet path, NOT the `CatalogRef` facade this design specifies. The facade itself (`packages/types/src/catalog.ts`, `catalogService`, `CatalogPickerDialog`, `CATALOG_TAXONOMY` registry) is unbuilt — Phases 2–3 remain open and this stays the design of record for them. **COMPLETE 2026-07-13** — Phases 2–3 shipped (CatalogRef + catalogService + CatalogPickerDialog + CATALOG_TAXONOMY; PR/Quotes/BOM consumers migrated, AddBOMItemDialog's bought-out-as-material hack retired). Pulled ahead of A2/A5 by user decision; when A2/A5 land they consume the facade. Remaining opportunistic: absorb per-kind list UIs, retire legacy id triplets after backfill.
**Data verified (rule 31):** `materials` = 772 docs (0 deleted); `bought_out_items` = 119 docs (0 deleted). Counted via the service account on 2026-06-15. Both collections hold real, schema-divergent data — **no merge, no migration** is proposed.

---

## 1. Context & current state

When a user adds a line item to a Purchase Requisition (and elsewhere), they link it to master data. Today that master data lives in **two separate Firestore collections with disjoint schemas and disjoint category enums**, plus a Services collection:

| Collection         | Holds                                                      | Key fields                                                                                                      | Category taxonomy               |
| ------------------ | ---------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------- | ------------------------------- |
| `materials`        | Raw materials — pipes, plates, flanges, fittings           | `materialCode`, `specification`, `priceHistory`, `nps/dn/schedule`, `familyCode`, `materialType`, `hasVariants` | `MaterialCategory` (~60 values) |
| `bought_out_items` | Engineered components — pumps, valves, instruments, motors | `itemCode`, `specifications`, `pricing`, `make/model`                                                           | `BoughtOutCategory` (10 values) |
| services           | Service line items                                         | `serviceCode`, `serviceCategory`, `turnaroundDays`                                                              | service categories              |

The two schemas are **legitimately different** — a pipe carries dimensional/family/variant structure; a pump carries free-form specifications and a make/model. Forcing one into the other's shape would be wrong. **The collection split is correct and stays.**

### The actual problem — fan-out around the split

The rot is not the two collections; it is the unbounded duplication _around_ them:

1. **Three taxonomies for one domain:**
   - `MaterialCategory` — ~60 values ([`packages/types/src/material.ts`](packages/types/src/material.ts))
   - `PICKER_CATEGORY_GROUPS` — 11 collapsed groups the material picker actually shows ([`material.ts:448-585`](packages/types/src/material.ts#L448-L585))
   - `BoughtOutCategory` — 10 values ([`packages/types/src/boughtOut.ts:14-24`](packages/types/src/boughtOut.ts#L14-L24))

2. **Three+ pickers / three modelings of "bought-out":**
   - [`MaterialPickerDialog`](apps/web/src/components/materials/MaterialPickerDialog.tsx) → `materials` only
   - [`BoughtOutPickerDialog`](apps/web/src/components/boughtOut/BoughtOutPickerDialog.tsx) → `bought_out_items` only (wired into Quotes, **never PRs**)
   - [`AddBOMItemDialog`](apps/web/src/components/bom/AddBOMItemDialog.tsx) models bought-out as a **`MaterialCategory` subset** inside `materials` — a third, contradictory modeling of the same concept

3. **Per-consumer linkage branching:** every consumer line (PR, RFQ, Quote, PO, BOM) carries separate `materialId` / `boughtOutId` / `serviceId` triplets and branches on which is set. Adding a new procurable kind means touching every consumer again.

### The user-visible bug (feedback Jit9v)

The PR picker reads/writes **only** `materials`. The PR header has a Category dropdown (`SERVICE` / `RAW_MATERIAL` / `BOUGHT_OUT`), but `BOUGHT_OUT` and `RAW_MATERIAL` are wired identically — both open the materials picker ([`new/page.tsx:592-615`](apps/web/src/app/procurement/purchase-requests/new/page.tsx#L592-L615)). Consequences Kumaran reported:

1. A bought-out item ("Grommet") created from the PR picker is written to `materials`, so it never appears in the Bought-Out module.
2. The picker UI differs from the standalone Material Database page.
3. The picker shows a combined/limited category list (the 11-group collapse), not the full taxonomy.
4. Desired: pick a category/type first, then see **only** the matching database.

---

## 2. Design principle — unify the seams, not the storage

Keep the specialized collections. Unify the **three seams that are actually multiplying**: the linkage shape on consumers, the access layer, and the taxonomy. The shared concept is a **Catalog Item** — a procurable thing with a `kind`. Materials, bought-out items, and services are specialized _backends_ of one catalog, not three parallel worlds.

This is a facade over specialized storage (single-table-inheritance at the _access_ layer, not the _storage_ layer). It respects the schema difference, needs no data migration, and removes the branching that does not scale.

### Why not the alternatives

- **Merge into one collection** — loses the real schema difference, requires migrating 891 live records, rejected by the data owner. Not proposed.
- **Keep bolting per-line branches onto each consumer** — the branching cost compounds with every consumer and every new kind. This is the status quo trajectory; the design exists to stop it.

---

## 3. Target architecture

### 3.1 One linkage shape on every consumer line

Replace the `materialId / boughtOutId / serviceId` triplets with a single discriminated reference (denormalized per rule 26):

```ts
// packages/types/src/catalog.ts (new)
export type CatalogKind = 'RAW_MATERIAL' | 'BOUGHT_OUT' | 'SERVICE';

export interface CatalogRef {
  kind: CatalogKind;
  id: string; // doc id in the backing collection
  code: string; // materialCode | itemCode | serviceCode (human-readable)
  name: string; // denormalized display name
}
```

Every consumer line (PR, RFQ, Quote, PO, BOM) carries one `catalogRef`. No consumer branches on "which collection" again; adding a future kind is one enum value + one backend, not a sweep across consumers.

### 3.2 One catalog service (facade)

```ts
// apps/web/src/lib/catalog/catalogService.ts (new)
export interface CatalogItem {     // uniform read view across all kinds
  kind: CatalogKind;
  id: string;
  code: string;
  name: string;
  category: string;                // kind-specific category value, as a string
  baseUnit?: string;
  specification?: string;
}

searchCatalog(db, { kind?, query, category? }): Promise<CatalogItem[]>;
getCatalogItem(db, ref: CatalogRef): Promise<CatalogItem | null>;
createCatalogItem(db, kind, input, userId): Promise<CatalogRef>;
```

The service fans out to `materialService`, `boughtOutService`, and the services backend, mapping each into `CatalogItem`. The collection split lives **behind** this and stops leaking into UI code. (It is a thin adapter over the existing per-kind services — not a reimplementation; rule 32.)

### 3.3 One picker

A single `CatalogPickerDialog` with `kind` as a tab/facet, defaulting to the line's kind. It hosts (initially wraps) the existing per-kind pickers, then absorbs them. Every consumer uses this one dialog. Inline "create new" writes to the correct backend via `createCatalogItem`.

### 3.4 One taxonomy registry

```ts
// packages/types/src/catalog.ts
export const CATALOG_TAXONOMY: Record<CatalogKind, CategoryGroup[]> = { ... };
```

A single source per kind, replacing the three hand-maintained lists. The standalone pages, the picker, and any filter all read from this.

---

## 4. Phased delivery

Each phase ships value independently and nothing is thrown away — Phase 1 is the first brick of the facade, not a throwaway tactical fix.

### Phase 1 — PR linking fix on the `catalogRef` shape (ships the feedback fix)

**Goal:** resolve feedback `Jit9v` now, using the existing pickers under the hood, but with the **standard `catalogRef` linkage** rather than a bespoke `boughtOutId`.

1. **Types** — add `CatalogKind` + `CatalogRef` ([`packages/types/src/catalog.ts`](packages/types/src/catalog.ts)). Extend the PR line item ([`apps/web/src/lib/procurement/purchaseRequest/types.ts`](apps/web/src/lib/procurement/purchaseRequest/types.ts)) with `itemType: 'MATERIAL' | 'BOUGHT_OUT' | 'SERVICE'` and a `catalogRef?: CatalogRef`. Keep the existing `materialId/serviceId` fields **readable** for back-compat (populate `catalogRef` on write; do not remove old fields yet).
2. **PR new page** — add a per-row **Type** dropdown (defaults from the header category for new rows). The search icon branches on the **row's** type: Material → `MaterialPickerDialog`, Bought-Out → `BoughtOutPickerDialog` (existing), Service → existing ServicePicker. Each `onSelect` writes a `catalogRef`. Allows mixed-type PRs.
3. **PR edit page** ([`[id]/edit/EditPRClient.tsx`](apps/web/src/app/procurement/purchase-requests/[id]/edit/EditPRClient.tsx)) — mirror: restore `itemType` + `catalogRef` on load (rule 22 round-trip), same wiring, same validation.
4. **Validation** — a line is valid if it has a `catalogRef` of the matching kind (replaces the `serviceId || materialId` check).
5. **Create/update service** — persist `itemType` + `catalogRef` (rule 22).
6. **Downstream verification** — confirm `PR → RFQ` generation does not hard-assume `materialId`; a Bought-Out line must flow to RFQ via its description/spec (bought-out already flows through Quotes, so the RFQ side likely handles it — **verify, don't assume**).

**Outcome for Kumaran:** bought-out items save to and appear in the Bought-Out DB (#1); each picker shows only its own DB + categories (#3, #4); residual #2 (picker is a dialog vs the standalone page) is unavoidable but content is consistent.

**No migration. Both collections untouched. Reuses existing pickers.**

### Phase 2 — extract the facade (`CatalogService` + `CatalogPickerDialog`)

1. Build `catalogService.ts` as an adapter over the existing per-kind services (§3.2).
2. Build `CatalogPickerDialog` (§3.3), initially hosting the existing pickers as tabs.
3. Migrate consumers onto it: **PR first** (replacing the Phase 1 per-picker branching with the single dialog), then **Quotes**, then **BOM** — retiring `AddBOMItemDialog`'s bought-out-as-`MaterialCategory` hack.
4. Once all consumers use `CatalogPickerDialog`, retire the standalone `MaterialPickerDialog` / `BoughtOutPickerDialog` call sites (keep the underlying per-kind list/detail components the dialog reuses).

**Outcome:** one picker, one linkage shape, one access layer. New procurable kinds become additive.

### Phase 3 — single taxonomy registry

1. Introduce `CATALOG_TAXONOMY` (§3.4) as the one source of category groups per kind.
2. Point the picker, the standalone `/materials` and `/bought-out` pages, and any category filters at it.
3. Collapse `PICKER_CATEGORY_GROUPS` into the registry; reconcile the materials landing tiles, picker groups, and bought-out enum into one coherent taxonomy per kind.

**Outcome:** the "different / limited categories" class of confusion (Kumaran #2/#3) is eliminated at the source.

---

## 5. Scope, risk, sequencing

| Phase | Risk                                       | Migration          | Ships                    |
| ----- | ------------------------------------------ | ------------------ | ------------------------ |
| 1     | Low — additive fields, reuses pickers      | None               | Feedback `Jit9v` fix     |
| 2     | Medium — touches PR, Quotes, BOM consumers | None               | Unified picker + service |
| 3     | Low–Medium — taxonomy consolidation        | None (config only) | One taxonomy             |

- **Rule 32 (one canonical implementation):** this design is the antidote to the existing parallel pickers/taxonomies — every phase reduces duplication, none adds a parallel.
- **Rule 26 (denormalization):** `catalogRef` carries `code` + `name` so downstream reads don't re-fetch.
- **Rule 22 (round-trip):** Phase 1 must restore `itemType` + `catalogRef` on edit.
- **Back-compat:** old `materialId/serviceId` fields stay readable through Phase 1–2; remove only after all consumers are on `catalogRef` and existing docs are confirmed migrated-on-write or backfilled.
- **Deploy:** ships via the standard CI "Deploy - Production" dispatch; no index changes anticipated in Phase 1 (verify if any new `where + orderBy` is added — rule 2).

---

## 6. Recommendation

Approve **Phase 1** to ship Kumaran's fix now on the `catalogRef` shape (so it is the first brick of the facade, not a fourth parallel path). Treat **Phases 2–3** as the sustainable target to schedule deliberately — each is independently shippable and migration-free. Do **not** merge the collections.
