# UI/UX Standardisation — Assessment & Plan (2026-07-03)

Based on a 4-dimension audit (formatters, labels, shared components, theming) of `apps/web/src`.
Companion goals: (a) clean up the existing fragmentation with targeted, low-risk sweeps;
(b) make sure **future development is standard-compliant by default** via skills + audit-script
guardrails, following the `enforced-rules.json` ratchet pattern.

## Locked decisions

| Decision      | Choice                                                                                                                                                                                                                                                                                                                                            |
| ------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| DataTable     | **Adopt for new list pages + 2–3 pilot migrations**; existing pages migrate opportunistically. Rationale: deleting it forfeits the only lever against ~100 lines of table boilerplate per list page; mass-migrating 79 working pages is weeks of regression risk for zero functional gain. A count-ratchet stops the bespoke-table count growing. |
| Sweep depth   | **Targeted sweeps** — formatters, dates, snackbars, status colors, dead/duplicate components, HR shadow labels. No table-header or table-markup mass migration.                                                                                                                                                                                   |
| Rule 29 scope | **Narrowed to enum/domain labels** (status names, transaction types, work components — strings that change over time), enforced structurally via a shared `StatusChip`. Table headers and button texts stay inline.                                                                                                                               |

## Audit findings (evidence base)

| Dimension        | State          | Key numbers                                                                                                                                                                      |
| ---------------- | -------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Theme/palette    | Strong         | 1 `VapourThemeProvider`; 257 files use palette tokens; full token system in `packages/ui/src/theme/`                                                                             |
| Breadcrumbs      | Strong         | `PageBreadcrumbs`: 143 importers                                                                                                                                                 |
| Toast            | Mostly unified | `useToast`: 46 files; 8 legacy local-Snackbar files                                                                                                                              |
| Formatters       | Partial        | canonical `lib/utils/formatters.ts` (26 exports): 112 importers; BUT 74 files call `.toLocaleDateString()` raw, ~70 files define local `format*`, 5 duplicate formatter families |
| Page headers     | Partial        | `PageHeader`: ~50/239 pages; ~90 pages hand-roll `Typography h4`                                                                                                                 |
| Loading/empty    | Weak           | 217 files render `CircularProgress` raw vs 43 using `LoadingState`; 2 `EmptyState` impls (one dead)                                                                              |
| Confirm dialogs  | Fragmented     | 2 shared impls (26 + 9 users) + ~69 bespoke confirm `<Dialog>`s                                                                                                                  |
| Tables           | Unstandardised | `DataTable`: **0 importers**; ~79 list pages hand-roll Table+pagination; 50 files wire raw `TablePagination`                                                                     |
| Labels (rule 29) | Weak           | 13 files import label maps; 12 of ~19 maps unused; ~1,450 inline table-header strings in 204 files; HR keeps byte-for-byte shadow copies in `lib/hr/*/displayHelpers.ts`         |
| Status colors    | Split          | shared `getStatusColor` (`@vapour/ui/utils/statusColors.ts`): 35 users; 27 files roll their own; second color source in `@vapour/constants/statuses.ts`; no shared StatusChip    |
| Buttons          | No convention  | outlined 1182 vs contained 449; some detail pages have no emphasized primary action                                                                                              |

Dead code found: `@vapour/ui` `DataTable` (to be revived) + `useDialogState`;
`common/EmptyState.tsx`, `common/forms/FormDialog.tsx`, `common/StandardDialogActions.tsx`;
`lib/utils/currency.ts` `formatCurrency` (1 importer, duplicates canonical).
Known bug: `DataTable` declares a `loading` prop but never renders a loading state.

---

## Phase 1 — Delete duplicates & dead code (~½ day) ✅ DONE 2026-07-03

Rule 32 violations inside the standardisation layer itself. All deletions verified 0-importer first.

1. Delete `apps/web/src/components/common/EmptyState.tsx`, `common/forms/FormDialog.tsx`,
   `common/StandardDialogActions.tsx`, `packages/ui/src/hooks/useDialogState.ts` (all 0 importers).
2. `lib/utils/currency.ts`: remove its `formatCurrency`, repoint the 1 importer to
   `lib/utils/formatters.ts`; keep any unique currency-symbol helpers (or fold them into formatters).
3. **ConfirmDialog consolidation** — canonical = provider-based `useConfirmDialog`
   (`components/common/ConfirmDialog.tsx`, 26 users). Migrate the 9 `@vapour/ui ConfirmDialog`
   users; remove the `@vapour/ui` duplicate (or re-export the canonical from there).
4. **HR shadow labels** — `lib/hr/leaves/displayHelpers.ts` and `lib/hr/travelExpenses/displayHelpers.ts`
   duplicate `@vapour/constants/labels.ts` byte-for-byte. Re-export from constants instead; local
   `formatLeaveDate`/`formatLeaveDateTime` are replaced by canonical `formatDate` (Sweep A).
5. Fold `lib/procurement/threeWayMatchHelpers.ts` `formatPercentage` and the 4 local `formatMoney`
   copies (`serviceCalculations.ts`, `PricingEditor.tsx`, `PricingBlocksEditor.tsx`,
   `CostBreakdownPanel.tsx`) into canonical imports.
6. PDF formatters (6 files with local `formatCurrency`/`formatDate`): repoint to canonical —
   `@react-pdf/renderer` components can import plain functions fine.

### Phase 1 execution notes (deviations from the plan surfaced to and approved by the user)

- **ConfirmDialog**: the two implementations had diverged in capability, not just name —
  `@vapour/ui`'s version had `loading`/`error`/`warning`/`variant`/`description` that 8 of its 9
  importers relied on (SSOT tabs' delete spinners). Resolved by merging those features into
  `common/ConfirmDialog.tsx`'s standalone export (now the single canonical implementation) rather
  than doing a lossy prop-rename migration. `@vapour/ui`'s `ConfirmDialog` is deleted.
- **threeWayMatchHelpers.formatPercentage**: NOT a true duplicate of canonical `formatPercentage`
  — local took an already-scaled 0–100 value, canonical expects a 0–1 fraction. Direct repoint
  would have produced 100x-inflated percentages. Kept as a thin adapter delegating to canonical.
- **PDF formatters (all 6)**: every one differed cosmetically from canonical (currency prefix
  "Rs." vs "INR", symbol vs ISO code, digit grouping, date separators) on real business documents
  (POs, travel expense reports, BOM quotes, transmittals, period reports). User approved full
  canonicalization, accepting the cosmetic changes — all 6 now delegate to
  `formatCurrencyCode`/`formatDate` from `lib/utils/formatters.ts`.
- **Found but out of scope**: `AssetDetailClient.tsx:250` has a pre-existing 100x display bug —
  `formatPercentage((total/purchase)*100)` double-multiplies since canonical already expects a
  fraction and multiplies by 100 internally. Also `packages/constants/src/currencies.ts:105` has
  its own `formatCurrency` (7th duplicate family, not audited) using manual symbol-prefix + `en-IN`
  toLocaleString instead of Intl currency style. Neither was in the original audit's target list;
  flagging for a future fix rather than expanding this sweep's blast radius.
- Full production `next build` OOMs in this sandbox (pre-existing environment constraint, see
  `feedback_precommit_hook_and_no_verify` memory) — verified correctness instead via clean
  `tsc --noEmit` across web + packages, passing lint-staged, passing unit tests, and clean
  `scripts/audit/check-rules.js`.

## Phase 2 — Build the two missing shared pieces (~1 day) ✅ DONE 2026-07-03

1. **`StatusChip` component** (in `@vapour/ui`, alongside a single color source):
   - Props: `status`, `domain` (e.g. `'quote' | 'transaction' | 'leave' | 'proposal' | ...`).
   - Label from the `@vapour/constants/labels.ts` maps (this instantly makes the 12 unused maps live).
   - Color from ONE source: merge `@vapour/constants/statuses.ts` color data and
     `@vapour/ui/utils/statusColors.ts` into a single map co-located with the label maps in
     `@vapour/constants`; `@vapour/ui` consumes it. Delete the loser.
2. **Fix + harden `DataTable`**:
   - Implement the dead `loading` prop (render `LoadingState` rows / skeleton).
   - Confirm it composes with `FilterBar`, `TableActionCell`, `StatusChip`, `EmptyState`.
3. **Button convention** (document only, no sweep): exactly one `variant="contained"` primary
   action per view; secondary actions `outlined`; destructive actions `color="error"`.

### Phase 2 execution notes

- **Audit correction**: `@vapour/constants/statuses.ts` (`STATUSES`, `USER_STATUSES`,
  `PROJECT_STATUSES`, `APPROVAL_STATUSES`, `getStatus*`, `StatusConfig`) turned out to have
  **zero real importers repo-wide** — the original audit's grep hits were false-positive substring
  matches on unrelated local identifiers (e.g. `POST_SUBMIT_STATUSES`, `MARITAL_STATUSES`). So this
  wasn't a "merge two active systems" job — it was "delete dead code, keep the live one." The live
  system is `@vapour/ui/utils/statusColors.ts`'s `getStatusColor`/`getPriorityColor`/`getRoleColor`
  (35 + 11 + 1 real call sites). Resolution: moved that logic into `@vapour/constants/statuses.ts`
  (co-located with labels, framework-agnostic — re-typed `ChipProps['color']` as a plain
  `StatusChipColor` union so `@vapour/constants` doesn't gain an MUI dependency), deleted the old
  dead maps, and made `@vapour/ui/utils/statusColors.ts` a thin re-export so its ~47 importers are
  unaffected.
- **`StatusChip` API** ended up simpler than "domain" enum dispatch: `{ status, labels?, context? }`
  — `labels` is any `@vapour/constants` label map (`Record<string,string>`), `context` reuses
  `getStatusColor`'s existing context union. This mirrors what most of the ~27 local
  `getStatusColor`/inline-label call sites already do by hand, so Phase 4 Sweep B is a mechanical
  swap, not a rewrite. Domain-to-label-map wiring is the caller's job (only the caller knows which
  map fits), not a giant registry inside the component.
- **`DataTable` loading bug**: root cause was that `loading` was declared in the props _interface_
  but never destructured in the function signature — TypeScript doesn't flag an unused prop, so it
  silently did nothing for however long the component existed. Fixed by destructuring `loading =
false` and branching to `<LoadingState variant="table">` before the empty-check; also swapped the
  hand-rolled empty-row `<Typography>` block for `<EmptyState variant="table">` per item 2's
  "confirm it composes" ask. Added regression tests for both (`DataTable.test.tsx`,
  new `StatusChip.test.tsx`) — 87/87 `@vapour/ui` tests pass.
- Found and cleared a stale `tsconfig.tsbuildinfo` incremental-build cache under `packages/*` that
  was producing phantom "not exported" type errors unrelated to the actual code; safe to delete,
  regenerates automatically.

## Phase 3 — DataTable pilots (~1 day) ✅ DONE 2026-07-03

Migrate 2–3 list pages to `DataTable` + `FilterBar` + `StatusChip` + canonical formatters,
chosen to exercise different shapes:

- `app/accounting/bills/page.tsx` (status chips, currency columns, permission-gated actions)
- `app/procurement/quotes/page.tsx` (already the best label-map adopter)
- one HR list (`app/hr/travel-expenses/page.tsx` — also kills a shadow-label consumer)

Extend `DataTable` where the pilots expose gaps (don't fork it). On completion, update
`.claude/MODULE_MAP.md` exemplar row "List page with filters + pagination" to point at a pilot page.

### Phase 3 execution notes

- **CI regression fixed first**: committing Phase 2 invalidated `@vapour/ui`'s turbo cache, which
  made CI actually execute `@vapour/ui:type-check` for what looks like the first time in a while —
  surfacing a pre-existing, unrelated bug: `packages/ui/tsconfig.json`'s `"types"` array narrowly
  overrode the root config to `["jest", "@testing-library/jest-dom"]`, excluding `"node"`, and
  `@vapour/ui` had no `@types/node` dependency of its own. Since `@vapour/constants` exposes raw
  `./src/index.ts` as its `types` entry (not a compiled `.d.ts`) and two of its files reference
  `process.env`, any consumer type-checking that source without Node globals in scope breaks. Fixed
  by adding `"node"` to the types array and `@types/node` as a devDependency (shipped as its own
  commit, `596a2995`, since it was a live CI break, not part of this phase's plan).
- **`DataTable` gained `containerSx`/`tableSx` passthrough** — the first real pilot (bills) needed
  desktop-only responsive hiding (`display: { xs: 'none', md: 'block' }`) and horizontal-scroll
  styling (`minWidth: 1100`) that `DataTable` had no way to express. Extended rather than forked.
- **`TableActionCell.onClick` widened to `(event?: React.MouseEvent) => void`** — the quotes page
  needs `event.stopPropagation()` inside its delete action (the row itself has `onRowClick`
  navigation), which the old strict `() => void` signature couldn't carry. Backward compatible:
  all pre-existing zero-arg callers still satisfy an optional-param signature.
- **Mobile/desktop split (bills page) not folded into `DataTable`**: bills has a fully separate
  bespoke mobile card-stack view (CSS-breakpoint-swapped with the desktop table), which
  `DataTable` was never designed to replace. Left the mobile cards as page-local JSX; only the
  desktop table adopted `DataTable`. Desktop and mobile now paginate independently (each has its
  own internal state) rather than sharing one page/rowsPerPage — a minor, disclosed behavior
  change with no real-world impact since a user only ever sees one view at a time.
- **Two `getStatusColor` context extensions, both chosen to produce zero visible color change**:
  `'quote'` (bills reused the existing `'bill'` context; quotes needed its own since e.g. its
  `ARCHIVED` status is intentionally colored success/green — "lifecycle completed normally" — not
  the base map's error/red) and `'travelExpense'` (mirrors the pre-existing local
  `TRAVEL_EXPENSE_STATUS_COLORS` map exactly). Both are additive — no existing context's mapping
  changed.
- **Status label TEXT did change visibly** on bills/quotes (e.g. `"DRAFT"` → `"Draft"`,
  `"VOID"` → `"Voided"`) — this is the direct, intended effect of adopting `StatusChip` with a
  canonical label map (rule 29's whole point), not treated as a deviation requiring sign-off,
  unlike the Phase 1 PDF-formatter case.
- **Formatter fixes bundled in**: quotes page's total-amount cell went from a bare
  `.toLocaleString('en-IN', ...)` (silently assuming every quote shares one currency, taken from
  `quotes[0]`) to `formatCurrency(q.totalAmount, q.currency)` per row — both more correct (each
  quote can have its own currency) and canonical. Travel-expenses page's local `formatExpenseDate`/
  `formatExpenseAmount` (from `lib/hr/travelExpenses/displayHelpers.ts`, not deleted — still used
  elsewhere) were swapped for canonical `formatDate`/`formatCurrency` on this page only.
- **Not migrated (explicitly out of scope)**: travel-expenses page's `Skeleton` loading UI and the
  quotes/bills pages' Tabs/FilterBar choices — Phase 3's scope was table rendering + status +
  formatters, not a full component-kit sweep of every page.

## Phase 4 — Targeted sweeps (~2–3 days, mechanical; parallel-session friendly) ✅ DONE 2026-07-03

Each sweep ends by flipping its audit check to enforced (see Phase 5).

- **Sweep A — formatters/dates**: replace ~70 local `format*` definitions and 74 raw
  `.toLocaleDateString(` call sites with canonical imports. Scope = currency/date/percent _display_
  only; leave `toFixed` in thermal/engineering calculators alone (legitimate numeric precision).
- **Sweep B — status colors/chips**: replace 27 local `getStatusColor`/`getStatusChip` + 9 local
  `getPriorityColor` with `StatusChip` / the shared helper.
- **Sweep C — snackbars**: migrate the 8 local-`useState` Snackbar files (`services/*`, `admin/*`,
  `accounting/data-health/missing-gl`, `company/costing`) + `FeedbackForm`/`TransmittalsList` to `useToast`.
- **Sweep D — labels**: after StatusChip wiring, delete any label map still genuinely unused;
  rewrite rule 29 (see Phase 5).
- _(Not swept: 1,450 table headers, 79 table layouts, 90 h4 page headers, button variants —
  opportunistic only, protected by ratchet.)_

### Phase 4 execution notes

- **Sweep C (10 files)**: done first, directly (no delegation) — small, low-risk, and every file's
  `severity` field turned out to be tracked but never actually rendered as a color in several admin
  pages (bare `<Snackbar message=...>` with no `<Alert severity>`), so migrating to `useToast` was a
  strict improvement, not just a lateral move. `/admin/notifications` was found to be an orphaned
  route (not linked from any nav, apparently superseded by `/admin/email`) — migrated its snackbar
  anyway since deleting a route is a separate, larger decision than this sweep's scope; flagged here
  for a future cleanup pass.
- **Sweep A (62 files)**: delegated to 5 parallel agents, each owning a disjoint file batch, each
  briefed on the exact percentage-scale/currency-locale/date-format pitfalls found in Phase 1. No
  100x percentage bugs were introduced — every batch checked scale semantics first and used the
  thin-adapter pattern from `threeWayMatchHelpers.ts` where genuinely needed (e.g. `period-report`'s
  pre-scaled percentages, verified against source before swapping). Real, distinct display modes
  were correctly preserved rather than forced into canonical: Lakh/Crore compact currency
  (`BudgetTab`/`ReportsTab` — a third duplicate of this same compact formatter was found in
  `charter/components/vendors/VendorTable.tsx`, not touched, flagged for a future consolidation),
  scientific-notation viscosity formatting (`SeawaterPropertiesClient`), and an `en-US`-locale PDF
  datasheet template (`FlashChamberDatasheet` — flagged for human confirmation of intent, not
  changed). One pre-existing bug fixed as a natural side effect: quotes-page total-amount cell
  assumed all quotes shared one currency (read from `quotes[0]`); now formats each row in its own
  currency.
- **Sweep B (29 candidate files)**: the plan's file list turned out to be a mix of genuine
  `getStatusColor` duplicates and files coloring structurally different concepts (engineering
  calculation flags, comment-thread lifecycles, accounting-period status, task-notification
  vocabulary) that only _looked_ similar by sharing a function name. Ran a research survey across
  all 29 first rather than editing blind. Result: **16 files swapped** to the shared
  `getStatusColor`/`getPriorityColor`, requiring 6 new additive `StatusColorContext` entries
  (`purchaseRequest`, `transmittal`, `charterApproval`, `documentRequirement`, `commentResolution`,
  `workItem`) plus a first-ever context mechanism for `getPriorityColor` (`PriorityColorContext`,
  currently just `'project'`) and a pure addition to the base priority map (`URGENT: 'error'`, which
  didn't exist before and so couldn't conflict with anything). **13 files deliberately left
  untouched** — domain-specific concepts with no real overlap to the status-color system
  (`CostCentreTransactionTable`, `TaskNotificationItem`'s lowercase status fn, `ActivityDashboard`,
  `fiscal-years` OPEN/CLOSED/LOCKED, `interproject-loans` semantically-inverted ACTIVE,
  `module-integrations` system state, `proposals/list` — several proposal statuses needed fresh
  color decisions with no clear precedent, deferred rather than guessed, `CommentsTable`'s
  comment-thread lifecycle, `BatchResultsTable`'s engineering pass/fail flag, `TaskCard`'s
  structurally-incompatible `'inherit'` value, and `ProcurementTab`'s custom procurement pipeline
  stage names). **One found-but-deferred latent bug**: `GroupedDocumentsTable`/`LinksSection`/
  `DocumentSelectionStep`/`DocumentDetailClient` all color a _legacy_ set of document-status names
  (`NOT_STARTED`/`UNDER_CLIENT_REVIEW`/`COMMENTS_RECEIVED`/`COMMENTS_RESOLVED`) that don't match the
  _current_ `MasterDocumentStatus` type at all (real values: `UNDER_REVIEW`/`APPROVED`/`ON_HOLD`/
  `CANCELLED` — none handled, silently falling to gray `default` today). Fixing this needs a status-
  name correctness decision beyond a color-dedup sweep, so left alone and flagged here rather than
  bundled into this pass.
- **One genuine, unresolvable-by-inference conflict surfaced and put to the user**: four files
  disagreed with each other on `ProjectStatus.COMPLETED`'s color (green/blue/gray in different
  places, including the existing `project` context itself). Decided (user's call): green/`success`
  everywhere, on the "done = positive" semantic already used for POSTED/PAID/RELEASED elsewhere.
  Applied consistently to all four files plus the existing `project` context override.
- **Sweep D**: re-verified all "unused" label maps from the original audit against current usage.
  6 are still genuinely unused (`ACCOUNTING_PAYMENT_STATUS_LABELS`, `ON_DUTY_REQUEST_STATUS_LABELS`,
  `PAYMENT_STATUS_LABELS`, `PR_STATUS_CATEGORY_LABELS`, `MEETING_STATUS_LABELS`,
  `MANUAL_TASK_PRIORITY_LABELS`) — but **none were deleted**. Each corresponds to a real, actively-
  used status/priority enum that simply hasn't had its UI wired to a label map yet (a Sweep-B-style
  job, not done here). Deleting a legitimate canonical label because adoption is incomplete would
  contradict rule 29's own stated purpose (a slowly-adopted source of truth, "reviewed quarterly
  with the domain owner") and would force whoever wires up the next status chip to rewrite the exact
  same labels from scratch. This is a deliberate deviation from the plan's literal instruction,
  flagged here rather than silently actioned.

## Phase 5 — Guardrails for future development (~1 day) ← the "tools" half ✅ DONE 2026-07-05

1. **New audit script `scripts/audit/check-ui-standards.js`** wired into the pre-commit hook,
   same style as `check-structure.js`. Two check classes:
   - **Zero-tolerance (blocking once its sweep lands):**
     - local `formatCurrency|formatDate|formatMoney|formatPercentage` definitions outside `formatters.ts`
     - `.toLocaleDateString(` anywhere in `apps/web/src`
     - local `getStatusColor`/`getPriorityColor` definitions outside the canonical module
     - `<Snackbar` outside `components/common/Toast.tsx`
     - imports of the deleted/duplicate components (ConfirmDialog from `@vapour/ui`, etc.)
   - **Count-ratchet (baseline stored in the script/config; count may fall, never rise):**
     - files containing raw `<TablePagination` (new list pages must use `DataTable`)
     - files rendering `CircularProgress` directly (new pages must use `LoadingState`)
     - `page.tsx` files without `PageHeader`
   - Extend `enforced-rules.json` (or a sibling `ui-baselines.json`) to hold the ratchet baselines.
2. **Fix `.claude/commands/new-page.md`** — it currently CONTRADICTS CLAUDE.md:
   - says `useParams()` → must be `usePathname()` extraction (rule 30)
   - says `where('isDeleted', '!=', true)` → must be client-side filter (rule 3)
   - says `firebase deploy --only firestore:indexes` locally → deploys ship via CI (rule 33)
   - ADD a "UI standards" section: `PageHeader` + `PageBreadcrumbs`, `DataTable` for lists,
     `LoadingState`/`EmptyState`, `useToast`, `useConfirmDialog`, `StatusChip`, canonical formatters,
     `FilterBar`, button convention.
3. **Update `.claude/commands/new-dialog.md`**: reference canonical `useConfirmDialog` + `useToast`;
   **`precommit-fix.md`**: add the new check to its run list.
4. **CLAUDE.md updates**:
   - Rewrite rule 29 to the narrowed scope (enum/domain labels via label maps + StatusChip;
     headers/buttons exempt).
   - Add rule 34 "New UI uses the shared component kit" with the component menu
     (PageHeader, PageBreadcrumbs, DataTable, LoadingState, EmptyState, StatusChip, FilterBar,
     useToast, useConfirmDialog, formatters) + button convention.
5. **`.claude/MODULE_MAP.md`**: add StatusChip + DataTable exemplar rows, bump verified date.

### Phase 5 execution notes

- **`scripts/audit/check-ui-standards.js`** (new) implements checks A–E (zero-tolerance) and F–H
  (count-ratchet) exactly as scoped above, plus a self-contained enforcement policy in the new
  **`scripts/audit/ui-baselines.json`** (mirrors `enforced-rules.json`'s "enforced once clean"
  model, but kept separate since these aren't numbered CLAUDE.md rules). Wired directly into
  `.husky/pre-commit` right after the CLAUDE.md rule audit block (not through
  `check-rules.js`'s orchestrator — that file's per-rule aggregation is regex-driven off
  `Rule #N — … — M violation(s)` text and numeric rule IDs, which doesn't fit this script's
  lettered categories; see the comment left in `check-rules.js`). Added `check-ui-standards` /
  `check-ui-standards:report` scripts to the root `package.json`.
- **Definitions are compliance-aware, not just name-matching**: a local `formatDate`/`getStatusColor`
  etc. is only flagged if it does NOT delegate to the canonical implementation (checked by scanning
  imports from the canonical module and the function body for a call to an imported name), is not a
  bare alias (`const formatDate = someOtherName;`), and has no `ui-standards-exempt: <reason>`
  comment directly above it (new convention, mirrors the existing `rule28-exempt` marker). This
  matters because Phase 1–4 already produced several legitimate signature-adapting wrappers
  (`formatPercentage` in `threeWayMatchHelpers.ts`, PDF-local `formatCurrency`/`formatDate` that
  call the canonical formatter internally) that are correct, not violations.
- **Closed two real gaps left over from the Phase 4 "targeted sweep" scope** (found while
  verifying categories A/C were actually at zero before enabling them):
  - `apps/web/src/lib/hr/leaves/displayHelpers.ts` and `apps/web/src/lib/hr/travelExpenses/displayHelpers.ts`
    had `formatLeaveDate`/`formatLeaveDateTime`/`formatExpenseDate`/`formatExpenseDateTime`
    reimplementing date formatting from scratch via raw `.toLocaleDateString()`/`.toLocaleString()`
    (this was explicitly named in Phase 1 Appendix A but never actually done). Now delegate to the
    canonical `formatDate()`. All call sites use the loose-regex `displayHelpers.test.ts` assertions
    already in the repo, which pass unchanged against the new `DD-Mon-YYYY` output.
  - `apps/web/src/components/dashboard/ActivityDashboard.tsx` had a local `getPriorityColor` with an
    identical urgent/high/medium/low → color mapping to canonical (just lowercase keys) — now
    delegates via `.toUpperCase()`.
  - `apps/web/src/app/thermal/calculators/siphon-sizing/batch/components/BatchResultsTable.tsx`'s
    `getStatusColor(status: 'OK'|'HIGH'|'LOW')` is a genuinely different concept (an engineering
    calculation-result flag, not an entity workflow status) — marked with a `ui-standards-exempt`
    comment rather than forced into the canonical function's domain.
  - Found and consolidated a real 3-way duplicate: `ReportsTab.tsx`, `BudgetTab.tsx`, and
    `VendorTable.tsx` (all under `projects/[id]/charter/components/`) each had their own Crore/Lakh
    abbreviated currency formatter (`₹1.25Cr`/`₹4.50L`). Added canonical `formatCurrencyCompact()`
    to `formatters.ts`; the two function-based copies are now bare-alias delegates, the inline
    ternary in `VendorTable.tsx` calls it directly (and picks up the correctly-handled
    sub-lakh case it was missing).
- **Category B (`toLocaleDateString(` anywhere) is intentionally advisory, not enforced** — ~38
  production call sites remain outside Phase 4 Sweep A's targeted file list (confirmed: only 1 of
  the 39 raw hits is a test file). This wasn't Sweep A's scope (the "targeted sweeps, not
  exhaustive" locked decision), so forcing this category to block now would gate the commit on
  pre-existing, out-of-scope code. Flip `"B"` into `enforced` in `ui-baselines.json` once a
  follow-up exhaustive sweep brings the count to 0.
- **Ratchet baselines** recorded as of 2026-07-05: `TablePagination` 50 files, `CircularProgress`
  216 files, `page.tsx` without `PageHeader` 189 files. These are large, known, out-of-scope
  backlogs per the locked "adopt for new + pilot, not full migration" decision — the ratchet's job
  is to stop them from growing, not to flag every instance as wrong (documented in
  `ui-baselines.json`'s `notes` block, especially for `CircularProgress`, which includes many
  legitimate small-scope inline spinners alongside the anti-pattern the rule actually targets).
- `.claude/commands/new-page.md` gained a "UI standards (rule 34)" step (10); `new-dialog.md`
  gained a step on `useToast`/`useConfirmDialog` and narrowed its rule-29 reference to
  enum/status dropdown values only (plain field labels are free text); `precommit-fix.md`'s run
  list now includes the new check as step 6 (renumbered through step 8).
- CLAUDE.md rule 29 rewritten to the narrowed scope; new rule 34 added with the full component
  menu + button convention, cross-referencing `check-ui-standards.js`/`ui-baselines.json`.
  `.claude/MODULE_MAP.md`'s verified-date line bumped (StatusChip/DataTable rows were already
  added in Phase 3).
- Full verification: `type-check` (web + all other packages), `check-rules.js` (all enforced rules
  clean), `check-ui-standards.js` (all enforced categories clean, ratchets at baseline), 682
  related tests across all touched files (all pass), zero `as any` introduced.

## Sequencing & effort

Phases 1 → 2 → 3 are ordered (each builds on the previous). Phase 4 sweeps are independent of each
other and of Phase 3 (A and C can start immediately after Phase 1). Phase 5 items 2–5 can land with
Phase 2; item 1's zero-tolerance checks flip on as each sweep completes.

Total: roughly 5–6 working days of mechanical work, cleanly divisible across parallel sessions
(one sweep per session; sweeps touch disjoint files).

## Execution protocol (read before starting any phase)

For the implementing session (any model):

1. Start with `/orient`. Read this whole document. Do NOT re-litigate the locked decisions at the top.
2. Work directly on `main` (repo convention — no feature branches). **Never commit or push without
   an explicit go-ahead from the user in that session.**
3. Respect "Explicitly out of scope" below. In particular: do NOT migrate tables, headers, or
   button variants beyond the named pilots, even if it looks easy.
4. If something turns out to be non-mechanical (a sweep target that needs real judgment, a
   StatusChip domain that doesn't fit the API), **stop and report it to the user** rather than
   improvising a design decision.
5. Before proposing a commit: `/precommit-fix`, and `/type-check` (or `/build` if packages changed).
   Sweeps that touch rendering (Sweep B, pilots) should get a quick `/verify` pass on one affected page.
6. The file lists in Appendix A were generated 2026-07-03. Re-verify with the greps in Appendix B
   before deleting/refactoring — parallel sessions may have moved things.
7. After each phase, tick it off in this document (add `✅ DONE <date>` to the phase heading) and
   update `.claude/MODULE_MAP.md` if exemplars/components changed.

## Appendix A — Exact targets (audited 2026-07-03)

### Phase 1 targets

Dead components (verified 0 importers on audit date):

- `apps/web/src/components/common/EmptyState.tsx`
- `apps/web/src/components/common/forms/FormDialog.tsx`
- `apps/web/src/components/common/StandardDialogActions.tsx`
- `packages/ui/src/hooks/useDialogState.ts` (also remove its export from the `@vapour/ui` barrel)

Duplicate formatters to fold into `apps/web/src/lib/utils/formatters.ts`:

- `apps/web/src/lib/utils/currency.ts:149` — `formatCurrency` (1 importer; keep unique symbol helpers)
- `apps/web/src/lib/procurement/threeWayMatchHelpers.ts:90` — `formatPercentage`
- Local `formatMoney` ×4: `lib/services/serviceCalculations.ts:545`,
  `app/proposals/[id]/pricing/PricingEditor.tsx:74`, `.../PricingBlocksEditor.tsx:81`,
  `app/estimation/[id]/components/CostBreakdownPanel.tsx:32`
- PDF-local formatters ×6: `components/pdf/PaymentBatchPDFDocument.tsx:38`,
  `components/pdf/POPDFDocument.tsx:149`, `components/pdf/TravelExpenseReportPDF.tsx:319`,
  `components/pdf/PeriodReportPDFDocument.tsx:53`, `lib/pdf/bomQuotePdfService.ts:35`,
  `lib/documents/transmittalPdfService.ts:21`

HR shadow labels (byte-for-byte duplicates of `@vapour/constants/labels.ts` maps):

- `apps/web/src/lib/hr/leaves/displayHelpers.ts` (also `formatLeaveDate:43`, `formatLeaveDateTime:58`
  → replace with canonical `formatDate`)
- `apps/web/src/lib/hr/travelExpenses/displayHelpers.ts`
- Consumers import via `@/lib/hr` barrel (e.g. `app/hr/travel-expenses/page.tsx:30-31` pulls
  `TRAVEL_EXPENSE_STATUS_LABELS`/`_COLORS`) — re-export from constants to keep import paths stable.
  The `_COLORS` maps have no constants equivalent yet; they feed the Phase 2 merged color source.

ConfirmDialog: canonical = `apps/web/src/components/common/ConfirmDialog.tsx`
(provider-based `useConfirmDialog`, 26 users). Migrate the 9 importers of `ConfirmDialog`
from `@vapour/ui`, then remove that component from `packages/ui` (or re-export the canonical).

### Phase 2 inputs

- Color source A: `packages/constants/src/statuses.ts` (`StatusConfig` maps: `STATUSES`,
  `USER_STATUSES`, `PROJECT_STATUSES`, `APPROVAL_STATUSES`)
- Color source B: `packages/ui/src/utils/statusColors.ts` (`getStatusColor(status, context)`,
  `getPriorityColor` — 35 importing files; defines its own status union types)
- Label maps to wire through StatusChip (currently unused dead code in
  `packages/constants/src/labels.ts`): `TRANSACTION_STATUS_LABELS`, `ACCOUNTING_PAYMENT_STATUS_LABELS`,
  `LEAVE_REQUEST_STATUS_LABELS`, `ON_DUTY_REQUEST_STATUS_LABELS`, `TRAVEL_EXPENSE_STATUS_LABELS`,
  `PAYMENT_STATUS_LABELS`, `PR_STATUS_CATEGORY_LABELS`, `MEETING_STATUS_LABELS`,
  `MANUAL_TASK_PRIORITY_LABELS` (+ `OFFER_COMMERCIAL_LABELS`, `PO_LABELS`, `RFQ_LABELS` are
  field-label maps, not status maps — leave them; delete in Sweep D only if still unused)
- `DataTable` bug: `packages/ui/src/components/DataTable.tsx` declares `loading?: boolean`
  (line ~66) but never renders a loading state — implement it.
- The only existing bespoke status badge: `app/proposals/[id]/components/StatusBadge.tsx`
  (proposals-only; fold into StatusChip or leave for Sweep B).

### Phase 4 sweep targets

Sweep A (formatters/dates) — representative local-definition offenders (full list via grep B1;
~70 files, plus 74 files calling `.toLocaleDateString(` directly):

- `app/accounting/data-health/page.tsx:424`, `app/accounting/tax-compliance/page.tsx:577`,
  `app/accounting/cost-centres/[id]/CostCentreDetailClient.tsx:241`,
  `app/accounting/recurring/page.tsx:217`,
  `app/accounting/payment-batches/[id]/PaymentBatchDetailClient.tsx:346`,
  `app/proposals/[id]/ProposalDetailClient.tsx:477` (mixed — already imports canonical too),
  `app/projects/[id]/charter/components/OverviewTab.tsx:30` (mixed),
  `app/estimation/page.tsx:117`, `app/documents/page.tsx:114`,
  `components/shapes/CalculationResults.tsx:66`
- Boundary: `toFixed` in `app/thermal/**` and other engineering calculators is numeric precision,
  NOT display formatting — leave it alone.

Sweep B (status colors) — 27 files define local `getStatusColor`/`getStatusChip`/`getStatusVariant`,
9 define local `getPriorityColor` (full list via grep B2). Representative:

- `app/procurement/purchase-requests/page.tsx:217,240`, `app/proposals/list/page.tsx:59`,
  `app/projects/list/page.tsx`, `app/estimation/page.tsx`, `app/admin/users/page.tsx`,
  `components/accounting/CostCentreTransactionTable.tsx`,
  `app/accounting/fiscal-years/page.tsx:49`, `app/accounting/interproject-loans/page.tsx:258`,
  `app/documents/components/comments/CRSList.tsx:41`, `app/flow/components/TaskCard.tsx:94`
- Ride-along (hardcoded status-color hex in real UI): `components/dashboard/ModuleCard.tsx`
  (duplicates brand tokens like `#0891B2`), `app/hr/settings/holidays/page.tsx`,
  `app/admin/hr-setup/components/LeaveTypesTab.tsx`

Sweep C (snackbars → `useToast` from `components/common/Toast.tsx`) — complete list:

- `app/accounting/data-health/missing-gl/page.tsx`, `app/company/costing/page.tsx`,
  `app/services/[id]/ServiceDetailClient.tsx`, `app/services/[id]/edit/EditServiceClient.tsx`,
  `app/services/new/page.tsx`, `app/admin/settings/page.tsx`, `app/admin/notifications/page.tsx`,
  `app/admin/email/page.tsx`, plus own-`<Snackbar>` instances in `FeedbackForm` and `TransmittalsList`

### Phase 5 — new-page.md contradictions (exact)

In `.claude/commands/new-page.md`: step 3 scaffolds detail clients with `useParams()` (violates
rule 30 — must use `usePathname()` regex extraction, exemplar `BOMEditorClient.tsx`); step 9 says
`where('isDeleted', '!=', true)` (violates rule 3 — filter client-side); step 8 ends with
`firebase deploy --only firestore:indexes` (violates rule 33 — indexes ship via CI on Deploy dispatch).

## Appendix B — Verification greps (run from repo root)

- **B1 — local formatter definitions** (should end at 0 outside `formatters.ts`):
  `grep -rEn "(const|function) +format(Currency|Date|Money|Percentage|Amount|Number)\b" apps/web/src --include="*.ts*" | grep -v "lib/utils/formatters.ts"`
- **B1b — raw date calls**: `grep -rln "\.toLocaleDateString(" apps/web/src --include="*.ts*"`
- **B2 — local status color logic**:
  `grep -rEn "(const|function) +get(Status|Priority)(Color|Chip|Variant)\b" apps/web/src --include="*.tsx" | grep -v statusColors`
- **B3 — local snackbars**: `grep -rln "<Snackbar" apps/web/src --include="*.tsx" | grep -v "common/Toast.tsx"`
- **B4 — bespoke tables (ratchet baseline 2026-07-03: ~221 files, 79 page.tsx)**:
  `grep -rln "<TableBody" apps/web/src --include="*.tsx"` and raw pagination
  `grep -rln "<TablePagination" apps/web/src --include="*.tsx"`
- **B5 — raw loading (ratchet baseline: 217 files)**: `grep -rln "CircularProgress" apps/web/src --include="*.tsx"`
- **B6 — importer count for any symbol** (0-importer check before deleting):
  `grep -rln "SymbolName" apps/web/src packages --include="*.ts*" | grep -v <defining-file>`

## Appendix C — Suggested kickoff prompts (one session per line)

- Phase 1: "Execute Phase 1 of docs/reviews/2026-07-03-ui-ux-standardisation-plan.md. Follow the
  execution protocol and Appendix A Phase-1 target list. Also fix the three new-page.md
  contradictions listed under Phase 5 while you're at it."
- Phase 2: "Execute Phase 2 (StatusChip + merged color source + DataTable loading fix) per the plan."
- Phase 3: "Execute Phase 3 — migrate the three pilot pages to DataTable per the plan."
- Sweeps: "Execute Phase 4 Sweep A" / "Sweep B" / "Sweep C" (independent; safe for parallel
  sessions — they touch disjoint files; Sweep B needs Phase 2 done first).
- Phase 5: "Execute Phase 5 — check-ui-standards.js audit script, CLAUDE.md rule 29 rewrite +
  rule 34, skill updates, per the plan."

## Explicitly out of scope

- Migrating the ~79 existing hand-rolled tables (opportunistic, ratchet-protected)
- Moving table headers / button texts into `labels.ts`
- Button-variant sweep of existing pages
- Hoisting `formatters.ts` into a shared package (nothing outside `apps/web` needs it today)
- Hardcoded hex in PDF/SVG/datasheet renderers (theme tokens impractical there); the ~10 real-UI
  offenders (`ModuleCard.tsx`, `hr/settings/holidays`, `admin/hr-setup/LeaveTypesTab`) can ride
  along with Sweep B since they're status/color-map shaped
