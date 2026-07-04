# Procurement — User Workflows

> Generated 2026-07-03 from code inspection (routes, services, state machines, Cloud Functions). Part of the [module workflow docs](README.md).

## 1. Module overview

The Procurement module (`apps/web/src/app/procurement/**`, services under `apps/web/src/lib/procurement/**` and `apps/web/src/lib/vendorQuotes/**`) implements a full source-to-pay chain. Every state transition is guarded by a centralized state machine (`apps/web/src/lib/workflow/stateMachines.ts`), separation-of-duties helpers (`requirePermission`, `requireApprover`, `preventSelfApproval` from `@/lib/auth`), and audit logging.

End-to-end chain:

```
Purchase Request (PR)
   └─ createRFQFromPRs ──► RFQ  ──issue──►  vendors respond
                                             └─ Vendor Quote / parsed Offer
                                                  └─ compare offers ─► select winner
                                                       └─ createPOFromOffer ─► Purchase Order (DRAFT)
                                                            └─ submit ─► 1st approval ─► final approval ─► ISSUED
                                                                 ├─ Packing List (shipment tracking)
                                                                 ├─ Goods Receipt (GR)  ─► accounting Bill
                                                                 │      └─ Three-Way Match (PO×GR×Bill) ─► Vendor Bill / payment
                                                                 └─ Work Completion Certificate (for service POs)
```

Cross-module handoffs: GR completion and three-way-match approval push into the **accounting** module (vendor bills, advance payments, vendor payments); Cloud Functions roll procurement status back up to **projects** charter items and roll vendor-payment status back down onto GRs.

Numbering (from `apps/web/src/lib/procurement/generateProcurementNumber.ts`, atomic counter in the `counters` collection):

- **PO** — `PO/YYYY/NNN` (yearly, 3-digit) via `generatePONumber()`
- **GR** — `GR/YYYY/MM/NNNN` (monthly, 4-digit)
- **WCC** — `WCC/YYYY/MM/NNNN` (monthly)
- **Packing List** — `PL/YYYY/MM/NNNN` (monthly)
- **RFQ / PR** use their own generators (not in this file); **Three-Way Match** number is `TWM/YYYY/MM/<epoch>` generated inline in `threeWayMatch/matching.ts` (not the atomic counter — ⚠ potential collision risk if two matches created in the same ms, though `Date.now()` makes this near-impossible in practice).

---

## 2. Per-entity lifecycles & how-to

### 2.1 Purchase Request (PR)

**Lifecycle** (`purchaseRequestStateMachine`, `purchaseRequest/workflow.ts`):

| From                     | Action         | To                          | Who / permission                                                                                       |
| ------------------------ | -------------- | --------------------------- | ------------------------------------------------------------------------------------------------------ |
| —                        | Create         | DRAFT                       | creator (`VIEW_PROCUREMENT` to create/edit)                                                            |
| DRAFT                    | Submit         | SUBMITTED                   | submitter, `VIEW_PROCUREMENT`; must have items + a chosen `approverId` ≠ self                          |
| SUBMITTED                | Add comment    | UNDER_REVIEW                | reviewer                                                                                               |
| SUBMITTED / UNDER_REVIEW | Approve        | APPROVED                    | `MANAGE_PROCUREMENT`, must be designated `approverId`, not submitter; passes project-budget validation |
| SUBMITTED / UNDER_REVIEW | Reject         | REJECTED                    | `MANAGE_PROCUREMENT`, not submitter; reason required                                                   |
| REJECTED                 | Revise         | DRAFT                       | creator                                                                                                |
| APPROVED                 | Convert to RFQ | CONVERTED_TO_RFQ (terminal) | see RFQ flow                                                                                           |

**How to raise a purchase request:** New PR page (`purchase-requests/new/page.tsx`) → fill title/items/project, choose an approver (`ApproverSelector`) → `createPurchaseRequest` writes DRAFT → optionally the same page immediately calls `submitPurchaseRequestForApproval`. Submit enforces: PR must be DRAFT, `itemCount > 0`, `approverId` set, and `preventSelfApproval` (submitter ≠ approver). A `PR_SUBMITTED` actionable task notification is sent to the approver.

**How to approve/reject:** Approver opens the PR detail (`PRDetailClient.tsx`), approves → `approvePurchaseRequest` runs `validateProjectBudget`, sets status APPROVED, flips all PR items to APPROVED (batch), auto-completes the review task, notifies submitter. Reject → `rejectPurchaseRequest` (reason mandatory) flips items to REJECTED.

Automatic side effect: PR approval does **not** itself notify projects; project charter status `PR_DRAFTED` is a charter-side value (see §3).

---

### 2.2 RFQ

**Lifecycle** (`rfqStateMachine`, `rfq/workflow.ts`):

| From                                                | Action                | To                      | Who / permission                                       |
| --------------------------------------------------- | --------------------- | ----------------------- | ------------------------------------------------------ |
| —                                                   | Create from PRs       | DRAFT                   | `createRFQFromPRs` (server-gated `MANAGE_PROCUREMENT`) |
| DRAFT                                               | Issue to vendors      | ISSUED                  | `issueRFQ`, `MANAGE_PROCUREMENT`                       |
| ISSUED                                              | First offer arrives   | OFFERS_RECEIVED         | `incrementOffersReceived` (system)                     |
| OFFERS_RECEIVED                                     | All offers evaluated  | UNDER_EVALUATION        | `incrementOffersEvaluated` (system)                    |
| OFFERS_RECEIVED / UNDER_EVALUATION                  | Select winning quote  | COMPLETED               | `completeRFQ` / `selectVendorQuote`                    |
| COMPLETED / OFFERS_RECEIVED / UNDER_EVALUATION      | PO created from offer | PO_PROCESSED (terminal) | `createPOFromOffer` (auto)                             |
| DRAFT / ISSUED / OFFERS_RECEIVED / UNDER_EVALUATION | Cancel                | CANCELLED (terminal)    | `cancelRFQ`, `MANAGE_PROCUREMENT`                      |

**How to float an RFQ:** From approved PRs, select PRs + vendors on the RFQ new page → `createRFQFromPRs` gathers APPROVED/PENDING PR items into RFQ items, creates the RFQ (DRAFT), and flips the source PRs to `CONVERTED_TO_RFQ` (best-effort batch). Then on `RFQDetailClient.tsx` click **Issue** → `issueRFQ` sets ISSUED, stamps `sentToVendorsAt`, audit-logs vendor count. Cloud Function then marks project charter items `RFQ_ISSUED` (§3).

Notifications: on first offer, an informational `RFQ_OFFER_RECEIVED` task to the RFQ creator; when `offersReceived === vendorIds.length`, an actionable `RFQ_READY_FOR_EVALUATION` task.

---

### 2.3 Vendor Quote / Offer (unified `vendorQuotes` collection)

**Lifecycle** (`offerStateMachine`, keyed on `QuoteStatus`; `vendorQuoteWorkflow.ts`):

| From                                | Action                             | To                  | Who / permission                                        |
| ----------------------------------- | ---------------------------------- | ------------------- | ------------------------------------------------------- |
| —                                   | Create (no items)                  | DRAFT               | `createVendorQuote`                                     |
| —                                   | Create (with items) / upload offer | UPLOADED            | `createVendorQuote` (default when items present)        |
| UPLOADED                            | Start review                       | UNDER_REVIEW        | procurement                                             |
| UPLOADED / UNDER_REVIEW             | Evaluate                           | EVALUATED           | `evaluateVendorQuote`                                   |
| UPLOADED / UNDER_REVIEW / EVALUATED | Select                             | SELECTED            | `selectVendorQuote`, `MANAGE_PROCUREMENT`               |
| any active                          | Reject                             | REJECTED            | `rejectVendorQuote`, `MANAGE_PROCUREMENT`, not uploader |
| any active                          | Withdraw                           | WITHDRAWN           | `withdrawVendorQuote`, `MANAGE_PROCUREMENT`             |
| SELECTED                            | PO created                         | PO_CREATED          | `createPOFromOffer` (auto)                              |
| PO_CREATED / REJECTED / WITHDRAWN   | Archive                            | ARCHIVED (terminal) | —                                                       |

**How to record a vendor quote:**

- _RFQ response:_ On `RFQDetailClient.tsx` (RFQ in ISSUED/OFFERS_RECEIVED) click **Upload Offer** → the file is sent to the `parseOffer` Cloud Function (Claude AI, `functions/src/offerParsing/parseOffer.ts` → `parseOfferWithClaude.ts`) which extracts header + line items and matches them to RFQ items by line number / fuzzy description, returning parsed data (and logging an `OFFER_PARSING_JOBS` record). The client then calls `createVendorQuote` with `sourceType='RFQ_RESPONSE'` and the `rfqId`, which trips `incrementOffersReceived`.
- _Standing / unsolicited:_ `quotes/new-standing` and `quotes/new` create quotes not linked to an RFQ (`rfqIdIsNull`). Evaluating a quote with a linked `vendorId` records budgetary prices to the material DB (`recordProcurementPrices`, fire-and-forget).

**How to evaluate:** `evaluateVendorQuote` sets EVALUATED with score/notes/redFlags and increments the RFQ evaluated counter. `markVendorQuoteAsRecommended` marks one quote recommended and clears the flag on siblings.

**How to compare offers & select:** `getVendorQuoteComparison` (offer comparison page `rfqs/[id]/offers/OfferComparisonClient.tsx`) builds a per-RFQ-line matrix (unit price, total, delivery, meets-spec, deviations, red flags, lowest price). Two actions per offer: **Select** → `selectVendorQuote` (marks winner SELECTED, all other live quotes REJECTED, moves RFQ to COMPLETED, captures an optional justification note); **Create PO** → routes to `/procurement/pos/new?offerId=…`.

---

### 2.4 Purchase Order (PO) — two-tier approval

**Lifecycle** (`purchaseOrderStateMachine`, `purchaseOrder/workflow.ts`):

| From                                      | Action                                  | To                                               | Who / permission                                                                           |
| ----------------------------------------- | --------------------------------------- | ------------------------------------------------ | ------------------------------------------------------------------------------------------ |
| —                                         | Create from offer                       | DRAFT                                            | `createPOFromOffer`, `MANAGE_PROCUREMENT` (idempotent)                                     |
| DRAFT                                     | Submit for approval                     | PENDING_APPROVAL                                 | `submitPOForApproval`, `MANAGE_PROCUREMENT`; picks 2 distinct approvers, neither = creator |
| PENDING_APPROVAL                          | First approval                          | PENDING_FINAL_APPROVAL                           | `firstApprovePO`, **identity-gated**: must be `approverId`, not creator                    |
| PENDING_FINAL_APPROVAL                    | Final approval                          | APPROVED                                         | `approvePO`, **identity-gated**: must be `secondApproverId`, ≠ creator, ≠ first approver   |
| PENDING_APPROVAL / PENDING_FINAL_APPROVAL | Reject                                  | REJECTED                                         | `rejectPO`: `MANAGE_PROCUREMENT` **or** a designated approver, not creator                 |
| REJECTED                                  | Revise                                  | DRAFT                                            | creator                                                                                    |
| APPROVED                                  | Issue                                   | ISSUED                                           | `issuePO`, `MANAGE_PROCUREMENT`                                                            |
| ISSUED                                    | Acknowledge / progress / amend / cancel | ACKNOWLEDGED / IN_PROGRESS / AMENDED / CANCELLED | `updatePOStatus` / amendment                                                               |
| ACKNOWLEDGED / IN_PROGRESS                | Deliver / complete / amend              | DELIVERED / COMPLETED / AMENDED                  | GR flow / `updatePOStatus`                                                                 |
| DELIVERED                                 | Complete                                | COMPLETED (terminal)                             | auto on full delivery+payment                                                              |
| DRAFT/PENDING_APPROVAL/APPROVED/ISSUED    | Cancel                                  | CANCELLED (terminal)                             | —                                                                                          |

**How to create a PO:** From the offer comparison, **Create PO** → PO new page (`pos/new/page.tsx`) loads the offer, applies commercial terms, and calls `createPOFromOffer`. That function (idempotent via `withIdempotency`): rejects duplicates (`offer.status==='PO_CREATED'`), requires a registered `vendorId`, recomputes subtotal/discount/P&F/GST (state-aware CGST+SGST vs IGST via `calculateGST`, rounding to paisa per rule 21), generates the PO number, marks the source quote `PO_CREATED`, and transitions the RFQ to `PO_PROCESSED`. New PO starts in **DRAFT**.

**How to approve a PO (Manager → Director):** Submitter opens `PODetailClient.tsx`, **Submit for Approval**, and picks two distinct approvers (`selectedApproverId`, `selectedSecondApproverId`) via the submit dialog (`useWorkflowDialogs.ts`) — neither may be the creator. `submitPOForApproval` sets PENDING_APPROVAL and notifies approver 1 (`PO_PENDING_APPROVAL`). Approver 1 opens the PO (status PENDING_APPROVAL → dialog `approvalStage='FIRST'`) and approves → `firstApprovePO` (runs in a transaction, validates transition, `requireApprover`) sets PENDING_FINAL_APPROVAL and notifies approver 2. Approver 2 approves → `approvePO` (transaction) sets APPROVED; if `advancePaymentRequired` and a bank account was chosen, it calls `createAdvancePaymentFromPO` (accounting) and stamps `advancePaymentStatus`. Either approver or a procurement manager can **Reject** (→ REJECTED, revisable back to DRAFT).

**How to issue:** From APPROVED, **Issue** → `issuePO` sets ISSUED (requires `MANAGE_PROCUREMENT`), stamps `issuedAt/issuedBy`. Cloud Function then rolls the project charter item to `PO_PLACED` (§3).

---

### 2.5 Packing List

**Lifecycle** (`packingListStateMachine`, `packingListService.ts`): `DRAFT → FINALIZED → SHIPPED → DELIVERED` (terminal). Status changes via `updatePackingListStatus` (stamps `shippedDate` / `actualDeliveryDate`, audit-logs each transition).

**How to create:** `packing-lists/new` → `createPackingList` validates packed quantity per item does not exceed remaining PO quantity (sums prior PLs), generates PL number, writes PL + items (DRAFT). Editable only while DRAFT (`updatePackingList`); vendor shipping docs can be attached (`uploadPLAttachment`). No permission flag is enforced client-side (rule5-exempt; relies on Firestore rules `MANAGE_PROCUREMENT`).

---

### 2.6 Goods Receipt (GR)

**Lifecycle** (`goodsReceiptStateMachine`, `goodsReceiptService.ts`): `PENDING → IN_PROGRESS → COMPLETED`; `IN_PROGRESS ↔ ISSUES_FOUND`. Note: `createGoodsReceipt` writes the GR directly at **IN_PROGRESS** (skips PENDING).

| From                       | Action              | To                          | Who / permission                                                |
| -------------------------- | ------------------- | --------------------------- | --------------------------------------------------------------- |
| —                          | Create GR           | IN_PROGRESS                 | `createGoodsReceipt`, `INSPECT_GOODS` (`PERMISSION_FLAGS_2`)    |
| IN_PROGRESS / ISSUES_FOUND | Complete            | COMPLETED                   | `completeGR`, `APPROVE_GR` (else fallback `MANAGE_PROCUREMENT`) |
| COMPLETED                  | Approve for payment | (flag `approvedForPayment`) | `approveGRForPayment`, `MANAGE_ACCOUNTING`, not inspector       |

**How to receive goods:** `goods-receipts/new` → `createGoodsReceipt` (idempotent). In one transaction it: validates no over-delivery (received ≤ remaining, accepted/rejected ≤ received), creates GR + GR items, increments PO-item `quantityDelivered/Accepted/Rejected` + per-item `deliveryStatus`, recomputes PO `deliveryProgress`, and auto-sets PO `COMPLETED` when delivery=100% and payment=100%. `overallCondition` is derived (ACCEPTED / CONDITIONALLY_ACCEPTED / REJECTED). If any item has issues, a `GR_ITEMS_REJECTED` task fires to the PO creator.

**How to complete a GR:** On `GRDetailClient.tsx` → `completeGR` (transaction) sets COMPLETED and calls `createBillFromGoodsReceipt` (accounting; non-fatal on error). It then fires two tasks: `THREE_WAY_MATCH_READY` and `GR_READY_FOR_PAYMENT` to the PO creator. Cloud Function rolls charter item to `DELIVERED` (§3).

**How to approve payment:** `approveGRForPayment` validates the bank account, requires status COMPLETED + a bill exists + `preventSelfApproval` (approver ≠ inspector), sets `approvedForPayment`, and calls `createPaymentFromApprovedReceipt` (accounting). GR-level editing after creation is limited to metadata (`updateGoodsReceiptMetadata`); line quantities are locked once created.

---

### 2.7 Three-Way Match

**Lifecycle** (no state machine; `status` derived at creation + `approvalStatus`; `threeWayMatch/matching.ts`, `threeWayMatch/workflow.ts`):

- `status`: `MATCHED` / `PARTIALLY_MATCHED` / `NOT_MATCHED` / `PENDING_REVIEW` (computed from discrepancies & tolerance).
- `approvalStatus`: `PENDING → APPROVED | REJECTED` (only set when `requiresApproval`).

**How to run a three-way match:** `three-way-match/new` → `performThreeWayMatch(poId, grId, vendorBillId, …)` requires `MANAGE_PROCUREMENT`. It matches invoice lines → PO items (exact, then substring, then significant-word fuzzy) → GR items, computes qty/price/amount variances against a tolerance config, flags discrepancies with severity (2× tolerance = HIGH; missing PO/GR item = CRITICAL), and writes the match + line items + discrepancies. `requiresApproval` is set when out of tolerance, any discrepancy exists, or amount exceeds the auto-approve max.

**How to approve/reject a match:** `ThreeWayMatchDetailClient.tsx` → `approveMatch` (`MANAGE_PROCUREMENT`, `preventSelfApproval` vs match creator) sets `approvalStatus=APPROVED`, `resolved=true`, and calls `createVendorBillFromMatch` (accounting `vendorBillIntegrationService`), storing `vendorBillId` back on the match. `rejectMatch` sets REJECTED with reason. Both audit-log.

---

### 2.8 Work Completion Certificate (WCC)

No status field / state machine — a WCC is a one-shot issued certificate (`workCompletionService.ts`).

**How to issue a WCC:** `work-completion/new` → `createWorkCompletionCertificate` reads the PO, inherits `tenantId`, generates the WCC number, records work description, completion date, the three attestation flags (`allItemsDelivered`, `allItemsAccepted`, `allPaymentsCompleted`), and certificate text. It fires a `WCC_READY_FOR_BILLING` actionable task to the PO creator to raise a bill in accounting. ⚠ The task `linkUrl` is `/procurement/work-completions/{id}` but the route is `/procurement/work-completion/[id]` (singular) — the notification deep-link is broken.

---

### 2.9 PO Amendment

**Lifecycle** (`amendmentStateMachine`, `amendment/crud.ts`): `DRAFT → PENDING_APPROVAL → APPROVED | REJECTED` (both terminal; rejected amendments are re-raised, not reopened).

| From             | Action                | To               | Who / permission                                                                                 |
| ---------------- | --------------------- | ---------------- | ------------------------------------------------------------------------------------------------ |
| —                | Create against a PO   | DRAFT            | `createAmendment`; PO must be APPROVED/ISSUED/ACKNOWLEDGED/IN_PROGRESS/AMENDED                   |
| DRAFT            | Edit                  | DRAFT            | `updateAmendment`, `MANAGE_PROCUREMENT`                                                          |
| DRAFT            | Submit                | PENDING_APPROVAL | `submitAmendmentForApproval`; **`approverId` mandatory & ≠ requester**                           |
| PENDING_APPROVAL | Approve (apply to PO) | APPROVED         | `approveAmendment`, `MANAGE_PROCUREMENT`, `preventSelfApproval`, must be designated `approverId` |
| PENDING_APPROVAL | Reject                | REJECTED         | `rejectAmendment`, `MANAGE_PROCUREMENT`, not requester                                           |

**How to amend a PO:** `amendments/new` → `createAmendment` records field changes, amendment type, and financial impact (`previousGrandTotal`, `newGrandTotal`, `totalChange`) as DRAFT #N. On `AmendmentDetailClient.tsx` → **Submit for Approval** opens a dialog with an `ApproverSelector`; `submitAmendmentForApproval` (transaction, idempotent) requires a distinct approver, records `AMENDMENT_APPROVAL_HISTORY`, and notifies the approver. Approve → `approveAmendment` takes a version snapshot (`createVersionSnapshot`), applies whitelisted field changes to the PO (only fields in `ALLOWED_AMENDMENT_FIELDS` — financial, terms, delivery, header, advance-payment), sets PO `status=AMENDED` + `lastAmendmentNumber`, and records history with per-field diffs. `applied` guards against double-apply.

> Note: the previously suspected "amendment approver assignment gap" is **not** currently broken in code — the approver is selected in the submit dialog, persisted (`approverId/approverName`), enforced at approve time via `requireApprover`, and self-approval is blocked. ⚠ The only residual risk: the state machine allows no `PENDING_APPROVAL → DRAFT` return path, so an amendment submitted to a wrong/unavailable approver can only be rejected (terminal) and re-raised, never recalled to DRAFT.

---

## 3. Automatic behaviours & cross-module handoffs

**Cloud Functions — procurement → projects** (`functions/src/procurementProjectSync.ts`, region `us-central1`):

- `onPOStatusSyncToProject`: PO status change → charter item status (ISSUED/ACKNOWLEDGED/IN_PROGRESS → `PO_PLACED`; DELIVERED/COMPLETED → `DELIVERED`; CANCELLED → `CANCELLED`). Runs in a transaction, never downgrades status (priority-ranked).
- `onRFQStatusSyncToProject`: RFQ → ISSUED sets charter item `RFQ_ISSUED`.
- `onGoodsReceiptSyncToProject`: GR → COMPLETED/VERIFIED looks up the PO's projects and sets charter items `DELIVERED`.

**Cloud Function — accounting → GR payment status** (`functions/src/procurementPaymentStatus.ts`): on any `VENDOR_PAYMENT` transaction write, it finds affected bills → POs, sums each PO's `VENDOR_BILL.paidAmount`, and stamps every GR of that PO with `paymentStatus` (`PENDING` / `APPROVED` / `PARTLY_CLEARED` / `CLEARED`) + `totalPaidAgainstPO`. This drives the PO auto-complete condition in `createGoodsReceipt`.

**Offer parsing** (`functions/src/offerParsing/parseOffer.ts`, `parseQuote.ts` — callable `onCall`, region `asia-south1`, Claude via `anthropicApiKey` secret): extracts offer/quote header + line items from an uploaded document and matches them to RFQ line items; returns parsed data to the client (which creates the vendor quote) and logs an `OFFER_PARSING_JOBS` record with status COMPLETED/FAILED.

**In-app notifications** (task notification service, not email): PR submit/approve/reject/comment; RFQ offer-received & ready-for-evaluation; PO pending-approval (per approver step); GR items-rejected, ready-for-payment, three-way-match-ready, payment-approved; WCC ready-for-billing; amendment pending-approval. No outbound email sending is wired in these paths (RFQ "send to vendors" is a status stamp + `// Future: Send notifications` comment only).

**Accounting handoffs:** advance payment on PO final approval (`createAdvancePaymentFromPO`); vendor bill on GR completion (`createBillFromGoodsReceipt`); vendor payment on GR payment approval (`createPaymentFromApprovedReceipt`); vendor bill on three-way-match approval (`createVendorBillFromMatch`). All are best-effort — failures are logged and the bill/payment "can be created manually."

---

## 4. Permissions required (per action)

| Action                           | Function                                                          | Permission / gate                                                   |
| -------------------------------- | ----------------------------------------------------------------- | ------------------------------------------------------------------- |
| Create/edit/submit PR            | `createPurchaseRequest` / `submitPurchaseRequestForApproval`      | `VIEW_PROCUREMENT`; submit also needs items + distinct `approverId` |
| Approve / reject PR              | `approvePurchaseRequest` / `rejectPurchaseRequest`                | `MANAGE_PROCUREMENT` + designated approver, not submitter           |
| Create RFQ from PRs              | `createRFQFromPRs`                                                | `MANAGE_PROCUREMENT` (Firestore rules)                              |
| Issue / cancel RFQ               | `issueRFQ` / `cancelRFQ`                                          | `MANAGE_PROCUREMENT`                                                |
| Create / evaluate vendor quote   | `createVendorQuote` / `evaluateVendorQuote`                       | procurement (rules `MANAGE_PROCUREMENT`)                            |
| Select / reject / withdraw quote | `selectVendorQuote` / `rejectVendorQuote` / `withdrawVendorQuote` | `MANAGE_PROCUREMENT`; reject/withdraw not by uploader               |
| Create PO from offer             | `createPOFromOffer`                                               | `MANAGE_PROCUREMENT`                                                |
| Submit PO for approval           | `submitPOForApproval`                                             | `MANAGE_PROCUREMENT` + 2 distinct approvers ≠ creator               |
| First approval                   | `firstApprovePO`                                                  | identity = `approverId`, not creator                                |
| Final approval                   | `approvePO`                                                       | identity = `secondApproverId`, ≠ creator, ≠ first approver          |
| Reject PO                        | `rejectPO`                                                        | `MANAGE_PROCUREMENT` **or** designated approver, not creator        |
| Issue PO / update status         | `issuePO` / `updatePOStatus`                                      | `MANAGE_PROCUREMENT`                                                |
| Create packing list / status     | `createPackingList` / `updatePackingListStatus`                   | `MANAGE_PROCUREMENT` (rules)                                        |
| Create GR                        | `createGoodsReceipt`                                              | `INSPECT_GOODS` (`PERMISSION_FLAGS_2`)                              |
| Complete GR                      | `completeGR`                                                      | `APPROVE_GR` (`PERMISSION_FLAGS_2`), fallback `MANAGE_PROCUREMENT`  |
| Approve GR for payment           | `approveGRForPayment`                                             | `MANAGE_ACCOUNTING`, not inspector                                  |
| Perform three-way match          | `performThreeWayMatch`                                            | `MANAGE_PROCUREMENT`                                                |
| Approve / reject match           | `approveMatch` / `rejectMatch`                                    | `MANAGE_PROCUREMENT`, not match creator                             |
| Create WCC                       | `createWorkCompletionCertificate`                                 | procurement (rules `MANAGE_PROCUREMENT`)                            |
| Create / edit amendment          | `createAmendment` / `updateAmendment`                             | `MANAGE_PROCUREMENT`                                                |
| Submit amendment                 | `submitAmendmentForApproval`                                      | approver required, ≠ requester                                      |
| Approve / reject amendment       | `approveAmendment` / `rejectAmendment`                            | `MANAGE_PROCUREMENT`, designated approver, not requester            |

---

## ⚠ Known gaps / things to verify

1. **WCC notification deep-link mismatch** — `createWorkCompletionCertificate` links to `/procurement/work-completions/{id}` but the actual route is `work-completion` (singular). Broken link.
2. **Three-way match number is not counter-based** — `TWM/YYYY/MM/<Date.now()>` in `matching.ts` bypasses the atomic `generateProcurementNumber`; theoretically collision-prone (practically negligible), and not zero-padded/sequential like other docs.
3. **Amendment cannot be recalled** — `PENDING_APPROVAL` only transitions to APPROVED or REJECTED (both terminal); a mis-addressed amendment must be rejected and re-raised.
4. **GR "PENDING" state is unused on the happy path** — `createGoodsReceipt` writes directly at IN_PROGRESS, so the `PENDING → IN_PROGRESS` edge in the state machine is effectively dead for the standard create flow.
5. **Accounting integrations are best-effort** — advance payment, bill, and payment creation all swallow errors and rely on manual accounting fallback; a silent failure leaves a completed GR/approved PO without its downstream bill/payment.
6. **RFQ "send to vendors" is not an actual send** — `issueRFQ` only stamps `sentToVendorsAt`; PDF generation and vendor email are `// Future` comments.

_(All claims grounded in: `stateMachines.ts`; `purchaseRequest/workflow.ts`; `rfq/workflow.ts` & `rfq/crud.ts`; `vendorQuotes/vendorQuoteWorkflow.ts` & `vendorQuoteService.ts`; `purchaseOrder/workflow.ts` & `crud.ts`; `goodsReceiptService.ts`; `threeWayMatch/matching.ts` & `workflow.ts`; `workCompletionService.ts`; `packingListService.ts`; `amendment/crud.ts`; `generateProcurementNumber.ts`; `functions/src/procurementProjectSync.ts`, `procurementPaymentStatus.ts`, `offerParsing/_`; and the corresponding `app/procurement/\*_` detail clients.)_
