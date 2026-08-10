# Accounting reports — insight layer + PDF export

**Status:** COMPLETE. Phases 0 (1794db17), 1 (8e756e93), 2C (7792ee30),
2B (4037650b), 3B (a17b0ee3), 4A (8024a09a), 2A (99550d34), 4B (85adae94), plus the
index fix (b35e6394) and project-name fix (0102e1c1). 3A and 4C dropped on data
grounds — see the DC results. Not deployed beyond the first two phases; the rest
ships on the next Deploy dispatch.

**Date:** 2026-08-09
**Origin:** The accounting user asked for "more insightful reports that can be
downloaded in PDF". This plan is the result of an orientation pass over
`/accounting/reports`, `lib/accounting/`, the transaction type model, and
`firestore.indexes.json` on 2026-08-09.

The request contains two independent problems. PDF export is missing
_structurally_ — not report-by-report, but from the shared exporter every report
funnels through. And the single most insightful report in the module is already
built, already has a PDF, and is **unreachable from the UI**. The second problem
is nearly free to fix and changes what the first one needs to cover, so it goes
first.

---

## What already exists — do not rebuild (rule 32)

| Area          | Covered by                                                                                               |
| ------------- | -------------------------------------------------------------------------------------------------------- |
| Statements    | trial-balance, balance-sheet, profit-loss (with comparatives), cash-flow                                 |
| Ledgers       | account-ledger, entity-ledger (one entity, with aging), `glDrilldown.ts`                                 |
| Statutory GST | GSTR-1 / GSTR-2 / GSTR-3B + portal JSON — `lib/accounting/gstReports/`                                   |
| Statutory TDS | Form 16A, Form 26Q, challan tracking — `tdsReportGenerator.ts`, `/accounting/tax-compliance`             |
| Management    | `period-report` — exec summary, AR/AP aging, working capital, project performance, data quality (see F1) |
| Cash ops      | receipts-payments (monthly, categorised), project-financial                                              |
| Asset math    | `getDepreciationSchedule`, `previewDepreciation`, `getAssetSummary` — `fixedAssetService.ts`             |
| Forecast math | `generateCashFlowForecast`, `getCashFlowSummary` — `paymentPlanningService.ts`                           |

**Statutory reporting is done.** Any request phrased as "a GST report" or "a TDS
report" should be checked against `/accounting/tax-compliance` before a line is
written — the likely real ask is export format, not a new report.

---

## Findings

### F1 — `period-report` is an orphan

`grep -rn "period-report" apps/web/src` returns **nothing** outside its own
directory. It is not in the reports hub's card array
([reports/page.tsx:37-100](../../apps/web/src/app/accounting/reports/page.tsx)),
not in any nav, not linked from `/accounting`. It is reachable only by typing the
URL.

It is also the richest report in the module.
[periodReportData.ts](../../apps/web/src/lib/accounting/reports/periodReportData.ts)
computes, on an Indian-FY quarter/full-year period model: executive summary,
comparative P&L, balance sheet, cash flow, AR aging, AP aging, working capital
with current/quick ratios, GST, project performance, data-quality findings, and
trial balance — and renders all of it through
`components/pdf/PeriodReportPDFDocument.tsx`.

**The accountant may be asking for something that already exists and has never
been shown to them.** This is the reason Phase 0 precedes everything.

**Confirmed by its first real run (2026-08-10).** Linking the page made it
reachable, and `Load preview` immediately failed with `FAILED_PRECONDITION` — the
project-performance query (`type ==` + `date` range, `periodReportData.ts:327`
and `:335`) needs a `transactions` index on **`type ASC + date ASC`**, and only
`type ASC + date DESC` existed. Direction matters: the descending index does not
serve the implicit ascending sort of a range query. Nobody had hit it because
nobody could reach the page — exactly the silent-failure mode rule 2 exists to
prevent. Fixed by adding the index; an empirical sweep of the sibling report
queries (project-financial, entity-ledger, trial-balance, cash-flow,
profit-loss, data-quality) found no other gap.

### F2 — The shared exporter has no PDF path

[exportReport.ts](../../apps/web/src/lib/accounting/reports/exportReport.ts)
exposes `downloadReportCSV` and `downloadReportExcel` over a shared
`ExportSection[]` intermediate. There is no `downloadReportPDF`. All nine hub
reports build `ExportSection[]` and wire CSV + Excel only.

Because that intermediate already exists and every report already builds it, PDF
is a _single new function_ plus one handler per page — not nine bespoke
documents.

### F3 — A dead "Export PDF" button is already shipped

[cash-flow/page.tsx:154](../../apps/web/src/app/accounting/reports/cash-flow/page.tsx#L154)
renders `<Button variant="outlined" startIcon={<DownloadIcon />}>Export PDF</Button>`
with **no `onClick`**. The accountant has almost certainly clicked it. This may
be the entire origin of the request.

`project-financial/page.tsx` has no export of any kind.

### F4 — the FX settlement fields are never written — CORRECTED by DC1

`BaseTransaction` carries `currency`, `exchangeRate`, `baseAmount`,
`bankSettlementRate`, `bankSettlementAmount`, `bankSettlementDate`,
`bankCharges`, and `forexGainLoss`. `forexGainLoss` is computed in
`transactionHelpers.ts` and appears in no UI and no report.

**As first written this finding was too generous.** DC1 shows the settlement
fields are set on **zero** of the 32 non-INR transactions — they are not "computed
but unread", they are never persisted by any create or edit path. Only
`currency` + `exchangeRate` are populated (32/32).

So the FX work splits: a **currency-exposure** report is buildable today, and a
**realized gain/loss + settlement variance** report needs the settlement fields to
start being captured first. That capture gap is itself worth raising with the
accountant — it is where the INR-bank-receipt rate from the locked FX decision
(no `exchangeRates` collection) was supposed to land.

### F5 — Five accounting routes have no export at all

`fixed-assets`, `payment-planning`, `tax-compliance`, `cost-centres`,
`interproject-loans` — none reference `downloadReportCSV`, `downloadPDF`, or
ExcelJS. For `fixed-assets` and `payment-planning` the computation already
exists; only the export surface is missing.

### F6 — Indexes for most proposed reports already exist

`firestore.indexes.json` already carries, on `transactions`:

- `currency + status + date DESC` and `type + currency + date DESC` → FX report
- `currency + bankSettlementRate + bankSettlementDate DESC` → **someone already
  anticipated the FX settlement query and never built the report**
- `bankAccountId + status + date DESC` → bank book
- `type + paymentStatus + dueDate` and `status + type + dueDate` → receivables
- `type + entityId + status` → entity concentration
- `costCentreId + type + date DESC`, `projectId + type + date DESC` → project cuts

Rule 2 is therefore largely pre-satisfied. Each new query must still be checked
against this list — and note the house pattern is equality filters with
**client-side** soft-delete filtering and no `orderBy`
([periodReportData.ts `fetchAgingForType`](../../apps/web/src/lib/accounting/reports/periodReportData.ts)),
which keeps most report queries index-free anyway.

---

## Gating data checks (rule 31) — RUN 2026-08-10

Service account key found at **`docs/inputs/firebase-service-account-key.json`**
(project `vapour-toolbox`, gitignored, untracked). Run analysis scripts from the
repo root so `firebase-admin` resolves. Counts are over live (non-soft-deleted)
`transactions` unless stated.

**DC5 — sizing.** 1052 transactions, **0 soft-deleted**. Well under the 5k
threshold, so report generators can keep the house single-`getDocs` pattern; no
chunking needed. Composition: DIRECT_PAYMENT 247, JOURNAL_ENTRY 242, VENDOR_BILL
240, VENDOR_PAYMENT 195, CUSTOMER_PAYMENT 58, CUSTOMER_INVOICE 50, DIRECT_RECEIPT
20, **EXPENSE_CLAIM 0, BANK_TRANSFER 0**.

**DC1 — foreign currency. Splits the FX report in two.** 32 non-INR transactions
(USD, EUR); all 32 carry `exchangeRate`. But `bankSettlementAmount`,
`bankSettlementRate`, `forexGainLoss`, and `bankCharges` are set on **zero**
records.

> This corrects finding F4. `forexGainLoss` is not merely _read_ by nothing — it
> is _written_ by nothing. The settlement fields exist on the type and are never
> populated by any create/edit path. A realized-FX report would render an empty
> table today.

**DC2 — budget line items. Kills 4C.** 298 line items; **0** carry
`budgetLineItemId` and **0** carry `costCentreId`. Fill rate is zero, not merely
sparse. Line-item budget-vs-actual is impossible and the fix is data entry, not a
report.

**DC3 — bank reconciliation.** `reconciledDate` set on **0** of 1052. But
`bankAccountId` is set on **516**. A bank book keyed on `bankAccountId` is viable;
the reconciliation-status half is not.

**DC4 — fixed assets. Defers 3A.** The `fixedAssets` collection is **empty (0)**.
An asset register and depreciation schedule would both render blank.

**Receivables and concentration inputs — both strongly backed.** 50 customer
invoices, **100% with `dueDate` and 100% with `paymentTerms`** — DSO, ageing
velocity, and on-time-payment percentage are all computable. 86 distinct entities
referenced across the 1052 transactions (of 181 in the master).

### What the checks changed

| Item                 | Planned              | After DC                                                                                                                                                                       |
| -------------------- | -------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| 2A FX                | Tier 1, ranked first | **Rescope.** Exposure-by-currency only (32 txns × `exchangeRate`). Realized gain/loss, settlement variance, and bank charges have no data — building them ships empty columns. |
| 2B Concentration     | Tier 1               | **Unchanged, green.** 86 active counterparties.                                                                                                                                |
| 2C Receivables / DSO | Tier 1               | **Promoted to first.** The only Tier-1 report with 100% field coverage.                                                                                                        |
| 3A Fixed assets      | "cheapest value"     | **Deferred.** 0 assets.                                                                                                                                                        |
| 3B Forecast export   | Tier 2               | Unchanged.                                                                                                                                                                     |
| 4A Bank book         | Tier 3               | **Viable without the reconciliation section** (516 txns have `bankAccountId`, 0 reconciled).                                                                                   |
| 4B Expense analysis  | Tier 3               | **Rescope.** 0 EXPENSE_CLAIM records; the analysis has to run on the 247 DIRECT_PAYMENT rows instead.                                                                          |
| 4C Budget vs actual  | Gated                | **Dropped.** Zero fill.                                                                                                                                                        |

Revised build order: **2C → 2B → 3B → 4A (no reconciliation) → 2A (exposure only)
→ 4B (direct payments)**. 3A and 4C are out until the underlying data exists.

---

## Phase 0 — Reachability and dead controls

**Effort: ~half a day. Do this before anything else and put it in front of the
accountant before starting Phase 1.**

- **0.1** Add a `period-report` card to the hub's `reports` array in
  [reports/page.tsx](../../apps/web/src/app/accounting/reports/page.tsx). Title
  it for what it is — "Management Report (Quarterly / Annual)" — and describe the
  sections, since the value is invisible from the name.
- **0.2** Fix F3: either wire the cash-flow "Export PDF" button to the Phase 1
  exporter or remove it. **Remove it now**, re-add in Phase 1 — a dead control is
  worse than an absent one, and Phase 1 will add it uniformly.
- **0.3** Drop the "Custom Reports — Coming Soon" card, or keep it deliberately.
  The route `/accounting/reports/custom` does not exist.
- **0.4** Show the accountant `period-report` and collect their reaction against
  the Phase 2–4 list.

**Why this gate:** Phases 2–4 are sized in weeks. If `period-report` covers half
the ask, that list changes materially. Building first and demoing later risks
building a second management report alongside the one we have — exactly the
rule-32 failure this repo has paid for repeatedly.

---

## Phase 1 — Shared PDF exporter

**Effort: 1–2 days. Delivers PDF on all nine reports.**

- **1.1** Add `downloadReportPDF(sections: ExportSection[], filename: string, opts?)`
  to [exportReport.ts](../../apps/web/src/lib/accounting/reports/exportReport.ts),
  alongside the CSV and Excel functions. `opts` carries report title, period
  subtitle, and `orientation`.
- **1.2** Add `components/pdf/AccountingReportPDFDocument.tsx` — a generic
  sections-driven document composed from the existing kit in
  [reportComponents.tsx](../../apps/web/src/lib/pdf/reportComponents.tsx):
  `ReportPage` + `ListHeader` + `ReportSection` + `ReportTable` (with `totalRow`
  fed from `section.summary`) + `ListFooter` for page numbers. Ship via
  `downloadPDF` / `sanitiseFilename` from
  [pdfUtils.ts](../../apps/web/src/lib/pdf/pdfUtils.ts).
- **1.3** Auto-select landscape when a section exceeds ~6 columns; column widths
  derived from `ExportColumn.width`, right-aligning `format: 'currency'`.
- **1.4** Wire one handler into each of the nine hub reports (~3 lines each), and
  give `project-financial` its first export by building `ExportSection[]` for it.
- **1.5** ~~Bespoke documents for balance-sheet and profit-loss.~~ **Dropped on
  inspection — not needed.** Both reports' `ExportSection[]` already model the
  statement: one titled section per group (Assets / Liabilities / Equity, Revenue /
  COGS / Operating / Other / Summary), account rows pre-indented as
  `"  <code> <name>"`, and a `summary` total row. That maps one-to-one onto
  `ReportSection` + `ReportTable`'s `totalRow`, so the generic document renders
  them as proper statements. Writing two bespoke documents would have been a
  parallel implementation of layout the data already carried (rule 32).

**Constraints**

- **Never the ₹ glyph** — no custom font is registered, and referencing an
  unregistered family previously made every report PDF throw at render time
  (documented in `reportComponents.tsx`). Implemented as plain grouped numbers
  ("1,23,456.00") plus a single "All amounts in INR" note under the header,
  rather than the per-cell `INR ` prefix this plan first sketched: repeating the
  prefix in every cell of a currency column reads badly and buys nothing.
- Cell rendering goes through `formatCellValue` — the function CSV already used,
  now exported — so the three downloads cannot drift apart (rule 32).
- `@react-pdf/renderer` must stay behind the dynamic import in `generatePDFBlob`
  so it never enters the static bundle.

**Acceptance:** every report under `/accounting/reports` offers CSV, Excel, and
PDF; the three exports of the same report contain the same numbers; no dead
export controls remain.

**Delivered.** All ten report pages export PDF. `cash-flow` and
`project-financial` had no `ExportSection[]` builder at all and gained one, so
both now offer CSV and Excel for the first time as well. Error handling is one
shared hook, `useReportPDFExport` — PDF is the one export that can fail at
runtime, and nine copies of the same try/catch would have drifted. 13 unit tests
cover `formatCellValue` and the orientation rule.

---

## Phase 2 — Tier 1 insight reports

New generators in `lib/accounting/reports/`, new pages under
`app/accounting/reports/`, each with a hub card, a unit test beside the generator
(house pattern: `balanceSheet.test.ts`, `cashFlow.test.ts`, …), and a bespoke PDF
document where summary cards are wanted.

### 2A — Foreign Exchange Gain/Loss & Settlement — **gated on DC1**

`forexReport.ts` + `/accounting/reports/forex`. Realized FX gain/loss per period
and per customer, bank-charge leakage, expected `exchangeRate` vs actual
`bankSettlementRate` variance, and unsettled foreign-currency invoices. Backed by
F4's dead fields; index already present (F6).

Aggregate `baseAmount`, never `totalAmount` (rule 21) — this report is precisely
where a mixed-currency sum would corrupt silently.

### 2B — Customer & Vendor Concentration

`entityConcentration.ts` + `/accounting/reports/concentration`. Revenue by
customer, spend by vendor, top-N as % of total, period-over-period movement,
customers invoiced but never receipted. Entity ledger handles one entity at a
time; nothing in the app ranks across entities.

### 2C — Receivables Performance (DSO) — **DELIVERED**

`receivablesPerformance.ts` + `/accounting/reports/receivables-performance`, with
CSV/Excel/PDF and 22 unit tests. Ships DSO, amount-weighted and median
days-to-collect, on-time rate by value and by count, a five-band ageing that
separates not-yet-due from arrears, monthly invoiced-vs-collected movement, and a
per-customer table flagging arrears over 90 days.

**Two plan assumptions were wrong and the build corrected them:**

1. The plan said `PaymentAllocation.invoiceDate`/`dueDate` "were denormalised for
   exactly this, so no parent re-fetch is needed". They are populated on **17 of
   55** allocations. The report joins on `invoiceId` instead.

2. A first draft reconstructed outstanding by replaying allocations, on the
   reading that rule 21 forbids trusting stored paid figures. Checked against live
   data that produced **₹1.22 Cr** against the canonical **₹11.8 L** — a tenfold
   divergence, because `invoiceAllocations` are historically incomplete (7 receipts
   carry none; some allocate to a synthetic opening-balance id). Rule 21 bars
   trusting the cached `outstandingAmount`, **not** the maintained `amountPaid`,
   and a second definition of "outstanding" is the parallel implementation rule 32
   exists to prevent. The report now uses `deriveOutstanding` like every other
   surface.

   Note the field-name trap that caused the misreading: the atomic payment path
   writes **`amountPaid`**, while the `CustomerInvoice` type declares
   **`paidAmount`**. Reading `paidAmount` alone returns 0 on invoices that are
   fully paid. `deriveOutstanding` resolves `amountPaid` first and is correct;
   ad-hoc scripts reading `paidAmount` are not.

   Consequence for scope: because `amountPaid` is a running total with no dated
   history, ageing is **as at today**, not as at the period end. The period still
   bounds every flow metric. `asOfIsAfterPeriodEnd` drives an in-page notice when
   a historical period is selected, and the monthly trend reports real flows
   (invoiced, collected, net) rather than a reconstructed closing balance.

---

## Phase 3 — Surface existing math

Cheapest value in the plan: the computation is written and tested; only the
report surface and export are missing (F5).

- **3A** Fixed Asset Register + Depreciation Schedule over
  `getDepreciationSchedule` / `getAssetSummary`. Auditors ask for the register
  annually. **Gated on DC4.**
- **3B** Cash Flow Forecast export over `generateCashFlowForecast` — the
  `/accounting/payment-planning` chart gains CSV/Excel/PDF via Phase 1.

---

## Phase 4 — Tier 3

- **4A** Bank Book / Reconciliation Status — per account: opening, receipts,
  payments, closing, unreconciled items. Index present (F6). **Shape depends on DC3.**
- **4B** Expense Analysis — `ExpenseClaim.expenseCategory`, `claimantName`,
  `expenseItems`, plus `DIRECT_PAYMENT` by account; by category, employee,
  project, period-over-period.
- **4C** Budget vs Actual at line-item level via `InvoiceLineItem.budgetLineItemId`
  → `CharterBudgetLineItem`. **Gated on DC2 and likely to be dropped** — if the
  field is sparsely populated the answer is data entry, not a report.

---

## Rules in force

- **Rule 2** — check every new `where + orderBy` against F6's list before adding
  an index; most report queries here are equality-only and need none.
- **Rule 3** — filter `isDeleted` **client-side**, never `where('isDeleted','!=',true)`.
- **Rule 5** — these are read-only reports, so no `requirePermission` writes; page
  access uses `canViewAccounting(claims.permissions)` as the existing hub does.
  `VIEW_FINANCIAL_REPORTS` is **deprecated** — do not resurrect it.
- **Rule 14** — every date off a transaction is a Firestore `Timestamp` at
  runtime; convert with the `'toDate' in raw` check first.
- **Rule 21** — `roundToPaisa` at every step; derive outstanding as
  `total − paid`, never trust cached `outstandingAmount`; aggregate `baseAmount`;
  zero-checks use the `< 0.01` tolerance.
- **Rule 24** — any switch on `TransactionType` handles all nine, no `default`.
- **Rule 29 / 34** — `StatusChip` + `@vapour/constants` labels; `PageHeader`,
  `DataTable`, `LoadingState`, `EmptyState`, shared formatters; exactly one
  `contained` button per view.
- **Rule 32** — before each new generator, `/check-duplicates` on the concept name.

## Testing

Generators are pure functions over fixture transactions — unit test each beside
its source, matching `receiptsPayments.test.ts`. Cover: mixed-currency
aggregation, soft-deleted exclusion, `Timestamp` vs `Date` inputs, empty dataset,
and paisa rounding. Local validation is scoped jest + tsc + scoped lint; the full
web build runs in CI.

## Deployment

`firestore.indexes.json` changes (if any survive F6) and the web app both ship on
the next **Deploy - Production** dispatch. No local `firebase deploy`.

## Out of scope

- Any new GST or TDS report — statutory reporting is complete.
- Scheduled/emailed report delivery.
- A custom report builder (the hub's "Coming Soon" card) — that is a product, not
  a report.
- Charts inside PDFs — `@react-pdf/renderer` has no chart primitive; summary
  cards and tables only.

---

## Outcome

Eleven reports now sit under `/accounting/reports`, every one of them exporting
CSV, Excel and PDF; `payment-planning` exports its forecast too. 132 unit tests
cover the reports module.

**Six new surfaces:** receivables performance (DSO), customer & vendor
concentration, bank book, FX exposure, expense analysis, and the cash-flow
forecast export.

**Two dropped, both on evidence rather than judgement.** The fixed-asset register
has no assets to register; line-item budget-vs-actual has zero fill on
`budgetLineItemId` across all 298 line items. Neither is a reporting problem.

### What the build corrected in this plan

Every one of these came from checking data rather than reasoning about it:

| Assumption                                                   | Reality                                                                                                                          |
| ------------------------------------------------------------ | -------------------------------------------------------------------------------------------------------------------------------- |
| FX realized gain/loss is buildable                           | The settlement fields are written by nothing. Only exposure is buildable.                                                        |
| `EXPENSE_CLAIM` drives expense analysis                      | Zero records. `DIRECT_PAYMENT` carries the spend.                                                                                |
| Allocation `invoiceDate`/`dueDate` are denormalised for this | Populated on 17 of 55. Join on `invoiceId`.                                                                                      |
| Rule 21 forbids trusting stored paid figures                 | It forbids trusting `outstandingAmount`. `amountPaid` is maintained and canonical — reconstructing outstanding diverged tenfold. |
| A `(type, date)` index covers a date-range query             | Direction matters. `type ASC + date DESC` does not serve the implicit ascending sort.                                            |
| Bespoke PDF documents needed for statements                  | The `ExportSection[]` already carried the structure.                                                                             |

### Known gaps this work surfaced but did not close

- **FX settlement capture.** `bankSettlementRate`, `bankSettlementAmount`,
  `bankCharges`, `forexGainLoss` are never written. Realized FX gain/loss stays
  unreportable until the invoice and payment dialogs record them. This is the
  single highest-value follow-up.
- **Bank reconciliation.** `reconciledDate` is set on nothing, so the bank book
  ships without a reconciliation section.
- **Cost centres tagged as projects.** `projectIds` on transactions sometimes
  holds a cost-centre id; both the period report and expense analysis resolve
  against both masters to compensate.
- **`paidAmount` vs `amountPaid`.** The type declares one name, the write path
  uses the other. Any new code reading the declared name silently gets zero.
