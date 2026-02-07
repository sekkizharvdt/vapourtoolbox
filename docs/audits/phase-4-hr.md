# Phase 4: HR Module Audit

**Status**: COMPLETE
**Priority**: Medium (employee data, leave management)
**Total Findings**: 20

## Scope

### Service Files (`apps/web/src/lib/hr/`)

- [x] Leave service (applications, balances, approvals)
- [x] Travel expense service
- [x] Employee service
- [x] On-duty service
- [x] Holiday service
- [x] Comp-off service

### Pages (`apps/web/src/app/hr/`)

- [x] Leaves (list, apply, approve)
- [x] On-duty applications
- [x] Travel expenses (list, create, approve)
- [x] Calendar (team calendar, holidays)
- [x] Holidays management
- [x] Employee directory

### Types

- [x] Leave types (casual, sick, earned, etc.)
- [x] Travel expense types
- [x] Employee types

## Findings

### CRITICAL

#### HR-1: Missing Multi-Tenancy Filtering on All HR Collections

- **Category**: Security
- **Files**: `apps/web/src/lib/hr/leaves/leaveRequestService.ts`, `travelExpenses/travelExpenseService.ts`, `onDuty/onDutyRequestService.ts`
- **Issue**: All HR service queries do not filter by `entityId` or tenant identifier. Queries only filter by `userId`, `status`, `fiscalYear`, etc., with no organizational/tenant isolation.
- **Impact**: In a multi-tenant deployment, users could potentially access or modify another organization's HR records.
- **Recommendation**: Add `entityId` to all HR documents and include `where('entityId', '==', currentEntityId)` in all queries.

#### HR-2: Travel Expense Amount Modification After Approval Not Prevented

- **Category**: Security / Data Integrity
- **File**: `apps/web/src/lib/hr/travelExpenses/travelExpenseService.ts` (lines 536-625)
- **Issue**: `updateExpenseItem` allows modifying amounts. No transaction-based check verifies parent report is still DRAFT before modification. Race conditions could bypass status check.
- **Impact**: Approved expense amounts could theoretically be modified through race conditions or bypassing client-side checks.
- **Recommendation**: Add transaction-based status check in `updateExpenseItem`. Consider immutable item records once report is submitted.

### HIGH

#### HR-3: Missing Composite Index for Leave Balance Queries

- **Category**: Performance / Reliability
- **File**: `apps/web/src/lib/hr/leaves/leaveBalanceService.ts` (lines 69-92, 127-152, 378-419)
- **Issue**: Queries use multiple `where` clauses (`userId + fiscalYear`, `userId + leaveTypeCode + fiscalYear`) without documented composite indexes.
- **Recommendation**: Create composite indexes for all multi-field queries in `firestore.indexes.json`.

#### HR-4: Leave Balance Calculation Race Condition

- **Category**: Data Integrity
- **File**: `apps/web/src/lib/hr/leaves/leaveApprovalService.ts` (lines 299-306, 465-471)
- **Issue**: Approval flow updates request document and balance document separately (no transaction). Concurrent approvals could create inconsistent balances.
- **Recommendation**: Wrap entire approval workflow (request + balance update) in a Firestore transaction.

#### HR-5: Hard-Coded Approver Emails in Multiple Services

- **Category**: Security / Code Quality
- **Files**: `leaveApprovalService.ts` (line 41), `travelExpenseApprovalService.ts` (line 32), `onDutyApprovalService.ts` (line 42)
- **Issue**: Default approver emails are hard-coded (e.g., internal company emails). Falls back to these if Firestore config is missing.
- **Recommendation**: Move defaults to environment variables. Always require config in Firestore during deployment.

#### HR-6: No Validation of Leave Overlap

- **Category**: Data Integrity
- **File**: `apps/web/src/lib/hr/leaves/leaveRequestService.ts` (lines 247-338)
- **Issue**: `createLeaveRequest` validates holidays and balance, but does NOT check for overlapping approved leave requests on the same dates.
- **Impact**: User could submit overlapping requests (Feb 1-5 and Feb 3-7); if both approved, double leave on same days.
- **Recommendation**: Add `checkForOverlappingLeaves()` function to reject overlapping requests.

#### HR-7: On-Duty Requests Don't Check for Conflicting Approved Leaves

- **Category**: Data Integrity
- **File**: `apps/web/src/lib/hr/onDuty/onDutyRequestService.ts` (lines 133-212)
- **Issue**: Validates date is a holiday and checks for duplicate on-duty requests, but does NOT check if user has an approved leave for that date.
- **Recommendation**: Query for approved leave requests on the same date before creating on-duty request.

#### HR-8: Comp-Off Balance Not Tracked with Expiry Metadata

- **Category**: Data Integrity
- **File**: `apps/web/src/lib/hr/onDuty/compOffService.ts` (lines 170-187, 264-279)
- **Issue**: Comp-offs should expire 1 year from grant, but no individual grant records with metadata are stored. `findExpiringCompOffs` is a TODO placeholder returning empty array.
- **Recommendation**: Create `compOffGrants` subcollection with grant dates and expiry tracking. Implement scheduled Cloud Function for auto-expiry.

#### HR-9: No Validation That Half-Day Leaves Are Single-Day Only (UX)

- **Category**: UX
- **File**: `apps/web/src/lib/hr/leaves/leaveRequestService.ts` (lines 270-279)
- **Issue**: Half-day validation correctly rejects multi-day requests, but the error message doesn't explain which dates are problematic.
- **Recommendation**: Improve error message to include date range and day count.

#### HR-10: Employee Directory Leaks All Internal User Emails

- **Category**: Security
- **File**: `apps/web/src/lib/hr/employees/employeeService.ts` (lines 30-50, 258-268)
- **Issue**: `getAllEmployees` and `searchEmployees` return all employees without permission checks. No field-level filtering for sensitive data.
- **Recommendation**: Add permission check requiring `MANAGE_HR_PROFILES` or restrict sensitive fields for non-HR users.

### MEDIUM

#### HR-11: Missing Firestore Indexes Documentation

- **Category**: Performance
- **Files**: All HR service files
- **Issue**: Complex multi-field queries used throughout but no documentation or entries in `firestore.indexes.json` for HR collections.
- **Recommendation**: Document all required composite indexes for HR collections.

#### HR-12: Travel Expense Report Status Transition Logic Not Validated

- **Category**: Code Quality
- **File**: `apps/web/src/lib/hr/travelExpenses/travelExpenseApprovalService.ts` (lines 240-245, 347-348, 443-444, 524-530)
- **Issue**: Status transitions hardcoded in each function. No centralized state machine prevents invalid transitions (e.g., REJECTED -> APPROVED without going through DRAFT).
- **Recommendation**: Create `travelExpenseStatusMachine.ts` with valid transitions map.

#### HR-13: Holiday Duplicate Detection Not Enforced at Database Level

- **Category**: Data Integrity
- **File**: `apps/web/src/lib/hr/holidays/holidayService.ts` (lines 286-311, 345-357)
- **Issue**: Deduplicates holidays in memory using Map, but no Firestore-level unique constraint. Concurrent admin creates can produce duplicates.
- **Recommendation**: Use deterministic document IDs (e.g., `holiday-${year}-${month}-${day}`) to prevent duplicates.

#### HR-14: Employee Update Functions Lack Audit Logging

- **Category**: Security / Compliance
- **File**: `apps/web/src/lib/hr/employees/employeeService.ts` (lines 144-180, 185-217)
- **Issue**: Employee profile updates write `updatedAt`/`updatedBy` but don't create audit log entries. Sensitive fields (salary, department) can change without traceable trail.
- **Recommendation**: Add `createAuditLog()` call after employee updates.

#### HR-15: Leave Balance Recalculation Not Automatic at Fiscal Year Boundary

- **Category**: UX / Operations
- **File**: `apps/web/src/lib/hr/leaves/leaveBalanceService.ts` (lines 158-218)
- **Issue**: `initializeUserLeaveBalances` must be manually called by admin at fiscal year boundary. No automatic trigger.
- **Recommendation**: Implement Cloud Function scheduled for fiscal year start to initialize all user balances with carry-forward.

#### HR-16: Approval Email Configuration Not Validated on App Startup

- **Category**: Code Quality
- **Files**: All approval services (leaveApprovalService, travelExpenseApprovalService, onDutyApprovalService)
- **Issue**: If Firestore config is missing, services silently use hard-coded defaults. No validation that configured approver emails correspond to actual users.
- **Recommendation**: Create `hrConfigValidator.ts` that validates config exists and approver emails are valid.

#### HR-17: Travel Expense Self-Approval Handled Differently from Leave

- **Category**: UX
- **File**: `apps/web/src/lib/hr/travelExpenses/travelExpenseApprovalService.ts` (lines 152-154)
- **Issue**: If submitter is only configured approver, travel expense fails with confusing error. Leave requests handle this with `isSelfApprovalCase` logic.
- **Recommendation**: Implement `isSelfApprovalCase` logic consistent with leave approval service.

#### HR-18: Missing Permissions Check on HR Service Function Calls

- **Category**: Security
- **Files**: All HR service files
- **Issue**: Service layer functions do not check user permissions. Deferred entirely to Firestore security rules, so users only learn they lack permission after Firestore denial.
- **Recommendation**: Create `hrPermissions.ts` utility for early permission validation with clear messaging.

#### HR-19: Inconsistent Naming: "leaveRequests" vs "hrLeaveRequests" in Firestore Rules

- **Category**: Code Quality
- **File**: `firestore.rules` (lines 720, 1440)
- **Issue**: Two patterns for leave collections in rules: old `leaveRequests` (line 720) and new `hrLeaveRequests` (line 1440). Old rules still present as dead code.
- **Recommendation**: Remove old rule patterns after verifying actual collection names used in code.

### LOW

#### HR-20: Hardcoded Currency "INR" Not Validated

- **Category**: Code Quality
- **File**: `apps/web/src/lib/hr/travelExpenses/travelExpenseService.ts` (lines 148, 481)
- **Issue**: Travel expense reports hardcode `currency: 'INR'`. Inflexible for multi-country operations.
- **Recommendation**: Read currency from company configuration, allow override per-report.

## Summary

| Severity | Count | Key Areas                                                  |
| -------- | ----- | ---------------------------------------------------------- |
| CRITICAL | 2     | Security (1), Data Integrity (1)                           |
| HIGH     | 8     | Data Integrity (4), Security (2), Performance (1), UX (1)  |
| MEDIUM   | 9     | Data Integrity (2), Security (2), Code Quality (3), UX (2) |
| LOW      | 1     | Code Quality (1)                                           |

## Priority Fix Order

1. **HR-1**: Multi-tenancy filtering on all HR queries
2. **HR-2**: Prevent expense modification after approval
3. **HR-4**: Wrap approval workflows in transactions
4. **HR-6 + HR-7**: Implement leave overlap and on-duty conflict detection
5. **HR-5**: Remove hard-coded approver emails
6. **HR-8**: Implement comp-off expiry tracking
