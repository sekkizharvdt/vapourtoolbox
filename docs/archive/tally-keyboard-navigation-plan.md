# Tally-Style Keyboard Navigation — Implementation Plan

## Problem

Accounting users (coming from Tally/MS-DOS-style software) report needing ~15 mouse clicks per workflow. Tally uses **Enter to advance between fields** and **Enter to submit** — our forms currently have zero keyboard navigation support. Tab/Shift+Tab works but is unfamiliar to Tally users.

## Solution

A `useTallyKeyboard` hook that gives any form Enter-key-based navigation:

- **Enter** on a field → focus next field
- **Enter** on last field → submit the form
- **autoFocus** on first field when dialog opens
- **Escape** → close dialog (MUI already handles this)
- **Multiline fields** (description/notes) → skip from Enter chain (use Tab to leave)
- **Autocomplete/Selectors** → Enter selects dropdown option first, advances only after selection

## Implementation Phases

### Phase 0: Core Hook & Infrastructure

| Item                       | File                                                         | Notes                                                          |
| -------------------------- | ------------------------------------------------------------ | -------------------------------------------------------------- |
| `useTallyKeyboard` hook    | `apps/web/src/hooks/useTallyKeyboard.ts`                     | Manages field refs array, Enter keydown routing, focus logic   |
| Update `FormDialog`        | `apps/web/src/components/common/forms/FormDialog.tsx`        | Accept optional `onKeyDown` prop for form-level Enter handling |
| Update `FormDialogActions` | `apps/web/src/components/common/forms/FormDialogActions.tsx` | No change needed (submit handler already passed as prop)       |

**Hook API sketch:**

```typescript
const { fieldProps, registerField } = useTallyKeyboard({
  onSubmit: handleSave,
  fieldCount: 8,
  skipIndices: [5], // e.g. skip multiline description
});

// Usage on each field:
<TextField {...fieldProps(0)} />
<EntitySelector inputRef={registerField(1)} onKeyDown={fieldProps(1).onKeyDown} />
<TextField {...fieldProps(2)} />
```

**Selector integration** — EntitySelector, AccountSelector, ProjectSelector need:

- Accept `inputRef` prop to expose the inner `<input>` element
- Accept `onKeyDown` prop (or forward it to the Autocomplete)
- On option select (`onChange`), auto-advance to next field

---

### Phase 1: Simple Dialogs (1–3 fields) — Quick Wins

Low risk, fast to ship. Good for validating the hook works.

| #   | Dialog                  | File                                                                   | Fields                   | Priority |
| --- | ----------------------- | ---------------------------------------------------------------------- | ------------------------ | -------- |
| 1   | MatchConfirmationDialog | `app/accounting/reconciliation/components/MatchConfirmationDialog.tsx` | Notes (1)                | Low      |
| 2   | WriteOffAssetDialog     | `app/accounting/fixed-assets/components/WriteOffAssetDialog.tsx`       | Reason (1)               | Low      |
| 3   | DisposeAssetDialog      | `app/accounting/fixed-assets/components/DisposeAssetDialog.tsx`        | Date, Amount, Reason (3) | Low      |

**Status:** [x] Complete (DisposeAssetDialog wired)

---

### Phase 2: Approval & Workflow Dialogs (2–3 fields) — High Frequency

These are hit on every transaction workflow — small field count but used constantly.

| #   | Dialog                   | File                                                 | Fields                        | Priority |
| --- | ------------------------ | ---------------------------------------------------- | ----------------------------- | -------- |
| 4   | ApproveTransactionDialog | `components/accounting/ApproveTransactionDialog.tsx` | Comments + Approve/Reject (2) | **High** |
| 5   | SubmitForApprovalDialog  | `components/accounting/SubmitForApprovalDialog.tsx`  | Approver, Comments (2–3)      | **High** |

**Status:** [x] Complete (ApproveTransactionDialog, SubmitForApprovalDialog wired)

---

### Phase 3: Medium Dialogs (4–8 fields) — Moderate Effort

| #   | Dialog                       | File                                                                  | Fields                                                                     | Priority |
| --- | ---------------------------- | --------------------------------------------------------------------- | -------------------------------------------------------------------------- | -------- |
| 6   | AddReceiptDialog             | `app/accounting/payment-batches/components/AddReceiptDialog.tsx`      | Source, Description, Amount, Currency, Date, Project, Entity (7)           | Medium   |
| 7   | CostCentreDialog             | `app/accounting/cost-centres/components/CostCentreDialog.tsx`         | Code, Name, Description, Category, Project, Budget, Currency, Active (8)   | Low      |
| 8   | ManualCashFlowDialog         | `app/accounting/payment-planning/components/ManualCashFlowDialog.tsx` | Name, Desc, Category, Amount, Date, Recurring, Entity, Project, Notes (11) | Medium   |
| 9   | VoidAndRecreateInvoiceDialog | `app/accounting/invoices/components/VoidAndRecreateInvoiceDialog.tsx` | Reason, Switch, Entity (4–5)                                               | Medium   |
| 10  | VoidAndRecreateBillDialog    | `app/accounting/bills/components/VoidAndRecreateBillDialog.tsx`       | Reason, Switch, Entity (4–5)                                               | Medium   |

**Status:** [x] Complete (AddReceiptDialog, CostCentreDialog, ManualCashFlowDialog wired; VoidAndRecreate dialogs skipped — low priority)

---

### Phase 4: Direct Payment/Receipt Dialogs (~10 fields) — High Value

These are the most common day-to-day accounting entries. Users hit these forms multiple times daily.

| #   | Dialog                    | File                                                               | Fields                                                                             | Priority |
| --- | ------------------------- | ------------------------------------------------------------------ | ---------------------------------------------------------------------------------- | -------- |
| 11  | RecordDirectPaymentDialog | `app/accounting/payments/components/RecordDirectPaymentDialog.tsx` | Date, Expense Acct, Bank Acct, Amount, Method, Cheque/UPI, Desc, Ref, Project (10) | **High** |
| 12  | RecordDirectReceiptDialog | `app/accounting/payments/components/RecordDirectReceiptDialog.tsx` | Date, Revenue Acct, Bank Acct, Amount, Method, Cheque/UPI, Desc, Ref, Project (10) | **High** |

**Conditional fields:** Cheque Number shows only for CHEQUE method, UPI ID only for UPI. Hook must handle dynamic field registration.

**Status:** [x] Complete (RecordDirectPaymentDialog, RecordDirectReceiptDialog wired)

---

### Phase 5: Complex Transaction Dialogs (15+ fields) — Core Workflows

High field count + shared `TransactionFormFields` component. Wire up TransactionFormFields once and both invoice/bill benefit.

| #   | Dialog              | File                                                         | Fields                                                                                                     | Uses TransactionFormFields | Priority |
| --- | ------------------- | ------------------------------------------------------------ | ---------------------------------------------------------------------------------------------------------- | -------------------------- | -------- |
| 13  | CreateInvoiceDialog | `app/accounting/invoices/components/CreateInvoiceDialog.tsx` | Invoice#, Date, DueDate, Entity, Status, Desc, Ref, Project, Currency, ExRate, LineItems (15+)             | Yes                        | **High** |
| 14  | CreateBillDialog    | `app/accounting/bills/components/CreateBillDialog.tsx`       | Bill#, Date, DueDate, Entity, Status, Desc, Ref, Project, LineItems, TDS section (18+)                     | Yes                        | **High** |
| 15  | CreateAccountDialog | `components/accounting/CreateAccountDialog.tsx`              | Code, Name, Desc, Type, Category, IsGroup, OpeningBal, Currency, GST fields, TDS fields, Bank fields (17+) | No                         | Medium   |

**Challenge:** LineItemsTable needs its own Enter navigation within rows (Enter across columns, Enter on last column → add new row, Tab out of table → next form field).

**Status:** [x] Complete (CreateInvoiceDialog, CreateBillDialog, CreateAccountDialog wired; TransactionFormFields accepts tallyFieldProps)

---

### Phase 6: Very Complex Dialogs (dynamic tables, allocations) — Highest Effort

These have dynamic allocation/line-item tables that need special Enter-key behavior.

| #   | Dialog                      | File                                                                     | Fields                                                                                                                  | Table Type             | Priority |
| --- | --------------------------- | ------------------------------------------------------------------------ | ----------------------------------------------------------------------------------------------------------------------- | ---------------------- | -------- |
| 16  | RecordVendorPaymentDialog   | `app/accounting/payments/components/RecordVendorPaymentDialog.tsx`       | Date, Entity, Amount, Method, Cheque/UPI, Bank, Desc, Ref, Project, Advance, TDS, BillAllocations (18+)                 | BillAllocationTable    | **High** |
| 17  | RecordCustomerPaymentDialog | `app/accounting/payments/components/RecordCustomerPaymentDialog.tsx`     | Date, Entity, Amount, Currency, ExRate, Method, Cheque/UPI, Bank, Desc, Ref, Project, Advance, InvoiceAllocations (17+) | InvoiceAllocationTable | **High** |
| 18  | CreateJournalEntryDialog    | `app/accounting/journal-entries/components/CreateJournalEntryDialog.tsx` | Date, Desc, Ref, Project, Status, LinkedInvoice, LinkedBill, LedgerEntries (15+)                                        | LedgerEntryForm        | **High** |
| 19  | AddPaymentDialog (batch)    | `app/accounting/payment-batches/components/AddPaymentDialog.tsx`         | Tabbed: Bills tab (checkbox list), Manual tab (Payee, Entity, Amount, TDS, Category, Notes, Project) (12+)              | Tabbed interface       | Medium   |

**Table navigation strategy:**

- Within allocation/ledger tables: Enter moves across columns, then to next row
- On last row's last column: Enter adds a new row
- Ctrl+Enter or Tab out of table: move to next form field after the table

**Status:** [x] Complete (RecordVendorPaymentDialog, RecordCustomerPaymentDialog, CreateJournalEntryDialog header fields, AddPaymentDialog manual tab wired; allocation tables and ledger entry rows not wired — would need separate Enter navigation)

---

### Phase 7: Multi-Step Wizard

| #   | Dialog                    | File                                                                     | Steps                                           | Priority |
| --- | ------------------------- | ------------------------------------------------------------------------ | ----------------------------------------------- | -------- |
| 20  | ImportBankStatementDialog | `app/accounting/reconciliation/components/ImportBankStatementDialog.tsx` | 4-step wizard (Upload → Map → Preview → Import) | Low      |

**Special:** Enter navigation within each step, Enter on last field of step → advance to next step.

**Status:** [ ] Not started (low priority — ImportBankStatementDialog is a 4-step wizard)

---

### Phase 8: Shared Selectors — Required for All Phases

These changes are prerequisites for phases 1–7. Do them as part of Phase 0.

| Component             | File                                                     | Changes Needed                                                              |
| --------------------- | -------------------------------------------------------- | --------------------------------------------------------------------------- |
| EntitySelector        | `components/common/forms/EntitySelector.tsx`             | Add `inputRef` prop, forward `onKeyDown`, auto-advance on select            |
| AccountSelector       | `components/common/forms/AccountSelector.tsx`            | Add `inputRef` prop, forward `onKeyDown`, auto-advance on select            |
| ProjectSelector       | `components/common/forms/ProjectSelector.tsx`            | Add `inputRef` prop, forward `onKeyDown`, auto-advance on select            |
| TransactionFormFields | `components/accounting/shared/TransactionFormFields.tsx` | Accept `useTallyKeyboard` field registration, wire up all 7 internal fields |
| LineItemsTable        | `components/accounting/shared/LineItemsTable.tsx`        | Internal Enter navigation across columns + add-row on last field            |

---

## Recommended Order of Execution

```
Phase 0  →  Phase 2  →  Phase 4  →  Phase 5  →  Phase 6
(hook)      (approvals)  (direct     (invoices/   (payments
             2-3 fields   payments)   bills)       with alloc)
                          10 fields   15+ fields   18+ fields
```

Skip Phases 1, 3, 7 initially — they're low-frequency dialogs that can be done later.

**Rationale:** Start with the hook infrastructure, validate on the simplest high-frequency dialogs (approvals), then tackle the daily-use payment forms, then the complex transaction forms.

## Gotchas & Edge Cases

1. **MUI Autocomplete**: Enter key is captured by the dropdown. Must detect `open` state — only advance when dropdown is closed and a value is selected.
2. **Multiline TextFields**: Enter inserts newline. Exclude from Enter chain; user uses Tab to leave.
3. **Conditional fields**: Payment method changes which fields are visible. Hook must handle dynamic field count (use a stable key-based registration, not index-based).
4. **Disabled fields**: Skip disabled/read-only fields when advancing.
5. **Allocation tables**: Enter in the amount cell should move to the next bill's amount cell, not the next form field.
6. **Edit mode**: Some fields are read-only in edit mode (e.g., invoice number). Skip them in the Enter chain.
7. **Validation on advance**: Optionally validate the current field before advancing (e.g., amount > 0). Start without this — add later if users want it.

## Success Metrics

- User can complete a direct payment entry (Phase 4) without touching the mouse
- User can record a vendor payment with bill allocations (Phase 6) with at most 2–3 mouse interactions (for selecting bills from the allocation table)
- No regression in existing mouse-based workflows
