# EntityId Fix — Root Cause, Impact, and Change Plan

**Date:** 2026-03-09
**Status:** In progress (changes uncommitted on `main`)

---

## Root Cause

The application has a **naming collision** on the field `entityId`. Two unrelated concepts share the same field name:

| Concept                    | Where it lives          | What it means                                                                                  |
| -------------------------- | ----------------------- | ---------------------------------------------------------------------------------------------- |
| **Counterparty reference** | `transactions.entityId` | Which vendor/customer this transaction is with (references a doc in the `entities` collection) |
| **Tenant marker**          | `accounts.entityId`     | Which business owns this account — currently always `'default-entity'` (single-tenant system)  |
| **User claim**             | `claims.entityId`       | Copied from the user doc by a Cloud Function; defaults to `'default-entity'` if unset          |

### What went wrong

Two previous commits (on March 6 and March 8) misidentified `entityId` as a **tenant/multi-tenancy field** and added `where('entityId', '==', claims.entityId)` filters to **16+ transaction queries** across pages and services:

| Commit     | Date  | What it did                                                                                                |
| ---------- | ----- | ---------------------------------------------------------------------------------------------------------- |
| `53506d84` | Mar 6 | "add entityId multi-tenancy filtering" — added entityId filtering to 13+ service queries                   |
| `33693ea7` | Mar 8 | "comprehensive audit — entityId filtering" — added entityId filtering to 16 more queries (pages + reports) |

### Why this breaks everything

1. **Transactions have `entityId` = vendor/customer ID** (e.g., `"ABC_Pumps_Ltd"`, `"Acme_Corp"`)
2. **Users have `claims.entityId` = `'default-entity'`** (the tenant marker)
3. Filtering transactions with `where('entityId', '==', 'default-entity')` **returns zero results** because no transaction has `entityId = 'default-entity'`
4. **All accounting pages show empty** — bills, invoices, payments, journal entries, transactions, reports, data health, fixed assets, trash

This is why the application is completely broken today.

### The correct model

```
accounts collection       →  entityId = 'default-entity' (tenant marker, CORRECT to filter by claims.entityId)
transactions collection   →  entityId = vendor/customer ID (counterparty, WRONG to filter by claims.entityId)
entities collection       →  stores vendors & customers (not tenants)
```

Multi-tenancy is **not yet implemented**. When it is, a dedicated `tenantId` field will be added. Until then, transaction queries should NOT filter by tenant.

---

## What the current uncommitted changes do

The uncommitted diff (24 files, net -48 lines) **reverses the incorrect filtering** from the two commits above.

### Category 1: Page-level queries (9 files)

These pages had `where('entityId', '==', claims.entityId)` added incorrectly. The fix removes that filter and the null-guard (`if (!claims?.entityId) return null`) that prevented the query from even running.

| File                                                             | Query target                        |
| ---------------------------------------------------------------- | ----------------------------------- |
| `apps/web/src/app/accounting/bills/page.tsx`                     | VENDOR_BILL transactions            |
| `apps/web/src/app/accounting/invoices/page.tsx`                  | CUSTOMER_INVOICE transactions       |
| `apps/web/src/app/accounting/payments/page.tsx`                  | payment-type transactions           |
| `apps/web/src/app/accounting/transactions/page.tsx`              | all transactions                    |
| `apps/web/src/app/accounting/journal-entries/page.tsx`           | JOURNAL_ENTRY transactions          |
| `apps/web/src/app/accounting/trash/page.tsx`                     | soft-deleted transactions           |
| `apps/web/src/app/accounting/fixed-assets/page.tsx`              | fixed assets                        |
| `apps/web/src/app/accounting/data-health/page.tsx`               | transaction stats                   |
| `apps/web/src/app/accounting/reports/project-financial/page.tsx` | project transactions + cost centres |

### Category 2: Service functions (12 files)

These service functions had `where('entityId', '==', entityId)` in their Firestore queries. The fix:

- Removes the `where('entityId', ...)` clause from the query
- Renames the parameter to `_entityId` to keep the function signature stable (avoids breaking callers)

| File                                                         | Function(s)                                                                          |
| ------------------------------------------------------------ | ------------------------------------------------------------------------------------ |
| `apps/web/src/lib/accounting/bankReconciliation/crud.ts`     | `getUnmatchedAccountingTransactions`                                                 |
| `apps/web/src/lib/accounting/costCentreService.ts`           | `getProjectCostCentre`                                                               |
| `apps/web/src/lib/accounting/fixedAssetService.ts`           | `listFixedAssets`                                                                    |
| `apps/web/src/lib/accounting/interprojectLoanService.ts`     | `getInterprojectLoans`                                                               |
| `apps/web/src/lib/accounting/paymentBatchService.ts`         | `listPaymentBatches`, `getOutstandingBillsForProject`, `getPaymentBatchStats`        |
| `apps/web/src/lib/accounting/paymentHelpers.ts`              | `reconcilePaymentStatuses`                                                           |
| `apps/web/src/lib/accounting/recurringTransactionService.ts` | `getRecurringTransactions`, `getUpcomingOccurrences`, `getOccurrencesForTransaction` |
| `apps/web/src/lib/accounting/reports/cashFlow.ts`            | `generateCashFlowStatement` (transaction query only; accounts query kept)            |
| `apps/web/src/lib/accounting/reports/glDrilldown.ts`         | `fetchAccountGLEntries`                                                              |
| `apps/web/src/lib/accounting/reports/profitLoss.ts`          | `generateProfitLossReport` (transaction query only; accounts query kept)             |
| `apps/web/src/lib/accounting/reports/receiptsPayments.ts`    | `generateReceiptsPaymentsReport` (transaction queries only; accounts query kept)     |
| `apps/web/src/lib/accounting/tdsReportGenerator.ts`          | `extractTDSTransactions`                                                             |

### Category 3: moduleStatsService bug fix (1 file)

`apps/web/src/lib/dashboard/moduleStatsService.ts` had **two additional bugs** beyond the entityId issue:

- Was querying non-existent collections (`customerInvoices`, `vendorBills`) instead of `COLLECTIONS.TRANSACTIONS` with type filters
- Was querying a non-existent `bankReconciliation` collection
- Fixed to use `COLLECTIONS.TRANSACTIONS` with `where('type', '==', ...)` filters

---

## What is NOT changed (correctly uses entityId)

These existing patterns are **correct** and remain untouched:

| Pattern                                                                          | Why it's correct                                                   |
| -------------------------------------------------------------------------------- | ------------------------------------------------------------------ |
| `accounts` collection queries with `where('entityId', '==', entityId)`           | Accounts use `entityId: 'default-entity'` as tenant marker         |
| Entity ledger page filtering transactions by selected vendor/customer `entityId` | Counterparty filter (user picks a vendor, sees their transactions) |
| Payment dialogs filtering bills by vendor `entityId`                             | Finding outstanding bills for a specific vendor                    |
| `paymentHelpers.getOutstandingAmount` filtering by `entityId`                    | Finding payments for a specific counterparty                       |
| `businessEntityService.checkEntityCascadeDelete` filtering by `entityId`         | Checking if a vendor/customer has transactions before deletion     |

---

## Remaining work to complete

### Already done (uncommitted)

- [x] Remove incorrect entityId filters from 9 page-level queries
- [x] Remove incorrect entityId filters from 12 service functions
- [x] Fix moduleStatsService collection names
- [x] Update CLAUDE.md with entityId documentation

### Still needs investigation

1. **Callers still passing `claims?.entityId` to `_entityId` params** — ~20 call sites still pass `claims?.entityId` or `entityId` derived from claims to these functions. The parameter is ignored now (prefixed with `_`), but this is tech debt. These should eventually be cleaned up (remove the parameter entirely and update all callers).

   Key callers to update:
   - `balance-sheet/page.tsx:250` → `fetchAccountGLEntries(db, accountId, claims?.entityId)`
   - `trial-balance/page.tsx:131` → `fetchAccountGLEntries(db, accountId, claims?.entityId)`
   - `gst-summary/page.tsx:105-106` → `fetchAccountGLEntries` calls
   - `interproject-loans/page.tsx:127` → `getInterprojectLoans(db, claims?.entityId)`
   - `payment-batches/page.tsx:79-85` → `listPaymentBatches` and `getPaymentBatchStats`
   - `data-health/page.tsx:90` and `stale-payments/page.tsx:317` → `reconcilePaymentStatuses`
   - `recurring/page.tsx` (3 calls) → `getRecurringTransactions`
   - `recurring/upcoming/page.tsx:78` → `getUpcomingOccurrences`
   - `recurring/[id]/RecurringDetailClient.tsx` (2 calls) → `getOccurrencesForTransaction`
   - Bank reconciliation callers (4+ files)

2. **Firestore composite indexes** — Some indexes in `firestore.indexes.json` that include `entityId` for transaction queries may no longer be needed. However, the correct counterparty-based indexes (entity ledger, payment allocation) must be kept. Audit needed.

3. **Cloud Function `onTransactionWrite`** — Verify it does not filter by entityId incorrectly when recalculating account balances.

4. **Transaction number generation** — Commit `33693ea7` scoped transaction numbers by entityId. This scoping should be removed since it was based on the same misunderstanding.

5. **Pages not in the diff but still passing entityId to service calls** — These pages were modified by commit `33693ea7` to pass `claims?.entityId` to service functions. The service functions now ignore the param (`_entityId`), so they work correctly, but the callers have unnecessary entityId plumbing:
   - `payment-planning/page.tsx` — passes entityId to `getCashFlowSummary`, `generateCashFlowForecast`
   - `recurring/page.tsx` — passes entityId to `getRecurringTransactions`, `getRecurringTransactionSummary`
   - `recurring/upcoming/page.tsx` — passes entityId to `getUpcomingOccurrences`
   - `recurring/[id]/RecurringDetailClient.tsx` — passes entityId to `getOccurrencesForTransaction`
   - `chart-of-accounts/page.tsx` — correctly filters accounts by entityId (NO change needed)
   - `tax-compliance/page.tsx` — passes entityId to report generators

---

## Firestore index implications

Queries that previously had `where('entityId', '==', ...) + where('type', '==', ...) + orderBy(...)` now have one fewer `where` clause. This means:

- Some composite indexes with `entityId` first may become unnecessary for these queries
- Simpler indexes (e.g., `type + date`) should already exist
- **Do not remove indexes that support correct counterparty queries** (entity ledger, payment allocation)

---

## How to verify the fix

1. **Bills page** — Should show all vendor bills, not empty
2. **Invoices page** — Should show all customer invoices
3. **Payments page** — Should show all payments
4. **Transactions page** — Should show all transactions
5. **Journal entries** — Should show all journal entries
6. **Data health** — Should show accurate counts
7. **Reports** (P&L, Cash Flow, Balance Sheet, Receipts & Payments) — Should include all transactions
8. **Entity ledger** — Should still correctly filter by selected vendor/customer (this was never broken)
9. **Payment allocation** — Should still show correct outstanding amounts per vendor/customer
