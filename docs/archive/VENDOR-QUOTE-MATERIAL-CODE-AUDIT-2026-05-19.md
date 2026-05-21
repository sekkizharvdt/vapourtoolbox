# Vendor Quote — Material Code Audit (2026-05-19)

Snapshot review of the vendor-quote upload pipeline and the actual material-code data in Firestore. No changes were made; this is a record of what the system does and what the data looks like as of today.

## How the upload flow works

**UI** — [apps/web/src/app/procurement/quotes/new/page.tsx](apps/web/src/app/procurement/quotes/new/page.tsx)

- AI parser extracts line items from the uploaded PDF; it does **not** guess a material code.
- For each `MATERIAL` row the user opens `MaterialPickerDialog` and picks from the catalog. The picker callback writes `materialId`, `materialCode`, and `materialName` onto the line.
- Submit is gated by `isRowLinked()` ([new/page.tsx:498-540](apps/web/src/app/procurement/quotes/new/page.tsx#L498-L540)):
  - `MATERIAL` → requires `materialId`
  - `SERVICE` → requires `serviceId`
  - `BOUGHT_OUT` → requires `boughtOutItemId`
  - `NOTE` → no link required

**Service layer** — [apps/web/src/lib/vendorQuotes/vendorQuoteService.ts](apps/web/src/lib/vendorQuotes/vendorQuoteService.ts)

- `createVendorQuote()` and `addVendorQuoteItem()` do **not** re-validate linkage. The UI is the only gate.
- `materialId` and `materialCode` are typed as optional on the input.

**Auto-stub creation** — [functions/src/documentParsing/materialResolver.ts](functions/src/documentParsing/materialResolver.ts)

- Generates `RV-{ts}-{rand}` codes with `needsReview: true`, but this runs only on **PR parsing**, not vendor-quote parsing.
- Vendor-quote parsing auto-creates bought-out items only, not materials.

**Collections in use** — `vendorQuotes` (parent) and `vendorQuoteItems` (children). The earlier `offers`/`vendorOffers` collections were consolidated on 2026-04-24.

## What the data shows

- 23 vendor quotes total
- 67 line items total

Breakdown by item type:

| Type       | Count   | Linked properly            | Notes                                                                       |
| ---------- | ------- | -------------------------- | --------------------------------------------------------------------------- |
| MATERIAL   | 23      | 12 linked, **11 broken**   | All 11 broken rows are from Jan-Feb 2026 (the "preliminary" period)         |
| BOUGHT_OUT | ~30     | All have `boughtOutItemId` | `boughtOutItemCode` is blank on the line (denormalization gap, not linkage) |
| SERVICE    | 1       | Linked (`SVC-CON-003`)     |                                                                             |
| NOTE       | several | n/a                        | Correctly exempt from linkage                                               |

### The 11 broken MATERIAL rows

All have `materialId: undefined` and blank `materialCode`. They predate the picker gate. Affected quotes:

- Hindustan Hydraulics & Pneumatics — Pressure Gauge, Pump, Motorized Gate Valve, Motorized Butterfly Valve
- Starflex Bellows (Jan 29) — three Expansion Joint rows
- AAA Systems and Peripherals — Pump
- Vamaja Engineering — Motorized Butterfly + Gate Valves
- Cair Controls — CAIR Linear Electrical Actuator

These rows cannot ever be accepted via `acceptQuoteItemPrice` (it requires `materialId`) and will be invisible to any future price-history rollup.

### The 12 properly-linked MATERIAL rows

All from two May-2026 uploads:

- **Starflex (May 4)** — `EB-UNSS2205`, `EB-UNSS2205-001`, `EB-UNSS2205-002` (Expansion Bellows, UNS S2205 duplex stainless)
- **Flowtech (May 6)** — `ST-SS316`, `ST-SS316-001` through `ST-SS316-008` (Strainers, SS316)

Pattern observed: `{FORM}-{GRADE}-{SEQ}`. Slight variation from CLAUDE.md's documented `{FORM}-{MATERIAL}-{GRADE}` example but internally consistent.

### Catalog cross-check

Of the 12 distinct `materialId`s referenced by quotes:

- **0** are missing from the `materials` collection
- **0** are stuck on `needsReview: true`
- **0** codes mismatch between quote line and material doc

When the picker is used, the data is clean. **No `RV-` auto-stub codes** leaked into any vendor-quote line.

## Assessment

The system **is being followed properly for newer quotes**. Clear before/after split:

- **Before (Jan-Feb 2026, 11 items)**: MATERIAL rows saved with no `materialId`. Pre-dates the picker gate. Now orphaned data — invisible to price history, cannot be accepted.
- **After (May 2026 onwards)**: every MATERIAL line is linked to a real catalog doc with a clean, consistent code.

## Structural gaps noted (not fixed)

1. **Guard is client-side only.** A future bug or script could write a MATERIAL item with `materialId: undefined` and the service would accept it — that is how the 11 broken rows got in. A one-line `if (item.itemType === 'MATERIAL' && !item.materialId) throw` in `addVendorQuoteItem` would close that for good.

2. **`BOUGHT_OUT` lines carry `boughtOutItemId` but not the catalog code on the line item itself.** The denormalized fields on the line are `linkedItemName` / `linkedItemCode` (written from the picker at [QuoteDetailClient.tsx:247-248](apps/web/src/app/procurement/quotes/[id]/QuoteDetailClient.tsx#L247-L248)), and most older rows have these blank — the line cannot be displayed without joining back to `bought_out_items`. Per CLAUDE.md rule 26 these should be written on every line.

## Bought-out items — the long-name problem

Visible in the Quote Detail screen: the **Linked Item** column shows the full long vendor descriptor (149-306 chars), rendered at [QuoteDetailClient.tsx:586-598](apps/web/src/app/procurement/quotes/[id]/QuoteDetailClient.tsx#L586-L598). The **code** below it (e.g. `INST-PI-0002`) is short and fine. The bloat is in the linked item's `name`, not the code.

Real collection name is `bought_out_items` (snake_case), not `boughtOutItems`. 61 documents total.

### What's in `bought_out_items`

- **61 / 61** docs have `needsReview: true` — none have been curated since auto-creation
- **27 / 61** (44%) have `name` longer than 200 characters
- **17 / 61** (28%) have `name` between 120-200 characters
- **0 / 61** have `shortName` populated
- Schema includes `description` and `specifications` fields — both empty across the board
- The AI parser dumps the entire vendor descriptor (tag + spec + variant codes) straight into `name`

Examples observed:

| Code                                   | name length | Sample (truncated)                                                                 |
| -------------------------------------- | ----------- | ---------------------------------------------------------------------------------- |
| `INST-PI-0002`                         | 149 chars   | "ALL STAINLESS STEEL BOURDON TYPE PRESSURE GAUGE — P101-06-B0-14N-ER-EB-BA-GC-..." |
| `INST-TI-0005`                         | 151 chars   | "INDUSTRIAL BIMETAL THERMOMETER T501-06-B0-M60-KW-14N-ET-BA-GC-TA-XG-TC with..."   |
| `INST-TT-0005`                         | 167 chars   | "NIPPLE-UNION-NIPPLE TYPE INDUSTRIAL RTD ASSEMBLY R102-0-97C-H-MF-M60-BX-ML-..."   |
| `VLV-CHECK_DUAL_PLATE-SS316-DN200-...` | 306 chars   | "MODEL CODE 121250369 RKE86A DN200 HD PN10-16/CL150 A3 GESTRA DISCO NON-RETURN..." |
| `VLV-BUTTERFLY-SS316-200-PN16-WAF-MAN` | 298 chars   | "L&T Aquaseal PN16 Butterfly valve, Integrally moulded EPDM lining, Design Std..." |

### Duplicate records for the same item

**41 / 61 docs (67%) sit in name-duplicate clusters.** The parser creates a new document each time a slightly different vendor wording arrives, instead of matching to the existing item:

| Cluster (same physical item)             | # of duplicate docs | Code variations causing the split                                                       |
| ---------------------------------------- | ------------------- | --------------------------------------------------------------------------------------- |
| GESTRA DN25 non-return valve             | 5                   | `PN6-40/150-300#` vs `PN6-40/CLASS150/300` vs `PN6-40/150#/300#` vs `SS316` vs `SS316L` |
| GESTRA DN50 non-return valve             | 5                   | same pattern                                                                            |
| GESTRA DN80 non-return valve             | 5                   | same pattern                                                                            |
| GESTRA DN100 non-return valve            | 5                   | same pattern                                                                            |
| GESTRA DN200 non-return valve            | 3                   | `PN10-16/CL150` vs `PN10-16/CLASS150` vs `SS316L`                                       |
| NIPPLE-UNION-NIPPLE RTD assembly (short) | 4                   | sequential codes `INST-TT-0001`-`0004` for what looks like one item                     |
| NIPPLE-UNION-NIPPLE RTD assembly (long)  | 4                   | sequential codes `INST-TT-0005`-`0008` for one item                                     |
| L&T Aquaseal butterfly valve             | 4                   | `100/200/300/450` size suffixes — these may legitimately differ by size                 |
| Industrial bimetal thermometer (short)   | 3                   | `INST-TI-0001/0002/0003` for one item                                                   |
| Industrial bimetal thermometer (long)    | 3                   | `INST-TI-0004/0005/0006` for one item                                                   |

23 of those rows are GESTRA non-return valves alone — likely **5 physical items, 23 catalog entries**.

The code generator is producing collisions because:

- Pressure rating gets formatted three ways: `PN6-40/150-300#`, `PN6-40/CLASS150/300`, `PN6-40/150#/300#`
- Material grade flips between `SS316` and `SS316L` (these are different alloys, but for the same source vendor line, AI keeps switching)
- Sequential suffixes (`-0001`, `-0002`) get appended to genuine duplicates rather than de-duping

### Read on the bought-out catalog

This is the **same class of issue** as the materials side, but worse:

- Materials: 11 broken rows from the pre-picker era, 12 clean rows since May. System is now sound.
- Bought-outs: 61 docs, **all** auto-created stubs, **0 curated**, **67% duplicated**, and the long-name display is a downstream symptom of the upload-time auto-create writing every vendor descriptor as the canonical `name`.

The "preliminary system" assumption — that you'd revisit codes later — applies to bought-outs too, and that "later" hasn't happened yet. The Quote Detail screen is now surfacing the cost of leaving auto-stubs uncurated.

Not asking to fix any of this — just recording what the current state is.
