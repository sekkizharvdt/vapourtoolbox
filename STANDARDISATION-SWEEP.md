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

| Module                              | undefined | silent catch | ref denorm | labels | completeness | status  | notes                                                       |
| ----------------------------------- | --------- | ------------ | ---------- | ------ | ------------ | ------- | ----------------------------------------------------------- |
| procurement                         | ✅        | ✅           | ✅         | 🟡     | ✅           | ✅ done | april review, session 2026-04-20                            |
| accounting (bills)                  | ✅        | 🟡           | 🟡         | 🟡     | 🟡           | 🟡      | see findings 2026-04-20                                     |
| accounting (invoices)               | ✅        | 🟡           | 🟡         | 🟡     | 🟡           | 🟡      | see findings 2026-04-20                                     |
| accounting (payments)               | ✅        | ✅           | 🟡         | 🟡     | 🟡           | 🟡      | PaymentAllocation missing invoiceDate/dueDate               |
| accounting (journal entries)        | ✅        | ✅           | ✅         | 🟡     | 🟡           | 🟡      | dialog-only pattern                                         |
| accounting (bank transfers)         | ✅        | 🟡           | ✅         | 🟡     | 🟡           | 🟡      | parser has defensive empty catches (documented)             |
| accounting (expense claims)         | ✅        | ✅           | 🟡         | 🟡     | 🟡           | 🟡      | reimbursement payment lacks source claim ref                |
| accounting (fixed assets)           | ✅        | 🟡           | ⬜         | 🟡     | ✅           | 🟡      | depreciation not yet implemented (Phase 2)                  |
| accounting (payment batches)        | ✅        | ✅           | 🟡         | 🟡     | 🟡           | 🟡      | BatchPayment lacks sourcePaymentBatchId on created payments |
| accounting (payment planning)       | ✅        | ✅           | ✅         | 🟡     | 🟡           | 🟡      |                                                             |
| accounting (recurring transactions) | ✅        | ✅           | 🟡         | 🟡     | 🟡           | 🟡      | generated txns lack sourceRecurringTransactionId            |
| hr (employees)                      | ⬜        | ⬜           | ⬜         | ⬜     | ⬜           | ⬜      |                                                             |
| hr (leave)                          | ⬜        | ⬜           | ⬜         | ⬜     | ⬜           | ⬜      |                                                             |
| hr (travel expenses)                | ⬜        | ⬜           | ⬜         | ⬜     | ⬜           | ⬜      |                                                             |
| hr (time tracking)                  | ⬜        | ⬜           | ⬜         | ⬜     | ⬜           | ⬜      | time_entries allowlisted in tenant check                    |
| hr (on-duty records)                | ⬜        | ⬜           | ⬜         | ⬜     | ⬜           | ⬜      |                                                             |
| projects (core)                     | ⬜        | ⬜           | ⬜         | ⬜     | ⬜           | ⬜      |                                                             |
| projects (proposals)                | ⬜        | ⬜           | ⬜         | ⬜     | ⬜           | ⬜      | `stripUndefinedDeep` local copy — migrate to shared         |
| projects (BOMs)                     | ⬜        | ⬜           | ⬜         | ⬜     | ⬜           | ⬜      | cost estimation, materials linkage                          |
| projects (cost configurations)      | ⬜        | ⬜           | ⬜         | ⬜     | ⬜           | ⬜      |                                                             |
| documents                           | ⬜        | ⬜           | ⬜         | ⬜     | ⬜           | ⬜      | document submissions, revisions, transmittals               |
| enquiries                           | ⬜        | ⬜           | ⬜         | ⬜     | ⬜           | ⬜      |                                                             |
| materials                           | ⬜        | ⬜           | ⬜         | ⬜     | ⬜           | ⬜      | shared reference data — writes via admin                    |
| thermal (calculators)               | ⬜        | ⬜           | ⬜         | ⬜     | ⬜           | ⬜      | client-side only; some intentional empty catches            |
| flow (tasks + meetings)             | ⬜        | ⬜           | ⬜         | ⬜     | ⬜           | ⬜      |                                                             |
| feedback                            | ⬜        | ⬜           | ⬜         | ⬜     | ⬜           | ⬜      |                                                             |
| auth / users                        | ⬜        | ⬜           | ⬜         | ⬜     | ⬜           | ⬜      | users carry tenantId via claims                             |
| entities                            | ⬜        | ⬜           | ⬜         | ⬜     | ⬜           | ⬜      | vendor / customer master                                    |

**Priority order (recommended)**: accounting → hr → projects → documents → everything else. Accounting is the highest-risk because it's double-entry and the `undefined` class of bugs there can corrupt the GL silently.

---

## Open standardisation items (not started, deliberately deferred)

1. **UI-layer `|| undefined` retrofit** (~200 sites). Rule is scoped to `lib/**` for now. Dedicated refactor session — touch files one module at a time and migrate to conditional spreads, then broaden the ESLint rule.
2. **Form-from-schema pattern** (react-hook-form + zod). Not started. Best introduced on the next new create page as a reference implementation, then migrate existing forms opportunistically.
3. **Playwright smoke test per Create flow**. Playwright is configured (`apps/web/e2e/`); procurement doesn't have a dedicated create-flow suite yet. Two-hour slot — covers "New button goes somewhere valid" and "Create → View round-trip" per module.
4. **Quarterly domain review cadence**. Process, not code. Calendar reminder per module lead.
5. **Migrate remaining `stripUndefinedDeep` / `removeUndefinedValues` local copies** to the shared `removeUndefinedDeep` helper. Known sites: `lib/proposals/proposalService.ts`.
6. **Label migration** from inline strings to `@vapour/constants/labels.ts`. Do as components are touched, not one-shot.

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

- **Invoice/Bill → Payment**: `PaymentAllocation` in [packages/types/src/transaction.ts:399-405](packages/types/src/transaction.ts#L399-L405) carries `invoiceNumber` but is missing `invoiceDate`, `dueDate`. Payment UI must re-fetch each invoice to compute aging.
- **PaymentBatch → created VENDOR_PAYMENT**: `BatchPayment` in [packages/types/src/paymentBatch.ts:108-163](packages/types/src/paymentBatch.ts#L108-L163) has `linkedReference` but no `sourcePaymentBatchId` / `sourcePaymentBatchNumber` / `sourceBatchDate` on the child payment. Reverse-lookup required to trace batch origin. (Note: batch execution that creates payments may not be implemented yet — verify before adding.)
- **GR → Bill**: [vendorBillIntegrationService.ts:118-128](apps/web/src/lib/accounting/vendorBillIntegrationService.ts#L118-L128) writes `sourceDocumentId` + `sourcePoNumber` but misses `goodsReceiptId`, `goodsReceiptNumber`, `matchNumber`, `vendorName`. Bill-side GR lookup requires match fetch.
- **Recurring → generated txn**: [recurringTransactionService.ts:46-114](apps/web/src/lib/accounting/recurringTransactionService.ts#L46-L114) doesn't write `sourceRecurringTransactionId` / `sourceRecurringTransactionNumber` onto the generated child. "Is this txn from a template?" requires joining `recurringTransactions` by search.
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
