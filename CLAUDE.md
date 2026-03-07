# Vapour Toolbox — Coding Standards

These rules are derived from a 190-finding codebase audit. They apply to all new code and modifications.

## Firestore Queries

1. **Every query MUST include `entityId` filtering** — multi-tenancy is enforced at the query level:

   ```typescript
   where('entityId', '==', entityId);
   ```

   On the client side, `entityId` comes from `claims?.entityId` via `useAuth()`. Pages extract it and pass it down to service functions.

   **Global (non-entity-scoped) collections that are exceptions:**
   - `users`, `taskNotifications` — scoped by `userId` instead
   - `entities` — the entity registry itself (queried by admins)
   - `materials`, `shapes`, `boughtOutItems` — shared reference data across all entities

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

14b. **Dialog/form state MUST sync via `useEffect` when props change** — `useState(prop.value)` only captures the value on first render. Dialogs that reopen for different items will show stale data unless state is re-synced:

    ```typescript
    // Bad — shows stale data when dialog reopens for a different document
    const [title, setTitle] = useState(document.title);

    // Good — sync state when the dialog opens or the item changes
    const [title, setTitle] = useState(document.title);
    useEffect(() => {
      if (open) {
        setTitle(document.title);
        setDescription(document.description);
      }
    }, [open, document]);
    ```

14c. **Form validation MUST null-coalesce before calling string methods** — form fields bound to optional Firestore data may be `undefined`. Always use `(field ?? '').trim()` instead of `field.trim()` in validation:

    ```typescript
    // Bad — crashes if deliveryAddress is undefined
    if (!commercialTerms.deliveryAddress.trim()) { ... }

    // Good — safe for undefined values
    if (!(commercialTerms.deliveryAddress ?? '').trim()) { ... }
    ```

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

## Transaction Type Safety

24. **All switches on `TransactionType` MUST handle all 9 types** — use `Record<TransactionType, T>` lookup maps from `@vapour/constants` for labels/routes/colors. For behavioral switches, list every case explicitly (no `default` catch-all):

    ```typescript
    // Good — lookup map (compile error if a type is added)
    import { TRANSACTION_TYPE_LABELS } from '@vapour/constants';
    const label = TRANSACTION_TYPE_LABELS[txn.type];

    // Good — exhaustive switch for behavioral logic
    switch (txn.type) {
      case 'CUSTOMER_INVOICE': ...
      case 'CUSTOMER_PAYMENT': ...
      case 'VENDOR_BILL': ...
      case 'VENDOR_PAYMENT': ...
      case 'JOURNAL_ENTRY': ...
      case 'BANK_TRANSFER': ...
      case 'EXPENSE_CLAIM': ...
      case 'DIRECT_PAYMENT': ...
      case 'DIRECT_RECEIPT': ...
      // No default — compiler catches missing cases
    }
    ```

    The 9 types: `CUSTOMER_INVOICE`, `CUSTOMER_PAYMENT`, `VENDOR_BILL`, `VENDOR_PAYMENT`, `JOURNAL_ENTRY`, `BANK_TRANSFER`, `EXPENSE_CLAIM`, `DIRECT_PAYMENT`, `DIRECT_RECEIPT`.

25. **Cross-boundary field names MUST use shared constants** — fields written by Cloud Functions and read by the client (e.g., account balances) are defined in `packages/constants/src/fields.ts`. If renaming a Firestore field, update the constant and fix all compile errors.

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
