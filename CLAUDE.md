# Vapour Toolbox — Coding Standards

These rules are derived from a 190-finding codebase audit. They apply to all new code and modifications.

## Firestore Queries

1. **Every query MUST include `entityId` filtering** — multi-tenancy is enforced at the query level:

   ```typescript
   where('entityId', '==', entityId);
   ```

   The only exceptions are user-global collections (e.g., `users`, `taskNotifications` which use `userId`).

2. **Every `where()` + `orderBy()` combo MUST have a composite index** in `firestore.indexes.json`. Queries will silently fail in production without them.

3. **Soft-deleted data MUST be filtered** — use client-side filtering (not `where('isDeleted', '!=', true)` which excludes docs missing the field). Only the Trash page shows deleted items. This applies to Cloud Functions too — triggers like `onTransactionWrite` must filter out soft-deleted documents before recalculating aggregates.

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

## Forms & Edit Mode

15. **Selector callbacks only fire on user interaction** — `onEntitySelect`, `onAccountSelect`, and similar callbacks on `EntitySelector`, `AccountSelector`, etc. do NOT fire when the component's `value` prop is pre-populated in edit mode. Never rely on these callbacks to set state that effects or submit handlers depend on:

    ```typescript
    // Bad — entityName is never set in edit mode
    <EntitySelector
      value={entityId}
      onEntitySelect={(entity) => setEntityName(entity?.name || '')}
    />

    // Good — restore from saved data in the edit reset effect
    useEffect(() => {
      if (editingPayment) {
        setEntityId(editingPayment.entityId);
        setEntityName(editingPayment.entityName); // Set directly
      }
    }, [open, editingPayment]);
    ```

    If an effect needs derived data (like `openingBalance`) from the entity document, fetch it directly in the effect using `getDoc()` rather than relying on the selector callback.

## Code Organization

16. **One implementation per function** — never create duplicate service functions (e.g., two `submitForApproval` in different files). Use the module's `index.ts` to re-export from the canonical location.

17. **State machines go in `stateMachines.ts`**, not inline in service files. Status types come from `@vapour/types`.

18. **Sensitive operations need audit trails** — permission changes, employee updates, hard deletes, and financial approvals should log to an `auditLogs` collection (pattern in progress).

## Concurrency & Transactions

19. **Read-modify-write MUST use a Firestore transaction** — never read a document, modify it in memory, and write it back without `db.runTransaction()`. Cloud Functions can fire concurrently on the same collection, and two reads of the same document will both see stale state. Use `FieldValue.increment()` for counters and `db.runTransaction()` for array/object mutations:

    ```typescript
    // Good — atomic counter
    batch.update(ref, { totalDelivered: FieldValue.increment(qty) });

    // Good — transactional array mutation
    await db.runTransaction(async (tx) => {
      const snap = await tx.get(projectRef);
      const items = snap.data()!.procurementItems;
      items[idx].status = 'COMPLETED';
      tx.update(projectRef, { procurementItems: items });
    });

    // Bad — concurrent triggers overwrite each other
    const snap = await getDoc(projectRef);
    const items = snap.data()!.procurementItems;
    items[idx].status = 'COMPLETED';
    await updateDoc(projectRef, { procurementItems: items });
    ```

20. **Firestore batch writes are limited to 500 operations** — chunk larger operations. Cloud Functions that recalculate balances or sync denormalized fields across many documents must split into batches:

    ```typescript
    for (let i = 0; i < updates.length; i += 500) {
      const batch = db.batch();
      updates.slice(i, i + 500).forEach((u) => batch.update(u.ref, u.data));
      await batch.commit();
    }
    ```

## Financial Math

21. **Monetary calculations MUST be precise** — never use fallback chains that mask missing data, and round at every calculation step:

    ```typescript
    // Good — derive from source values
    const outstanding = roundToPaisa(baseAmount - (amountPaid ?? 0));

    // Bad — fallback chain hides bugs and can double amounts
    const outstanding = data.outstandingAmount ?? data.baseAmount ?? 0;
    ```

    Rules:
    - Derive outstanding amounts: `outstanding = total - paid`, never trust a cached `outstandingAmount` without verifying it.
    - Round to paisa (2 decimals) at every step: `Math.round(n * 100) / 100`.
    - For multi-currency: always aggregate using `baseAmount` (INR), not `totalAmount` (foreign currency). Mixing currencies in sums silently corrupts reports.
    - Use a tolerance for zero-checks (e.g., `Math.abs(outstanding) < 0.01`) to prevent floating-point residues from marking fully-paid items as overdue.

## Forms & Data Completeness

22. **Every typed field MUST be written on create, every saved field MUST be restored on edit** — forms that forget to write a field create documents with missing data that break downstream logic. Forms that forget to restore a field lose user data on edit:

    ```typescript
    // Create — write every field the type requires
    const bill: VendorBill = {
      billDate: Timestamp.fromDate(billDate), // Don't forget this!
      vendorId,
      entityId,
      // ... every field
    };

    // Edit — restore every field in the reset effect
    useEffect(() => {
      if (editingBill) {
        setBillDate(toDate(editingBill.billDate)); // Restore dates
        setAllocations(editingBill.allocations ?? []); // Restore arrays
        setEntityId(editingBill.entityId); // Restore IDs
      }
    }, [open, editingBill]);
    ```

    Test form round-trips: create → save → open edit → save again. All values must survive unchanged.

## Service-Layer Validation

23. **Service functions MUST validate constraints before writing** — permissions (rule 5) prevent unauthorized access, but data constraints prevent invalid state. Validate quantities, amounts, and referential integrity inside a transaction:

    ```typescript
    await db.runTransaction(async (tx) => {
      const poSnap = await tx.get(poRef);
      const poData = poSnap.data()!;
      const remaining = poData.quantity - poData.quantityDelivered;

      if (receivedQty > remaining) {
        throw new Error(`Received qty (${receivedQty}) exceeds remaining PO qty (${remaining})`);
      }
      if (allocatedAmount > invoice.outstandingAmount) {
        throw new Error('Allocation exceeds outstanding amount');
      }

      tx.set(grRef, grData);
      tx.update(poRef, { quantityDelivered: FieldValue.increment(receivedQty) });
    });
    ```

    Key validations to enforce:
    - Goods receipt qty <= PO remaining qty
    - Payment allocation <= invoice outstanding amount
    - Amendment cannot modify a completed/cancelled PO
    - Budget spend cannot exceed approved budget without explicit override
