# Procurement ↔ Materials — Integration Audit

Date: 2026-04-24
Context: application in testing phase, one active project

## TL;DR

The procurement module and the materials module are **only partially connected**. Ordering flows through without writing back to the material master in three big ways:

1. **Goods Receipts do not record stock movements** — receiving goods leaves inventory invisible.
2. **Bills do not update material cost history** — actual landed cost vs. quoted price is never captured.
3. **RFQ offers do not update material pricing** — competitive bids are lost after the offer is selected.

On top of that, a PR can be created with **free-text item descriptions** that never reference the material master, and the system maintains two master collections (`materials` + `boughtOutItems`) that procurement treats as one.

Testing-phase-with-one-project calibration is in the last section — not everything needs fixing now.

---

## Findings by severity

### CRITICAL-1 — Stock movements not written on GR completion

**File**: [goodsReceiptService.ts:457–499](apps/web/src/lib/procurement/goodsReceiptService.ts#L457)

When a Goods Receipt transitions to `COMPLETED`, the service creates a vendor bill (via `createBillFromGoodsReceipt`) but does **not** write to the `stockMovements` collection. Grep confirms no procurement service writes `stockMovements`.

**Impact** — inventory levels are never updated when material arrives. Cannot track inbound receipts, cannot value inventory, no audit trail of physical stock changes.

**Fix** — inside the `completeGR()` transaction, write one `stockMovements` doc per accepted line item with `type: 'INBOUND'`, `sourceType: 'GR'`, quantity, unit cost, reference to GR/PO ids.

**Effort**: ~3h.

---

### CRITICAL-2 — Bill creation does not update material cost history

**File**: [accountingIntegration.ts:78–320](apps/web/src/lib/procurement/accountingIntegration.ts#L78)

When `createBillFromGoodsReceipt()` builds the bill, line-item costs go into the GL, but **no `materialPrices` record is written** for the actual landed cost. The `unitPrice` captured is the PO offer price, not the invoice price — so if the vendor invoices at a different rate (tax adjustments, currency, unit conversion), you can't tell.

**Impact** — no actual-cost-per-unit history. All cost reports use the quoted offer price. Can't compute vendor price drift, can't identify overcharging, can't feed cost learning into future estimation.

**Fix** — after the bill's GL entries post, iterate the bill line items that have a `materialId` and call `addMaterialPrice()` with `sourceType: 'VENDOR_INVOICE'`, effective-date = bill date, price = line cost ÷ qty.

**Effort**: ~2h.

---

### CRITICAL-3 — RFQ-offer prices not captured to material pricing (older flow)

**File**: [offer/crud.ts](apps/web/src/lib/procurement/offer/crud.ts)

The older RFQ → offer → PO path has no mechanism to push accepted offer prices back into `materialPrices`. Only the newer **vendorOffers** module ([vendorOfferService.ts:426–474](apps/web/src/lib/vendorOffers/vendorOfferService.ts#L426)) does this correctly — its `acceptPrice()` calls `addMaterialPrice()` for MATERIAL items.

**Impact** — for every offer that came in through the RFQ flow, you have the data momentarily during the comparison screen and then it's gone the instant a PO is created. No historical record of "Vendor A quoted ₹X, Vendor B quoted ₹Y" for a material.

**Fix** — mirror the vendorOfferService pattern in `offer/crud.ts`. On `selectOffer()` (status → SELECTED), iterate offer items with `materialId` and write `materialPrices` records with `sourceType: 'VENDOR_QUOTE'`.

**Effort**: ~4h.

This is CRITICAL for procurement intelligence but MAJOR in current volume terms — you have 6 `offers` docs vs 4 `vendorOffers` docs. As the business moves to the newer flow this becomes less important.

---

### MAJOR-4 — PR items can bypass the material master

**File**: [purchase-requests/new/page.tsx:151–171, 556–613](apps/web/src/app/procurement/purchase-requests/new/page.tsx#L151)

The material picker dialog is optional. A user can type a description like `"steel plate 10mm"` and submit the PR with no `materialId`. The unmapped item flows all the way through RFQ → Offer → PO → GR → Bill, and none of the cost/stock loops can close for it.

**Impact** — procurement data fragmented: some items linked to master, some not. Everything downstream (price history, stock tracking, BOM reconciliation, project cost rollup) silently misses the unmapped items.

**Fix** — in the PR item form, require material master selection for `RAW_MATERIAL` and `BOUGHT_OUT` categories. Allow free-text only for `SERVICE` or with an explicit "unmapped" flag.

**Effort**: ~1h. Smallest change, one of the biggest data-integrity wins.

---

### MAJOR-5 — `materials` vs `boughtOutItems` split is unclear

**Files**: [boughtOut.ts:451–492](packages/types/src/boughtOut.ts#L451), procurement item types

There are two separate Firestore collections:

- `materials` — raw materials and components
- `boughtOutItems` — assembled items (pumps, valves, motors) with their own `materialRefs` back to the materials they're built from

Procurement RFQ/PO items reference `materialId` universally — a bought-out pump is treated as a regular material in the procurement flow. The distinction exists in the category field on the form (`RAW_MATERIAL` vs `BOUGHT_OUT`) but doesn't route items differently downstream.

**Impact** — architectural confusion. Different lifecycle flows collapse into one procurement path. Bought-out items often need specialised inspection at GR (datasheets, compliance certificates) but there's no room for that in today's flow.

**Fix** — add `itemType: 'RAW_MATERIAL' | 'BOUGHT_OUT' | 'SERVICE'` to `PurchaseRequestItem`, carry through to RFQ/PO/GR. Surface the distinction in the UI and specialise the GR inspection form for bought-out items.

**Effort**: ~8h. Architectural — not urgent unless the confusion is actively biting.

---

### MINOR-6 — Material variant data lost in PR

**File**: [purchase-requests/new/page.tsx:151–171](apps/web/src/app/procurement/purchase-requests/new/page.tsx#L151)

If a material has variants (e.g. `SS304-3MM` vs `SS304-5MM`), the picker accepts a `variant` parameter but PR item save only captures `specification: fullCode || material.materialCode`. The variant reference isn't persisted, so downstream RFQ/PO items lose the variant link.

**Fix** — add `variantId?`, `variantCode?` fields to `CreatePurchaseRequestItemInput`. Save in `handleMaterialSelect`.

---

### MINOR-7 — RFQ vendor suggestions only look at preferredVendors

**File**: [suggestions.ts:1–60](apps/web/src/lib/procurement/rfq/suggestions.ts#L1)

`suggestVendorsForRFQ()` only queries `material.preferredVendors`. If an item has no `materialId` (fallout from Major-4), or a vendor isn't marked preferred, they won't appear as an RFQ suggestion even if they've quoted the same item before.

**Fix** — extend suggestions to also query historical offer/PO vendors for the same material category. Fall back to category-based suggestions if no materialId.

---

## Testing-phase, one-project priorities

Not every finding is urgent today. Ranked for the current context:

### Do now

**Major-4 (1h)** — require material master selection in PR form. This is the cheapest fix with the biggest downstream benefit. Every PR after this point becomes clean data that the other fixes can actually latch onto.

### Do soon (weeks)

**Critical-2 (2h)** — Bill → materialPrices feedback loop. Without this you can't learn from actual invoices. Even on one project, every bill you post is a data point about vendor cost drift.

**Critical-3 (4h)** — RFQ-offer → materialPrices. Only matters if you still use the older offers flow. If the newer `vendorOffers` is where new work goes, you can defer this and let the old flow age out.

### Skip until the business needs it

**Critical-1 (stock movements)** — you're running an engineering-services firm, not a warehouse. Materials are ordered for a specific project and consumed. If inventory tracking isn't a real business need, don't build it yet. If you later do inventory on site deliveries, build it then.

**Major-5 (materials vs. boughtOutItems)** — architectural cleanup. Not urgent unless users are getting confused in practice.

**Minor-6, Minor-7** — nice-to-haves, wait for user friction before scheduling.

---

## One-line summary

The procurement module ships goods to the project fine; it just forgets to tell the material master what happened. The single fix that's worth doing this week is **Major-4 (require material master on PR items)** — it costs an hour and gates the value of everything else.
