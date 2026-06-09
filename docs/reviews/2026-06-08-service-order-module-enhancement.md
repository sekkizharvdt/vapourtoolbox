# Implementation Plan — Service Terms on Purchase Orders

**Date:** 2026-06-08 (rev 3 — final, after user clarification)
**Source:** Feature Enhancement Request – Service Order Module (procurement user). PDF at `inputs/Feature Enhancement Request – Service Order Module.pdf`.
**Status:** Plan for review — no code written yet.

**User clarifications (2026-06-08), in order:**

1. _"A Service Order is a Purchase Order for service. Title, deliverables, and terms differ. There may be mixed items (e.g. delivery of a pump + inspection of a pump). Keep it simple."_
2. _"Service Orders do not exist as a category. Only Purchase Orders, which have different terms and conditions."_ + numbering: **share the `PO/2026/001` sequence.**

---

## 1. The model

There is **no Service Order entity, category, collection, or number sequence.** Everything is a **Purchase Order**. A PO may contain material items, service items, or both. When it contains service items it needs **service-oriented terms** (scope of work, deliverables, completion period, etc.) in addition to or instead of the material terms.

> Single concept: `PurchaseOrder`. Service support = (a) line items already carry `itemType: 'MATERIAL' | 'SERVICE'`, and (b) the commercial terms gain **optional service sections**. The buyer titles the PO freely (`title` is already free text), so a "Service Order for pump inspection" is just a PO whose title and terms say so.

This is the [rule 32](../../CLAUDE.md) outcome — one canonical document, no parallel implementation.

### Supersedes earlier revisions

- Rev 1 (separate `serviceOrders` sibling collection) and rev 2 (`orderType` discriminator) are both **scrapped.** No discriminator field, no SO numbering, no SO list, no category propagation, no parallel CRUD/state-machine/approval.

### Mixed items — the pump example (no special handling)

One PO, two line items:

| Line | `itemType` | Description        | Fulfilled by (existing)         |
| ---- | ---------- | ------------------ | ------------------------------- |
| 1    | `MATERIAL` | Supply of pump     | **Goods Receipt**               |
| 2    | `SERVICE`  | Inspection of pump | **Work Completion Certificate** |

`PurchaseOrderItem.itemType` and the service-line fields (`serviceId`, `serviceCode`, `serviceName`, `serviceCategory`) **already exist** on the PO type ([purchaseOrder.ts](../../packages/types/src/procurement/purchaseOrder.ts)). Goods Receipt and Work Completion both already link to a PO, so a mixed PO is fulfilled by both side by side. **No item-model change, no fulfillment change.**

---

## 2. The existing `serviceOrders` collection is deleted

The current `serviceOrders` is an unrelated PO-child sample/lab-test tracker. Firestore count (service account, 2026-06-08): **1** record (`workCompletionCertificates` = 0). Per [rule 31](../../CLAUDE.md) the one record is discarded/re-entered by hand — **no migration code.** Remove: the collection constant, `ServiceOrder` type, `serviceOrder/crud.ts`, the `app/procurement/service-orders/**` pages, the SO state machine in [stateMachines.ts](../../apps/web/src/lib/workflow/stateMachines.ts), its `firestore.rules` block ([firestore.rules:1966](../../firestore.rules#L1966)), and its three indexes ([firestore.indexes.json:4542](../../firestore.indexes.json#L4542)).

---

## 3. What to build

### 3.1 Optional service sections on `POCommercialTerms`

Add to the existing terms object ([purchaseOrder.ts](../../packages/types/src/procurement/purchaseOrder.ts)) — all optional, so existing 7 POs are unaffected ([rule 31](../../CLAUDE.md)):

```
serviceTerms?: {
  scopeOfWork?: string
  deliverables?: string                         // free text
  completionPeriod?: { value: number, unit: 'DAYS'|'WEEKS'|'MONTHS' }
  serviceLocation?: string
  acceptanceCriteria?: string
  exclusions?: string
}
safetyCompliance?: {                            // request #7 — checkbox-gated, all optional
  safetyRequired?: boolean;     safetyDetails?: string
  ppeRequired?: boolean;        ppeDetails?: string
  workPermitRequired?: boolean; workPermitDetails?: string
  insuranceRequired?: boolean;  insuranceDetails?: string
}
```

- `paymentSchedule` (existing `PaymentMilestone[]`) is reused for service payment milestones — no new type ([rule 32](../../CLAUDE.md)).
- Existing material sections (freight, transport, transit insurance, packing, dispatch, material inspection, warranty) **stay optional** and are simply left blank on a pure-service PO. No fields removed.

### 3.2 `CommercialTermsForm` shows service sections

The terms form ([CommercialTermsForm], used by [pos/new/page.tsx:495](../../apps/web/src/app/procurement/pos/new/page.tsx#L495)) gains a **"Service Terms"** group and a **"Safety & Compliance"** group. To keep the form uncluttered for pure-material POs, reveal these groups when **any line item has `itemType === 'SERVICE'`** (with a manual "Add service terms" override). One form, content-driven.

### 3.3 PDF

The PO PDF renders the Service Terms / Safety blocks **when present**, and hides empty material sections. The document heading stays "Purchase Order" (SO is not a category); the buyer's free-text `title` conveys the service nature. All headings via `@vapour/constants/labels.ts` ([rule 29](../../CLAUDE.md)).

### 3.4 HSN/SAC code per line item

Per-line **GST rate already exists** (`PurchaseOrderItem.gstRate` / `gstAmount`, [purchaseOrder.ts:170](../../packages/types/src/procurement/purchaseOrder.ts#L170)) — a mixed PO can already tax a material line and a service line at different rates. The gap is the classification **code**: add an optional

```
hsnSacCode?: string   // HSN for goods, SAC for services — on PurchaseOrderItem
```

- Optional → no migration ([rule 31](../../CLAUDE.md)). Captured/editable on the PO line; denormalized from the source item (material master / service catalog) when available, else hand-entered.
- Printed per line on the PO PDF (HSN/SAC column).
- **Header tax rollup is unchanged** — keep the existing single blended CGST/SGST total derived from the offer ([crud.ts:200–207](../../apps/web/src/lib/procurement/purchaseOrder/crud.ts#L200-L207)); it is correct even for mixed rates. No rate-wise slab summary in this scope.

### 3.5 Attachments (request #8) — reuse, don't build

Mount the existing `DocumentUploadWidget` on the PO detail page, backed by a generalized version of [attachments.ts](../../apps/web/src/lib/procurement/purchaseRequest/attachments.ts) keyed by `{entityType:'purchaseOrder', entityId}` (storage path `procurement/purchaseOrder/{id}/attachments/…`). No new storage code. Covers supply POs and service POs alike since they are one document.

---

## 4. Reused unchanged

| Concern                                                | Reused                                                                                                             |
| ------------------------------------------------------ | ------------------------------------------------------------------------------------------------------------------ |
| Collection / numbering                                 | `purchaseOrders`, shared `PO/2026/001` sequence                                                                    |
| CRUD / create-from-offer                               | `createPOFromOffer` ([crud.ts:97](../../apps/web/src/lib/procurement/purchaseOrder/crud.ts#L97))                   |
| State machine / approval / self-approval guard / audit | existing PO flow — [rules 6, 8, 18](../../CLAUDE.md) already satisfied                                             |
| Fulfillment                                            | Goods Receipt (material lines) + Work Completion (service lines)                                                   |
| Security rules / indexes                               | existing `purchaseOrders` rules & indexes; add one rule for the attachments collection ([rule 4](../../CLAUDE.md)) |
| List / detail / edit pages                             | existing PO pages — service terms render as extra sections                                                         |

---

## 5. Phasing

| Phase | Scope                                                                                                                                                 | Risk                           |
| ----- | ----------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------ |
| **0** | Delete old `serviceOrders` (record, type, CRUD, pages, state machine, rules, indexes)                                                                 | None (1 record)                |
| **1** | Add `serviceTerms` + `safetyCompliance` optional blocks to `POCommercialTerms`; render in `CommercialTermsForm` (revealed when a service line exists) | Low — additive optional fields |
| **2** | Add optional `hsnSacCode` to `PurchaseOrderItem`; capture on line, print HSN/SAC column on PDF                                                        | Low — additive optional field  |
| **3** | PO PDF renders service terms / safety when present; hide empty material sections                                                                      | Low                            |
| **4** | Attachments: generalize attachments service + mount `DocumentUploadWidget` on PO detail                                                               | Low — reuses infra             |

Rules/indexes ship on the next **Deploy - Production** dispatch (auto-detected) — no local `firebase deploy` ([rule 33](../../CLAUDE.md)).

---

## 6. Resolved decisions

- **HSN/SAC per line:** add optional `hsnSacCode` on `PurchaseOrderItem`, printed per line on the PDF (§3.4).
- **Tax rollup:** keep the existing single blended CGST/SGST header total — no rate-wise slab summary (§3.4).
- **Numbering:** all orders share the `PO/2026/001` sequence — no separate SO numbering (§1).
- No open questions remain. Ready to build on go-ahead.
