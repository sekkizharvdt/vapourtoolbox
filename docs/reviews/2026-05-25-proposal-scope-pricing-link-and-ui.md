# Implementation Plan — Proposal Module: Scope↔Pricing Link + Editor UI

**Date:** 2026-05-25
**Source:** In-session request (proposals user) — two asks: (1) scope of work is not linked to pricing; (2) the proposal editor UI is cumbersome. Follow-up: line-item breakup must be supported when the customer asks for it, with one uniform model.
**Status (updated 2026-07-07):** OPEN — not started. The procurement session that blocked this landed 2026-05-26, but this plan was never picked up: `PriceSection` still lacks `scopeCategoryKeys`/`breakdownMode`/`lines`, no `PriceLine` type exists, and the editor still shows the flat 11-tab bar. **Adopted 2026-07-07 as completion-plan item A4 (Phase 6)** — execute this plan as written when Phase 6 starts; confirm the Q1–Q6 shape questions (§3) with the user at that point. A1's BOM cost-sheet block slots into this model unchanged.
**Related design:** `PROPOSALS-WORKFLOW-DESIGN-2026-04-25.md`, `PROPOSALS-WORKFLOW-DESIGN-2026-04-25.md` (Stages 2 / 2.5).

---

## 1. Context & current state

The proposal editor ([`ProposalDetailClient.tsx`](apps/web/src/app/proposals/[id]/ProposalDetailClient.tsx), 1,233 lines) is a **flat bar of 11 tabs** (`TAB_OVERVIEW`…`TAB_PREVIEW`, [lines 106–132](apps/web/src/app/proposals/[id]/ProposalDetailClient.tsx#L106-L132)), URL-driven via `?tab=<name>`. Three tabs hold the data in question, sitting in three **disconnected** layers:

| Layer     | Tab     | Field                           | Shape                                                                                                                                                                                                     |
| --------- | ------- | ------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Scope** | Scope   | `unifiedScopeMatrix`            | 11 discipline categories (`ScopeCategoryKey`) → `UnifiedScopeItem[]` — each item has `id`, `classification` (SERVICE/SUPPLY), `included`, `quantity`, `unit`, `linkedBOMs`, `estimationSummary.totalCost` |
| **Cost**  | Costing | `pricingBlocks[]`               | Manpower / per-manday / lump-sum / BOM blocks, each with a `subtotal`. **No scope tag.**                                                                                                                  |
| **Price** | Pricing | `clientPricing.priceSections[]` | Flat `{ id, title, description?, amount, included, order }`. **References nothing.**                                                                                                                      |

**The disconnect (verified):**

- The only existing scope↔cost link is BOM-mediated and partial: scope items carry `linkedBOMs`, and a `BOM_COST_SHEET` block references `linkedBomIds`. Manpower/lump-sum costs have no scope tie at all.
- [`PriceSection`](packages/types/src/proposalPricing.ts#L138-L153) has **no** `scopeCategoryKey` / `scopeItemId` — pricing is fully decoupled from scope.
- Cost flows one way only: `costBasisInr = Σ pricingBlocks[].subtotal` → `× (1 + markup%)` → revenue target → **hand-typed** price sections ([`computeCommercialSummary`](apps/web/src/lib/proposals/commercialSummary.ts#L79-L149)).
- The **PDF** ([`ProposalPDFDocument.tsx`](apps/web/src/components/pdf/ProposalPDFDocument.tsx)) renders "Scope of Services" + "Scope of Supply" ([~L635–678](apps/web/src/components/pdf/ProposalPDFDocument.tsx#L635-L678)) with **no costs**, and a separate "Commercial Summary" ([~L755–826](apps/web/src/components/pdf/ProposalPDFDocument.tsx#L755-L826)) with **no scope reference**. The customer cannot see which price buys which scope.

**Two problems, one root opportunity:** introducing a shared scope key on the pricing layer fixes the link _and_ justifies merging the split Costing/Pricing tabs into one coherent Commercials view — which is the largest single contributor to the "cumbersome" feel.

---

## 2. Design principle — one uniform, scope-aware pricing model

The line-item requirement is the design constraint. We do **not** build a second "itemized pricing" feature beside the existing summary pricing (rule 32). Instead, `PriceSection` becomes scope-aware and _optionally itemizable_, so the same array drives both renderings:

```
clientPricing.priceSections[]            ← one canonical structure
  PriceSection
    scopeCategoryKeys?: ScopeCategoryKey[]   ← THE LINK: which disciplines this section covers
    breakdownMode: 'LUMP_SUM' | 'ITEMIZED'   ← default LUMP_SUM (= today's behaviour)
    amount: number                            ← section total (quote currency)
    lines?: PriceLine[]                       ← populated only when ITEMIZED
      PriceLine { id, scopeItemId?, label, quantity?, unit?, amount }
```

- **LUMP_SUM section** = today's flat row (one amount). Existing proposals are LUMP_SUM by default-on-read — **no migration, no schema-version field** (rule 31; optional fields + `breakdownMode ?? 'LUMP_SUM'`).
- **ITEMIZED section** = its `amount` is the sum of `lines[]`, each line tied to a `UnifiedScopeItem` via `scopeItemId`.
- **Same editor, same `computeCommercialSummary`, same PDF path** branch on `breakdownMode`. A proposal can mix (e.g. _Equipment Supply_ itemized as a BOQ, _Engineering_ as a lump sum) — real-world EPC behaviour, still one model.

And cost gets the same key so margin is traceable per discipline:

```
PricingBlockBase.scopeCategoryKey?: ScopeCategoryKey   ← which discipline this cost belongs to
```

This yields the full trace the user is missing:

```
scope category ──(scopeCategoryKey)── costing blocks  → cost per discipline
scope category ──(scopeCategoryKeys)── price section   → revenue per discipline → margin per discipline
scope item     ──(scopeItemId)──────── price line       → itemized customer breakup
```

---

## 3. Decisions needed before coding (confirm with user)

| #   | Decision                        | Options                                                                                                                                           | Recommendation                                                                                                     |
| --- | ------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------ |
| Q1  | Breakup granularity toggle      | (a) proposal-level "Summary vs Itemized" switch; (b) **per-section** `breakdownMode` with an "Itemize all / Summarize all" shortcut               | **(b) per-section** — supports mixed proposals; the shortcut keeps it one-click for the simple case                |
| Q2  | Itemized line amounts           | (a) auto-derived = scope item BOM cost × markup, read-only; (b) **seed-then-editable** — pre-fill from scope/BOM cost × markup, user can override | **(b)** — mirrors the existing single-section auto-sync philosophy; lets the user massage line prices              |
| Q3  | Scope-item name on a price line | (a) render-time lookup from `unifiedScopeMatrix`; (b) **snapshot `label` + `scopeItemId` + "Refresh from scope" action + drift badge**            | **(b)** — rule 13: denormalize only with a sync strategy. Snapshot for PDF stability, flag drift, one-click resync |
| Q4  | Section ↔ category cardinality  | (a) one section per category; (b) **section covers a set of categories** (`scopeCategoryKeys[]`), default one-per-category on Generate            | **(b)** — lets the user fold _Piping Eng + Piping Fab_ into one "Piping" price line                                |
| Q5  | Merge Costing + Pricing tabs?   | (a) keep separate but linked; (b) **merge into one "Commercials" view** (scope category → cost → price side by side)                              | **(b)** — biggest UI win; the link is most legible in one screen                                                   |
| Q6  | Tab grouping mechanism          | (a) **top stage bar (4 stages) + secondary tabs**; (b) accordion sidebar; (c) wizard/stepper                                                      | **(a)** — least disruptive to the existing `?tab=` URL scheme and MUI tab pattern                                  |

---

## 4. Phases

Ordered to deliver the UI win early (low-risk, independent) and build the link on a stable model foundation.

### Phase 1 — Scope-aware pricing model (types + rollup)

Foundation; no user-visible behaviour change, fully backwards compatible.

- **Types** ([`packages/types/src/proposalPricing.ts`](packages/types/src/proposalPricing.ts)):
  - Add to `PriceSection`: `scopeCategoryKeys?: ScopeCategoryKey[]`, `breakdownMode?: 'LUMP_SUM' | 'ITEMIZED'`, `lines?: PriceLine[]`.
  - New `PriceLine { id; scopeItemId?: string; label: string; quantity?: number; unit?: string; amount: number }`.
  - Add to `PricingBlockBase`: `scopeCategoryKey?: ScopeCategoryKey`.
  - Import `ScopeCategoryKey` from `./proposal` (same package).
- **Rollup** ([`commercialSummary.ts`](apps/web/src/lib/proposals/commercialSummary.ts)):
  - For each included section: `breakdownMode === 'ITEMIZED'` → `amount = round2(Σ lines[].amount)`; else use stored `amount` (unchanged).
  - **Single-section auto-sync stays LUMP_SUM-only** — an itemized lone section is user-controlled (its amount = Σ lines). Reconciliation banner applies whenever any section is itemized OR there are ≥2 sections (existing `delta`/`hasDelta` logic).
  - New optional per-section rollup fields on `CommercialSummary` so the editor can show **cost / target / margin per section**: derive each section's cost basis = `Σ pricingBlocks[].subtotal where scopeCategoryKey ∈ section.scopeCategoryKeys`; section target = cost × (1 + markup%). Round at every step (rule 21).
- **No migration** (rule 31): optional fields + read defaults. Verify proposal count via the firebase-feedback service account if in doubt, but default position is no legacy data.
- **Tests:** extend [`proposalService.test.ts`](apps/web/src/lib/proposals/proposalService.test.ts) / add `commercialSummary.test.ts` — LUMP_SUM unchanged, ITEMIZED sums lines, mixed proposal, per-section cost rollup, rounding.

**Acceptance:** existing proposals render byte-identical; new optional fields round-trip through `getProposalById`/`updateProposal`.

### Phase 2 — Group the 11 tabs into 4 stages (UI, independent)

Delivers the "cumbersome" win first; touches navigation only.

- In [`ProposalDetailClient.tsx`](apps/web/src/app/proposals/[id]/ProposalDetailClient.tsx), introduce a **top-level stage bar** over the existing tab content:
  | Stage | Contains |
  |---|---|
  | **Setup** | Overview, Description, Qualifications |
  | **Scope** | Scope, Compliance |
  | **Commercials** | Costing, Pricing, Delivery _(merged in Phase 3)_ |
  | **Document** | Cover Letter, Terms, Preview |
- Keep the secondary tab row within each stage, and **preserve the `?tab=<name>` URL scheme** (the "Mark Scope Complete" redirect lands on `?tab=scope`, [L188–197](apps/web/src/app/proposals/[id]/ProposalDetailClient.tsx#L188-L197)). Derive the active stage from the active tab; selecting a stage selects its first tab.
- **Rule 30b:** keep using `window.history.replaceState` for the `?tab=` sync (already done at [L209–215](apps/web/src/app/proposals/[id]/ProposalDetailClient.tsx#L209-L215)) — do **not** switch to `router.replace`.
- **Rule 29:** stage labels go in [`packages/constants/src/labels.ts`](packages/constants/src/labels.ts), not inline.

**Acceptance:** all 11 editors reachable in 4 stages; deep links (`?tab=pricing`, etc.) still land correctly; no scroll-jump on tab change.

### Phase 3 — Merged, scope-linked Commercials view (summary level)

The core of the linking ask (Q5). Combine [`PricingBlocksEditor`](apps/web/src/app/proposals/[id]/pricing/PricingBlocksEditor.tsx) (Costing) and [`PricingEditor`](apps/web/src/app/proposals/[id]/pricing/PricingEditor.tsx) (Pricing) into one **Commercials** view organised by scope discipline.

- **Per-discipline rollup panel:** for each scope category with included items, show _Scope items → Cost (tagged blocks) → Price section → Margin_. Reuse the per-section cost fields added in Phase 1.
- **Tag costing blocks with `scopeCategoryKey`** (a selector on each block in the costing editor).
- **Assign `scopeCategoryKeys` to each price section** (a multi-select of disciplines).
- **"Generate price sections from scope"** action: one section per included, costed discipline (default), `amount = categoryCost × (1 + markup%)`, in render order from `SCOPE_CATEGORY_ORDER`. Idempotent — regenerating reconciles against existing sections rather than duplicating (rule 9).
- **Validation banners (non-blocking):**
  - included scope discipline with items but no covering price section → "unpriced scope";
  - price section covering a discipline with no included items → "section has no scope";
  - section amount vs its scope-cost target delta (reuse `hasDelta`).
- **Rule 22:** every new field written on create and restored in the edit reset effect; round-trip create→save→edit→save.

**Acceptance:** tagging a block and a section shows live per-discipline cost/price/margin; Generate seeds correct sections; mismatch banners fire correctly.

### Phase 4 — Line-item breakup mode (per-section ITEMIZED)

Satisfies the customer-itemization requirement on the uniform model (Q1–Q4).

- Per-section **breakdown toggle** `LUMP_SUM ⇄ ITEMIZED`, plus an "Itemize all / Summarize all" shortcut at the top of Commercials (Q1).
- When a section is itemized: seed `lines[]` from the included `UnifiedScopeItem`s in its `scopeCategoryKeys`; each line snapshots `label`/`quantity`/`unit` and stores `scopeItemId` (Q3). Line `amount` seeded from the item's BOM cost × markup, editable (Q2).
- **Drift handling (Q3):** a "Refresh from scope" action re-syncs labels/qty/unit from current scope items; show a drift badge when a line's snapshot differs from the live scope item, and an "orphaned line" badge when `scopeItemId` no longer resolves.
- Section `amount` becomes read-only (= Σ lines) while itemized.

**Acceptance:** itemize a section → lines mirror its scope items → editing a line updates the section total and the rollup; renaming a scope item raises a drift badge; refresh resolves it.

### Phase 5 — PDF + Preview: render both modes, cross-reference scope

Make the customer document reflect the link.

- In [`ProposalPDFDocument.tsx`](apps/web/src/components/pdf/ProposalPDFDocument.tsx) Commercial Summary ([~L755–826](apps/web/src/components/pdf/ProposalPDFDocument.tsx#L755-L826)):
  - **LUMP_SUM section** → one row (today). Optionally print the covered discipline names as the section sub-line.
  - **ITEMIZED section** → a sub-table of lines (`description / qty / unit / amount`) with a section subtotal, then the existing Subtotal/Tax/Total rollup. Respect `rollTaxIntoSections` (foreign-quote tax bake-in) consistently across both modes.
- Keep the math in `computeCommercialSummary` — the PDF stays a pure renderer of the summary (single source of truth).
- Update [`PreviewClient`](apps/web/src/app/proposals/[id]/preview/PreviewClient.tsx) to match.

**Acceptance:** a mixed proposal (one itemized + one lump-sum section) renders both correctly; INR and foreign-currency quotes both total correctly; per-section subtotals sum to the grand total.

---

## 5. Sequencing & effort (rough)

| Phase | Scope                                | Effort   | Gate                                             |
| ----- | ------------------------------------ | -------- | ------------------------------------------------ |
| 1     | Scope-aware model + rollup           | ~1 d     | Confirm Q1–Q4 shape first                        |
| 2     | Tab grouping into 4 stages           | ~1 d     | Independent — can ship alone as the first UX win |
| 3     | Merged scope-linked Commercials view | ~2.5–3 d | Q5 (merge) confirmed                             |
| 4     | Line-item breakup mode               | ~2 d     | Depends on Phase 1 + 3                           |
| 5     | PDF + Preview both modes             | ~1.5 d   | Depends on Phase 4                               |

**Cross-cutting rules engaged:** 2 (indexes — none expected, nested fields), 13 (denormalize only with a sync strategy — Q3 resync), 21 (financial precision — round per step), 22 (create/edit field completeness), 26 (parent→child denormalization — price line snapshots scope item fields), 29 (labels), 30b (history.replaceState for `?tab=`), 31 (no migration/version field — optional fields), 32 (one canonical pricing model — do not fork an "itemized pricing" feature).

**Out of scope / explicitly not doing:**

- No per-scope-item pricing as a separate collection or schema — itemization lives inside `PriceSection.lines` (rule 32).
- No `priceSectionsVersion` or v1→v2 conversion (rule 31 — the exact trap a prior pricing rebuild fell into).

---

_Plan prepared 2026-05-25. Blocked behind the in-progress procurement session. Deploys ship via the "Deploy - Production" CI workflow (auto-detected targets) — no local `firebase deploy` (rule 33)._
