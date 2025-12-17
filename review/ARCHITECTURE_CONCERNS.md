# Architecture Concerns - Fundamental Issues Analysis

## Executive Summary

This document identifies fundamental architectural issues in the Vapour Toolbox codebase that could lead to data corruption, financial discrepancies, security vulnerabilities, or system failures at scale. These are not minor bugs but systemic patterns that need addressing for enterprise reliability.

---

## 1. CRITICAL: Transaction Safety

### 1.1 The Core Problem

**Financial data requires ACID transactions. The codebase does not use them consistently.**

Most multi-step operations are implemented as separate Firestore operations without transaction wrappers:

```typescript
// DANGEROUS PATTERN (Found in 15+ files)
await updateDoc(docRef1, { status: 'APPROVED' }); // Step 1 - succeeds
await updateDoc(docRef2, { balance: newBalance }); // Step 2 - fails!
// Now doc1 is APPROVED but balance is wrong
```

### 1.2 Affected Operations

| Operation                | Steps | Risk if Partial Failure               |
| ------------------------ | ----- | ------------------------------------- |
| Approve Purchase Request | 2     | PR approved, budget not deducted      |
| Approve Three-Way Match  | 3     | Match approved, bill not created      |
| Create Purchase Order    | 4     | PO created, items missing             |
| Approve Leave Request    | 2     | Leave approved, balance not updated   |
| Submit Document          | 5     | Files uploaded, records missing       |
| Create Transaction       | 3     | Transaction saved, GL entries missing |

### 1.3 Real-World Failure Scenarios

**Scenario 1: Network Glitch During PO Approval**

1. Manager clicks "Approve"
2. PO status updated to APPROVED (succeeds)
3. Network disconnects
4. Advance payment creation fails
5. Result: PO shows approved, vendor expects advance, payment never created

**Scenario 2: Concurrent Bank Reconciliation**

1. User A auto-matches transaction X
2. User B auto-matches same transaction X
3. Both succeed
4. Transaction X is double-matched

### 1.4 Required Fix

Wrap all multi-step operations in Firestore transactions:

```typescript
await runTransaction(db, async (transaction) => {
  // All operations are atomic
  const matchDoc = await transaction.get(matchRef);
  transaction.update(matchRef, { status: 'APPROVED' });
  transaction.set(billRef, billData);
  transaction.update(poRef, { matchedBillId: billRef.id });
});
```

---

## 2. CRITICAL: Double-Entry Accounting Not Enforced

### 2.1 The Core Problem

**The accounting module generates balanced entries but doesn't enforce balance on save.**

```typescript
// Current: Generates entries but trusts caller to save correctly
export function generateInvoiceLedgerEntries(...): LedgerEntry[] {
  // Creates balanced entries
  return entries; // Caller could modify before saving!
}
```

### 2.2 What Could Go Wrong

1. **Programmer Error**: Caller adds entry manually after generation
2. **Partial Save**: Some entries saved, others fail
3. **Direct Manipulation**: Someone uses Firestore console to edit
4. **Import Errors**: Bulk import creates unbalanced entries

### 2.3 Required Fix

Enforce balance check at the database layer:

```typescript
async function saveTransaction(transaction: Transaction, entries: LedgerEntry[]) {
  // Validate balance BEFORE saving
  const totalDebit = entries.reduce((sum, e) => sum + e.debit, 0);
  const totalCredit = entries.reduce((sum, e) => sum + e.credit, 0);

  if (Math.abs(totalDebit - totalCredit) > 0.01) {
    throw new Error('Entries do not balance: ' + `Debit ${totalDebit} != Credit ${totalCredit}`);
  }

  // Use Firestore transaction to save atomically
  await runTransaction(db, async (txn) => {
    txn.set(transactionRef, transaction);
    entries.forEach((entry, i) => {
      txn.set(doc(collection(db, 'ledgerEntries')), entry);
    });
  });
}
```

---

## 3. CRITICAL: No Idempotency Protection

### 3.1 The Core Problem

**Operations can be duplicated by network retries or double-clicks.**

```typescript
// Current: No idempotency key
export async function createPOFromOffer(offerId, terms, userId, userName) {
  // If this times out but succeeds, retry creates duplicate PO!
  const poNumber = await generatePONumber();
  const poRef = await addDoc(collection(db, COLLECTIONS.PURCHASE_ORDERS), poData);
}
```

### 3.2 Duplicate Creation Vectors

| Vector         | Example                        | Consequence       |
| -------------- | ------------------------------ | ----------------- |
| Double-click   | User clicks "Create" twice     | 2 POs             |
| Network retry  | Slow response, browser retries | 2 GRNs            |
| Webhook replay | Payment callback retried       | Double credit     |
| Bulk import    | Import run twice               | Duplicate records |

### 3.3 Required Fix

Implement idempotency keys:

```typescript
async function createPOFromOffer(offerId, terms, userId, idempotencyKey) {
  // Check if already processed
  const existing = await getDoc(doc(db, 'idempotencyKeys', idempotencyKey));
  if (existing.exists()) {
    return existing.data().result; // Return cached result
  }

  // Create PO
  const poId = await actuallyCreatePO(...);

  // Store idempotency key (with TTL)
  await setDoc(doc(db, 'idempotencyKeys', idempotencyKey), {
    result: poId,
    createdAt: Timestamp.now(),
    expiresAt: Timestamp.fromMillis(Date.now() + 24 * 60 * 60 * 1000)
  });

  return poId;
}
```

---

## 4. HIGH: Authorization Not Enforced in Service Layer

### 4.1 The Core Problem

**Security rules are not enforced in the service layer. Anyone with database access can bypass them.**

```typescript
// Current: No authorization check
export async function approvePO(poId, userId, userName, comments?) {
  // No check that userId is the designated approver!
  // No check that userId has approval role!
  await updateDoc(doc(db, COLLECTIONS.PURCHASE_ORDERS, poId), {
    status: 'APPROVED', // Anyone can approve anything
  });
}
```

### 4.2 Attack Vectors

1. **Privilege Escalation**: Regular user approves their own PR
2. **Data Manipulation**: User modifies another user's leave balance
3. **Financial Fraud**: User approves their own vendor payments
4. **Audit Trail Manipulation**: User marks their own errors as "resolved"

### 4.3 Required Fix

Implement service-layer authorization:

```typescript
async function approvePO(poId, actorUserId, actorRole) {
  // 1. Check role permissions
  if (!['ADMIN', 'PROCUREMENT_MANAGER'].includes(actorRole)) {
    throw new AuthorizationError('Insufficient permissions to approve PO');
  }

  // 2. Check not self-approval
  const po = await getPOById(poId);
  if (po.createdBy === actorUserId) {
    throw new AuthorizationError('Cannot approve your own purchase order');
  }

  // 3. Check designated approver (if specified)
  if (po.approverId && po.approverId !== actorUserId) {
    throw new AuthorizationError('You are not the designated approver');
  }

  // 4. Proceed with approval
  await updateDoc(...);
}
```

---

## 5. HIGH: No Audit Trail for Critical Operations

### 5.1 The Core Problem

**While audit logging exists, it's not comprehensive and can be bypassed.**

Missing audit coverage:

- Balance adjustments
- Configuration changes
- Direct database modifications
- Failed operation attempts
- Authorization failures

### 5.2 Compliance Implications

| Regulation          | Requirement                    | Current Status |
| ------------------- | ------------------------------ | -------------- |
| SOX (if applicable) | Complete financial audit trail | Partial        |
| GST Audit           | Transaction history            | Partial        |
| Internal Controls   | Separation of duties proof     | Missing        |
| Data Privacy        | Access logs                    | Missing        |

### 5.3 Required Fix

Implement comprehensive audit logging:

```typescript
// Every write operation should:
async function auditableOperation(operation, actor, data) {
  const auditEntry = {
    operation,
    actor,
    timestamp: Timestamp.now(),
    ipAddress: getClientIP(),
    userAgent: getUserAgent(),
    dataBefore: await getExistingData(),
    dataAfter: data,
    success: false,
    errorMessage: null,
  };

  try {
    const result = await performOperation(data);
    auditEntry.success = true;
    return result;
  } catch (error) {
    auditEntry.errorMessage = error.message;
    throw error;
  } finally {
    // Audit log is ALWAYS written, even on failure
    await writeAuditLog(auditEntry);
  }
}
```

---

## 6. HIGH: State Machine Violations Possible

### 6.1 The Core Problem

**Status transitions are validated with simple if-statements, not a formal state machine.**

```typescript
// Current: Easy to bypass
if (pr.status !== 'SUBMITTED') {
  throw new Error('Cannot approve');
}
// But what if status is directly modified in Firestore?
```

### 6.2 Invalid Transition Scenarios

| From Status | To Status   | Should Be | Is Actually     |
| ----------- | ----------- | --------- | --------------- |
| APPROVED    | DRAFT       | Blocked   | Possible via DB |
| REJECTED    | APPROVED    | Blocked   | Possible via DB |
| COMPLETED   | IN_PROGRESS | Blocked   | Possible via DB |

### 6.3 Required Fix

1. Implement formal state machine
2. Validate transitions at database level
3. Log all transition attempts

```typescript
const PO_STATE_MACHINE = {
  DRAFT: ['PENDING_APPROVAL', 'CANCELLED'],
  PENDING_APPROVAL: ['APPROVED', 'REJECTED'],
  APPROVED: ['ISSUED', 'CANCELLED'],
  ISSUED: ['PARTIALLY_RECEIVED', 'COMPLETED'],
  REJECTED: ['DRAFT'], // Revision allowed
  // No paths out of COMPLETED or CANCELLED
};

function validateTransition(current: Status, next: Status): void {
  const allowedNext = PO_STATE_MACHINE[current] ?? [];
  if (!allowedNext.includes(next)) {
    throw new InvalidTransitionError(`Cannot transition from ${current} to ${next}`);
  }
}
```

---

## 7. MEDIUM: Data Integrity Through Denormalization

### 7.1 The Core Problem

**Denormalized data becomes stale and there's no refresh mechanism.**

```typescript
// PurchaseOrder stores vendor name
const po = {
  vendorId: 'vendor-123',
  vendorName: 'Old Vendor Name Inc', // What if vendor renames?
};
```

### 7.2 Stale Data Impact

| Entity        | Denormalized Field | Staleness Impact  |
| ------------- | ------------------ | ----------------- |
| PO            | vendorName         | Incorrect reports |
| Leave Request | userName           | Incorrect history |
| Document Link | assigneeNames      | Incorrect display |
| Submission    | submittedByName    | Incorrect audit   |

### 7.3 Options for Fix

**Option A: Remove denormalization (recommended for critical fields)**

- Always join at read time
- Performance cost but guaranteed accuracy

**Option B: Background sync (recommended for display-only fields)**

- Cloud Function triggers on source change
- Updates all denormalized copies

**Option C: Accept staleness (for historical records)**

- Document that old records show old names
- This is often the correct behavior for audit trails

---

## 8. MEDIUM: Error Recovery Gaps

### 8.1 The Core Problem

**When operations fail mid-way, there's no automated recovery.**

```typescript
// Current pattern
try {
  await step1(); // Succeeds
  await step2(); // Fails!
  await step3(); // Never runs
} catch (error) {
  logger.error('Something failed', { error });
  throw error; // User sees error, but step1 effects persist
}
```

### 8.2 Orphaned Data Examples

| Failed Operation         | Orphaned Data                 |
| ------------------------ | ----------------------------- |
| Document submission      | Uploaded files without record |
| Three-way match approval | Match approved, no bill       |
| Leave cancellation       | Balance not restored          |
| GR completion            | No bill created               |

### 8.3 Required Fix

Implement saga pattern or compensation logic:

```typescript
async function submitDocumentWithCompensation(request) {
  const uploaded: string[] = [];

  try {
    // Step 1: Upload files
    for (const file of request.files) {
      const path = await uploadFile(file);
      uploaded.push(path);
    }

    // Step 2: Create records (uses transaction)
    await createRecordsAtomic(request, uploaded);
  } catch (error) {
    // Compensation: Delete uploaded files
    for (const path of uploaded) {
      await deleteFile(path).catch((e) => logger.error('Cleanup failed', e));
    }
    throw error;
  }
}
```

---

## 9. MEDIUM: Timezone and Date Handling

### 9.1 The Core Problem

**Inconsistent timezone handling across the codebase.**

```typescript
// Some code uses local dates
const fiscalYear = new Date().getFullYear();

// Some code uses Firestore Timestamps (UTC)
const now = Timestamp.now();

// Date comparisons can be wrong
if (leaveRequest.startDate < today) {
  /* timezone issues */
}
```

### 9.2 Failure Scenarios

1. **Leave spanning midnight**: Request submitted at 11:59 PM might use wrong date
2. **Report generation**: Daily reports might miss or double-count transactions
3. **Deadline enforcement**: Due dates might be off by a day

### 9.3 Required Fix

Standardize on UTC and convert for display:

```typescript
// Always store in UTC
const timestamp = Timestamp.fromDate(new Date(Date.UTC(year, month, day)));

// Convert for display using user's timezone
function formatDate(timestamp: Timestamp, timezone: string): string {
  return timestamp.toDate().toLocaleString('en-IN', {
    timeZone: timezone,
  });
}
```

---

## 10. LOW: Logging and Observability

### 10.1 Current State

- Logging exists but inconsistent
- No correlation IDs for request tracing
- No performance metrics
- No error aggregation

### 10.2 Required for Production

1. **Correlation IDs**: Trace requests across functions
2. **Structured Logging**: JSON format for parsing
3. **Error Aggregation**: Sentry or similar
4. **Performance Metrics**: Response times, Firestore latency
5. **Alerting**: PagerDuty for critical failures

---

## 11. Summary: Fundamental Issues Priority

| Issue                    | Severity | Fix Effort | Data Risk  | Status  |
| ------------------------ | -------- | ---------- | ---------- | ------- |
| Transaction Safety       | CRITICAL | 2 weeks    | Corruption | ✅ DONE |
| Double-Entry Enforcement | CRITICAL | 1 week     | Financial  | Pending |
| Idempotency              | CRITICAL | 1 week     | Duplicates | Pending |
| Authorization            | HIGH     | 2 weeks    | Security   | ✅ DONE |
| Audit Trail              | HIGH     | 1 week     | Compliance | ✅ DONE |
| State Machine            | HIGH     | 1 week     | Integrity  | ✅ DONE |
| Denormalization          | MEDIUM   | Ongoing    | Display    | Pending |
| Error Recovery           | MEDIUM   | 2 weeks    | Orphans    | Pending |
| Timezone                 | MEDIUM   | 1 week     | Accuracy   | Pending |
| Observability            | LOW      | 1 week     | Operations | Pending |

**Total Estimated Effort**: 12 weeks (3 months)

---

## 12. Implementation Progress

### ✅ Completed (December 2025)

#### Transaction Safety

- Created `transactionHelpers.ts` with `withTransaction()` wrapper and retry logic
- Refactored `createGoodsReceipt`, `completeGR`, `approveGRForPayment` to use Firestore transactions
- Refactored `approvePO` to use transactions with advance payment atomicity
- Fixed `updatePaymentWithAllocationsAtomic` to move reads inside transaction boundary

#### Authorization Framework

- Created `authorizationService.ts` with:
  - `AuthorizationError` class
  - `requirePermission()` - Check PermissionFlag
  - `requireApprover()` - Verify designated approver
  - `preventSelfApproval()` - Block self-approval
- Added authorization to PO workflow functions:
  - `approvePO` - Requires APPROVE_PO, prevents self-approval
  - `rejectPO` - Requires APPROVE_PO, prevents self-rejection
  - `issuePO` - Requires APPROVE_PO
- Added authorization to proposal workflow functions:
  - `approveProposal` - Requires APPROVE_ESTIMATES, prevents self-approval
  - `rejectProposal` - Requires APPROVE_ESTIMATES
  - `requestProposalChanges` - Requires APPROVE_ESTIMATES
- Added authorization to offer workflow functions:
  - `selectOffer` - Requires APPROVE_PO
  - `rejectOffer` - Requires APPROVE_PO
  - `withdrawOffer` - Requires APPROVE_PO

#### State Machine Framework

- Created `stateMachine.ts` - Generic state machine factory
- Created `stateMachines.ts` with definitions for:
  - `purchaseOrderStateMachine`, `proposalStateMachine`
  - `goodsReceiptStateMachine`, `offerStateMachine`
  - `packingListStateMachine`, `purchaseRequestStateMachine`
- Includes permission mapping for status transitions
- **Integrated state machines into services:**
  - `purchaseOrderService.ts` - All status transitions now validated
  - `approvalWorkflow.ts` - All proposal transitions validated
  - `offer/workflow.ts` - All offer transitions validated
  - `goodsReceiptService.ts` - GR completion validated

#### Audit Completeness

- Added new audit actions: OFFER*\*, PACKING_LIST*\*
- Added OFFER entity type
- Added audit logging to offer/crud.ts, offer/workflow.ts, packingListService.ts

### Pending Work

#### Phase 1 Remaining: Financial Integrity

- Double-entry enforcement at database layer
- Idempotency keys for PO/GR creation

#### Phase 2 Remaining: Security & Authorization

- Add authorization to delete functions (boughtOut, enquiry, document)

#### Phase 3: Data Integrity

- Error recovery/compensation patterns
- Timezone standardization

#### Phase 4: Operations

- Observability infrastructure
- Alerting setup

---

## 13. Original Recommended Implementation Order

### Phase 1: Financial Integrity (Weeks 1-3)

1. Transaction wrappers for accounting operations
2. Double-entry enforcement
3. Idempotency for PO/GR creation

### Phase 2: Security & Authorization (Weeks 4-6)

4. Service-layer authorization checks
5. Role-based access control
6. Enhanced audit logging

### Phase 3: Data Integrity (Weeks 7-9)

7. State machine implementation
8. Error recovery/compensation
9. Timezone standardization

### Phase 4: Operations (Weeks 10-12)

10. Observability infrastructure
11. Alerting setup
12. Documentation and training

---

## 14. Risk Assessment If Not Fixed

| Timeline  | Risk                            | Impact                |
| --------- | ------------------------------- | --------------------- |
| 3 months  | Data inconsistencies discovered | Manual cleanup needed |
| 6 months  | Financial discrepancies         | Audit findings        |
| 12 months | Security incident               | Compliance failure    |
| 18 months | Major data corruption           | System rebuild        |

**Recommendation**: Address CRITICAL issues before scaling beyond current usage.
