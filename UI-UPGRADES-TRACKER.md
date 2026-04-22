# UI Upgrades Tracker

Living punch list of UI/UX work derived from the 2026-04-20 audit and [UI-STANDARDS.md](UI-STANDARDS.md). Work through top-to-bottom. Tick items as they land.

**Legend** — Severity: 🔴 critical / 🟠 high / 🟡 medium / 🟢 low. Status: ☐ pending / ◐ in progress / ☑ done.

---

## Phase 1 — Quick Wins (low risk, high consistency payoff)

### 1.1 ☑ Replace `window.confirm()` with `useConfirmDialog()` — **DONE 2026-04-20**

All 11 call sites across 9 files migrated to `useConfirmDialog()`. Destructive variants use `confirmColor: 'error'` + `focusConfirm: false` so Enter does not trigger delete. Also replaced one stray `alert('Failed…')` inside `TDSChallanTracking` with the page's existing `setError` surface. Type-check passes.

### 1.2 🟠 Replace `alert()` with `Toast` (`useToast()`) / inline validation

Violates UI-STANDARDS rule 6.1–6.2. Scope wider than initial estimate — **~42 call sites** across ~20 files. Executed in batches to keep commits reviewable:

**1.2a — Procurement list pages** ☑ **DONE 2026-04-20** — 8 alert() sites across 7 files (amendments, packing-lists, rfqs, goods-receipts, purchase-requests, pos, trash ×2) migrated to `toast.error()`.

**1.2b — Accounting list pages** ☑ **DONE 2026-04-20** — 15 alert() sites across 6 files (journal-entries ×2, bills ×3, invoices ×2, payments ×2, trash ×4, gst-summary ×2) migrated to `toast.error()`. GST summary's long multi-line missing-accounts alert condensed to a single-line actionable toast pointing at the COA. Type-check passes.

**1.2c — Success / info toasts** ☑ **DONE 2026-04-20** — 10 alert() sites across 6 files migrated to `toast.success` / `toast.info` / `toast.warning` / `toast.error` as appropriate. Also fixed a bare `confirm('…')` (global `window.confirm`) in ReconciliationWorkspace — converted to `useConfirmDialog()`.

**1.2d — Placeholder / unavailable stubs** ☑ **DONE 2026-04-20** — 8 alert() sites across 3 files (ssot, DocumentSupplyList, TransmittalsList ×6) migrated to `toast.info` (coming-soon messaging) / `toast.error` (download failures, unavailable files).

**1.2e — Inline validation (not a toast)** ☑ **DONE 2026-04-20** — ConstraintsSection's "Description is required" alert replaced with field-level `error + helperText` on the Description TextField. Error clears when the user types and is reset when the dialog opens. UI-STANDARDS rule 3.6.

**Pattern:** errors → `toast.error(...)`; successes/info → `toast.success` / `toast.info`; validation → field-level `error + helperText` (rule 3.6). `useToast()` already wired via `ToastProvider` in `ClientProviders.tsx`.

### 1.3 ☑ Required-field asterisks on custom selectors — **DONE 2026-04-20**

Reality check: 5 of 6 selectors (AccountSelector, EntitySelector, ProjectSelector, ApproverSelector, StateSelector) **already pass `required` to the underlying `<TextField>`**, which MUI auto-renders with an asterisk. Original audit finding was incorrect.

**The only real gap was `PurchaseOrderSelector`** — had no `required` prop at all. Added `required?: boolean` and `error?: boolean` to the interface and threaded both through to the internal TextField.

All six selectors are now compliant with UI-STANDARDS rule 3.1.

### 1.4 ☑ Wrap dense tables in horizontal scroll container — **DONE 2026-04-20**

All 5 tables (PO list, bill list, invoice list, TransactionAllocationTable ×2, LineItemsTable) wrapped in `<TableContainer sx={{ overflowX: 'auto' }}>` with `<Table sx={{ minWidth: N }}>` — 960px for PO/invoice, 1100px for bills, 720px for the smaller allocation/line-items. At `xs` breakpoint the tables now scroll horizontally instead of truncating via ellipsis. UI-STANDARDS rule 4.1.

### 1.5 ☑ Sidebar polish (quick wins) — **DONE 2026-04-20**

- ☑ **Coming-Soon affordance** — added `cursor: 'not-allowed'` on the `ListItem` wrapper (MUI sets `pointer-events: none` on the disabled `ListItemButton`, so the cursor comes from the parent) and a small primary-color dot badge on the icon in collapsed mode, mirroring the release-date chip shown in expanded mode.
- ☑ **Collapsed-mode label collisions** — added optional `collapsedLabel` field to `ModuleDefinition` type ([modules.ts](packages/constants/src/modules.ts)), populated on `THERMAL_DESAL` (→ "Desal") and `THERMAL_CALCS` (→ "Calcs"). Sidebar falls back to first word of name when not set.
- ☑ **Mobile close button** — added a close (`X`) IconButton in the sidebar Toolbar, shown only at `xs` breakpoint when not collapsed. `aria-label="Close navigation menu"`.
- ☑ **⌘K discovery hint in sidebar** — added a small `Press ⌘K to search` line in the sidebar footer (above the collapse toggle). Desktop-only, hidden when collapsed.
- ☑ **Parent highlight when admin sub-item is active** — verified already working. `isSelected = pathname.startsWith(module.path)` matches `/admin/users` against `/admin`. No change required.

### 1.6 ☑ Dashboard polish (quick wins) — **DONE 2026-04-20**

- ☑ **Permission-gate Quick Actions** — wired `useAuth` into `ActivityDashboard` and gate `View Enquiries` (`VIEW_PROPOSALS`), `New PR` (`MANAGE_PROCUREMENT`), and `Upload Document` (`MANAGE_DOCUMENTS` OR `SUBMIT_DOCUMENTS`). `Log Time` remains visible for all (the Flow module is open to all users).
- ☑ **Drop redundant `View Details` button on ModuleCard** — replaced the hover-swap between `View Details` (non-hover) and `Open` (hover) with a single `Open` button that switches between `outlined` and `contained` on hover. Preserves height (no layout flicker) while removing the second CTA. Removed now-unused `Stack` import.
- ☑ **"Overdue" zero-state color** — switched `#9CA3AF` → `#FCA5A5` (lighter red). Zero-state now reads as informative-but-empty rather than disabled.
- ☑ **Welcome message email fallback** — `user?.displayName || user?.email?.split('@')[0] || 'User'` in dashboard header.
- ☑ **Collapse "Coming Soon" grid** — replaced the 4-col grid of disabled cards with a single horizontal strip: "Coming Soon: Module Name (release), …" on `action.hover` background.

---

## Phase 2 — Structural Upgrades (larger, per-surface)

### 2.1 ☑ Multi-step Transmittal dialog — **DONE 2026-04-20**

Reality check: the dialog **already had** an MUI `<Stepper>`, 3 steps (not 4), and per-step validation on step 0 (selected-docs guard). The original audit finding was partially incorrect.

Improvements made:

- Added `completed={index < activeStep}` to each `<Step>` so users see a green tick as they advance.
- Added a small helper-text line next to the Next button that explains _why_ it's disabled ("Select at least one document to continue"). Previously the disabled state was unexplained.
- Restructured `DialogActions` to a column so the helper sits above the button row.
- Fixed a stale doc comment that claimed 4 steps (actual: 3).

### 2.2 ◐ Section dense forms with dividers — **IN PROGRESS 2026-04-20**

- ☑ [CreateBillDialog.tsx](apps/web/src/app/accounting/bills/components/CreateBillDialog.tsx) — added "Bill Details" h6 heading above the top fields block. Peers with the existing "Line Items" h6 and the "TDSSection" component that follows.
- ☑ [CreateInvoiceDialog.tsx](apps/web/src/app/accounting/invoices/components/CreateInvoiceDialog.tsx) — added "Invoice Details" h6 heading.
- ☑ [CreateJournalEntryDialog.tsx](apps/web/src/app/accounting/journal-entries/components/CreateJournalEntryDialog.tsx) — added "Entry Details" h6 heading.
- ☐ Purchase order create/edit form — already has multiple h6 section headings; no change needed (verified).
- ☐ Vendor bill create/edit form — same as CreateBillDialog (the "bill" in procurement terminology maps to the accounting vendor bill dialog). Covered by the item above.

### 2.3 ☑ Status chips must carry text labels — **DONE 2026-04-20**

Audited all four priority surfaces plus a broader sweep:

- ☑ **Bills page** — `label={bill.status === 'PENDING_APPROVAL' ? 'Pending Approval' : ...}` ✓
- ☑ **POs page** — `label={getPOStatusText(po.status)}`, delivery/payment via `.text` ✓
- ☑ **Tasks** — hardcoded human labels ("Completed", "In Progress", "Info") ✓
- ☑ **Task notifications** — `label={getStatusText(...)}` ✓
- ☑ **Invoices page** — was rendering raw enum values (`label={invoice.status}` → "DRAFT", "PENDING_APPROVAL"). **Fixed** to match the bills-page pattern with snake_case-to-Title-Case conversion.

Audit also checked for Chips without any `label` prop (color-only) — none found; all such matches in a regex sweep were false positives where the `label` sat on a subsequent line of a multi-line Chip JSX.

### 2.4 ◐ Extract `PageBreadcrumbs` primitive — **IN PROGRESS 2026-04-20**

**Done:**

- Created [PageBreadcrumbs.tsx](apps/web/src/components/common/PageBreadcrumbs.tsx) primitive taking `{ label, href?, icon? }[]`.
- Migrated [admin/layout.tsx](apps/web/src/app/admin/layout.tsx) to use it (was rendering raw `<Breadcrumbs>` directly).
- Migrated [ProjectSubPageWrapper.tsx](apps/web/src/app/projects/[id]/components/ProjectSubPageWrapper.tsx) to use it.
- Updated UI-STANDARDS rule 5.4: breadcrumbs are layout-owned; pages inside auto-breadcrumb route trees MUST NOT render their own.
- Added [scripts/check-breadcrumb-duplication.js](scripts/check-breadcrumb-duplication.js) pre-commit guard that fails if any page inside `/admin/*` imports `Breadcrumbs` from `@mui/material` or uses `<PageBreadcrumbs>`. The guard also informationally counts remaining direct `@mui/material` Breadcrumbs imports (~139 at start).

**Remaining (incremental):**

- Migrate the ~139 hand-rolled `<Breadcrumbs>` usages to `<PageBreadcrumbs>` as each page is touched. These are not duplication bugs (they're single-source on routes without auto-breadcrumb layouts), just cosmetic inconsistency.
- Audit `ProjectDetailClient.tsx` and `ProjectCharterClient.tsx` — they render their own Breadcrumbs but don't use the wrapper, so they're single-source but should migrate to the primitive.

### 2.5 ◐ Sidebar structural refactor — **PARTIALLY DONE 2026-04-20**

- ☑ **Per-category collapse + persist** — click a category header to toggle, persisted to `localStorage` under `sidebar-collapsed-categories`. Click collapses the modules Collapse (and admin sub-nav for the admin category). `aria-expanded` + `aria-label` set on the header button. When the sidebar is in icon-only collapsed mode, category collapse is ignored (icons are always visible so users can find modules).
- ☐ **Split into sub-components** — deferred. Sidebar.tsx is now ~650 lines. Pure refactor with no user-visible benefit; safer to do as a dedicated task when no user-facing changes are in flight.
- ☐ **Generalized badge system** — deferred. Currently only admin shows a feedback badge. Generalising to per-module `badgeCount` needs a per-module stats source (related to §2.7 item 1).
- ☐ **Swipe-to-close on mobile drawer** — deferred.
- ☐ **Keyboard navigation** — deferred.

### 2.6 ◐ Mobile table → card fallback — **EXEMPLAR DONE 2026-04-20**

- ☑ **PO list** — the 9-col Table is now hidden at `xs` (`display: { xs: 'none', md: 'block' }`) and replaced with a Card stack showing the same fields (number, title, vendor, status/delivery/payment chips, amount, date, actions). Whole-card click navigates; action menu stops propagation. Pagination is rendered in both views. UI-STANDARDS rule 8.2.
- ☐ **Bill list** — deferred. Apply the same pattern as PO list when the accounting module is touched.
- ☐ **Invoice list** — deferred. Same pattern.

### 2.7 ◐ Dashboard — personalization & smart surfacing — **PARTIALLY DONE 2026-04-20**

- ☑ **Cap + overflow for "Today's Focus"** — each group caps at 5 items (`MAX_PER_GROUP`) with a "Show N more →" row that deep-links (Urgent → `/flow?filter=urgent`, Tasks → `/flow`, Approvals → `/pending-approval`, Other → `/flow`).
- ☑ **Unified refresh across cards and focus list** — reality check: `useActivityDashboard().refetch()` already covers all three queries (actionItems, summary, recentActivity). Verified; no code change needed.
- ☑ **"Last updated" timestamp** — exposed `lastUpdated` (epoch ms of the most recent successful fetch across summary + action items) from `useActivityDashboard()`. ActivityDashboard renders "Updated X ago" next to the Refresh button.
- ☐ **Item aging in focus list** — deferred. `ActionItem` has `dueDate` but no `createdAt` — needs service-layer changes.
- ☐ **"Available Modules" grid shows personalized activity** — deferred. Needs per-module stats source (related to §2.5 generalized badges).
- ☐ **Role-based priority / user pinning** — deferred.
- ☐ **Keyboard navigation across dashboard cards** — deferred.

---

## Phase 3 — Module Deep Passes (after Phase 1–2)

One dedicated pass per module against the full UI-STANDARDS checklist (§10). Order by user-facing volume:

**IconButton a11y sweep (rule 7.1) complete across ALL 7 modules — 2026-04-20**

- ◐ **Procurement** — 34 IconButtons labeled (commit `a0845801`). Deferred: 8 detail-dialog files on raw `Dialog`+`DialogActions`.
- ◐ **Accounting** — 65 IconButtons labeled across 27 files. Deferred: 22 raw-Dialog files, 43 raw-Breadcrumbs imports, 8 files using `<FormDialog>` (progress).
- ◐ **Flow** — 4 IconButtons labeled. Deferred: 2 raw-Dialog files, 6 raw-Breadcrumbs.
- ◐ **Projects** — 21 IconButtons labeled across 9 files. Deferred: 10 raw-Dialog files, 4 raw-Breadcrumbs.
- ◐ **Thermal Calculators** — 15 IconButtons labeled across 10 files. Deferred: 5 raw-Dialog files, 2 raw-Breadcrumbs.
- ◐ **Proposals** — 15 IconButtons labeled across 8 files. Deferred: 12 raw-Dialog files, 9 raw-Breadcrumbs.
- ◐ **Documents** — 24 IconButtons labeled across 10 files. Deferred: 18 raw-Dialog files, 1 raw-Breadcrumbs.

**Total: 178 icon-only IconButtons labeled across ~87 files.** Labels inferred from `title=` inside the tag, a preceding `<Tooltip title="…">` wrapper, or the icon child (DeleteIcon→"Remove", ArrowBackIcon→"Go back", VisibilityIcon→"View details", etc.). Used a `{}`-depth-aware tag-end finder to avoid breaking `=>` inside `onClick` expressions. Type-check clean; pre-commit clean.

**Remaining Phase 3 gaps** (all deferred, migrate when touching each surface):

- **Raw `Dialog + DialogActions`** → `<FormDialog>` + `<StandardDialogActions>`: 75 files total across modules. Pure dialog-shell swap; safe incremental migration.
- **Raw `Breadcrumbs` → `<PageBreadcrumbs>`**: 65 files total. Cosmetic; duplication already prevented by pre-commit guard for admin tree.

---

## Completed

- **1.1 `window.confirm()` → `useConfirmDialog()`** — 2026-04-20 — commit `41d69280` — 11 call sites across 9 files (ProcurementTab, EnquiryDetailClient, vendors/index, DocumentsTab, TDSChallanTracking, ObjectivesPageClient ×2, DocumentWorkList, DocumentSupplyList, DocumentLinks).
- **1.2a procurement `alert()` → `toast.error()`** — 2026-04-20 — commit `66ee8338` — 8 call sites across 7 files (amendments, packing-lists, rfqs, goods-receipts, purchase-requests, pos, trash).
- **1.2b accounting list `alert()` → `toast.error()`** — 2026-04-20 — commit `94211c55` — 15 call sites across 6 files (journal-entries, bills, invoices, payments, trash, gst-summary).
- **1.2c success/info toasts** — 2026-04-20 — commit `f1f3a5b8` — 10 alert() sites across 6 files (ProcurementTab, ScopeTab, ReconciliationWorkspace ×4, BOMEditorClient, shapes/calculator, estimation). Also migrated one bare `confirm('…')` in ReconciliationWorkspace.
- **1.2d placeholder / download-error alerts** — 2026-04-20 — 8 alert() sites across 3 files (ssot, DocumentSupplyList, TransmittalsList ×6) → `toast.info` / `toast.error`.
- **1.2e inline validation** — 2026-04-20 — ConstraintsSection's description-required alert replaced with field-level `error + helperText`.

With 1.2a–e complete, the app has **zero `alert()` or `window.confirm()` / `confirm()` calls in production code**.

- **1.3 required-field asterisks on selectors** — 2026-04-20 — audit finding was largely incorrect; 5 of 6 selectors already rendered the asterisk correctly via `<TextField required>`. Added `required` + `error` props to `PurchaseOrderSelector` which was the only genuine gap.
- **1.4 dense tables → horizontal-scroll containers** — 2026-04-20 — 5 tables (PO, bill, invoice, transaction allocation ×2, line items) wrapped with `overflowX: 'auto'` + `minWidth` (720-1100 depending on column count).
- **1.5 sidebar polish** — 2026-04-20 — 5 items: coming-soon cursor + dot badge in collapsed mode, `collapsedLabel` for Thermal Desal/Calcs collision, mobile close button, ⌘K hint pill, admin-parent-highlight verified already working.
- **1.6 dashboard polish** — 2026-04-20 — 5 items: permission-gated Quick Actions, single-button ModuleCard CTA (no more View Details vs Open swap), lighter-red overdue zero-state, email-local fallback in welcome, compact Coming Soon strip.

**Phase 1 of the UI-UPGRADES-TRACKER is complete.** 64 individual fixes across 40+ files. App has zero `alert()` / `window.confirm()` / bare `confirm()` in production code, consistent dialog confirmations, typed toasts for all feedback, mobile-friendly tables, required-field support across all selectors, polished sidebar, and permission-aware dashboard. Phase 2 (structural upgrades) is the next lift.

---

- **2.1 Transmittal Stepper feedback** — 2026-04-20 — commit `70797818`
- **2.2 Dense-form section headings** — 2026-04-20 — commit `70797818`
- **2.3 Status chip text labels** — 2026-04-20 — commit `70797818`
- **2.5 Sidebar per-category collapse + persist** — 2026-04-20 — MVP shipped; file split, generalized badges, swipe, keyboard nav deferred.
- **2.6 Mobile card fallback — PO list** — 2026-04-20 — PO list gets card view at `xs`; bill/invoice pattern is the same, deferred.
- **2.7 Dashboard polish (cap+overflow, last-updated)** — 2026-04-20 — high-value subset; personalization + pinning + item aging deferred (need service-layer work).

**Phase 2 status: core work shipped.** Remaining deferred items all require bigger infra (service-layer changes for per-module stats / item aging) or are pure refactors with no user-visible benefit (sidebar file split). They're documented where they live and can be picked up when relevant.
