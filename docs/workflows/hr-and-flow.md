# HR & Flow — User Workflows

> Generated 2026-07-03 from code inspection (routes, services, state machines, Cloud Functions). Part of the [module workflow docs](README.md).

This document describes the end-user workflows for the two collaboration-heavy areas of Vapour Toolbox: the **HR** module (`apps/web/src/app/hr/**`, services in `apps/web/src/lib/hr/**`) and the **Flow** module (`apps/web/src/app/flow/**`, services in `apps/web/src/lib/tasks/**`), plus the shared in-app **notification** system (`apps/web/src/lib/tasks/taskNotificationService.ts`, `apps/web/src/lib/notifications/**`). Everything below is grounded in the code paths cited; automatic (Cloud Function) behaviours are called out separately, and anything unfinished is flagged **⚠ Known gap**.

---

## Part 1 — HR Module

### 1.1 Overview

HR data lives in Firestore. Employee profiles are stored on the `users` collection (there is no separate employee record) — see `apps/web/src/lib/hr/employees/employeeService.ts`. Leave, on-duty, travel expenses, holidays and comp-off each have their own collections and a two-file service pattern: a CRUD service (`*RequestService` / `*Service`) and an approval service (`*ApprovalService`). Approvers are **not hard-coded**; they are read from `hrConfig/leaveSettings.leaveApprovers` (leave + on-duty) and `hrConfig/travelExpenseSettings.expenseApprovers` (travel, falling back to `leaveSettings`). If the config document is missing the services throw an explicit "not configured" error (HR-5). Routes:

| Area            | Route root                                                                                |
| --------------- | ----------------------------------------------------------------------------------------- |
| Dashboard       | `apps/web/src/app/hr/page.tsx`                                                            |
| Employees       | `apps/web/src/app/hr/employees/` (`page.tsx`, `[id]/`)                                    |
| Leaves          | `apps/web/src/app/hr/leaves/` (`new/`, `[id]/`, `my-leaves/`, `calendar/`)                |
| On-duty         | `apps/web/src/app/hr/on-duty/` (`new/`, `[id]/`, `my-requests/`)                          |
| Travel expenses | `apps/web/src/app/hr/travel-expenses/` (`new/`, `[id]/`)                                  |
| Holidays        | `apps/web/src/app/hr/holidays/page.tsx`, `apps/web/src/app/hr/settings/holidays/page.tsx` |
| Settings        | `apps/web/src/app/hr/settings/leave-summary/page.tsx`                                     |

---

### 1.2 How to onboard / edit an employee

Employees are just active users; there is no create-employee flow in this module — a user becomes an "employee" once they exist in `users` with `isActive: true`. New users are created elsewhere (self sign-up triggers the `onNewUserNotify` email, `functions/src/email/triggers.ts` line 723).

**View the roster:** `apps/web/src/app/hr/employees/page.tsx` lists active users via `getAllEmployees` / `getEmployeesWithFilters` (`employeeService.ts`). Filtering by blood group and reporting manager is done in memory because those live in the nested `hrProfile` field.

**Edit a profile:** open `hr/employees/[id]` → `EditEmployeeDialog.tsx`. Two service calls back the dialog:

- `updateEmployeeHRProfile(userId, hrProfile, updatedBy, auditor?, userPermissions2?)` — merges into `user.hrProfile`.
- `updateEmployeeBasicInfo(userId, {phone, mobile, jobTitle, department}, …)` — top-level user fields.

Both **require the `MANAGE_HR_PROFILES` permission** (HR-18) when `userPermissions2` is supplied (`requirePermission(...)`, `employeeService.ts` lines 159 / 242) and both write an audit-log entry via `logAuditEvent` when an `auditor` is passed (HR-14). ⚠ Known gap: the permission check is only enforced when the caller passes `userPermissions2` — if a caller omits it, the write is not permission-gated at the service layer (it relies on Firestore rules).

---

### 1.3 How to apply for leave

Entry point: `apps/web/src/app/hr/leaves/new/page.tsx`. Backing service `apps/web/src/lib/hr/leaves/leaveRequestService.ts`:

1. `createLeaveRequest(input, userId, userName, userEmail, tenantId?)` creates a `DRAFT` in `hrLeaveRequests`. On creation it validates:
   - leave type exists and (if half-day) allows half days, and half-day is single-day only (HR-9);
   - no overlapping DRAFT/PENDING/APPROVED request for the user (HR-6, `checkForOverlappingLeaves`);
   - sufficient available balance (`getUserLeaveBalanceByType`).
   - Day count excludes weekends/company holidays via `calculateLeaveDays` (recurring holiday config) — `calculateLeaveDaysAsync` also returns the excluded-holiday list.
   - Request number `LR-YYYY-####` generated transactionally from a per-year counter.
2. Submit for approval: `submitLeaveRequest(requestId, userId, userName)` in `leaveApprovalService.ts` moves `DRAFT → PENDING_APPROVAL`, resolves the configured approvers, and **adds the days to the balance's `pending` bucket** (`addPendingLeave`). It builds an `approvalFlow` requiring **2 approvals** (both approvers), and creates one actionable task notification per approver (`LEAVE_SUBMITTED`).

Drafts can be edited (`updateLeaveRequest`) or deleted (soft-delete to `CANCELLED`, `deleteLeaveRequest`) only while `DRAFT` and only by the owner.

### 1.4 How to approve or reject leave (self-approval prevention)

From `hr/leaves/[id]` (`LeaveDetailClient.tsx`) an approver acts via `leaveApprovalService.ts`:

- **Approve** — `approveLeaveRequest(requestId, approverId, approverName, remarks?)`:
  - allowed only from `PENDING_APPROVAL` or `PARTIALLY_APPROVED`;
  - caller must be in `approverIds`;
  - **self-approval blocked** via `preventSelfApproval(approverId, request.userId, …)` (HR-17) — even though the applicant is filtered out of the approver set at submit time, this is defence-in-depth;
  - a repeat approval by the same approver is rejected ("already approved");
  - **2-step logic:** first approval → `PARTIALLY_APPROVED` (employee notified of progress); second → `APPROVED`, at which point `confirmPendingLeave` moves the days from `pending` to `used`, all approver notifications are auto-completed, the employee gets a `LEAVE_APPROVED` notification, and **every active internal user** is notified via `notifyTeamOfApprovedLeave`.
- **Reject** — `rejectLeaveRequest(...)`: requires a non-empty reason, either approver can reject at any pending stage → `REJECTED`; `removePendingLeave` releases the held days; employee gets `LEAVE_REJECTED`.
- **Cancel** (by employee) — `cancelLeaveRequest(...)`: allowed from `DRAFT`/`PENDING_APPROVAL`/`PARTIALLY_APPROVED`; releases pending days if held.

**Self-approval special case:** if the applicant _is_ one of the configured approvers, `submitLeaveRequest` excludes them and sets `requiredApprovalCount = 1`, so only the _other_ approver's single approval finalises it (`leaveApprovalService.ts` lines 253-271).

### 1.5 How leave balances work and reset

`apps/web/src/lib/hr/leaves/leaveBalanceService.ts` — one `hrLeaveBalances` doc per user × leave type × fiscal year. Fields: `entitled`, `carryForward`, `used`, `pending`, derived `available = entitled + carryForward − used − pending` (recomputed on every read to avoid drift). All mutations go through `updateLeaveBalance`, which uses a **Firestore transaction** and refuses to let `available` go negative ("Insufficient leave balance"). Fiscal year = calendar year (`getCurrentFiscalYear`). Lifecycle helpers: `addPendingLeave` (submit) → `confirmPendingLeave` (final approval) / `removePendingLeave` (reject/cancel).

**Annual reset** — `functions/src/hr/leaveBalanceReset.ts`:

- `resetLeaveBalances` — scheduled cron `30 18 31 12 *` (00:00 IST on Jan 1, `Asia/Kolkata`, `asia-south1`). For every active user it creates fresh SICK (12) and CASUAL (12) balances for the new year **if none exist**; `carryForward` is 0 (no carry-forward). ⚠ Known gap: the automatic scheduled reset creates only SICK and CASUAL — it does **not** create the COMP_OFF balance (that gap is only covered by the manual function below and by lazy auto-init in `compOffService`).
- `manualResetLeaveBalances({year})` — callable, requires `MANAGE_USERS` (bit 1). More thorough: repairs entitled=0 balances and creates the missing COMP_OFF (0-quota) balance.
- `seedLeaveTypes` — callable, `MANAGE_USERS`, seeds SICK/CASUAL/COMP_OFF leave types.

### 1.6 How to manage holidays

`apps/web/src/lib/hr/holidays/holidayService.ts`, UI at `hr/holidays/page.tsx` and `hr/settings/holidays/page.tsx`. **Access is gated by `canManageHRSettings(permissions2)`** (holidays page line 50). Operations: `createHoliday` (deterministic doc id `holiday-YYYY-MM-DD` to prevent duplicates on the same date, HR-13), `updateHoliday`, `deleteHoliday` (soft delete, `isActive=false`), `hardDeleteHoliday`, `copyHolidaysToYear`. Recurring holidays (all Sundays + 1st/3rd Saturdays) are computed, not stored (`recurringHolidayCalculator.ts`, `DEFAULT_RECURRING_CONFIG`) and are what the leave day-counter and on-duty validator use.

**Holiday-working overrides** (`holidayWorkingService.ts`) let an admin declare a holiday to be worked and grant comp-off in bulk: `createHolidayWorkingOverride` validates the date is genuinely a holiday, blocks a duplicate `COMPLETED` override for the same date, then runs `processHolidayWorkingOverride` synchronously to grant 1 comp-off day to each affected user (`scope: ALL_USERS` or `SPECIFIC_USERS`) via `grantCompOff`.

### 1.7 How to submit an on-duty request

For working on a holiday and earning comp-off. Entry: `hr/on-duty/new/page.tsx`; services `onDutyRequestService.ts` + `onDutyApprovalService.ts` (mirrors leave exactly).

1. `createOnDutyRequest(...)` — validates the date **is** a holiday (`validateOnDutyDate`), is not in the past, has no duplicate active on-duty request, and has no conflicting approved leave on that date (HR-7). Creates `DRAFT` in `hrOnDutyRequests`, number `OD-YYYY-####`.
2. `submitOnDutyRequest(...)` → `PENDING_APPROVAL`, resolves the **same approvers as leave**, 2-step approval flow, notifies approvers (`ON_DUTY_SUBMITTED`).
3. `approveOnDutyRequest(...)` — same 2-step + `preventSelfApproval` (HR-17). On final approval it sets `compOffGranted: true` and calls `grantCompOff(userId, {source:'ON_DUTY_REQUEST', …})`, which adds 1 day to the COMP_OFF balance and writes a grant record with a **1-year expiry** (`compOffService.ts` → `addCompOffBalance`, which creates an `hrCompOffGrants` row). Employee + whole team notified.
4. `rejectOnDutyRequest(...)` → `REJECTED`. `cancelOnDutyRequest(...)` — cancellable while pending; if already `APPROVED`, only allowed ≥1 day before the holiday. ⚠ Known gap: cancelling an already-approved on-duty does **not** revoke the granted comp-off — the code notes "This will be handled in a future enhancement" (`onDutyApprovalService.ts` line 681).

Comp-off caps: `grantCompOff` hard-stops at 20 days available and warns at ≥10 (`compOffService.ts` lines 164-176). `findExpiringCompOffs(withinDays)` exists (30-day warning threshold) but ⚠ Known gap: there is **no scheduled Cloud Function that expires comp-off grants or sends the expiry warning** — only the query helper exists.

### 1.8 How to file travel expenses (with receipt upload / parsing)

Entry: `hr/travel-expenses/new/page.tsx`; services `travelExpenseService.ts` + `travelExpenseApprovalService.ts`.

1. `createTravelExpenseReport(...)` — creates a `DRAFT` report in `hrTravelExpenses`, number `TE-YYYY-####`.
2. Add line items with `addExpenseItem(reportId, input, userId, receiptAttachmentId?, receiptFileName?, receiptUrl?)`. Items carry category, amount, GST breakdown (rate/CGST/SGST/IGST/taxable), vendor + GSTIN, and optional from/to locations. `updateExpenseItem` runs in a transaction; `removeExpenseItem`, `updateExpenseItemReceipt` also exist. Report totals + per-category totals are recomputed on every item change. All item edits require `status === 'DRAFT'` and ownership.
3. **Receipt parsing IS wired.** The component `apps/web/src/components/hr/travelExpenses/ReceiptParsingUploader.tsx` uploads the receipt to Storage, then calls Cloud Functions via `httpsCallable`. The primary parser is `parseReceiptForExpense` (`functions/src/receiptParsing/parseReceipt.ts`) which uses **Google Cloud Document AI** to extract vendor, invoice number, date, total, GST breakdown, vendor GSTIN, and detects whether the company GSTIN appears on the receipt; it returns a suggested category and confidence. A second callable `compareReceiptParsers` (used by the uploader, line 254) runs Document AI vs. a Claude-based parser (`parseReceiptWithClaude.ts`) for comparison. Both are exported from `functions/src/index.ts` (lines 96-97). The parsed values pre-fill the add-item form; the user reviews before saving.
4. Submit: `submitTravelExpenseReport(...)` — `requireValidTransition(travelExpenseStateMachine, …, 'SUBMITTED')`, rejects an empty report, resolves approvers **excluding the submitter**, and errors if that leaves no approver ("you cannot approve your own report"). Notifies approvers (`TRAVEL_EXPENSE_SUBMITTED`).

**Approval (parallel, single approver):** any one approver can act (`travelExpenseApprovalService.ts`):

- `approveTravelExpenseReport(..., approvedAmount?, comments?)` → `APPROVED` (optional partial approved amount), `preventSelfApproval` (HR-17).
- `rejectTravelExpenseReport(..., rejectionReason)` → `REJECTED` (reason required).
- `returnTravelExpenseForRevision(..., comments)` → back to `DRAFT`, clears `approverIds`, sends an actionable `TRAVEL_EXPENSE_RETURNED` to the employee.
- `markTravelExpenseReimbursed(..., reimbursedAmount, transactionId?)` → `REIMBURSED` (only from `APPROVED`). A PDF report with embedded receipts can be generated (`pdfReportService.ts`, `receiptUtils.ts` fetches image + PDF receipts).

---

## Part 2 — Flow (Collaboration) Module

### 2.1 Overview

Flow is a Slack-like layer over three concepts: **manual tasks** (`manualTaskService.ts`), **task threads + @mentions** (`threadService.ts`, `mentionService.ts`) attached to system notifications, and **meetings + action items** (`meetingService.ts`). It also hosts the **Inbox** of system task-notifications. Routes: `flow/page.tsx` (dashboard), `flow/inbox/`, `flow/tasks/`, `flow/team/`, `flow/meetings/`.

### 2.2 How to create and assign tasks

`apps/web/src/app/flow/tasks/page.tsx` → `CreateTaskDialog.tsx` → `createManualTask(db, input, userId, userName, tenantId)`:

- Validates the assignee exists and is active (FL-19) — cannot assign to an inactive user.
- Creates a `manualTasks` doc with `status: 'todo'`, priority default `MEDIUM`, optional `dueDate`, and optional links to `projectId` / `proposalId` / `meetingId`, plus tags.

Reading: `getMyTasks` / `subscribeToMyTasks` (real-time, assignee view on the Tasks page), `getTeamTasks` / `subscribeToTeamTasks` (Team page `flow/team/page.tsx`, shows all `todo`+`in_progress` tasks for the tenant).

Editing/status: `updateManualTask` — **only the creator or current assignee** may edit (FL-2, throws `AuthorizationError`). `updateTaskStatus` enforces the transition table (FL-7) and auto-stamps `completedAt` on `done`; completing a task auto-completes any linked task-notifications (FL-8, `completeTaskNotificationsByEntity('TASK', …)`). `deleteManualTask` — **only the creator** may delete (FL-3).

### 2.3 How to use threads and @mentions

Threads attach to a system task-notification (not to manual tasks). `getOrCreateThread(taskNotification)` derives a channel from the notification category (`getChannelIdFromTaskCategory`) and creates one `taskThreads` doc per notification. `addMessage(threadId, userId, userName, content, avatar?)`:

- parses `@[userId]` / `@userId` tokens (`parseMentions`), stores them on the message, increments the thread's `messageCount`/`lastMessageAt`;
- if there are mentions, calls `createMentionsFromMessage` (`mentionService.ts`) which writes one `taskMentions` row per mentioned user (**skipping self-mentions**), `read: false`.
- `editMessage` — author-only, re-parses mentions. Real-time via `subscribeToThreadMessages`.

Mentions UX (`mentionService.ts`): `getUnreadMentions`, `getUnreadMentionCount` (capped badge, "99+"), `markMentionAsRead` / `markMentionsAsRead` (batched 500) / `markThreadMentionsAsRead` / `markAllMentionsAsRead`, and real-time `subscribeToUnreadMentions` / `subscribeToMentionCount` for the badge.

### 2.4 How to record a meeting with action items

`apps/web/src/app/flow/meetings/` + `meetingService.ts`:

1. `createMeeting(db, input, userId, userName, tenantId)` — `meetings` doc, `status: 'draft'`, with attendees, agenda, notes, optional project link.
2. `updateMeeting` / `deleteMeeting` — creator or attendee may update (FL-5); only the creator may delete (deletes action items in a batch). Real-time `subscribeToMeetings`.
3. `addActionItem(db, meetingId, input)` — each item has a description, an `action`, an assignee, optional due date and priority. `subscribeToActionItems`, `deleteActionItem`.
4. **Finalize** (`MeetingDetailClient.tsx` → `finalizeMeeting`): must be `draft`; caller must be creator or attendee (FL-5). Runs inside `runTransaction` (FL-6) so it is all-or-nothing: it requires at least one _actionable_ item (has both `action` and `assigneeId`), validates **every assignee is still an active user** (FL-10), then creates one `manualTask` (`status: 'todo'`, carrying `meetingId`/`meetingTitle`/`meetingDate`) per actionable item, writes `generatedTaskId` back onto each action item, and flips the meeting to `finalized`. Returns the count of tasks created.

### 2.5 How to use the Inbox

`apps/web/src/app/flow/inbox/page.tsx` subscribes (`subscribeToUserTasks`, `channelService.ts`) to the current user's `taskNotifications` in real time. Notifications are grouped by channel via `getChannelIdFromCategory` with filter chips (Procurement, Documents, Accounting, Approvals, HR, Enquiries, Proposals, Feedback, General) plus free-text search. Completing an actionable task uses `completeActionableTask(taskId, userId, false)` with **optimistic removal** (FL-17 — the card is hidden immediately and restored on error). Approval-category items are surfaced by `isApprovalCategory`.

---

## Part 3 — In-app Notifications

### 3.1 How notifications reach users

The unified engine is `apps/web/src/lib/tasks/taskNotificationService.ts` writing the `taskNotifications` collection. Every HR/Flow action above calls `createTaskNotification(input)`. Two kinds:

- **actionable** — appears as a to-do; lifecycle `pending → in_progress → completed` (`startActionableTask`, `completeActionableTask`; only the assigned `userId` may start/complete). `autoCompletable` items can be system-completed then user-confirmed (`confirmAutoCompletion`).
- **informational** — acknowledge-only (`acknowledgeInformational` → `acknowledged`).

Fan-out on an entity action is handled by `completeTaskNotificationsByEntity(entityType, entityId, userId)`, which marks all `pending`/`in_progress` notifications for that entity `completed` (e.g. when a leave request is approved, both approvers' tasks auto-complete). Counts/badges: `getUnreadCountSafe`, `getPendingActionCountSafe`, `getTaskNotificationSummary`. (`apps/web/src/lib/notifications/notificationService.ts` is a compatibility shim re-exporting the procurement-specific `notification/` module — deprecated.)

### 3.2 Email notifications (Cloud Functions)

`functions/src/email/triggers.ts` — Firestore `onDocumentUpdated`/`onDocumentCreated` triggers (region `us-central1`, Gmail SMTP, idempotency keyed on `event.id`). HR-relevant ones:

- `onLeaveNotify` (`hrLeaveRequests`): emails on `PENDING_APPROVAL`, on `PARTIALLY_APPROVED` (directs the remaining approver via `approvalFlow`), and on `APPROVED`/`REJECTED` (CCs the employee's `userEmail`).
- `onOnDutyNotify` — ⚠ Known gap: it listens on `document: 'onDutyRecords/{recordId}'`, but the app writes on-duty requests to `HR_ON_DUTY_REQUESTS` (`hrOnDutyRequests`) per `onDutyRequestService.ts`. The collection names do not match, so these on-duty emails **will not fire**. (In-app task notifications for on-duty still work.)
- `onTravelExpenseNotify` (`hrTravelExpenses`): emails on `SUBMITTED`, `APPROVED`/`REJECTED` (to the employee), and `REIMBURSED`.
- `onNewUserNotify` — new pending user → admin email.

Non-HR triggers cover PR/PO/amendment/RFQ/service-order/accounting/payment-batch/proposal/goods-receipt/enquiry/feedback events. There is no email trigger for Flow manual tasks, threads, mentions, or meetings — those are in-app only.

### 3.3 Agent-task expiry (adjacent automatic behaviour)

`functions/src/agentTaskExpiry.ts` — `expireStaleAgentTasks` runs **every 10 minutes** (`us-central1`), sweeping `agentTasks` in `PENDING` whose `expiresAt` has passed, transitioning them to `EXPIRED` with `decidedBy: 'system'`, decrementing the parent run's `hitlPendingCount`, and writing an audit row. This is HITL/agent infrastructure, not HR/Flow user tasks (see [admin doc](admin-and-permissions.md)).

---

## Part 4 — Lifecycle / Status Transition Tables

State machines are centralised in `apps/web/src/lib/workflow/stateMachines.ts`; leave and on-duty enforce transitions inline in their approval services rather than via the shared machine.

### 4.1 Leave request (`hrLeaveRequests`) — `leaveApprovalService.ts`

| From                                          | Action             | To                 | Who / permission                                                            |
| --------------------------------------------- | ------------------ | ------------------ | --------------------------------------------------------------------------- |
| DRAFT                                         | Submit             | PENDING_APPROVAL   | Owner only; adds days to `pending`                                          |
| DRAFT                                         | Edit / Delete      | DRAFT / CANCELLED  | Owner only                                                                  |
| PENDING_APPROVAL                              | Approve (1st of 2) | PARTIALLY_APPROVED | An approver in `approverIds`, **not the applicant** (`preventSelfApproval`) |
| PENDING_APPROVAL / PARTIALLY_APPROVED         | Approve (final)    | APPROVED           | Different approver; moves `pending`→`used`, notifies team                   |
| PENDING_APPROVAL / PARTIALLY_APPROVED         | Reject             | REJECTED           | Any approver; reason required; releases `pending`                           |
| DRAFT / PENDING_APPROVAL / PARTIALLY_APPROVED | Cancel             | CANCELLED          | Owner only; releases `pending`                                              |

Self-approval case: if applicant is a configured approver, only 1 approval (from the other) is required.

### 4.2 On-duty request (`hrOnDutyRequests`) — `onDutyApprovalService.ts`

| From                                   | Action          | To                 | Who / permission                                                        |
| -------------------------------------- | --------------- | ------------------ | ----------------------------------------------------------------------- |
| DRAFT                                  | Submit          | PENDING_APPROVAL   | Owner only                                                              |
| PENDING_APPROVAL                       | Approve (1st)   | PARTIALLY_APPROVED | Approver, not applicant (`preventSelfApproval`)                         |
| PENDING_APPROVAL / PARTIALLY_APPROVED  | Approve (final) | APPROVED           | Different approver; grants 1 comp-off (1-yr expiry)                     |
| PENDING_APPROVAL / PARTIALLY_APPROVED  | Reject          | REJECTED           | Any approver                                                            |
| DRAFT / PENDING / PARTIALLY / APPROVED | Cancel          | CANCELLED          | Owner; if APPROVED, only ≥1 day before holiday (comp-off not revoked ⚠) |

### 4.3 Travel expense report (`hrTravelExpenses`) — `travelExpenseStateMachine` + `travelExpenseApprovalService.ts`

| From                     | Action              | To                    | Who / permission                                                |
| ------------------------ | ------------------- | --------------------- | --------------------------------------------------------------- |
| DRAFT                    | Submit              | SUBMITTED             | Owner; ≥1 item; approvers exclude submitter                     |
| SUBMITTED / UNDER_REVIEW | Approve             | APPROVED              | Approver in `approverIds`, not employee (`preventSelfApproval`) |
| SUBMITTED / UNDER_REVIEW | Reject              | REJECTED              | Approver; reason required                                       |
| SUBMITTED / UNDER_REVIEW | Return for revision | DRAFT                 | Approver; clears approvers                                      |
| APPROVED                 | Mark reimbursed     | REIMBURSED (terminal) | Finance user                                                    |
| REJECTED                 | Re-edit             | DRAFT                 | Owner                                                           |

### 4.4 Manual task (`manualTasks`) — `manualTaskService.ts` (`ALLOWED_TRANSITIONS`, FL-7)

| From        | Action                    | To                             | Who                 |
| ----------- | ------------------------- | ------------------------------ | ------------------- |
| todo        | Start / Complete / Cancel | in_progress / done / cancelled | Creator or assignee |
| in_progress | Back / Complete / Cancel  | todo / done / cancelled        | Creator or assignee |
| done        | —                         | terminal                       | —                   |
| cancelled   | —                         | terminal                       | —                   |

Delete: creator only (FL-3). Completing `done` auto-completes linked notifications (FL-8).

### 4.5 Meeting (`meetings`) — `meetingService.ts`

| From  | Action   | To                   | Who                                                                   |
| ----- | -------- | -------------------- | --------------------------------------------------------------------- |
| draft | Edit     | draft                | Creator or attendee (FL-5)                                            |
| draft | Finalize | finalized (terminal) | Creator or attendee; ≥1 actionable item, all assignees active (FL-10) |
| draft | Delete   | (deleted)            | Creator only                                                          |

### 4.6 Task notification (`taskNotifications`) — `taskNotificationService.ts`

| From                    | Action      | To                    | Who                                                                  |
| ----------------------- | ----------- | --------------------- | -------------------------------------------------------------------- |
| pending (informational) | Acknowledge | acknowledged          | Recipient                                                            |
| pending (actionable)    | Start       | in_progress           | Assigned `userId` only                                               |
| pending / in_progress   | Complete    | completed             | Assigned `userId`, or system via `completeTaskNotificationsByEntity` |
| completed (auto)        | Confirm     | completed (confirmed) | Recipient                                                            |

---

## Part 5 — Automatic Behaviours & Permissions Summary

**Automatic side effects**

- **Leave balance annual reset** — cron Jan 1 IST, creates SICK+CASUAL only (⚠ COMP_OFF only via manual/lazy paths); `functions/src/hr/leaveBalanceReset.ts`.
- **Balance held/released automatically** on submit/approve/reject/cancel (`leaveBalanceService.ts`, transactional, never negative).
- **Comp-off granted automatically** on final on-duty approval and on holiday-working overrides, with a 1-year expiry grant record; ⚠ no scheduled expiry/revocation job.
- **Team-wide notifications** auto-created on leave/on-duty final approval.
- **Approver task notifications auto-completed** when an entity is decided (`completeTaskNotificationsByEntity`).
- **Meeting finalize** auto-generates manual tasks (transactional).
- **Manual-task done ⇄ linked notification completed** kept in sync both directions (FL-8).
- **Email triggers** fire on status changes for leave / travel-expense / new-user (and procurement/accounting/proposal); ⚠ on-duty email trigger listens on the wrong collection and won't fire.
- **Agent-task expiry** cron every 10 min (`agentTaskExpiry.ts`).

**Permissions per action**

- Edit employee profile/basic info → `MANAGE_HR_PROFILES` (HR-18), when `userPermissions2` supplied.
- Manage holidays / holiday settings → `canManageHRSettings(permissions2)`.
- Leave summary settings → `canManageHRSettings || canApproveLeaves`.
- Leave / on-duty / travel approvals → **identity-based**, not a permission flag: caller must be in the entity's `approverIds` (configured in `hrConfig/leaveSettings` or `hrConfig/travelExpenseSettings`) and cannot be the applicant (`preventSelfApproval`, HR-17). Self-service writes are gated by ownership in Firestore rules (the many `rule5-exempt` annotations document this).
- `manualResetLeaveBalances` / `seedLeaveTypes` callables → `MANAGE_USERS` (bit 1).
- Manual task edit → creator or assignee; delete → creator; meeting update/finalize → creator or attendee; delete → creator.
- Task-notification start/complete → the assigned recipient only.

**Cross-cutting known gaps**

1. On-duty email trigger collection mismatch (`onDutyRecords` vs `hrOnDutyRequests`).
2. No automated comp-off expiry/warning job despite `findExpiringCompOffs`.
3. Approved on-duty cancellation does not revoke granted comp-off.
4. Scheduled `resetLeaveBalances` omits COMP_OFF creation.
5. Employee edit permission check only enforced when `userPermissions2` is passed by the caller.
