# Phase 2: Procurement Module Audit

**Status**: COMPLETE
**Priority**: High (purchase workflows, approval chains, financial integration)
**Total Findings**: 22

## Scope

### Service Files (`apps/web/src/lib/procurement/`)

- [x] `purchaseOrderService.ts` — PO CRUD and workflow
- [x] `goodsReceiptService.ts` — GR creation and completion
- [x] `goodsReceiptHelpers.ts` — GR utility functions
- [x] `accountingIntegration.ts` — GR-to-bill bridge (also audited in Phase 0)
- [x] `amendment/crud.ts` — PO amendment workflow
- [x] `packingListService.ts` — Packing list management

### Types (`packages/types/src/procurement/`)

- [x] `purchaseOrder.ts`
- [x] `logistics.ts` (GoodsReceipt, PackingList)
- [x] `amendments.ts`

## Findings

### CRITICAL

#### PR-1: No Authorization Check on GR Payment Approval — FIXED `6489217`

- **Category**: Security
- **File**: `apps/web/src/lib/procurement/goodsReceiptService.ts` (lines 425-522)
- **Issue**: `approveGRForPayment()` has NO permission checks. Any authenticated user can approve payment for any GR, enabling unauthorized payments.
- **Recommendation**: Add `requirePermission(userPermissions, PERMISSION_FLAGS.APPROVE_PAYMENT)` at function start.
- **Resolution**: Added MANAGE_ACCOUNTING permission check to `approveGRForPayment()`.

#### PR-2: No Authorization on Goods Receipt Completion — FIXED `6489217`

- **Category**: Security
- **File**: `apps/web/src/lib/procurement/goodsReceiptService.ts` (lines 302-423)
- **Issue**: `completeGR()` has no authorization checks. Any user can mark GRs as complete, bypassing inspection workflow.
- **Recommendation**: Add permission check requiring `INSPECT_GOODS` or `APPROVE_GR` permission flag.
- **Resolution**: Added MANAGE_PROCUREMENT permission check to `completeGR()`.

#### PR-3: No Multi-Tenancy Filtering on GR Queries — FIXED `3cb25cc`

- **Category**: Security
- **File**: `apps/web/src/lib/procurement/goodsReceiptService.ts` (lines 535-572)
- **Issue**: `listGoodsReceipts()` queries the entire collection with NO entityId filter. Cross-tenant data exposure.
- **Recommendation**: Add mandatory `where('entityId', '==', entityId)` to all queries. Requires adding `entityId` to GoodsReceipt schema first.
- **Resolution**: Added `entityId` to `GoodsReceipt` type and `ListGoodsReceiptsFilters`. Added entityId filtering to `listGoodsReceipts()`. Goods receipts page passes `claims?.entityId`.

#### PR-4: Amendment Approval Lacks Authorization — FIXED `6489217`

- **Category**: Security
- **File**: `apps/web/src/lib/procurement/amendment/crud.ts` (lines 177-264)
- **Issue**: `approveAmendment()` has NO permission checks. Any user can approve amendments that change PO amounts.
- **Recommendation**: Require `APPROVE_AMENDMENT` permission and validate financial thresholds.
- **Resolution**: Added MANAGE_PROCUREMENT permission checks to `approveAmendment()` and `rejectAmendment()`.

#### PR-5: GR Quantity Can Exceed PO Quantity — FIXED `0443df1`

- **Category**: Data Integrity
- **File**: `apps/web/src/lib/procurement/goodsReceiptService.ts` (lines 68-263)
- **Issue**: `createGoodsReceipt()` does NOT validate that `receivedQuantity <= (poItem.quantity - poItem.quantityDelivered)`. Allows over-delivery and overbilling.
- **Recommendation**: Validate before accepting:
  - `receivedQuantity <= (poItem.quantity - poItem.quantityDelivered)`
  - `acceptedQuantity <= receivedQuantity`
  - `rejectedQuantity <= receivedQuantity`
- **Resolution**: Added all three quantity validations within the Firestore transaction, after PO items are read and before GR items are created. Throws descriptive error with item name and quantities.

#### PR-6: Self-Approval Possible on Amendments — FIXED `6489217`

- **Category**: Security
- **File**: `apps/web/src/lib/procurement/amendment/crud.ts` (lines 177-213)
- **Issue**: No check preventing amendment requester from approving their own amendment. Violates segregation of duties.
- **Recommendation**: Add `if (userId === amendment.requestedBy) throw new Error('Cannot self-approve')`.
- **Resolution**: Added self-approval prevention — amendment requester cannot approve their own amendment.

### HIGH

#### PR-7: Amendment Changes Applied Without Field Validation

- **Category**: Data Integrity
- **File**: `apps/web/src/lib/procurement/amendment/crud.ts` (lines 227-232)
- **Issue**: Amendment applies field changes directly to PO without validating that PO remains in a valid state. Could set invalid status, corrupt data, or delete required fields.
- **Evidence**: `updateData[change.field] = change.newValue;` — no whitelist of allowed fields.
- **Recommendation**: Implement whitelist of allowed fields for amendment changes. Validate PO schema after applying.

#### PR-8: No Idempotency Guard on Amendment Approval — FIXED `5bafc70`

- **Category**: Data Integrity
- **File**: `apps/web/src/lib/procurement/amendment/crud.ts` (lines 45-48)
- **Issue**: No check preventing the same amendment from being applied twice. If `approveAmendment()` is called again with the same ID, changes are re-applied.
- **Recommendation**: Add `if (amendment.applied === true) throw new Error('Amendment already applied')`.
- **Resolution**: Added idempotency guard in `approveAmendment()` — checks `amendment.applied` flag after status check and throws if amendment was already applied.

#### PR-9: Bank Account ID Not Validated in Payment Approval — FIXED `5bafc70`

- **Category**: Data Integrity
- **File**: `apps/web/src/lib/procurement/goodsReceiptService.ts` (line 201)
- **Issue**: `approveGRForPayment()` accepts `bankAccountId` but never validates it exists or belongs to the organization.
- **Recommendation**: Validate bank account exists and belongs to current entity before creating payment.
- **Resolution**: Added bank account validation before the transaction — fetches account doc, checks existence and `isBankAccount` flag. Includes test coverage for both failure scenarios.

#### PR-10: Bill Creation Uses Unvalidated Project ID — FIXED `58f8d40`

- **Category**: Data Integrity
- **File**: `apps/web/src/lib/procurement/accountingIntegration.ts` (line 204)
- **Issue**: `createBillFromGoodsReceipt()` blindly uses `purchaseOrder.projectIds[0]` without checking project exists or belongs to entity.
- **Recommendation**: Validate project exists before creating GL entries.
- **Resolution**: Added project ID validation after PO fetch — checks project doc exists in Firestore before proceeding with bill creation. Includes test for project not found scenario.

#### PR-11: Missing Firestore Indexes for Procurement Queries — FIXED `82fc756`

- **Category**: Performance / Reliability
- **File**: `firestore.indexes.json`
- **Issue**: Missing indexes for: `purchaseOrderId + status` on amendments, `projectId + status` on GRs, `entityId + status` on POs. Compound queries may fail at runtime.
- **Recommendation**: Add indexes for all multi-field WHERE clauses.
- **Resolution**: Added 3 procurement indexes (amendments: purchaseOrderId+status+date, goodsReceipts: projectId+status+createdAt, purchaseOrders: entityId+status+createdAt) plus 8 entityId indexes for Cluster A queries.

### MEDIUM

#### PR-12: GR State Machine Used Inconsistently

- **Category**: Code Quality
- **File**: `apps/web/src/lib/procurement/goodsReceiptService.ts` (lines 302-423)
- **Issue**: `completeGR()` validates state transition once before the Firestore transaction, but doesn't re-validate inside the transaction. PO workflow uses state machine consistently; GR workflow does not.
- **Recommendation**: Validate state transition inside the transaction to prevent races.

#### PR-13: Bill Fallback to PO Amounts When No Items Accepted

- **Category**: Data Integrity
- **File**: `apps/web/src/lib/procurement/accountingIntegration.ts` (lines 159-163)
- **Issue**: When no GR items are accepted (subtotal=0), falls back to full PO amounts with only a `logger.warn`. Creates incorrect bill silently.
- **Recommendation**: Reject bill creation if no items accepted rather than falling back.

#### PR-14: Amendment Submission Not Idempotent

- **Category**: Code Quality
- **File**: `apps/web/src/lib/procurement/amendment/crud.ts` (lines 114-172)
- **Issue**: `submitAmendmentForApproval()` not wrapped in `withIdempotency()` like PO/GR creation. Double-click creates duplicate history entries.
- **Recommendation**: Wrap in `withIdempotency()` helper.

#### PR-15: GR Items Lack Uniqueness Constraint

- **Category**: Data Integrity
- **File**: `apps/web/src/lib/procurement/goodsReceiptService.ts` (lines 173-206)
- **Issue**: GR items created with auto-generated IDs. No constraint prevents duplicate items with same `goodsReceiptId + lineNumber`. Calling `createGoodsReceipt` twice creates duplicate items.
- **Recommendation**: Use deterministic document IDs like `{grId}_item_{lineNumber}`.

#### PR-16: Missing Dedicated Permission Flags for GR Operations

- **Category**: Security
- **Issue**: No dedicated `APPROVE_GR`, `INSPECT_GOODS`, or `APPROVE_GR_PAYMENT` permission flags. GR operations lack granular access control.
- **Recommendation**: Add permission flags and enforce in service layer.

#### PR-17: Amendment Audit Trail Missing Field-Level Details

- **Category**: Data Integrity / Compliance
- **File**: `apps/web/src/lib/procurement/amendment/crud.ts` (lines 216-234)
- **Issue**: When amendment is approved, PO fields are updated but the history entry doesn't log field-by-field before/after values.
- **Recommendation**: Include change details in history for compliance auditing.

### LOW

#### PR-18: sendGRToAccounting Rollback May Fail

- **Category**: Code Quality
- **File**: `apps/web/src/lib/procurement/accountingIntegration.ts` (lines 356-393)
- **Issue**: If notification creation fails, rollback is attempted but if rollback itself fails, system is in inconsistent state. Already improved in Phase 0 but fundamental atomicity issue remains.
- **Recommendation**: Use Firestore transaction for true atomicity.

#### PR-19: canCreateBill vs UI Logic Confusion

- **Category**: Code Quality / UX
- **File**: `apps/web/src/lib/procurement/goodsReceiptHelpers.ts` (lines 127-141)
- **Issue**: `canCreateBill` requires `sentToAccountingAt` (fixed in Phase 0), but the accounting user on the GR detail page still sees the button. Dual paths for the same action is confusing.
- **Recommendation**: Document the intended workflow clearly. Consider removing direct bill creation from GR detail page.

#### PR-20: Amendment Number Generation Not Atomic

- **Category**: Code Quality
- **File**: `apps/web/src/lib/procurement/amendment/crud.ts` (lines 50-52)
- **Issue**: Amendment numbers calculated as `getAmendmentHistory().length + 1` — race condition if concurrent amendments created.
- **Recommendation**: Use atomic counter similar to procurement number generation.

#### PR-21: Bill Line Items Use PO Quantities, Not GR Accepted Quantities

- **Category**: Data Integrity
- **File**: `apps/web/src/lib/procurement/accountingIntegration.ts` (lines 251-260)
- **Issue**: Bill `lineItems` array uses `purchaseOrderItems` data (PO quantities/amounts) rather than GR accepted quantities. The totals are calculated from accepted quantities, but line item display is from PO.
- **Recommendation**: Use GR accepted quantities for line items to match the calculated totals.

#### PR-22: Missing Amount Validation Before Bill GL Generation

- **Category**: Data Integrity
- **File**: `apps/web/src/lib/procurement/accountingIntegration.ts` (lines 180-206)
- **Issue**: No validation that calculated subtotal/GST are positive before generating GL entries.
- **Recommendation**: Add `if (subtotal <= 0) throw error` after calculation.

## Summary

| Severity | Count | Key Areas                                          |
| -------- | ----- | -------------------------------------------------- |
| CRITICAL | 6     | Security (5), Data Integrity (1)                   |
| HIGH     | 5     | Data Integrity (3), Security (1), Performance (1)  |
| MEDIUM   | 6     | Data Integrity (3), Security (1), Code Quality (2) |
| LOW      | 5     | Code Quality (3), Data Integrity (2)               |

## Priority Fix Order

1. ~~**PR-1 + PR-2**: Authorization checks on GR operations (security)~~ — FIXED `6489217`
2. ~~**PR-4 + PR-6**: Amendment authorization + self-approval prevention (security)~~ — FIXED `6489217`
3. ~~**PR-3**: Multi-tenancy filtering (requires schema change — entityId on GR)~~ — FIXED `3cb25cc`
4. ~~**PR-5**: GR quantity validation against PO (data integrity)~~ — FIXED `0443df1`
5. ~~**PR-8**: Amendment idempotency guard~~ — FIXED `5bafc70`
6. ~~**PR-9**: Bank account validation in payment approval~~ — FIXED `5bafc70`
7. **PR-7**: Amendment field validation (data integrity)
8. ~~**PR-10**: Project ID validation in bill creation~~ — FIXED `58f8d40`
9. ~~**PR-11**: Add missing Firestore indexes (reliability)~~ — FIXED `82fc756`

## Cross-References

- PR-3 relates to AC-2 (both are entityId filtering gaps)
- PR-10 relates to AC-1 (both are unvalidated references in GL generation)
- Phase 0 addressed PR-18 and PR-19 partially
