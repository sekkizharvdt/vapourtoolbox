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

**Approved design (2026-05-23): "AI proposes, the human disposes."** Nothing
reaches the catalog without a person confirming it, and there is **one create
path** with a duplicate check on it. This replaces the earlier auto-create
approach. Root cause of the 67% duplicates: the parser's `boughtOutResolver`
matches on an _exact_ `specCode` string, so trivial wording differences
(`SS316` vs `SS316L`, `PN10-16/CL150` vs `/CLASS150`) miss and spawn a new
entry. Key lever: the resolver already has a `canAutoCreate` flag — when
`false` it keeps the exact-match auto-**link** but returns "needs linking"
instead of creating. `parseQuote` currently hard-codes it `true`.

**5A — Display the short code, hide the long one (feedback 3.3).**

- New items created through the normal path get the short `BO-YYYY-NNNN` `itemCode`; the long `specCode` becomes an internal **match key**, never shown.
- Surface `itemCode` everywhere a bought-out code is displayed; stop showing `specCode` in the pickers / quote line / detail.
- Legacy note: the 62 parser-auto-created items currently store the _long_ specCode as their `itemCode` too — they keep it (no migration). Only new items are clean. Material codes (`PL-SS-304`) are already short.
- Effort: **S** (display only). Lowest risk — do first.

**5B — Parser: link-or-flag, never create (feedback 3.1, kills the dup generator).**

- Flip `canAutoCreate` to `false` in `parseQuote`. Exact spec match → auto-link (reuse, no dupe); no match → line flagged `manual-needed` for the user to link/create. Same stance for materials (already manual-pick).
- Deletes the silent duplicate generator with a near-one-line change. Keep the structured spec extraction (needed for pre-suggesting matches + the 5C match key).
- Pre-suggest convenience: a flagged line still carries the parser's best-guess so the picker can pre-highlight it (one-click confirm) — never auto-applied.
- Effort: **S-M**.

**5C — `findSimilar` + "always ask" confirmation on the one create path (feedback 3.2)** — _the main build_

- All creation now flows through the picker's **Create New** (materials/services/bought-out — all have it after Phase 2). Before creating, run `findSimilar`:
  - **Bought-out:** normalized match on major axes (category + type + material + size), tolerant of minor formatting (rating / end / operation; `CL150`=`CLASS150`=`150#`).
  - **Material:** category + material + grade + fuzzy name.
- UX: **Always ask — never auto-reuse.** Any candidate → dialog _"This looks like the existing **X** — use it, or create new anyway?"_ User decides. Kept simple (normalized field match, no fuzzy-string/ML).
- Effort: **M-L** (one `findSimilar` service + one confirmation dialog + wire into Create-New).

**5D — Review/edit coverage (feedback 3.4, 3.5).**

- With auto-create gone, the `needsReview` backlog stops growing. Manual creates are still flagged `needsReview`; existing queues (`/materials/needs-review`, `/bought-out?reviewOnly=true`) + edit pages cover them. Mostly verification + flag-consistency, not new infrastructure.
- Effort: **S**.

**Dropped:** the original "5.1 auto-create materials" — we're going the opposite
(better) direction. **Trade-off:** equipment-heavy quotes need a per-line
confirm instead of silent creation; mitigated by 5B's pre-suggest (most lines
are one-click). Existing 62 legacy bought-out dupes are left as-is (no
migration); a future cleanup could merge them but is out of scope.

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
