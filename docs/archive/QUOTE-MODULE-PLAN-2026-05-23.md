# Quote Module — Round-2 Feedback Implementation Plan (2026-05-23)

Plan to address the procurement user's second-round feedback
(`inputs/Quotes Module Review 2.pdf`), covering quote-creation functionality,
required improvements, and the material / bought-out module. All items are
confirmed valid against current `main`; this sequences them into shippable
phases with the design decisions called out up front.

Record counts (live, for scoping — rule 31): **28** quotes, **94** vendorQuoteItems,
**770** materials (5 `needsReview`), **62** bought_out_items (all `needsReview`).

---

## Root finding: three parallel link dialogs (rule 32)

Most of section 1 of the feedback traces to one cause — three different
"link to database" dialogs with inconsistent behaviour:

| Dialog                    | Used on                             | Show all on open | Browse      | Create New |
| ------------------------- | ----------------------------------- | ---------------- | ----------- | ---------- |
| `MaterialPickerDialog`    | New quote (Material rows)           | ✅               | ✅ category | ✅         |
| `BoughtOutPickerDialog`   | New quote (Bought-Out rows)         | partial          | ❌          | ❌         |
| `ItemLinkDialog` (tabbed) | **Detail / draft page** (all types) | ❌ search-only   | ❌          | ❌         |

**Decision:** standardise on the per-type rich pickers everywhere and **delete
`ItemLinkDialog`** (rule 32 consolidation). Add Create-New + show-all to
`BoughtOutPickerDialog` (mirror `MaterialPickerDialog`); route the detail page's
link action to the same three per-type pickers the new-quote page already uses,
keyed off the row's `itemType`. `ServicePickerDialog` already exists.

---

## Phase 1 — Quick wins (small, independent)

**1.1 Display supporting documents on the quote view (feedback 2.1)**

- Gap: [QuoteDetailClient.tsx:420](apps/web/src/app/procurement/quotes/[id]/QuoteDetailClient.tsx#L420) renders `fileUrl` via `PdfViewer` but never renders `additionalDocuments` (which the new-quote form now uploads).
- Build: render `offer.additionalDocuments[]` as a list of view/download links (and inline `PdfViewer` for PDFs) beneath the primary document.
- Effort: **S**.

**1.2 Dashboard Status filter + Clear-filters (feedback 2.2)**

- Gap: [quotes/page.tsx:217](apps/web/src/app/procurement/quotes/page.tsx#L217) has a source-type filter only; no status filter, no clear button.
- Build: add a `statusFilter` (`ALL` + `QuoteStatus`) select alongside the existing source filter, client-side (volumes are low), plus a "Clear filters" button that resets search + both filters. Labels via `@vapour/constants` (rule 29).
- Effort: **S**.

---

## Phase 2 — Unify the link dialogs (feedback 1.1 + 1.2)

**2.1 Add Create-New + show-all to `BoughtOutPickerDialog`**

- Mirror `MaterialPickerDialog`'s inline "Create New" (it already calls `createBoughtOutItem`-equivalent). New bought-out items created here get `needsReview: true`.
- Ensure it lists all items on open (it already calls `listBoughtOutItems` with `limit: 500`; confirm category="ALL" default shows everything now the index is deployed).
- Effort: **M**.

**2.2 Replace `ItemLinkDialog` on the detail page with per-type pickers**

- In [QuoteDetailClient.tsx](apps/web/src/app/procurement/quotes/[id]/QuoteDetailClient.tsx), swap `handleLinkItem`/`ItemLinkDialog` for the same `MaterialPickerDialog` / `ServicePickerDialog` / `BoughtOutPickerDialog` trio used on the new-quote page, dispatched by the row's `itemType`. Reuse the existing `handleLinked` write path.
- Delete `ItemLinkDialog.tsx` once no importers remain (rule 32). Keep the `getFriendlyQueryError` handling in the surviving pickers.
- Result: after Save-as-Draft, the user can browse-all, search, and Create-New when linking — fixes the "unable to link after draft" complaint.
- Effort: **M**.

---

## Phase 3 — Detail-page line-item edit (feedback 1.2)

- Gap: detail page supports add / link / accept / remove but has **no edit** of an existing row's qty / price / description / type / discount.
- Build: an inline edit mode (reuse the Add-Item form fields, pre-filled) → calls existing `updateVendorQuoteItem` (already supports those fields incl. discount). Respect terminal states (rule 10) — disable edit on `PO_CREATED` / `ARCHIVED`.
- Effort: **M**.

---

## Phase 4 — Description / Specification split (feedback 2.3)

**Decision (revised 2026-05-23, per user): additive split, NO bulk backfill.**
The split is additive and safe; a heuristic bulk backfill of the 94 existing
rows is unnecessary and risks overwriting good `description` data with a wrong
guess (CLAUDE.md rule 31 — tiny, mostly-historical dataset). Old rows keep their
single `description`; users can split name/spec via the Phase-3 edit form if they
ever revisit a quote. Nothing downstream (Phase 5 codegen/dedup) requires the old
rows to be split.

**4.1 Schema** — add `specification?: string` to:

- `VendorQuoteItem` ([packages/types/src/vendorQuote.ts](packages/types/src/vendorQuote.ts))
- `CreateVendorQuoteItemInput` (service)
- `ParsedQuoteItem` (parser)

**4.2 Parser** — update the `parseQuote` PROMPT so `description` = the general
item name (e.g. "Centrifugal Pump", "Motorized Control Valve") and
`specification` = the detailed technical text. Map both through. (Side benefit:
Phase-5 auto-create can then use the short `description` as the item name,
addressing the long-name complaint.)

**4.3 UI** — surface **Description** + **Specification** on: the new-quote
line-item table (two inputs), the detail Add/Edit form (two fields), and the
detail items table (spec shown under the description). Old rows render exactly
as today (full text in Description, empty Specification). Labels via
`@vapour/constants`.

**4.4 No backfill.** Existing rows are left untouched. If a one-off split is ever
wanted later, the safe recipe (preserve original in `specification`, dry-run
preview, JSON backup, idempotent) is recorded here but not built.

Effort: **M** (schema + parser + 3 UI surfaces; no migration).

This split feeds Phase 5: a clean general-name + spec improves both code
generation and duplicate detection.

---

## Phase 5 — Material / Bought-Out module (feedback 3.x)

**5.1 AI + manual material creation parity (feedback 1.1, 3.1)**

- Today the parser auto-creates **bought-out** items only; MATERIAL lines are manual-pick, so manually-picked-but-not-in-catalog items never land in the DB.
- Build: when the parser classifies a line as MATERIAL with enough detail, auto-create a Material (`needsReview: true`) and link it — reusing the existing [materialResolver.ts](functions/src/documentParsing/materialResolver.ts) from PR parsing (rule 32, don't write a parallel), but routing its code through `generateMaterialCode` instead of the `RV-{ts}` stub codes.
- Effort: **M-L**.

**5.2 Similarity / dedup before creating a new code (feedback 3.2)** — _highest value_

- This is the documented 67%-duplicate problem.
- Build a `findSimilar` step invoked at both AI-resolve time and manual Create-New time:
  - **Bought-out:** compute the candidate `specCode`, then query for existing items matching the _major_ axes (category + type + material + size) while ignoring _minor_ axes (rating / end / operation). Surface matches.
  - **Material:** match on category + material + grade (and fuzzy name).
- UX (decided 2026-05-23, per user): **Always ask — never auto-link.** Whenever `findSimilar` returns any candidate above the similarity threshold, stop and show a confirmation dialog listing the match(es): the user picks **"Use this existing item"** or **"Create new anyway."** This applies to both the manual Create-New path and the AI-parse path (AI surfaces the possible match for the user to confirm before any new code is created). No silent auto-reuse — keeps a human in the loop on every potential duplicate, matching the feedback ("highlight the similarity to the user for review and confirmation before creating a new material code").
- Effort: **L** (service + confirmation dialog + wire into both create paths).

**5.3 Simplify the displayed code (feedback 3.3)**

- bought_out_items already carry BOTH a short `itemCode` (e.g. `INST-PI-0002`) and the long deterministic `specCode` (e.g. `VLV-CHECK_DUAL_PLATE-SS316-DN200-PN10-16/CLASS150-FLG-SA`). The screenshots show the long `specCode`.
- Decision: **display `itemCode` everywhere; keep `specCode` internal** for matching/dedup only. Verify `itemCode` is always generated (short, sequential per category). Material codes (`PL-SS-304`) are already short — no change.
- Effort: **S-M** (display audit + ensure itemCode generation).

**5.4 "Needs Review" + edit for all AI-parsed items (feedback 3.4, 3.5)**

- Infra already exists: `/materials/needs-review`, `/materials/[id]/edit`, `/bought-out?reviewOnly=true`, inline edit on `BoughtOutDetailClient`. All 62 bought-out are `needsReview`; 5 materials are.
- Build: ensure every AI-created item (incl. Phase-5.1 materials) is flagged `needsReview: true`, and surface the edit affordance clearly. Confirm manual (non-review) items are editable too (they are). Mostly verification + flag-consistency, not new infrastructure.
- Effort: **S-M**.

---

## Services — where they fit (they mostly already work)

The feedback names "Material / Bought out" only, but `SERVICE` is a first-class
line type. Services are deliberately a **separate** domain concept (labor-with-rates,
not goods) and must stay separate — do not merge into materials
(see `docs/reviews/2026-05-23-devils-advocate-over-engineering.md`, "Where NOT to
simplify"). Current state, verified:

- `ServicePickerDialog` is **already rich** — shows all (`isActive` + `orderBy name`) and has inline **Create New Service** ([ServicePickerDialog.tsx:231](apps/web/src/components/services/ServicePickerDialog.tsx#L231)). It does NOT have the bought-out picker's limitations.
- Services have a full catalog with **edit** (`/services/[id]/edit`) and clean short codes (`SVC-CON-003`).
- The parser classifies `SERVICE` lines but does **not** auto-create them (only bought-out auto-creates) — so services have no `needsReview` backlog and no duplicate-explosion.

Net: services need **no service-specific work**. They benefit automatically from:

- **Phase 2** — once the detail page routes to per-type pickers, `SERVICE` rows use the already-good `ServicePickerDialog` (browse + create-new) for free.
- **Phase 3** — line-item edit is type-agnostic.
- **Phase 4** — the Description/Specification split is a line-item field, so service rows split too.

The Phase-5 material/bought-out work (dedup, code simplification, review backlog)
**does not apply** to services. Build the Phase-5.2 similarity helper generically
so it _could_ cover services later, but don't wire service dedup now — services
aren't the pain point (no auto-create), and speculative dedup would be
over-engineering (rule 31). One open question deferred to the user: whether AI
parsing should ever auto-create services (currently no; recommend keeping
manual-pick — services lack a deterministic spec code).

## Suggested sequencing & dependencies

1. **Phase 1** (quick wins) — ship immediately, independent.
2. **Phase 2** (unify pickers) — unblocks 1.1/1.2; prerequisite for clean Create-New everywhere.
3. **Phase 3** (line-item edit) — independent; pairs naturally with Phase 2 on the detail page.
4. **Phase 4** (Desc/Spec split + backfill) — schema change; do before Phase 5 so dedup/codegen use the cleaner fields.
5. **Phase 5** (material/bought-out: parity, dedup, code display, review) — the deepest work; 5.2 dedup is the highest-value item and depends on 4 + 5.1.

Each phase is independently shippable and type-checks/lints/tests clean before
moving on. Deploys ride the "Deploy - Production" CI workflow (CLAUDE.md rule 33)
— the Phase-4 backfill script runs once after that deploy.
