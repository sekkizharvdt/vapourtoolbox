---
description: Verify a Firestore query, collection, or data-access diff against the silent-failure rules — composite indexes, security rules, soft-delete filtering, Timestamp conversion, entityId vs tenantId.
argument-hint: [collection name, file path, or "diff" for current changes]
---

# Firestore Check

Firestore mistakes in this repo fail silently in production (missing index → empty results; missing rule → permission denied; unconverted Timestamp → runtime crash on old docs). Debugging them later costs far more than checking now. Run this after writing any new query, collection, or Cloud Function trigger.

## Arguments

- `$ARGUMENTS` — a collection name, a file path, or `diff` to check the current uncommitted changes. Default: `diff`.

## Steps

1. Identify the queries in scope. For `diff`: `git diff HEAD --unified=0 -- '*.ts' '*.tsx' | grep -nE "collection\(|query\(|where\(|orderBy\("`. For a file/collection, grep that target.

2. For each query, check the five silent-failure classes:

   **a. Composite index (rule 2).** Every `where()` + `orderBy()` combo (and multi-`where` with range filters) needs an entry in `firestore.indexes.json`:

   ```bash
   grep -A 12 '"collectionGroup": "<collection>"' firestore.indexes.json | grep -E "fieldPath" | sort -u
   ```

   Compare against the query's fields. Missing → add the index entry (it ships on the next Deploy dispatch — do NOT suggest local `firebase deploy`).

   **b. Security rules (rule 4).** New collections need a `match` block in `firestore.rules`:

   ```bash
   grep -n "match /<collection>" firestore.rules
   ```

   Missing → add one following the permission model: read = `hasPermission(VIEW_*)`, create/update = `hasPermission(MANAGE_*)`, delete = `hasPermission(MANAGE_*)` or `isSuperAdmin()`.

   **c. Soft-delete filtering (rule 3).** Queries and Cloud Function triggers over soft-deletable collections must filter `isDeleted` CLIENT-SIDE (`.filter(d => !d.isDeleted)`) — `where('isDeleted', '!=', true)` wrongly excludes docs missing the field. Only Trash pages show deleted items.

   **d. Timestamp conversion (rule 14).** Any date field read from a doc and passed to `.toLocaleDateString()`, `.toISOString()`, `.getTime()`, or a date input must go through the `'toDate' in raw` check first. `instanceof Date` alone is insufficient.

   **e. `entityId` vs `tenantId` (rule 1).** `transaction.entityId` is the COUNTERPARTY (vendor/customer), never tenant scoping. Tenant scoping is `tenantId` (`claims?.tenantId || 'default-entity'`). Transaction queries do NOT filter by tenant. If unsure, `node scripts/check-tenant-id-safety.js` validates the tree.

3. Also confirm: collection names come from `COLLECTIONS` in `packages/firebase/src/collections.ts` (never string literals), and no `undefined` values are written (rule 12 — conditional spreads).

4. Report a compact verdict per query: `<file>:<line> — index ✓ / rules ✓ / soft-delete ✓ / timestamp ✓ / tenant ✓`, listing only the failures with their fix. Apply the fixes if any.
