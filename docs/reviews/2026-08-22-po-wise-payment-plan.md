# PO-wise payment details, request & tracking

**Status:** Assessed 2026-08-22, decisions locked, no code written.
**Source:** `docs/inputs/Procurement and Finance Module _PO Wise Payment Integration.pdf` (user feature request, 10 sections).
**Scope of first cut:** §2, §3, §4, §7, §8 (visibility). §5/§6 (payment request + attachments) deferred to phase 3, design locked below.

---

## 1. Verdict

Implementable. Every piece of infrastructure exists. The blocker is not the feature — it
is that the PO↔bill↔payment link is broken in live data, so the rollup this feature
depends on returns zero for every PO today.

All figures below were read from the live `vapour-toolbox` Firestore on 2026-08-22, not
inferred.

---

## 2. What already exists

| Request                                              | Already in the codebase                                                                                                                                                                                                                                                                                     |
| ---------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| §2 PO details (number, date, vendor, project, terms) | All on the PO doc. `getUsersWithPermission(db, tenantId, MANAGE_ACCOUNTING)` is the existing fan-out-to-accounting pattern ([goodsReceiptService.ts:642](../../apps/web/src/lib/procurement/goodsReceiptService.ts#L642))                                                                                   |
| §4 Milestones                                        | `PaymentMilestone[]` at `commercialTerms.paymentSchedule` ([purchaseOrder.ts:296](../../packages/types/src/procurement/purchaseOrder.ts#L296)). **All 17 live POs populated — 33 milestone rows.** Editor: [PaymentScheduleEditor.tsx](../../apps/web/src/components/procurement/PaymentScheduleEditor.tsx) |
| §5 Notification                                      | `PAYMENT_REQUESTED` is already a `TaskNotificationCategory` routed to the **accounting** channel ([task.ts:38](../../packages/types/src/task.ts#L38))                                                                                                                                                       |
| §6 Attachments                                       | `POAttachment` + `addPOAttachment`/`removePOAttachment` ([attachments.ts](../../apps/web/src/lib/procurement/purchaseOrder/attachments.ts)) is a directly reusable pattern                                                                                                                                  |
| §7 UTR / payment ref                                 | `reference`, `chequeNumber`, `upiTransactionId` on the vendor payment dialog. One live payment holds `UTR NO: SBIN126166441955`                                                                                                                                                                             |
| §7 Rollup engine                                     | CF `syncPOPaymentToGRs` already sums bills per PO ([procurementPaymentStatus.ts](../../functions/src/procurementPaymentStatus.ts))                                                                                                                                                                          |
| §8 Amendments                                        | `commercialTerms` is already amendable ([amendment/crud.ts:55](../../apps/web/src/lib/procurement/amendment/crud.ts#L55)), with structured diff + version snapshots                                                                                                                                         |
| §3 UI                                                | `PageHeader` / `FilterBar` / `DataTable` / `StatusChip` kit (rule 34)                                                                                                                                                                                                                                       |

**Duplicate check (rule 32).** `PaymentBatch` is adjacent but not a duplicate — it is
accounting-side cash planning (receipts → payments), and `BatchPayment.linkedId` points at
a bill. A PO payment request feeds _into_ a batch rather than competing with it. No other
PO-payment view, service or collection exists.

---

## 3. The prerequisite defect (not part of the feature)

Nothing connects a PO to what was actually paid:

- **249 `VENDOR_BILL` docs — 0 carry `purchaseOrderId`.** Only 4 carry
  `sourceDocumentId`/`sourcePoNumber`.
- **204 `VENDOR_PAYMENT` docs — 0 carry `purchaseOrderId`.**
- Three services query bills by `purchaseOrderId` and therefore silently return nothing for
  every PO: the CF rollup, [`arePOPaymentsComplete`](../../apps/web/src/lib/procurement/workCompletionService.ts#L223),
  and three-way match.

Root cause is a field-name split (rules 25/32): [CreateBillDialog.tsx:238](../../apps/web/src/app/accounting/bills/components/CreateBillDialog.tsx#L238)
writes `sourceDocumentId` + `sourcePoNumber`; every reader expects `purchaseOrderId`.

Two more live faults found while verifying:

- **0 bills carry `sourceModule: 'procurement'`** — `createBillFromGoodsReceipt` has never
  completed successfully. **4 of 6 goods receipts are stranded at
  `paymentRequestId: 'CREATING'`**: the lock is taken at [accountingIntegration.ts:118](../../apps/web/src/lib/procurement/accountingIntegration.ts#L118)
  but released only inside the `try` around `saveTransaction` (~line 348), so any earlier
  failure strands the GR permanently and line 109 rejects every retry with `BILL_EXISTS`.
- **8 POs sit at `advancePaymentStatus: 'PENDING'` with no `advancePaymentId`** —
  `createAdvancePaymentFromPO` has never fired. It also mints `PAY-ADV-${Date.now()}`
  instead of using `generateTransactionNumber` (rule 32: 4 number generators was a past
  consolidation).
- **`taxableValue` is never persisted** — computed at [crud.ts:355](../../apps/web/src/lib/procurement/purchaseOrder/crud.ts#L355)
  and discarded; not on the `PurchaseOrder` type; 0 of 17 POs have it. Edit mode already
  reconstructs it as `grandTotal − totalTax` ([crud.ts:1028](../../apps/web/src/lib/procurement/purchaseOrder/crud.ts#L1028)).

---

## 4. Locked decisions (2026-08-22 — do not re-litigate)

- **Scope of the first cut: visibility only.** §2, §3, §4, §7, §8. Procurement raises
  payment requests by email/phone as today — the document's own §9 fallback. This works
  against 100% hand-entered bills, which is current reality, and is a prerequisite for the
  request workflow regardless.
- **Milestone amounts are defined at the PO stage**, computed and stored on the milestone.
  Percentage stays the source of truth; `amount` is the derived contract figure that gets
  printed, requested and tracked.
- **Tax assignment: block until assigned.** Saving a payment schedule with `totalTax > 0`
  and no milestone flagged `carriesTax` is a validation error. No silent default.
- **Payment attribution happens at the bill, not the payment.**
- **Payment requests (phase 3) require one approver before submission:**
  `DRAFT → PENDING_APPROVAL → SUBMITTED → PAID/REJECTED`, mirroring the Purchase Request
  flow. Rule 6 self-approval prevention applies.
- **Placement:** a Payments section on the PO detail page plus a `/procurement/po-payments`
  list. Not a separate top-level module (the request document offers both; this is its
  stated preference).
- **Procurement never reads `transactions`.** Everything procurement sees comes from a
  Cloud-Function-maintained `paymentSummary` projection on the PO doc. See §7.

---

## 5. Milestone amount formula

Tax is distributed pro-rata across the milestones flagged `carriesTax`, over `taxableValue`
otherwise:

```
amount_i = pct_i × taxableValue  +  (pct_i / Σ pct_flagged) × totalTax   [if flagged]
         = pct_i × taxableValue                                          [otherwise]
```

Verified to sum exactly to `grandTotal` on every live PO that has the flag set. It
collapses correctly to both intents users have actually expressed:

| PO          | Schedule                          | Amounts                                 | Sum            |
| ----------- | --------------------------------- | --------------------------------------- | -------------- |
| PO/2026/001 | 50% / 50%+tax                     | ₹1,52,014.25 + ₹2,06,739.38             | ₹3,58,753.63 ✓ |
| PO/2026/002 | 40%+tax / 40%+tax / 20%+tax       | ₹94,400 + ₹94,400 + ₹47,200             | ₹2,36,000 ✓    |
| PO/2026/007 | 20% / 50%+tax / 20%+tax / 10%+tax | ₹54,000 + ₹1,65,375 + ₹66,150 + ₹33,075 | ₹3,18,600 ✓    |

"One milestone carries all the tax" and "every milestone carries its share" are the same
rule, not two.

`calculateAdvanceAmount` ([crud.ts:110](../../apps/web/src/lib/procurement/purchaseOrder/crud.ts#L110))
becomes a caller of this function (`schedule[0].amount`) rather than a second formula. Its
current `base = carriesTax ? grandTotal : taxableValue` is only correct for a single
milestone — that formula already caused a ₹2.05L over-billing (feedback jRO7w8mg).

### The six POs with no tax assignment

| PO              | Status           | Schedule             | Action                                                           |
| --------------- | ---------------- | -------------------- | ---------------------------------------------------------------- |
| PO/2026/012     | DRAFT            | 100%, `totalTax = 0` | None — validation skipped when there is no tax                   |
| PO/2026/02/0001 | DRAFT            | 100%                 | Single milestone: every rule gives the same answer               |
| PO/2026/04/0001 | PENDING_APPROVAL | 100%                 | Single milestone: same                                           |
| PO/2026/02/0002 | PENDING_APPROVAL | 30/60/10             | User ticks the box on next edit (validation forces it)           |
| PO/2026/01/0004 | DRAFT            | 30/60/10             | User ticks the box on next edit                                  |
| PO/2026/01/0003 | COMPLETED        | 30/60/10, ₹3,170     | **Edit the record directly** — 1 doc, no legacy branch (rule 31) |

Only three are genuinely ambiguous, two of them editable. Per rule 31 the completed one is
fixed by hand rather than by a compatibility fallback.

---

## 6. Payment attribution

### Decision: tag the bill, not the payment

Live allocation shape across 204 vendor payments:

- **167 allocate to exactly one bill**, 22 to several, 15 to none (all flagged `isAdvance`).
- **64 of the single-allocation payments are partial** — one bill routinely takes more than
  one payment.
- **BILL-2627-0064 is ₹1,59,300 — exactly 50% of PO/2026/007's ₹3,18,600**, which is
  milestone #2 (`50% + tax`). The vendor invoiced _for the milestone_. That is the
  real-world unit.

Rollup then needs no new arithmetic:

```
milestone paid = Σ derivePaid(bill) over bills tagged to that milestone
               + Σ unallocated payments tagged directly to that milestone
```

`amountPaid` / `outstandingAmount` / `paymentStatus` are already maintained atomically on
the bill by `createPaymentWithAllocationsAtomic`, so partial payments, multi-bill payments
and reversals fall out for free. **Derive, never cache** (rule 21) — a stored
`milestonePaidAmount` drifts the first time a payment is voided.

Invariant: a payment is _either_ allocated to a bill _or_ directly tagged to a milestone,
never both. Validated at write time.

### Rejected alternatives

- **Payment-level `milestoneId`** — 22 payments cover several bills at once and cannot be
  expressed by a single id; the 64 partial payments would need hand-apportioning.
- **Waterfall / serial attribution** — does not survive the data. Three of the four
  PO-linked bills exceed their PO's grand total (₹3,510.74 vs ₹3,251.14; ₹6,304.74 vs
  ₹5,475.20; ₹2,374.75 vs ₹2,256.75), so amounts cannot drive inference. On PO/2026/007 a
  waterfall would have consumed milestone #1 (20% = ₹63,720) and spilled into #2 — but the
  ₹1,45,800 was a partial on #2, with #1 untouched.

### Caveat: `isAdvance` is used loosely

VPAY-2627-0067 and -0068 are both `isAdvance: true` **and** allocated to bills, yet
`bulkAutoAllocatePayments` skips `isAdvance` payments outright
([paymentHelpers.ts:1211](../../apps/web/src/lib/accounting/paymentHelpers.ts#L1211)). The
flag means "advance against the PO" to users and "unapplied" to the code. Build the
invariant on the presence of allocations, not on this flag.

---

## 7. Reading across the module boundary

**The procurement team has no accounting access.** Verified against the live `users`
collection: of 9 users, **4 hold `MANAGE_PROCUREMENT` with no `VIEW_ACCOUNTING`** —
Sathiyamoorthi B, Kumaran A, John Mecanroe, Sudhakar RD. Only Revathi SP and
K Sekkizhar Prasanna hold both. The `PROCUREMENT` role composition in
[permissions.ts:257](../../packages/constants/src/permissions.ts#L257) confirms it by
design: no `VIEW_ACCOUNTING` bit.

`transactions` read requires `VIEW_ACCOUNTING` ([firestore.rules:437](../../firestore.rules#L437)).
So a procurement user calling `getDocs` on bills or payments gets `permission-denied` — a
thrown error surfacing as "Missing or insufficient permissions", not an empty list. Any
design where the PO payment view queries `transactions` from the client is dead for the
four people the feature is for.

The reverse direction is fine: `purchaseOrders` read is `isInternalUser()`
([firestore.rules:638](../../firestore.rules#L638)), so accounting can read POs and
milestone amounts with no permission change. §2 needs nothing new.

### Decision: a CF-maintained projection on the PO

A Cloud Function (admin credentials, rules do not apply) writes a `paymentSummary` onto the
PO document, which procurement already reads. **This is the established pattern here, not a
new one** — `syncPOPaymentToGRs` exists precisely because goods receipts are
procurement-side and payments are accounting-side, and it already writes the derived bucket
onto the GR doc.

What the projection carries — nothing beyond what §7 of the request asks for:

- PO total, paid total, pending total
- per milestone: `milestoneId`, `amount`, `paid`, `status`
- payment history rows: date, amount, reference / UTR, milestone, bill number
- `syncedAt`

What it must **not** copy: bank account, GL entries, TDS breakdown, bill line items, vendor
pricing, or any other transaction field. The projection is the disclosure boundary, so its
field list is deliberate — widening it later is a permissions decision, not a refactor.

This does mean procurement gains sight of payment dates, amounts and UTRs for their own
POs. That is the explicit ask in §7 of the request document, so it is intended — but it is
a real widening of what those four users can see, and is recorded here as such.

### Consequences

- **Rule 21 is satisfied, not bypassed.** The CF recomputes the whole summary from source on
  every trigger — never `increment()` — so repeated or out-of-order triggers converge. It is
  a projection, not a counter. Rule 19's transaction requirement applies to the PO write.
- **A repair path is required.** `recalculateAccountBalances` on the Data Health page is the
  precedent; add the equivalent for PO payment summaries.
- **Staleness must be visible.** If the CF fails, procurement sees stale numbers with no
  signal. Stamp `syncedAt` and render it. `syncPOPaymentToGRs` already writes such a
  timestamp "so UI can show last synced at … if needed" — this time actually show it.
- **`paymentProgress` on the PO is the vestigial version of this.** Subsume it into the
  projection rather than leaving a parallel (rule 32). It is written in exactly two places
  today and read by one progress bar.
- **The list page queries `purchaseOrders`, not `transactions`.** Filtering by payment status
  reads `paymentSummary.status`, needing a composite index if combined with `orderBy`
  (rule 2).

### The trigger has to widen

`syncPOPaymentStatusOnVendorPayment` ([procurementPaymentStatus.ts:148](../../functions/src/procurementPaymentStatus.ts#L148))
fires only on `VENDOR_PAYMENT` writes and **returns early when the payment has no
`billAllocations`** — so the 15 unallocated advance payments never trigger it at all. It
then resolves POs solely through `bill.purchaseOrderId`, which is 0 of 249. Two independent
reasons it is inert today.

The projection trigger must fire on:

1. `VENDOR_BILL` writes — a new or edited bill changes a milestone's pending amount before
   any payment exists.
2. `VENDOR_PAYMENT` writes — including milestone-tagged payments with no allocations.
3. `purchaseOrders` writes — an amendment changing milestones or `grandTotal` (§8).

Soft-deleted transactions contribute nothing (rule 3) — the existing loop already does this.

---

## 8. Work batches

### Batch 0 — repair the link (prerequisite, no user-facing change)

1. Add `purchaseOrderId` to `packages/constants/src/fields.ts` as the one cross-boundary
   name (rule 25). Write it from `CreateBillDialog` and `RecordVendorPaymentDialog`
   alongside the existing `sourcePoNumber`.
2. Backfill the 4 bills that carry `sourceDocumentId`. One-off script under
   `scripts/analysis/`, dry-run by default; no in-app migration code (rule 31).
3. Move the GR bill-creation lock release into a `finally` so a mid-path failure cannot
   strand the GR; clear the 4 stranded `'CREATING'` sentinels.
4. Persist `taxableValue` on the PO (type + create + edit + amendment apply).
5. Point `createAdvancePaymentFromPO` at `generateTransactionNumber` (rule 32).

Every Firestore call in these handlers gets `retryOnStaleToken` (rule 35).

### Batch 1 — milestone amounts at the PO

1. Add `amount` to `PaymentMilestone`; one shared `calculatePaymentSchedule(totals, milestones)`
   in `lib/procurement/commercialTerms/`. `calculateAdvanceAmount` delegates to it.
2. Extend `validatePaymentSchedule` (currently only the 100% and non-negative checks,
   [defaults.ts:224](../../apps/web/src/lib/procurement/commercialTerms/defaults.ts#L224)):
   reject a schedule with `totalTax > 0` and no `carriesTax` milestone, and reject a
   schedule whose amounts do not sum to `grandTotal`.
3. `PaymentScheduleEditor` receives the totals and renders a live rupee column with the
   running sum against `grandTotal`.
4. Recompute on PO create, draft edit, and amendment apply — the only three paths where
   `grandTotal` moves. Rule 22: written on create, restored on edit.
5. Backfill the 17 existing POs; fix PO/2026/01/0003 by hand.

### Batch 2 — milestone tagging on the bill

1. `purchaseOrderId` + `milestoneId` on `VendorBill`; `purchaseOrderId` + `milestoneId` on
   `VendorPayment` (direct-payment case only).
2. Milestone dropdown beside the existing `PurchaseOrderSelector` in `CreateBillDialog`
   ([:404](../../apps/web/src/app/accounting/bills/components/CreateBillDialog.tsx#L404)),
   populated from the selected PO's schedule with amounts. Same on the vendor payment
   dialog for unallocated payments.
3. Either-bill-or-direct invariant enforced at write time.
4. Composite indexes for any `where + orderBy` added (rule 2). Note that `type ==` plus
   `purchaseOrderId ==` is equality-only and needs no composite index; adding an `orderBy`
   does.

### Batch 3 — the projection (Cloud Function)

Must land before any procurement-facing view, since procurement cannot read `transactions`
(§7).

1. Pure `computePOPaymentSummary(po, bills, payments)` in `functions/src/` — per-PO and
   per-milestone paid / pending / status, using the `derivePaid` / `deriveOutstanding`
   semantics (rule 21). Pure and unit-tested, following `accountBalanceLogic.ts`.
2. Widen `syncPOPaymentStatusOnVendorPayment` to the three trigger cases in §7, recompute
   the whole summary from source, and write it to the PO inside a transaction (rule 19).
   Stamp `syncedAt`. Keep the existing GR bucket write — same function, one pass.
3. Subsume `paymentProgress` into the projection (rule 32).
4. A "Recalculate PO payment summaries" repair action on the Data Health page, mirroring
   "Recalculate Balances".
5. Firestore rules: the projection lives on the PO doc, so `VIEW_PROCUREMENT` already covers
   it and no rule change is needed. Confirm the CF is the only writer.

### Batch 4 — the procurement-facing views

Reads `purchaseOrders` only. No `transactions` query anywhere in this batch.

1. Payments section on the PO detail page (sibling of `FinancialSummarySection`) — milestone
   table + payment history with date, amount and reference/UTR, plus the `syncedAt` stamp.
2. `/procurement/po-payments` list — `PageHeader` + `FilterBar` + `DataTable` + `StatusChip`
   (rule 34), filters for vendor / project / status, per-status counts in the Status control
   following [purchase-requests/page.tsx](../../apps/web/src/app/procurement/purchase-requests/page.tsx).
   Filters on `paymentSummary.status`; composite index if combined with `orderBy` (rule 2).
3. CSV export. The only export helper today is
   [exportReport.ts](../../apps/web/src/lib/accounting/reports/exportReport.ts), shaped for
   accounting reports — either generalise its `ExportSection[]` or add a small shared
   list-export util. Do not write a third one (rule 32).
4. Status labels in `@vapour/constants/labels.ts`, rendered via `StatusChip` (rule 29).
   New closed set: `PENDING`, `DUE`, `PAYMENT_REQUESTED`, `PARTIALLY_PAID`, `PAID` (§7).
5. **Test as a procurement-only user**, not as an admin. Four live accounts qualify; an
   admin session hides exactly the failure this batch exists to avoid.

### Batch 5 — notifications and amendments

1. Notify all `MANAGE_ACCOUNTING` holders on PO approval (§2), matching the
   `GR_BILL_REQUIRED` fan-out. Needs a new informational category on the accounting
   channel — a category absent from `TASK_CHANNEL_DEFINITIONS` routes nowhere. Live
   recipient count today: 2 (Revathi SP, K Sekkizhar Prasanna).
2. On amendment apply: recompute milestone amounts, re-run the projection, notify
   accounting (§8).

### Phase 3 (deferred) — payment request (§5/§6)

New `poPaymentRequests` collection. State machine in `stateMachines.ts` (rule 17):
`DRAFT → PENDING_APPROVAL → SUBMITTED → PAID | REJECTED`, one approver, rule 6
self-approval prevention. Attachments reuse the `addPOAttachment` pattern. On submission,
`PAYMENT_REQUESTED` to all `MANAGE_ACCOUNTING` holders. The bill or payment accounting
creates from the request **inherits** `purchaseOrderId` + `milestoneId` (rule 26), so the
milestone is never re-picked by hand — `createBillFromGoodsReceipt` is the existing
precedent. Ships with List + New + View + Edit, security rules and indexes (rule 28).

`poPaymentRequests` is the one collection **both** modules touch, so its rules cannot follow
the usual single-permission shape: read and create need `VIEW_/MANAGE_PROCUREMENT`, and
accounting needs read plus the update that records the outcome. Grant
`hasPermission(MANAGE_PROCUREMENT) || hasPermission(MANAGE_ACCOUNTING)` on update and gate
_which_ fields each side may change in the service layer, not in the rules. Storage rules
for the attachments need the same two-sided read.

The request form shows the milestone's outstanding amount so the user can pick — that comes
from the §7 projection on the PO, not from a `transactions` query.

---

## 9. Open items

- Whether the `/procurement/po-payments` list needs PDF export as well as CSV. §3 says
  "Export options" without naming formats; no accounting list page has PDF today.
- Whether `advancePaymentRequired` / `advancePercentage` / `advanceAmount` should be
  retired once milestone amounts exist — they duplicate milestone #1 for the 8 POs that set
  them, and the auto-post path they feed has never fired. Decide after batch 1.
