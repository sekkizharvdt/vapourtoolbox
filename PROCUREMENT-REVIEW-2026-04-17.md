# Procurement Toolbox Review — Tracking

**Source**: `inputs/Procurement_Toolbox_Review.pdf` (procurement user, April 2026)
**Created**: 2026-04-17
**Owner**: sekkizhar

Status legend: 🔴 blocking · 🟠 data-integrity · 🟡 UX · 🟢 enhancement · ⬜ not-started · 🔍 investigating · 🛠 in-progress · ✅ done · ⏸ deferred

---

## P0 — Blocking Bugs (users can't complete tasks)

| #   | Item                                   | Module                | Status               | Root cause                                                                                                                                                                                                                                                                                                                                                                                                                         | Notes                                                                                                                                                                                                                                                                             |
| --- | -------------------------------------- | --------------------- | -------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 1   | Claude-AI-parsed offer fails to create | RFQ → Upload Offer    | ✅ fixed             | Client-side validation required ALL items priced, but Claude defaults unextracted prices to 0 (and vendors often quote partially). Relaxed to "at least one priced item"; added info-level notice for partial quotations.                                                                                                                                                                                                          | [UploadOfferDialog.tsx:522-526](apps/web/src/components/procurement/UploadOfferDialog.tsx#L522-L526) · [UploadOfferDialog.tsx:628-645](apps/web/src/components/procurement/UploadOfferDialog.tsx#L628-L645)                                                                       |
| 2   | PO Amendment creation errors out       | PO Amendment → New    | ✅ fixed (partial)   | Page wrote `field: 'general'` which the approval whitelist rejects → approval always failed. Also `approvedByName`/`rejectedByName` never persisted → detail page showed blank approver. Changed amendment to use `items[].amendmentNote` sentinel (skipped by approval, records audit trail). Added approvedByName/rejectedByName/comments on approve/reject. **Follow-up #9 still open** for multi-type + conditional fields UX. | [amendments/new/page.tsx:129-138](apps/web/src/app/procurement/amendments/new/page.tsx#L129-L138) · [amendment/crud.ts:273-283](apps/web/src/lib/procurement/amendment/crud.ts#L273-L283) · [amendment/crud.ts:393-402](apps/web/src/lib/procurement/amendment/crud.ts#L393-L402) |
| 3   | Work Completion creation errors out    | Work Completion → New | ✅ fixed             | Page passed `remarks: remarks \|\| undefined` — Firestore rejects explicit `undefined` (rule 12). Also service wrote `remarks: input.remarks` directly. Fixed both with conditional spread.                                                                                                                                                                                                                                        | [work-completion/new/page.tsx:142](apps/web/src/app/procurement/work-completion/new/page.tsx#L142) · [workCompletionService.ts:80](apps/web/src/lib/procurement/workCompletionService.ts#L80)                                                                                     |
| 4   | PR Import PDF — AI parsing not working | PR → New              | ⏸ pending user retry | Redeployed 2026-04-17 15:15. Function already has `logger.error`. **Blocked on**: user retrying PR → Import PDF to produce a fresh log. Expected same root cause as #5.                                                                                                                                                                                                                                                            | [functions/src/documentParsing/parseDocument.ts:699-700](functions/src/documentParsing/parseDocument.ts#L699-L700)                                                                                                                                                                |
| 5   | Google Document AI parsing not working | RFQ → Upload Offer    | ⏸ pending user retry | Instrumented + deployed 2026-04-17 15:15. **Blocked on**: user retrying Upload Offer to trigger a fresh invocation with the new logger. Once retry happens, `firebase functions:log --only compareOfferParsers` will show the actual Document AI error.                                                                                                                                                                            | [compareOfferParsers.ts:544-550](functions/src/offerParsing/compareOfferParsers.ts#L544-L550)                                                                                                                                                                                     |

## P1 — Data Integrity / Core Workflow Gaps

| #   | Item                                                                    | Module        | Status              |
| --- | ----------------------------------------------------------------------- | ------------- | ------------------- |
| 6   | PO offer number is system-generated, should reflect vendor offer number | PO → New      | ✅ fixed 2026-04-17 |
| 7   | PO commercial terms not auto-populated from selected offer              | PO → New      | ✅ fixed 2026-04-17 |
| 8   | PR attachments not carried into RFQ PDF                                 | RFQ → Create  | ✅ fixed 2026-04-17 |
| 9   | PO Amendment — only single amendment type selectable                    | PO Amendment  | ✅ fixed 2026-04-17 |
| 10  | Service Order module — only dashboard, missing New/View/Edit            | Service Order | ⬜                  |

## P2 — UX Improvements

| #   | Item                                                                        | Module               | Status |
| --- | --------------------------------------------------------------------------- | -------------------- | ------ |
| 11  | RFQ number format → yearly sequence `RFQ/2026/001`                          | RFQ                  | ⬜     |
| 12  | PO number format → yearly sequence `PO/2026/001`                            | PO                   | ⬜     |
| 13  | PR dashboard: split Draft/Submitted/Converted; sub-split Submitted          | PR Dashboard         | ⬜     |
| 14  | RFQ dashboard: show linked PR number                                        | RFQ Dashboard        | ⬜     |
| 15  | PO dashboard: show linked RFQ number                                        | PO Dashboard         | ⬜     |
| 16  | RFQ title auto from Item Description / PR title                             | RFQ                  | ⬜     |
| 17  | PO title auto from Item Description / RFQ title; visible during create/edit | PO                   | ⬜     |
| 18  | Work Completion description auto from supplied items                        | Work Completion      | ⬜     |
| 19  | PR: remove duplicate Save Draft / Submit buttons at top                     | PR                   | ⬜     |
| 20  | PR: allow attachments during creation (not just draft/view)                 | PR                   | ⬜     |
| 21  | Packing List: attachment option for vendor's PL                             | Packing List         | ⬜     |
| 22  | Packing List: Save as draft + Edit                                          | Packing List         | ⬜     |
| 23  | Goods Receipt: Save as draft + Edit                                         | Goods Receipt        | ⬜     |
| 24  | Remove redundant Engineering Approval module                                | Engineering Approval | ⬜     |
| 25  | Add 'Create PO' button on RFQ page after offer finalization                 | RFQ/PO               | ⬜     |

## P3 — Enhancements

| #   | Item                                                                                        | Module            | Status |
| --- | ------------------------------------------------------------------------------------------- | ----------------- | ------ |
| 26  | Auto-populate offer validity date from parsed quotation                                     | Upload Offer      | ⬜     |
| 27  | Compare vendor offer vs PR/RFQ attachments (technical validation)                           | Upload Offer      | ⬜     |
| 28  | Parse discount and reflect in PO                                                            | Upload Offer → PO | ⬜     |
| 29  | Rename Ex-works → Price Basis; Erection after purchase → E&C                                | Offer terms       | ⬜     |
| 30  | P&F charges (AI-parsed) reflect in pricing                                                  | Offer → PO        | ⬜     |
| 31  | Add Inspection field                                                                        | Offer terms       | ⬜     |
| 32  | PO PDF: fix VDT name, add logo                                                              | PO PDF            | ⬜     |
| 33  | PO PDF: add Special Instructions block                                                      | PO PDF            | ⬜     |
| 34  | PO PDF: restructure Commercial Terms + T&C sections                                         | PO PDF            | ⬜     |
| 35  | PO PDF: rename Description → Vendor offer reference; full vendor + billing/delivery address | PO PDF            | ⬜     |
| 36  | Goods Receipt: rename Payment Approval → Payment Status; auto-update Cleared/Partly Cleared | Goods Receipt     | ⬜     |
| 37  | (Alt) New Payment Status module for PO-wise tracking                                        | Payment Status    | ⬜     |

---

## Investigation Log

### #1 — Upload Offer creation fails after Claude AI parsing (2026-04-17)

**Flow**: Claude parses PDF → returns items with `unitPrice` that may be `null`/`undefined` → backend [parseOfferWithClaude.ts:338](functions/src/offerParsing/parseOfferWithClaude.ts#L338) coerces to `0` → frontend [UploadOfferDialog.tsx:465](apps/web/src/components/procurement/UploadOfferDialog.tsx#L465) applies `unitPrice: parsedItem.unitPrice || 0` to form state → user clicks "Create Offer" → validation at [UploadOfferDialog.tsx:522-526](apps/web/src/components/procurement/UploadOfferDialog.tsx#L522-L526) rejects because `item.unitPrice > 0` is false → error "Please enter unit prices for all items".

**Dead-end UX**: The dialog shows no way to manually edit parsed line items before hitting Create — so if Claude can't extract prices, user is stuck.

**Fix options**:

- **(A)** Make parsed line items editable in the dialog so user can fill in missing prices
- **(B)** Distinguish "price missing" from "price is zero" with sentinel `null` and prompt for missing values
- **(C)** Allow offer creation with zero-priced items and flag them for review

### #2 — PO Amendment creation error (2026-04-17)

**Root cause**: [amendments/new/page.tsx:129-137](apps/web/src/app/procurement/amendments/new/page.tsx#L129-L137) constructs every change object with `field: 'general'` regardless of amendment type. The approval path [amendment/crud.ts:295-310](apps/web/src/lib/procurement/amendment/crud.ts#L295-L310) validates against `ALLOWED_AMENDMENT_FIELDS` whitelist which rejects `'general'`. So amendments can be saved but NEVER approved → apparent "error".

**Secondary**: `approvedByName` never written in crud.ts:273-280 — breaks display at [AmendmentDetailClient.tsx:507](apps/web/src/app/procurement/amendments/[id]/AmendmentDetailClient.tsx#L507).

**Architectural issue**: Single-type-at-a-time is enforced UI-side (single `<Select>`) AND type-wise (`AmendmentType` is not an array). Type-specific fields don't exist — no conditional rendering. This is a redesign, not a bug fix.

**Fix plan**:

1. Short-term: map amendment type → real PO field (e.g., `QUANTITY_CHANGE` → `quantity`) so the approval whitelist passes
2. Short-term: add `approvedByName` to approval write
3. Medium-term: redesign to support multi-field amendments with type-specific form sections (user request)

### #3 — Work Completion creation error (2026-04-17)

**Root cause**: [work-completion/new/page.tsx:142](apps/web/src/app/procurement/work-completion/new/page.tsx#L142) passes `remarks: remarks || undefined` — Firestore rejects documents containing explicit `undefined` values (CLAUDE.md rule 12). Service layer [workCompletionService.ts:80](apps/web/src/lib/procurement/workCompletionService.ts#L80) does use a conditional spread correctly, but the page overrides by passing the key explicitly.

**Fix**: Replace `remarks: remarks || undefined` with a conditional spread: `...(remarks && { remarks })`.

**Bonus improvement (user request)**: Line 109 auto-populates `workDescription` from `po.description` → change to derive from `po.items` (e.g., `"Supply of <first item description>"` or concatenate).

### #4 / #5 — PDF parsing not working (2026-04-17)

**PR Import PDF**: Hits Cloud Function `parseDocumentForPR` (asia-south1) which uses **only Google Document AI** — no Claude fallback. If Document AI call fails, parsing fails.

**RFQ Upload Offer**: Hits `compareOfferParsers` which calls **both** Google Document AI and Claude. User reports Claude parsing works but Document AI doesn't, so only the Document AI side is broken in this flow — the Claude parse succeeds but #1 above then blocks offer creation.

**Most likely causes** (ordered by probability):

1. `DOCUMENT_AI_PROCESSOR_ID` env var (`139dee9b585ce9e9` per `.env`) — processor may not exist in the project or not in the `us` location
2. Service account IAM missing `roles/documentai.apiUser`
3. Document AI API not enabled in the GCP project
4. Region mismatch — Cloud Function in `asia-south1` calling Document AI in `us` (likely fine but worth verifying)

**Verification steps** (need user / env):

- `gcloud documentai processors list --location=us` — confirm processor exists
- Check Firebase Functions logs for both `parseDocumentForPR` and `compareOfferParsers` for the specific error
- `firebase functions:secrets:access DOCUMENT_AI_PROCESSOR_ID`

---

## Recommended Fix Order

1. ~~**#3 Work Completion**~~ ✅ fixed 2026-04-17
2. ~~**#1 Upload Offer**~~ ✅ fixed 2026-04-17
3. ~~**#2 PO Amendment**~~ ✅ partially fixed 2026-04-17 (code bug); redesign → P1 item #9
4. **#4/#5 PDF parsing** ⏸ **pending user retry** — instrumented + deployed 2026-04-17; need user to trigger a fresh invocation

---

## 📧 Morning note to procurement user

**Send on**: 2026-04-18 morning
**To**: procurement user
**Re**: Upload Offer + PR Import PDF — help us diagnose

> Hi — following up on your procurement review, we've shipped fixes for three of the five blocking bugs (Work Completion creation, Upload Offer creation after Claude parse, and PO Amendment approval). The PDF-parsing issue (both PR Import PDF and Google Document AI in Upload Offer) is harder — we've confirmed Document AI is failing, but the underlying error was being silently swallowed. We've added instrumentation and redeployed.
>
> **Please help us diagnose** — when you have 2 minutes this morning, please do one of each:
>
> 1. **Upload Offer**: open any RFQ → Upload Offer → pick a vendor + upload the same PDF that failed before → click **Compare AI Parsers**. You can cancel the offer after — we just need the parse to run.
> 2. **PR Import PDF**: Purchase Requests → New → Import PDF → upload a PDF you've tried before.
>
> Reply with the approximate time you did each and we'll pull the server logs. The exact error should now be visible and we can target a real fix.
>
> Meanwhile we're working on the P1/P2 items (RFQ/PO numbering, dashboard PR/RFQ cross-references, commercial-terms auto-population, etc.) and will have more updates today.

### #2 Fix notes (2026-04-17)

**Problem, as coded**:

- Page constructed `changes: [{ field: 'general', ... }]` for every amendment.
- During approval [amendment/crud.ts:295-310](apps/web/src/lib/procurement/amendment/crud.ts#L295-L310), the `ALLOWED_AMENDMENT_FIELDS` whitelist rejects `'general'` → `Error: Amendment cannot modify field "general"`. Every amendment was un-approvable.
- `approvedByName` and `rejectedByName` were never persisted, so the detail page showed `by undefined` after approve/reject.
- `approvalComments` and `rejectionReason` were silently dropped on the batch update (they were only written to the audit history subcollection).

**Fix**:

- Page now writes `field: 'items[].amendmentNote'` — the approval loop skips fields starting with `items[`, so the amendment is recorded (reason, description, type) without touching PO fields. Approval succeeds; PO data stays intact.
- Backend approval/rejection now writes `approvedByName`/`rejectedByName`, plus `approvalComments` (conditional) and `rejectionReason`.
- Added a UI notice that this is a documentation-only amendment and that structural-field editing (price/terms/delivery/quantity) is coming next.

**Follow-up (tracker item #9)**: make the form type-aware so each amendment type exposes the right inputs:

- `PRICE_CHANGE` → new grand total (or subtotal)
- `DELIVERY_CHANGE` → new expected delivery date / delivery address
- `TERMS_CHANGE` → which term (payment/delivery/warranty/commercial) + new text
- `QUANTITY_CHANGE` → item picker + new quantity (requires item-level amendment handling in approval — currently stubbed)
- `GENERAL` → free-text note (current behaviour)
- Plus: allow a single amendment to carry multiple changes.

### #6 + #7 Fix notes (2026-04-17)

**#6 — Vendor offer number**:

- Added `vendorOfferNumber?: string` and `vendorOfferDate?: Timestamp` to [PurchaseOrder type](packages/types/src/procurement/purchaseOrder.ts#L37-L38). The existing `selectedOfferNumber` is kept (our internal `OFFER/2026/…` reference) — now the vendor's own quotation number is also carried on the PO.
- In [purchaseOrder/crud.ts](apps/web/src/lib/procurement/purchaseOrder/crud.ts#L255-L258), `createPOFromOffer` now reads `offer.vendorOfferNumber` / `offer.vendorOfferDate` and writes them to the PO under the same-name fields (conditional spread, no undefined).
- Offer summary panel on [pos/new/page.tsx](apps/web/src/app/procurement/pos/new/page.tsx) now shows both "System Offer No." and "Vendor Offer No." side by side.
- **Follow-up**: PO PDF (tracker item #35) will need to surface `vendorOfferNumber` as "Vendor offer reference" when that work happens.

**#7 — Commercial terms auto-populated**:

- New helper [`deriveCommercialTermsFromOffer()`](apps/web/src/lib/procurement/commercialTerms/defaults.ts#L295) keyword-matches offer free-text fields (`exWorks`, `packingForwarding`, `transportation`, `insurance`, `erectionAfterPurchase`) into structured `POCommercialTerms` fields (`priceBasis`, `packingForwardingIncluded`, `freight/transport/insuranceScope`, `erectionScope`). Uses simple keyword rules; leaves fields undefined when the text is ambiguous so template defaults apply.
- [`loadOffer()`](apps/web/src/app/procurement/pos/new/page.tsx#L119-L127) now applies these overrides on initial load; [`handleTemplateChange()`](apps/web/src/app/procurement/pos/new/page.tsx#L139-L152) re-applies them when the template changes so offer-derived values survive.
- Added a **reference panel** in the Offer Summary showing the vendor's raw free-text terms (price basis, payment, delivery, warranty, P&F, transport, insurance, E&C) so the buyer can cross-check while filling the structured form.
- **Scope boundary**: `paymentSchedule` (structured milestones) and `deliveryPeriod/Unit` can't be reliably parsed from free text like "50% advance / 50% balance" or "4–6 weeks" — users still set these manually, using the reference panel as context.

### #8 Fix notes (2026-04-17)

**Problem**: The RFQ PDF listed PR attachment filenames but included no download URLs. Vendors receiving the PDF externally had no way to open the technical specs, drawings, or datasheets — effectively making the attachments invisible.

**Root cause**:

- [rfqPdfService.ts:396](apps/web/src/lib/pdf/rfqPdfService.ts) fetched attachment metadata but explicitly left `publicUrl` empty with the comment _"no public URL needed for client-side PDF"_. That was wrong for the RFQ delivery flow — the PDF goes to external recipients who can't authenticate into Firebase Storage.
- [RFQPDFDocument.tsx:314](apps/web/src/components/pdf/RFQPDFDocument.tsx) rendered a plain `ReportTable` of filenames with no clickable links.

**Fix**:

- Service now calls `getDownloadURL(ref(storage, storagePath))` per attachment to mint a token-bearing public URL, storing it on the `publicUrl` field that the PDF type already exposed. Failures are logged and non-fatal — the entry still renders (just without a link).
- PDF component replaced the static table with a flex-layout list. File names render as `@react-pdf/renderer` `<Link>` components pointing at `publicUrl`, with a hint line telling vendors the links are clickable. Falls back to plain text when a URL couldn't be minted.
- No change to Firestore rules or storage rules needed — `getDownloadURL()` tokens are designed for exactly this share-by-link case, and PR attachments were already explicitly authenticated-read.

### #4/#5 Investigation notes (2026-04-17)

**What we verified**:

- Firebase project `vapour-toolbox` is active. Both callable functions (`parseDocumentForPR`, `compareOfferParsers`) are deployed in `asia-south1`.
- Secrets: `DOCUMENT_AI_PROCESSOR_ID=139dee9b585ce9e9`, `DOCUMENT_AI_LOCATION=us` (default) → processor path `projects/vapour-toolbox/locations/us/processors/139dee9b585ce9e9`.
- `compareOfferParsers` recent logs (2026-04-15 through 2026-04-17): every invocation shows `googleSuccess:false, googleItems:0, claudeSuccess:true, claudeItems:1+`. Document AI is being invoked but returning a failed parse result.
- The code paths in both `compareOfferParsers.ts` and `parseDocument.ts` reach `client.processDocument()` successfully (request-level logs present), so the _call_ is made — failure happens at/after the response.
- `parseDocumentForPR` has no recent invocations logged — the user's reports likely predate log retention, or the UI path isn't being exercised currently.

**Why we can't see the root error**:

- [compareOfferParsers.ts:544](functions/src/offerParsing/compareOfferParsers.ts#L544) previously caught the error and returned it in the response payload **without logging it**. Fixed today — added `logger.error` capturing message, stack, gRPC code, and details.
- `parseDocument.ts:700` already logs errors, so next invocation will show the root cause.

**Next steps (require deploy + user retry)**:

1. Deploy functions: `firebase deploy --only functions:compareOfferParsers,functions:parseDocumentForPR --project vapour-toolbox`
2. User retries Upload Offer on the same PDF that failed before.
3. Inspect `firebase functions:log --only compareOfferParsers` for the new `[Document AI] Offer parsing failed` entry. Expected codes:
   - `7 PERMISSION_DENIED` → service account lacks `roles/documentai.apiUser` on the processor.
   - `5 NOT_FOUND` → processor ID stale or wrong region.
   - `3 INVALID_ARGUMENT` → unsupported format or malformed request.
   - `8 RESOURCE_EXHAUSTED` → quota hit.
   - Success with `items:[]` → processor _type_ wrong (Form Parser vs Invoice Parser).

**Suspected root cause**:
Processor `139dee9b585ce9e9` is configured as a **Form Parser**, which is tuned for forms with key/value pairs and checkboxes. Offer/quotation PDFs are line-item documents that Form Parser extracts as loose text rather than structured tables — the parse "succeeds" but the code's table-iteration path at [compareOfferParsers.ts:486-517](functions/src/offerParsing/compareOfferParsers.ts#L486-L517) finds no tables with pricing columns. The catch block in the current code would only trigger if `processDocument()` itself throws, which makes the `googleSuccess:false` result odd — next log will clarify.

**Strategic recommendation**:
Claude AI parsing works reliably for offer documents. Consider:

- Short-term: prefer Claude as the primary parser; keep Document AI as an experimental side-by-side for evaluation only (current comparison UI is good for this).
- Medium-term: if Document AI is required, replace Form Parser with **Invoice Parser** (pretrained for quotations/invoices) — creates a separate processor ID; env var flip required.

### #1 Fix notes (2026-04-17)

- The parsed-items table already supports inline editing of every field including `unitPrice` — the dialog wasn't missing UI, it was over-validating.
- Root behaviour: `initializeOfferItems` seeds every RFQ line with `unitPrice: 0`. Claude parsing then writes prices for matched items; unmatched items stay at 0. The old `every(item => unitPrice > 0)` check rejected the form unless the user manually filled every unmatched row.
- New behaviour: require at least one priced item. Zero-priced items are treated downstream as "vendor did not quote" — consistent with existing logic in `threeWayMatch/matching.ts:200`, `offer/evaluation.ts:193`, and `OfferComparisonClient.tsx:362`.
- Backend `crud.ts:70` already allowed `unitPrice >= 0` — only rejected negative — so no service-layer change needed.
