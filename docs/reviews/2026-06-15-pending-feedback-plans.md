# Complete Plans — All Pending Feedback (as of 2026-06-15)

**Date:** 2026-06-15
**Status:** Plans for review — no code written yet (except where noted). Covers the 4 feedback items still open after this session's fixes.
**Resolved this session (for reference):** `bktmln` GST/rupee (3873164c), `8eiv4m5e` warranty + `rPmzb4` AI parsing + `MS1NB` approver names + `hCiFX` invoice token (8497a0e0), `Jit9v` material/bought-out PR linking (c86c0c38), grpc advisories (dacca51c).

Four items remain open: **two reopened** (earlier fixes incomplete), one new (scoped separately), one large AI request.

| Item    | Title                               | Status                 | Priority                     | Effort      |
| ------- | ----------------------------------- | ---------------------- | ---------------------------- | ----------- |
| 8ImQ5s  | PO Amendment approval + date format | in_progress (REOPENED) | **HIGH** — approvals blocked | S           |
| CxERG78 | Material spec shown when linking    | in_progress (REOPENED) | MEDIUM                       | S–M         |
| iZqGG   | PO Module & PO PDF enhancements     | new                    | MEDIUM                       | M–L (4 WPs) |
| lekvyYE | Auto-populate Compare Offers        | in_progress            | LARGE                        | phased S→L  |

---

## 1. `8ImQ5s` — PO Amendment approval blocked + date format (REOPENED) — **HIGH / S**

Kumaran's follow-up: (1) the assigned approver still gets an error when approving; (2) a date still shows `2026-06-10` in the Amendment section.

### Root cause — approval failure (NOT permissions / not "approver never wired")

Verified against the live record (amendment `t1054WbK4dJ2AwJdOJqf`): the approver **is** persisted (`approverId` set), has `MANAGE_PROCUREMENT`, matching tenant — all guards pass. The real error (from the feedback screenshot) is a Firestore `undefined` write (rule 12):

```
addDoc() ... Unsupported field value: undefined (found in field notes in purchaseOrderVersions/...)
```

`approveAmendment` calls `createVersionSnapshot(...)` with **no `notes` arg** ([crud.ts:417](apps/web/src/lib/procurement/amendment/crud.ts#L417)); `createVersionSnapshot` writes `notes` unconditionally ([versioning.ts:116](apps/web/src/lib/procurement/amendment/versioning.ts#L116)). `notes` is `undefined` → `addDoc` throws → the snapshot fails → the whole approve aborts before the PO updates. **This blocks every approval, for everyone.**

### Fix

- `versioning.ts:105-116` — conditional spreads for optional fields (`notes`, `amendmentNumber`, `tenantId`): `...(notes !== undefined && { notes })`. One-file, ~2 lines.

### Date format

Mostly fixed already: `0e4b60d9` (2026-06-08, **after** the follow-up) added `displayChangeValue()` reformatting on the detail page — confirm it's deployed. One genuine leftover: [AmendmentForm.tsx:521](apps/web/src/components/procurement/AmendmentForm.tsx#L521) renders `timestampToDateInput(...)` (YYYY-MM-DD) as a reference label in the editor — wrap in `formatDate(...)` for display (keep the `<input type="date">` value at :528 as-is). Effort S.

### Also flag (out of reopened scope)

Original sub-issue (1) "no email to approver": submit only creates a task notification ([crud.ts:341](apps/web/src/lib/procurement/amendment/crud.ts#L341)); the direct-email path the admin note claims was wired (`onAmendmentStatusNotify`) was not seen invoked from the client submit. Worth a separate check.

### Plan

1. Fix `versioning.ts` conditional spreads (the blocker).
2. Verify `0e4b60d9` is deployed; fix the lone `AmendmentForm.tsx:521` label.
3. (Optional) re-verify amendment-submit email to approver.

---

## 2. `CxERG78` — Material specification shown when linking (REOPENED) — **MEDIUM / S–M**

Prior fix (47736588) added spec chips **inside** `MaterialPickerDialog` (search/list/duplicate views). Kumaran's follow-up: after linking, the **row** still shows only name + code.

### Root cause — the gap is the post-link display, plus a latent bug

1. After the picker closes, the PR/Quote row shows **only a `materialCode` chip** ([PR new:711-719](apps/web/src/app/procurement/purchase-requests/new/page.tsx#L711-L719); [PR edit:858-866](apps/web/src/app/procurement/purchase-requests/[id]/edit/EditPRClient.tsx); [quotes/new:1224-1227](apps/web/src/app/procurement/quotes/new/page.tsx)).
2. **Latent bug:** `handleMaterialSelect` fills the row's **Specification** column with the material **code**, not the real spec (`specification: ... fullCode || material.materialCode` — PR new:166-168, PR edit:287-289). So even the dedicated Spec column shows a code. _(Note: my Phase 1 commit c86c0c38 preserved this existing behaviour — this fix corrects it.)_

Available spec data: `MaterialSpecification` ([material.ts:169-177](packages/types/src/material.ts#L169-L177)) — `standard`, `grade`, `finish`, `form`, `schedule`, `nominalSize`. The full `material` object is already in `handleMaterialSelect`; only id/code/name/unit are captured today.

### Fix (overlaps the catalog/PR-linking area — see §5)

1. Add a shared `formatMaterialSpec(spec?): string` helper (rule 32 — none exists) joining non-empty `[standard, grade, schedule, nominalSize, finish, form]` with `·`.
2. In each `handleMaterialSelect`/`handleMaterialPicked`, auto-fill the Specification field with the **real** spec string (keep the "only if user hasn't typed one" guard) instead of the code.
3. Add small `standard`/`grade` chips next to the code chip on each linked row.
4. Surfaces: PR new + PR edit (primary); quotes/new (secondary); optionally the picker detail pane + BOM `AddBOMItemDialog` for consistency.

Effort S (PR new+edit only) to M (all surfaces + chips).

---

## 3. `iZqGG` — PO Module & PO PDF enhancements (new) — **MEDIUM / M–L**

Fully scoped in **[docs/reviews/2026-06-15-po-module-and-pdf-enhancements.md](docs/reviews/2026-06-15-po-module-and-pdf-enhancements.md)**. Summary: 9 sub-items, 1 already done (vendor address+GSTIN), grouped into 4 work packages:

- **WP1** (PDF-only quick wins): Grand Total in words, attachment list in PDF, verify vendor data. **S–M.**
- **WP2** (attachments ZIP on download, mirror `rfqZipService`). **M.**
- **WP3** (edit Description + Specification; move HSN/SAC + attachments View→Edit). **M.** Decision: keep read-only attachment list in View.
- **WP4** (Required/Not-Required scope toggles + PDF section gating + delivery-schedule field). **M–L.** Decision: confirm toggle sections + omit-vs-label.

Decisions needed: see §3 of that doc (toggle semantics, View-vs-Edit attachments, amount-in-words currency).

---

## 4. `lekvyYE` — Compare Offers automatic in all fields (in_progress) — **LARGE / phased**

The comparison grid ([OfferComparisonClient.tsx](apps/web/src/app/procurement/rfqs/[id]/offers/OfferComparisonClient.tsx)) is **already a pure auto-rendered read view** — it shows whatever was stored on each `VendorQuote` at upload. The RFQ AI parser (`parseOfferWithClaude.ts`) already extracts ~90% of the grid's fields (prices, delivery, commercial terms, deviations). The "still manual" feeling comes from three real gaps, not from the grid.

### Gaps

- Parsing is an **opt-in per-vendor button**, not the default → if skipped, everything is typed.
- **Spec Compliance** (`meetsSpec`) is a weak heuristic (`!deviations`), disconnected from the stronger `compareOfferWithSpecs` function that already runs but isn't wired into per-item flags.
- **Unmatched** vendor lines / null fields silently fall back to manual 0-price entry; GST defaults to 18%.
- No **landed-cost / normalized** comparison (freight/P&F/insurance are free-text, never folded into a comparable number).

### Phased plan

- **Phase 1 (S) — wire up what exists:** auto-run parse on upload; feed `compareOfferWithSpecs` deviations into per-item `meetsSpec`; stop silently defaulting GST/`meetsSpec` to "needs review" instead.
- **Phase 2 (M) — close extraction gaps:** add `meetsSpec` to the Claude schema; improve RFQ-item matching; surface unmatched lines; GST/currency reliability.
- **Phase 3 (M) — derived comparison:** compute landed cost + normalized unit price as grid columns (needs the parser to emit numeric freight/P&F).
- **Phase 4 (L, lower confidence) — full structured commercial-terms extraction** across heterogeneous EPC PDFs. Keep a human review-and-confirm step; "automatic" = pre-filled + verified, not no-human-in-loop.

Recommend Phase 1 only for now (addresses most perceived pain); schedule 2–4 deliberately.

---

## 5. Recommended cross-item order

1. **`8ImQ5s` amendment approval** — HIGH, S, unblocks a broken workflow. Do first.
2. **`CxERG78` material spec on link** — S, and it overlaps the PR-linking code just touched in catalog Phase 1 (corrects the code-into-spec behaviour there). Do alongside any further PR-linking work.
3. **`iZqGG` WP1** — PDF quick wins, S–M, high visibility.
4. **`lekvyYE` Phase 1** — S, big perceived win for accounting.
5. Then **iZqGG WP2–WP4** and **lekvyYE Phase 2+** as scheduled.

All ship via the standard CI "Deploy - Production" dispatch. New user-visible strings route through `@vapour/constants/labels.ts` (rule 29); watch for new `where + orderBy` needing indexes (rule 2).
