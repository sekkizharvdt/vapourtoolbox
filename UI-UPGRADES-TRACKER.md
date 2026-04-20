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

### 1.4 🟡 Wrap dense tables in horizontal scroll container

Violates UI-STANDARDS rule 4.1. Ellipsis-only cells break on mobile.

- ☐ PO list table ([procurement/pos/page.tsx](apps/web/src/app/procurement/pos/page.tsx))
- ☐ Bill list table ([accounting/bills/page.tsx](apps/web/src/app/accounting/bills/page.tsx))
- ☐ Invoice list table ([accounting/invoices/page.tsx](apps/web/src/app/accounting/invoices/page.tsx))
- ☐ Transaction allocation table ([components/accounting/TransactionAllocationTable.tsx](apps/web/src/components/accounting/TransactionAllocationTable.tsx))
- ☐ Line items table ([components/accounting/shared/LineItemsTable.tsx](apps/web/src/components/accounting/shared/LineItemsTable.tsx))

Wrap in `<TableContainer sx={{ overflowX: 'auto' }}>` with `<Table sx={{ minWidth: 720 }}>`.

### 1.5 🟡 Sidebar polish (quick wins)

Grouped sidebar improvements. [Sidebar.tsx](apps/web/src/components/dashboard/Sidebar.tsx) is 620 lines — these are all surface-level fixes that don't require splitting the file. Structural work lives in §2.5.

- ☐ **Coming-Soon affordance** — MUI `disabled` already blocks clicks, but visual is only reduced opacity. Add `cursor: 'not-allowed'` and a small "Soon" dot/chip in collapsed mode (currently only expanded mode shows the release-date chip). UI-STANDARDS rule 5.3.
- ☐ **Collapsed-mode label collisions** — [Sidebar.tsx:453](apps/web/src/components/dashboard/Sidebar.tsx#L453) uses `module.name.split(' ')[0]`, so "Thermal Calcs" and "Thermal Desal" both render as "Thermal". Fix: add a `shortLabel` field on each module (e.g. "Calcs" / "Desal") and fall back to first-word.
- ☐ **Mobile close button** — mobile drawer ([Sidebar.tsx:575](apps/web/src/components/dashboard/Sidebar.tsx#L575)) only closes via backdrop tap. Add a visible close (`X`) icon in the drawer header on `xs`. UI-STANDARDS rule 8.3.
- ☐ **⌘K discovery hint** — [CommandPalette.tsx](apps/web/src/components/common/CommandPalette.tsx) exists but isn't advertised. Add a small "⌘K" or "Ctrl K" hint pill in the sidebar header/footer so users discover the faster nav. For 15+ top-level items, this is the highest-impact change.
- ☐ **Parent highlight when admin sub-item is active** — selecting an admin sub-item should keep the Admin parent visually selected; currently only the sub-item highlights.

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
