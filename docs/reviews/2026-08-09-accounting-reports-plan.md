# Accounting reports — insight layer + PDF export

**Status:** PLANNED — not started
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

### F4 — `forexGainLoss` is computed and read by nothing

`BaseTransaction` carries `currency`, `exchangeRate`, `baseAmount`,
`bankSettlementRate`, `bankSettlementAmount`, `bankSettlementDate`,
`bankCharges`, and `forexGainLoss`. `forexGainLoss` is computed in
`transactionHelpers.ts` and appears in **no UI and no report** — it is dead data
today.

This matches the locked FX decision (rate derived per transaction from the INR
bank receipt, no `exchangeRates` collection): the per-transaction fields are the
source of truth, so a report over them needs no new data model.

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

## Gating data checks (rule 31)

**No service-account credentials are present in this working copy** —
`mcp-servers/firebase-feedback/service-account-key.json` and
`firebase-service-account.json` are both absent. These counts must be run before
the phases they gate, otherwise we risk shipping reports over empty datasets.

```js
// scratch script — needs firebase-service-account.json at repo root
const admin = require('firebase-admin');
admin.initializeApp({
  credential: admin.credential.cert(require('./firebase-service-account.json')),
});
const db = admin.firestore();

(async () => {
  const txns = await db.collection('transactions').get();
  const live = txns.docs.map((d) => d.data()).filter((t) => t.isDeleted !== true);

  // DC1 — gates Phase 2A (FX report)
  const fx = live.filter((t) => t.currency && t.currency !== 'INR');
  console.log(
    'DC1 non-INR txns:',
    fx.length,
    '| with bankSettlementAmount:',
    fx.filter((t) => t.bankSettlementAmount != null).length,
    '| with forexGainLoss:',
    fx.filter((t) => t.forexGainLoss != null).length,
    '| currencies:',
    [...new Set(fx.map((t) => t.currency))]
  );

  // DC2 — gates Phase 4C (budget vs actual)
  const withLines = live.filter((t) => Array.isArray(t.lineItems) && t.lineItems.length);
  const lines = withLines.flatMap((t) => t.lineItems);
  console.log(
    'DC2 line items:',
    lines.length,
    '| with budgetLineItemId:',
    lines.filter((l) => l.budgetLineItemId).length
  );

  // DC3 — gates Phase 4A (bank book / reconciliation)
  console.log('DC3 reconciled:', live.filter((t) => t.reconciledDate).length, 'of', live.length);

  // DC4 — gates Phase 3A priority
  console.log('DC4 fixed assets:', (await db.collection('fixedAssets').get()).size);

  // DC5 — sizing: does any report need pagination/chunking?
  console.log(
    'DC5 total live txns:',
    live.length,
    '| entities:',
    (await db.collection('entities').get()).size
  );
})();
```

| Check | Gates    | Decision rule                                                                          |
| ----- | -------- | -------------------------------------------------------------------------------------- |
| DC1   | Phase 2A | < 5 non-INR transactions → drop 2A to backlog; the report would render an empty table  |
| DC2   | Phase 4C | `budgetLineItemId` fill rate < ~50% → **drop 4C**; the fix is data entry, not a report |
| DC3   | Phase 4A | 0 reconciled → build the bank book without the reconciliation section                  |
| DC4   | Phase 3A | 0 assets → defer 3A behind Phase 4                                                     |
| DC5   | all      | > ~5k live transactions → report generators need chunked reads, not one `getDocs`      |

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
- **1.5** Bespoke documents for **balance-sheet** and **profit-loss** only —
  statement layout (indented account hierarchy, subtotal rules, comparative
  columns) reads badly as a flat table. Everything else uses the generic document.

**Constraints**

- Currency renders as `INR 1,234.00`. **Never the ₹ glyph** — no custom font is
  registered, and referencing an unregistered family previously made every report
  PDF throw at render time (documented in `reportComponents.tsx`).
- Reuse `formatCurrency`/`formatDate` from `lib/utils/formatters` (rule 34); do
  not add a local formatter.
- `@react-pdf/renderer` must stay behind the dynamic import in `generatePDFBlob`
  so it never enters the static bundle.

**Acceptance:** every report under `/accounting/reports` offers CSV, Excel, and
PDF; the three exports of the same report contain the same numbers; no dead
export controls remain.

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

### 2C — Receivables Performance (DSO)

`receivablesPerformance.ts` + `/accounting/reports/receivables-performance`. DSO,
average days-to-collect, on-time payment %, worst payers, and an aging **trend**
across months. `PaymentAllocation.invoiceDate`/`dueDate` were denormalised for
exactly this (per the type's own comment), so no parent re-fetch is needed.

Today's aging is a static snapshot with no velocity — this is the "insight" the
existing reports most visibly lack.

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
