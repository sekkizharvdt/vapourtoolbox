# Implementation Plan — RFQ Upload-Offer, PO & PO-Amendment Review

**Date:** 2026-05-25
**Source:** `inputs/RFQ upload offer process, PO & Amendment Module review.pdf` (procurement user, round 3)
**Status:** ✅ COMPLETE — all phases A–E shipped 2026-05-26 (A: `2cca66e7`, B: `5e451dc6`, C: `babdaad7`/`ab96d1ee`/`cbb34a83`/`a3877396`, D: `a4e4f527`/`db71ad5f`/`3099e193`, E: `6f820805`/`4041a3b0`/`fe0fa7d8`). Note: E2's Manager→Director role tiers were later superseded by submitter-chosen named approvers (`07ef7df9`).
**Prior reviews:** `inputs/Procurement_Toolbox_Review.pdf`, `inputs/Quote module - toolbox.pdf`, `inputs/Quotes Module Review 2.pdf`

---

## 1. Context & overall assessment

The flows largely work: vendor-offer upload, Claude parsing, Check-Against-Spec, comparison, selection, and Create-PO are all confirmed functional by the user. The findings divide into:

- **One workflow-blocking cluster** — the PO Amendment approval path was never fully wired (no approver assignment, no edit route, self-approval deadlock). The module cannot complete a single approval today.
- **Two financial-math bugs** — PO discount and P&F charges are captured but never enter the totals, so PO grand totals are wrong.
- **A larger set of additive commercial-terms fields and UX refinements** — these batch well because they share editing/display/PDF surfaces.

This plan is organised into five phases (A–E) ordered by urgency. Each item is cross-referenced to the source document's numbering (e.g. `2.2a`).

---

## 2. Decisions locked with the user (2026-05-25)

| #   | Decision                   | Choice                                                                                  | Implication                                                                                                                         |
| --- | -------------------------- | --------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------- |
| D1  | Discount math model (2.2a) | **Pre-tax** — discount reduces the taxable base; GST recomputed on the discounted value | Tax must be recalculated, not just a line subtracted at the end. Today tax is computed on the full subtotal.                        |
| D2  | PO approval routing (2.3)  | **Two-tier: Procurement Manager → Director**                                            | New Director permission flag + an extra state-machine step (`PENDING_MANAGER_APPROVAL` → `PENDING_DIRECTOR_APPROVAL` → `APPROVED`). |

---

## 3. Triage summary

| Priority    | Items                                               | Theme                                      |
| ----------- | --------------------------------------------------- | ------------------------------------------ |
| 🔴 **P0**   | 3.2a, 3.2b, 3.2c                                    | Amendment module unusable (one root cause) |
| 🟠 **P1**   | 2.2a, 2.2b                                          | PO financial math wrong (rule 21)          |
| 🟡 **P1.5** | 2.2c, 2.2d                                          | Tax payment-stage data-model gap           |
| 🟢 **P2**   | 2.3 (8 fields), 1.3 (3 items), 3.3 (2 items)        | Commercial-terms enrichment + UX           |
| 🔵 **P3**   | 2.3/3.3 email, 1.2 Document AI, 1.2 selection error | Cross-cutting + low-confidence             |

---

## Phase A — Unblock the Amendment module (🔴 P0)

**Why first:** the module cannot complete an approval. 3.2a/b/c are one root cause: the approval path was never finished.

### A1. Add approver assignment (3.2b — root cause)

- **Type:** add `approverId?: string` (+ `approverName?`) to `PurchaseOrderAmendment` in [`packages/types/src/procurement/amendments.ts`](packages/types/src/procurement/amendments.ts). Mirror the PO pattern (`approverId` already exists on `PurchaseOrder`).
- **Service:** extend `submitAmendmentForApproval()` in [`apps/web/src/lib/procurement/amendment/crud.ts`](apps/web/src/lib/procurement/amendment/crud.ts#L155) to accept and persist `approverId`, and create a task notification for that approver (reuse `createTaskNotification` from [`apps/web/src/lib/tasks/taskNotificationService.ts`](apps/web/src/lib/tasks/taskNotificationService.ts), as PO does in [`purchaseOrder/workflow.ts:83-100`](apps/web/src/lib/procurement/purchaseOrder/workflow.ts#L83-L100)).
- **UI:** add `ApproverSelector` ([`apps/web/src/components/common/forms/ApproverSelector.tsx`](apps/web/src/components/common/forms/ApproverSelector.tsx)) to the submit-for-approval dialog in [`AmendmentDetailClient.tsx`](apps/web/src/app/procurement/amendments/[id]/AmendmentDetailClient.tsx#L123-L138).
- **Outcome:** 3.2c (self-approval error) disappears automatically — once a _different_ approver can be assigned, `preventSelfApproval()` ([`authorizationService.ts:222`](apps/web/src/lib/auth/authorizationService.ts#L222)) no longer blocks the only path forward.

### A2. Register the amendment state machine (rule 8 / rule 17)

- The amendment status flow (`DRAFT → PENDING_APPROVAL → APPROVED/REJECTED`) is currently hand-rolled inline in `crud.ts` and **absent** from [`stateMachines.ts`](apps/web/src/lib/workflow/stateMachines.ts).
- Define `amendmentStateMachine` there and validate transitions with `requireValidTransition()` in submit/approve/reject. Status type stays in [`amendments.ts`](packages/types/src/procurement/amendments.ts).

### A3. Add the missing edit route (3.2a — rule 28, rule 30)

- Create `apps/web/src/app/procurement/amendments/[id]/edit/page.tsx` + client. `getAmendmentAvailableActions()` already returns `canEdit:true` for `DRAFT` ([`amendmentHelpers.ts:105-113`](apps/web/src/lib/procurement/amendmentHelpers.ts#L105-L113)) — the page just doesn't exist.
- **Rule 30:** read the id via `usePathname()`, not `useParams()` (static-export gotcha). Follow [`BOMEditorClient.tsx`](apps/web/src/app/estimation/[id]/BOMEditorClient.tsx).
- **Rule 22:** restore every saved field in the edit reset effect (reason, change-set, etc.).
- Wire the "Edit" button on `AmendmentDetailClient` to route here for draft amendments.

### A4. Firestore rules & indexes (rule 2, rule 4)

- Verify the amendments collection rule matches the permission model and that any new `where + orderBy` introduced by the edit/list flows has a composite index in `firestore.indexes.json`.

**Effort:** ~1.5–2 days. **Acceptance:** create draft → edit → submit (assign a different approver) → that approver approves → amendment reaches `APPROVED` and the PO version snapshot is written via [`versioning.ts`](apps/web/src/lib/procurement/amendment/versioning.ts).

---

## Phase B — Fix PO financial math (🟠 P1, rule 21)

### B1. Deduct discount, pre-tax (2.2a — decision D1)

- **Root cause (verified):** `calculateOfferTotals()` computes `totalAmount = subtotal + taxAmount` with discount never subtracted ([`offerHelpers.ts:401-412`](apps/web/src/lib/procurement/offerHelpers.ts#L401-L412)); `createPOFromOffer()` copies `offer.subtotal/taxAmount/totalAmount` verbatim ([`crud.ts:178-186`](apps/web/src/lib/procurement/purchaseOrder/crud.ts#L178-L186)); and [`FinancialSummarySection.tsx`](apps/web/src/app/procurement/pos/[id]/components/FinancialSummarySection.tsx) never renders the discount.
- **Fix (pre-tax model):**
  - `taxableBase = roundToPaisa(subtotal − discount)`
  - recompute GST on `taxableBase` (preserve CGST/SGST/IGST split)
  - `grandTotal = roundToPaisa(taxableBase + tax)`
  - round at every step (rule 21).
- **Surfaces to update:** the totals computation (offer→PO), [`FinancialSummarySection.tsx`](apps/web/src/app/procurement/pos/[id]/components/FinancialSummarySection.tsx) (add a **Discount (−)** line between Subtotal and tax), and the PO PDF ([`apps/web/src/lib/procurement/poPDF.ts`](apps/web/src/lib/procurement/poPDF.ts) / [`POPDFDocument.tsx`](apps/web/src/components/pdf/POPDFDocument.tsx)).
- **Decide:** whether to recompute on the offer at parse time or only at PO creation. Recommend recomputing at PO creation so the offer stays a faithful record of what the vendor quoted, and the discount is applied as the buyer's negotiated reduction.

### B2. Reflect P&F charges (2.2b)

- `pfChargeType`/`pfChargeValue` are captured in [`CommercialTermsForm.tsx:339-375`](apps/web/src/components/procurement/CommercialTermsForm.tsx#L339-L375) but never feed totals.
- Compute the P&F amount (`LUMPSUM` → value; `PERCENTAGE` → % of taxable base) and add it into the financial summary + PDF. **Decide** P&F's tax treatment with the user (P&F is normally taxable → add to taxable base before GST). Flag this as a sub-question before coding.

**Effort:** ~1–1.5 days. **Acceptance:** a PO with a discount and P&F shows both as lines, and grand total = `(subtotal − discount + P&F) + GST-on-that-base`, matching the PDF.

---

## Phase C — PO commercial-terms enrichment (🟢 P2)

All additive fields on `POCommercialTerms` ([`purchaseOrder.ts:264-331`](packages/types/src/procurement/purchaseOrder.ts#L264-L331)), edited in [`CommercialTermsForm.tsx`](apps/web/src/components/procurement/CommercialTermsForm.tsx), displayed in [`POTermsSection.tsx`](apps/web/src/app/procurement/pos/[id]/components/POTermsSection.tsx), rendered in the PDF, and mapped from the offer in [`commercialTerms/defaults.ts`](apps/web/src/lib/procurement/commercialTerms/defaults.ts#L290-L368). **All new labels go through [`packages/constants/src/labels.ts`](packages/constants/src/labels.ts) (rule 29).** Batch these:

| Doc | Field addition                                                               |
| --- | ---------------------------------------------------------------------------- |
| 2.3 | Ex-Works **location** sub-field (free text, e.g. Chennai)                    |
| 2.3 | Transport: **transporter name** + delivery type (godown/door)                |
| 2.3 | Freight: freight type + **Prepaid/To-pay** when customer scope               |
| 2.3 | Erection (vendor scope): sub-options for transport / food / accommodation    |
| 2.3 | Transit insurance: dispatch-details / open-policy instruction                |
| 2.3 | Inspection: **vendor-documents-required list** + stage/final inspection type |
| 2.3 | **Post Order Documents** list (GAD / Datasheet / QAP — extensible)           |

### C1. Warranty (2.3 — _partly a bug_)

- Clause is hard-coded as "...whichever is **later**" and renders garbage like _"0 months from supply or 0 months from commissioning, whichever is later"_ when warranty is N/A ([`new/page.tsx:241`](apps/web/src/app/procurement/pos/new/page.tsx#L241)).
- Add: `warrantyApplicable: boolean` (enable only when relevant), an **earlier/later** toggle, and a clause-builder that omits zero terms and produces correct text. This is the one item in Phase C that fixes broken output, so prioritise it within the phase.

### C2. Terms presentation (2.3)

- Map RFQ-offer terms into their **respective** sections rather than one cumulative block, and **dedup** billing/delivery addresses (front page vs T&C). `POTermsSection` already uses per-section accordions — the cumulative complaint is likely the new-PO reference Alert and the derive mapping; confirm against the user's screenshot expectation before restructuring.

**Effort:** ~3–4 days (field-by-field; warranty + presentation are the heaviest). **Acceptance:** rule 22 round-trip (create → save → edit → save) preserves every new field; PDF renders each correctly.

---

## Phase D — RFQ & amendment UX improvements (🟢 P2)

### D1. Offer discount — percentage option (1.3)

- Header discount is amount-only ([`UploadOfferDialog.tsx:1427`](apps/web/src/components/procurement/UploadOfferDialog.tsx#L1427)). Add an amount/percentage toggle. Note: line items already carry `discountType: PERCENT|ABSOLUTE` + `discountValue` in [`vendorQuote.ts`](packages/types/src/vendorQuote.ts) — reuse that shape.

### D2. Line-item discount in UI (1.3)

- Surface the existing per-line `discountType`/`discountValue` in the parse/edit grid so users can enter line-level discounts.

### D3. Justification note on selection (1.3)

- Add a remarks field when selecting an offer (especially a higher-priced one) in [`OfferComparisonClient.tsx`](apps/web/src/app/procurement/rfqs/[id]/offers/OfferComparisonClient.tsx#L145-L155). Today only a generic `completionNotes` string is set post-selection. Persist the justification on the RFQ/selection record.

### D4. Amendment price change — base price (3.3)

- `ALLOWED_AMENDMENT_FIELDS` already permits `subtotal`/taxes ([`crud.ts:33`](apps/web/src/lib/procurement/amendment/crud.ts#L33)); the UI only exposes grand total ([`new/page.tsx:446-481`](apps/web/src/app/procurement/amendments/new/page.tsx#L446-L481)). Add a base-price input that recomputes taxes (consistent with D1's pre-tax model).

### D5. Amendment delivery change — gate the field (3.3)

- Replace the always-visible "New Delivery Address" field ([`new/page.tsx:483-527`](apps/web/src/app/procurement/amendments/new/page.tsx#L483-L527)) with a "Change delivery address?" yes/no, showing the current address for reference and revealing the input only on "yes".

**Effort:** ~2 days.

---

## Phase E — Tax payment stage + email notifications (🟡 P1.5 + 🔵 P3)

### E1. Tax payment stage (2.2c / 2.2d)

- `PaymentMilestone` ([`purchaseOrder.ts:213-219`](packages/types/src/procurement/purchaseOrder.ts#L213-L219)) has no field to mark which stage carries the tax (the "70% + 100% tax against dispatch" pattern).
- Add a per-milestone tax flag/portion. There is prior art in `proposal.ts` (`taxType?: MilestoneTaxType`) — reuse the concept rather than inventing a new shape (rule 32). Touches: type, payment-terms form, PO PDF, and the accounting payment-release read.

### E2. Two-tier approval: Manager → Director (2.3 — decision D2)

- New permission flag in [`packages/constants/src/permissions.ts`](packages/constants/src/permissions.ts) (e.g. `APPROVE_PO_AS_DIRECTOR`) — never hardcode bit values (rule 7).
- Extend the PO state machine with an extra approval step and update [`purchaseOrder/workflow.ts`](apps/web/src/lib/procurement/purchaseOrder/workflow.ts) to route Manager-approved POs to Director final approval. `ApproverSelector` filters by the relevant flag per step.
- Audit-log each gate (rule 18).

### E3. Email notifications (2.3 / 3.3)

- Wire emails for **submit** and **final approval** on **both** PO and amendment, reusing [`functions/src/email/sendEmail.ts`](functions/src/email/sendEmail.ts) + templates and the existing task-notification hook. Do this once, covering both modules and both events.

**Effort:** ~3–4 days (E1 and E2 are independent; E3 is shared infra).

---

## 4. Out of scope / needs investigation first

- **1.2 Google Document AI broken** — user confirms non-blocking (Claude works). **Recommendation:** _remove_ the dead dual-parser comparison path and go Claude-only (rule 32 — don't keep parallel implementations) rather than repair it. Confirm with user before deleting.
- **1.2 Intermittent offer-selection error** — `selectVendorQuote()` uses a `writeBatch` over a non-atomic read ([`vendorQuoteWorkflow.ts:99`](apps/web/src/lib/vendorQuotes/vendorQuoteWorkflow.ts#L99)); converting to `runTransaction` (rule 19) is the likely fix, but the error is intermittent and not yet reproduced. **Get a repro / console capture before changing.**

---

## 5. Sequencing & effort

| Phase | Scope                                           | Effort  | Gate                            |
| ----- | ----------------------------------------------- | ------- | ------------------------------- |
| A     | Amendment unblock (P0)                          | 1.5–2 d | **Do first**                    |
| B     | PO discount + P&F (P1)                          | 1–1.5 d | Confirm P&F tax treatment       |
| C     | Commercial-terms fields (P2)                    | 3–4 d   | Warranty fix prioritised within |
| D     | RFQ + amendment UX (P2)                         | 2 d     | —                               |
| E     | Tax stage + two-tier approval + email (P1.5/P3) | 3–4 d   | Largest model/infra work        |

**Cross-cutting rules engaged:** 2 (indexes), 4 (rules), 7 (permission flags), 8/17 (state machines), 18 (audit), 21 (financial precision), 22 (create/edit field completeness), 28 (module completeness), 29 (labels), 30 (usePathname), 32 (one canonical implementation).

**Open sub-questions before coding the relevant phase:**

1. (B2) P&F tax treatment — taxable (added to base before GST) or not?
2. (C2) Exact "respective sections" layout the user expects — confirm against their screenshot.
3. (E1) Tax-stage granularity — per-milestone boolean ("this stage carries tax") vs explicit tax amount per stage.

---

_Plan prepared 2026-05-25. Deploys ship via the "Deploy - Production" CI workflow (auto-detected targets) — no local `firebase deploy` (rule 33)._
