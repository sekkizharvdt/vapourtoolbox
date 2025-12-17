# VDT-Unified Developer Notes

## Architecture Grade: 8.2/10

This document provides essential guidance for developers working on the VDT-Unified codebase. Understanding these patterns and constraints is critical for maintaining code quality and system integrity.

---

## Table of Contents

1. [Architecture Overview](#1-architecture-overview)
2. [Critical Patterns (Must Follow)](#2-critical-patterns-must-follow)
3. [Service Layer Guidelines](#3-service-layer-guidelines)
4. [Type Safety Requirements](#4-type-safety-requirements)
5. [Error Handling Standards](#5-error-handling-standards)
6. [Testing Requirements](#6-testing-requirements)
7. [Firestore Patterns](#7-firestore-patterns)
8. [State Management](#8-state-management)
9. [Common Pitfalls](#9-common-pitfalls)
10. [Code Review Checklist](#10-code-review-checklist)

---

## 1. Architecture Overview

### Strengths (What We Do Well)

| Area              | Grade  | Description                                              |
| ----------------- | ------ | -------------------------------------------------------- |
| Type Safety       | 9.2/10 | Comprehensive shared types, Result pattern, type helpers |
| Code Organization | 8.3/10 | 31 well-organized modules with barrel exports            |
| Error Handling    | 8.6/10 | Comprehensive utilities with retry logic                 |
| Service Patterns  | 8.4/10 | Clear CRUD/workflow/query separation                     |
| State Management  | 8.0/10 | TanStack Query with proper key organization              |

### Areas Needing Improvement

| Area               | Grade  | Action Required                    |
| ------------------ | ------ | ---------------------------------- |
| Test Coverage      | 6.8/10 | Currently 16.5% - target 50%+      |
| Query Optimization | 7.0/10 | Missing pagination in list queries |
| Documentation      | 7.0/10 | Missing ADRs and workflow diagrams |
| DI Pattern         | 6.0/10 | Firebase tightly coupled           |

---

## 2. Critical Patterns (Must Follow)

### 2.1 Financial Operations MUST Use Transactions

All financial operations that modify multiple documents MUST use Firestore transactions:

```typescript
// ✅ CORRECT - Use transactions for multi-document updates
import { withTransaction } from '@/lib/utils/transactionHelpers';

await withTransaction(db, async (transaction) => {
  const poDoc = await transaction.get(poRef);
  transaction.update(poRef, { status: 'APPROVED' });
  transaction.set(paymentRef, paymentData);
});

// ❌ WRONG - Separate writes can leave data inconsistent
await updateDoc(poRef, { status: 'APPROVED' });
await setDoc(paymentRef, paymentData); // If this fails, PO is approved but no payment
```

**Files using transactions:** `goodsReceiptService.ts`, `purchaseOrderService.ts`, `paymentHelpers.ts`

### 2.2 Double-Entry Bookkeeping Enforcement

All accounting transactions MUST use `saveTransaction()` which enforces balanced entries:

```typescript
// ✅ CORRECT - Uses enforceDoubleEntry validation
import { saveTransaction } from '@/lib/accounting/transactionService';

const billId = await saveTransaction(db, billData);

// ❌ WRONG - Direct addDoc bypasses validation
const billRef = await addDoc(collection(db, 'transactions'), billData);
```

### 2.3 Idempotency for Entity Creation

All entity creation that could be retried (network errors, double-clicks) MUST use idempotency:

```typescript
// ✅ CORRECT - Prevents duplicate creation
import { withIdempotency, generateIdempotencyKey } from '@/lib/utils/idempotencyService';

const key = generateIdempotencyKey('create-po', offerId, userId);
const poId = await withIdempotency(db, key, 'create-po', async () => {
  // ... creation logic
  return newPoId;
});

// ❌ WRONG - Can create duplicates on retry
const poRef = await addDoc(collection(db, 'purchaseOrders'), poData);
```

### 2.4 Authorization Checks in Services

Service functions MUST validate permissions - never trust the caller:

```typescript
// ✅ CORRECT - Service validates permissions
import { requirePermission, requireOwnerOrPermission } from '@/lib/auth/authorizationService';

export async function deleteDocument(id: string, userId: string, permissions: number) {
  const doc = await getDocumentById(id);
  requireOwnerOrPermission(userId, doc.uploadedBy, permissions, PermissionFlag.MANAGE_DOCUMENTS);
  // ... proceed with deletion
}

// ❌ WRONG - Assumes caller validated
export async function deleteDocument(id: string) {
  await deleteDoc(doc(db, 'documents', id));
}
```

### 2.5 State Machine Validation

Status transitions MUST be validated using state machines:

```typescript
// ✅ CORRECT - Validates transition is allowed
import { purchaseOrderStateMachine } from '@/lib/workflow/stateMachines';

const validation = purchaseOrderStateMachine.validateTransition(currentStatus, newStatus);
if (!validation.valid) {
  throw new Error(`Invalid transition: ${validation.reason}`);
}

// ❌ WRONG - Allows any status change
await updateDoc(poRef, { status: newStatus });
```

---

## 3. Service Layer Guidelines

### 3.1 File Organization Pattern

Large services should be split into focused files:

```
lib/procurement/amendment/
├── index.ts          # Barrel exports (public API)
├── crud.ts           # Create, Read, Update, Delete
├── queries.ts        # List queries, search, filters
├── workflow.ts       # Status transitions, approvals
├── helpers.ts        # Pure utility functions
├── types.ts          # Local types (if not in @vapour/types)
└── __tests__/        # Tests mirror structure
```

### 3.2 Function Naming Conventions

```typescript
// CRUD operations
createXxx(); // Create new entity
getXxxById(); // Get single entity
updateXxx(); // Update entity
deleteXxx(); // Soft delete (set isDeleted: true)
hardDeleteXxx(); // Permanent deletion (rare)

// Queries
listXxx(); // List with filters
searchXxx(); // Full-text search
queryXxx(); // Complex queries

// Workflow
approveXxx(); // Approval transition
rejectXxx(); // Rejection transition
submitXxx(); // Submit for approval
completeXxx(); // Mark as complete

// Helpers
calculateXxx(); // Pure calculation
formatXxx(); // Data formatting
validateXxx(); // Validation logic
generateXxxNumber(); // Sequence generation
```

### 3.3 Required Function Parameters

All service functions that modify data MUST accept:

```typescript
export async function updatePurchaseOrder(
  db: Firestore, // Database instance
  poId: string, // Entity ID
  updates: Partial<PO>, // Update data
  userId: string, // Actor performing action
  userPermissions: number, // For authorization check
  userName?: string // For audit trail
): Promise<void>;
```

---

## 4. Type Safety Requirements

### 4.1 Use Type Helpers for Firestore

```typescript
// ✅ CORRECT - Type-safe document conversion
import { docToTyped } from '@/lib/firebase/typeHelpers';

const po = docToTyped<PurchaseOrder>(doc.id, doc.data());

// ❌ WRONG - Unsafe type assertion
const po = doc.data() as PurchaseOrder;
```

### 4.2 Result Pattern for Fallible Operations

```typescript
// ✅ CORRECT - Explicit success/failure
import { Result, Success, Failure } from '@/lib/utils/errorHandling';

function validateInput(data: unknown): Result<ValidData, ValidationError> {
  if (!isValid(data)) {
    return { success: false, error: new ValidationError('Invalid') };
  }
  return { success: true, data: validated };
}

// Usage
const result = validateInput(input);
if (!result.success) {
  logger.error('Validation failed', { error: result.error });
  return;
}
// result.data is now typed as ValidData
```

### 4.3 Exhaustive Switch Statements

```typescript
// ✅ CORRECT - TypeScript ensures all cases handled
function getStatusColor(status: POStatus): string {
  switch (status) {
    case 'DRAFT':
      return 'gray';
    case 'PENDING_APPROVAL':
      return 'yellow';
    case 'APPROVED':
      return 'green';
    case 'REJECTED':
      return 'red';
    case 'ISSUED':
      return 'blue';
    case 'COMPLETED':
      return 'green';
    case 'CANCELLED':
      return 'gray';
    default:
      const _exhaustive: never = status;
      throw new Error(`Unhandled status: ${_exhaustive}`);
  }
}
```

---

## 5. Error Handling Standards

### 5.1 Use withErrorHandling Wrapper

```typescript
import { withErrorHandling, withRetry } from '@/lib/utils/errorHandling';

// For operations that might fail
const result = await withErrorHandling(async () => await fetchData(), {
  context: 'fetchData',
  rethrow: false,
});

// For operations that should retry
const data = await withRetry(async () => await unreliableApiCall(), {
  maxAttempts: 3,
  delayMs: 1000,
  backoffMultiplier: 2,
});
```

### 5.2 Logging Standards

```typescript
import { createLogger } from '@vapour/logger';

const logger = createLogger({ context: 'purchaseOrderService' });

// INFO: Successful operations
logger.info('PO created', { poId, vendorId, amount });

// WARN: Recoverable issues
logger.warn('Retry needed', { attempt: 2, error: err.message });

// ERROR: Failures requiring attention
logger.error('PO creation failed', { error, input, userId });

// Include correlation ID for tracing
import { withNewCorrelationId } from '@vapour/logger';
await withNewCorrelationId(async () => {
  // All logs in this block share same correlation ID
  logger.info('Starting workflow...');
});
```

### 5.3 Error Classes

```typescript
// Use specific error classes
import { AuthorizationError } from '@/lib/auth/authorizationService';
import { UnbalancedEntriesError } from '@/lib/accounting/transactionService';

// Catch and handle appropriately
try {
  await approveTransaction(id, userId, permissions);
} catch (error) {
  if (error instanceof AuthorizationError) {
    // Handle permission denied
  } else if (error instanceof UnbalancedEntriesError) {
    // Handle accounting error
  } else {
    // Unexpected error
    throw error;
  }
}
```

---

## 6. Testing Requirements

### 6.1 Minimum Test Coverage

| Category           | Required Coverage |
| ------------------ | ----------------- |
| Financial services | 80%+              |
| Workflow services  | 70%+              |
| CRUD services      | 50%+              |
| Utility functions  | 90%+              |
| Hooks              | 60%+              |

### 6.2 Test File Location

```
lib/procurement/purchaseOrderService.ts
lib/procurement/purchaseOrderService.test.ts  # Co-located

# OR in __tests__ folder for larger test suites
lib/procurement/__tests__/purchaseOrder.test.ts
```

### 6.3 Test Structure

```typescript
describe('purchaseOrderService', () => {
  describe('createPO', () => {
    it('should create PO with valid data', async () => {});
    it('should fail without required fields', async () => {});
    it('should enforce idempotency', async () => {});
  });

  describe('approvePO', () => {
    it('should transition PENDING_APPROVAL to APPROVED', async () => {});
    it('should reject invalid transitions', async () => {});
    it('should prevent self-approval', async () => {});
    it('should require APPROVE_PO permission', async () => {});
  });
});
```

---

## 7. Firestore Patterns

### 7.1 Collection References

```typescript
// ✅ CORRECT - Use centralized collection names
import { COLLECTIONS } from '@vapour/firebase';

const poRef = doc(db, COLLECTIONS.PURCHASE_ORDERS, poId);

// ❌ WRONG - Hardcoded strings
const poRef = doc(db, 'purchaseOrders', poId);
```

### 7.2 Composite Index Requirements

Document required indexes in service files:

```typescript
/**
 * List purchase orders with filters
 *
 * **Required Firestore Composite Indexes:**
 * - purchaseOrders: (projectId ASC, status ASC, createdAt DESC)
 * - purchaseOrders: (vendorId ASC, status ASC, createdAt DESC)
 */
export async function listPurchaseOrders(filters: POFilters) {
  // ...
}
```

### 7.3 Soft Deletes

Always use soft deletes for business data:

```typescript
// ✅ CORRECT - Soft delete preserves audit trail
await updateDoc(poRef, {
  isDeleted: true,
  deletedAt: Timestamp.now(),
  deletedBy: userId,
});

// ❌ WRONG - Hard delete loses data
await deleteDoc(poRef);
```

### 7.4 Timestamp Handling

```typescript
// ✅ CORRECT - Use timezone utilities
import { getStartOfDay, createTimestampFromDateString } from '@/lib/utils/dateTime';

const startOfToday = getStartOfDay(new Date(), 'Asia/Kolkata');
const timestamp = createTimestampFromDateString('2024-01-15', 'Asia/Kolkata');

// ❌ WRONG - Timezone issues
const today = new Date();
today.setHours(0, 0, 0, 0); // Uses local timezone, inconsistent
```

---

## 8. State Management

### 8.1 Query Key Structure

```typescript
// Define keys in queryKeys files
export const purchaseOrderKeys = {
  all: ['purchaseOrders'] as const,
  lists: () => [...purchaseOrderKeys.all, 'list'] as const,
  list: (filters: POFilters) => [...purchaseOrderKeys.lists(), filters] as const,
  details: () => [...purchaseOrderKeys.all, 'detail'] as const,
  detail: (id: string) => [...purchaseOrderKeys.details(), id] as const,
};

// Usage in hooks
const { data } = useQuery({
  queryKey: purchaseOrderKeys.detail(poId),
  queryFn: () => getPurchaseOrderById(db, poId),
});
```

### 8.2 Mutation Invalidation

```typescript
const mutation = useMutation({
  mutationFn: (data) => createPurchaseOrder(db, data),
  onSuccess: () => {
    // Invalidate list queries
    queryClient.invalidateQueries({ queryKey: purchaseOrderKeys.lists() });
  },
});
```

---

## 9. Common Pitfalls

### 9.1 Race Conditions in Approvals

```typescript
// ❌ WRONG - Race condition possible
const po = await getPOById(poId);
if (po.status === 'PENDING_APPROVAL') {
  await updateDoc(poRef, { status: 'APPROVED' });
}

// ✅ CORRECT - Use transaction with read
await runTransaction(db, async (transaction) => {
  const poDoc = await transaction.get(poRef);
  if (poDoc.data()?.status !== 'PENDING_APPROVAL') {
    throw new Error('PO is not pending approval');
  }
  transaction.update(poRef, { status: 'APPROVED' });
});
```

### 9.2 Missing Error Boundaries

```typescript
// ✅ CORRECT - Wrap async operations
try {
  await submitDocument(db, storage, request);
} catch (error) {
  // Error recovery already handled in submitDocument
  // Just show user-friendly message
  toast.error('Failed to submit document. Please try again.');
}
```

### 9.3 Forgetting Audit Logs

```typescript
// ✅ CORRECT - Include audit logging
import { logAuditEvent } from '@/lib/audit/clientAuditService';

await logAuditEvent(
  db,
  auditContext,
  'PO_APPROVED',
  'PURCHASE_ORDER',
  poId,
  `Approved PO ${poNumber} for ${formatCurrency(amount)}`,
  { previousStatus: 'PENDING_APPROVAL', newStatus: 'APPROVED' }
);
```

### 9.4 Client-Side Filtering Large Datasets

```typescript
// ❌ WRONG - Fetches all then filters
const allPOs = await listAllPOs();
const filtered = allPOs.filter((po) => po.status === 'APPROVED');

// ✅ CORRECT - Filter in query
const q = query(
  collection(db, COLLECTIONS.PURCHASE_ORDERS),
  where('status', '==', 'APPROVED'),
  orderBy('createdAt', 'desc'),
  limit(50)
);
```

---

## 10. Code Review Checklist

Before approving any PR, verify:

### Security

- [ ] Authorization checks present in service functions
- [ ] No permission bypasses
- [ ] Sensitive data not logged
- [ ] User input validated

### Data Integrity

- [ ] Multi-document operations use transactions
- [ ] Financial operations use enforceDoubleEntry
- [ ] Entity creation uses idempotency where needed
- [ ] State transitions validated by state machine

### Code Quality

- [ ] Types properly defined (no `any`)
- [ ] Error handling with proper logging
- [ ] Correlation IDs used for traceability
- [ ] Consistent naming conventions

### Testing

- [ ] New functionality has tests
- [ ] Edge cases covered
- [ ] Error paths tested

### Performance

- [ ] No N+1 query patterns
- [ ] Pagination for list queries
- [ ] Indexes documented for new queries

---

## Quick Reference

### Key Imports

```typescript
// Transactions & Safety
import { withTransaction } from '@/lib/utils/transactionHelpers';
import { saveTransaction, enforceDoubleEntry } from '@/lib/accounting/transactionService';
import { withIdempotency, generateIdempotencyKey } from '@/lib/utils/idempotencyService';

// Authorization
import { requirePermission, requireOwnerOrPermission } from '@/lib/auth/authorizationService';
import { PermissionFlag } from '@vapour/constants';

// State Machines
import { purchaseOrderStateMachine, proposalStateMachine } from '@/lib/workflow/stateMachines';

// Error Handling
import { withErrorHandling, withRetry } from '@/lib/utils/errorHandling';
import { createLogger, withNewCorrelationId } from '@vapour/logger';

// Date/Time
import { getStartOfDay, getFiscalYear, DEFAULT_TIMEZONE } from '@/lib/utils/dateTime';

// Firestore
import { COLLECTIONS } from '@vapour/firebase';
import { docToTyped } from '@/lib/firebase/typeHelpers';
```

### File Locations

| Utility             | Location                                        |
| ------------------- | ----------------------------------------------- |
| Transaction helpers | `apps/web/src/lib/utils/transactionHelpers.ts`  |
| Authorization       | `apps/web/src/lib/auth/authorizationService.ts` |
| State machines      | `apps/web/src/lib/workflow/stateMachines.ts`    |
| Error handling      | `apps/web/src/lib/utils/errorHandling.ts`       |
| Date utilities      | `apps/web/src/lib/utils/dateTime.ts`            |
| Idempotency         | `apps/web/src/lib/utils/idempotencyService.ts`  |
| Audit logging       | `apps/web/src/lib/audit/clientAuditService.ts`  |
| Type helpers        | `apps/web/src/lib/firebase/typeHelpers.ts`      |

---

## Version History

| Date       | Version | Changes                                                |
| ---------- | ------- | ------------------------------------------------------ |
| 2025-12-17 | 1.0     | Initial developer notes after architecture remediation |

---

_Last updated: December 2025_
_Architecture Grade: 8.2/10_
