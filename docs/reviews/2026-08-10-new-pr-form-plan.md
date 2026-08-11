# New Purchase Request form — field model + layout

**Status:** §5 batches 1–7 implemented 2026-08-11, live data backfilled. §7 bulk generation not started.
**Target:** [`purchase-requests/new/page.tsx`](../../apps/web/src/app/procurement/purchase-requests/new/page.tsx) (1110 lines) and its twin [`[id]/edit/EditPRClient.tsx`](../../apps/web/src/app/procurement/purchase-requests/[id]/edit/EditPRClient.tsx).
**Raised:** 2026-08-10, from a screenshot review of the New PR screen.
**Companion:** [PR list IA plan](2026-08-10-pr-list-ia-plan.md) — shipped in `47a29496`; several items below change what that page filters on.

---

## 1. What the screen asks for today

Basic Information, in order: **Type** (Project / Budgetary / Internal) · **Category** (Service / Raw Material / Bought Out) · **Priority** (Low / Medium / High / Urgent) → **Project / Cost Centre** → **Title** + **Required By** → **Approver**. Five rows of chrome before "Line Items", which starts roughly 750px down the page.

### Reported, and what the code and data say

| #   | Complaint                                                  | Verified finding                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                         |
| --- | ---------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 1   | The first dropdown is "Project" — it can be a proposal too | The linkage selector is [`ProjectSelector`](../../apps/web/src/components/common/forms/ProjectSelector.tsx), labelled "Project / Cost Centre", and it loads **projects + cost centres into one list and writes both into `projectId`** with no discriminator. Live data: 25 PRs point at a real project, **3 point at a cost centre** through that same field. Proposals are not offered anywhere in procurement — `grep proposalId` across `packages/types/src/procurement/` and `lib/procurement/` returns nothing.                                    |
| 2   | Why is the Category dropdown necessary?                    | Header Category and the per-line Type column say the same thing twice. The header's _only_ job in code is to pick the default Type for a newly added row ([new/page.tsx:288](../../apps/web/src/app/procurement/purchase-requests/new/page.tsx#L288)). Live data: of the 14 PRs whose items carry an explicit `itemType`, **14 agree with the header and 0 disagree**, and **no PR mixes item types**. **Resolved 2026-08-11 by asking the users: a PR carries one kind only, so the header question stays and the per-line Type column goes** (see §3). |
| 3   | Priority is not required                                   | One functional consumer in the whole codebase: [`purchaseRequest/workflow.ts:137`](../../apps/web/src/lib/procurement/purchaseRequest/workflow.ts#L137) maps `URGENT → HIGH` and everything else to `MEDIUM` for the approval task notification. Otherwise it is a chip, a CSV column and a composite index. Live distribution — HIGH 19, MEDIUM 8, URGENT 2 — is a field being filled in, not used. `requiredBy` already carries real urgency.                                                                                                          |
| 4   | Cost centre only applies to a project-related PR           | Sharper than that: of the 12 cost centres, eleven are `CC-PRJ-*` mirrors of projects and one is the genuine standalone **`CC-ADMIN` / Administration** (`7BTDcwR2waTJWFWKrJ4x`). All 3 PRs that point at a cost centre point at CC-ADMIN, and each is typed `PROJECT` with `projectName: "Administration"` — typed that way because Internal offered no selector at all.                                                                                                                                                                                 |
| 5   | Too much space before the first line item                  | Four rows plus Approver. **Approver is marked `required` in the UI but validation only demands it when submitting** ([new/page.tsx:343](../../apps/web/src/app/procurement/purchase-requests/new/page.tsx#L343)) — a draft saves fine without it.                                                                                                                                                                                                                                                                                                        |

---

## 2. "Even for a project we could get a budgetary quote" — the model this implies

That sentence breaks the current `type` enum, and it is right to break it. `PROJECT | BUDGETARY | INTERNAL` mixes **two independent questions** into one dropdown:

- **What is this PR for?** — a project, a proposal, or internal running costs.
- **Is this a firm order or a price check?** — budgetary PRs may collect quotations but must never become a PO ([`requireNonBudgetaryRFQ`](../../apps/web/src/lib/procurement/purchaseOrder/crud.ts#L127)).

Because they share one field, "budgetary" today costs you the project link: all **9** BUDGETARY PRs in the system are for the SP 40 project, and every one had to be typed BUDGETARY, losing the ability to say PROJECT. The same collision hides Administration PRs inside `PROJECT`.

**Proposal: split the axes.**

- `raisedFor: 'PROJECT' | 'PROPOSAL' | 'INTERNAL'` — drives the linkage selector.
- `isBudgetary: boolean` — an independent checkbox, available on all three, that carries the pricing-only meaning and the PO block.

Then "a budgetary quote for a project" is `raisedFor: PROJECT` + `isBudgetary: true`, which is exactly what those 9 PRs are. `RFQ.isBudgetary` already exists as a denormalised flag with this meaning, so the RFQ and PO guards get _simpler_, not more complex.

Linkage per `raisedFor`:

| `raisedFor` | Selector shown                                      | Written fields                                       |
| ----------- | --------------------------------------------------- | ---------------------------------------------------- |
| `PROJECT`   | Project (required) — projects only, no cost centres | `projectId`, `projectName`                           |
| `PROPOSAL`  | Proposal (required) — `proposals` collection        | `proposalId`, `proposalNumber`                       |
| `INTERNAL`  | **none** — no question asked                        | `costCentreId`, `costCentreCode` fixed to `CC-ADMIN` |

`projectId` stops being a dumping ground for cost-centre ids. Internal PRs stop asking a question whose answer is always Administration.

## 3. Locked decisions (2026-08-10, category revised 2026-08-11)

- **Category: kept as the header question, and the per-line Type column is removed instead.** ~~Input removed, value derived on save from the line items.~~ Superseded — the users say a PR is for raw materials _or_ bought-out items _or_ services, never a mix, so the classification belongs once at the top and every line inherits it. The live data agrees: no PR mixes item types today, so nothing existing violates the rule. Items still persist `itemType` (RFQ vendor suggestion, PO line creation, quote comparison and material pricing all read it) — it is written from the header category at save instead of asked per row.
- **Priority:** **deleted everywhere** — form, type, list column, CSV, detail chip, `status+priority+createdAt` index. The approval notification always uses `MEDIUM`. A one-off script strips the dead field from the 29 documents.
- **Approver:** moved out of Basic Information **into the Submit for Approval action**, matching the validation that already exists.
- **Linkage:** the two-axis model in §2 — pending the user's confirmation, since it replaces `type` rather than extending it.

## 4. Target layout

```
New Purchase Request
────────────────────────────────────────────────────────────────────────────────
Basic Information
[Raised for: Project ▾] [Project *: SP 40 Thermal… ▾] [Category *: Raw Material ▾] ☐ Budgetary
[Title * ..............................................]  [Required By ........]
────────────────────────────────────────────────────────────────────────────────
Line Items · Raw Material   0 items      [Import Excel] [+ Add Item]
#  Description *        Specification        Qty   Unit   Equipment Code
1  …
```

Five rows become two. `raisedFor: INTERNAL` hides the middle field entirely and shows `Cost centre: Administration (CC-ADMIN)` as static helper text. The first line item moves up by roughly 300px, and dropping the Type column gives the item table back the width it currently loses to a horizontal scrollbar.

## 5. Work batches

### Batch 1 — types and constants

- `PurchaseRequest`: add `raisedFor`, `isBudgetary`, `proposalId`/`proposalNumber`, `costCentreId`/`costCentreCode`; remove `priority`; keep `category` unchanged; retire `PurchaseRequestType` and `type`.
- `PurchaseRequestItem.itemType` stays on the document but leaves the input surface — `CreatePurchaseRequestItemInput` no longer takes it per row.
- `PURCHASE_REQUEST_RAISED_FOR_LABELS` in `labels.ts`. Delete `PURCHASE_REQUEST_TYPE_LABELS` (added 2026-08-10, only the list page consumes it).
- `CC_ADMIN_CODE = 'CC-ADMIN'` — resolve the id by code at write time, never hardcode `7BTDcwR2waTJWFWKrJ4x`.

### Batch 2 — service layer

- `createPurchaseRequest` / `updatePurchaseRequest`: stamp every item's `itemType` from the PR's `category` (`RAW_MATERIAL → MATERIAL`, `BOUGHT_OUT → BOUGHT_OUT`, `SERVICE → SERVICE`); write the linkage triple per `raisedFor`; drop `priority`. Reject a create/edit whose lines carry a master-data link of the wrong kind (rule 23) rather than silently re-stamping it.
- `ListPurchaseRequestsFilters`: `type` → `raisedFor` + `isBudgetary`; drop `priority`.
- Budgetary guards read `pr.isBudgetary` instead of `pr.type === 'BUDGETARY'` — [`rfq/crud.ts:211`](../../apps/web/src/lib/procurement/rfq/crud.ts#L211) and [`purchaseOrder/crud.ts:144`](../../apps/web/src/lib/procurement/purchaseOrder/crud.ts#L144). Both currently fall back to reading the source PRs; that fallback stays, just on the new field.
- Approval notification priority becomes a constant.

### Batch 3 — a `PRLinkageSelector` component

One component owning the `raisedFor` → source mapping, used by both New and Edit (rule 32 — not two copies). Projects from `projects`, proposals from `proposals`, internal short-circuited to CC-ADMIN. `ProjectSelector` keeps `includeCostCentres` for its other callers; the PR form stops using it.

### Batch 4 — the two forms

New and Edit both lose Priority and Approver from Basic Information, keep Category, and gain the linkage component plus the Budgetary checkbox. Edit must restore every new field in its reset effect (rule 22 / 14b) — the round-trip test is create → save → reopen edit → save → nothing changes. Approver moves into a `SubmitForApprovalDialog` used by both the form's submit button and the detail page.

The line-items table loses its Type column, and with it `rowType()`, `defaultItemType` and `handleLineTypeChange` in both files. What replaces them:

- **The header category drives everything per row.** `CatalogPickerDialog` already accepts a `kinds` restriction, so the search icon opens locked to the one kind — no tab choice, one fewer decision per line.
- **Changing Category with lines present must clear the stale master-data links** on every row (`materialId` / `boughtOutItemId` / `serviceId` plus the fields derived from them). `handleLineTypeChange` does exactly this per row today; the logic moves up to the header handler and needs a confirm — "Changing the category will clear the N items you have picked" — because it now discards the whole table's links at once, not one row's.
- **Validation** keys the required master-data link off the header category instead of the row type.
- **Importers gate to the category**: `DocumentParseDialog` (PDF) only ever produces `materialId` links, so it is offered only on a RAW_MATERIAL PR; `ExcelUploadDialog` rows inherit the header kind. Anything imported that cannot satisfy the category's link requirement surfaces as a row-level error, not a silent drop.

### Batch 5 — the read surfaces

Detail page, list page (Type filter → Raised-for filter + a Budgetary chip; Priority column removed), `exportPRList.ts`, `prListPDF.ts`, RFQ creation-from-PR screens.

### Batch 6 — backfill, then indexes

Every one of the 29 live PRs maps deterministically — no ambiguity, so this is a one-off script, not lift-on-load code (rule 31):

| Today                                                                                     | Count | Becomes                                                                |
| ----------------------------------------------------------------------------------------- | ----- | ---------------------------------------------------------------------- |
| `type: PROJECT`, real project                                                             | 16    | `raisedFor: PROJECT`, `isBudgetary: false`                             |
| `type: PROJECT`, projectId = CC-ADMIN (`PR/2026/0003`, `PR/2026/0024`, `PR/2026/02/0003`) | 3     | `raisedFor: INTERNAL`, `costCentreId: <CC-ADMIN>`, `projectId` cleared |
| `type: BUDGETARY` (all 9 point at SP 40)                                                  | 9     | `raisedFor: PROJECT`, `isBudgetary: true`                              |
| `type: INTERNAL` (`PR/2026/03/0001`, no link)                                             | 1     | `raisedFor: INTERNAL`, `costCentreId: <CC-ADMIN>`                      |

Same script drops `priority` and `type`, and stamps `itemType` onto the 71 of 99 items that predate the field, from their PR's category. Run it, verify counts, then delete `status+priority+createdAt` from `firestore.indexes.json`.

### Batch 7 — verification

`tsc`, scoped lint, jest (extend the list-page tests, add service tests for the category derivation and the budgetary guard), `check-rules.js`, `check-ui-standards.js`. Indexes ship on the next Deploy dispatch.

## 6. Knock-on effects to expect

- **The list page shipped on 2026-08-10 changes shape**: its Type filter becomes Raised-for + Budgetary, and its Priority column disappears. `PURCHASE_REQUEST_TYPE_LABELS` and `PRIORITY_LABELS` (PR usage) go with them. The Category filter and chip survive untouched, since Category stays a real user-set field.
- **One kind per PR follows the vendor, and that is the point** (confirmed 2026-08-11): a pump vendor quotes pumps. You do not ask him for a service at PR stage, so a PR that mixes kinds could never go out as one RFQ anyway — it would have to be split before it reached a vendor. Making the split happen at the PR keeps the PR → RFQ → Offer → PO chain one-to-one instead of fanning out mid-flow, and it sharpens `vendorCategoryMatch` (shipped 2026-08-10), which suggests RFQ vendors from item categorisation. A requester who needs materials _and_ a service raises two PRs, by design.
- **The "pump plus its commissioning" case is already handled downstream**, so it is not an argument for mixed PRs: service scope attaches to the purchase order as `serviceTerms` on `POCommercialTerms`, not as a service line on the material PR.

---

## 7. Bulk PR generation from a project or proposal (follow-on track)

One category per PR is right for a hand-raised PR, but it makes a BOM tedious: a project BOM is split by hand into a materials PR and a bought-out PR, line by line. **Decided 2026-08-11:** a separate bulk mode generates them, so the constraint costs nothing at the point where volume actually arrives.

**What the source data allows.** `BOMItemType` is `ASSEMBLY | PART | MATERIAL` and `AddBOMItemDialog` restricts its catalog picker to `['BOUGHT_OUT', 'RAW_MATERIAL']` — **a BOM cannot hold a service line at all**, so a BOM generates at most **two** PRs, never three. Service PRs stay hand-raised. `ASSEMBLY` rows are containers, not procurable lines; the generator procures their children and skips the assembly itself.

**Why the source can be either.** `BOM` already carries both `projectId` and `proposalId` ([bom.ts:129-133](../../packages/types/src/bom.ts#L129-L133)), and a proposal links its BOMs through `BOMCostSheetBlock.linkedBomIds`. So "project generates PRs" and "proposal generates PRs" are the same code path with a different `raisedFor` — an awarded project's BOM produces `raisedFor: PROJECT` PRs, a proposal's BOM produces `raisedFor: PROPOSAL` + `isBudgetary: true`, which is exactly the quote-pricing loop from §2.

**Flow.** Pick BOM → the generator groups procurable lines by category → shows the proposed split (2 PRs, N and M lines, with per-group totals) → the user can subdivide a group into sourcing packages before committing, but never merge across categories → one action creates them all as DRAFT, sharing `raisedFor`, linkage, `requiredBy` and approver.

**Engineering constraints this has to respect:**

- **Chain denormalisation (rule 26):** each generated PR carries `bomId` + `bomNumber`, extending the documented Project → BOM → PR chain. Do **not** reuse `isBulkUpload` / `bulkUploadFileUrl` — those mean "came from an Excel upload" and conflating them (rule 32) would make the two sources indistinguishable.
- **Idempotency (rule 9):** a double-click must not produce four PRs. Guard on a generation key, and disable the button while in flight.
- **Batch limits (rule 20):** two PRs plus their items is small, but a 300-line BOM is not — chunk item writes at 500.
- **Numbering:** `generateProcurementNumber` is counter-backed through `generateCounterBackedNumber`, so sequential calls are transaction-safe; call it once per PR rather than deriving suffixes.
- **Stale tokens (rule 35):** wrap _every_ Firestore call in the handler — number generation, PR writes, item writes and audit logs — not just the first.
- **Audit (rule 18):** one `logAuditEvent` per created PR, naming the source BOM.
- **Permissions (rule 5):** `requirePermission(MANAGE_PROCUREMENT)` once in the service, before any write.

Sequenced after the batches above — the generator should emit the new field shape (`raisedFor`, derived `itemType`), not the old one.

- **`type` is a breaking field rename**, not an addition — anything reading `pr.type` breaks loudly at compile time, which is the intent.
- **Proposal-linked PRs are new ground**: 2 proposals exist and no PR has ever pointed at one, so the first one is untested against RFQ creation, which assumes `projectIds`. Batch 3 must decide whether an RFQ from a proposal-linked PR carries an empty `projectIds` or the proposal reference — flagged, not yet decided.
