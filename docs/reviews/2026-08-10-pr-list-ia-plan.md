# Purchase Requests list — information architecture + UI-kit rebuild

**Status:** §4 batches 1–6 implemented 2026-08-10. §6 sibling sweep outstanding.
**Target:** [`apps/web/src/app/procurement/purchase-requests/page.tsx`](../../apps/web/src/app/procurement/purchase-requests/page.tsx) (579 lines, all inline).
**Raised:** 2026-08-10, from a screenshot review of the live page.

---

## 1. What is wrong today

### Reported

| #   | Complaint                                         | Verified finding                                                                                                                                                                                                                                                                                                                                                                                                                                                                                               |
| --- | ------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 1   | Stats block is too prominent                      | A full-width `Card` with "Total PRs 29", a row of 3 primary chips and a second "Submitted breakdown" row of 3 more chips occupies ~150px above the fold. The table starts ~600px down the page.                                                                                                                                                                                                                                                                                                                |
| 2   | Search should be first                            | Search sits fourth in the vertical stack: breadcrumbs → header → stats card → tabs → filter bar.                                                                                                                                                                                                                                                                                                                                                                                                               |
| 3   | Search by project is not available                | Half-true, and worse than "missing": free-text search _does_ match `projectName` ([page.tsx:195](../../apps/web/src/app/procurement/purchase-requests/page.tsx#L195)), but there is **no Project dropdown** (the POs page has one, [pos/page.tsx:95](../../apps/web/src/app/procurement/pos/page.tsx#L95)), and the search field uses a MUI `label` so the placeholder listing what is searchable is invisible until focus. It also advertises "department", a field that does not exist on `PurchaseRequest`. |
| 4   | Why only 2 categories, Active / Converted to RFQ? | The tab strip, the 6 clickable stat chips, and the Status `Select` are **three controls for one dimension** (status), with tabs coarsest. Selecting a status chip silently disables the tab filter ([page.tsx:181](../../apps/web/src/app/procurement/purchase-requests/page.tsx#L181)), so the visible tab can disagree with the rows shown. No sibling procurement list page has tabs.                                                                                                                       |

### Found while verifying

5. **The counts are computed over at most 50 documents.** `listPurchaseRequests({})` applies `limit(DEFAULT_PAGE_SIZE + 1)` with `DEFAULT_PAGE_SIZE = 50` ([crud.ts:295](../../apps/web/src/lib/procurement/purchaseRequest/crud.ts#L295)) and the page ignores `hasMore` and never requests another page. At 29 PRs this is invisible; at 51 the header will read "Total PRs 50", both tab counts will be wrong, and older PRs will be unreachable — no "Load more", no server-side paging.
6. **The page ignores the shared UI kit entirely** (rule 34): raw `<Table>` + `<TablePagination>`, full-page `<CircularProgress>`, no `PageHeader` (a hand-rolled `<Typography variant="h4">`), no `FilterBar`, no `StatusChip`, no `EmptyState`. `purchaseRequestListHelp` is already written in [pageHelpContent.ts:75](../../apps/web/src/lib/help/pageHelpContent.ts#L75) and **rendered nowhere**, because there is no `PageHeader` to hang it on.
7. **Raw enum values are rendered as labels** (rule 29): `RAW_MATERIAL`, `BUDGETARY`, and `status.replace('_', ' ')`. No `PURCHASE_REQUEST_*` label maps exist in `@vapour/constants` — only `PR_STATUS_CATEGORY_LABELS`, which is keyed by chip-category (`draft`, `pendingApproval`), not by the `PurchaseRequestStatus` enum, so `StatusChip` cannot use it.
8. **`title` is never displayed.** The type carries both `title` and `description` ([purchaseRequest.ts:40-41](../../packages/types/src/procurement/purchaseRequest.ts#L40-L41)); the list shows only `description`, which in practice holds a concatenation of item names ("…NPS 4 Sch 40, and 1 more item(s)") and wraps to three lines per row.
9. Errors from `loadRequests` go to `console.error` and the user sees an empty table (rule 27 — no `logger`, no toast).

---

## 2. Locked decisions (2026-08-10 — do not re-litigate)

- **Stats card: deleted.** Counts move inline into the Status dropdown — `All (29)`, `Draft (8)`, `Pending Approval (0)`, `Approved (0)`, `Rejected (1)`, `Converted to RFQ (20)`.
- **Tabs: removed.** Status is the single control for that dimension. Default selection is a synthetic `ACTIVE` option = every status except `CONVERTED_TO_RFQ` (preserves today's landing view).
- **Scope: the PR list page only.** The sibling procurement list pages get a written gap list (§6) to schedule separately, not code changes in this batch.

## 3. Target layout

```
Procurement / Purchase Requests
Purchase Requests                          [ ? ]        [+ New Purchase Request]
Manage and track all purchase requests
────────────────────────────────────────────────────────────────────────────────
[🔍 Search PR number, title, description, project, requester…            ]
[Status: Active (9) ▾] [Project: All ▾] [Type ▾] [Category ▾]      [Clear] [CSV][PDF]
────────────────────────────────────────────────────────────────────────────────
PR Number ↕ | Project | Title / Description | Type | Category | Priority | Status | Date ↕ | ⋯
```

Search is the first interactive element on the page. Everything above it is identity (breadcrumbs, title, primary action).

## 4. Work batches

### Batch 1 — labels in `@vapour/constants` (rule 29, prerequisite)

`packages/constants/src/labels.ts`:

- `PURCHASE_REQUEST_STATUS_LABELS` — `DRAFT: 'Draft'`, `SUBMITTED: 'Pending Approval'`, `UNDER_REVIEW: 'Under Review'`, `APPROVED: 'Approved'`, `REJECTED: 'Rejected'`, `CONVERTED_TO_RFQ: 'Converted to RFQ'`. Must cover all 6 members of `PurchaseRequestStatus`.
- `PURCHASE_REQUEST_TYPE_LABELS` — Project / Budgetary / Internal.
- `PURCHASE_REQUEST_CATEGORY_LABELS` — Service / Raw Material / Bought Out.
- Reuse `MANUAL_TASK_PRIORITY_LABELS` for priority, or add `PRIORITY_LABELS` if reuse across domains reads wrong — decide at implementation, do not add a second parallel map.

`packages/constants/src/statuses.ts`: the `purchaseRequest` context only overrides `SUBMITTED`/`APPROVED`/`CONVERTED_TO_RFQ`; confirm `DRAFT`/`REJECTED`/`UNDER_REVIEW` resolve correctly from the base map before relying on `StatusChip`.

Keep `PR_STATUS_CATEGORY_LABELS` only if something still uses it after the chips are deleted — otherwise remove it in the same commit (rule 32: no orphaned parallel label map).

### Batch 2 — data correctness before layout

- Load every PR, not the first 50: loop `listPurchaseRequests({ limit: 100, afterId })` while `hasMore`, with a hard cap (~1000) so a runaway can't hang the page. All filtering stays client-side over the full set, so **no new composite index is needed** — the three existing `purchaseRequests` indexes stay as they are.
- Counts in the Status dropdown are then honest by construction.
- Replace the `console.error` catch with `logger.error` + a `toast.error` carrying the real message (rule 27).

### Batch 3 — rebuild the page on the shared kit

- `PageHeader` with `title` / `subtitle` / `help={purchaseRequestListHelp}` / `action={<New PR button>}` — deletes the hand-rolled `<Typography variant="h4">` and lights up the orphaned help content.
- `FilterBar` with `onClear`, containing in order: search `TextField` (use `placeholder` + `SearchIcon` adornment, **no `label`**, so the hint is always visible — match [pos/page.tsx:237](../../apps/web/src/app/procurement/pos/page.tsx#L237)), Status (with counts), **Project** (distinct `projectName` values from the loaded set, same memo pattern as POs), Type, Category. Export buttons stay right-aligned.
- `DataTable<PurchaseRequest>` with `sortable`, `defaultSortKey: 'createdAt'`, `defaultSortDirection: 'desc'`, `loading`, `emptyMessage`, `onRowClick` → detail page, and `renderActions` via `TableActionCell` (view + move-to-trash, keeping the current status gate). This removes the raw `Table`/`TablePagination`/`CircularProgress` and gives sorting on PR number and date for free.
- `StatusChip` for status (`context="purchaseRequest"`), type, category and priority using the Batch 1 maps.
- Delete the stats `Card`, the `Tabs`/`Tab` block, `activeTab` state, `handleTabChange`, and the `stats` memo's now-unused fields.
- Column change: merge Title + Description into one cell — `title` as the primary line, `description` as a clamped 2-line secondary line — so rows stop growing to three lines.

### Batch 4 — search coverage

Match against `number`, `title`, `description`, `projectName`, `submittedByName`. Update the placeholder to name exactly those, and drop "department".

### Batch 5 — audit baselines

`scripts/audit/ui-baselines.json` ratchets F/G/H down only by hand. This page removes one `TablePagination`, one `CircularProgress` and one missing-`PageHeader`, so after the sweep lower `F: 50 → 49`, `G: 216 → 215`, `H: 190 → 189` in the same commit — otherwise the next page to add one legitimately re-consumes this slack.

### Batch 6 — verification

`/type-check`, `/lint` scoped to the touched files, `/test` (there is no test for this page today — a small render test asserting "Converted-to-RFQ rows are hidden under the default Active status" is worth adding), then `/precommit-fix` before the commit. Commit only on explicit go-ahead.

## 5. Not in scope

- Syncing filter state to the URL query string (rule 30b) — worth doing, but as its own change across procurement lists, not bolted onto this one.
- Server-side filtering / cursor paging for PRs — unnecessary at 29 documents (rule 31); Batch 2's fetch-all loop is the honest small-data answer.
- The mobile card layout — this page has none today, and `DataTable` does not do responsive cards. Unchanged, flagged.

## 6. Follow-up: sibling procurement list pages (audit only)

Measured 2026-08-10. `Proj` = has a Project filter; `RawPag` = raw `<TablePagination>`; `Spinner` = full-page `<CircularProgress>`.

| Page                | PageHeader | DataTable | FilterBar | StatusChip | Proj | RawPag | Spinner | LOC |
| ------------------- | ---------- | --------- | --------- | ---------- | ---- | ------ | ------- | --- |
| `quotes`            | ✅         | ✅        | —         | ✅         | —    | —      | —       | 339 |
| `pos`               | ✅         | —         | ✅        | —          | ✅   | ✅     | —       | 584 |
| `rfqs`              | ✅         | —         | ✅        | —          | —    | ✅     | —       | 480 |
| `purchase-requests` | —          | —         | —         | —          | —    | ✅     | ✅      | 579 |
| `goods-receipts`    | —          | —         | —         | —          | —    | ✅     | ✅      | 471 |
| `packing-lists`     | —          | —         | —         | —          | —    | ✅     | ✅      | 409 |
| `amendments`        | —          | —         | —         | —          | —    | ✅     | ✅      | 441 |
| `three-way-match`   | —          | —         | —         | —          | —    | ✅     | ✅      | 404 |
| `work-completion`   | —          | —         | —         | —          | —    | ✅     | ✅      | 325 |

`quotes` is the closest thing to a finished exemplar and is the shape the PR page should land on. The five bottom rows are entirely un-migrated; each is a self-contained ~400-line rewrite of the same kind, and each would lower an F/G/H baseline. Recommended order once the PR page proves the pattern: `goods-receipts` → `packing-lists` → `work-completion` → `three-way-match` → `amendments`, then retro-fit `DataTable` + `StatusChip` onto `pos` and `rfqs` (which already have the header/filter half).
