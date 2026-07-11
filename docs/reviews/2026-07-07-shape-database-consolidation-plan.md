# Shape Database Consolidation — Implementation Plan

**Date:** 2026-07-07
**Status:** APPROVED — scheduled as **Phase 0** of `2026-07-07-application-completion-plan.md` (first work item; do before real BOMs reference shapes)
**Origin:** Shape-database completeness audit (this session). Findings: Firestore `shapes` collection is empty while BOM cost recalculation reads from it; shape IDs are minted from array index (fragile); a dead drifted copy with 1000×-wrong weight formulas sits in `packages/functions`; 3 `ShapeCategory` enum values have no shapes.

## Decision

The static TypeScript dataset (`apps/web/src/data/shapes/`) is the **single source of truth** for shapes. Shapes are behavior (formulas, validation rules), not runtime-editable data — they belong in code, type-checked and tested. The Firestore `shapes` collection is removed entirely. Materials stay in Firestore (prices change at runtime).

**Verified facts this plan relies on (checked 2026-07-07 against prod):**

- Firestore `shapes` collection: **0 documents** → nothing to migrate or delete server-side.
- BOM items referencing a `shapeId`: **0** (2 BOMs exist, no shape items) → the ID scheme can change with no data migration (rule 31).
- `packages/functions/src/data/shapes/`: **no importers** anywhere; `@vapour/functions` is legacy/undeployed.
- `CUSTOM_BOX_SECTION` / `CUSTOM_BRACKET` / `CUSTOM_ASSEMBLY`: referenced only inside `packages/types/src/shape.ts` itself.

---

## Phase 1 — Stable hand-written shape IDs

The load-bearing fix. BOM items persist `shapeId` forever; IDs must survive edits to the data files. Do this **before** real BOMs start referencing shapes (Desolenator project is imminent).

1. In each of the 6 data files (`plates.ts`, `tubes.ts`, `pressureVesselComponents.ts`, `pressureVesselHeads.ts`, `heatExchangerComponents.ts`, `nozzleAssemblies.ts`), add explicit `id` and `shapeCode` to every definition. Change the per-shape type from `Omit<Shape, 'id' | 'shapeCode' | 'createdAt' | ...>` to a shared `ShapeDefinition = Omit<Shape, 'createdAt' | 'updatedAt' | 'createdBy' | 'updatedBy'>` alias (define once in `data/shapes/index.ts`).
2. ID scheme: kebab-case slug, never reused. `shapeCode` = `SHP-` + upper-snake of the slug.
   - `plate-rectangular`, `plate-circular`, `plate-custom`
   - `tube-straight`
   - `shell-cylindrical`, `shell-conical`
   - `head-hemispherical`, `head-ellipsoidal`, `head-torispherical`, `head-flat`, `head-conical`
   - `hx-tube-bundle`, `hx-tube-sheet`, `hx-baffle`, `hx-tube-support`
   - `nozzle-standard`, `nozzle-custom-circular`, `nozzle-custom-rectangular`, `manway-assembly`, `reinforcement-pad`
3. `lib/shapes/shapeData.ts`:
   - `addShapeMetadata` stops minting `id`/`shapeCode` (delete the `shape-${category}-${index}` logic); it only stamps `createdAt`/`updatedAt`/`createdBy`/`updatedBy`.
   - `getShapeById` becomes a real lookup on the explicit ids (the current implementation only parses `shape-global-N` and is unused outside tests — it becomes the lookup `bomCalculations` uses in Phase 2).
   - The category-scoped vs global ID divergence (`shape-plates-2` vs `shape-global-7`) disappears.
4. Tests:
   - Update `shapeData.test.ts` — it currently asserts index-based IDs (`shape-global-${index}`, `SHP-PLATES-001`).
   - Add a permanent test: all 20 `id`s unique, all `shapeCode`s unique, `id` matches `/^[a-z0-9-]+$/`.

## Phase 2 — BOM calculations read the local dataset

1. `apps/web/src/lib/bom/bomCalculations.ts`:
   - `calculateItemCost` (~line 166): replace `getDoc(doc(db, COLLECTIONS.SHAPES, shapeId))` + `docToTyped<Shape>` with `getShapeById(shapeId)` from `@/lib/shapes/shapeData`. Keep the `logger.warn('Shape not found', ...)` → `return null` path for dangling ids.
   - `validateShapeParameters` (~line 361): same replacement.
   - Material fetch is untouched — materials remain Firestore.
2. Tests:
   - `bomCalculations.test.ts`: remove the shapes `getDoc` mocks; shape path now resolves locally against real definitions (a strictly better test).
   - `__integration__/bom-workflow.integration.test.ts` (lines ~190, ~213): stop seeding a `shapes` doc into the emulator; reference a real local id (e.g. `plate-rectangular`).

## Phase 3 — Remove the Firestore shapes surface

Do this after Phase 2 compiles — deleting the constant first lets the compiler find stragglers.

1. `packages/firebase/src/collections.ts:133`: delete `SHAPES: 'shapes'`. Fix resulting compile errors (should be none after Phase 2).
2. `firestore.rules` (~line 2056): delete the `match /shapes/{shapeId}` block.
3. `firestore.indexes.json` (~lines 1735–1815): delete all 5 `"collectionGroup": "shapes"` composite indexes.
4. Prod cleanup: none — the collection has 0 docs.
5. **Deploy note:** rules/indexes changes ship on the next "Deploy - Production" dispatch (auto-selected targets). `firebase deploy` does not delete removed composite indexes from the console; the 5 orphaned shapes indexes are harmless but can be removed manually in the Firebase console at leisure.

## Phase 4 — Delete dead code and dead enum values

1. Delete `packages/functions/src/data/shapes/` (and its `dist/` output). Verified unimported; its weight formulas are 1000× wrong (missed fixes `c4cc5096`/`79d25d36`). If Cloud Functions ever need shape math, move the canonical dataset into a shared package then — don't resurrect a copy (rule 32).
2. `packages/types/src/shape.ts`: delete `CUSTOM_BOX_SECTION`, `CUSTOM_BRACKET`, `CUSTOM_ASSEMBLY` from the `ShapeCategory` enum **and** their `SHAPE_CATEGORY_LABELS` entries (the `Record<ShapeCategory, string>` type forces both). No other references exist. Re-adding a category later is trivial; a shape definition ships with it (rule 28 spirit).
3. Cheap fix while touching the files: add `unit: ''` (dimensionless) to the Straight Tube `DtoTRatio` custom formula — the only formula missing a unit.
4. **Not doing:** cleaning the ~40 stale `usedInFormulas` back-references. The field is read by nothing at runtime (verified); pure churn. Leave.
5. Optional (skip if noisy): `components/shapes/calculator/ShapeDropdown.tsx` imports individual shape constants from the data files instead of `allShapes`; harmless either way once ids are explicit.

## Phase 5 — Docs

1. `CLAUDE.md` rule 1: remove `shapes` from the global-collections list.
2. `.claude/MODULE_MAP.md`: add a `shapes` line under web modules — `lib/shapes` + `data/shapes`, local static dataset (20 parametric shapes), **no Firestore collection**; bump "Last verified".

---

## Verification

- `npx jest src/lib/shapes src/lib/bom` (jest, not vitest) — all pass including new uniqueness test.
- `/type-check`, `/lint` (scoped), `/build`.
- Manual smoke: shapes calculator page (`/dashboard/shapes/calculator`) lists and calculates; BOM editor (`/estimation/[id]`) → add shape item → **Calculate Costs** now actually recalculates the item (this was the broken path — previously silent "Shape not found").
- Pre-commit hook via `/precommit-fix`.

## Sizing & sequencing

One session. Phases 1→2→3 are order-dependent; 4 and 5 can fold into the same commit(s). No user decisions outstanding — enum deletion and Firestore removal were agreed in-session 2026-07-07.
