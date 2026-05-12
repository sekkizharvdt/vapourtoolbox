# Accounting — What You Have and Aren't Using Yet

Date: 2026-05-12 (refreshed after v1.6.0 — bank-reconciliation removed, audit trail standardised)
Audience: primary accounting user
Context: application is in **testing phase**, with **one active project** on hand

## What changed since the 2026-04-24 refresh

- **Bank reconciliation has been removed entirely** — page, services, types, Firestore collections, and the `RECONCILE_ACCOUNTS` permission flag. Production data was empty; modern bank-API flows + instant payment confirmation make manual monthly reconciliation obsolete. If a "bank-statement import + auto-match against payments" tool becomes useful later, it will be built fresh against current bank APIs rather than reviving the deprecated module.
- **Audit trail rule closed (CLAUDE.md rule 18)** — permission changes, employee updates, hard deletes, financial approvals (PO, payment, invoice, journal post), and status transitions all log to the `auditLogs` collection via `logAuditEvent()`. The admin Activity Feed at `/admin/activity` is the read-side surface.
- **Cross-module audit coverage expanded** — agent runs and HITL approvals now write to the same audit collection with `actorType: 'agent'`, `agentRunId`, and `agentToolName`. When an AI agent is eventually wired into accounting flows, every write is already traceable.
- **Three-Way Match shows full audit history** — invoice / bill / GR approvals carry a denormalized actor + timestamp trail visible on the match detail page.
- **Procurement → accounting reliability** — amendments use conditional spreads for optional history fields (no more "undefined Firestore field" crashes), and the GR-to-bill handoff respects state-machine transitions strictly.

## Today's reality

You use the accounting module for one thing: posting transactions.

| Collection                                                    | Notes                                      |
| ------------------------------------------------------------- | ------------------------------------------ |
| transactions                                                  | core workflow                              |
| accounts                                                      | COA set up                                 |
| deletedTransactions                                           | trash / soft-delete                        |
| paymentBatches                                                | vendor payment runs                        |
| costCentres                                                   | **still under-tagged** — see priority §1   |
| recurringTransactions                                         | template only — scheduler still not built  |
| exchangeRates                                                 | stale; no UI to update                     |
| fiscalYears / accountingPeriods                               | derived from transactions — no docs needed |
| fixedAssets                                                   | unused                                     |
| interprojectLoans                                             | only relevant once ≥2 projects             |
| forexGainLoss / currencyConfig                                | INR-only; safe to ignore for now           |
| yearEndClosingEntries                                         | year-end wizard not built                  |
| manualCashFlowItems                                           | table half-wired                           |
| ~~bankStatements / bankTransactions / reconciliationMatches~~ | **removed in v1.6.0**                      |

---

## What to do next — one project, testing phase

The priorities have barely changed since 2026-04-24 because the test-phase data hasn't grown much. The bank-reconciliation step is gone; everything else stands.

### 1. Tag every transaction to the one project (highest priority)

Route: [/accounting/cost-centres](apps/web/src/app/accounting/cost-centres) to confirm the project's cost centre exists.

For a one-project firm, **every** non-overhead transaction should be tagged to that project. Without tags, none of the project-P&L, budget-vs-actual, or variance columns on the cost-centre detail page mean anything.

**Action** — on the next 10 transactions you post, select the project cost centre in the form. Then use the new period report (§2) to verify it flowed through.

**Expected outcome after 30 days of tagging:** project-P&L is populated, variance is visible, and the period report's "project performance" section actually has data.

### 2. Use the on-demand period report monthly

Route: [/accounting/reports/period-report](apps/web/src/app/accounting/reports/period-report)

This is the 11-section management report (P&L, balance sheet, cash flow, AR/AP aging, working capital, GST, project performance, data quality, trial balance). Pick a quarter, export a PDF, and save it — that is your monthly close evidence until evidence-gated close is built.

### 3. Opening balances check

Route: [/accounting/chart-of-accounts](apps/web/src/app/accounting/chart-of-accounts)

Before you trust month-over-month anything, confirm each account's `openingBalance` is correct for FY 2025-26. One bad opening balance poisons every downstream report.

### 4. Data Health page — run it before every review

Route: [/accounting/data-health](apps/web/src/app/accounting/data-health)

This page surfaces: draft transactions, GL imbalances, duplicate numbers, unapplied payments, orphaned entities, incomplete transactions, overdue items. Use it as a pre-flight check before exporting the period report or showing anyone the numbers.

### 5. Audit Activity feed — admin read-side

Route: [/admin/activity](apps/web/src/app/admin/activity)

50+ call sites now write to `auditLogs`. The activity feed groups recent entries by day with module / actor / search filters and a top-row summary strip. Use it to investigate "who changed what, when" without a Firestore console session.

---

## Ready, but lower priority for your current scale

### Fixed assets

Route: [/accounting/fixed-assets](apps/web/src/app/accounting/fixed-assets)

Monthly depreciation will post journal entries for you. Small effort, good structure — but optional while testing.

### Interproject loans

Route: [/accounting/interproject-loans](apps/web/src/app/accounting/interproject-loans)

**Skip until you have ≥2 active projects.** Single-project firms don't need to record inter-project financing.

---

## Not ready — do not adopt yet

### Recurring transactions — scheduler still doesn't exist

You have a handful of templates. Zero occurrences have ever been generated. The Cloud Function that should read `recurringTransactions.nextRunDate` and generate occurrences **has not been written**. Do not create new recurring transactions until it is.

### Multi-currency / forex

Data model exists, UI doesn't. `exchangeRates` is stale. If you're INR-only (likely), ignore. If you ever take a foreign-currency PO, flag to engineering first. (Note: the proposals module now handles multi-currency on the quote side, but it doesn't write to `exchangeRates`.)

### Year-end closing wizard

Period close works, but the full year-end close (P&L → Retained Earnings, lock the whole year) has no UI. At March 2027, you'll need a manual journal unless engineering builds the wizard.

### Period close with evidence (future)

Close-month governance was explicitly deferred. When we bring it back it should require: no drafts, no unapplied payments, filed GSTR acknowledgement attached. Not built yet.

---

## Suggested sequence for the testing phase

**Week 1** — Cost-centre tagging habit: pick the project on every new transaction. Confirm all accounts have correct opening balances.

**Week 2** — Generate the period report for the current quarter. Review the data-quality section. File any anomalies via the Feedback module (`/feedback`) so they land in the same triage queue as everything else.

**Week 3** — Spot-check the audit activity feed for any unexpected actor — should be just you and the system. Note any agent entries (there shouldn't be any yet; this is forward compatibility for when AI is wired into accounting).

**Week 4** — Register any genuinely owned fixed assets. Review the period report again; confirm project-P&L has filled out.

**After the testing phase graduates** — come back to: evidence-gated period close, recurring transaction scheduler, year-end wizard, forex support.

---

## What this guide does not cover

- **Procurement integration** — see [PROCUREMENT-BLOCKERS-2026-04-24.md](PROCUREMENT-BLOCKERS-2026-04-24.md). GR→Bill flow is the main accounting-adjacent issue.
- **Proposal → project → PR auto-create** — see [PROPOSALS-ROADMAP-2026-04-24.md](PROPOSALS-ROADMAP-2026-04-24.md).
- **AI agent → accounting** — currently nothing is wired. The Phase 0 infrastructure (identity, tool framework, audit logging) is in place; thermal calculators are next on the roadmap, accounting tools come after.

These touch accounting (bills, project budgets, future agent actions) but are owned by their respective modules.
