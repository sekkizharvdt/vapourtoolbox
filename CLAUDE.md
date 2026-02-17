# Vapour Toolbox — Coding Standards

These rules are derived from a 190-finding codebase audit. They apply to all new code and modifications.

## Firestore Queries

1. **Every query MUST include `entityId` filtering** — multi-tenancy is enforced at the query level:

   ```typescript
   where('entityId', '==', entityId);
   ```

   The only exceptions are user-global collections (e.g., `users`, `taskNotifications` which use `userId`).

2. **Every `where()` + `orderBy()` combo MUST have a composite index** in `firestore.indexes.json`. Queries will silently fail in production without them.

3. **Soft-deleted data MUST be filtered** — use client-side filtering (not `where('isDeleted', '!=', true)` which excludes docs missing the field). Only the Trash page shows deleted items.

4. **New collections MUST have Firestore security rules** in `firestore.rules` matching the permission model:
   - `read` requires `hasPermission(<VIEW_* flag>)`
   - `create`/`update` requires `hasPermission(<MANAGE_* flag>)`
   - `delete` requires `hasPermission(<MANAGE_* flag>)` or `isSuperAdmin()`

## Permissions & Authorization

5. **Every service function that writes data MUST check permissions** — use `requirePermission()` from `@/lib/auth/authorizationService`:

   ```typescript
   requirePermission(
     userPermissions,
     PERMISSION_FLAGS.MANAGE_ACCOUNTING,
     userId,
     'create journal entry'
   );
   ```

   Client-side checks alone are insufficient — they can be bypassed.

6. **Every approval workflow MUST prevent self-approval** — use `preventSelfApproval()`:

   ```typescript
   preventSelfApproval(userId, submitterId, 'approve purchase order');
   ```

7. **Permission flags live in `@vapour/constants`** — never create local copies or hardcode numeric values. Import `PERMISSION_FLAGS` and `hasPermission()`.

## Status & Workflow

8. **Every status change MUST use a state machine** — define transitions in `apps/web/src/lib/workflow/stateMachines.ts` and validate with `requireValidTransition()`:

   ```typescript
   import { requireValidTransition } from '@/lib/utils/stateMachine';
   import { paymentBatchStateMachine } from '@/lib/workflow/stateMachines';

   requireValidTransition(paymentBatchStateMachine, currentStatus, targetStatus, 'PaymentBatch');
   ```

   Never use ad-hoc `if (status !== 'DRAFT')` checks for workflow transitions.

9. **Mutations that can be called multiple times MUST be idempotent** — check current state before writing. Network retries and double-clicks are common.

10. **UI controls MUST respect terminal states** — disable action buttons for completed/cancelled items. Don't let users attempt transitions that the backend will reject.

## Data Integrity

11. **Optional fields MUST be null-checked** before calling methods — use `?.` or guard clauses. Firestore documents may lack fields added after initial creation:

    ```typescript
    // Good
    po.commercialTerms?.deliveryUnit?.toLowerCase();

    // Bad — crashes on old documents
    po.commercialTerms.deliveryUnit.toLowerCase();
    ```

12. **Firestore rejects `undefined` values** — use conditional spreads for optional fields:

    ```typescript
    ...(description !== undefined && { description }),
    ```

13. **Avoid denormalizing names** unless you have a sync strategy. If you store `vendorName` in a PO, it will go stale when the vendor is renamed. Prefer looking up names at render time, or document the Cloud Function trigger that keeps them in sync.

14. **Firestore Timestamps must be converted before use** — Firestore returns `Timestamp` objects at runtime, not `Date`, even when TypeScript types say `Date`. Never call `.toLocaleDateString()`, `.toISOString()`, or `.getTime()` without converting first:

    ```typescript
    // Good — check for Timestamp before using date methods
    const raw = doc.someDate;
    const date =
      raw && typeof raw === 'object' && 'toDate' in raw
        ? (raw as { toDate: () => Date }).toDate()
        : raw instanceof Date
          ? raw
          : new Date(raw as string);

    // Bad — crashes when Firestore returns a Timestamp
    doc.someDate.toLocaleDateString();
    doc.someDate.toISOString();
    ```

    This applies to edit forms (pre-filling date inputs), display code (formatting dates), comparisons, and JSON export. The `instanceof Date` check alone is insufficient — always check for `toDate` method first.

## Code Organization

15. **One implementation per function** — never create duplicate service functions (e.g., two `submitForApproval` in different files). Use the module's `index.ts` to re-export from the canonical location.

16. **State machines go in `stateMachines.ts`**, not inline in service files. Status types come from `@vapour/types`.

17. **Sensitive operations need audit trails** — permission changes, employee updates, hard deletes, and financial approvals should log to an `auditLogs` collection (pattern in progress).
