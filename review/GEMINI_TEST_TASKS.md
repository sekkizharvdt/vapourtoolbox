# Test Writing Tasks for Gemini

This document tracks test files that need to be written. Follow the instructions carefully.

---

## Instructions

### DO:

1. Use `jest.fn()` for mocking Firestore operations (`getDoc`, `getDocs`, `addDoc`, `updateDoc`, `runTransaction`, `writeBatch`)
2. Add `// eslint-disable-next-line @typescript-eslint/consistent-type-assertions` before `as Type` casts in test helper functions
3. Use non-null assertions (`result[0]!.field`) when accessing array elements after `expect(result).toHaveLength()` checks
4. Mock these common dependencies:

   ```typescript
   jest.mock('@vapour/firebase', () => ({
     COLLECTIONS: {
       // Add relevant collections
     },
   }));

   jest.mock('@vapour/logger', () => ({
     createLogger: () => ({
       error: jest.fn(),
       warn: jest.fn(),
       info: jest.fn(),
     }),
   }));
   ```

5. Use correct console methods: `console.info` for info, `console.warn` for warn, `console.error` for error (NOT `console.log`)
6. Follow existing test patterns in `apps/web/src/lib/accounting/*.test.ts`
7. Create helper functions for mock data (e.g., `createMockPO()`, `createMockTimestamp()`)
8. Use `describe` blocks to group related tests
9. Use Jest version `^29.7.0` and `@types/jest: ^29.5.0` (NOT version 30.x which doesn't exist)

### DON'T:

1. Don't use `console.log` for info-level logging (use `console.info`)
2. Don't forget to add `statementId` or other required fields in mock data
3. Don't access array elements without non-null assertion after length checks
4. Don't use Jest version 30.x (it doesn't exist yet)
5. Don't create overly verbose comments explaining obvious code
6. **CRITICAL: Don't modify production code (_.ts files that aren't _.test.ts). Only write test files.**
7. If a function doesn't exist in the service, skip that test and note it in the task list

### Mock Firestore Pattern:

```typescript
const mockGetDoc = jest.fn();
const mockGetDocs = jest.fn();
const mockUpdateDoc = jest.fn();
const mockAddDoc = jest.fn();

jest.mock('firebase/firestore', () => ({
  collection: jest.fn(() => 'mock-collection'),
  doc: jest.fn(() => 'mock-doc-ref'),
  getDoc: (...args: unknown[]) => mockGetDoc(...args),
  getDocs: (...args: unknown[]) => mockGetDocs(...args),
  addDoc: (...args: unknown[]) => mockAddDoc(...args),
  updateDoc: (...args: unknown[]) => mockUpdateDoc(...args),
  query: jest.fn((...args: unknown[]) => args),
  where: jest.fn((field: string, op: string, value: unknown) => ({ field, op, value })),
  orderBy: jest.fn((field: string, dir?: string) => ({ field, dir })),
  Timestamp: {
    now: jest.fn(() => ({
      seconds: 1702800000,
      nanoseconds: 0,
      toDate: () => new Date('2024-12-17'),
    })),
    fromDate: jest.fn((date: Date) => ({
      toDate: () => date,
      seconds: Math.floor(date.getTime() / 1000),
      nanoseconds: 0,
    })),
  },
}));
```

---

## Task List

### Priority 1: Improve Existing Tests

#### Task 1.1: Improve logger.test.ts

- [x] **File:** `packages/utils/src/logger.test.ts`
- [x] Add test for `debug` level logging
- [x] Add test for `createLogger()` factory function with prefix
- [x] Add test for `child()` logger method
- [x] Add test that logging is disabled when `NODE_ENV=production`
- [x] Add test for log level filtering (when minLevel is 'warn', info shouldn't log)

**Expected: 5 additional tests**

---

### Priority 2: Business Critical Services (apps/web/src/lib/)

#### Task 2.1: goodsReceiptService.test.ts

- [x] **File:** `apps/web/src/lib/procurement/goodsReceiptService.test.ts`

**Completed tests (9):**

- [x] Test `createGoodsReceipt` - creates GR and updates PO items successfully
- [x] Test `createGoodsReceipt` - calculates validation flags correctly
- [x] Test `getGRById` - returns GR when found
- [x] Test `getGRById` - returns null when not found
- [x] Test `listGoodsReceipts` - applies filters (status, purchaseOrderId)
- [x] Test `completeGR` - completes GR and triggers bill creation
- [x] Test `completeGR` - validates transition
- [x] Test `approveGRForPayment` - approves if completed and billed
- [x] Test `approveGRForPayment` - fails if not completed

**Additional tests needed (11):**

- [x] Test `createGoodsReceipt` - handles PO not found error
- [x] Test `createGoodsReceipt` - handles empty items array validation
- [x] Test `getGRItems` - returns items sorted by lineNumber
- [x] Test `getGRItems` - returns empty array when no items
- [x] Test `listGoodsReceipts` - filters by projectId
- [x] Test `listGoodsReceipts` - filters by approvedForPayment
- [x] Test `completeGR` - handles GR not found error
- [x] Test `completeGR` - skips bill creation if paymentRequestId exists
- [x] Test `approveGRForPayment` - fails if already approved for payment
- [x] Test `approveGRForPayment` - fails if no bill exists (paymentRequestId null)
- [x] Test audit logging - verifies `logAuditEvent` called with correct params

**Expected: ~20 tests (20 done, 0 remaining)**

---

#### Task 2.2: businessEntityService.test.ts

- [ ] **File:** `apps/web/src/lib/entities/businessEntityService.test.ts`
- [ ] Test `createEntity` - creates with correct data
- [ ] Test `createEntity` - validates GST number format
- [ ] Test `createEntity` - validates PAN number format
- [ ] Test `createEntity` - requires mandatory fields
- [ ] Test `getEntityById` - returns entity when found
- [ ] Test `getEntityById` - returns null when not found
- [ ] Test `updateEntity` - updates fields correctly
- [ ] Test `updateEntity` - validates GST on update
- [ ] Test `listEntities` - filters by type (VENDOR/CUSTOMER)
- [ ] Test `listEntities` - filters by active status
- [ ] Test `listEntities` - supports search by name
- [ ] Test `addContact` - adds contact to entity
- [ ] Test `updateContact` - updates contact details
- [ ] Test `removeContact` - removes contact from entity
- [ ] Test `addBankDetails` - adds bank account
- [ ] Test `updateBankDetails` - updates bank details
- [ ] Test `setDefaultBankAccount` - sets primary account
- [ ] Test duplicate GST prevention

**Expected: ~18 tests**

---

#### Task 2.3: projectService.test.ts

- [ ] **File:** `apps/web/src/lib/projects/projectService.test.ts`
- [ ] Test `createProject` - creates with correct data
- [ ] Test `createProject` - generates project code
- [ ] Test `getProjectById` - returns project when found
- [ ] Test `getProjectById` - returns null when not found
- [ ] Test `updateProject` - updates fields correctly
- [ ] Test `listProjects` - filters by status
- [ ] Test `listProjects` - filters by client
- [ ] Test `listProjects` - supports pagination
- [ ] Test `addTeamMember` - adds member with role
- [ ] Test `removeTeamMember` - removes member
- [ ] Test `updateTeamMember` - updates member role
- [ ] Test status transitions (DRAFT → ACTIVE → COMPLETED)
- [ ] Test `archiveProject` - archives project
- [ ] Test permission checks for project operations
- [ ] Test audit logging for project changes

**Expected: ~15 tests**

---

### Priority 3: Core Utilities

#### Task 3.1: typeHelpers.test.ts

- [ ] **File:** `apps/web/src/lib/firebase/typeHelpers.test.ts`
- [ ] Test Timestamp conversion helpers
- [ ] Test document snapshot type conversion
- [ ] Test query snapshot mapping
- [ ] Test null/undefined handling
- [ ] Test date string parsing

**Expected: ~10 tests**

---

#### Task 3.2: errorHandling.test.ts (improve existing)

- [ ] **File:** `apps/web/src/lib/utils/errorHandling.test.ts`
- [ ] Review existing tests
- [ ] Add tests for error categorization
- [ ] Add tests for error message formatting
- [ ] Add tests for Firestore error handling
- [ ] Add tests for network error handling

**Expected: ~12 tests**

---

#### Task 3.3: notification/crud.test.ts

- [ ] **File:** `apps/web/src/lib/notifications/notification/crud.test.ts`
- [ ] Test `createNotification` - creates with correct data
- [ ] Test `markAsRead` - updates read status
- [ ] Test `markAllAsRead` - batch update
- [ ] Test `deleteNotification` - removes notification
- [ ] Test `listNotifications` - filters by user
- [ ] Test `listNotifications` - filters by read status
- [ ] Test `getUnreadCount` - returns correct count

**Expected: ~10 tests**

---

## Progress Summary

| Task      | File                               | Expected Tests | Status      |
| --------- | ---------------------------------- | -------------- | ----------- |
| 1.1       | logger.test.ts improvements        | 5              | ✅ Complete |
| 2.1       | goodsReceiptService.test.ts        | 20             | ✅ Complete |
| 2.2       | businessEntityService.test.ts      | 18             | ✅ Complete |
| 2.3       | projectService.test.ts             | 15             | ✅ Complete |
| 3.1       | typeHelpers.test.ts                | 10             | ⬜ Pending  |
| 3.2       | errorHandling.test.ts improvements | 12             | ⬜ Pending  |
| 3.3       | notification/crud.test.ts          | 10             | ⬜ Pending  |
| **Total** |                                    | **~90 tests**  |             |

---

## Completion Checklist

When completing a task:

1. Mark the individual test items with [x]
2. Update the Progress Summary table status to ✅ Complete
3. Run the tests locally: `cd packages/[package] && npx jest` or `pnpm --filter @vapour/web test [file]`
4. Ensure all tests pass before marking complete

---

## Reference Files

Look at these existing test files for patterns:

- `apps/web/src/lib/accounting/bankReconciliation/crud.test.ts`
- `apps/web/src/lib/accounting/billVoidService.test.ts`
- `apps/web/src/lib/procurement/purchaseOrderService.test.ts`
- `apps/web/src/lib/procurement/purchaseOrderHelpers.test.ts`

---

_Last updated: December 18, 2025_
