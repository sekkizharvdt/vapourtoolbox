# Materials ↔ bought-out taxonomy — agreed plan

> **Nothing has been written to Firestore.** Generated 2026-08-16 against `vapour-toolbox`.

## The rule (decided)

> **Priced in Rs/kg or Rs/m → raw material. Priced as a unit rate → bought-out item.**

`baseUnit` already encodes this, and the data splits with no ambiguous cases:

| Priced by | What                                                            | n   | Collection                        |
| --------- | --------------------------------------------------------------- | --- | --------------------------------- |
| KG        | plates (16), aluminium tubes (1)                                | 17  | `materials`                       |
| METER     | pipes                                                           | 344 | `materials`                       |
| PIECE     | flanges (234), fittings (136)                                   | 370 | `bought_out_items`                |
| NOS       | demister pads, strainers, instruments, bellows, valves, grommet | 33  | `bought_out_items`                |
| NOS       | `OTHER` strays                                                  | 24  | `bought_out_items` (mostly merge) |

The rule reproduces the existing `materialType` flag exactly where it was set deliberately
(all 370 PIECE-priced docs already say `BOUGHT_OUT_COMPONENT`) and contradicts it only on the
33 NOS-priced ones — which are precisely the misfiled set. It was already 92% encoded in the data.

**End state: `materials` holds 361 docs — plates, pipes, aluminium tubes. Nothing else.**

## Schema change — `BoughtOutItem.variants[]`

Vendors price a demister pad per size because the grid is included, so it cannot be Rs/kg —
but the sizes are one product, not fourteen. `BoughtOutItem` has no variants array today
(only a flat `specifications` + single `pricing`). Mirror `MaterialVariant`:

```ts
export interface BoughtOutVariant {
  id: string;
  variantCode: string; // "2800x960-50", "DN100-150"
  displayName: string; // "2800×960, 50mm thk"
  specifications?: Partial<BoughtOutSpecifications>; // what differs
  pricing?: { listPrice: Money; currency: CurrencyCode; leadTime?: number };
  priceHistory: string[];
  isAvailable: boolean;
}
```

## Consolidation — 403 documents become 24 products

This is the real prize. `familyCode` already carried the grouping and nobody had used it.

**Flanges** group on `familyCode` alone — each type is already its own family:

| Product                                            | Variants |
| -------------------------------------------------- | -------- |
| `FL-WN-CS-A105` / `FL-WN-SS-A182` Weld Neck Flange | 49 each  |
| `FL-SO-CS-A105` / `FL-SO-SS-A182` Slip-On Flange   | 34 each  |
| `FL-BL-CS-A105` / `FL-BL-SS-A182` Blind Flange     | 34 each  |

**Fittings must additionally split on `fittingType`.** `FT-BW-CS-A234` holds 19 elbows,
19 tees, 11 caps, 11 45° elbows and 8 reducers — a tee is not a variant of an elbow.
Grouping on `familyCode` alone would have produced one product named "90° Elbow Long
Radius" containing tees and caps:

| Product (per grade: CS A234 / SS A403) | Variants |
| -------------------------------------- | -------- |
| 90° Elbow Long Radius                  | 19 each  |
| Tee                                    | 19 each  |
| 45° Elbow Long Radius                  | 11 each  |
| Cap                                    | 11 each  |
| Concentric Reducer                     | 8 each   |

**NOS-priced groups:**

| Product                           | Variants |
| --------------------------------- | -------- |
| Demister Pad w/ Grids             | 14       |
| Basket Strainer                   | 5        |
| Weatherproof Pressure Switch S201 | 4        |
| Y-Type Strainer                   | 4        |
| Single Axial Expansion Joint      | 3        |
| Motorized Globe Valve, Grommet    | 1 each   |

The picker goes from **403 flat rows to 24 products** — which is what makes an inline
dropdown viable on the bought-out side too, not just for plates.

### Proposed variants for the NOS-priced groups

**Demister Pad w/ Grids** — 14 variants

| Current code   | Proposed variantCode / displayName |
| -------------- | ---------------------------------- |
| `DP-SS316`     | 2800×960, 50mm thk                 |
| `DP-SS316-001` | 2800×960, 100mm thk                |
| `DP-SS316-002` | 2800×840, 50mm thk                 |
| `DP-SS316-003` | 2800×840, 100mm thk                |
| `DP-SS316-004` | 2800×750, 50mm thk                 |
| `DP-SS316-005` | 2800×750, 100mm thk                |
| `DP-SS316-006` | 2800×690, 50mm thk                 |
| `DP-SS316-007` | 2800×690, 100mm thk                |
| `DP-SS316-008` | 2800×680, 50mm thk                 |
| `DP-SS316-009` | 2800×680, 100mm thk                |
| `DP-SS316-010` | 2800×740, 50mm thk                 |
| `DP-SS316-011` | 2800×740, 100mm thk                |
| `DP-SS316-012` | 2060×1080, 50mm thk                |
| `DP-SS316-013` | 2060×1080, 100mm thk               |

**Single Axial Expansion Joint** — 3 variants

| Current code      | Proposed variantCode / displayName |
| ----------------- | ---------------------------------- |
| `EB-UNSS2205`     | 1100NB × 300mm Long                |
| `EB-UNSS2205-001` | 700NB × 300mm Long                 |
| `EB-UNSS2205-002` | 800NB × 300mm Long                 |

**Weatherproof Pressure Switch S201** — 4 variants

| Current code   | Proposed variantCode / displayName |
| -------------- | ---------------------------------- |
| `IO-SS316`     | PSL-101                            |
| `IO-SS316-001` | PSL-201                            |
| `IO-SS316-002` | PSL-301                            |
| `IO-SS316-003` | no tag                             |

**Y-Type Strainer** — 4 variants

| Current code   | Proposed variantCode / displayName |
| -------------- | ---------------------------------- |
| `ST-SS316-005` | 100NB×100NB — Distillate           |
| `ST-SS316-006` | 25NB×25NB — Distillate             |
| `ST-SS316-007` | 80NB×80NB — Warm Water             |
| `ST-SS316-008` | 50NB×50NB — Warm Water             |

**Basket Strainer** — 5 variants

| Current code   | Proposed variantCode / displayName |
| -------------- | ---------------------------------- |
| `ST-SS316`     | 200NB×150NB — Seawater             |
| `ST-SS316-001` | 800NB×150NB — Brine                |
| `ST-SS316-002` | 400NB×100NB — Distillate           |
| `ST-SS316-003` | 300NB×65NB — Warm Water            |
| `ST-SS316-004` | 200NB×50NB — Warm Water            |

## Migration phases

1. **Picker gate** (code only, no writes) — `queryMaterials` honours `materialType`; raw-material
   PRs immediately stop offering the 370 flanges/fittings. Reversible, independently shippable.
2. **`BoughtOutVariant` type + UI** — variant selector on the bought-out picker and page.
3. **Migrate the 8 piping families** — 370 docs → 8 products with variants, carrying
   `nps`/`dn`/`pressureClass`/`schedule`/`outsideDiameter_mm`/`wallThickness_mm` into
   `specifications`. Move `/materials/flanges` + `/materials/fittings` to the bought-out side.
4. **Migrate the 33 NOS docs** — grouped into ~7 products per the tables above.
5. **Resolve `OTHER` (24)** — 14 already exist as variants of the families from step 3; see open items.
6. **Repoint 32 references** — `materialId` → `boughtOutItemId`:
   `purchaseRequestItems` 16, `vendorQuoteItems` 12, `rfqItems` 2, `purchaseOrderItems` 2.

## Code surfaces this touches

- `lib/materials/queries.ts` — `queryMaterials`, `queryPipingFamilies`, `queryMaterialsByFamily`
- `MATERIAL_CATEGORY_GROUPS`, `isFlatPipingCategory`, `getPipingCategory`, `usesVariantModel` (@vapour/types)
- `MaterialPickerDialog` piping mode + `PipingMaterialTable` → move to bought-out picker
- `/materials/flanges`, `/materials/fittings` pages
- `recordProcurementPrices` (materialPrices) vs `addBoughtOutPrice` (bought_out_prices)
- **Rule 4**: `bought_out_items` rules already exist; confirm they cover variants
- **Rule 2**: any new `where`+`orderBy` needs a composite index

## Open items — need your answer before phase 3/5

1. **`FITTINGS_BUTT_WELD` carries no `schedule`** on any of its 136 docs — only NPS and fitting
   type. Does schedule belong on the catalogue entry, or per-order (wall matches the mating pipe)?
   Blocks merging the `OTHER` elbows, which are all specified "NB 100 X SCH 40".
2. **No Duplex fitting family** — families are CS (A234) and SS (A403) only, but 5 `OTHER` strays
   are Duplex. They need a new family, not a merge.
3. **`FITTINGS_SOCKET_WELD` has no docs loaded** — 2 half couplings have nowhere to go.
4. **`IO-SS316-003`** — the only pressure switch with no PSL tag. Real item or template?
5. **`VG-WCC-001` "Motorized _Glove_ Valve"** — typo of `VG-WCC`, zero references. Delete?

## Data nits found

- One `PIPES_DUPLEX_2205` doc has `baseUnit: "MTR"` where the other 65 say `"METER"`.
- `OTHER` codes are generated junk (`RV-MSEFELPS-79QN`) unlike the structured codes elsewhere
  (`FT-BW-CS-A234-90ELR-4`), suggesting a blind import created them.

## Not duplicates — settled

The 14 demister pads, 9 strainers, 4 pressure switches and 3 bellows share identical `name`
values but are distinct items; the attribute lives in `description`. Each strainer and bellows
is referenced by a **different** vendor quote line. They become variants, not merges.
