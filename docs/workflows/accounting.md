# Accounting — User Workflows

> Generated 2026-07-03 from code inspection (routes, services, state machines, Cloud Functions). Part of the [module workflow docs](README.md).
>
> Scope: the Accounting module of Vapour Toolbox (`apps/web/src/app/accounting/**`, `apps/web/src/lib/accounting/**`, `functions/src/**`). Every claim below is grounded in code that was read; unimplemented surfaces are flagged **⚠ Known gap**. Amounts are stored in INR as `baseAmount`; foreign-currency documents also carry `totalAmount` (foreign) and a per-transaction `exchangeRate`. There is **no** FX rate table — the rate is entered on each transaction.

---

## 1. Module overview

The module is a double-entry general ledger. Every posted document carries a balanced `entries[]` array (Σdebit = Σcredit); this is enforced at save time by `enforceDoubleEntry()` / `validateLedgerEntries()` and cannot be bypassed (`apps/web/src/lib/accounting/transactionService.ts:163`, `ledgerValidator.ts`). All financial documents live in one `transactions` collection, discriminated by a `type` field.

The nine transaction types and when a user picks each (prefixes from `transactionNumberGenerator.ts:25`):

| Type               | Number prefix | User picks it to…                                                                                                                      |
| ------------------ | ------------- | -------------------------------------------------------------------------------------------------------------------------------------- |
| `CUSTOMER_INVOICE` | INV           | Bill a customer for goods/services (AR).                                                                                               |
| `CUSTOMER_PAYMENT` | RCPT          | Record money _received_ from a customer and allocate it to invoices.                                                                   |
| `VENDOR_BILL`      | BILL          | Record a bill _owed_ to a vendor (AP).                                                                                                 |
| `VENDOR_PAYMENT`   | VPAY          | Pay a vendor and allocate to bills (with optional TDS).                                                                                |
| `JOURNAL_ENTRY`    | JE            | Post a manual/adjusting double-entry (also used to settle a linked bill/invoice, and by depreciation).                                 |
| `BANK_TRANSFER`    | TRF           | Move money between bank accounts. **⚠ Known gap — no create UI** (only a filter label in `transactions/page.tsx` and reporting logic). |
| `EXPENSE_CLAIM`    | EXP           | Employee expense reimbursement. **⚠ Known gap — no create UI** (referenced only in reports/tests).                                     |
| `DIRECT_PAYMENT`   | DPAY          | Pay an expense straight from bank with no vendor bill (Dr expense / Cr bank).                                                          |
| `DIRECT_RECEIPT`   | DRCPT         | Receive income straight to bank with no invoice (Dr bank / Cr revenue).                                                                |

Two independent status axes:

- **Workflow status** (`TransactionStatus`, `packages/types/src/transaction.ts:37`): `DRAFT | PENDING_APPROVAL | APPROVED | REJECTED | POSTED | VOID`.
- **Payment status** (`PaymentStatus`): `UNPAID | PARTIALLY_PAID | PAID | OVERDUE` — applies to invoices/bills only.

> Note: the invoice/bill list filters offer `SENT`/`PAID`/`OVERDUE` status options that are **not** members of `TransactionStatus` — these are legacy/derived filter values (`invoices/page.tsx:491`).

---

## 2. Step-by-step "How to…" guides

### 2.1 Create an invoice or a bill (identical shape)

Invoices: `apps/web/src/app/accounting/invoices/page.tsx` + `components/CreateInvoiceDialog.tsx`. Bills: `bills/page.tsx` + `components/CreateBillDialog.tsx`.

1. On the list page click **New Invoice** / **Record First Bill** (shown only if `canManage`, i.e. `MANAGE_ACCOUNTING`).
2. Pick the customer/vendor (`entityId`), date, due date, line items (each line may carry its own revenue/expense `accountId`), GST, and — for bills — TDS.
3. For foreign currency, enter the currency and `exchangeRate`; the dialog stores `totalAmount` (foreign), `baseAmount = amount × rate` (INR), and forces GL entries to INR (`CreateInvoiceDialog.tsx:205`, `:252-253`).
4. On save the dialog **generates balanced GL entries immediately** via `generateInvoiceGLEntries` / `generateBillGLEntries` (`glEntry/generators.ts`) and writes them onto the document together with `status = DRAFT` (the form default), `paymentStatus = 'UNPAID'`, `outstandingAmount = baseAmount` (`CreateInvoiceDialog.tsx:231-261`).
   - Invoice GL: Dr AR (1200) / Cr Revenue (per-line or 4100) / Cr CGST-SGST-IGST Payable (2201/2202/2203).
   - Bill GL: Dr Expense (per-line or 5100) / Dr GST Input (1301/1302/1303) / Cr AP (2100) less TDS / Cr TDS Payable (2300).
   - GL account IDs are resolved from the Chart of Accounts via `getSystemAccountIds(db, 'default-entity')` (`systemAccountResolver.ts`); missing system accounts abort the save with an error.

> Because entries are attached at creation, the balance-sync Cloud Function updates GL account balances even while a document is still `DRAFT` (see §4).

### 2.2 Submit for approval → Approve / Reject (invoices & bills share one service)

Service: `apps/web/src/lib/accounting/transactionApprovalService.ts` (generic over `CUSTOMER_INVOICE` / `VENDOR_BILL`). UI dialogs: `invoices/components/SubmitForApprovalDialog.tsx`, `ApproveInvoiceDialog.tsx`; `bills/components/SubmitBillForApprovalDialog.tsx`, `ApproveBillDialog.tsx`.

1. **Submit** (row action shown when `status === 'DRAFT'` and `canManage`): choose an approver. `submitTransactionForApproval` sets `status = PENDING_APPROVAL`, records `submittedByUserId`, assigns `assignedApproverId`, and creates an actionable task notification for the approver (`transactionApprovalService.ts:134`).
2. **Approve** (row action shown when `status === 'PENDING_APPROVAL'` and user is `canManage` **or** the assigned approver): `approveTransaction` sets `status = APPROVED`. **Self-approval is blocked** — `preventSelfApproval(userId, submittedByUserId)` throws if the approver is the submitter (`:316`). Completes the approver's task and notifies the submitter.
3. **Reject** (`ApproveInvoiceDialog` offers reject; comment **required**): `rejectTransaction` returns the document to `status = DRAFT`, stores `rejectionReason`, and also blocks self-rejection (`:461`).

Editing is permitted in `DRAFT` and (during a testing phase) `PENDING_APPROVAL`; delete allowed in `DRAFT`/`PENDING_APPROVAL`; bills additionally expose "record payment" once `APPROVED` (`getTransactionAvailableActions`, `:558`).

**⚠ Known gap:** the invoice "Send Invoice" row action (`status === 'APPROVED'`) has an empty `onClick` (`invoices/page.tsx:614`). There is no `POSTED`-setting UI step for invoices/bills — they move straight to payment.

### 2.3 Void (and "void & recreate") an invoice/bill

Service: `apps/web/src/lib/accounting/transactionVoidService.ts`.

1. Row action **Void / Change Customer|Vendor** appears when `canManage`, status ≠ `VOID`/`DRAFT`, and `paymentStatus` is neither `PAID` nor `PARTIALLY_PAID` (`invoices/page.tsx:618`, `bills/page.tsx:762`). `canVoidTransaction` re-checks these rules (`:130`).
2. **Void** sets `status = VOID`, generates reversing GL entries (debit⇄credit, `[REVERSAL]` description), stores them in `reversalEntries`, and sets `entriesLocked = true` (`:165`).
3. **Void & recreate** (`voidAndRecreateTransaction`, atomic) voids the original and creates a new `DRAFT` document with the same line items but a different entity and a fresh transaction number, cross-linking both for audit (`:275`). The new document starts with empty `entries` (regenerated on next save/approval).

### 2.4 Record a customer payment (receipt) and allocate to invoices

Dialog: `payments/components/RecordCustomerPaymentDialog.tsx`; allocation UI `customer-payment/InvoiceAllocationTable.tsx`; core `paymentHelpers.ts`.

1. On the Payments page click **Customer Receipt** (`canManage`).
2. Pick the customer, bank account, method (`BANK_TRANSFER | UPI | CHEQUE | CASH | CREDIT_CARD | DEBIT_CARD | OTHER`, `paymentConstants.ts:13`), date, amount, currency/rate.
3. The dialog loads the customer's outstanding invoices and lets the user allocate. Allocation is capped per-invoice at its outstanding, and **an allocation is required unless "Advance" is ticked** (`isAdvance`) (`:190`).
4. Save calls `createPaymentWithAllocationsAtomic` (`paymentHelpers.ts:387`), which in one batch: validates each allocation against live outstanding (`validatePaymentAllocation`, ≤ outstanding + 0.01 tolerance, `:343`); enforces total allocations ≤ payment amount and ≤ 100 allocations (`validateAllocations`, `:69`); generates GL (Dr Bank / Cr AR); creates the payment with `status = 'POSTED'`; and updates each invoice's `amountPaid`/`outstandingAmount`/`paymentStatus`.
   - **Payments do not go through an approval workflow** — they are written directly as `POSTED` (`RecordCustomerPaymentDialog.tsx:226`).
   - If no bank account is chosen, GL generation returns empty entries but still succeeds (`generators.ts:407`) — payment recorded without GL impact.
   - Allocations are always computed in **INR** (`getInrAmount`) so forex receipts allocate cleanly.

### 2.5 Pay a vendor — single payment

Dialog: `payments/components/RecordVendorPaymentDialog.tsx`; `vendor-payment/BillAllocationTable.tsx`, `TDSSection.tsx`. Same engine (`createPaymentWithAllocationsAtomic`) and same rules as §2.4, with:

- Outstanding bills loaded for the vendor (`status in ['APPROVED','POSTED']`).
- Optional **TDS** deduction (section/rate from `TDS_SECTIONS`, `paymentConstants.ts:63`); net payable = amount − TDS.
- Advance supported via `isAdvance`.
- GL: Dr AP (2100) / Cr Bank.

### 2.6 Pay vendors — payment batch (fund-allocation workflow)

Service: `paymentBatchService.ts`; UI `payment-batches/page.tsx`, `[id]/PaymentBatchDetailClient.tsx`, `new/page.tsx`, `components/AddReceiptDialog.tsx`, `AddPaymentDialog.tsx`. State machine: `stateMachines.ts:284`.

1. **Create batch** (`createPaymentBatch`) — number `PB-YYYY-NNNN`, `status = DRAFT`. _(The detail page currently creates with a placeholder bank account — `PaymentBatchDetailClient.tsx:185` "TODO: bank account selector".)_
2. **Add receipts** (fund sources) and **payments** (allocations) — only allowed while `DRAFT` (`addBatchReceipt`/`addBatchPayment` throw otherwise). Payments can carry TDS and a category; cross-project payments are detected (`detectCrossProjectPayments`) and warned as future interproject loans.
3. **Submit for approval** (`submitBatchForApproval`) → `PENDING_APPROVAL`. Guards: ≥1 receipt, ≥1 payment, total payments ≤ total receipts.
4. **Approve / Reject** (`approveBatch`/`rejectBatch`, require `MANAGE_ACCOUNTING`, `preventSelfApproval`). Reject → `REJECTED` (can go back to `DRAFT` or `CANCELLED`).
5. **Execute** → should create vendor payments, update bills, and post interproject loans. **⚠ Known gap:** there is no `executeBatch` function and the "Execute Payments" button has no `onClick` (`PaymentBatchDetailClient.tsx:466-475`); the `EXECUTING`/`COMPLETED` states are unreachable through the UI.

### 2.7 Journal entries

Dialog: `journal-entries/components/CreateJournalEntryDialog.tsx`.

1. **New Journal Entry** — add ≥2 ledger lines (enforced, `:254`). Each line takes either an `accountId` **or** an `entityId` (control account auto-resolved from the entity's role via `getEntityControlAccount`, `:323`).
2. Entries are validated for balance (`validateLedgerEntries`); `amount`/`baseAmount` = total debits.
3. Optionally link a customer invoice or vendor bill. When the JE is `POSTED`/`APPROVED`, `settleLinkedTransactionViaJournal` applies the entity-specific debit(bill)/credit(invoice) to the linked doc's `amountPaid`/`paymentStatus` and marks `settledViaJournal = true` (`paymentHelpers.ts:946`). Un-posting or re-linking calls `reverseJournalSettlement` (`:1029`).

### 2.8 Direct payment / direct receipt

Dialogs: `RecordDirectPaymentDialog.tsx`, `RecordDirectReceiptDialog.tsx`. Created directly as `status = 'POSTED'` with inline GL (`RecordDirectPaymentDialog.tsx:214`):

- Direct payment: Dr expense account / Cr bank.
- Direct receipt: Dr bank / Cr revenue account.

No allocation, no approval, optional cheque/UPI reference and project.

### 2.9 Manage the Chart of Accounts

Page `chart-of-accounts/page.tsx`; dialog `components/accounting/CreateAccountDialog.tsx`; `initializeChartOfAccounts.ts`.

- Requires `canViewAccounting` to view, `canManageAccounting` to edit.
- If the CoA is empty it **auto-initializes** a default tree once per mount (`:89`, `hasAttemptedInit`).
- Accounts have `accountType` (`ASSET|LIABILITY|EQUITY|INCOME|EXPENSE`), `isGroup`, `isActive`, a `code`, and running `debit`/`credit`/`currentBalance` (maintained by the Cloud Function, §4). Create/edit via the tree view + dialog.

### 2.10 Fiscal years & accounting periods

Service `fiscalYearService.ts`; page `fiscal-years/page.tsx`.

- Fiscal years are **derived** (April–March, India), never stored (`fiscalYearHelpers.ts`).
- Monthly periods are derived too and persisted **only** when closed/locked; any month without a document is treated **OPEN** (`isPeriodOpen`, `:381`).
- Transaction saves validate the date against the period (`validatePeriodIsOpen` in `transactionService.ts:125`); a closed/locked period throws `ClosedPeriodError` (period validation can be skipped for system ops).
- Close/lock/reopen logic exists (`closePeriod`/`lockPeriod`/`reopenPeriod`, with a `periodLockAudit` trail): OPEN→CLOSED→LOCKED; CLOSED→OPEN reopen; LOCKED cannot be reopened.
- **⚠ Known gap:** the Fiscal Years page is **read-only** — it shows status chips but has no Close/Lock/Reopen buttons, and no component references those service functions. Year-end closing helpers (`calculateYearEndBalances`, `finalClose`, `createAdjustmentPeriod`) are **stubs that throw** (`fiscalYearService.ts:426-451`).

### 2.11 Fixed-asset lifecycle

Service `fixedAssetService.ts`; pages `fixed-assets/page.tsx`, `[id]/AssetDetailClient.tsx`, `depreciation/page.tsx`; dialogs Create/Edit/Dispose/WriteOff.

1. **Create** (`createFixedAsset`) — number `FA-YYYY-NNNN`, `status = ACTIVE`, resolves asset/accum-dep/dep-expense GL accounts by category, seeds depreciation config (WDV/SLM, rate, useful life).
2. **Run depreciation** (`runDepreciation`) — posts one aggregated `JOURNAL_ENTRY` `DEP-YYYY-MM` (Dr Depreciation Expense / Cr Accumulated Depreciation) and updates each asset's `writtenDownValue`. **Idempotent** — refuses to post twice for the same month (`:626`). Preview via `previewDepreciation`.
3. **Dispose** (`disposeAsset`) → `DISPOSED`, records gain/loss. **Write off** (`writeOffAsset`) → `WRITTEN_OFF`.
   - **⚠ Known gap:** disposal and write-off do **not** post a GL journal entry yet ("TODO (Phase 2)", `:353`, `:389`).

All operations require `MANAGE_ACCOUNTING`.

### 2.12 Set up recurring transactions

Service `recurringTransactionService.ts`; pages `recurring/page.tsx`, `new/page.tsx`, `[id]/…`, `upcoming/page.tsx`; Cloud Function `functions/src/recurringTransactions/generateOccurrences.ts`.

1. **New recurring** (`createRecurringTransaction`) — name, type (`SALARY|VENDOR_BILL|VENDOR_PAYMENT|CUSTOMER_INVOICE|JOURNAL_ENTRY|DIRECT_PAYMENT`), frequency (`DAILY|WEEKLY|BIWEEKLY|MONTHLY|QUARTERLY|YEARLY`), start/end, `autoGenerate`, `daysBeforeToGenerate`, `requiresApproval`. `status = ACTIVE`.
2. **Occurrences** are generated (`generatePendingOccurrences` → `createOccurrence`) as `PENDING`; each can be **skipped** (`skipOccurrence`), **modified** (`modifyOccurrence`), or marked **generated** once the real transaction is created (`markOccurrenceGenerated`). Statuses: `PENDING|GENERATED|SKIPPED|MODIFIED`.
3. Pause/resume/complete via `updateRecurringTransactionStatus` (`ACTIVE|PAUSED|COMPLETED|CANCELLED`); delete is a soft-delete with audit.

### 2.13 Run reports

Pages under `reports/`: `trial-balance`, `balance-sheet`, `profit-loss`, `cash-flow`, `account-ledger`, `entity-ledger`, `gst-summary`, `period-report`, `project-financial`, `receipts-payments`. Logic in `lib/accounting/reports/*` and `gstReports/`, `tdsReportGenerator.ts`. Tax filings (GSTR-1/3B, Form 16A/26Q, TDS challans) under `tax-compliance/`. All export to CSV/Excel via `reports/exportReport.ts`. These are read-only views over the ledger; if numbers look wrong, use Data Health → Recalculate (§2.14).

### 2.14 Data Health (recalculate balances / reconcile)

Page `data-health/page.tsx` + drill-downs. Surfaces seven issue classes (only shown when count > 0): unapplied payments, advances (informational), missing GL entries, unmapped accounts, stale payment statuses, overdue items, duplicate transaction numbers. Computes a health score = % of transactions with no issue.

- **Reconcile** (`reconcilePaymentStatuses`, `paymentHelpers.ts:678`) — rebuilds each bill/invoice's `amountPaid`/`outstandingAmount`/`paymentStatus` from payment allocations, then a second pass marks items PAID when the entity's net ledger balance (incl. journal entries and opening balances) shows nothing owed.
- **Recalculate Account Balances** — calls the `recalculateAccountBalances` Cloud Function (confirmation dialog first); resets all account counters to zero and rebuilds from non-deleted transaction entries (§4).
- **Auto-allocate** unapplied payments FIFO (`bulkAutoAllocatePayments`, `:1085`).

### 2.15 Trash (soft delete / restore / permanent delete)

Service `transactionDeleteService.ts`; page `trash/page.tsx`.

- **Move to Trash** (row action on invoices/bills/payments) → `softDeleteTransaction` sets `isDeleted = true` + metadata; hidden from lists. Cannot delete a `VOID` or already-deleted document (`canSoftDelete`, `:80`). Soft-deleted docs remain in the collection but are excluded from `recalculateAccountBalances` (`accountBalances.ts:278`) and all list/report queries filter `isDeleted`; the balance Cloud Function reverses GL impact on **hard delete only**.
- **Restore** → clears the soft-delete fields (`restoreTransaction`).
- **Permanently delete** → `hardDeleteTransaction` archives the full doc to `deletedTransactions`, then removes it from `transactions` (which triggers the Cloud Function to reverse its GL impact). Only soft-deleted docs can be hard-deleted.

All three require `MANAGE_ACCOUNTING`.

---

## 3. Lifecycle / status-transition tables

### 3.1 Invoice / Bill workflow status (`transactionApprovalService.ts`, `transactionVoidService.ts`)

| From                            | Action                    | To                              | Who / permission                                                                     |
| ------------------------------- | ------------------------- | ------------------------------- | ------------------------------------------------------------------------------------ |
| DRAFT                           | Submit for approval       | PENDING_APPROVAL                | `MANAGE_ACCOUNTING` (submitter)                                                      |
| DRAFT                           | Edit / Delete (→Trash)    | DRAFT / (isDeleted)             | `MANAGE_ACCOUNTING`                                                                  |
| PENDING_APPROVAL                | Approve                   | APPROVED                        | `MANAGE_ACCOUNTING`, must **not** be submitter; must be assigned approver or manager |
| PENDING_APPROVAL                | Reject (comment required) | DRAFT                           | `MANAGE_ACCOUNTING`, not submitter                                                   |
| APPROVED                        | (bill) Record payment     | APPROVED, paymentStatus changes | `MANAGE_ACCOUNTING`                                                                  |
| DRAFT/PENDING/APPROVED/REJECTED | Void / Void&Recreate      | VOID                            | `MANAGE_ACCOUNTING`; blocked if `PAID`/`PARTIALLY_PAID`                              |
| VOID                            | —                         | terminal                        | (cannot delete a VOID)                                                               |

### 3.2 Payment documents (customer/vendor/direct)

Created directly as **POSTED**; no approval states. Edited/soft-deleted via the payments list. No void workflow (reverse by editing allocations or deleting).

### 3.3 Bill/Invoice payment status (`paymentHelpers.ts`)

| From                    | Trigger                                        | To                         |
| ----------------------- | ---------------------------------------------- | -------------------------- |
| UNPAID                  | first allocation < outstanding                 | PARTIALLY_PAID             |
| UNPAID / PARTIALLY_PAID | allocation clears outstanding (rounded to 0)   | PAID                       |
| any                     | journal-entry settlement clears entity balance | PAID (`settledViaJournal`) |
| PARTIALLY_PAID/PAID     | payment edited/removed / JE reversed           | recomputed down to UNPAID  |

### 3.4 Payment batch (`stateMachines.ts:284`)

| From             | Action → To                                   | Permission                       |
| ---------------- | --------------------------------------------- | -------------------------------- |
| DRAFT            | Submit → PENDING_APPROVAL; Cancel → CANCELLED | `MANAGE_ACCOUNTING`              |
| PENDING_APPROVAL | Approve → APPROVED; Reject → REJECTED         | `MANAGE_ACCOUNTING`, not creator |
| APPROVED         | Execute → EXECUTING                           | **⚠ unwired**                    |
| EXECUTING        | → COMPLETED                                   | **⚠ unwired**                    |
| REJECTED         | → DRAFT or CANCELLED                          | `MANAGE_ACCOUNTING`              |

### 3.5 Fixed asset (`stateMachines.ts:338`)

| From                   | Action → To             | Permission          |
| ---------------------- | ----------------------- | ------------------- |
| ACTIVE                 | Dispose → DISPOSED      | `MANAGE_ACCOUNTING` |
| ACTIVE                 | Write off → WRITTEN_OFF | `MANAGE_ACCOUNTING` |
| DISPOSED / WRITTEN_OFF | terminal                | —                   |

### 3.6 Accounting period (`fiscalYearService.ts`, UI unwired)

OPEN → CLOSED → LOCKED; CLOSED → OPEN (reopen); LOCKED is terminal (needs super admin). Missing doc = OPEN.

### 3.7 Recurring transaction / occurrence

Recurring: `ACTIVE ↔ PAUSED`, `→ COMPLETED` (past end date), `→ CANCELLED`. Occurrence: `PENDING → GENERATED | SKIPPED | MODIFIED`.

---

## 4. Automatic behaviours

- **GL account-balance sync (Cloud Function).** `onTransactionWrite` (`functions/src/accountBalances.ts:146`) fires on every write to `transactions`. On **create** it applies each entry with `FieldValue.increment` (atomic); on **update** it applies the net **delta** of old→new entries; on **delete** it reverses. It updates `debit`, `credit`, `currentBalance = debit − credit`, `lastUpdated` per account. It does **not** filter by status, so a `DRAFT` invoice with entries already moves balances (soft-deleting keeps entries in place; only a **hard delete** reverses them).
- **Recalculate (callable).** `recalculateAccountBalances` (`:214`) requires auth + `MANAGE_ACCOUNTING` bit (`1<<14`), rate-limited; zeroes all accounts then rebuilds from all non-`isDeleted` transactions, rounding to 2 dp. Exposed on the Data Health page.
- **Payment-status sync.** Every allocation path (`createPaymentWithAllocationsAtomic`, `updatePaymentWithAllocationsAtomic`, `processPaymentAllocations`, JE settlement) recomputes `amountPaid`/`outstandingAmount`/`paymentStatus` atomically in INR. Batch reconciliation (`reconcilePaymentStatuses`) is the repair tool.
- **Transaction numbering.** `generateTransactionNumber` (`transactionNumberGenerator.ts:98`) uses an atomic Firestore counter `transaction-{type}-FY{yynn}`, format `PREFIX-YYNN-NNNN`, resetting each fiscal year (FY starts April; configurable via `company/settings.fiscalYearStartMonth`). Payment batches use `PB-YYYY-NNNN`; assets `FA-YYYY-NNNN`; depreciation `DEP-YYYY-MM`.
- **Overdue emails.** `checkOverdueItemsAndNotify` (`functions/src/email/scheduled.ts:49`) runs daily 09:00 IST. It computes entity-level net balances (invoices − bills ± payments ± journal entries + opening balances), flags vendor bills past due date with real outstanding, and sends one idempotent digest per IST day linking to `/accounting/data-health/overdue` (also checks overdue PO deliveries). Frequency (daily/weekly/monthly) is gated by `notificationSettings/emailConfig`.
- **Period guard.** Saving a transaction whose date falls in a CLOSED/LOCKED month is rejected (`ClosedPeriodError`) unless an OPEN adjustment period covers the date.
- **Depreciation idempotency.** A month's depreciation JE cannot be posted twice (`DEP-YYYY-MM` guard).

---

## 5. Permissions required per action

Almost all mutating actions gate on **`PERMISSION_FLAGS.MANAGE_ACCOUNTING`** (bit `1<<14` = 16384); read/list gates on `canViewAccounting`. Enforced both client-side (`hasPermission`/`canManageAccounting`) and server-side (`requirePermission`, `firestore.rules`).

| Action                                                     | Permission                         | Extra rule                                                                  |
| ---------------------------------------------------------- | ---------------------------------- | --------------------------------------------------------------------------- |
| View any accounting page/report                            | `canViewAccounting`                | —                                                                           |
| Create/edit invoice, bill, JE, payment, direct pmt/receipt | `MANAGE_ACCOUNTING`                | double-entry + open-period enforced                                         |
| Submit invoice/bill for approval                           | `MANAGE_ACCOUNTING`                | status must be DRAFT                                                        |
| Approve / Reject invoice, bill                             | `MANAGE_ACCOUNTING`                | **not** the submitter (`preventSelfApproval`); approver-assigned or manager |
| Void / Void&Recreate                                       | `MANAGE_ACCOUNTING`                | not PAID/PARTIALLY_PAID                                                     |
| Record & allocate payment                                  | `MANAGE_ACCOUNTING`                | allocation ≤ outstanding; ≤ payment total; ≤100 allocations                 |
| Create/submit payment batch                                | `MANAGE_ACCOUNTING`                | DRAFT-only edits; receipts≥1, payments≥1, pay≤receipt                       |
| Approve/Reject payment batch                               | `MANAGE_ACCOUNTING`                | **not** the creator                                                         |
| Manage Chart of Accounts                                   | `canManageAccounting`              | auto-init when empty                                                        |
| Close/Lock/Reopen period                                   | `MANAGE_ACCOUNTING` (service)      | **⚠ no UI**                                                                 |
| Create/dispose/write-off/depreciate assets                 | `MANAGE_ACCOUNTING`                | disposal/write-off GL **⚠ not posted**                                      |
| Create/edit/delete recurring                               | `MANAGE_ACCOUNTING`                | soft-delete only                                                            |
| Soft delete / Restore / Hard delete                        | `MANAGE_ACCOUNTING`                | no VOID delete; hard-delete archives                                        |
| Recalculate balances (callable)                            | `MANAGE_ACCOUNTING` (custom claim) | rate-limited, auth required                                                 |

---

## Consolidated ⚠ Known gaps

1. **Payment batch execution** — no `executeBatch`; "Execute Payments" button is inert; `EXECUTING`/`COMPLETED` unreachable; interproject-loan creation from batches never fires (`PaymentBatchDetailClient.tsx:466`).
2. **Bank Transfer & Expense Claim** — types exist (numbering, labels, reports) but have **no create UI**.
3. **Fiscal-year period close/lock/reopen & year-end closing** — service logic present but not surfaced; year-end helpers throw (`fiscalYearService.ts:426`).
4. **Fixed-asset disposal / write-off** — status changes but no GL journal posted (TODO Phase 2).
5. **Invoice "Send" action** — empty handler; no explicit `POSTED` step for invoices/bills.
6. **Payment batch creation** — uses a hardcoded placeholder bank account (`'primary-bank'`), pending a bank-account selector (`PaymentBatchDetailClient.tsx:183`).
