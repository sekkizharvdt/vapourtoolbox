# Procurement Feedback Round 4 — Implementation Plan

**Date:** 2026-07-05
**Author:** Fable session (triage + research); execution intended for a follow-up session.
**Scope:** the 4 remaining feedback items from Kumaran (procurement). Two other items from the same batch were already fixed and deployed-pending (commits `bb936f47`, `9d7ac73b`: packingLists indexes, GR/PL edit rewrites, Clear-for-Payment redesign).

## Feedback items covered

| Batch | Feedback ID            | Title                                             |
| ----- | ---------------------- | ------------------------------------------------- |
| A     | `KHpfIJHY3vHEGVnqjAtZ` | GR/PL workflow issues & enhancements (bug)        |
| B     | `kPmvFXbiYDMrtyZK5VEn` | PO view + PDF fixes, 8 sub-items (bug)            |
| C     | `i7brfS9rrdfGVxRTHHZu` | PO status auto-update based on progress (feature) |
| D     | `sUjQ9E0O9tS9YZHqEtox` | "Return with Comments" in PO approval (feature)   |

Work the batches in order A → B → C → D (A unblocks Kumaran's daily receiving flow; D depends on state-machine edits that C also touches — do C before D to avoid merge friction in `stateMachines.ts`).

## Locked decisions (Sekkizhar, 2026-07-05 — do NOT re-litigate)

1. **PL before GR is enforced.** A GR requires an existing (non-draft) Packing List for the PO. GR creation without a PL is blocked.
2. **Hard block at PO quantity.** No GR beyond ordered qty, no zero-qty GRs, no "excess receipt" path. Excess material requires a PO amendment first.
3. **PO `COMPLETED` stays manual.** Auto-advance covers `IN_PROGRESS` (payment or PL) and `DELIVERED` (full receipt) only. Add a manual "Mark Completed" action.
4. **Return-with-comments = full restart.** Return sends the PO to `DRAFT`; on resubmission both approvers approve again in sequence.

Additional locked detail (from research, consistent with decision 1): a PL is _eligible_ for GR selection when its status is not `DRAFT` (statuses: `DRAFT | FINALIZED | SHIPPED | DELIVERED`, `packages/types/src/procurement/logistics.ts:13`).

## How to work this plan (session mechanics)

- Run `/orient` first.
- Work on `main` directly — **no feature branches** (repo convention). **Never push** without an explicit fresh go-ahead from Sekkizhar. Commit per batch once its verification passes.
- Before each commit run the checks from `/precommit-fix` (filtered). Type-check via `/type-check`; scoped tests via `pnpm test -- <paths>` from `apps/web`.
- When touching forms/dialogs, follow `/new-dialog` rules (14/14b/14c/15/22). When touching queries, `/firestore-check`.
- Every new status transition: state machine + `requireValidTransition`/`validateTransition` (rule 8), idempotent (rule 9), audit log via `logAuditEvent` (rule 18), terminal-state-aware UI (rule 10).
- Do NOT write migration/back-compat code for old documents without counting records first (rule 31). Solo-dev app, small dataset.
- After each batch: update the feedback item via `mcp__firebase-feedback__update_feedback` (status `resolved`, notes with commit hash + "ships on the next Deploy dispatch"). Deploys go through CI only (rule 33).

---

## Batch A — GR/PL workflow control (`KHpfIJHY3vHEGVnqjAtZ`)

### Current mechanics (verified)

- `createGoodsReceipt` — `apps/web/src/lib/procurement/goodsReceiptService.ts:72-374`. Input `CreateGoodsReceiptInput` (`:48-70`) already has optional `packingListId` (`:50`), but **nothing in the app ever passes it**, and `packingListNumber` is hardcoded `undefined` (`:187`).
- Over-delivery is already blocked server-side (`:159-166`): `remaining = quantity - quantityDelivered` per PO item (denormalized counter, not a GR query). Zero/negative received qty is **not** blocked — this is the "GR with 0 quantity" bug Kumaran hit.
- New GR page — `apps/web/src/app/procurement/goods-receipts/new/page.tsx`. Computes `pending = item.quantity - (item.quantityDelivered || 0)` (`:142`), pre-fills Received with it, but the table (`:435-444`) shows only **Ordered** — no "Prev. Received"/"Balance" columns. Does not pass `packingListId` or `userPermissions2` to the service (`:222-247`) — the `INSPECT_GOODS` permission check is silently skipped (rule 5 violation).
- PO detail "Receive Goods" button: `.../pos/[id]/components/POHeader.tsx:151-160`, gated by `canReceiveGoods` (`purchaseOrderHelpers.ts:87-89`, statuses ISSUED/ACKNOWLEDGED/IN_PROGRESS).
- PL service blocks over-packing by summing prior PL items (`packingListService.ts:83-137`). Note the no-op filter `.filter(pl => pl.status !== 'DRAFT' || true)` (`:103-105`) — all PLs including drafts count toward packed qty. Keep that behavior but delete the no-op filter and state it in a comment.
- There is **no** PL-detail → GR path today (`packing-lists/[id]/PLDetailClient.tsx` has only Finalize/Ship/Deliver actions).

### Changes

**A1 — enforce PL before GR (decision 1):**

1. Service (`createGoodsReceipt`): make `packingListId` effectively required — validate (inside the existing transaction or just before it) that the PL exists, belongs to `input.purchaseOrderId`, and `status !== 'DRAFT'`. Throw descriptive errors naming the PL/PO (rule 23). Resolve and write `packingListNumber` from the PL doc (fixes the hardcoded `undefined` at `:187`).
2. New GR page: after PO selection, load the PO's packing lists (`getPackingListsByPO` in `packingListService.ts:395`) and add a required PL `Select` (show `plNumber` + status). Disable submit with a clear message when the PO has no non-draft PL: "Create and finalize a Packing List for this PO first", with a link/button to `/procurement/packing-lists/new?poId=...` (check whether the new-PL page supports a `poId` search param the way the GR page does at `new/page.tsx:102-111`; add the same pattern if missing).
3. PO detail page: in `POHeader.tsx` add a "Create Packing List" button (outlined — rule 34 one-contained-primary) next to "Receive Goods", visible under the same `canReceiveGoods` statuses, navigating to the new-PL page with `poId`.
4. PL detail page (`PLDetailClient.tsx`): once a PL is FINALIZED+, add a "Receive Goods" action linking to `/procurement/goods-receipts/new?poId=<po>&plId=<pl>`; the GR page should pre-select the PL from the `plId` param.
5. While in the service: start passing the caller's permissions so the `INSPECT_GOODS`/fallback check actually runs (`goodsReceiptService.ts:80-87`; caller at `new/page.tsx:222-247`) — rule 5.

**A2 — quantity validations (decision 2):**

1. Service: reject items where `receivedQuantity < 0`; reject a GR whose **total** received quantity is 0 ("Received quantity must be greater than zero"). Per-item over-delivery check already exists — keep it.
2. Service: if **every** PO item has `remaining <= 0`, throw "PO fully received — nothing to receive" before creating anything (mirrors the PL module's behavior).
3. New GR page: exclude fully-received POs from the PO selector (filter in `loadAvailablePOs`, `new/page.tsx:119`), and add client-side guard mirroring the zero-qty rule so users get instant feedback.

**A3 — quantity visibility:**

In the New GR items table (`new/page.tsx:435-444`) add two read-only columns: **Prev. Received** (`item.quantityDelivered || 0`) and **Balance** (`quantity - quantityDelivered`). Keep Received pre-filled with Balance.

**A4 — tests:** extend `goodsReceiptService.test.ts` (existing suite, 82 tests pass as of `9d7ac73b`): PL-required rejection, draft-PL rejection, zero-qty rejection, fully-received rejection, packingListNumber written. Extend `packingListService.test.ts` only if you touch its logic beyond the no-op filter cleanup.

**Caveats:**

- Existing in-flight POs with GRs but no PLs: the next GR on them will now require a PL. That is intended — do not add a bypass.
- Service-type POs get paid via WCC, not GRs; if a service PO somehow reaches the GR flow, the PL requirement applies as-is. Do not special-case.

---

## Batch B — PO view + PDF fixes (`kPmvFXbiYDMrtyZK5VEn`)

Key files: `apps/web/src/app/procurement/pos/[id]/components/POTermsSection.tsx` (view), `apps/web/src/components/pdf/POPDFDocument.tsx` (PDF), `apps/web/src/app/procurement/pos/[id]/edit/EditPOClient.tsx` (edit), types in `packages/types/src/procurement/purchaseOrder.ts`.

1. **Delivery period shows "Weeks from PO Date"** — root cause found: `POTermsSection.tsx:227-231` renders the **deprecated** `terms.deliveryWeeks` (undefined for current POs) with a hardcoded "weeks". Fix: render from `terms.deliveryPeriod` + `terms.deliveryUnit` + `terms.deliveryTrigger` (unit enum `READY_STOCK | DAYS | WEEKS | MONTHS`, `purchaseOrder.ts:285`) — the PDF already does this correctly at `POPDFDocument.tsx:499-514`; mirror it. Keep `deliveryWeeks` as a render-time fallback for old POs only if a real PO needs it (rule 31 — check first).
2. **Service Terms + Safety & Compliance missing from view** — `POTermsSection.tsx` has no block for `terms.serviceTerms` (`POServiceTerms`, `purchaseOrder.ts:443-457`) or `terms.safetyCompliance` (`POSafetyCompliance`, `:463-472`). Add two accordions matching the existing section style (`:140-482`), rendering only when the object is present. The PDF renders both at `POPDFDocument.tsx:529-588` — keep field coverage identical.
3. **PDF payment terms missing tax mode** — the PDF prints only the legacy flat string `po.paymentTerms` (`POPDFDocument.tsx:495`). Render the structured `commercialTerms.paymentSchedule` milestone list instead (each `PaymentMilestone` has `carriesTax?: boolean`, `purchaseOrder.ts:265`) with "+ tax" per milestone — mirror the view's rendering at `POTermsSection.tsx:179-197`. Fall back to the flat string when `paymentSchedule` is empty.
4. **PDF text alignment** — the Financial Summary uses hand-rolled right-floated rows (`summaryLabel` 30% / `summaryValue` 20%, styles `POPDFDocument.tsx:92-126`, used `:406-457`); line-item tables use `ReportTable` with per-column `align` and are fine. Tidy the summary block (consistent label/value column widths so figures align down the page). Compare against Kumaran's screenshots on the feedback item before/after.
5. **HSN special instruction** — append `"HSN Code should be mentioned in the Tax Invoice."` to `DEFAULT_SPECIAL_INSTRUCTIONS` (`POPDFDocument.tsx:162-169`).
6. **Editable line-item description** — PO item descriptions are copied verbatim from the offer (`purchaseOrder/crud.ts:528`) and are read-only `<Typography>` in the edit page (`EditPOClient.tsx:539`); only `specification` and HSN are editable via `handleItemFieldChange`. Make `description` an editable TextField wired through the same `handleItemFieldChange`/save path (edit page is already DRAFT-only, `EditPOClient.tsx:141`). Round-trip test per rule 22.
7. **P&F charges not in PDF** — the computed `packingForwardingAmount` **is** already shown in the totals (`POPDFDocument.tsx:418-425`, shipped with commit `5e451dc6`). What's missing is the terms line: add "Packing & Forwarding: <pfChargeValue>% / lump sum <amount> (included/excluded)" to the Commercial Terms block from `packingForwardingIncluded` / `pfChargeType` / `pfChargeValue` (`purchaseOrder.ts:353-354`). Verify against the deployed build first — if Kumaran's PDF predates `5e451dc6`, part of this is already fixed.
8. **Discount not in PO value** — **verify before coding.** Commit `5e451dc6` already deducts discount pre-tax in `crud.ts:196-246` (`taxableValue = subtotal - discount + P&F`; `grandTotal` net) and the PDF prints a Discount row (`POPDFDocument.tsx:410-417`). View and PDF only display stored fields — no duplicated math. POs created **before** that fix keep gross stored totals. Check the actual PO from Kumaran's screenshots (service account at `mcp-servers/firebase-feedback/service-account-key.json`): if it predates the fix, correct that one record's stored totals (or recreate the PO) rather than writing conversion code (rule 31). If a post-fix PO still shows the problem, debug `crud.ts:196-246`.

**Tests/verification:** type-check + existing PO tests; generate a PO PDF locally (`downloadPOPDF`, `apps/web/src/lib/procurement/poPDF.ts:101-122`) for a PO with milestones+tax, P&F, and discount, and eyeball all 8 items.

---

## Batch C — PO status auto-update (`i7brfS9rrdfGVxRTHHZu`)

### Current wiring (verified)

- State machine `purchaseOrderStateMachine` — `apps/web/src/lib/workflow/stateMachines.ts:57-83`. Note two statuses beyond the feedback's list: `PENDING_FINAL_APPROVAL`, `REJECTED`. `ISSUED → DELIVERED` is **not** currently an allowed transition (`ISSUED: ['ACKNOWLEDGED','IN_PROGRESS','CANCELLED','AMENDED']`, `:65`).
- **Nothing writes `IN_PROGRESS` or `DELIVERED` today.** The only auto-advance is GAP-8 inside `createGoodsReceipt` (`goodsReceiptService.ts:304-312`): sets `COMPLETED` when `deliveryProgress === 100 && paymentProgress === 100`, guarded by `canTransitionTo` — this is the idempotent guard pattern to reuse.
- Payments never touch PO status. The linkage is indirect: `VENDOR_PAYMENT.billAllocations[].invoiceId` → `VENDOR_BILL.purchaseOrderId`. The Cloud Function `syncPOPaymentStatusOnVendorPayment` (`functions/src/procurementPaymentStatus.ts:115`, helper `syncPOPaymentToGRs` `:45-113`) already resolves the affected PO ids — it currently updates GR `paymentStatus` only.
- `createPackingList` (`packingListService.ts:65-241`) reads the PO but never writes it — clean hook point.
- No manual status buttons exist for ACKNOWLEDGED/IN_PROGRESS/DELIVERED/COMPLETED on the PO detail page (`PODetailClient.tsx` handlers: approve/reject/issue/cancel only; cancel uses generic `updatePOStatus`, `workflow.ts:486-515`).

### Changes

**C1 — shared idempotent helper.** In `apps/web/src/lib/procurement/purchaseOrder/workflow.ts` add `advancePOStatusIfAllowed(poId, target, actor)`:

- reads the PO, no-ops (returns false, no throw) unless `purchaseOrderStateMachine.canTransitionTo(current, target)` — idempotent by design (rule 9);
- writes status + `updatedAt/By` and logs `logAuditEvent(... 'PO_UPDATED' ...)` noting the automatic trigger (rule 18);
- exported for use by PL and GR services.

**C2 — `IN_PROGRESS` on Packing List creation.** At the end of `createPackingList` (after the PL doc is written), call `advancePOStatusIfAllowed(purchaseOrderId, 'IN_PROGRESS', ...)`. Fire-and-forget with `.catch(logger.error)` (non-critical, same as task-notification patterns).

**C3 — `IN_PROGRESS` on payment.** Extend the Cloud Function `syncPOPaymentToGRs` (`functions/src/procurementPaymentStatus.ts:45-113`), which already has the poId and PO doc access: when total paid > 0, advance the PO `ISSUED/ACKNOWLEDGED → IN_PROGRESS` using the same `canTransitionTo` guard (import the state machine transition map or replicate the two allowed sources explicitly — functions can't import the web app's `stateMachines.ts`; check whether a shared package location exists before duplicating, rule 32; if none, define the minimal guard locally with a comment pointing at `stateMachines.ts`).

- Skip soft-deleted transactions (rule 3) — verify the function already does; add if not.

**C4 — `DELIVERED` on full receipt; retire auto-`COMPLETED` (decision 3).** In `createGoodsReceipt` replace the GAP-8 block (`goodsReceiptService.ts:304-312`):

- `deliveryProgress === 100` → target `DELIVERED`;
- `deliveryProgress < 100` → target `IN_PROGRESS`;
- remove the auto-`COMPLETED` path entirely (manual now).
- Since this runs inside the existing transaction with the PO doc already loaded, apply the status write in the same `transaction.update` (keep the `canTransitionTo` guard inline rather than calling the helper, to stay transactional).
- Add `'DELIVERED'` to the `ISSUED` transition list in `stateMachines.ts:65` (single-GR full delivery while still ISSUED), with a comment.

**C5 — manual `COMPLETED`.** PO detail page: "Mark Completed" button (visible for `IN_PROGRESS`/`DELIVERED`, `MANAGE_PROCUREMENT`, `useConfirmDialog` — rule 34) calling `updatePOStatus(poId,'COMPLETED',uid)`. Disable/hide in terminal states (rule 10). Status labels: check `@vapour/constants/labels.ts` has PO status labels for all statuses rendered (rule 29).

**C6 — tests.** Unit tests for `advancePOStatusIfAllowed` (allowed, blocked, terminal), GR-creation status targets, and the functions-side guard if functions have a test setup (check `functions/` for existing tests; if none, note it and rely on typed guards).

**Verification:** walk one PO end-to-end in the running app (`/verify` skill): issue → create PL (expect IN_PROGRESS) → GR partial (stays IN_PROGRESS) → GR remainder (expect DELIVERED) → Mark Completed. Note Cloud Function changes only take effect after CI deploy — say so in the feedback note.

---

## Batch D — Return with Comments (`sUjQ9E0O9tS9YZHqEtox`)

### Current mechanics (verified)

- Two sequential named approvers: `submitPOForApproval` (`workflow.ts:30-121`) writes `approverId`/`secondApproverId`; `firstApprovePO` (`:127-217`) moves `PENDING_APPROVAL → PENDING_FINAL_APPROVAL` and notifies approver 2; `approvePO` (`:223-341`) finalizes. Identity-gated via `requireApprover`, not role-based.
- `rejectPO` (`:347-415`) → status `REJECTED`… and **rejected POs are a dead end**: the machine allows `REJECTED → DRAFT` (`stateMachines.ts:64`) but no service/UI performs it; `canEditPO`/`canSubmitForApproval` are DRAFT-only (`purchaseOrderHelpers.ts:59-65`); the edit page hard-rejects non-DRAFT (`EditPOClient.tsx:141`). Also `rejectPO` never notifies the submitter even though the `PO_REJECTED` task category exists unused (`packages/types/src/task.ts:30`).
- **Canonical pattern to copy (rule 32):** proposals' `requestProposalChanges` — `apps/web/src/lib/proposals/approvalWorkflow.ts:454-548` (validate transition → DRAFT, record comments, complete the reviewer's actionable task, informational notification to submitter, audit event).

### Changes

**D1 — state machine.** Add `'DRAFT'` to both `PENDING_APPROVAL` and `PENDING_FINAL_APPROVAL` transition lists (`stateMachines.ts:61-62`) with comment "return for revision".

**D2 — service.** New `returnPOForRevision(poId, userId, userName, comments)` in `workflow.ts`, modeled line-for-line on `requestProposalChanges`:

- Identity gate: from `PENDING_APPROVAL` only `po.approverId`; from `PENDING_FINAL_APPROVAL` only `po.secondApproverId` (mirror `requireApprover` usage in `firstApprovePO`/`approvePO`); `preventSelfApproval` not needed (returning ≠ approving own work) but keep the creator-can't-return guard implicit via requireApprover.
- Transition to `DRAFT` via `validateTransition`; **full restart (decision 4):** clear `firstApprovedBy/Name/At` and `submittedForApprovalAt`; keep `approverId`/`secondApproverId` in place so the resubmit dialog pre-fills, but they get re-confirmed on resubmission.
- Write `returnedBy`, `returnedByName`, `returnedAt`, `returnComments` (required, non-empty). Add these optional fields to the `PurchaseOrder` type.
- Complete the approver's open `PO_PENDING_APPROVAL` task(s) via `findTaskNotificationsByEntity` + `completeActionableTask` (plural finder added in commit `9d7ac73b`, `taskNotificationService.ts`).
- Informational task to `po.submittedBy` — new category `PO_CHANGES_REQUESTED` in `packages/types/src/task.ts` (category union ~`:28-33`, channel maps `:378-380,461`; it is informational, so NOT in `isApprovalCategory` `:512-515`).
- Audit: new event `PO_CHANGES_REQUESTED` in `packages/types/src/audit.ts` (precedent: `PROPOSAL_CHANGES_REQUESTED` at `:178`).

**D3 — UI.**

- `POWorkflowDialogs.tsx`: "Return with Comments" dialog with a required comments TextField (mirror the Reject dialog `:147-181`).
- `POHeader.tsx`: "Return with Comments" button (outlined) next to Approve/Reject for `PENDING_APPROVAL`/`PENDING_FINAL_APPROVAL`. Note existing buttons are status-gated only, with identity enforced server-side — follow the same convention.
- `POApprovalInfo.tsx`: render the return record (who/when/comments) alongside the existing approval/rejection records.
- On a `DRAFT` PO that has `returnComments`, show an info `Alert` banner ("Returned by <name>: <comments>") on the detail and edit pages so the submitter sees what to fix.
- Resubmission needs no new code: return → DRAFT re-enables the existing Edit + Submit-for-Approval actions, and `submitPOForApproval` restarts the two-approver sequence.

**D4 — close the adjacent gaps (small, same files, same feedback intent):**

- `REJECTED` dead end: add a "Revise" button on REJECTED POs (submitter/`MANAGE_PROCUREMENT`) performing `REJECTED → DRAFT` via `updatePOStatus`, so hard-rejected POs are also recoverable.
- `rejectPO`: send the unused `PO_REJECTED` informational notification to `po.submittedBy` with the rejection reason.

**D5 — tests.** Extend the PO workflow tests (find the existing suite for `workflow.ts`; if none, add one following `approvalWorkflow.test.ts` in proposals): return from each stage by the right/wrong user, approval-field clearing, comments required, REJECTED→DRAFT revise.

---

## Definition of done (per batch)

1. Type-check + scoped tests green; `/precommit-fix` checks pass; commit on `main` referencing the feedback ID (see commits `bb936f47`/`9d7ac73b` for message style). No push.
2. Feedback item updated: status `resolved`, admin note with root cause, commit hash, "ships on the next Deploy dispatch", and what Kumaran should retest.
3. Batch C additionally: remind that `functions/**` changes deploy only via the Deploy workflow.
