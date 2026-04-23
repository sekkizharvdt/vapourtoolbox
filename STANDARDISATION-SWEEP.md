# Cross-Module Standardisation Sweep

**Created**: 2026-04-20
**Owner**: sekkizhar
**Origin**: April 2026 procurement review ([PROCUREMENT-REVIEW-2026-04-17.md](PROCUREMENT-REVIEW-2026-04-17.md)) surfaced four recurring bug/UX classes. The preventions landed for procurement; this doc drives the same sweep across accounting, HR, projects, thermal, and the shared modules so the same latent bugs get caught before they hit users.

---

## Conventions already in force (session 2026-04-20)

Grounded in working code so future sessions can verify:

| Convention                                                                                           | Where it lives                                                                    | Commit                 |
| ---------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------- | ---------------------- |
| CLAUDE.md rules 26–29 (parent→child denorm, no silent catches, module completeness, label constants) | `CLAUDE.md`                                                                       | `a7b13626`, `40e67a11` |
| `removeUndefinedDeep` / `assertNoUndefinedValues` shared helpers                                     | `apps/web/src/lib/firebase/typeHelpers.ts`                                        | `a7b13626`             |
| ESLint rule banning `value \|\| undefined` in service payloads                                       | `.eslintrc.json` (scoped to `apps/web/src/lib/**/*.ts` + `functions/src/**/*.ts`) | `3fa6acbc`             |
| `@vapour/constants/labels.ts` with the first batch of domain labels                                  | `packages/constants/src/labels.ts`                                                | `40e67a11`             |
| Document AI gated behind `ENABLE_DOCUMENT_AI_COMPARISON`                                             | `functions/src/offerParsing/compareOfferParsers.ts`                               | `40e67a11`             |
| `preventSelfApproval()` on PR submit path                                                            | `apps/web/src/lib/procurement/purchaseRequest/workflow.ts`                        | `44aead73`             |

**ESLint scope**: the `|| undefined` rule applies inside `lib/**` service files. UI dialogs (`components/**`, `app/**/*.tsx`) hold ~200 legacy violations and are deliberately excluded for now. Broaden once those sites are retrofitted.

---

## What to look for, per module

Run each check once per module. "Module" = one of the top-level `apps/web/src/app/<module>/` roots or the corresponding service folder in `apps/web/src/lib/<module>/`.

### 1. `undefined` leaks in Firestore writes

Grep patterns:

- `|| undefined` inside object-literal properties — service layer will fail lint now; UI still needs a manual review.
- Local copies of `removeUndefinedDeep` / `stripUndefinedDeep` — consolidate to the shared helper in `lib/firebase/typeHelpers.ts` (existing sites: `purchaseOrder/crud.ts` already migrated; `proposals/proposalService.ts` still has its own — needs migration).
- `addDoc(..., data)` or `setDoc(ref, data)` / `batch.set(ref, data)` where `data` has optional fields — check whether conditional spreads or `removeUndefinedDeep(data)` is applied before the write.

Fix pattern:

```typescript
const data: Record<string, unknown> = {
  // required
  ...(optionalValue !== undefined && { optionalValue }),
};
assertNoUndefinedValues(data, 'createVendorBill'); // belt-and-braces
await addDoc(collection, data);
```

### 2. Silent catches

Grep patterns:

- `catch {` followed by `}` with only whitespace / comment (no `logger.error`).
- `catch (e) { return { success: false, error: '...' }; }` — returns a generic message without logging the real `e`.
- Async functions without any `try/catch` that could leave Firestore writes in an intermediate state.

Fix pattern:

```typescript
} catch (error) {
  logger.error('[service/operation] context', {
    error: error instanceof Error ? error.message : String(error),
    code: (error as { code?: string | number })?.code,
  });
  throw error; // or return a typed degradation with a documented reason
}
```

### 3. Parent → child reference denormalisation (CLAUDE.md rule 26)

For each parent-child relationship in the module, confirm the child carries:

- Parent document number (the human-readable identifier)
- Parent date (createdAt / issuedAt / documentDate)
- Parent's key display fields (vendor name, project name, title)

Canonical chains:

- **Procurement**: PR → RFQ → Offer → PO → GR → WCC / VendorBill → VendorPayment — already audited and fixed.
- **Accounting**: Invoice → Payment (via invoiceAllocations); Bill → Payment (via billAllocations); Bill ← GR (already carries `goodsReceiptId` + `purchaseOrderId`).
- **HR**: Employee → LeaveRequest; Employee → TravelExpense; Project → TimeEntry.
- **Projects**: Project → Proposal → BOM → PR (via items); Project → Transmittal → MasterDocument.

If any child lacks the parent's number/date/key fields, the dashboard for that child will need joins at render time — which is slow and drift-prone. Add the denormalised fields at creation.

### 4. Label drift (CLAUDE.md rule 29)

Grep patterns:

- Inline status text like `"Pending"`, `"Approved"`, `"Rejected"` — promote to labels file.
- Domain terms that might be renamed: "Invoice" vs "Bill", "Payment" vs "Receipt", "Leave" vs "Time Off", status enum values shown to users.
- PDF section headings (Accounting PDFs, HR payslip PDFs) — any literal string the user would complain about if renamed.

Fix pattern: add the label to `packages/constants/src/labels.ts` and reference it from the UI.

### 5. Module completeness (CLAUDE.md rule 28)

Walk the dashboard for each module and click every "New X" / "Edit" button. If any route 404s, the module is incomplete.

Check against: List + New + View + Edit + composite indexes for each `where + orderBy`.

---

## Module-by-module sweep status

`⬜` not started · `🔍` in progress · `🟡` partial findings · `✅` clean

| Module                              | undefined | silent catch | ref denorm | labels | completeness | status  | notes                                                                   |
| ----------------------------------- | --------- | ------------ | ---------- | ------ | ------------ | ------- | ----------------------------------------------------------------------- |
| procurement                         | ✅        | ✅           | ✅         | 🟡     | ✅           | ✅ done | april review, session 2026-04-20                                        |
| accounting (bills)                  | ✅        | 🟡           | ✅         | 🟡     | 🟡           | 🟡      | GR→bill denorm shipped 2026-04-21; silent-catch notes remain            |
| accounting (invoices)               | ✅        | 🟡           | 🟡         | 🟡     | 🟡           | 🟡      | see findings 2026-04-20                                                 |
| accounting (payments)               | ✅        | ✅           | ✅         | 🟡     | 🟡           | 🟡      | PaymentAllocation invoiceDate/dueDate denorm shipped 2026-04-21         |
| accounting (journal entries)        | ✅        | ✅           | ✅         | 🟡     | 🟡           | 🟡      | dialog-only pattern                                                     |
| accounting (bank transfers)         | ✅        | 🟡           | ✅         | 🟡     | 🟡           | 🟡      | parser has defensive empty catches (documented)                         |
| accounting (expense claims)         | ✅        | ✅           | 🟡         | 🟡     | 🟡           | 🟡      | reimbursement payment lacks source claim ref                            |
| accounting (fixed assets)           | ✅        | 🟡           | ⬜         | 🟡     | ✅           | 🟡      | depreciation not yet implemented (Phase 2)                              |
| accounting (payment batches)        | ✅        | ✅           | N/A        | 🟡     | 🟡           | 🟡      | batch→payment execution flow not implemented yet (Phase 2)              |
| accounting (payment planning)       | ✅        | ✅           | ✅         | 🟡     | 🟡           | 🟡      |                                                                         |
| accounting (recurring transactions) | ✅        | ✅           | N/A        | 🟡     | 🟡           | 🟡      | post-occurrence → transaction flow not implemented yet (Phase 2)        |
| hr (employees)                      | ✅        | ✅           | ✅         | 🟡     | 🟡           | 🟡      | no `/employees/new` — admin-gated?                                      |
| hr (leave)                          | ✅        | ✅           | ✅         | 🟡     | ✅           | 🟡      | department denorm shipped 2026-04-21; labels drift only                 |
| hr (travel expenses)                | ✅        | ✅           | ✅         | 🟡     | ✅           | 🟡      | denorm complete; labels drift                                           |
| hr (time tracking)                  | ✅        | ✅           | 🟡         | N/A    | N/A          | 🟡      | TimeEntry link indirect via taskNotificationId                          |
| hr (on-duty records)                | ✅        | ✅           | ✅         | 🟡     | 🟡           | 🟡      | no `/on-duty/page.tsx` list route                                       |
| projects (core)                     | ✅        | ✅           | ✅         | 🟡     | ✅           | 🟡      | charter → PR carries project refs                                       |
| projects (proposals)                | ✅        | ✅           | 🟡         | 🟡     | ✅           | 🟡      | stripUndefinedDeep migrated ✅ 2026-04-20                               |
| projects (BOMs)                     | ✅        | ✅           | N/A        | ✅     | ❌           | 🟡      | BOM→PR flow not implemented; no standalone BOM UI — inline in proposals |
| projects (cost configurations)      | ✅        | ✅           | ✅         | ✅     | ✅           | ✅      | enums already in constants                                              |
| documents                           | ✅        | ✅           | 🟡         | 🟡     | ✅           | 🟡      | denorm pass 2026-04-21 — 4 of 6 gaps closed, transmittal+link remain    |
| enquiries                           | ✅        | ✅           | ✅         | 🟡     | ✅           | 🟡      | proposal carries enquiry refs; status labels inline                     |
| materials                           | ✅        | ✅           | ✅         | 🟡     | ✅           | 🟡      | variants nested; availability labels inline                             |
| thermal (calculators)               | N/A       | ✅           | N/A        | N/A    | ✅           | ✅      | all empty catches documented with rationale                             |
| flow (tasks + meetings)             | ✅        | ✅           | ✅         | 🟡     | ✅           | 🟡      | meeting→task denorm shipped 2026-04-21; labels drift                    |
| feedback                            | ✅        | ✅           | ✅         | 🟡     | 🟡           | 🟡      | feedback→task carries title+reporter; no admin dashboard                |
| auth / users                        | ✅        | ✅           | N/A        | ✅     | ✅           | ✅      | uses PERMISSION_FLAGS constants; /admin/users exists                    |
| entities                            | ✅        | ✅           | N/A        | 🟡     | 🟡           | 🟡      | no dedicated entity master UI — via /admin/entities?                    |

**Priority order (recommended)**: accounting → hr → projects → documents → everything else. Accounting is the highest-risk because it's double-entry and the `undefined` class of bugs there can corrupt the GL silently.

---

## Open standardisation items (not started, deliberately deferred)

1. **UI-layer `|| undefined` retrofit** (~200 sites). Rule is scoped to `lib/**` for now. Dedicated refactor session — touch files one module at a time and migrate to conditional spreads, then broaden the ESLint rule.
2. **Form-from-schema pattern** (react-hook-form + zod). Not started. Best introduced on the next new create page as a reference implementation, then migrate existing forms opportunistically.
3. **Playwright smoke test per Create flow**. Playwright is configured (`apps/web/e2e/`); procurement doesn't have a dedicated create-flow suite yet. Two-hour slot — covers "New button goes somewhere valid" and "Create → View round-trip" per module.
4. **Quarterly domain review cadence**. Process, not code. Calendar reminder per module lead.
5. **Migrate remaining `stripUndefinedDeep` / `removeUndefinedValues` local copies** to the shared `removeUndefinedDeep` helper. `lib/proposals/proposalService.ts` migrated 2026-04-20 (session 858535e6+). No other known duplicates at time of writing — re-scan during each module sweep.
6. **Label migration** from inline strings to `@vapour/constants/labels.ts`. Scaffold expanded 2026-04-21 with `TRANSACTION_STATUS_LABELS`, `ACCOUNTING_PAYMENT_STATUS_LABELS`, `LEAVE_REQUEST_STATUS_LABELS`, `ON_DUTY_REQUEST_STATUS_LABELS`, `TRAVEL_EXPENSE_STATUS_LABELS`, `PROPOSAL_STATUS_LABELS`, `MEETING_STATUS_LABELS`, `MANUAL_TASK_PRIORITY_LABELS`. UI sites now have a target to reference — migration is opportunistic as components are touched.

---

## Per-module findings template

When you sweep a module, append a section here:

```md
## <module>

**Swept**: YYYY-MM-DD by <name>
**Files audited**: N service files, N pages

### undefined leaks

- `path/to/file.ts:LINE` — description → fix / deferred

### silent catches

- ...

### reference denorm

- ...

### labels

- ...

### completeness

- ...

### shipped

- commit <hash> — summary
```

---

## Findings log

### accounting

**Swept**: 2026-04-20 by sekkizhar (via explore agents)
**Files audited**: ~40 service files in `apps/web/src/lib/accounting/`, 11 sub-routes in `apps/web/src/app/accounting/`, related Cloud Functions.

#### undefined leaks

Clean. No `|| undefined` violations slipped past the lib/\*\* ESLint rule. No local `removeUndefinedDeep` duplicates — `paymentBatchService.ts` correctly imports `removeUndefinedValues` from `lib/firebase/typeHelpers`. GL entry generators use a dedicated `sanitizeEntry()` helper before writes.

#### silent catches

- [transactionNumberGenerator.ts:79](apps/web/src/lib/accounting/transactionNumberGenerator.ts#L79) — `loadFYStartMonth()` swallowed Firebase errors. **Fixed** this session: now logs `logger.warn` with error + fallback month.
- [bankStatementParser.ts:224](apps/web/src/lib/accounting/bankStatementParser.ts#L224), [bankStatementParser.ts:259](apps/web/src/lib/accounting/bankStatementParser.ts#L259) — `parseDate()` and `parseAmount()` return null / 0. **Deferred**: defensive parse helpers for arbitrary user-supplied bank statement formats; caller surfaces row-level errors. Add one-line `// defensive parse — caller aggregates row errors` comment before the `return` in a follow-up.
- [auditLogger.ts:498](apps/web/src/lib/accounting/auditLogger.ts#L498) — inner retry loop silently puts failed entries back on `failed[]` for next sync. **Deferred**: design is self-healing; entries persist across sessions. A post-loop warn with failure count would be an improvement.
- [auditLogger.ts:534](apps/web/src/lib/accounting/auditLogger.ts#L534) — `getPendingAuditLogCount()` JSON.parse returns 0. **Accept**: UI indicator falls back safely; corrupt localStorage is recoverable.
- [entity-ledger/page.tsx:107](apps/web/src/app/accounting/reports/entity-ledger/page.tsx#L107) — same FY start-month pattern as #1, UI copy. **Deferred**: no logger imported; comment documents the fallback.
- [invoices/page.tsx:107](apps/web/src/app/accounting/invoices/page.tsx#L107) — local `toDate()` helper returns null on parse failure. **Accept**: caller handles null. Belongs in a shared helper long-term (duplicate of `AssetDetailClient` pattern).
- [fixed-assets/[id]/AssetDetailClient.tsx:140](apps/web/src/app/accounting/fixed-assets/[id]/AssetDetailClient.tsx#L140) — "Silently fail on refresh". **Flag**: user-initiated refresh; should at least `console.warn` so a stuck asset page surfaces a real error. One-liner fix.

Agent initially flagged [auditLogger.ts:171/182](apps/web/src/lib/accounting/auditLogger.ts) and [procurementPaymentStatus.ts:165](functions/src/procurementPaymentStatus.ts#L165) — verified as false positives (both log via `logger.error`).

#### reference denorm

Gaps to address in a dedicated denorm pass (schema changes + backfill — not in this sweep's scope):

- **Invoice/Bill → Payment**: ~~`PaymentAllocation` missing `invoiceDate`, `dueDate`~~ **Fixed 2026-04-21**: added both as optional fields on `PaymentAllocation` ([transaction.ts:399-412](packages/types/src/transaction.ts#L399-L412)); 3 write sites populate them — customer-payment dialog ([useOutstandingInvoices.ts](apps/web/src/app/accounting/payments/components/customer-payment/useOutstandingInvoices.ts)), vendor-payment dialog ([RecordVendorPaymentDialog.tsx](apps/web/src/app/accounting/payments/components/RecordVendorPaymentDialog.tsx)), and the reconcile/auto-matcher helper ([paymentHelpers.ts](apps/web/src/lib/accounting/paymentHelpers.ts)). 88 payment/procurement tests still green.
- **PaymentBatch → created VENDOR_PAYMENT**: verified 2026-04-21 — `paymentBatchService` has create/submit/approve/reject/cancel flows, but **no execute path that creates VENDOR_PAYMENT transactions** from the approved batch. Nothing to denorm until that flow is built. When it lands, the new VENDOR_PAYMENT must carry `sourcePaymentBatchId` / `sourcePaymentBatchNumber` / `sourceBatchDate`.
- **GR → Bill**: ~~missing `goodsReceiptId`, `goodsReceiptNumber`, `matchNumber`, `vendorName`~~ **Fixed 2026-04-21**: `VendorBill` now carries `purchaseOrderId`, `goodsReceiptId`, `goodsReceiptNumber`, `matchNumber` as optional fields, and `entityName` (the existing BaseTransaction denorm slot) is populated from `match.vendorName`. All populated in [vendorBillIntegrationService.ts](apps/web/src/lib/accounting/vendorBillIntegrationService.ts) with conditional spreads. 14 bill-integration + 3-way-match tests still green.
- **Recurring → generated txn**: verified 2026-04-21 — `createOccurrence` writes the occurrence record with `recurringTransactionId` + `recurringTransactionName` (denorm present on occurrence), and `markOccurrenceGenerated` exists to back-link the actual transaction to the occurrence once posted. **But no caller invokes `markOccurrenceGenerated`** — the post-occurrence → real-transaction flow isn't implemented yet. When it lands, the created CUSTOMER_INVOICE / VENDOR_BILL / JOURNAL_ENTRY / SALARY_PAYMENT must also carry `sourceRecurringTransactionId` + `sourceRecurringTransactionNumber` so reports can filter without a reverse join.
- **ExpenseClaim → reimbursement**: when the reimbursement payment is created, no `sourceExpenseClaimId` / `claimantName` link-back.
- **FixedAsset → depreciation**: phase-2 todo in [fixedAssetService.ts:351-388](apps/web/src/lib/accounting/fixedAssetService.ts#L351-L388). When depreciation entries are posted, they must carry `sourceAssetId` + `sourceAssetNumber` + `sourceAssetName`.

#### labels

No accounting entries in `packages/constants/src/labels.ts` yet. Top drift candidates (opportunistic migration as components are touched):

- `"Draft" / "Pending Approval" / "Approved" / "Paid" / "Voided" / "Overdue"` — status chips and filter menus in [bills/page.tsx:554-559](apps/web/src/app/accounting/bills/page.tsx#L554-L559), invoices dropdown. Suggest `TRANSACTION_STATUS_LABELS` and `PAYMENT_STATUS_LABELS`.
- `"Vendor Bill" / "Customer Invoice"` — three recurring-txn files. `@vapour/constants` already exports `TRANSACTION_TYPE_LABELS` — migrate inline literals to use it.
- `"Bill Number" vs "Invoice Number"` — CSV export headers in [bills/page.tsx:368](apps/web/src/app/accounting/bills/page.tsx#L368) and [invoices/page.tsx:296](apps/web/src/app/accounting/invoices/page.tsx#L296). Should standardise — suggest keeping domain-specific terms but routing through constants.

#### completeness

UX pattern in accounting is **dialog-in-list** (single-page list with Create/View/Edit dialogs), _not_ multi-route. This is a deliberate design choice and differs from procurement (where per-module multi-route was needed for deep linking). No route 404s.

| Submodule        | Pattern            | List | Create | View        | Edit                 |
| ---------------- | ------------------ | ---- | ------ | ----------- | -------------------- |
| bills            | dialog-in-list     | ✅   | ✅     | ✅ (dialog) | ✅ (dialog)          |
| invoices         | dialog-in-list     | ✅   | ✅     | ✅ (dialog) | ✅ (dialog)          |
| payments         | dialog-in-list     | ✅   | ✅     | ✅ (dialog) | ✅ (dialog)          |
| journal-entries  | dialog-in-list     | ✅   | ✅     | ✅ (dialog) | ✅ (dialog)          |
| fixed-assets     | multi-route        | ✅   | ✅     | ✅          | ✅                   |
| payment-batches  | mixed (view-route) | ✅   | ✅     | ✅          | ❌ (dialog)          |
| payment-planning | dialog-in-list     | ✅   | ✅     | ✅ (dialog) | ✅ (dialog)          |
| recurring        | multi-route        | ✅   | ✅     | ✅          | ❌ (edit via dialog) |

Composite indexes: all existing `where + orderBy` queries in accounting services have matching indexes in `firestore.indexes.json`. No missing indexes detected.

**Soft rec**: bills / invoices / payments are strong candidates for deep-linkable view routes (`/accounting/bills/[id]`) when there's a need to share links to specific transactions (auditor review, approval request emails). Not urgent.

#### shipped

- `transactionNumberGenerator.ts` — `loadFYStartMonth` now logs warn on Firebase failure.

### hr

**Swept**: 2026-04-20 by sekkizhar (via explore agents)
**Files audited**: 12 services in `apps/web/src/lib/hr/{employees,leaves,onDuty,travelExpenses,holidays}/`, `apps/web/src/lib/tasks/timeEntryService.ts`, HR pages in `apps/web/src/app/hr/`, types in `packages/types/src/hr/`, Cloud Function triggers in `functions/src/hr/`.

#### undefined leaks

Clean. ESLint rule holds. No local `removeUndefinedDeep` duplicates in HR services.

#### silent catches

Clean. All catches log via `logger.error` / `logger.warn` before throwing or returning a fallback. Verified samples: [leaveRequestService.ts:227-235](apps/web/src/lib/hr/leaves/leaveRequestService.ts#L227-L235), [pdfMergeUtils.ts:90-92](apps/web/src/lib/hr/travelExpenses/pdfMergeUtils.ts#L90-L92), [timeEntryService.ts:91-94](apps/web/src/lib/tasks/timeEntryService.ts#L91-L94), [leaveBalanceReset.ts:182](functions/src/hr/leaveBalanceReset.ts#L182).

#### reference denorm

- **Employee → LeaveRequest**: ~~`department?` on the type but not written at creation~~ **Fixed 2026-04-21**: local `CreateLeaveRequestInput` now accepts `department`; `createLeaveRequest` writes it with a conditional spread; UI caller (`hr/leaves/new/page.tsx`) passes `claims?.department`. 17 leave-service tests still green.
- **Employee → TravelExpense**: complete ✅ — stores `employeeId`, `employeeName`, `department`, `projectId`, `projectName` at create.
- **Employee → OnDutyRequest**: complete ✅ — stores `userId`, `userName`, `userEmail`, `department`.
- **Project → TimeEntry**: TimeEntry ([packages/types/src/task.ts:184-209](packages/types/src/task.ts#L184-L209)) has only `userId` + `taskNotificationId`; no `projectId`/`projectNumber`/`projectName`. Link is transitive through the task notification. **Accept for now**: user has previously signalled time tracking is low-priority; denorm can wait until a project-level time report is actually built.

#### labels

No HR entries in `packages/constants/src/labels.ts`. Drift candidates (opportunistic migration):

- Status chips `"Drafts"`, `"Pending"`, `"Approved"`, `"Rejected"`, `"Cancelled"` — appear inline across [travel-expenses/page.tsx:114-115](apps/web/src/app/hr/travel-expenses/page.tsx#L114), [on-duty/my-requests/page.tsx:48-53](apps/web/src/app/hr/on-duty/my-requests/page.tsx#L48-L53), [on-duty/[id]/OnDutyDetailClient.tsx:63-68](apps/web/src/app/hr/on-duty/[id]/OnDutyDetailClient.tsx#L63-L68), [leaves/[id]/LeaveDetailClient.tsx:451](apps/web/src/app/hr/leaves/[id]/LeaveDetailClient.tsx#L451). Suggest `LEAVE_STATUS_LABELS`, `ON_DUTY_STATUS_LABELS`, `TRAVEL_EXPENSE_STATUS_LABELS`.
- Duplicate local status objects (OnDuty has one in `my-requests/page.tsx` and another in `OnDutyDetailClient.tsx`) — consolidate first.

#### completeness

| Submodule       | Pattern        | List                | Create               | View        | Edit                |
| --------------- | -------------- | ------------------- | -------------------- | ----------- | ------------------- |
| employees       | multi-route    | ✅                  | ❌ **no /new route** | ✅          | ✅ (dialog in [id]) |
| leaves          | multi-route    | ✅                  | ✅                   | ✅          | ✅                  |
| leave-calendar  | calendar view  | ✅                  | N/A                  | N/A         | N/A                 |
| my-leaves       | personal list  | ✅                  | N/A                  | ✅ via [id] | N/A                 |
| travel-expenses | multi-route    | ✅                  | ✅                   | ✅          | ✅                  |
| on-duty         | partial        | ❌ **no /page.tsx** | ✅                   | ✅          | ✅ (dialog)         |
| on-duty/my-req  | personal list  | ✅                  | N/A                  | ✅ via [id] | N/A                 |
| holidays        | dialog-in-list | ✅                  | ✅                   | N/A         | ✅ (dialog)         |
| time-tracking   | library-only   | N/A                 | N/A                  | N/A         | N/A                 |

**Flags**:

- `/hr/employees/new` missing. Employee creation appears to be admin-gated but no visible entry point from HR dashboard. Confirm with user — is this intentional (create via Admin/Users only) or should HR get a proper flow?
- `/hr/on-duty/page.tsx` missing. Only a per-user `/my-requests` view exists. HR managers can't see a team-wide on-duty list.

Composite indexes: verified for `leaveRequestService` (`userId+status+endDate+orderBy(startDate)`), `travelExpenseService` (`tenantId+employeeId+status+tripStartDate+orderBy(createdAt)` and `status+approverIds+orderBy(submittedAt)`), `onDutyRequestService`. All matching indexes present in `firestore.indexes.json`.

#### shipped

- **2026-04-21**: Employee → LeaveRequest `department` denorm (see above). Single-session, low-risk; pattern mirrors `travelExpenseService`.

---

### projects

**Swept**: 2026-04-20 by sekkizhar (via explore agents)
**Files audited**: `apps/web/src/lib/{projects,proposals,bom}/**/*.ts` (~18 service files), `apps/web/src/app/{projects,proposals}/**/*.tsx`, types in `packages/types/src/{project*,proposal*,bom}.ts`, related Cloud Functions.

#### undefined leaks

- [proposalService.ts:478-500](apps/web/src/lib/proposals/proposalService.ts) — local `stripUndefinedDeep` copy (flagged on tracker). **Fixed this session**: migrated to the shared `removeUndefinedDeep` helper. Same recursive semantics, Timestamp-preserving.

No other local duplicates in projects / bom. BOM service uses correct filtering pattern at [bomService.ts:192-195](apps/web/src/lib/bom/bomService.ts#L192-L195); charter procurement uses shared helper at [charterProcurementService.ts:10](apps/web/src/lib/projects/charterProcurementService.ts#L10).

#### silent catches

Clean. All catches log and throw / return typed fallback with rationale. Verified: [charterProcurementService.ts:73](apps/web/src/lib/projects/charterProcurementService.ts#L73), [projectService.ts:49](apps/web/src/lib/projects/projectService.ts#L49), [approvalWorkflow.ts:93](apps/web/src/lib/proposals/approvalWorkflow.ts#L93), [bomCalculations.ts:126](apps/web/src/lib/bom/bomCalculations.ts#L126), [bomService.ts:71](apps/web/src/lib/bom/bomService.ts#L71).

#### reference denorm

- **Project → Proposal**: ✅ proposal stores `enquiryId`, `enquiryNumber`, `clientId`, `clientName`, `clientContactPerson`, `clientEmail` at create ([proposalService.ts:131-167](apps/web/src/lib/proposals/proposalService.ts#L131-L167)).
- **Project → BOM**: ✅ BOM stores `projectId`, `projectName`, `proposalId`, `proposalNumber`, `enquiryId`, `enquiryNumber` ([bomService.ts:164-170](apps/web/src/lib/bom/bomService.ts#L164-L170)).
- **Proposal → Revision**: 🟡 new revision inherits fields via copy ([proposalService.ts:566-585](apps/web/src/lib/proposals/proposalService.ts#L566-L585)) — `proposalNumber` is carried implicitly but not explicit in the payload. Low-risk but makes the intent less clear. Consider explicit spread at revision-creation.
- **BOM → PR**: verified 2026-04-21 — there is no direct BOM → PR flow in the codebase. Charter `ProcurementItem`s are entered manually via `ProcurementTab.tsx` and carry no `bomId` reference; `createPRFromCharterItem` copies charter-item fields onto the PR. If an auto-generate "PR from BOM" flow is added later, the new PR + items must carry `bomId` + `bomCode` at write time (rule 26).
- **Charter Item → PR**: ✅ carries project refs.

#### labels

No `PROPOSAL_STATUS_LABELS` / `PROJECT_STATUS_LABELS` in `packages/constants/src/labels.ts`. Drift:

- `'Draft' / 'DRAFT'` — spread across [StatusBadge.tsx:17](apps/web/src/app/proposals/[id]/components/StatusBadge.tsx#L17), [proposals/list/page.tsx:50](apps/web/src/app/proposals/list/page.tsx#L50), [ProposalDetailClient.tsx:797](apps/web/src/app/proposals/[id]/ProposalDetailClient.tsx#L797), [MasterDocumentListTab.tsx:105](apps/web/src/app/projects/[id]/documents/components/MasterDocumentListTab.tsx#L105).
- `'Pending Approval'`, `'Approved'`, `'Rejected'` — generic approval statuses across proposal workflow UI.
- PR status `'DRAFT'` in [charterProcurementService.ts:227](apps/web/src/lib/projects/charterProcurementService.ts#L227) should align with the existing `PR_STATUS_CATEGORY_LABELS` already in `@vapour/constants`.

BOM categories (`'Equipment'`, `'Material'`, `'Service'`, `'Bought Out'`) and project phase labels are already in enum constants — no drift there. ✅

#### completeness

| Submodule | Pattern         | List                      | Create                  | View                 | Edit                       |
| --------- | --------------- | ------------------------- | ----------------------- | -------------------- | -------------------------- |
| projects  | multi-route     | ✅ `/projects/list`       | ✅                      | ✅ `/projects/[id]`  | ✅ inline/dialog           |
| charter   | nested tab      | ✅                        | ✅                      | ✅                   | ✅ (dialog)                |
| proposals | multi-route     | ✅ `/proposals/list`      | ✅ dialog               | ✅ `/proposals/[id]` | ✅ `/proposals/[id]/scope` |
| revisions | inline          | ✅ version list           | ✅ button               | ✅ inline            | inherited                  |
| templates | multi-route     | ✅ `/proposals/templates` | ✅                      | ✅                   | N/A (Phase 2)              |
| BOMs      | **inline-only** | ❌ no dedicated list      | only inline in proposal | only inline          | only inline                |

**Flag**: BOM has no standalone UI routes. BOMs are only managed inline inside the proposal scope editor. If the user ever needs "show me all BOMs for project X" or "export BOM by BOM number across proposals", the current UX can't do it. Confirm with user whether this is intentional or an outstanding Phase 2 item.

Composite indexes: all where+orderBy queries in projects, proposals, boms have matching indexes in `firestore.indexes.json`. No gaps.

#### shipped

- [proposalService.ts](apps/web/src/lib/proposals/proposalService.ts) — migrated `stripUndefinedDeep` local copy to shared `removeUndefinedDeep` from `lib/firebase/typeHelpers`. Removes ~28 lines of duplication. Same Timestamp-preserving semantics.

---

### documents

**Swept**: 2026-04-21 by sekkizhar (via explore agent)
**Files audited**: 22 services in `apps/web/src/lib/documents/`, project-nested views under `apps/web/src/app/projects/[id]/documents/` and `/documents/`.

#### undefined leaks

Clean. Conditional spreads applied throughout ([transmittalService.ts:101-108](apps/web/src/lib/documents/transmittalService.ts#L101-L108), [commentService.ts:88-146](apps/web/src/lib/documents/commentService.ts#L88-L146), [workItemService.ts:94-96](apps/web/src/lib/documents/workItemService.ts#L94-L96)). No local `removeUndefinedDeep` copies.

#### silent catches

Clean. All catches log via `logger.error` before throwing; `transmittalZipService.ts:113-119` logs `console.warn` with context before returning null (graceful fetch failure).

#### reference denorm

**Fixed 2026-04-21** (partial pass):

- **DocumentSubmission**: now also carries `projectCode` (from `MasterDocumentEntry`) when a submission is created. `projectName` deferred (needs project fetch).
- **DocumentComment**: now carries `documentNumber` + `documentTitle` (caller passes). `submissionDate` + `submitterName` deferred — `latestSubmissionId` is in scope on the UI but the full submission isn't; revisit when submission fetch is consolidated.
- **WorkItem**: now carries `documentTitle`.
- **SupplyItem**: now carries `documentTitle`.

All fields added as **optional** on the types for backward compat with existing Firestore docs; new writes populate them. A backfill script is the cleaner long-term fix — not needed until a dashboard feature actually depends on the fields for historical rows.

**Still open**:

- **Transmittal → doc refs**: transmittal stores just `documentIds: string[]`. The `TransmittalDocumentEntry` type is fully denormalised but is only constructed at PDF/ZIP render time. Embedding `TransmittalDocumentEntry[]` on the transmittal doc at create time would avoid per-document fetches in `transmittalPdfService.ts` + `transmittalZipService.ts`. Touches read path — dedicated follow-up.
- **DocumentLink `status` sync**: the type has `status` already (I was wrong in the earlier sweep). What's missing is a _sync_ strategy — `status` on the link snapshot goes stale when the linked document's status changes. Needs a Cloud Function trigger, not a one-shot write change.

#### labels

No documents entries in `@vapour/constants/labels.ts`. Drift candidates — best addressed together since labels appear across many files:

- Master document status (8 values: `DRAFT`, `IN_PROGRESS`, `SUBMITTED`, `UNDER_REVIEW`, `APPROVED`, `ACCEPTED`, `ON_HOLD`, `CANCELLED`) — scattered across dialogs, tables, chips.
- Comment status (4) + severity (4) + category (7) — mostly in service case statements.
- Submission status (6) — in submission workflow.
- Transmittal status (4), work-item status (3), supply-item status (6).
- Delivery method (`HARD_COPY`, `SOFT_COPY`, `BOTH`), file types (`NATIVE`, `PDF`, `SUPPORTING`).

Suggest: `DOCUMENT_STATUS_LABELS`, `COMMENT_STATUS_LABELS`, `COMMENT_SEVERITY_LABELS`, `COMMENT_CATEGORY_LABELS`, `SUBMISSION_STATUS_LABELS`, `TRANSMITTAL_STATUS_LABELS`, `WORK_ITEM_STATUS_LABELS`, `SUPPLY_ITEM_STATUS_LABELS` in a single PR.

#### completeness

| Area                         | Pattern        | List         | Create        | View | Edit                        |
| ---------------------------- | -------------- | ------------ | ------------- | ---- | --------------------------- |
| Master Documents             | multi-route    | ✅           | ✅ dialog     | ✅   | ✅ inline dialog            |
| Submissions                  | dialog-in-list | ✅ (tab)     | ✅            | ✅   | ❌ no edit (design choice)  |
| Transmittals                 | multi-route    | ✅           | ✅ multi-step | ✅   | ❌ read-only post-send (ok) |
| Comments                     | inline         | ✅           | ✅            | ✅   | ✅ resolution inline        |
| Work Items                   | inline         | ✅ (per doc) | ✅            | ✅   | ✅ status dropdown          |
| Supply Items                 | inline         | ✅ (per doc) | ✅            | ✅   | ✅                          |
| CRT / CRS / Approval letters | upload-only    | ✅           | ✅            | ✅   | ❌                          |

Soft flags:

- **No org-wide Work Item / Supply Item list**: useful for a PM who wants "all pending work for project X"; currently visible only inside each document.
- **CRS reupload UX**: no way to replace a submitted comment resolution sheet — must delete and re-upload.

Composite indexes: all `where + orderBy` queries have matching indexes (`masterDocuments`, `documentComments`, `documentSubmissions`). No gaps.

#### shipped

- **2026-04-21 denorm pass** (partial): `documentTitle` added to `WorkItem` and `SupplyItem`; `documentNumber` + `documentTitle` added to `DocumentComment`; `projectCode` added to `DocumentSubmission`. All fields optional on the types for backward compat. Callers (`DocumentWorkList`, `DocumentSupplyList`, `DocumentComments`) updated to pass the new fields. 4 of 6 originally-flagged gaps closed; transmittal embed + DocumentLink status sync remain as separate follow-ups (see notes above).

---

### enquiries

**Swept**: 2026-04-21 by sekkizhar
**Files audited**: enquiry routes under `apps/web/src/app/proposals/enquiries/**`, enquiry-touching logic in [proposalService.ts](apps/web/src/lib/proposals/proposalService.ts).

Clean on undefined + silent-catch. Enquiry → Proposal denorm is complete (proposal carries `enquiryId`, `enquiryNumber`, client refs). Enquiry `bidDecision` data isn't copied onto proposal — acceptable; enquiry stays the source.

Labels drift: enquiry status values (`'NEW'`, `'PROPOSAL_IN_PROGRESS'`, `'PROPOSAL_REJECTED'`) are inline. Suggest `ENQUIRY_STATUS_LABELS`.

Completeness: list / `[id]` / `[id]/edit` routes all present. No 404s. Composite indexes ok.

---

### materials

**Swept**: 2026-04-21 by sekkizhar
**Files audited**: 10 files in `apps/web/src/lib/materials/`, 10+ routes under `apps/web/src/app/materials/**`.

Clean on undefined + silent-catch. Variants are nested inside Material docs (not separate collection) so denorm doesn't apply. `VendorOffer` creation should be verified to carry `materialCode` + `materialName` at write — not re-verified here, deferred.

Labels drift: availability labels in [variantUtils.ts:97-104](apps/web/src/lib/materials/variantUtils.ts#L97-L104) are hardcoded strings — move to constants. `MaterialCategory` enum is already imported from `@vapour/types` ✅.

Completeness: full hub + 10 per-category lists + new / edit / detail routes. Composite indexes ok.

---

### thermal (calculators)

**Swept**: 2026-04-21 by sekkizhar
**Files audited**: ~30 calculator files in `apps/web/src/lib/thermal/med/` + `medBOMGenerator.ts`.

N/A for undefined leaks and denorm — no Firestore persistence (client-side calculations only).

Silent catches: all empty catches in MED designer / engine / BOM generator are **intentionally documented** (e.g., "Bundle geometry refinement failed", "TVC failed — use plain steam", "Material not found in database", "Weight estimation is non-critical"). Verified: [designPipeline.ts:459,583,601,609](apps/web/src/lib/thermal/med/designPipeline.ts), [medEngine.ts:871](apps/web/src/lib/thermal/med/medEngine.ts#L871), [costEstimation.ts:54](apps/web/src/lib/thermal/med/costEstimation.ts#L54), [equipmentSizing.ts:401](apps/web/src/lib/thermal/med/equipmentSizing.ts#L401), [medBOMGenerator.ts:1079](apps/web/src/lib/thermal/medBOMGenerator.ts#L1079). All meet CLAUDE.md rule 27's "documented reason" clause.

Labels / completeness: library-only; no UI routes — correct by design. ✅ clean.

---

### flow (tasks + meetings)

**Swept**: 2026-04-21 by sekkizhar
**Files audited**: 6 services in `apps/web/src/lib/tasks/`, 6 pages under `apps/web/src/app/flow/`.

Clean on undefined + silent-catch. All 20+ catches in `taskNotificationService.ts` and `channelService.ts` log before throwing or returning fallback.

Reference denorm:

- **Meeting → ManualTask**: ~~task stores `meetingId` only~~ **Fixed 2026-04-21**: tasks generated by `finalizeMeeting` now carry `meetingTitle` + `meetingDate` from the source meeting. Type additions in [packages/types/src/task.ts](packages/types/src/task.ts); write-site in [meetingService.ts:436-438](apps/web/src/lib/tasks/meetingService.ts#L436-L438). Old tasks will lack these fields — acceptable, the UI can gracefully render "(Meeting)" when missing until a backfill runs.
- **TaskNotification → TimeEntry**: already flagged (and accepted) in HR sweep.
- Task → Comment / Thread: thread is the intermediate parent; no extra denorm needed.

Labels drift: meeting status `'draft'`, `'finalized'` and task priority `Low/Medium/High/Urgent` hardcoded in UI. Suggest `MEETING_STATUS_LABELS`, `MANUAL_TASK_PRIORITY_LABELS`.

Completeness: hub + tasks + inbox + team + meetings + meeting-detail + meeting-new all routed. Indexes ok.

---

### feedback

**Swept**: 2026-04-21 by sekkizhar
**Files audited**: 2 services in `apps/web/src/lib/feedback/`, 2 routes under `apps/web/src/app/feedback/`.

Clean on undefined + silent-catch. Feedback → Task denorm complete: resolution task carries `entityId`, `entityType`, `feedbackTitle`, `reporterName`, `resolvedByName` ([feedbackTaskService.ts:71-72](apps/web/src/lib/feedback/feedbackTaskService.ts#L71-L72)).

Labels drift: feedback type (`'bug'`, `'feature'`, `'general'`) and status (`'new'`, `'in_progress'`, `'resolved'`, `'closed'`, `'wont_fix'`) — consider `FEEDBACK_TYPE_LABELS`, `FEEDBACK_STATUS_LABELS`.

Completeness: `/feedback` (form + list), `/feedback/[id]` (detail). No separate `/feedback/new` route — form lives on main page (acceptable for this low-volume flow). No user-facing admin dashboard — admin lives under `/admin/feedback`.

---

### auth / users

**Swept**: 2026-04-21 by sekkizhar
**Files audited**: `apps/web/src/lib/auth/`, `apps/web/src/contexts/AuthContext.tsx`, `apps/web/src/app/admin/users/**`, Cloud Function auth triggers.

Clean across all five checks. No persistence from the auth service beyond user-bound data; permission flags read through `PERMISSION_FLAGS` / `PERMISSION_FLAGS_2` constants (no inline literals). `AuthorizationError` thrown for missing users; no silent paths. `/admin/users` route present for user management. ✅

---

### entities

**Swept**: 2026-04-21 by sekkizhar
**Files audited**: `apps/web/src/lib/entities/businessEntityService.ts`, admin routes.

Clean on undefined + silent-catch. No parent-child — entities are themselves master data. Entity roles (`VENDOR`, `CUSTOMER`, `SUPPLIER`) come from type definitions; consider surfacing `ENTITY_ROLE_LABELS` for consistency.

Completeness flag: no dedicated `/admin/entities` list in the routes audited. If an entity master list / edit UX exists, it may be embedded inside another admin page — worth confirming with the user. If none exists, this is an outstanding admin feature.
