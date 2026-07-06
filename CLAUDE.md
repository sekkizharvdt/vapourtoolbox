# Vapour Toolbox — Coding Standards

These rules are derived from a 190-finding codebase audit. They apply to all new code and modifications.

**On-demand skills carry the full patterns** — invoke them instead of working from memory:

- `/orient` — module map (where everything lives; read before exploring)
- `/check-duplicates` — run BEFORE building any new collection/route/service/component (rule 32)
- `/new-dialog` — form/dialog scaffolding with rules 14/14b/14c/15/22 baked in
- `/firestore-check` — verify queries against rules 1–4, 12, 14
- `/precommit-fix` — run hook checks individually before committing

## Firestore Queries

1. **`entityId` on transactions is the COUNTERPARTY (vendor/customer), NOT a tenant ID.** Tenant scoping uses `tenantId` everywhere — claims (`claims?.tenantId || 'default-entity'`), document fields, queries, types. Transaction queries do NOT filter by tenant (single-tenant system). The `entities` collection stores counterparties, not tenants. Global collections: `users`/`taskNotifications` (scoped by `userId`), `entities`, `materials`, `shapes`, `bought_out_items` (shared reference data). Never use `entityId` for tenant scoping.

2. **Every `where()` + `orderBy()` combo MUST have a composite index** in `firestore.indexes.json`. Queries will silently fail in production without them.

3. **Soft-deleted data MUST be filtered** — client-side (`.filter(d => !d.isDeleted)`), not `where('isDeleted', '!=', true)` which excludes docs missing the field. Only the Trash page shows deleted items. Applies to Cloud Functions too — triggers like `onTransactionWrite` must skip soft-deleted docs before recalculating aggregates.

4. **New collections MUST have Firestore security rules** in `firestore.rules`: `read` requires `hasPermission(<VIEW_*>)`, `create`/`update` requires `hasPermission(<MANAGE_*>)`, `delete` requires `hasPermission(<MANAGE_*>)` or `isSuperAdmin()`.

## Permissions & Authorization

5. **Every service function that writes data MUST check permissions** — `requirePermission(userPermissions, PERMISSION_FLAGS.MANAGE_X, userId, 'action description')` from `@/lib/auth/authorizationService`. Client-side checks alone can be bypassed.

6. **Every approval workflow MUST prevent self-approval** — `preventSelfApproval(userId, submitterId, 'action description')`.

7. **Permission flags live in `@vapour/constants`** — never create local copies or hardcode numeric values. Import `PERMISSION_FLAGS` and `hasPermission()`.

## Status & Workflow

8. **Every status change MUST use a state machine** — define transitions in `apps/web/src/lib/workflow/stateMachines.ts`, validate with `requireValidTransition(machine, currentStatus, targetStatus, 'EntityName')` from `@/lib/utils/stateMachine`. Never ad-hoc `if (status !== 'DRAFT')` checks for workflow transitions.

9. **Mutations that can be called multiple times MUST be idempotent** — check current state before writing. Network retries and double-clicks are common.

10. **UI controls MUST respect terminal states** — disable action buttons for completed/cancelled items. Don't let users attempt transitions the backend will reject.

## Data Integrity

11. **Optional fields MUST be null-checked** before calling methods — `po.commercialTerms?.deliveryUnit?.toLowerCase()`, never bare member chains that crash on old documents.

12. **Firestore rejects `undefined` values** — use conditional spreads for optional fields: `...(description !== undefined && { description })`.

13. **Avoid denormalizing names** unless you have a sync strategy. A stored `vendorName` goes stale on rename. Prefer render-time lookup, or document the Cloud Function trigger that keeps it in sync.

14. **Firestore Timestamps must be converted before use** — Firestore returns `Timestamp` at runtime even when TS types say `Date`. Check `'toDate' in raw` FIRST, then `instanceof Date`, then `new Date(raw)`; `instanceof Date` alone is insufficient. Never call `.toLocaleDateString()`, `.toISOString()`, `.getTime()` without converting. Applies to edit forms, display, comparisons, JSON export. Full snippet: `/new-dialog`.

## Forms & Edit Mode

14b. **Dialog/form state MUST sync via `useEffect` when props change** — `useState(prop.value)` only captures the first render; a dialog reopened for a different item shows stale data. Re-sync every field in `useEffect(..., [open, item])`. Full pattern: `/new-dialog`.

14c. **Form validation MUST null-coalesce before string methods** — `(field ?? '').trim()`, never `field.trim()` on optional Firestore data.

15. **Selector callbacks only fire on user interaction** — `onEntitySelect`, `onAccountSelect`, etc. do NOT fire when `value` is pre-populated in edit mode. Restore dependent state (names, balances) directly from the saved document in the edit reset effect; fetch derived data with `getDoc()` in the effect. Full pattern: `/new-dialog`.

## Code Organization

16. **One implementation per function** — never create duplicate service functions (e.g., two `submitForApproval` in different files). Use the module's `index.ts` to re-export from the canonical location.

17. **State machines go in `stateMachines.ts`**, not inline in service files. Status types come from `@vapour/types`.

18. **Sensitive operations need audit trails** — permission changes, employee updates, hard deletes, financial approvals (PO / payment / invoice / journal post), and workflow status transitions MUST log to `auditLogs` via `logAuditEvent()` from `@/lib/audit`. Read surface is `/admin/activity`. Agent runs and HITL approvals carry `actorType: 'agent'`, `agentRunId`, and `agentToolName`.

## Concurrency & Transactions

19. **Read-modify-write MUST use a Firestore transaction** — never read a doc, modify in memory, and write back with `updateDoc`; concurrent triggers overwrite each other. Use `FieldValue.increment()` for counters and `db.runTransaction()` for array/object mutations:

    ```typescript
    await db.runTransaction(async (tx) => {
      const snap = await tx.get(projectRef);
      const items = snap.data()!.procurementItems;
      items[idx].status = 'COMPLETED';
      tx.update(projectRef, { procurementItems: items });
    });
    ```

20. **Firestore batch writes are limited to 500 operations** — chunk larger operations: `for (let i = 0; i < updates.length; i += 500) { ... batch per slice ... }`.

## Financial Math

21. **Monetary calculations MUST be precise:**
    - Derive outstanding amounts: `outstanding = roundToPaisa(total - (paid ?? 0))` — never trust a cached `outstandingAmount`, and never fallback chains like `a ?? b ?? 0` that mask missing data or double amounts.
    - Round to paisa (2 decimals) at every step: `Math.round(n * 100) / 100`.
    - Multi-currency: always aggregate `baseAmount` (INR), not `totalAmount` (foreign currency). Mixed-currency sums silently corrupt reports.
    - Zero-checks use a tolerance (`Math.abs(outstanding) < 0.01`) so floating-point residue doesn't mark paid items overdue.

## Forms & Data Completeness

22. **Every typed field MUST be written on create, every saved field MUST be restored on edit** — missing writes break downstream logic; missing restores lose user data. Test the round-trip: create → save → open edit → save again; all values survive unchanged. Diff the type definition against both the create payload and the edit reset effect. Full pattern: `/new-dialog`.

## Service-Layer Validation

23. **Service functions MUST validate constraints before writing** — inside the transaction, alongside the permission check. Key validations:
    - Goods receipt qty <= PO remaining qty
    - Payment allocation <= invoice outstanding amount
    - Amendment cannot modify a completed/cancelled PO
    - Budget spend cannot exceed approved budget without explicit override

    Throw a descriptive error naming both the attempted and allowed values.

## Transaction Type Safety

24. **All switches on `TransactionType` MUST handle all 9 types** — `CUSTOMER_INVOICE`, `CUSTOMER_PAYMENT`, `VENDOR_BILL`, `VENDOR_PAYMENT`, `JOURNAL_ENTRY`, `BANK_TRANSFER`, `EXPENSE_CLAIM`, `DIRECT_PAYMENT`, `DIRECT_RECEIPT`. Use `Record<TransactionType, T>` lookup maps from `@vapour/constants` for labels/routes/colors; for behavioral switches list every case explicitly with NO `default`, so the compiler catches additions.

25. **Cross-boundary field names MUST use shared constants** — fields written by Cloud Functions and read by the client (e.g., account balances) are defined in `packages/constants/src/fields.ts`. If renaming a Firestore field, update the constant and fix all compile errors.

## Parent → Child Reference Denormalization

26. **Every child document MUST denormalize its parent's identifying fields at creation.** Canonical chains:
    - **Procurement**: PR → RFQ → Offer → PO → GR → WCC / VendorBill → VendorPayment
    - **Accounting**: Invoice → Payment (allocation); Bill → Payment (allocation)
    - **Projects**: Project → BOM → PR (via items)

    Minimum fields per parent in the chain: document number (e.g. `RFQ/2026/001`), date, and key display fields (vendor name, project name, title). E.g. a PO created from an offer writes `offerId`, `selectedOfferNumber`, `vendorOfferNumber`, `vendorOfferDate`, `rfqId`, `rfqNumber`, `vendorId`, `vendorName`, `projectIds`, `projectNames` — dashboards and the PO PDF read these directly.

## Error Handling

27. **No silent catches** — every `catch` MUST either `logger.error(context, err)` with a meaningful context string and rethrow, OR `logger.warn(...)` and gracefully degrade with a documented reason. Empty catches are prohibited. Surface the real error message (`error instanceof Error ? error.message : String(error)`), never a generic "failed" string. If an error is expected and safely ignorable, say why in a one-line comment before the catch returns.

## Module Completeness

28. **A new module ships with List + New + View + Edit, or not at all** — no "dashboard first, the rest later". Checklist for every new entity in procurement / accounting / HR:
    - List page with filters, pagination, and search
    - New page with Create + Save-as-Draft where applicable
    - View / detail page with status and workflow actions
    - Edit page for fields editable in non-terminal states
    - Cloud Function triggers for status propagation (if applicable)
    - Firestore security rules matching the permission model
    - Composite indexes for every `where + orderBy` query (rule 2)

## User-Visible Labels

29. **Enum/domain-status labels MUST come from `@vapour/constants/labels.ts`, rendered via `StatusChip`** — not inline in components; single source of truth for the label text a status/enum value maps to. Applies to status chips, workflow-state labels, dropdown enum values, and other closed-set domain vocabularies (approval states, document types, transaction types). Does NOT apply to: page headers, button text, section titles, dialog titles, one-off descriptive copy, code comments, server-side validation error messages, or dev-only logs — those are free-text, not enum labels, and don't need a constants-file entry. New enum/status value → add the label constant first, then render it with `<StatusChip status={value} labels={THE_LABELS_MAP} context="..."/>` (see rule 34). The file is reviewed quarterly with the domain user.

## Routing & Static Export

30. **Detail pages under `app/**/[id]/...`MUST read the id from`usePathname()`, not `useParams()`** — `output: 'export'`pre-generates dynamic routes against a`'placeholder'`param, so`useParams()`returns the placeholder at runtime and every lookup silently 404s. Extract via regex on`pathname`, keep `docId`in state, guard every effect/handler with`if (!docId) return`, and ignore the `'placeholder'` value. Canonical: [`/estimation/[id]/BOMEditorClient.tsx`](apps/web/src/app/estimation/[id]/BOMEditorClient.tsx). The pre-commit audit flags `useParams()`under`app/\*_/[id_]/\*.tsx`.

30b. **Syncing component state to the URL query string MUST use `window.history.replaceState()`, NOT `router.replace()`/`router.push()`** — App Router navigation re-focuses the page root on every call, scrolling to the top on every keystroke; `{ scroll: false }` does NOT fix it. `history.replaceState` updates the address bar with no navigation, focus change, or re-render. `router.replace()`/`push()` remain correct for deliberate one-shot navigation (row click, post-create redirect, stripping a `?new=true` flag once). Canonical: [`FlashChamberClient.tsx`](<apps/web/src/app/thermal/(protected)/flash-chamber/FlashChamberClient.tsx>) and [`/dashboard/shapes/calculator/page.tsx`](apps/web/src/app/dashboard/shapes/calculator/page.tsx).

## Engineering Discipline (anti-over-engineering)

31. **Verify before writing migration or backwards-compatibility code** — schema-version fields, v1→v2 conversion branches, legacy-shape lift-on-load, and `(field ?? legacyField)` fallbacks are only justified when real records need them. Count the records first (service account at `mcp-servers/firebase-feedback/service-account-key.json`) or ask the user. If 0 or 1, edit the record instead. Default position: solo-developer app, small test dataset, assume no legacy data unless verified. (Past failure: ~110 LOC of dead v1→v2 pricing-schema code shipped for zero legacy records.)

32. **One canonical implementation per concept; don't build a parallel** — before creating a new collection, route, page, service, type, or utility, run `/check-duplicates`: grep for the concept under adjacent names (`*Quote*` vs `*Offer*`, `formatCurrency`, `submitForApproval`, …) and read the matches. If the concept exists, the work is "rename + extend the existing", not "add alongside". This repo has paid days of consolidation for parallel implementations (`offers` vs `vendorQuotes`, two quote UIs, 8 void-approval services, 4 number generators, `PermissionFlag` vs `PERMISSION_FLAGS`, 6+ inline formatters). Extends rule 16 to collections, routes, components, types, and services.

## Deployment

33. **Never run `firebase deploy` locally — deploys ship through CI.** The GitHub Actions **"Deploy - Production"** workflow ([.github/workflows/deploy.yml](.github/workflows/deploy.yml), manual `workflow_dispatch`) diffs against the last `prod-deployed` tag and auto-selects targets from changed paths (`firestore.indexes.json` → indexes, `functions/**` → functions, `apps/web/**`/`packages/**`/`firebase.json` → hosting, `*.rules` → rules). CI builds on every push but does NOT auto-deploy. After committing deployable changes, say "ships on the next Deploy dispatch" — never suggest a local deploy or treat deploy as a manual TODO unless the user explicitly asks to deploy outside CI.

## UI Component Kit

34. **New UI uses the shared component kit — don't hand-roll what already exists.** Before writing a page or dialog, check whether one of these already covers it:
    - **Page shell**: `PageHeader` (title + actions) and `PageBreadcrumbs` — every `page.tsx` under `app/**` starts with these, not a hand-rolled `<Typography variant="h4">`.
    - **Lists**: `DataTable` (from `@vapour/ui`) for new list pages — pagination, sorting, `renderActions`, and `loading`/`EmptyState` built in. Composes with `FilterBar` for search/filter bars and `TableActionCell` for row actions. (Existing list pages using raw `<Table>`/`<TablePagination>` are a known backlog — not migrated wholesale; see rule 32's "targeted, not parallel" spirit, but don't add a new one.)
    - **Loading / empty states**: `LoadingState` and `EmptyState` (`@vapour/ui`) instead of a bare `<CircularProgress>` or an ad-hoc "No data" `<Typography>`.
    - **Status/priority color and label**: `StatusChip` (`@vapour/ui`) + `getStatusColor`/`getPriorityColor` (`@vapour/constants`) — never a local `getStatusColor` switch (rule 29, rule 32).
    - **Notifications**: `useToast()` (`@/components/common/Toast`) for success/error/info messages — never a local `<Snackbar>` + `useState`.
    - **Confirmations**: `useConfirmDialog()` (`@/components/common/ConfirmDialog`) for destructive/approval confirmations — never a local `window.confirm()` or one-off dialog.
    - **Formatting**: `formatCurrency`/`formatCurrencyCode`/`formatCurrencyCompact`/`formatDate`/`formatMoney`/`formatPercentage`/`formatNumber`/`formatWeight` (`@/lib/utils/formatters`) — never a local reimplementation or raw `.toLocaleDateString()`/`.toLocaleString()`.
    - **Button convention**: exactly one `variant="contained"` primary action per view; secondary actions `outlined`; destructive actions `color="error"`.

    `scripts/audit/check-ui-standards.js` enforces the zero-tolerance items above once their category is clean (see `scripts/audit/ui-baselines.json`) and ratchets down the `TablePagination`/`CircularProgress`/missing-`PageHeader` backlogs so they can only shrink, never grow.

## Session & Token Reliability

35. **Every Firestore-touching call in a multi-step create/edit handler MUST be wrapped in `retryOnStaleToken`** (`@/lib/firebase/retryOnStaleToken`) — not just the main document write. A user's cached ID token can lag behind a server-side custom-claims change (a newly granted permission, `hasPermission`/`requirePermission` checks read `request.auth.token.permissions`, not the live Firestore `users/{uid}` doc) for several minutes until the client's background refresh catches up, so an otherwise-correctly-permissioned user can hit `permission-denied` — surfacing as the raw Firestore string "Missing or insufficient permissions." `retryOnStaleToken()` force-refreshes the token and retries once on that specific error. Wrap **every** call — number generators (`generateTransactionNumber`, `generateProcurementNumber`), GL-entry/control-account reads, the main `addDoc`/`updateDoc`, and audit log writes — since whichever one executes first in that request fails first, and a handler with only its last call wrapped still breaks on the earlier ones. (Past failure: two rounds of incomplete fixes on `CreateInvoiceDialog`/`CreateBillDialog` — the first round wrapped only the GL-entries read and missed an earlier `generateTransactionNumber` call — before a full sweep found and fixed the identical gap in 5 more accounting dialogs, none of which had any wrapping at all.)

## Data Dictionary — Key Collections

| Collection                      | Entity-scoped              | Key Fields                                                                                                                                     | Written By                                             | Read By                                            |
| ------------------------------- | -------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------ | -------------------------------------------------- |
| `accounts`                      | Yes (`entityId`)           | `code`, `name`, `accountType`, `currentBalance`, `debit`, `credit`, `openingBalance`, `isGroup`, `isActive`                                    | Cloud Function `accountBalances`, client (create/edit) | Chart of Accounts page, selectors, reports         |
| `transactions`                  | Yes (`entityId`)           | `type` (TransactionType), `transactionNumber`, `date`, `totalAmount`, `baseAmount`, `entries[]` (GL), `paymentStatus`, `entityId`, `isDeleted` | Client (create/edit), Cloud Functions (status sync)    | All accounting reports, data health, entity ledger |
| `entities`                      | No (global)                | `name`, `roles[]`, `openingBalance`, `isActive`                                                                                                | Client                                                 | Entity selectors, entity ledger, reports           |
| `users`                         | No (scoped by `userId`)    | `displayName`, `email`, `permissions`, `entityId`                                                                                              | Auth system, admin                                     | Auth context, permission checks                    |
| `projects/{id}/transmittals`    | No (project subcollection) | `transmittalNumber`, `documentIds[]`, `status`, `zipFileUrl`, `transmittalPdfUrl`                                                              | Client, Cloud Function `generateTransmittal`           | Transmittals list, detail dialog                   |
| `projects/{id}/masterDocuments` | No (project subcollection) | `documentNumber`, `documentTitle`, `currentRevision`, `status`, `lastSubmissionDate`                                                           | Client                                                 | Document list, transmittals                        |

**Account balance fields** (`currentBalance`, `debit`, `credit`) are written atomically by the `onTransactionWrite` Cloud Function trigger using `FieldValue.increment()`. The client reads them on the Chart of Accounts page. After deploying Cloud Function changes, run "Recalculate Balances" from the Data Health page.

**More module/route/exemplar detail:** `.claude/MODULE_MAP.md` (load via `/orient`).
