# CLAUDE.md rule violations — punch list

**Date opened:** 2026-04-26
**Baseline snapshot:** [reports/rule-check-2026-04-26.md](reports/rule-check-2026-04-26.md)
**Goal:** close the existing-violation backlog so the agent-readiness rule suite (`pnpm check-rules`) can be flipped from advisory to enforcing in pre-commit and CI.

---

## How to work this list

- **Source of truth for counts:** `pnpm check-rules` (live) or the dated snapshot in `reports/`. This doc carries narrative — it does not try to keep counts current.
- **Source of truth for fixes:** the rule definitions in [CLAUDE.md](CLAUDE.md) (numbered #1–#29).
- **Workflow:** pick a rule from the sequencing plan → close batch of violations → `pnpm check-rules --only=<N>` to verify → re-snapshot if you want to record progress (`pnpm check-rules:snapshot`).
- **When a rule's count hits 0:** drop `--advisory` from its invocation (or wire a per-rule enforcement gate; see "Switching from advisory to enforce" at the bottom).

---

## Summary table (baseline 2026-04-26)

| Rule                                              | Count | Status      | Priority | Notes                                                                                                                |
| ------------------------------------------------- | ----- | ----------- | -------- | -------------------------------------------------------------------------------------------------------------------- |
| #3 — soft-delete query                            | 0     | ✅ enforce  | —        | Already clean                                                                                                        |
| #4 — collections need security rules              | 0     | ✅ closed   | —        | Closed 2026-04-26 — see [reports/rule-check-2026-04-26-after-rule4.md](reports/rule-check-2026-04-26-after-rule4.md) |
| #5 — writes need `requirePermission`              | 254   | ⚠️ advisory | **P1**   | Largest backlog; security perimeter                                                                                  |
| #6 — approve/reject needs `preventSelfApproval`   | 17    | ⚠️ advisory | **P0**   | Concentrated in named functions; small fix per                                                                       |
| #7 — no hardcoded permission flags                | 0     | ✅ enforce  | —        | Already clean                                                                                                        |
| #8 — status changes need `requireValidTransition` | 105   | ⚠️ advisory | **P1**   | Workflow safety                                                                                                      |
| #17 — state machines live in `stateMachines.ts`   | 0     | ✅ enforce  | —        | Already clean                                                                                                        |
| #18 — sensitive ops need an audit-log call        | 35    | ⚠️ advisory | **P1**   | Forensics for agent runs                                                                                             |
| #19 — read+write needs `runTransaction`           | 87    | ⚠️ advisory | **P2**   | Includes false positives — triage required                                                                           |
| #20 — batch ops in loops need 500-op chunking     | 21    | ⚠️ advisory | **P2**   | Manual review per call site                                                                                          |
| #21 — no fallback chains on amount fields         | 107   | ⚠️ advisory | **P1**   | Money correctness; many display-only false positives                                                                 |
| #24 — TransactionType switches exhaustive         | 0     | ✅ enforce  | —        | TS `noFallthroughCasesInSwitch` covers it                                                                            |
| #28 — modules need List + New + View + Edit       | 20    | ⚠️ advisory | **P2**   | UI completeness; some are terminal-doc false positives                                                               |

**Grand total:** 646 violations across 7 active rules. (Baseline 668; rule #4 closed 2026-04-26.)

---

## Rule #4 — Collections referenced in code need `firestore.rules` entries ✅ CLOSED 2026-04-26

**What it means:** every Firestore collection a service writes to must have a corresponding `match /<name>/{...} { allow … }` block in `firestore.rules` matching the permission model. Without it, security is whatever the catch-all permits.

**Status:** **closed 2026-04-26.** All 22 collections now have rules. See the new section in `firestore.rules` titled "Rule #4 cleanup — collections added 2026-04-26" (just before the catch-all).

**Resolution summary:**

- 7 accounting collections (`fiscalYears`, `interprojectLoans`, `yearEndClosingEntries`, `bankStatements`, `bankTransactions`, `reconciliationMatches`, `reconciliationReports`) → `VIEW_ACCOUNTING` / `MANAGE_ACCOUNTING` with tenantId enforcement on create.
- 7 procurement collections (`serviceOrders`, `purchaseOrderVersions`, `amendmentApprovalHistory`, `threeWayMatches`, `matchLineItems`, `matchDiscrepancies`, `matchToleranceConfigs`) → internal-user read, `MANAGE_PROCUREMENT` write. `purchaseOrderVersions` and `amendmentApprovalHistory` are immutable history (no update/delete).
- 2 materials/engineering collections (`materialPrices`, `shapes`) → `VIEW_ESTIMATION` / `MANAGE_ESTIMATION`.
- 1 channel collection (`projectChannels`) → internal-user read/write, super-admin delete.
- 1 system collection (`systemConfig`) → all-signed-in read, super-admin write.
- 4 legacy collections (`companies`, `entity_contacts`, `journal_entries`, `ledger_entries`) — referenced only in `apps/web/src/app/admin/backup/page.tsx` for backup runs, no active reads/writes from app code → admin read, writes blocked entirely (`allow write: if false`).

**Original count: 22.** Original list (kept for posterity):

```
amendmentApprovalHistory, bankStatements, bankTransactions, companies,
entity_contacts, fiscalYears, interprojectLoans, journal_entries,
ledger_entries, matchDiscrepancies, matchLineItems, matchToleranceConfigs,
materialPrices, projectChannels, purchaseOrderVersions,
reconciliationMatches, reconciliationReports, serviceOrders, shapes,
systemConfig, threeWayMatches, yearEndClosingEntries
```

**Fix template:**

```javascript
// firestore.rules — minimum block per CLAUDE.md rule #4
match /<collectionName>/{docId} {
  allow read: if isSignedIn() && hasPermission(<VIEW_FLAG>);
  allow create: if isSignedIn()
    && hasPermission(<MANAGE_FLAG>)
    && request.resource.data.tenantId == request.auth.token.tenantId;
  allow update: if isSignedIn() && hasPermission(<MANAGE_FLAG>);
  allow delete: if isSignedIn() && (hasPermission(<MANAGE_FLAG>) || isSuperAdmin());
}
```

**False positives:** `journal_entries` and `ledger_entries` may be legacy collection-name constants — verify they are still written. If not, remove from `COLLECTIONS` and the violation drops out.

**Target:** P0, single afternoon. Block the bigger fixes on getting this clean first — the rest of the agent work assumes Firestore enforces auth.

---

## Rule #6 — Approval workflows need `preventSelfApproval`

**What it means:** any function that approves or rejects another user's submission must call `preventSelfApproval(approverId, submitterId, 'op label')` to enforce separation of duties.

**Count: 17.** Concentrated in approval/rejection functions. Sample:

| File                                                            | Function                       |
| --------------------------------------------------------------- | ------------------------------ |
| `apps/web/src/lib/accounting/paymentBatchService.ts:622`        | `submitBatchForApproval`       |
| `apps/web/src/lib/accounting/paymentBatchService.ts:655`        | `approveBatch`                 |
| `apps/web/src/lib/accounting/paymentBatchService.ts:679`        | `rejectBatch`                  |
| `apps/web/src/lib/accounting/transactionApprovalService.ts:134` | `submitTransactionForApproval` |
| `apps/web/src/lib/accounting/transactionApprovalService.ts:412` | `rejectTransaction`            |
| `apps/web/src/lib/procurement/goodsReceiptService.ts:577`       | `approveGRForPayment`          |
| `apps/web/src/lib/procurement/purchaseOrder/workflow.ts:30`     | `submitPOForApproval`          |
| `apps/web/src/lib/procurement/amendment/crud.ts:153`            | `submitAmendmentForApproval`   |
| `apps/web/src/lib/procurement/amendment/crud.ts:358`            | `rejectAmendment`              |
| `apps/web/src/lib/procurement/threeWayMatch/workflow.ts:35`     | `approveMatch`                 |
| `apps/web/src/lib/procurement/threeWayMatch/workflow.ts:136`    | `rejectMatch`                  |
| `apps/web/src/lib/proposals/approvalWorkflow.ts:29`             | `submitProposalForApproval`    |
| `apps/web/src/lib/proposals/approvalWorkflow.ts:200`            | `rejectProposal`               |
| `apps/web/src/lib/documents/commentResolutionService.ts:92`     | `approveCommentResolution`     |
| `apps/web/src/lib/documents/commentService.ts:208`              | `approveCommentResolution`     |
| `apps/web/src/lib/documents/commentService.ts:241`              | `rejectCommentResolution`      |
| `apps/web/src/lib/vendorQuotes/vendorQuoteWorkflow.ts:190`      | `rejectVendorQuote`            |

**Fix template:**

```typescript
import { preventSelfApproval } from '@/lib/auth/authorizationService';

export async function approveBatch(
  db: Firestore,
  batchId: string,
  approverId: string,
  approverPermissions: number
) {
  // 1. permission check (rule #5)
  requirePermission(
    approverPermissions,
    PERMISSION_FLAGS.MANAGE_ACCOUNTING,
    approverId,
    'approve payment batch'
  );

  // 2. self-approval prevention (rule #6) — fetch the submitter's id from the doc
  const snap = await getDoc(doc(db, COLLECTIONS.PAYMENT_BATCHES, batchId));
  if (!snap.exists()) throw new Error('Batch not found');
  const submitterId = snap.data().submittedBy;
  preventSelfApproval(approverId, submitterId, 'approve payment batch');

  // 3. state machine validation (rule #8) — ...
  // 4. write + audit log ...
}
```

**False positives:** `cancel*` functions (e.g. `cancelLeaveRequest`) are excluded from the detector because cancellation is usually done by the requester themselves. If a cancellation in your codebase IS done by an approver, add `preventSelfApproval` manually — the detector will not flag it.

**Target:** P0, half a day. Pair-fix with rule #5 — both share the same insertion point at the top of each function.

---

## Rule #5 — Service writes need `requirePermission`

**What it means:** every exported function in `apps/web/src/lib/**/*Service*.ts`, `*workflow*.ts`, `crud.ts`, etc. that writes to Firestore must call `requirePermission(permissions, PERMISSION_FLAGS.<FLAG>, userId, 'op label')` before the write. Client-side checks alone are insufficient.

**Count: 254.** Largest backlog. Concentrated in:

| File                                                         | Approx count |
| ------------------------------------------------------------ | ------------ |
| `apps/web/src/lib/accounting/paymentBatchService.ts`         | 14           |
| `apps/web/src/lib/accounting/recurringTransactionService.ts` | 7            |
| `apps/web/src/lib/accounting/yearEndClosingService.ts`       | 3            |
| `apps/web/src/lib/accounting/fiscalYearService.ts`           | 3            |
| `apps/web/src/lib/accounting/transactionVoidService.ts`      | 2            |
| `apps/web/src/lib/accounting/bankReconciliation/*.ts`        | several      |
| `apps/web/src/lib/procurement/*`                             | many         |
| `apps/web/src/lib/hr/*`                                      | many         |
| `apps/web/src/lib/proposals/*`                               | several      |
| Cloud Functions in `functions/src/*`                         | several      |

Run `pnpm check-rules --only=1` for the full list.

**Fix template:**

```typescript
import { requirePermission } from '@/lib/auth/authorizationService';
import { PERMISSION_FLAGS } from '@vapour/constants';

export async function createPaymentBatch(
  db: Firestore,
  input: CreatePaymentBatchInput,
  userId: string,
  userPermissions: number // ← add this argument if missing
): Promise<PaymentBatch> {
  requirePermission(
    userPermissions,
    PERMISSION_FLAGS.MANAGE_ACCOUNTING,
    userId,
    'create payment batch'
  );
  // …rest of the function unchanged
}
```

**Pattern for the cleanup pass** (per file):

1. Add `userPermissions: number` to the signature if not present.
2. Add `requirePermission` as the first non-validation statement.
3. Update every call site (TypeScript will fail compilation until you do — that's the safety net).
4. Run `pnpm check-rules --only=1` after each file to confirm count drops.

**False positives:** the detector excludes private (non-exported) functions on the assumption that they're called from a public function that already gated. If a private function is exposed to a Cloud Function HTTPS endpoint, add `requirePermission` defensively even though the detector won't flag it.

**Target:** P1, ~1–2 weeks of mechanical work. Recommended approach: one service-file per sitting, alongside other work.

---

## Rule #8 — Status changes need `requireValidTransition`

**What it means:** any function that changes a `status` field on a Firestore document must validate the transition through the appropriate state machine in `apps/web/src/lib/workflow/stateMachines.ts` via `requireValidTransition(machine, currentStatus, targetStatus, 'EntityName')`. Inline `if (current !== 'X')` checks are forbidden (rule #8b — "ad-hoc state machine").

**Count: 105.** Sample:

| File                                                            | Function                               |
| --------------------------------------------------------------- | -------------------------------------- |
| `apps/web/src/lib/accounting/fiscalYearService.ts:205`          | `closePeriod`                          |
| `apps/web/src/lib/accounting/fiscalYearService.ts:273`          | `lockPeriod`                           |
| `apps/web/src/lib/accounting/fiscalYearService.ts:318`          | `reopenPeriod`                         |
| `apps/web/src/lib/accounting/transactionVoidService.ts:165`     | `voidTransaction`                      |
| `apps/web/src/lib/accounting/transactionApprovalService.ts:134` | `submitTransactionForApproval`         |
| `apps/web/src/lib/accounting/paymentBatchService.ts:441`        | `addBatchPayment`                      |
| `apps/web/src/lib/accounting/glEntryRegeneration.ts:27`         | `regenerateCustomerPaymentGL` (ad-hoc) |
| `apps/web/src/lib/accounting/glEntryRegeneration.ts:100`        | `regenerateVendorPaymentGL` (ad-hoc)   |

**Fix template:**

```typescript
import { requireValidTransition } from '@/lib/utils/stateMachine';
import { paymentBatchStateMachine } from '@/lib/workflow/stateMachines';

export async function approveBatch(
  db: Firestore,
  batchId: string,
  approverId: string,
  approverPermissions: number
) {
  requirePermission(
    approverPermissions,
    PERMISSION_FLAGS.MANAGE_ACCOUNTING,
    approverId,
    'approve batch'
  );

  const snap = await getDoc(doc(db, COLLECTIONS.PAYMENT_BATCHES, batchId));
  if (!snap.exists()) throw new Error('Batch not found');
  const data = snap.data() as PaymentBatch;

  preventSelfApproval(approverId, data.submittedBy, 'approve batch');

  // Validate transition (rule #8)
  requireValidTransition(paymentBatchStateMachine, data.status, 'APPROVED', 'PaymentBatch');

  await updateDoc(snap.ref, {
    status: 'APPROVED',
    approvedBy: approverId,
    approvedAt: Timestamp.now(),
  });
}
```

**For ad-hoc state-machine cases** (rule #8b — `if (status !== 'DRAFT')`): replace the inline check with `requireValidTransition`. If the entity has no formal state machine yet, that's a Rule #17 cleanup — define the machine in `stateMachines.ts` first, then point this function at it. Modules currently missing state machines per the codebase survey: leave requests, on-duty, BOM, transmittal.

**False positives:** very low. The detector requires both a write op AND a status comparison/literal in the same function body — there's no plausible "innocent" pattern for that combination.

**Target:** P1, ~1 week. Pair with rule #5 cleanup for shared insertion points.

---

## Rule #18 — Sensitive operations need an audit-log call

**What it means:** any approve/reject/post/void/delete/close/lock/issue/etc. function that writes data must call `createAuditLog`, `logAuditEvent`, or `auditUserAction` so the action is reconstructable. CLAUDE.md says this pattern is "in progress" — closing this rule is a hard prerequisite for the agent layer.

**Count: 35.** Concentrated in workflow, void, close, and approval functions across accounting, procurement, HR, documents.

**Fix template:**

```typescript
import { logAuditEvent, createAuditContext } from '@/lib/audit/clientAuditService';

export async function voidTransaction(...) {
  // permission, state machine, write...

  await logAuditEvent({
    ...createAuditContext(actor),
    action: 'TRANSACTION_VOIDED',
    entityType: 'TRANSACTION',
    entityId: txnId,
    description: `Voided ${data.transactionNumber}`,
    severity: 'WARNING',
    success: true,
    changes: [
      { field: 'status', oldValue: data.status, newValue: 'VOIDED' },
    ],
  });
}
```

**False positives:** the detector flags by function-name pattern (`approve*`, `reject*`, `void*`, etc.). A function named differently but performing a sensitive op (e.g. `markAsPaid`) won't be flagged. Add audit logs defensively when writing new sensitive ops.

**Target:** P1, ~3 days. Bundle with rule #8 cleanup (same files, same insertion site).

---

## Rule #21 — No fallback chains on amount fields

**What it means:** monetary calculations must derive outstanding from `total - paid` (rule #21), round at every step, and avoid fallback chains like `data.outstandingAmount ?? data.baseAmount ?? 0` that silently double or hide missing data.

**Count: 107.** Heavy false-positive rate — many are display-only (`{formatCurrency(transaction.totalAmount || 0, ...)}`). Computational hits are real:

| File                                                                              | Concern                                                                  |
| --------------------------------------------------------------------------------- | ------------------------------------------------------------------------ |
| `apps/web/src/lib/accounting/gstReports/generators.ts:74`                         | `invoice.totalAmount \|\| 0` in GST aggregation — masks data quality     |
| `apps/web/src/lib/accounting/gstReports/generators.ts:96, 225`                    | Same pattern in different blocks                                         |
| `apps/web/src/components/accounting/TransactionAllocationTable.tsx:135, 191, 304` | Allocation amounts default to 0 — could distort reconciliation           |
| `apps/web/src/components/hr/travelExpenses/ReceiptParsingUploader.tsx:284`        | Parsed-receipt amount default to 0 — should fail loudly if parser failed |

**Triage rule of thumb:**

- **Display only** (`<td>{formatCurrency(x.totalAmount || 0)}</td>` in JSX) — low impact, can defer or drop the `|| 0` for a `?? 0` (less likely to mask actually-zero amounts).
- **Computation** (assigning to a variable used in further math, or accumulating into a report) — fix per CLAUDE.md rule #21: derive from source values, round per step, throw or warn on missing data instead of defaulting to 0.

**Fix template:**

```typescript
// BAD — fallback chain, double-counts when both fields are stale
const outstanding = data.outstandingAmount ?? data.baseAmount - data.amountPaid ?? 0;

// GOOD — derive from source, round once
const total = roundToPaisa(data.baseAmount);
const paid = roundToPaisa(data.amountPaid ?? 0);
const outstanding = roundToPaisa(total - paid);

if (Math.abs(outstanding) < 0.01) {
  // tolerance check — floating-point safe (rule #21)
}
```

**Target:** P1, ~3 days for the computation hot spots. Display-only sites can be batched separately or left advisory permanently.

---

## Rule #19 — Read + write needs `runTransaction`

**What it means:** any function that does `getDoc(ref)` then later `updateDoc(ref)` or `setDoc(ref)` on the same document must wrap both inside `db.runTransaction()` to prevent concurrent overwrites. Use `FieldValue.increment()` for counters.

**Count: 87.** High false-positive potential — the detector flags any function with both a read and a write, even when they touch different documents. Real findings concentrate in:

| File                                                            | Function                    |
| --------------------------------------------------------------- | --------------------------- |
| `apps/web/src/lib/accounting/transactionDeleteService.ts:106`   | `softDeleteTransaction`     |
| `apps/web/src/lib/accounting/transactionDeleteService.ts:201`   | `restoreTransaction`        |
| `apps/web/src/lib/accounting/transactionDeleteService.ts:290`   | `hardDeleteTransaction`     |
| `apps/web/src/lib/accounting/transactionApprovalService.ts:269` | `approveTransaction`        |
| `apps/web/src/lib/accounting/transactionApprovalService.ts:412` | `rejectTransaction`         |
| `apps/web/src/lib/accounting/transactionVoidService.ts:165`     | `voidTransaction`           |
| `apps/web/src/lib/accounting/yearEndClosingService.ts:852`      | `createClosingJournalEntry` |
| `apps/web/src/lib/accounting/glEntryRegeneration.ts:27, 100`    | `regenerate*GL`             |

**Fix template:**

```typescript
// BAD — race condition, two callers can overwrite each other
const snap = await getDoc(ref);
const data = snap.data();
data.items[idx].status = 'COMPLETED';
await updateDoc(ref, { items: data.items });

// GOOD — atomic transaction
await db.runTransaction(async (tx) => {
  const snap = await tx.get(ref);
  const items = snap.data().items;
  items[idx].status = 'COMPLETED';
  tx.update(ref, { items });
});

// GOOD — counter increment
batch.update(ref, { totalDelivered: FieldValue.increment(qty) });
```

**Triage:** when reviewing a flagged function, check whether the read and write are on the same document (real violation) or different documents (false positive). The script's purpose is to make you check.

**Target:** P2, ~1 week. Fix real violations as you encounter them in the rule #5 / rule #8 cleanup passes.

---

## Rule #20 — Batch ops in loops need 500-op chunking

**What it means:** Firestore rejects batches >500 operations. Loops that build batches must chunk via `if (i % 500 === 0) await batch.commit()` or `slice(i, i + 500)` patterns.

**Count: 21.** Manual review per call site — small enough to triage in one pass.

**Fix template:**

```typescript
// BAD — single batch, breaks at 501 docs
const batch = db.batch();
for (const update of updates) batch.update(update.ref, update.data);
await batch.commit();

// GOOD — chunked
for (let i = 0; i < updates.length; i += 500) {
  const batch = db.batch();
  updates.slice(i, i + 500).forEach((u) => batch.update(u.ref, u.data));
  await batch.commit();
}
```

**Target:** P2, ~1 day. Fix while touching the file for other reasons.

---

## Rule #28 — Modules need List + New + View + Edit pages

**What it means:** every entity module under `apps/web/src/app/<module>/` must have `page.tsx` (list), `new/page.tsx`, `[id]/page.tsx`, `[id]/edit/page.tsx`. Dashboards (single page, no entity routes) are not entity modules and are exempt.

**Count: 20.** From baseline:

| Module                                         | Missing    |
| ---------------------------------------------- | ---------- |
| `apps/web/src/app/accounting/cost-centres`     | New, Edit  |
| `apps/web/src/app/accounting/fixed-assets`     | New, Edit  |
| `apps/web/src/app/accounting/payment-batches`  | New, Edit  |
| `apps/web/src/app/accounting/recurring`        | Edit       |
| `apps/web/src/app/bought-out`                  | Edit       |
| `apps/web/src/app/documents`                   | New, Edit  |
| `apps/web/src/app/estimation`                  | Edit       |
| `apps/web/src/app/hr/employees`                | New, Edit  |
| `apps/web/src/app/hr/leaves`                   | Edit       |
| `apps/web/src/app/hr/travel-expenses`          | Edit       |
| `apps/web/src/app/materials/pipes`             | View, Edit |
| `apps/web/src/app/materials/plates`            | View, Edit |
| `apps/web/src/app/materials/vendor-offers`     | Edit       |
| `apps/web/src/app/procurement/amendments`      | Edit       |
| `apps/web/src/app/procurement/service-orders`  | Edit       |
| `apps/web/src/app/procurement/three-way-match` | Edit       |
| `apps/web/src/app/procurement/work-completion` | Edit       |
| `apps/web/src/app/projects`                    | New, Edit  |
| `apps/web/src/app/proposals`                   | New, Edit  |
| `apps/web/src/app/proposals/enquiries`         | New        |

**False positives:** terminal documents (`procurement/work-completion`, `procurement/three-way-match`) legitimately have no Edit page per CLAUDE.md ("Edit page for fields that remain editable in non-terminal states"). Mark these as accepted exceptions when triaging.

**Target:** P2, ~2 weeks if all gaps are real. Most are likely Edit-page gaps where Edit is currently inline in a dialog — decide per module whether that satisfies rule #28 or whether to spin out a dedicated route.

---

## Sequencing plan

| Order | Rule                   | Effort     | Why this order                                       |
| ----- | ---------------------- | ---------- | ---------------------------------------------------- |
| 1     | #4                     | Half a day | Pure auth gap — block before everything              |
| 2     | #6                     | Half a day | Concentrated, mechanical, separation of duties       |
| 3     | #21 (computation hits) | 3 days     | Money correctness — unblock agent's accounting flows |
| 4     | #5                     | 1–2 weeks  | Largest backlog; pair with #8/#18                    |
| 5     | #8                     | ~1 week    | Workflow safety; same files as #5                    |
| 6     | #18                    | ~3 days    | Forensics; same files as #5/#8                       |
| 7     | #19                    | ~1 week    | Concurrency — fix real violations after triage       |
| 8     | #20                    | ~1 day     | Small, mechanical                                    |
| 9     | #28                    | ~2 weeks   | UI completeness; scope per module                    |
| 10    | #21 (display)          | optional   | Drop `\|\| 0` to `?? 0` site-by-site, low priority   |

Total realistic effort to close everything: **~6–8 weeks calendar time** at ~1–2 hr/day. Faster if batched, slower if interleaved with feature work.

---

## Switching from advisory to enforce

`.husky/pre-commit` currently runs:

```sh
node scripts/audit/check-rules.js --advisory --quiet
```

When a rule's count is at 0 in the snapshot:

1. Confirm: `pnpm check-rules --only=<N>` exits 0.
2. To enforce a single rule across the whole suite: drop `--advisory` from the husky line. **All** non-zero rules will then block commits, so do this only when _every_ rule is at 0 — or build per-rule enforcement (option below).
3. **Per-rule enforcement** (recommended interim): add a wrapper that runs only the cleared rules in non-advisory mode and the rest in advisory mode. Pattern:

```sh
# .husky/pre-commit (eventual state)
node scripts/audit/check-rules.js --only=4              # rule #4 enforced
node scripts/audit/check-rules.js --only=1 --advisory   # #5/#6/#7 still advisory
node scripts/audit/check-rules.js --only=2 --advisory   # ...
```

Migrate one check-group at a time as its rules close.

4. CI parity: add the same `pnpm check-rules` invocation to the CI workflow that runs on PRs (e.g. GitHub Actions). PR checks should mirror pre-commit.

---

## Audit & progress tracking

- **Live count:** `pnpm check-rules`
- **Dated snapshot:** `pnpm check-rules:snapshot` writes `reports/rule-check-YYYY-MM-DD.md`. Commit one when you want to mark a milestone (e.g. after closing rule #4).
- **This punch list:** human-edited as items close. Update the summary table and per-rule sections as you go. When a rule reaches 0, change its row to "✅ enforce" and move to the bottom under a "Closed" heading.

---

## References

- [CLAUDE.md](CLAUDE.md) — rule definitions (#1–#29)
- [AI-AGENT-ROADMAP-2026-04-25.md](AI-AGENT-ROADMAP-2026-04-25.md) — why these rules matter for agent rollout (Phase 0 prerequisites)
- [AUDIT-2026-03-26.md](AUDIT-2026-03-26.md) — original 190-finding audit that produced the rules
- Detector scripts:
  - [scripts/audit/check-permissions.js](scripts/audit/check-permissions.js)
  - [scripts/audit/check-state-machines.js](scripts/audit/check-state-machines.js)
  - [scripts/audit/check-financial-and-concurrency.js](scripts/audit/check-financial-and-concurrency.js)
  - [scripts/audit/check-structure.js](scripts/audit/check-structure.js)
  - [scripts/audit/check-rules.js](scripts/audit/check-rules.js) (runner)
- Pre-commit hook: [.husky/pre-commit](.husky/pre-commit)
