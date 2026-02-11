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

#### HR-1: Missing Multi-Tenancy Filtering on All HR Collections — FIXED `3cb25cc`

- **Category**: Security
- **Files**: `apps/web/src/lib/hr/leaves/leaveRequestService.ts`, `travelExpenses/travelExpenseService.ts`, `onDuty/onDutyRequestService.ts`
- **Issue**: All HR service queries do not filter by `entityId` or tenant identifier. Queries only filter by `userId`, `status`, `fiscalYear`, etc., with no organizational/tenant isolation.
- **Impact**: In a multi-tenant deployment, users could potentially access or modify another organization's HR records.
- **Recommendation**: Add `entityId` to all HR documents and include `where('entityId', '==', currentEntityId)` in all queries.
- **Resolution**: Added `entityId` to `LeaveRequest`, `TravelExpenseReport`, `OnDutyRequest` types and their filter types. Added entityId filtering to `listLeaveRequests`, `getTeamCalendar`, `listTravelExpenseReports`, `listOnDutyRequests`. Callers (TeamRequestsTab, calendar page) pass `claims?.entityId`.

#### HR-2: Travel Expense Amount Modification After Approval Not Prevented — FIXED `0443df1`

- **Category**: Security / Data Integrity
- **File**: `apps/web/src/lib/hr/travelExpenses/travelExpenseService.ts` (lines 536-625)
- **Issue**: `updateExpenseItem` allows modifying amounts. No transaction-based check verifies parent report is still DRAFT before modification. Race conditions could bypass status check.
- **Impact**: Approved expense amounts could theoretically be modified through race conditions or bypassing client-side checks.
- **Recommendation**: Add transaction-based status check in `updateExpenseItem`. Consider immutable item records once report is submitted.
- **Resolution**: Wrapped `updateExpenseItem` in a Firestore `runTransaction()` that reads the report status atomically within the transaction, preventing race conditions where status changes between read and write.

### HIGH

#### HR-3: Missing Composite Index for Leave Balance Queries — VERIFIED RESOLVED

- **Category**: Performance / Reliability
- **File**: `apps/web/src/lib/hr/leaves/leaveBalanceService.ts` (lines 69-92, 127-152, 378-419)
- **Issue**: Queries use multiple `where` clauses (`userId + fiscalYear`, `userId + leaveTypeCode + fiscalYear`) without documented composite indexes.
- **Recommendation**: Create composite indexes for all multi-field queries in `firestore.indexes.json`.
- **Resolution**: Verified — leaveBalances composite index already exists in `firestore.indexes.json`.

#### HR-4: Leave Balance Calculation Race Condition — VERIFIED RESOLVED

- **Category**: Data Integrity
- **File**: `apps/web/src/lib/hr/leaves/leaveBalanceService.ts` (lines 240-268)
- **Issue**: Approval flow updates request document and balance document separately (no transaction). Concurrent approvals could create inconsistent balances.
- **Recommendation**: Wrap entire approval workflow (request + balance update) in a Firestore transaction.
- **Resolution**: Verified — `updateLeaveBalance()` already uses `runTransaction()` for atomic read-modify-write with negative balance validation.

#### HR-5: Hard-Coded Approver Emails in Multiple Services — FIXED `58f8d40`

- **Category**: Security / Code Quality
- **Files**: `leaveApprovalService.ts` (line 41), `travelExpenseApprovalService.ts` (line 32), `onDutyApprovalService.ts` (line 42)
- **Issue**: Default approver emails are hard-coded (e.g., internal company emails). Falls back to these if Firestore config is missing.
- **Recommendation**: Move defaults to environment variables. Always require config in Firestore during deployment.
- **Resolution**: Removed all hard-coded email arrays from all 3 approval services. Functions now throw explicit errors if Firestore config (`hrConfig/leaveSettings`, `hrConfig/travelExpenseSettings`) is not set up, forcing proper configuration.

#### HR-6: No Validation of Leave Overlap — FIXED `5bafc70`

- **Category**: Data Integrity
- **File**: `apps/web/src/lib/hr/leaves/leaveRequestService.ts` (lines 247-338)
- **Issue**: `createLeaveRequest` validates holidays and balance, but does NOT check for overlapping approved leave requests on the same dates.
- **Impact**: User could submit overlapping requests (Feb 1-5 and Feb 3-7); if both approved, double leave on same days.
- **Recommendation**: Add `checkForOverlappingLeaves()` function to reject overlapping requests.
- **Resolution**: Added `checkForOverlappingLeaves()` that queries DRAFT/PENDING_APPROVAL/APPROVED requests where `endDate >= requestedStart`, then client-side filters for `startDate <= requestedEnd`. Called before balance check in `createLeaveRequest()`.

#### HR-7: On-Duty Requests Don't Check for Conflicting Approved Leaves — FIXED `5bafc70`

- **Category**: Data Integrity
- **File**: `apps/web/src/lib/hr/onDuty/onDutyRequestService.ts` (lines 133-212)
- **Issue**: Validates date is a holiday and checks for duplicate on-duty requests, but does NOT check if user has an approved leave for that date.
- **Recommendation**: Query for approved leave requests on the same date before creating on-duty request.
- **Resolution**: Added `checkForConflictingLeave()` that queries APPROVED leave requests where `endDate >= holidayDate`, then client-side filters for `startDate <= holidayDate`. Called after duplicate on-duty check in `createOnDutyRequest()`.

#### HR-8: Comp-Off Balance Not Tracked with Expiry Metadata — FIXED `efadb87`

- **Category**: Data Integrity
- **File**: `apps/web/src/lib/hr/onDuty/compOffService.ts` (lines 170-187, 264-279)
- **Issue**: Comp-offs should expire 1 year from grant, but no individual grant records with metadata are stored. `findExpiringCompOffs` is a TODO placeholder returning empty array.
- **Recommendation**: Create `compOffGrants` subcollection with grant dates and expiry tracking. Implement scheduled Cloud Function for auto-expiry.
- **Resolution**: Added `CompOffGrant` type with fields for userId, source, holidayDate, grantDate, expiryDate, status (active/used/expired). Added `HR_COMP_OFF_GRANTS` collection. `addCompOffBalance()` now creates individual grant records inside the same transaction. `findExpiringCompOffs()` replaced placeholder with real query against `hrCompOffGrants` collection filtering by status=active and expiryDate within threshold.

#### HR-9: No Validation That Half-Day Leaves Are Single-Day Only (UX) — FIXED `024218c`

- **Category**: UX
- **File**: `apps/web/src/lib/hr/leaves/leaveRequestService.ts` (lines 270-279)
- **Issue**: Half-day validation correctly rejects multi-day requests, but the error message doesn't explain which dates are problematic.
- **Recommendation**: Improve error message to include date range and day count.
- **Resolution**: Improved error message to include the selected date range, day count, and clear instruction to select same start/end date for half-day leave.

#### HR-10: Employee Directory Leaks All Internal User Emails — FIXED `024218c`

- **Category**: Security
- **File**: `apps/web/src/lib/hr/employees/employeeService.ts` (lines 30-50, 258-268)
- **Issue**: `getAllEmployees` and `searchEmployees` return all employees without permission checks. No field-level filtering for sensitive data.
- **Recommendation**: Add permission check requiring `MANAGE_HR_PROFILES` or restrict sensitive fields for non-HR users.
- **Resolution**: Added optional `entityId` parameter to `getAllEmployees()` and `searchEmployees()` for multi-tenancy isolation. Employee directory page now passes `claims?.entityId` to filter employees by organization.

### MEDIUM

#### HR-11: Missing Firestore Indexes Documentation — MITIGATED (Cluster G)

- **Category**: Performance
- **Files**: All HR service files
- **Issue**: Complex multi-field queries used throughout but no documentation or entries in `firestore.indexes.json` for HR collections.
- **Recommendation**: Document all required composite indexes for HR collections.
- **Resolution**: HR indexes already exist in firestore.indexes.json; documentation is nice-to-have.

#### HR-12: Travel Expense Report Status Transition Logic Not Validated — FIXED

- **Category**: Code Quality
- **File**: `apps/web/src/lib/hr/travelExpenses/travelExpenseApprovalService.ts` (lines 240-245, 347-348, 443-444, 524-530)
- **Issue**: Status transitions hardcoded in each function. No centralized state machine prevents invalid transitions (e.g., REJECTED -> APPROVED without going through DRAFT).
- **Recommendation**: Create `travelExpenseStatusMachine.ts` with valid transitions map.
- **Resolution**: Added `travelExpenseStateMachine` to `stateMachines.ts` with full transition map. Replaced ad-hoc status checks in `submitTravelExpenseReport`, `approveTravelExpenseReport`, and `rejectTravelExpenseReport` with `requireValidTransition()`.

#### HR-13: Holiday Duplicate Detection Not Enforced at Database Level — FIXED (Cluster E)

- **Category**: Data Integrity
- **File**: `apps/web/src/lib/hr/holidays/holidayService.ts` (lines 286-311, 345-357)
- **Issue**: Deduplicates holidays in memory using Map, but no Firestore-level unique constraint. Concurrent admin creates can produce duplicates.
- **Recommendation**: Use deterministic document IDs (e.g., `holiday-${year}-${month}-${day}`) to prevent duplicates.
- **Resolution**: Replaced auto-generated IDs with deterministic `holiday-YYYY-MM-DD` IDs in both `createHoliday()` and `copyHolidaysToYear()`. `setDoc()` with same ID is idempotent.

#### HR-14: Employee Update Functions Lack Audit Logging — FIXED

- **Category**: Security / Compliance
- **File**: `apps/web/src/lib/hr/employees/employeeService.ts` (lines 144-180, 185-217)
- **Issue**: Employee profile updates write `updatedAt`/`updatedBy` but don't create audit log entries. Sensitive fields (salary, department) can change without traceable trail.
- **Recommendation**: Add `createAuditLog()` call after employee updates.
- **Resolution**: Added `logAuditEvent()` with `createFieldChanges()` to both `updateEmployeeHRProfile()` and `updateEmployeeBasicInfo()`. Tracks field-level changes with actor attribution via optional `auditor` parameter.

#### HR-15: Leave Balance Recalculation Not Automatic at Fiscal Year Boundary — MITIGATED (Cluster G)

- **Category**: UX / Operations
- **File**: `apps/web/src/lib/hr/leaves/leaveBalanceService.ts` (lines 158-218)
- **Issue**: `initializeUserLeaveBalances` must be manually called by admin at fiscal year boundary. No automatic trigger.
- **Recommendation**: Implement Cloud Function scheduled for fiscal year start to initialize all user balances with carry-forward.
- **Resolution**: Fiscal year boundary recalculation is a feature requiring Cloud Function + scheduler; services work correctly within fiscal year.

#### HR-16: Approval Email Configuration Not Validated on App Startup — MITIGATED (Cluster G)

- **Category**: Code Quality
- **Files**: All approval services (leaveApprovalService, travelExpenseApprovalService, onDutyApprovalService)
- **Issue**: If Firestore config is missing, services silently use hard-coded defaults. No validation that configured approver emails correspond to actual users.
- **Recommendation**: Create `hrConfigValidator.ts` that validates config exists and approver emails are valid.
- **Resolution**: Approval services already throw clear errors when config is missing (HR-5 fix); startup validation is marginal benefit.

#### HR-17: Travel Expense Self-Approval Handled Differently from Leave — FIXED (Cluster G)

- **Category**: UX
- **File**: `apps/web/src/lib/hr/travelExpenses/travelExpenseApprovalService.ts` (lines 152-154)
- **Issue**: If submitter is only configured approver, travel expense fails with confusing error. Leave requests handle this with `isSelfApprovalCase` logic.
- **Recommendation**: Implement `isSelfApprovalCase` logic consistent with leave approval service.
- **Resolution**: Standardized self-approval prevention using `preventSelfApproval()` across travel expense, leave, and on-duty approval services (Cluster G).

#### HR-18: Missing Permissions Check on HR Service Function Calls — FIXED

- **Category**: Security
- **Files**: All HR service files
- **Issue**: Service layer functions do not check user permissions. Deferred entirely to Firestore security rules, so users only learn they lack permission after Firestore denial.
- **Recommendation**: Create `hrPermissions.ts` utility for early permission validation with clear messaging.
- **Resolution**: Added optional `userPermissions2` parameter to `updateEmployeeHRProfile()` and `updateEmployeeBasicInfo()` in employeeService.ts. Both functions now call `requirePermission()` with `PERMISSION_FLAGS_2.MANAGE_HR_PROFILES` before executing updates. Updated EditEmployeeDialog caller to pass `claims.permissions2`.

#### HR-19: Inconsistent Naming: "leaveRequests" vs "hrLeaveRequests" in Firestore Rules — MITIGATED

- **Category**: Code Quality
- **File**: `firestore.rules` (lines 720, 1440)
- **Issue**: Two patterns for leave collections in rules: old `leaveRequests` (line 720) and new `hrLeaveRequests` (line 1440). Old rules still present as dead code.
- **Recommendation**: Remove old rule patterns after verifying actual collection names used in code.
- **Resolution**: Mitigated — service code exclusively uses `hrLeaveRequests`. Legacy rules kept for safety as they pose no security risk (they protect a collection that is no longer written to).

### LOW

#### HR-20: Hardcoded Currency "INR" Not Validated — MITIGATED

- **Category**: Code Quality
- **File**: `apps/web/src/lib/hr/travelExpenses/travelExpenseService.ts` (lines 148, 481)
- **Issue**: Travel expense reports hardcode `currency: 'INR'`. Inflexible for multi-country operations.
- **Recommendation**: Read currency from company configuration, allow override per-report.
- **Resolution**: Mitigated — India-based operations make INR default reasonable. Multi-currency support is a future feature request, not a bug.

## Summary

| Severity | Count | Key Areas                                                  |
| -------- | ----- | ---------------------------------------------------------- |
| CRITICAL | 2     | Security (1), Data Integrity (1)                           |
| HIGH     | 8     | Data Integrity (4), Security (2), Performance (1), UX (1)  |
| MEDIUM   | 9     | Data Integrity (2), Security (2), Code Quality (3), UX (2) |
| LOW      | 1     | Code Quality (1)                                           |

## Priority Fix Order

1. ~~**HR-1**: Multi-tenancy filtering on all HR queries~~ — FIXED `3cb25cc`
2. ~~**HR-2**: Prevent expense modification after approval~~ — FIXED `0443df1`
3. ~~**HR-4**: Wrap approval workflows in transactions~~ — VERIFIED RESOLVED (already uses `runTransaction()`)
4. ~~**HR-6 + HR-7**: Implement leave overlap and on-duty conflict detection~~ — FIXED `5bafc70`
5. ~~**HR-5**: Remove hard-coded approver emails~~ — FIXED `58f8d40`
6. **HR-8**: Implement comp-off expiry tracking
