# Accounting — What You Have and Aren't Using Yet

Date: 2026-04-24
Audience: primary accounting user

## Today's reality

You use the accounting module for one thing: posting transactions.

| Collection                                           | Docs | 30d | Last write | Notes                                   |
| ---------------------------------------------------- | ---- | --- | ---------- | --------------------------------------- |
| transactions                                         | 661  | 41  | Apr 11     | core workflow                           |
| accounts                                             | 102  | 0   | Feb 11     | COA set up                              |
| deletedTransactions                                  | 239  | 5   | Feb 26     | trash / soft-delete                     |
| paymentBatches                                       | 9    | 2   | Feb 28     | vendor payment runs                     |
| costCentres                                          | 11   | 0   | Feb 11     | 1 write in last 90d                     |
| recurringTransactions                                | 5    | 0   | Jan 22     | template only — never fires (see below) |
| exchangeRates                                        | 10   | 0   | Dec 17     | stale                                   |
| fiscalYears                                          | 0    | —   | —          | no FY created yet                       |
| accountingPeriods                                    | 0    | —   | —          | follows from FY                         |
| fixedAssets                                          | 0    | —   | —          | unused                                  |
| interprojectLoans                                    | 0    | —   | —          | unused                                  |
| bankStatements / bankTransactions / reconciliation\* | 0    | —   | —          | unused                                  |
| yearEndClosingEntries                                | 0    | —   | —          | unused                                  |
| manualCashFlowItems                                  | 0    | —   | —          | unused                                  |
| forexGainLoss / currencyConfig                       | 0    | —   | —          | unused                                  |

There is a large surface you haven't touched. Below is a tour of each, ranked by value-for-effort — and a flag where a feature isn't quite ready for you yet.

---

## Ready to use today

### 1. Fiscal years and period locks — start here

Route: [/accounting/fiscal-years](apps/web/src/app/accounting/fiscal-years)

What it does — create a fiscal year, auto-generates 12 monthly periods. Close a period after reconciliation; lock it irreversibly after the year-end. Prevents backdated entries.

Value — today nothing stops you (or a future team member) from posting a transaction into an already-closed month. Period locks fix that.

First-time setup:

1. Create FY 2025-26 (Apr 2025 – Mar 2026) from the list page.
2. Mark the months you've already reconciled as `CLOSED`.
3. After filing returns, flip them to `LOCKED`.

This is fully working — no backend gap.

### 2. Cost centres — you have 11, tag your transactions

Route: [/accounting/cost-centres](apps/web/src/app/accounting/cost-centres)

What it does — tag every transaction with a project/department so you can see per-project P&L, budget vs actual, and variance.

Current state — 11 cost centres exist but only 1 was touched in the last 90 days. That means most transactions aren't tagged. If you tag them, the list page's budget/spent/variance columns become meaningful.

Action — on the next month's transactions, select a cost centre in the form. After 30 days you'll get per-project reporting for free.

### 3. Fixed assets and depreciation

Route: [/accounting/fixed-assets](apps/web/src/app/accounting/fixed-assets), depreciation runner at `/accounting/fixed-assets/depreciation`

What it does — asset register with cost, category, location, WDV. Run depreciation → posts journal entries into `transactions`. Dispose/write-off flow with gain/loss calc.

Value — you currently have no structured asset register. Monthly depreciation JEs are either manual or missing. This automates both.

Setup gotcha — needs GL accounts mapped per category (e.g. "Fixed Assets – Plant & Machinery" → 1501). If your COA already has these, you can start adding assets today.

State — fully working. One missing nicety: no pre-post review screen before depreciation posts. Do a small test batch first.

### 4. Interproject loans

Route: [/accounting/interproject-loans](apps/web/src/app/accounting/interproject-loans)

What it does — record a loan from one cost centre/project to another (principal, rate, schedule, bullet vs instalment). Tracks outstanding balance per loan.

Why you might care — if any of your projects is funding another's working capital, this captures it cleanly instead of burying it in a vague journal entry.

State — fully working. Caveat: the auto-GL entry on loan creation isn't visible in the UI, so verify the offsetting transaction actually posts on your first loan.

### 5. Bank reconciliation

Route: [/accounting/reconciliation](apps/web/src/app/accounting/reconciliation)

What it does — upload bank statement (CSV), system matches to your posted transactions by amount/date/narration, you confirm, and it flags unmatched items.

Setup gotchas:

- Map your physical bank accounts to their GL accounts in COA first.
- CSV import format isn't documented — first import will need a dry run with a small file.
- Report-generation button is wired but the handler is incomplete — treat this as "match and mark reconciled" for now, not "generate a signed recon report."

State — usable for monthly matching. Don't rely on the report export until that's fixed.

### 6. Payment planning / cash flow (partial)

Route: [/accounting/payment-planning](apps/web/src/app/accounting/payment-planning)

What it does — pulls due invoices + bills + recurring items into a 30-day cash forecast. Lets you add manual projected items (e.g. "client advance expected May 5").

State — **summary cards and chart work; the manual-items table is half-wired (view + create only, no edit/delete — there is an open TODO in the code).** Use it to look at forecast; don't rely on manual items as a log-of-record yet.

---

## Not ready — don't adopt yet

### Recurring transactions — the scheduler doesn't exist

Route: [/accounting/recurring](apps/web/src/app/accounting/recurring)

You created 5 recurring templates. Zero occurrences ever generated (`recurringOccurrences` is empty). The frontend for create/pause/resume works, but **there is no Cloud Function to generate occurrences on schedule**. The templates just sit there.

→ Don't create new recurring transactions until the scheduler is built. Engineering action: add a scheduled Cloud Function that reads `recurringTransactions.nextRunDate`, writes `recurringOccurrences`, and (if `autoGenerate`) posts a transaction.

### Multi-currency / forex — data model exists, UI doesn't

- No page to configure base currency or supported currencies
- `exchangeRates` has 10 stale docs from Dec 2025
- Forex gain/loss is calculated in code but never posts to GL
- No UI to refresh or manage rates

→ If you're mostly INR-only, ignore. If you're about to take a foreign-currency PO, raise this with engineering before committing.

### Year-end closing wizard

Period close/lock works per month. But the full year-end close — P&L accounts rolling to Retained Earnings and locking the whole year — has no UI wizard. The data fields exist on the fiscal year record, but there's no button.

→ At year-end (March 2026), you'll need a manual journal to close P&L to RE. Flag to engineering if you want a wizard before FY26-27 close.

---

## Suggested 30-day ramp

Week 1 — create FY 2025-26 and mark already-reconciled months as CLOSED. Set up a handful of fixed assets with correct GL mapping.

Week 2 — start tagging every new transaction with a cost centre. Stop using "default" unless the transaction is genuinely company-wide overhead.

Week 3 — import a bank statement and do one monthly reconciliation end-to-end.

Week 4 — review payment-planning dashboard against your actual cash position. File bug tickets for anything that's off.

After a month you'll have: sealed periods, asset register, cost-centred P&L, and reconciled cash — which the module was designed for but hasn't delivered yet.
