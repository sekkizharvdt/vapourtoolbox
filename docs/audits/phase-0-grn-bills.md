# Phase 0: GRN Bills Audit

**Status**: COMPLETE
**Scope**: GRN-to-Accounting bill creation workflow
**Files Audited**:

- `apps/web/src/lib/procurement/accountingIntegration.ts`
- `apps/web/src/lib/procurement/goodsReceiptHelpers.ts`
- `apps/web/src/app/procurement/goods-receipts/[id]/GRDetailClient.tsx`
- `apps/web/src/app/accounting/grn-bills/page.tsx`
- `packages/types/src/procurement/logistics.ts`

## Findings & Resolutions

### CRITICAL

| #   | Issue                                                                          | Resolution                                                                                                       |
| --- | ------------------------------------------------------------------------------ | ---------------------------------------------------------------------------------------------------------------- |
| 1   | "Sent to Accounting" status chip hidden for accounting users                   | Fixed: removed `!isAccountingUser` condition from chip render                                                    |
| 2   | Missing `entityId` filter in `getGRNsPendingBilling()` (multi-tenancy)         | Fixed (`e063816`): `entityId` made required on `GoodsReceipt` type, populated from PO in `createGoodsReceipt()`. |
| 3   | Missing Firestore composite index for `status + sentToAccountingAt`            | Fixed: added index to `firestore.indexes.json`                                                                   |
| 4   | Non-atomic `sendGRToAccounting()` — GR update + notification not transactional | Fixed: added try/catch with rollback of GR fields if notification creation fails                                 |

### HIGH

| #   | Issue                                                     | Resolution                                                                                          |
| --- | --------------------------------------------------------- | --------------------------------------------------------------------------------------------------- |
| 5   | Race condition on bill creation (concurrent clicks)       | Deferred: needs Firestore transaction with optimistic locking                                       |
| 6   | "Sent By" column mislabeled (showed assignee, not sender) | Fixed: renamed to "Assigned To" + added `sentToAccountingByName` field to type                      |
| 7   | Missing vendor name and amount columns                    | Fixed: `getGRNsPendingBilling` now returns `GRNPendingBill` with PO data (vendor, amount, currency) |
| 8   | No confirmation dialog before bill creation               | Fixed: added confirmation dialog with GR/PO/vendor/amount details                                   |
| 9   | No notification back to procurement when bill created     | Deferred: needs reverse notification flow                                                           |
| 10  | No pagination/filter/sort on GRN Bills page               | Deferred: add when volume warrants it                                                               |

### MEDIUM

| #   | Issue                                               | Resolution                                                                      |
| --- | --------------------------------------------------- | ------------------------------------------------------------------------------- |
| 11  | Task notification missing `projectId`               | Fixed: added `projectId: goodsReceipt.projectId` to notification                |
| 12  | No rejection/refusal workflow                       | Deferred: needs design                                                          |
| 13  | `canCreateBill` didn't require `sentToAccountingAt` | Fixed: now requires GR to be sent to accounting before bill creation is allowed |
| 14  | ApproverSelector callback not memoized              | Deferred: minor perf, not blocking                                              |
| 15  | No "Sent to Accounting" filter on GR list page      | Deferred: UX enhancement                                                        |

## Deferred Items Summary

These items are tracked for future work:

1. ~~**entityId on GoodsReceipt**~~ — FIXED (`e063816`): `entityId` made required on type, populated from PO
2. **Race condition on bill creation** — needs Firestore transaction wrapping
3. **Reverse notification to procurement** — needs new notification category
4. **Rejection workflow** — needs design for send-back flow
5. **Pagination on GRN Bills** — add when data volume grows
