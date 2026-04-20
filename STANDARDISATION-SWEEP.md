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

| Module                              | undefined | silent catch | ref denorm | labels | completeness | status  | notes                                               |
| ----------------------------------- | --------- | ------------ | ---------- | ------ | ------------ | ------- | --------------------------------------------------- |
| procurement                         | ✅        | ✅           | ✅         | 🟡     | ✅           | ✅ done | april review, session 2026-04-20                    |
| accounting (bills)                  | ⬜        | ⬜           | ⬜         | ⬜     | ⬜           | ⬜      | highest priority — many writes, dual-entry money    |
| accounting (invoices)               | ⬜        | ⬜           | ⬜         | ⬜     | ⬜           | ⬜      |                                                     |
| accounting (payments)               | ⬜        | ⬜           | ⬜         | ⬜     | ⬜           | ⬜      | PaymentAllocation structure — carries parent refs?  |
| accounting (journal entries)        | ⬜        | ⬜           | ⬜         | ⬜     | ⬜           | ⬜      |                                                     |
| accounting (bank transfers)         | ⬜        | ⬜           | ⬜         | ⬜     | ⬜           | ⬜      |                                                     |
| accounting (expense claims)         | ⬜        | ⬜           | ⬜         | ⬜     | ⬜           | ⬜      |                                                     |
| accounting (fixed assets)           | ⬜        | ⬜           | ⬜         | ⬜     | ⬜           | ⬜      |                                                     |
| accounting (payment batches)        | ⬜        | ⬜           | ⬜         | ⬜     | ⬜           | ⬜      |                                                     |
| accounting (payment planning)       | ⬜        | ⬜           | ⬜         | ⬜     | ⬜           | ⬜      |                                                     |
| accounting (recurring transactions) | ⬜        | ⬜           | ⬜         | ⬜     | ⬜           | ⬜      |                                                     |
| hr (employees)                      | ⬜        | ⬜           | ⬜         | ⬜     | ⬜           | ⬜      |                                                     |
| hr (leave)                          | ⬜        | ⬜           | ⬜         | ⬜     | ⬜           | ⬜      |                                                     |
| hr (travel expenses)                | ⬜        | ⬜           | ⬜         | ⬜     | ⬜           | ⬜      |                                                     |
| hr (time tracking)                  | ⬜        | ⬜           | ⬜         | ⬜     | ⬜           | ⬜      | time_entries allowlisted in tenant check            |
| hr (on-duty records)                | ⬜        | ⬜           | ⬜         | ⬜     | ⬜           | ⬜      |                                                     |
| projects (core)                     | ⬜        | ⬜           | ⬜         | ⬜     | ⬜           | ⬜      |                                                     |
| projects (proposals)                | ⬜        | ⬜           | ⬜         | ⬜     | ⬜           | ⬜      | `stripUndefinedDeep` local copy — migrate to shared |
| projects (BOMs)                     | ⬜        | ⬜           | ⬜         | ⬜     | ⬜           | ⬜      | cost estimation, materials linkage                  |
| projects (cost configurations)      | ⬜        | ⬜           | ⬜         | ⬜     | ⬜           | ⬜      |                                                     |
| documents                           | ⬜        | ⬜           | ⬜         | ⬜     | ⬜           | ⬜      | document submissions, revisions, transmittals       |
| enquiries                           | ⬜        | ⬜           | ⬜         | ⬜     | ⬜           | ⬜      |                                                     |
| materials                           | ⬜        | ⬜           | ⬜         | ⬜     | ⬜           | ⬜      | shared reference data — writes via admin            |
| thermal (calculators)               | ⬜        | ⬜           | ⬜         | ⬜     | ⬜           | ⬜      | client-side only; some intentional empty catches    |
| flow (tasks + meetings)             | ⬜        | ⬜           | ⬜         | ⬜     | ⬜           | ⬜      |                                                     |
| feedback                            | ⬜        | ⬜           | ⬜         | ⬜     | ⬜           | ⬜      |                                                     |
| auth / users                        | ⬜        | ⬜           | ⬜         | ⬜     | ⬜           | ⬜      | users carry tenantId via claims                     |
| entities                            | ⬜        | ⬜           | ⬜         | ⬜     | ⬜           | ⬜      | vendor / customer master                            |

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

_Modules sweep entries go here as they are done._
