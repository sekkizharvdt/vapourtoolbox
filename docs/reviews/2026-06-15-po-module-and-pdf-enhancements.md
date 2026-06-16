# Scoping — PO Module & PO PDF Enhancements

**Date:** 2026-06-15
**Source:** Feedback `iZqGGOesnv4fNLpq4VCi` (Kumaran A) — a multi-part enhancement request covering the PO module and the PO PDF, framed around PO/SO being unified into one module.
**Status:** Scoping for review — no code written yet. Grouped into 4 work packages with a recommended order. Two decisions needed (see §3).
**Related:** `docs/reviews/2026-06-08-service-order-module-enhancement.md` (service-order-as-PO model), `docs/reviews/2026-05-25-procurement-rfq-po-amendment-plan.md`.

---

## 1. Current-state assessment (verified in code)

| #   | Item                                                                                                    | Status                                                                                                             | Primary files                                                      | Effort | Depends on               |
| --- | ------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------ | ------------------------------------------------------------------ | ------ | ------------------------ |
| A   | Mark Freight/Transport/Insurance/E&C/Inspection **Required / Not-Required** to include/exclude sections | PARTIAL — fields exist as scope dropdowns; only `warrantyApplicable` + `erectionScope='NA'` behave as on/off       | `purchaseOrder.ts` (types), `CommercialTermsForm.tsx`              | M      | drives E                 |
| B   | Delivery Terms: free-text **delivery schedule / milestones**                                            | MISSING — only numeric `deliveryPeriod/Unit/Trigger` exist                                                         | `purchaseOrder.ts`, `CommercialTermsForm.tsx`, `POPDFDocument.tsx` | S      | —                        |
| C   | **Edit** PO Description + per-line Specification                                                        | MISSING — `EditPOClient` edits commercial terms only; description is hardcoded, spec never editable                | `EditPOClient.tsx`, `purchaseOrder/crud.ts`                        | M      | —                        |
| D   | Move **HSN/SAC + Attachments** from View → Edit (remove from View)                                      | PARTIAL (reversed) — both currently live in the View page                                                          | `EditPOClient.tsx`, `PODetailClient.tsx`, `POLineItemsTable.tsx`   | M      | reuses existing services |
| E   | PDF: omit **Not-Required** sections                                                                     | PARTIAL — conditional rendering keyed off content presence, not Required flags; Scope/Inspection rows always print | `POPDFDocument.tsx`                                                | S–M    | **A**                    |
| F   | PDF: vendor full **address + GSTIN**                                                                    | ✅ EXISTS — already rendered (`POPDFDocument.tsx:280-290`, `poPDF.ts:86-93`)                                       | — (verify vendor data populated)                                   | —      | —                        |
| G   | PDF download bundles **attachments as a ZIP** (like RFQ)                                                | MISSING — `downloadPOPDF` is PDF-only; RFQ blueprint exists (`rfqZipService.ts`)                                   | new `purchaseOrder/poZipService.ts`, `PODetailClient.tsx`          | M      | pairs with H             |
| H   | PDF **lists attachments** (like RFQ format)                                                             | MISSING — RFQ lists them; PO PDF has no section                                                                    | `POPDFDocument.tsx`                                                | S      | pairs with G             |
| I   | PDF: **Grand Total in words**                                                                           | MISSING — no number-to-words utility exists anywhere                                                               | new util in `lib/utils/currency.ts`, `POPDFDocument.tsx`           | S–M    | —                        |

**One item is already done:** F (vendor address + GSTIN) — the only action is verifying the vendor entity actually stores `taxIds.gstin` / `billingAddress`; no code change.

---

## 2. Work packages

Grouped so each package is independently shippable, touches a coherent set of files, and ships visible value. Ordered by value-to-risk.

### WP1 — PDF-only quick wins (no schema, no module changes)

**Items: I, H, F-verify.** Pure `POPDFDocument.tsx` (+ one shared util). Low risk, high visibility, no data model impact.

- **I — Grand Total in words.** Add an Indian-numbering (lakh/crore) number-to-words helper to the shared `lib/utils/currency.ts` (rule 32 — none exists; do not inline). Render under Grand Total, e.g. _"Rupees Five Lakh Forty-Seven Thousand … Only"_. Decision §3.2 (currency wording).
- **H — Attachment list in PDF.** Add a "Supporting Documents" `ReportSection` on page 2 iterating `po.attachments` (filenames; `POAttachment` carries no type/description, so a File column only). Mirrors `RFQPDFDocument.tsx:341-375`.
- **F — verify** vendor records populate `taxIds.gstin` + `billingAddress` (spot-check a few via the service account); no code unless data is missing.

### WP2 — Attachments ZIP on PDF download

**Item: G.** Add `purchaseOrder/poZipService.ts` mirroring `rfqZipService.ts` (JSZip; PDF blob + each `po.attachments[]` file under `Supporting Documents/`, de-duped filenames). Wire a "Download with attachments" action in `PODetailClient.tsx`. Simpler than RFQ — PO attachments live directly on `po.attachments` (no cross-collection query). Best done right after WP1-H (both are the attachment story).

### WP3 — Edit-mode field corrections

**Items: C, D.** Both touch `EditPOClient.tsx` + the `updateDraftPO`/crud path — pair them.

- **C** — add an editable PO Description field + an editable line-items table exposing the Specification column; extend `updateDraftPO` to accept `description` and per-item `specification` (items are separate docs → add an item-update path).
- **D** — relocate the HSN/SAC editor and the attachment upload widget into `EditPOClient`; make the View page read-only for these. The services (`updatePOItemHsnSac`, `addPOAttachment`/`removePOAttachment`) already work standalone, so this is mostly UI relocation + guard changes. Decision §3.1 (whether to fully remove attachment upload from View).

### WP4 — Service-order scope toggles + PDF gating + delivery schedule

**Items: A, E, B.** The largest; schema + form + PDF. Do last (E depends on A; B is small but lives in the same Delivery/terms surface).

- **A** — add uniform `*Required` booleans to `POCommercialTerms` (freight/transport/insurance/E&C/inspection; warranty already has `warrantyApplicable`); wire toggles into `CommercialTermsForm.tsx`. Decision §3.1.
- **E** — gate each Scope/Inspection/Warranty section + row in `POPDFDocument.tsx` on the new flags (and hide the section header when the whole section is Not Required).
- **B** — add `deliverySchedule?: string` (multiline) to `POCommercialTerms`; TextField in the Delivery section; render in the PDF Commercial Terms / Delivery block.

---

## 3. Decisions needed before building

### 3.1 Required/Not-Required semantics + View vs Edit for attachments (WP3-D, WP4-A)

- **A:** Confirm the five toggle-able sections are **Freight, Transport, Transit Insurance, E&C (erection), Inspection** (warranty already toggles). "Not Required" → the section is **omitted from the PDF entirely** (per the request) rather than printed as "Not in scope". Confirm omit-vs-label.
- **D:** The request says _remove_ HSN/SAC + attachment upload from View and put them only in Edit. Note the trade-off: attachments are often added **after** a PO is issued (vendor sends docs later), and a PO can only be edited in DRAFT/REJECTED. Removing upload from View means you cannot attach to an approved PO. Options: (a) follow the request literally (Edit-only); (b) keep a read-only attachment **list** in View but move **upload/HSN-edit** to Edit; (c) keep both. Recommend (b).

### 3.2 Amount-in-words currency wording (WP1-I)

POs can be multi-currency (`po.currency`). Indian-numbering words ("lakh/crore") suit INR. Decision: for non-INR POs, use international grouping ("million") and the right currency name, or only render words for INR? Recommend: Indian grouping for INR (`Rupees … Only`); for foreign currency, international grouping with the currency name.

---

## 4. Recommended sequence

1. **WP1** (I, H, F-verify) — fastest visible wins, zero schema risk.
2. **WP2** (G) — completes the attachment story with WP1-H.
3. **WP3** (C, D) — edit-mode corrections; needs decision 3.1-D.
4. **WP4** (A, E, B) — service-order toggles + PDF gating + delivery schedule; needs decision 3.1-A; largest, do last.

Each WP ships independently and deploys via the standard CI "Deploy - Production" dispatch. No new composite indexes anticipated (verify if any `where + orderBy` is added — rule 2). All new user-visible strings should route through `@vapour/constants/labels.ts` (rule 29); new amount-in-words + scope-toggle labels included.
