# Procurement — Blockers and Fixes

Date: 2026-04-24

## The funnel is collapsing

```
PR (34) → RFQ (21) → Offer (6) → PO (5) → GR (1) → WCC (0) → 3-Way Match (0)
```

34 purchase requests, 5 POs, 1 goods receipt, 0 work completion certificates. The upstream half works; the downstream half effectively doesn't exist for users. This is almost entirely a UI-plumbing problem, not missing backend logic.

## Root cause

Every downstream step (GR, WCC, amendment, 3-way match) exists as a standalone route but has **no entry point from the PO detail page**. Users don't know where to start.

The PO detail header exposes Edit / Submit / Approve / Reject / Issue / Cancel — and nothing else. A PO with status `ISSUED` has no "Receive Goods" or "Issue Work Certificate" button. Users would have to guess the URL.

[POHeader.tsx](apps/web/src/app/procurement/pos/[id]/components/POHeader.tsx) is the single most valuable file to fix in this module.

---

## Blockers — in priority order

### B1. No "Create Goods Receipt" button on PO detail page — BLOCKER

Impact: GR has 1 document total. Users don't know the feature exists.

Fix — in [POHeader.tsx](apps/web/src/app/procurement/pos/[id]/components/POHeader.tsx#L86), add a button visible when PO status ∈ {ISSUED, ACKNOWLEDGED, IN_PROGRESS} that links to `/procurement/goods-receipts/new?poId=<id>`. The target page already accepts this query param — see [goods-receipts/new/page.tsx:119](apps/web/src/app/procurement/goods-receipts/new/page.tsx#L119).

### B2. No "Issue Work Certificate" button on PO detail page — BLOCKER

Impact: WCC has 0 documents, ever.

Fix — same file as above; button visible when PO status ∈ {IN_PROGRESS, COMPLETED} that links to `/procurement/work-completion/new?poId=<id>`.

### B3. PO stuck at APPROVED — downstream gated on ISSUED

Impact: GR's filter requires `['ISSUED', 'ACKNOWLEDGED', 'IN_PROGRESS']`. Several POs sit at APPROVED and never get flipped to ISSUED because users don't realise "Issue to Vendor" is a mandatory step for downstream.

Fix options (pick one):

- Auto-issue on approval (simplest — kills the extra step entirely if you don't need a separate "I sent the PDF to the vendor" moment).
- Keep the step but add contextual hint text on the PO header after approval: "PO must be issued to vendor before goods can be received. [Issue to Vendor]".

[POHeader.tsx:122-126](apps/web/src/app/procurement/pos/[id]/components/POHeader.tsx#L122) is where the Issue button lives today — it's there, just not prominent or explained.

### B4. Offer → PO link is missing from the Offer page

Impact: only 1 of 6 offers became a PO. The PO create flow needs `?offerId=...` but the offer detail/comparison page doesn't surface a "Create PO from this Offer" button.

Fix — on the offer comparison page and offer detail, when an offer has status `SELECTED`, expose "Create PO from this Offer" linking to `/procurement/pos/new?offerId=<id>`. The PO create page already reads this param — [pos/new/page.tsx:54](apps/web/src/app/procurement/pos/new/page.tsx#L54).

### B5. Two parallel offer collections (`offers` vs `vendorOffers`) — MAJOR

Impact: 6 docs in `offers` (Feb 2026, older flow) vs 4 docs in `vendorOffers` (all Apr 12 2026 — newer parser-driven flow). The PO create page reads only `offers`. If a user uses the new `vendorOffers` flow, those offers will not appear when creating a PO.

Fix — pick one:

1. Kill the old `offers` flow, point all reads to `vendorOffers`, migrate the 6 old docs.
2. Keep both, make the PO create page read both collections, label the source in the UI.

Option 1 is cleaner if the new flow is the intended direction. Either way, pick today — having both live is how data gets lost.

### B6. Three-way match is manual, not automatic

Impact: 0 matches. Users don't know to trigger it after GR.

Fix — when a `goodsReceipt` document is written with a corresponding vendor bill already present, the relevant Cloud Function should auto-create a `threeWayMatch` draft. Users then just review/approve instead of starting from zero.

### B7. Amendments and packing lists have no PO-detail entry

Impact: `purchaseOrderAmendments`, `packingLists` = effectively 0.

Fix — same POHeader change. Add "Amend PO" for non-terminal statuses (DRAFT, APPROVED, ISSUED, IN_PROGRESS) and "Create Packing List" for ISSUED+.

### B8. Service Orders — unclear purpose

Impact: 0 documents. Page exists with a "New Service Order" button but the relationship to a PO is undefined. Is it a sibling of PO (for services instead of goods)? A child of a PO (for inspection/testing under an existing PO)? Users can't tell.

Fix — decide the data model first:

- If **sibling of PO** — rename its entry point in the nav to "New Service Order" and document when to use this over a regular PO.
- If **child of PO** — move entry to a button on PO detail, hide the standalone page.
- If **neither** — remove from the sidebar until you know.

Until that decision is made, the route is just confusing surface.

---

## Secondary — things to clean up after B1–B8

- **`rfqPdfRecords` has 35 docs but no `createdAt` field** — this collection is used for something but our audit couldn't tell recency. Audit its purpose; if it's a transient log, add TTL cleanup.
- **`offerComparisons`, `vendorOfferItems`, `rfqTermsTemplates`** — 0 docs across the board. Either wire them in or delete the collections / stop the code paths writing to them.
- **`receiptPhotos` — 0 docs.** If we want photo-proof on GR, this needs a working upload UI on the GR create page.
- **`purchaseOrderVersions` and `amendmentApprovalHistory` — 0 docs.** Don't bother building the amendments UI (B7) without these being written as the amendment flow runs. They're the audit trail; if they stay empty after amendments go live, it's a bug.

---

## Suggested fix sequence

1. **Day 1–2** — B1, B2, B3, B7 in a single pass on [POHeader.tsx](apps/web/src/app/procurement/pos/[id]/components/POHeader.tsx). Tiny UI change, unlocks the entire downstream funnel.
2. **Day 3** — B4 on the offer detail page + decide B5 (kill old `offers` or unify reads).
3. **Day 4** — B6 — Cloud Function trigger for 3-way match.
4. **Week 2** — B8 product decision on Service Orders.
5. **Week 3** — secondary cleanup, dead-collection deletion.

After step 1 alone, expect GR and WCC usage to climb from ~0 to matching the PO rate within one full procurement cycle, simply because the buttons exist where users look.
