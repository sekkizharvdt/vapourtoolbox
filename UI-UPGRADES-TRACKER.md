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

### 2.1 🟠 Multi-step Transmittal dialog → MUI Stepper

[GenerateTransmittalDialog.tsx](apps/web/src/app/documents/components/transmittals/GenerateTransmittalDialog.tsx) — 4 steps, no progress indicator, no per-step validation. Migrate to `<Stepper>`, disable Next until valid, add step-complete states.

### 2.2 🟡 Section dense forms with dividers

Violates UI-STANDARDS rule 2.6. Forms with 8+ inputs need "Basic Info / Line Items / Tax" groupings.

- ☐ [CreateBillDialog.tsx](apps/web/src/app/accounting/bills/components/CreateBillDialog.tsx)
- ☐ [CreateInvoiceDialog.tsx](apps/web/src/app/accounting/invoices/components/CreateInvoiceDialog.tsx)
- ☐ [CreateJournalEntryDialog.tsx](apps/web/src/app/accounting/journal-entries/components/CreateJournalEntryDialog.tsx)
- ☐ Purchase order create/edit form
- ☐ Vendor bill create/edit form

### 2.3 🟡 Status chips must carry text labels

Violates UI-STANDARDS rule 6.3. Audit every `<Chip>` used for status — ensure `label` names the status, not just a color.

- ☐ Payment status chips (bills, invoices)
- ☐ PO status chips
- ☐ Task status chips (Flow)
- ☐ Approval status chips

### 2.4 🟡 Extract `PageBreadcrumbs` primitive

Two divergent implementations today (Data Health vs one-off procurement). Extract shared component, migrate both, then apply to deep pages per UI-STANDARDS rule 5.4.

### 2.5 🟡 Sidebar structural refactor

[Sidebar.tsx](apps/web/src/components/dashboard/Sidebar.tsx) is a 620-line single file — mixes icon map, category rendering, admin sub-nav, both drawer variants, and the collapse toggle. Hard to touch without regression risk. Structural improvements:

- ☐ **Split into sub-components** — `SidebarCategory`, `SidebarItem`, `SidebarAdminSection`, `SidebarFooter`. Keep `Sidebar.tsx` as the composition root. Makes every subsequent change cheaper.
- ☐ **Per-category collapse + persist** — click a category header to collapse/expand just that group, persisted in `localStorage`. Users with narrow module access stop scrolling past irrelevant categories.
- ☐ **Generalized badge system** — today only `feedbackCount` drives an admin badge. Let each module declare a `badgeCount` (overdue approvals, unread tasks, unreconciled statements). Currently hard-coded at [Sidebar.tsx:427-432](apps/web/src/components/dashboard/Sidebar.tsx#L427-L432).
- ☐ **Swipe-to-close on mobile drawer** — optional; complements the close button from §1.5.
- ☐ **Keyboard navigation** — arrow keys between items, Enter to activate, `aria-expanded` on the Admin collapse trigger. A11y gap.

### 2.6 🟢 Mobile table → card fallback

For lists that cannot reasonably horizontal-scroll (too many columns), render a card view at `xs`. Candidates: PO list, bill list, invoice list.

### 2.7 🟡 Dashboard — personalization & smart surfacing

[dashboard/page.tsx](apps/web/src/app/dashboard/page.tsx) + [ActivityDashboard.tsx](apps/web/src/components/dashboard/ActivityDashboard.tsx). The bones are good; these are bigger bets that change what the dashboard _means_.

- ☐ **"Available Modules" grid should show personalized activity, not duplicate the sidebar** — today cards mostly show `totalCount`, which is not actionable. Make every card display role-specific open-work counts ("3 POs awaiting your approval", "5 overdue tasks"), or compress the grid to a smaller strip since the sidebar already lists every module.
- ☐ **Role-based module priority / user pinning** — different roles care about different modules. Simplest first step: honour per-role `module.priority` overrides. Second step: `localStorage` pinning ("⭐ pin to top") persisted per user.
- ☐ **Cap + overflow for "Today's Focus"** — each group (Urgent / Tasks / Approvals / Other) currently renders every item inline. Cap at 5 per group and add a "Show N more →" link that jumps to the relevant module's filtered view.
- ☐ **Unify refresh across cards and focus list** — [ActivityDashboard.tsx:302-309](apps/web/src/components/dashboard/ActivityDashboard.tsx#L302-L309) only refreshes focus items, not the 4 summary cards. Have one refresh that pulls everything.
- ☐ **"Last updated" timestamp** — show the fetch time (e.g. "Updated 2 min ago") so users know how fresh the numbers are.
- ☐ **Keyboard navigation across dashboard cards** — arrow keys should move focus between summary cards and module cards. A11y gap.
- ☐ **Item aging in focus list** — approvals pending 3 weeks should look more urgent than approvals pending yesterday. Show relative age via chip color or a subtle "3w old" tag.

---

## Phase 3 — Module Deep Passes (after Phase 1–2)

One dedicated pass per module against the full UI-STANDARDS checklist (§10). Order by user-facing volume:

- ☐ **Procurement** — POs, PRs, RFQs, Goods Receipts, Packing Lists, Amendments, Trash
- ☐ **Accounting** — Invoices, Bills, Payments, Journal Entries, COA, Entity Ledger, Data Health
- ☐ **Flow** — Tasks, Inbox, Team Board, Meetings
- ☐ **Projects** — Charter tabs, Objectives, Procurement tab, Documents tab
- ☐ **Thermal Calculators** — MED Designer, single tube, bundle calculators
- ☐ **Proposals** — Enquiries, List, Detail
- ☐ **Documents** — Master Documents, Transmittals, Work Lists, Supply Lists

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
