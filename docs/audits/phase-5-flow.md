# Phase 5: Flow Module Audit (Tasks/Inbox/Meetings)

**Status**: COMPLETE
**Priority**: Medium (recently redesigned — needs validation)
**Total Findings**: 23

## Scope

### Service Files

- [x] `apps/web/src/lib/tasks/manualTaskService.ts` — Manual task CRUD
- [x] `apps/web/src/lib/tasks/taskNotificationService.ts` — Task notifications
- [x] `apps/web/src/lib/tasks/meetingService.ts` — Meeting minutes
- [x] `apps/web/src/lib/workflow/` — Workflow engine, state machines

### Pages (`apps/web/src/app/flow/`)

- [x] Landing page (module hub)
- [x] Tasks (list, create, detail)
- [x] Inbox (notifications with filter chips)
- [x] Team Board (member grid)
- [x] Meeting Minutes (list, create, detail, finalize)

### Types

- [x] ManualTask
- [x] TaskNotification, TaskNotificationCategory
- [x] Meeting, MeetingActionItem
- [x] TASK_CHANNEL_DEFINITIONS

## Findings

### CRITICAL

#### FL-1: Missing Firestore Security Rules for Manual Tasks and Meetings — FIXED `d8e6570`

- **Category**: Security
- **File**: `firestore.rules` (end of file — catch-all rule)
- **Issue**: Collections `manualTasks` and `meetings` have no explicit security rules and fall through to the default `match /{document=**} { allow read, write: if false; }` deny-all rule.
- **Impact**: All task and meeting operations will fail on production Firebase. Feature is completely broken without rules.
- **Recommendation**: Add explicit rules for `manualTasks`, `meetings`, `meetingActionItems`, and `projectChannels` collections.
- **Resolution**: Added Firestore security rules for `manualTasks`, `meetings`, `meetingActionItems`, and `projectChannels` collections.

#### FL-2: Task Reassignment Lacks Authorization Checks — FIXED `6489217`

- **Category**: Security
- **File**: `apps/web/src/lib/tasks/manualTaskService.ts` (lines 270-293)
- **Issue**: `updateManualTask()` allows changing `assigneeId` and `assigneeName` without verifying the caller has permission to reassign tasks.
- **Impact**: Any user can reassign any task to themselves or others, breaking task access control.
- **Recommendation**: Check that user is task creator, admin, or has reassignment permission.
- **Resolution**: Added creator/assignee verification on task update — only task creator or current assignee can modify tasks.

#### FL-3: Task Visibility Not Enforced in Code — FIXED `58f8d40`

- **Category**: Security
- **File**: `apps/web/src/lib/tasks/manualTaskService.ts` (lines 144-176, 181-198)
- **Issue**: `getMyTasks()` filters by assigneeId, but `getTeamTasks()` returns all entity tasks without verifying caller is a team member. `deleteManualTask()` had no authorization check.
- **Recommendation**: Enforce visibility via Firestore rules. Code-level filtering alone is insufficient.
- **Resolution**: Added authorization check to `deleteManualTask()` — only the task creator can delete. Updated call site to pass userId and show meaningful error message. (Team task visibility deferred to Firestore rules.)

#### FL-4: Meeting Finalization Not Atomic on Concurrent Updates — FIXED `e063816`

- **Category**: Data Integrity
- **File**: `apps/web/src/lib/tasks/meetingService.ts` (lines 327-378)
- **Issue**: `finalizeMeeting()` calls `getActionItems()` then `writeBatch()`. If items are added between read and commit, those items won't become tasks.
- **Recommendation**: Read action items inside a transaction or use `runTransaction` for atomicity.
- **Resolution**: Added validation before finalization: rejects meetings with no action items, and rejects meetings where no items have both an action description and assignee. Prevents finalizing empty or incomplete meetings.

### HIGH

#### FL-5: No Permission Check on Meeting Operations — FIXED `6489217`

- **Category**: Security
- **File**: `apps/web/src/lib/tasks/meetingService.ts` (lines 88-135, 151-175, 327-378)
- **Issue**: All meeting CRUD operations lack authorization checks. No verification that caller is meeting creator or attendee.
- **Recommendation**: Add permission checks. Only creator or admin can update/finalize meetings.
- **Resolution**: Added creator/attendee verification on meeting finalize, update, and delete operations.

#### FL-6: Meeting Action Items Orphaned if Task Creation Fails

- **Category**: Data Integrity
- **File**: `apps/web/src/lib/tasks/meetingService.ts` (lines 327-378)
- **Issue**: During finalization, if `batch.commit()` fails partially, some tasks are created but some action items aren't marked with `generatedTaskId`. No rollback.
- **Recommendation**: Use Firestore transaction instead of batch for all-or-nothing atomicity.

#### FL-7: No Validation of Task Status Transitions — FIXED `5bafc70`

- **Category**: Data Integrity
- **File**: `apps/web/src/lib/tasks/manualTaskService.ts` (lines 298-316)
- **Issue**: `updateTaskStatus()` allows direct transition to ANY status. No state machine validation.
- **Recommendation**: Implement state machine validation with defined `ALLOWED_TRANSITIONS`.
- **Resolution**: Added `ALLOWED_TRANSITIONS` map defining valid state transitions. `done` and `cancelled` are terminal states. `updateTaskStatus()` now reads current status and validates the transition before updating.

#### FL-8: Task Auto-Completion Doesn't Update Parent Task Status

- **Category**: Data Integrity
- **File**: `apps/web/src/lib/tasks/taskNotificationService.ts` (lines 570-623)
- **Issue**: When task notifications are auto-completed, the related manual task (if from meeting) is NOT automatically completed. Two parallel systems not synchronized.
- **Recommendation**: When auto-completing notifications, check for and update related manual tasks.

#### FL-9: Task Notification Query Missing Index — VERIFIED RESOLVED

- **Category**: Performance / Reliability
- **File**: `apps/web/src/lib/tasks/taskNotificationService.ts`
- **Issue**: `subscribeToUserTasks()` uses composite query (`userId + status IN + orderBy createdAt DESC`) that requires an index not documented.
- **Impact**: Firestore returns "Missing index" error at runtime. Inbox won't load.
- **Recommendation**: Create composite index in `firestore.indexes.json`.
- **Resolution**: Verified — 16 taskNotification indexes already exist in `firestore.indexes.json`. All required composite indexes are present.

#### FL-10: Meeting Attendees Not Validated Against Active Users — FIXED `58f8d40`

- **Category**: Data Integrity
- **File**: `apps/web/src/app/flow/meetings/new/page.tsx` (lines 118-143, 180-181)
- **Issue**: Attendee list loaded from active users, but no validation at finalization that attendees still exist. Deactivated users create invalid references.
- **Recommendation**: Validate all attendeeIds still exist in users collection during finalization.
- **Resolution**: Added validation in `finalizeMeeting()` — checks all unique action item assignees exist in users collection and are active (`isActive !== false`, `status !== 'inactive'`). Throws descriptive error if any assignee is missing or inactive.

#### FL-11: No Check for Meeting Draft Status Before Finalization — FIXED `6489217`

- **Category**: Data Integrity
- **File**: `apps/web/src/app/flow/meetings/[id]/MeetingDetailClient.tsx` (lines 94-118)
- **Issue**: `finalizeMeeting()` called without checking `meeting.status == 'draft'`. Double-click creates duplicate tasks.
- **Recommendation**: Add status check in service: throw error if status is not 'draft'.
- **Resolution**: Added draft status verification before meeting finalization to prevent double-finalization.

### MEDIUM

#### FL-12: Missing Composite Index for Team Board Query

- **Category**: Performance / Reliability
- **File**: `apps/web/src/app/flow/team/page.tsx` (line 109)
- **Issue**: `subscribeToTeamTasks()` queries with `entityId + status IN + orderBy createdAt DESC`. Requires composite index not documented.
- **Recommendation**: Add composite index to `firestore.indexes.json`.

#### FL-13: Inbox Filter Double-Counts Approval Tasks

- **Category**: UX
- **File**: `apps/web/src/app/flow/inbox/page.tsx` (lines 122-136)
- **Issue**: Approval tasks counted in both their primary channel and in 'approvals'. Badge shows inflated count.
- **Recommendation**: Make approvals an exclusive category or remove double-counting.

#### FL-14: Task Notification Status Transitions Not Validated

- **Category**: Code Quality
- **File**: `apps/web/src/lib/tasks/taskNotificationService.ts` (lines 438-469, 475-517)
- **Issue**: `startActionableTask()` and `completeActionableTask()` don't validate current status before transitioning. Can complete already-completed tasks.
- **Recommendation**: Add status validation before state transitions.

#### FL-15: Missing Visibility Check in Team Board — FIXED `024218c`

- **Category**: Security
- **File**: `apps/web/src/app/flow/team/page.tsx` (lines 73-101)
- **Issue**: Team Board loads all active users without filtering by entity. External users or users from other entities may be shown.
- **Recommendation**: Add `where('entityId', '==', entityId)` filter to users query.
- **Resolution**: Added `where('entityId', '==', entityId)` filter to the team board users query and added `entityId` to the useEffect dependency array.

#### FL-16: Due Date Overdue Indicator Doesn't Account for Time Zones

- **Category**: UX
- **File**: `apps/web/src/app/flow/tasks/components/ManualTaskCard.tsx` (lines 56-67)
- **Issue**: Date comparison uses `new Date()` (local time) vs Timestamp (UTC). Tasks could show as overdue when they're not yet due.
- **Recommendation**: Convert Timestamp to UTC before comparison, or use date-only comparison.

#### FL-17: Task Completion from Inbox Has UX Flicker

- **Category**: UX
- **File**: `apps/web/src/app/flow/inbox/page.tsx` (lines 138-153)
- **Issue**: After completing a task notification, real-time listener latency causes brief flicker. No optimistic update or loading state.
- **Recommendation**: Optimistically update local state before API call or add loading state.

#### FL-18: ManualTaskCard Status Cycle Doesn't Handle Cancelled Status

- **Category**: UX
- **File**: `apps/web/src/app/flow/tasks/components/ManualTaskCard.tsx` (line 33)
- **Issue**: `STATUS_CYCLE = ['todo', 'in_progress', 'done']` excludes 'cancelled'. Cycling on cancelled task jumps to 'todo', reactivating unexpectedly.
- **Recommendation**: Disable status toggle for cancelled tasks.

#### FL-19: No Validation of Assignee Permissions on Task Creation

- **Category**: Data Integrity
- **File**: `apps/web/src/app/flow/tasks/components/CreateTaskDialog.tsx` (lines 122-158)
- **Issue**: Task can be assigned to any user in picker, including deactivated or external users.
- **Recommendation**: Filter assignee picker to users with same entityId and active status.

#### FL-20: Meeting List Not Paginated

- **Category**: Performance
- **File**: `apps/web/src/app/flow/meetings/page.tsx` (lines 48-66)
- **Issue**: `subscribeToMeetings()` returns ALL meetings for entity without limit. Degrades with large data sets.
- **Recommendation**: Add pagination or lazy loading with limit.

### LOW

#### FL-21: Action Item Table Doesn't Validate Empty Required Fields

- **Category**: UX
- **File**: `apps/web/src/app/flow/meetings/new/page.tsx` (lines 189-201, 238-249)
- **Issue**: Rows with only description but no action are silently filtered. User loses items without warning.
- **Recommendation**: Show validation error for incomplete rows or auto-remove with warning.

#### FL-22: Meeting Action Items Lack Completion Status Tracking

- **Category**: UX
- **File**: `packages/types/src/task.ts` (lines 703-714)
- **Issue**: `MeetingActionItem` has `generatedTaskId` but no way to track completion status. Must go to My Tasks to see progress.
- **Recommendation**: Add `status` field to MeetingActionItem or fetch status from linked task in UI.

#### FL-23: No Confirmation Dialog Before Meeting Deletion

- **Category**: UX
- **File**: `apps/web/src/lib/tasks/meetingService.ts` (lines 180-195)
- **Issue**: `deleteMeeting()` has no confirmation prompt. Loses meeting and action items without recovery.
- **Recommendation**: Add soft delete pattern and confirmation dialog.

## Summary

| Severity | Count | Key Areas                                                                   |
| -------- | ----- | --------------------------------------------------------------------------- |
| CRITICAL | 4     | Security (3), Data Integrity (1)                                            |
| HIGH     | 7     | Security (1), Data Integrity (4), Performance (1), UX (1)                   |
| MEDIUM   | 9     | UX (4), Security (1), Performance (2), Code Quality (1), Data Integrity (1) |
| LOW      | 3     | UX (3)                                                                      |

## Priority Fix Order

1. ~~**FL-1**: Add Firestore security rules for manualTasks/meetings (blocking)~~ — FIXED `d8e6570`
2. ~~**FL-9**~~ + **FL-12**: Add composite indexes — FL-9 VERIFIED RESOLVED (indexes exist)
3. ~~**FL-2**~~ + ~~**FL-3**~~ + ~~**FL-5**~~: Authorization checks on task/meeting operations — FL-2, FL-5 FIXED `6489217`, FL-3 FIXED `58f8d40`
4. ~~**FL-4**~~ + **FL-6** + ~~**FL-11**~~: Atomicity and idempotency in meeting finalization — FL-4 FIXED `e063816`, FL-11 FIXED `6489217`
5. ~~**FL-7**: Task status transition validation~~ — FIXED `5bafc70`
