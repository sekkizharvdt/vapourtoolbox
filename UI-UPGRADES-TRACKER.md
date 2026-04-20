# UI Upgrades Tracker

Living punch list of UI/UX work derived from the 2026-04-20 audit and [UI-STANDARDS.md](UI-STANDARDS.md). Work through top-to-bottom. Tick items as they land.

**Legend** — Severity: 🔴 critical / 🟠 high / 🟡 medium / 🟢 low. Status: ☐ pending / ◐ in progress / ☑ done.

---

## Phase 1 — Quick Wins (low risk, high consistency payoff)

### 1.1 ☑ Replace `window.confirm()` with `useConfirmDialog()` — **DONE 2026-04-20**

All 11 call sites across 9 files migrated to `useConfirmDialog()`. Destructive variants use `confirmColor: 'error'` + `focusConfirm: false` so Enter does not trigger delete. Also replaced one stray `alert('Failed…')` inside `TDSChallanTracking` with the page's existing `setError` surface. Type-check passes.

### 1.2 🟠 Replace `alert()` with `Toast` / `<Alert>`

Violates UI-STANDARDS rule 6.1–6.2. 12 call sites across 10 files:

- ☐ [procurement/amendments/page.tsx:130](apps/web/src/app/procurement/amendments/page.tsx#L130)
- ☐ [procurement/packing-lists/page.tsx:130](apps/web/src/app/procurement/packing-lists/page.tsx#L130)
- ☐ [procurement/rfqs/page.tsx:135](apps/web/src/app/procurement/rfqs/page.tsx#L135)
- ☐ [procurement/goods-receipts/page.tsx:142](apps/web/src/app/procurement/goods-receipts/page.tsx#L142)
- ☐ [procurement/purchase-requests/page.tsx:171](apps/web/src/app/procurement/purchase-requests/page.tsx#L171)
- ☐ [procurement/trash/page.tsx:190,194](apps/web/src/app/procurement/trash/page.tsx#L190)
- ☐ [procurement/pos/page.tsx:135](apps/web/src/app/procurement/pos/page.tsx#L135)
- ☐ [ProcurementTab.tsx:251](apps/web/src/app/projects/[id]/charter/components/ProcurementTab.tsx#L251) — success toast, not alert
- ☐ [ConstraintsSection.tsx:91](apps/web/src/app/projects/[id]/charter/components/scope/ConstraintsSection.tsx#L91) — validation → field-level error
- ☐ [ScopeTab.tsx:78,105](apps/web/src/app/projects/[id]/charter/components/ScopeTab.tsx#L78) — success → Toast

**Pattern:** Errors → `<Alert severity="error">` on the page; successes → `Toast`; validation messages → `TextField error + helperText`.

### 1.3 🟠 Required-field asterisks on custom selectors

Violates UI-STANDARDS rule 3.1. The selectors in [components/common/forms/](apps/web/src/components/common/forms/) accept `required?: boolean` but do not render the asterisk.

- ☐ `AccountSelector` — render `*` in label when `required`
- ☐ `EntitySelector` — same
- ☐ `ProjectSelector` — same
- ☐ `ApproverSelector` — same
- ☐ `PurchaseOrderSelector` — same
- ☐ `StateSelector` — same

Fix at the selector level (one-shot), not at every call site.

### 1.4 🟡 Wrap dense tables in horizontal scroll container

Violates UI-STANDARDS rule 4.1. Ellipsis-only cells break on mobile.

- ☐ PO list table ([procurement/pos/page.tsx](apps/web/src/app/procurement/pos/page.tsx))
- ☐ Bill list table ([accounting/bills/page.tsx](apps/web/src/app/accounting/bills/page.tsx))
- ☐ Invoice list table ([accounting/invoices/page.tsx](apps/web/src/app/accounting/invoices/page.tsx))
- ☐ Transaction allocation table ([components/accounting/TransactionAllocationTable.tsx](apps/web/src/components/accounting/TransactionAllocationTable.tsx))
- ☐ Line items table ([components/accounting/shared/LineItemsTable.tsx](apps/web/src/components/accounting/shared/LineItemsTable.tsx))

Wrap in `<TableContainer sx={{ overflowX: 'auto' }}>` with `<Table sx={{ minWidth: 720 }}>`.

### 1.5 🟢 Disable "Coming Soon" sidebar items

Violates UI-STANDARDS rule 5.3. [Sidebar.tsx](apps/web/src/components/dashboard/Sidebar.tsx) currently just dims disabled items.

- ☐ Apply `pointerEvents: 'none'`, `cursor: 'not-allowed'`, move release date into tooltip

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

### 2.5 🟢 Sidebar close affordance on mobile

[Sidebar.tsx](apps/web/src/components/dashboard/Sidebar.tsx) — add a visible close button on `xs`; optionally swipe-to-close.

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

- **1.1 `window.confirm()` → `useConfirmDialog()`** — 2026-04-20 — 11 call sites across 9 files (ProcurementTab, EnquiryDetailClient, vendors/index, DocumentsTab, TDSChallanTracking, ObjectivesPageClient ×2, DocumentWorkList, DocumentSupplyList, DocumentLinks).
