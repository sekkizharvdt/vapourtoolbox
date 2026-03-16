# EntityId Fix — Root Cause, Impact, and Changes

**Date:** 2026-03-09
**Status:** Complete (3 commits on `main`)

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

### Why this broke everything

1. **Transactions have `entityId` = vendor/customer ID** (e.g., `"ABC_Pumps_Ltd"`, `"Acme_Corp"`)
2. **Users have `claims.entityId` = `'default-entity'`** (the tenant marker)
3. Filtering transactions with `where('entityId', '==', 'default-entity')` **returns zero results** because no transaction has `entityId = 'default-entity'`
4. **All accounting pages showed empty** — bills, invoices, payments, journal entries, transactions, reports, data health, fixed assets, trash

### The correct model

```
accounts collection       →  entityId = 'default-entity' (tenant marker, CORRECT to filter by claims.entityId)
transactions collection   →  entityId = vendor/customer ID (counterparty, WRONG to filter by claims.entityId)
entities collection       →  stores vendors & customers (not tenants)
```

Multi-tenancy is **not yet implemented**. When it is, a dedicated `tenantId` field will be added. Until then, transaction queries should NOT filter by tenant.

---

## Fix commits

### Commit 1: `09d972c3` — Remove incorrect query filters

Removed `where('entityId', '==', claims.entityId)` from 9 page-level queries and 12 service functions. Also fixed `moduleStatsService` which was querying non-existent collections.

### Commit 2: `97c91d65` — Remove unused entityId params from service functions

Cleaned up the full call chain:

- Removed `_entityId` parameters from ~20 service functions
- Updated all callers (~30 files) to stop passing entityId
- Fixed `transactionNumberGenerator` to use global counters instead of per-entity counters
- Rewrote `scripts/check-entityid-queries.sh` to detect the correct anti-pattern
- Updated 4 test files (autoMatching, crud, costCentre, paymentPlanning)

### Commit 3: `7cd87aba` — Remove stale entityId guard from payment batches

Removed an unnecessary `if (!entityId) return` guard that was blocking data loading.

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
| Balance sheet / trial balance / P&L querying accounts by `entityId`              | Accounts use the tenant marker pattern                             |

---

## Remaining considerations

1. **Firestore composite indexes** — Some indexes in `firestore.indexes.json` that include `entityId` for transaction queries may no longer be needed. However, the correct counterparty-based indexes (entity ledger, payment allocation) must be kept. Audit needed.

2. **Cloud Function `onTransactionWrite`** — Verify it does not filter by entityId incorrectly when recalculating account balances.

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
