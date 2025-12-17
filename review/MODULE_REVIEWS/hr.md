# HR Module Critical Review

## Module Overview

| Metric        | Value                                            |
| ------------- | ------------------------------------------------ |
| Files         | 7                                                |
| Lines of Code | 1,652                                            |
| Features      | Leave Management (requests, balances, approvals) |
| Test Coverage | ~10% (2 test files exist)                        |

---

## 1. Current Scope

The HR module is focused solely on **Leave Management**:

- Leave type configuration
- Leave balance tracking per fiscal year
- Leave request workflow (Draft → Submit → Approve/Reject)
- Balance calculations (entitled, used, pending, available)

**Missing HR Features** (scope for expansion):

- Employee master data
- Attendance tracking
- Payroll integration
- Performance management
- Recruitment

---

## 2. Architecture Assessment

### 2.1 Strengths

1. **Clear Service Separation**:
   - `leaveTypeService.ts` - Leave type CRUD
   - `leaveBalanceService.ts` - Balance tracking
   - `leaveRequestService.ts` - Request CRUD
   - `leaveApprovalService.ts` - Workflow operations

2. **Proper Balance Accounting**:

   ```typescript
   // Correct formula
   const newAvailable = entitled + carryForward - newUsed - newPending;
   ```

3. **Authorization Checks**:

   ```typescript
   if (request.userId !== userId) {
     throw new Error('You can only submit your own leave requests');
   }
   if (!request.approverIds.includes(approverId)) {
     throw new Error('You are not authorized to approve this request');
   }
   ```

4. **Fiscal Year Awareness**: Balance tracking respects fiscal year boundaries.

5. **Weekend Exclusion**: Leave day calculation correctly excludes weekends.

### 2.2 Critical Issues

#### Issue 1: Leave Request Number Generation Not Atomic

**Location**: [leaveRequestService.ts:93-122](apps/web/src/lib/hr/leaves/leaveRequestService.ts#L93-L122)

```typescript
async function generateLeaveRequestNumber(): Promise<string> {
  const counterDoc = await getDoc(counterRef);
  let sequence = 1;

  if (counterDoc.exists()) {
    sequence = (counterDoc.data()?.value || 0) + 1;
  }

  // Not in a transaction! Race condition possible
  await setDoc(counterRef, { value: sequence, updatedAt: Timestamp.now() });

  return `LR-${yearStr}-${sequence.toString().padStart(4, '0')}`;
}
```

**Problem**: Two simultaneous requests can get the same number.

**Recommended Fix**:

```typescript
const requestNumber = await runTransaction(db, async (transaction) => {
  const counterDoc = await transaction.get(counterRef);
  const sequence = (counterDoc.data()?.value || 0) + 1;
  transaction.set(counterRef, { value: sequence, updatedAt: Timestamp.now() });
  return `LR-${yearStr}-${sequence.toString().padStart(4, '0')}`;
});
```

---

#### Issue 2: Balance Update Not Atomic with Approval

**Location**: [leaveApprovalService.ts:223-241](apps/web/src/lib/hr/leaves/leaveApprovalService.ts#L223-L241)

```typescript
export async function approveLeaveRequest(...) {
  // First update request status
  await updateDoc(docRef, { status: 'APPROVED', /* ... */ });

  // Then update balance - separate operation!
  await confirmPendingLeave(/* ... */);
}
```

**Problem**: If balance update fails, request is approved but balance is wrong.

**At Scale Risk**: HIGH - Incorrect leave balances, employees taking more leave than entitled.

---

#### Issue 3: No Overlap Detection

**Location**: [leaveRequestService.ts:134-225](apps/web/src/lib/hr/leaves/leaveRequestService.ts#L134-L225)

```typescript
export async function createLeaveRequest(input, userId, userName, userEmail) {
  // No check for overlapping leave requests!
  // User could request leave for dates already approved
}
```

**Problem**: User can submit multiple requests for same dates.

---

#### Issue 4: Hardcoded Default Approvers

**Location**: [leaveApprovalService.ts:32-33](apps/web/src/lib/hr/leaves/leaveApprovalService.ts#L32-L33)

```typescript
const DEFAULT_LEAVE_APPROVERS = ['revathi@vapourdesal.com', 'sekkizhar@vapourdesal.com'];
```

**Problem**: Hardcoded emails in source code.

---

#### Issue 5: No Carry-Forward Logic Implementation

**Location**: [leaveBalanceService.ts:173-188](apps/web/src/lib/hr/leaves/leaveBalanceService.ts#L173-L188)

```typescript
const balanceData: Omit<LeaveBalance, 'id'> = {
  entitled: leaveType.annualQuota,
  carryForward: 0, // Always 0 - no carry-forward logic
};
```

**Problem**: No year-end process to carry forward unused leave.

---

#### Issue 6: Task Notifications Not Implemented

**Location**: [leaveApprovalService.ts](apps/web/src/lib/hr/leaves/leaveApprovalService.ts)

Multiple TODO comments:

```typescript
// TODO: Integrate task notifications once the flow module is ready
// TODO: Create task notifications for approvers once flow module is ready
// TODO: Complete all approver task notifications once flow module is ready
```

**Status**: Approval workflow doesn't send notifications.

---

#### Issue 7: No Half-Day Afternoon/Morning Handling in Calendar

**Problem**: `getTeamCalendar` doesn't return half-day type, making calendar display incomplete.

---

## 3. Workflow Gaps

### 3.1 Missing Features

| Feature                      | Status          | Impact                    |
| ---------------------------- | --------------- | ------------------------- |
| Overlapping leave detection  | Missing         | Data integrity            |
| Carry-forward process        | Missing         | Year-end failure          |
| Leave encashment             | Missing         | Employee request          |
| Holiday calendar integration | Missing         | Incorrect day calculation |
| Substitute approver          | Missing         | Blocked approvals         |
| Approval escalation          | Missing         | Stale requests            |
| Audit trail                  | Basic           | Compliance                |
| Notification integration     | Missing (TODOs) | User experience           |

### 3.2 Status Transition Issues

Current valid transitions:

```
DRAFT → PENDING_APPROVAL → APPROVED
                        → REJECTED
DRAFT → CANCELLED
PENDING_APPROVAL → CANCELLED
```

**Missing transitions**:

- `APPROVED → CANCELLED` (post-approval cancellation)
- Partial cancellation (cancel some days)

---

## 4. Data Model Concerns

### 4.1 Denormalization

```typescript
// Leave request stores user info
const requestData = {
  userId,
  userName, // Denormalized
  userEmail, // Denormalized
  leaveTypeName, // Denormalized
  approvedByName, // Denormalized
};
```

**Issue**: If user name changes, historical requests show old name.

### 4.2 Missing Relationships

| Parent    | Child        | Issue             |
| --------- | ------------ | ----------------- |
| User      | LeaveBalance | No FK enforcement |
| LeaveType | LeaveBalance | No FK enforcement |
| LeaveType | LeaveRequest | No FK enforcement |

---

## 5. Calculation Concerns

### 5.1 Weekend Exclusion Hardcoded

```typescript
export function calculateLeaveDays(...): number {
  // 0 = Sunday, 6 = Saturday
  if (!excludeWeekends || (dayOfWeek !== 0 && dayOfWeek !== 6)) {
    days++;
  }
}
```

**Issue**: Doesn't handle:

- Company holidays
- Different weekend patterns (some countries have Fri-Sat weekends)
- Regional holidays

### 5.2 Fiscal Year Assumption

```typescript
export function getCurrentFiscalYear(): number {
  return new Date().getFullYear(); // Jan-Dec assumed
}
```

**Issue**: Many companies use Apr-Mar fiscal year in India.

---

## 6. Performance Concerns

### 6.1 N+1 Query in Approver Lookup

```typescript
async function getApproverUserIds(): Promise<string[]> {
  const approverEmails = await getLeaveApproverEmails();

  // For each email, makes a separate query
  for (const email of approverEmails) {
    const q = query(collection(db, COLLECTIONS.USERS), where('email', '==', email));
    const snapshot = await getDocs(q);
  }
}
```

**Better Approach**: Use `in` query for multiple emails.

### 6.2 Team Balance Batching Is Good

```typescript
// Correctly handles Firestore 30-item limit
for (let i = 0; i < userIds.length; i += batchSize) {
  const batchUserIds = userIds.slice(i, i + batchSize);
  // Query with 'in'
}
```

---

## 7. Security Concerns

### 7.1 Authorization Implemented (Good)

```typescript
if (request.userId !== userId) {
  throw new Error('You can only submit your own leave requests');
}
```

### 7.2 Missing Role Checks

- No admin override capability
- No HR role validation for balance adjustments
- No audit for balance modifications

---

## 8. Recommendations

### 8.1 Critical (Must Fix)

1. **Atomic Number Generation**
   - Use `runTransaction` for leave request numbers
   - Prevent duplicates

2. **Atomic Balance Updates**
   - Wrap approval + balance update in transaction
   - Prevent inconsistent state

3. **Overlap Detection**
   - Query existing approved/pending requests for date range
   - Reject overlapping requests

### 8.2 High Priority

4. **Implement Carry-Forward**
   - Year-end job to calculate carry-forward
   - Respect leave type carry-forward limits

5. **Notification Integration**
   - Complete TODO items
   - Integrate with task notification service

6. **Holiday Calendar**
   - Separate holiday collection
   - Integrate with day calculation

### 8.3 Medium Priority

7. **Configurable Fiscal Year**
   - Move fiscal year config to company settings
   - Support Apr-Mar fiscal year

8. **Approval Escalation**
   - Auto-escalate after X days
   - Substitute approver configuration

9. **Leave Encashment**
   - Encashment request workflow
   - Integration with payroll

---

## 9. Enterprise Readiness Score

| Dimension             | Score      | Notes                 |
| --------------------- | ---------- | --------------------- |
| Data Integrity        | 5/10       | Non-atomic operations |
| Workflow Completeness | 5/10       | Missing features      |
| Authorization         | 7/10       | Basic checks present  |
| Performance           | 6/10       | Some N+1 patterns     |
| Audit Trail           | 4/10       | Basic history         |
| Configuration         | 4/10       | Hardcoded values      |
| **Overall**           | **5.2/10** | Needs work            |

---

## 10. Test Requirements

| Area                  | Required Tests | Priority |
| --------------------- | -------------- | -------- |
| Leave day calculation | 15             | HIGH     |
| Balance operations    | 20             | CRITICAL |
| Overlap detection     | 10             | HIGH     |
| Approval workflow     | 25             | CRITICAL |
| Carry-forward         | 10             | MEDIUM   |
| Authorization         | 15             | HIGH     |
| **Total**             | **95**         | -        |

---

## 11. Estimated Remediation Effort

| Task                     | Effort (days) |
| ------------------------ | ------------- |
| Atomic operations        | 2             |
| Overlap detection        | 1             |
| Carry-forward process    | 2             |
| Notification integration | 2             |
| Holiday calendar         | 2             |
| Approval escalation      | 2             |
| Leave encashment         | 3             |
| **Total**                | **14 days**   |
