# Task Module Implementation Plan

## Overview

The Task module provides a unified view of activities assigned to users from various modules. Users can start working on tasks (with time tracking), pause tasks, but can only mark tasks as complete when the underlying action is performed (e.g., approving a PR, uploading a document).

## Current State Analysis

### What Exists

1. **Task Notification System** - Comprehensive type system with 60+ task categories
2. **Time Tracking** - Full implementation with start/pause/resume/stop and stats
3. **Auto-completion** - Cloud Functions that detect when underlying actions are done
4. **Tasks Page** - UI with filtering, time stats, and timer widget

### Key Mechanism: `autoCompletable` Tasks

- Tasks are created with `autoCompletable: true`
- User can START and PAUSE tasks freely (time is tracked)
- User CANNOT manually complete - must perform the actual action
- Cloud Functions detect status changes and auto-complete the task
- User then confirms completion (sets `completionConfirmed: true`)

### Current Gaps

1. **PR Submission task creation** - Code exists but is commented out
2. **Document tasks** - Cloud Functions exist but web app doesn't create tasks
3. **Invoice/Payment tasks** - Backend exists, frontend missing
4. **RFQ/Offer/Three-Way Match** - No task integration yet

---

## Task Notification Points by Module

### Procurement Module

| Step                 | Action                            | Task Category                 | Auto-completable   | Currently Implemented |
| -------------------- | --------------------------------- | ----------------------------- | ------------------ | --------------------- |
| PR Created           | Engineer submits PR for approval  | `PR_SUBMITTED`                | Yes                | ⚠️ Commented out      |
| PR Approved/Rejected | Approver reviews PR               | `PR_APPROVED` / `PR_REJECTED` | No (informational) | ⚠️ Partial            |
| RFQ Issued           | Procurement issues RFQ to vendors | `RFQ_ISSUED`                  | No                 | ❌ Not implemented    |
| Offer Received       | Vendor submits offer              | `OFFER_RECEIVED`              | No                 | ❌ Not implemented    |
| Offer Evaluation     | Procurement compares offers       | `OFFER_EVALUATION_REQUIRED`   | Yes                | ❌ Not implemented    |
| PO Created           | PO submitted for approval         | `PO_PENDING_APPROVAL`         | Yes                | ⚠️ Partial            |
| PO Approved/Rejected | Approver reviews PO               | `PO_APPROVED` / `PO_REJECTED` | No (informational) | ⚠️ Partial            |
| GR Created           | Goods received at site            | `GR_CREATED`                  | No                 | ❌ Not implemented    |
| WCC Created          | Work completion certified         | `WCC_CREATED`                 | No                 | ❌ Not implemented    |
| Three-Way Match      | Match PO/GR/Invoice               | `THREE_WAY_MATCH_REQUIRED`    | Yes                | ❌ Not implemented    |
| Payment Request      | Finance processes payment         | `PAYMENT_REQUESTED`           | Yes                | ⚠️ Backend only       |

### Documents Module

| Step              | Action                         | Task Category                  | Auto-completable   | Currently Implemented     |
| ----------------- | ------------------------------ | ------------------------------ | ------------------ | ------------------------- |
| Document Assigned | PM assigns doc to engineer     | `DOCUMENT_ASSIGNED`            | Yes                | ❌ Web app doesn't create |
| Work In Progress  | Engineer works on document     | -                              | -                  | Time tracking available   |
| Internal Review   | Engineer submits for PM review | `DOCUMENT_INTERNAL_REVIEW`     | Yes                | ❌ Web app doesn't create |
| PM Approved       | PM approves for client         | `DOCUMENT_PM_APPROVED`         | No (informational) | ❌ Not implemented        |
| Client Submission | Doc sent to client             | `DOCUMENT_SUBMITTED_TO_CLIENT` | No                 | ❌ Not implemented        |
| Client Commented  | Client returns with comments   | `DOCUMENT_CLIENT_COMMENTED`    | Yes                | ❌ Web app doesn't create |
| Client Approved   | Client approves document       | `DOCUMENT_CLIENT_APPROVED`     | No (informational) | ❌ Not implemented        |
| Revision Required | Doc needs revision             | `DOCUMENT_REVISION_REQUIRED`   | Yes                | ❌ Not implemented        |

### Proposals Module

| Step               | Action                       | Task Category        | Auto-completable   | Currently Implemented |
| ------------------ | ---------------------------- | -------------------- | ------------------ | --------------------- |
| Enquiry Received   | New enquiry logged           | `ENQUIRY_RECEIVED`   | No (informational) | ✅ Working            |
| Enquiry Assigned   | Enquiry assigned to engineer | `ENQUIRY_ASSIGNED`   | Yes                | ✅ Working            |
| Proposal Created   | Engineer creates proposal    | `PROPOSAL_CREATED`   | No (informational) | ✅ Working            |
| Proposal Submitted | Proposal sent for approval   | `PROPOSAL_SUBMITTED` | Yes                | ✅ Working            |
| Proposal Approved  | Director approves            | `PROPOSAL_APPROVED`  | No (informational) | ✅ Working            |
| Proposal Rejected  | Director rejects             | `PROPOSAL_REJECTED`  | No (informational) | ✅ Working            |

### Accounting Module

| Step             | Action                       | Task Category               | Auto-completable   | Currently Implemented |
| ---------------- | ---------------------------- | --------------------------- | ------------------ | --------------------- |
| Invoice Created  | Invoice needs approval       | `INVOICE_APPROVAL_REQUIRED` | Yes                | ❌ Backend only       |
| Invoice Approved | Invoice approved             | `INVOICE_APPROVED`          | No (informational) | ❌ Not implemented    |
| Bill Created     | Bill needs processing        | `BILL_APPROVAL_REQUIRED`    | Yes                | ❌ Backend only       |
| Payment Due      | Payment deadline approaching | `PAYMENT_DUE`               | No (informational) | ❌ Not implemented    |

### Projects Module

| Step                  | Action                           | Task Category            | Auto-completable   | Currently Implemented |
| --------------------- | -------------------------------- | ------------------------ | ------------------ | --------------------- |
| Milestone Due         | Milestone deadline approaching   | `MILESTONE_DUE`          | No (informational) | ❌ Not implemented    |
| Deliverable Due       | Deliverable deadline approaching | `DELIVERABLE_DUE`        | No (informational) | ❌ Not implemented    |
| Project Status Update | Periodic status required         | `STATUS_UPDATE_REQUIRED` | Yes                | ❌ Not implemented    |

---

## Implementation Plan

### Phase 1: Enable Existing Task Flows

#### 1.1 Fix PR Submission Task Creation

**File:** `apps/web/src/lib/procurement/purchaseRequest/workflow.ts`

- Uncomment task creation in `submitPurchaseRequestForApproval()`
- Use `getEngineeringApprovers()` helper (similar to proposals module)
- Create `PR_SUBMITTED` actionable task with `autoCompletable: true`

**New Helper File:** `apps/web/src/lib/procurement/purchaseRequest/userHelpers.ts`

```typescript
export async function getPRApprovers(db: Firestore, entityId: string): Promise<string[]> {
  return getUsersWithPermission(db, entityId, PermissionFlag.APPROVE_PR);
}
```

#### 1.2 Add Document Task Creation

**File:** `apps/web/src/lib/documents/workflow.ts` (or similar)

- Create tasks when documents are assigned
- Create tasks when documents need PM review
- Cloud Functions already handle auto-completion

Tasks to create:

- `DOCUMENT_ASSIGNED` - When document assigned to engineer
- `DOCUMENT_INTERNAL_REVIEW` - When engineer submits for PM review
- `DOCUMENT_CLIENT_COMMENTED` - When client comments received

#### 1.3 Add Invoice/Bill Task Creation

**File:** `apps/web/src/lib/accounting/invoiceService.ts`

- Create `INVOICE_APPROVAL_REQUIRED` when invoice needs approval
- Cloud Functions handle auto-completion when approved

---

### Phase 2: Enhance Tasks Page UX

#### 2.1 Clarify Task Completion Flow

**File:** `apps/web/src/app/tasks/page.tsx`

For `autoCompletable` tasks:

- **Pending**: Show "Start Working" button
- **In Progress**: Show timer, "Pause" button, "Go to [Entity]" link
- **Cannot show "Complete" button** - must navigate to entity and perform action
- **Auto-completed**: Show "Confirm Completion" button

UI Text Changes:

- Instead of "Mark Complete" → "Go to PR to Approve"
- Add tooltip: "This task will complete automatically when you perform the action"

#### 2.2 Add Task Type Indicators

- Show badge for task type: "Approval Required", "Document Work", "Review Needed"
- Show entity type: PR, PO, Document, Invoice
- Show link to the entity detail page

#### 2.3 Improve Timer Widget

**File:** `apps/web/src/components/tasks/TimerWidget.tsx`

- Add "Go to Task" button that opens entity in new tab
- Show task category/type for context
- Persist widget across page navigation (already floating)

---

### Phase 3: Add Missing Module Integrations

#### 3.1 PO Approval Tasks

**File:** `apps/web/src/lib/procurement/purchaseOrder/workflow.ts`

- Create `PO_PENDING_APPROVAL` when PO submitted for approval
- Cloud Function already handles auto-completion

#### 3.2 RFQ Tasks (Optional)

- Create tasks when RFQ issued (for tracking)
- Create tasks when offers received (for evaluation)

#### 3.3 Three-Way Match Tasks (Optional)

- Create tasks when match needs approval
- Auto-complete when approved/rejected

---

## Key Files Reference

### Core Task Logic

1. `apps/web/src/lib/tasks/taskNotificationService.ts` - Task CRUD operations
2. `apps/web/src/lib/tasks/timeEntryService.ts` - Time tracking operations

### Task Creation Points

3. `apps/web/src/lib/procurement/purchaseRequest/workflow.ts` - Enable PR tasks
4. `apps/web/src/lib/procurement/purchaseOrder/workflow.ts` - Add PO tasks
5. `apps/web/src/lib/documents/` - Add document tasks
6. `apps/web/src/lib/accounting/` - Add invoice tasks

### UI Components

7. `apps/web/src/app/tasks/page.tsx` - Main tasks page
8. `apps/web/src/components/tasks/TaskNotificationItem.tsx` - Task list item
9. `apps/web/src/components/tasks/TimerWidget.tsx` - Floating timer

### Cloud Functions (Already Exist)

- `functions/src/taskAutoCompletion/purchaseRequestAutoComplete.ts` ✓
- `functions/src/taskAutoCompletion/purchaseOrderAutoComplete.ts` ✓
- `functions/src/taskAutoCompletion/documentAutoComplete.ts` ✓
- `functions/src/taskAutoCompletion/invoiceAutoComplete.ts` ✓

---

## User Flow Examples

### PR Approval Flow

1. Engineer creates PR and submits for approval
2. System creates `PR_SUBMITTED` task for approvers (autoCompletable=true)
3. Approver sees task in Tasks page with "Start Working" button
4. Approver clicks "Start Working" → Timer starts, status = in_progress
5. Approver can "Pause" to work on other things
6. Approver clicks "Go to PR" → Opens PR detail page
7. Approver reviews and clicks "Approve" on PR page
8. Cloud Function detects PR status change → Auto-completes task
9. Task shows "Auto-completed" badge with "Confirm" button
10. Approver clicks "Confirm" to acknowledge completion

### Document Work Flow

1. PM assigns document to engineer
2. System creates `DOCUMENT_ASSIGNED` task (autoCompletable=true)
3. Engineer starts task, works on document
4. Engineer uploads file and clicks "Submit for Review"
5. Cloud Function auto-completes the task
6. New task created for PM: `DOCUMENT_INTERNAL_REVIEW`

---

## Testing Checklist

- [ ] PR submission creates task for approvers
- [ ] PR approval auto-completes the task
- [ ] User cannot manually complete autoCompletable tasks
- [ ] Timer tracks time correctly with pause/resume
- [ ] Document assignment creates task
- [ ] Document submission auto-completes task
- [ ] PO approval flow works end-to-end
- [ ] Tasks page shows appropriate actions based on task state
- [ ] Timer widget navigates to correct entity

---

## Summary

The task module infrastructure is largely complete. The main work involves:

1. **Enabling task creation** at workflow points (code exists but needs uncommenting/connecting)
2. **UX improvements** to clarify the auto-completion flow to users
3. **Additional integrations** for modules that don't yet create tasks

Priority should be given to enabling PR and Document task flows first, as these have the most user value and the backend already supports auto-completion.

---

_Last Updated: November 2024_
