# Phase 1: Accounting Module Audit

**Status**: COMPLETE
**Priority**: Highest (financial data, GL entries, tax compliance)
**Total Findings**: 24

## Scope

### Service Files (`apps/web/src/lib/accounting/`)

- [x] `transactionService.ts` — CRUD for all transaction types
- [x] `glEntry.ts` — GL entry generation (bill, invoice, payment, journal)
- [x] `paymentHelpers.ts` — Payment creation with allocations
- [x] `paymentBatchService.ts` — Batch payment processing
- [x] `recurringTransactionService.ts` — Recurring transaction automation
- [x] `costCentreService.ts` — Cost centre management
- [x] `fiscalYearService.ts` — Fiscal year management
- [x] `interprojectLoanService.ts` — Inter-project loan tracking
- [x] `paymentPlanningService.ts` — Payment planning/scheduling
- [x] `transactionApprovalService.ts` — Transaction approval workflow
- [x] `transactionVoidService.ts` — Transaction voiding
- [x] `systemAccountResolver.ts` — System account resolution for GL

## Findings

### CRITICAL

#### AC-1: Hardcoded Account Codes in Interproject Loans — FIXED `0443df1`

- **Category**: Code Quality / Data Integrity
- **File**: `apps/web/src/lib/accounting/interprojectLoanService.ts` (lines 289, 299, 521-557)
- **Issue**: Account codes ('1400', '2400', '6100', '4200') are hardcoded. If Chart of Accounts codes differ, GL entries will post to wrong accounts.
- **Recommendation**: Use `systemAccountResolver.getSystemAccountIds()` to fetch actual account IDs from Firestore.
- **Resolution**: Extended `systemAccountResolver` with intercompany fields. Both `createInterprojectLoan()` and `recordRepayment()` now resolve accounts dynamically via `getSystemAccountIds()`, throwing if accounts not found in Chart of Accounts.

#### AC-2: Missing Multi-Tenancy Filtering in Queries — FIXED `3cb25cc`

- **Category**: Security
- **File**: `apps/web/src/lib/accounting/paymentBatchService.ts` (lines 231-252, 671-681)
- **Issue**: `listPaymentBatches()` and `getOutstandingBillsForProject()` do NOT filter by entityId. Cross-tenant data exposure.
- **Recommendation**: Add required `entityId` parameter to all queries.
- **Resolution**: Added `entityId` to `PaymentBatch`, `CreatePaymentBatchInput`, `ListPaymentBatchesOptions` types. Added entityId filtering to `listPaymentBatches`, `getOutstandingBillsForProject`, `getOutstandingBillsByProject`, `getPaymentBatchStats`. Callers pass `claims?.entityId`.

#### AC-3: Missing Permission Checks on Approval/Deletion — FIXED `6489217`

- **Category**: Security
- **File**: `apps/web/src/lib/accounting/transactionApprovalService.ts`, `transactionDeleteService.ts`
- **Issue**: `approveBatch()`, `approveBill()`, `softDeleteTransaction()`, `hardDeleteTransaction()` accept userId but never validate permissions.
- **Recommendation**: Add `requirePermission()` calls for APPROVE_TRANSACTIONS and DELETE_TRANSACTIONS.
- **Resolution**: Added MANAGE_ACCOUNTING permission checks to approve, reject, submit, soft-delete, restore, and hard-delete operations. All UI callers updated to pass `claims.permissions`.

#### AC-4: Self-Approval Vulnerability — FIXED `6489217`

- **Category**: Security
- **File**: `apps/web/src/lib/accounting/transactionApprovalService.ts`
- **Issue**: No check prevents users from approving transactions they created. Violates segregation of duties.
- **Recommendation**: Add `if (createdBy === userId) throw new Error('Cannot self-approve')`.
- **Resolution**: Added self-approval prevention — transaction creator cannot approve their own submission.

#### AC-5: Voided Transaction GL Entries Still Modifiable — FIXED `0443df1`

- **Category**: Data Integrity
- **File**: `apps/web/src/lib/accounting/transactionVoidService.ts` (lines 165-260)
- **Issue**: After voiding, `reversalEntries` are stored but original `entries` array remains editable. Direct DB access could alter original entries.
- **Recommendation**: Lock entries after voiding or clear original entries field. Enforce via Firestore Rules.
- **Resolution**: Added `entriesLocked: true` flag to both `voidTransaction()` and `voidAndRecreateTransaction()`. Added guard in `glEntryRegeneration.ts` to reject GL regeneration on voided/locked transactions.

### HIGH

#### AC-6: Recurring Transaction Edge Cases — FIXED `efadb87`

- **Category**: Data Integrity
- **File**: `apps/web/src/lib/accounting/recurringTransactionService.ts` (lines 46-115)
- **Issue**: Month-end handling fragile. dayOfMonth=31 in Feb uses `Math.min(dayOfMonth, lastDay)` but no comprehensive tests for leap years, DST transitions, or `daysBeforeToGenerate` exceeding period length.
- **Recommendation**: Add edge case test coverage. Document expected behavior.
- **Resolution**: Added 7 comprehensive edge case tests: leap year Feb 29, non-leap year Feb 28, sequential month-end chain (Jan 31→Feb 28→Mar 31→Apr 30), last-day-of-month (dayOfMonth=0) across varying months, quarterly across year boundary, yearly from leap day to non-leap year. All 26 tests pass.

#### AC-7: Payment Allocations Not Validated Before Creation — FIXED

- **Category**: Data Integrity
- **File**: `apps/web/src/lib/accounting/paymentHelpers.ts` (lines 353-453)
- **Issue**: `createPaymentWithAllocationsAtomic()` does NOT validate allocation amounts against invoice outstanding before creating payment. `validatePaymentAllocation()` exists but is never called during creation.
- **Recommendation**: Call `validatePaymentAllocation()` for each allocation before creating payment.
- **Resolution**: Added `validatePaymentAllocation()` calls for each non-zero allocation before batch creation. Validates allocation doesn't exceed outstanding amount per invoice/bill.

#### AC-8: Floating Point in Financial Calculations

- **Category**: Code Quality
- **File**: `apps/web/src/lib/accounting/interprojectLoanService.ts` (lines 196-206)
- **Issue**: Interest calculations use floating point arithmetic with `Math.round(x * 100) / 100` at the end. Intermediate calculations can accumulate errors across thousands of transactions.
- **Recommendation**: Use integer arithmetic (paisa) or a decimal library. Convert only for display.

#### AC-9: Missing Composite Index for Period Validation — VERIFIED RESOLVED

- **Category**: Data Integrity
- **File**: `apps/web/src/lib/accounting/fiscalYearService.ts` (lines 143-148)
- **Issue**: `isPeriodOpen()` queries `fiscalYearId + startDate + endDate` which requires a composite index that may not exist. Runtime failure in production.
- **Recommendation**: Verify all composite indexes in `firestore.indexes.json`.
- **Resolution**: Verified — composite index for `accountingPeriods` with fields `fiscalYearId + startDate + endDate` already exists in `firestore.indexes.json` (line 3338).

#### AC-10: GL Validation Only Checks Balance, Not Business Logic — FIXED `efadb87`

- **Category**: Data Integrity
- **File**: `apps/web/src/lib/accounting/ledgerValidator.ts` (lines 33-107)
- **Issue**: `validateLedgerEntries()` only checks debits=credits. Doesn't validate that VENDOR_BILL has Accounts Payable credit, CUSTOMER_INVOICE has Accounts Receivable debit, or GST entries match declared amounts.
- **Recommendation**: Add `validateTransactionEntries()` that validates entries against expected account types per transaction type.
- **Resolution**: Added `validateTransactionBusinessRules()` with `EXPECTED_PATTERNS` map for CUSTOMER_INVOICE (debit 1200/credit 4100), VENDOR_BILL (debit 5100/credit 2100), CUSTOMER_PAYMENT (credit 1200), VENDOR_PAYMENT (debit 2100). Returns warnings (not errors) to accommodate GST/TDS entries that alter expected patterns.

### MEDIUM

#### AC-11: Payment Batch Status Transitions Not Enforced

- **Category**: UX/Workflow
- **File**: `apps/web/src/lib/accounting/paymentBatchService.ts` (lines 565-657)
- **Issue**: Individual status checks exist but no formal state machine. Invalid manual transitions possible.
- **Recommendation**: Define explicit state machine with `ALLOWED_TRANSITIONS` map.

#### AC-12: Recurring Transaction Hard-Deleted Without Audit Trail

- **Category**: Security
- **File**: `apps/web/src/lib/accounting/recurringTransactionService.ts` (lines 314-323)
- **Issue**: `deleteRecurringTransaction()` calls `deleteDoc()` immediately. No soft-delete, no archive, unlike `transactionDeleteService` which archives to DELETED_TRANSACTIONS.
- **Recommendation**: Implement soft-delete with archive pattern.

#### AC-13: No Pagination on Recurring Transaction List

- **Category**: UX/Performance
- **File**: `apps/web/src/lib/accounting/recurringTransactionService.ts` (lines 120-155)
- **Issue**: `getRecurringTransactions()` loads ALL recurring transactions with no `limit()` clause.
- **Recommendation**: Add pagination with `limit(pageSize)` and cursor-based pagination.

#### AC-14: Cost Centre Auto-Creation Race Condition

- **Category**: Data Integrity
- **File**: `apps/web/src/lib/accounting/costCentreService.ts` (lines 18-89)
- **Issue**: `createProjectCostCentre()` does check-then-create without transaction lock. Concurrent requests can create duplicate cost centres for the same project.
- **Recommendation**: Use Firestore transaction with `set()` on a deterministic document ID.

#### AC-15: Fiscal Year "Current" Not Exclusive

- **Category**: Data Integrity
- **File**: `apps/web/src/lib/accounting/fiscalYearService.ts` (lines 37-59)
- **Issue**: `getCurrentFiscalYear()` queries `isCurrent == true` but returns only first result if multiple exist. No validation of uniqueness.
- **Recommendation**: Add validation: `if (docs.length > 1) throw new Error('Multiple current fiscal years found')`.

#### AC-16: TODO Left in Production Code

- **Category**: Code Quality
- **File**: `apps/web/src/lib/accounting/transactionApprovalService.ts`
- **Issue**: `TODO: Remove PENDING_APPROVAL from canEdit after testing phase` — transactions in PENDING_APPROVAL can still be edited, violating audit trail integrity.
- **Recommendation**: Remove PENDING_APPROVAL from editable statuses or document the decision.

#### AC-17: Cascading Updates Not Fully Atomic

- **Category**: Data Integrity
- **File**: `apps/web/src/lib/accounting/paymentHelpers.ts` (lines 405-440)
- **Issue**: After creating payment with WriteBatch, invoice status updates could partially fail. WriteBatch is atomic per batch, but if post-batch operations fail, state is inconsistent.
- **Recommendation**: Use `runTransaction()` instead of WriteBatch for critical multi-document operations.

### LOW

#### AC-18: System Account Codes Hardcoded in Resolver

- **Category**: Code Quality
- **File**: `apps/web/src/lib/accounting/systemAccountResolver.ts` (lines 60-72)
- **Issue**: Account codes ('1200', '4100', '2201', etc.) are hardcoded in `systemCodes` array.
- **Recommendation**: Make configuration-driven via a SYSTEM_ACCOUNTS collection.

#### AC-19: Floating Point Tolerance Hardcoded in Multiple Places

- **Category**: Code Quality
- **Files**: `paymentHelpers.ts` (line 88), `ledgerValidator.ts` (lines 82-83)
- **Issue**: Tolerance hardcoded as `0.01` in multiple files. Not derived from currency.
- **Recommendation**: Define `CURRENCY_TOLERANCE` constant based on currency decimal places.

#### AC-20: View Details Button Non-Functional

- **Category**: UX
- **File**: `apps/web/src/app/accounting/transactions/page.tsx` (lines 281-290)
- **Issue**: "View Details" button has empty `onClick: () => {}`. User clicks but nothing happens.
- **Recommendation**: Implement navigation to transaction detail page.

#### AC-21: No Confirmation Dialog Before Hard Delete

- **Category**: UX
- **File**: `apps/web/src/lib/accounting/transactionDeleteService.ts`
- **Issue**: Hard delete is irreversible but service function doesn't require explicit confirmation.
- **Recommendation**: Add confirmation parameter or require UI dialog before calling.

#### AC-22: Payment Batch Query orderBy Not Validated

- **Category**: Code Quality
- **File**: `apps/web/src/lib/accounting/paymentBatchService.ts` (lines 226-239)
- **Issue**: `listPaymentBatches()` accepts arbitrary `orderBy` field name. Invalid field causes Firestore error.
- **Recommendation**: Validate against allowed fields: `['createdAt', 'submittedAt', 'approvedAt', 'status']`.

#### AC-23: GRN Bills Error Message Not Actionable

- **Category**: UX
- **File**: `apps/web/src/app/accounting/grn-bills/page.tsx` (lines 92-95)
- **Issue**: Error says "check system accounts" but doesn't explain how or link to setup.
- **Recommendation**: Add link to Chart of Accounts setup page.

#### AC-24: Max Payment Amount Arbitrary

- **Category**: Code Quality
- **File**: `apps/web/src/lib/accounting/paymentHelpers.ts` (lines 40-50)
- **Issue**: MAX_PAYMENT_AMOUNT set to 1 trillion with no documented business justification.
- **Recommendation**: Move to configuration with documented rationale.

## Summary

| Severity | Count | Key Areas                                                  |
| -------- | ----- | ---------------------------------------------------------- |
| CRITICAL | 5     | Security (3), Data Integrity (1), Code Quality (1)         |
| HIGH     | 5     | Data Integrity (4), Code Quality (1)                       |
| MEDIUM   | 7     | Data Integrity (3), UX (2), Security (1), Code Quality (1) |
| LOW      | 7     | Code Quality (3), UX (3), Data Integrity (1)               |

## Priority Fix Order

1. ~~**AC-2**: Multi-tenancy filtering (security)~~ — FIXED `3cb25cc`
2. ~~**AC-3 + AC-4**: Permission checks + self-approval prevention (security)~~ — FIXED `6489217`
3. ~~**AC-1**: Remove hardcoded account codes (data integrity)~~ — FIXED `0443df1`
4. **AC-7**: Validate payment allocations before creation (data integrity)
5. **AC-9**: Verify/add composite indexes (reliability)
6. ~~**AC-5**: Lock voided transaction entries (audit trail)~~ — FIXED `0443df1`
