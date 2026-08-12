# Flow — "My Work": triage-grouped list, source grouping, dismissible informationals

**Date:** 2026-08-12
**Status:** Phase 0 implemented (uncommitted); backfill dry-run only. D2/D4/D5 still open.
**Motivation:** My Tasks and Inbox are two lists of work you owe. Project- and
proposal-generated tasks are coming, and there is no obvious list for them to land in.

---

## 1. Where we actually are (measured, 2026-08-12)

Live Firestore, project `vapour-toolbox`:

|                                  | `taskNotifications` (`/flow/inbox`) | `manualTasks` (`/flow/tasks`) |
| -------------------------------- | ----------------------------------- | ----------------------------- |
| Total docs                       | 425                                 | 12                            |
| Open (`pending` + `in_progress`) | **401**                             | 11                            |
| Ever completed                   | 24                                  | 1                             |
| Split                            | 315 actionable / 86 informational   | all actionable                |
| Due date field                   | **none on the type**                | `dueDate?: Timestamp`         |
| Oldest open item                 | 2025-12-11                          | —                             |

Open items by source document:

| entityType       | open | entityType                  | open |
| ---------------- | ---- | --------------------------- | ---- |
| FEEDBACK         | 221  | RFQ                         | 8    |
| HR_LEAVE_REQUEST | 72   | HR_TRAVEL_EXPENSE           | 5    |
| PURCHASE_REQUEST | 24   | WORK_COMPLETION_CERTIFICATE | 4    |
| PURCHASE_ORDER   | 22   | BILL                        | 4    |
| PROPOSAL         | 15   | PURCHASE_ORDER_AMENDMENT    | 1    |
| INVOICE          | 14   |                             |      |
| GOODS_RECEIPT    | 11   |                             |      |

**Two structural causes, both verified in code:**

1. **Informational notifications have no exit.** `/flow/inbox` imports only
   `completeActionableTask`. `acknowledgeInformational` and
   `acknowledgeAllInformational` already exist in
   `lib/tasks/taskNotificationService.ts` with **zero callers**. 86 items can never
   leave the list.
2. **The close calls exist in procurement/projects/proposals — they just never
   match.** _(Corrected 2026-08-12 — the first pass read this as "no close call at
   all", which was wrong and would have led to duplicate wiring.)_ Eight sites in
   `purchaseRequest/workflow.ts` (2), `proposals/approvalWorkflow.ts` (4),
   `projects/charterApprovalService.ts` (1) and one more looked up their task with
   `findTaskNotificationByEntity(..., 'in_progress')`. Notifications are created
   `pending` and only reach `in_progress` via `startActionableTask`, which **no UI
   calls** — `/flow/inbox` imports `completeActionableTask` alone and `TaskCard` has
   no Start control. So the lookup matched nothing, every time.

   `returnPOForRevision` and the GR payment-clearance path already did it correctly
   (plural finder, `['pending','in_progress']`) and were left alone.
   `approvePO`/`rejectPO`, `approveAmendment`/`rejectAmendment` and
   `completeRFQ`/`cancelRFQ` had no close call at all.

Anything built on top of this backlog inherits it. Phase 0 is not optional.

**Also relevant — dead code around the live system (rule 32):**

- `components/tasks/TaskNotificationList.tsx`, `TaskNotificationItem.tsx` and
  `TaskNotificationBell` are mounted nowhere — a complete unused second inbox UI.
- `lib/notifications/notification/helpers.ts` exposes 12 `notifyPRSubmitted`-style
  wrappers over the live `createTaskNotification`, re-exported by
  `lib/notifications/notificationService.ts` and imported by nothing outside
  `lib/notifications/`. Verified 2026-08-12. Harmless today, but a second creation
  path waiting for someone to call it — which would bypass whatever auto-close
  wiring Phase 0.2 adds.

---

## 2. Target

One surface, **`/flow` → "My Work"**, listing everything you owe: actionable
notifications + open manual tasks, in one stream.

**Default grouping — triage:**

- **Needs you** — `type: 'actionable'`, `userId == me`, open; plus open `manualTasks`
  assigned to me. Sorted: overdue first, then due date, then age.
- **Waiting on others** — `type: 'actionable'`, `assignedBy == me`, `userId != me`,
  open. In v1 (D3): 21 items today for the primary user.
- **FYI** — `type: 'informational'`. Collapsed by default, with **Dismiss** and
  **Dismiss all**.

**Alternate grouping — source:** Meeting · Project · Proposal · Procurement ·
Accounting · HR · Feedback, each collapsible with a count. Derived from
`getChannelIdFromCategory()` for notifications (already exists) and from
`meetingId`/`projectId`/`proposalId` on manual tasks (rule 26 already denormalizes
these). A segmented control switches grouping; the choice is URL state via
`window.history.replaceState` (rule 30b).

Not adopted: date sections (Todoist). `TaskNotification` has no `dueDate`, so 315 of
326 actionable items would sit in "No date". Revisit if D4 adds one.

---

## 3. Phases

### Phase 0 — IMPLEMENTED 2026-08-12 (uncommitted)

| Item                                                                                                                                                                                                        | State         |
| ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------- |
| 0.1 Dismissal wired (`Dismiss` per row, `Dismiss all` scoped to the current filter, confirm dialog, optimistic with rollback); `acknowledgeInformationalBatch` chunks at 500 and skips non-dismissable docs | done          |
| 0.2 Feedback: close → `completeTaskNotificationsByEntity`; re-resolve reuses the open task                                                                                                                  | done          |
| 0.2 PR approve/reject, proposals ×4, charter: `in_progress`-only lookup replaced                                                                                                                            | done          |
| 0.2 PO first-approve / approve / reject; amendment approve/reject; RFQ complete/cancel: close calls added                                                                                                   | done          |
| 0.4 Dry run at `scripts/analysis/notification-backlog-dryrun.js`                                                                                                                                            | ran read-only |

**Dry-run result (2026-08-12):** of 401 open, **350** have a source document already
in a terminal state, and **76** informational items are older than 30 days. Applying
both would leave **~51** — the genuinely live queue. Nothing has been written.

| entityType                  | open | source already terminal |
| --------------------------- | ---- | ----------------------- |
| FEEDBACK                    | 221  | 211                     |
| HR_LEAVE_REQUEST            | 72   | 64                      |
| PURCHASE_REQUEST            | 24   | 22                      |
| PURCHASE_ORDER              | 22   | 14                      |
| PROPOSAL                    | 15   | 0                       |
| INVOICE                     | 14   | 14                      |
| GOODS_RECEIPT               | 11   | 11                      |
| RFQ                         | 8    | 6                       |
| HR_TRAVEL_EXPENSE           | 5    | 3                       |
| WORK_COMPLETION_CERTIFICATE | 4    | 0                       |
| BILL                        | 4    | 4                       |
| PURCHASE_ORDER_AMENDMENT    | 1    | 1                       |

**Two categories cannot be fixed by wiring — they need a decision (D7).**
`WCC_READY_FOR_BILLING` (4 open) and `DOCUMENT_INTERNAL_REVIEW` are created with
`autoCompletable: true`, but **no workflow exists that could complete them** — there
is no WCC→bill path (only GR→bill), and no document-review completion function. And
because `TaskCard.canComplete` excludes `autoCompletable` items, the UI hides the
Complete button too. These items can be closed by nobody, by any route. Either build
the missing workflow step, or drop `autoCompletable` so a human can tick them off.

### Phase 0 — original scope (prerequisite)

0.1 **Wire dismissal.** Per-item **Dismiss** on informational rows; **Dismiss all**
scoped to the current filter/group. Calls the existing
`acknowledgeInformational` / `acknowledgeAllInformational`. No schema change:
`status: 'acknowledged'`, `acknowledgedAt` and `read` already exist, and
`subscribeToUserTasks` already filters to `['pending','in_progress']`, so dismissed
items leave the list with no new query. Never hard-delete.
Bulk path must chunk at 500 writes (rule 20) — `acknowledgeAllInformational`
currently fires unbounded `Promise.all`; fix while wiring.

0.2 **Auto-close at the source.** Add `completeTaskNotificationsByEntity` calls to
the workflows that lack them, following the HR/accounting pattern exactly:

| Service                                   | Trigger                              |
| ----------------------------------------- | ------------------------------------ |
| `procurement/purchaseRequest/workflow.ts` | approve / reject / return            |
| `procurement/purchaseOrder/workflow.ts`   | approve / reject / changes-requested |
| `procurement/goodsReceiptService.ts`      | GR completed, bill created           |
| `procurement/rfq/workflow.ts`             | offers evaluated / vendor selected   |
| `procurement/amendment/crud.ts`           | amendment approved / rejected        |
| `procurement/workCompletionService.ts`    | WCC billed                           |
| `projects/charterApprovalService.ts`      | charter approved / rejected          |
| `documents/submissionService.ts`          | submission closed                    |
| `proposals/approvalWorkflow.ts`           | proposal approved / rejected         |

0.3 **Feedback noise (221 items, 55% of the backlog).** See D1.

0.4 **One-off backfill** under `scripts/analysis/`: for every open notification whose
source document is already in a terminal state, complete it; acknowledge every
informational item older than 30 days. Read-only dry-run first, counts reported
before writing.

**Exit criteria:** open notifications for this user under ~15, and no category that
can only grow.

### Phase 1 — the union model

1.1 `lib/tasks/workItems.ts` — a `WorkItem` discriminated union
(`{ kind: 'notification' } | { kind: 'task' }`) with the fields the list needs:
title, subtitle, source, priority, dueDate?, linkUrl, triageGroup, and the actions
each kind supports. Pure functions, unit-tested, no Firestore.

1.2 `subscribeToMyWork(userId, tenantId, cb)` — fans in the two existing
subscriptions (`subscribeToUserTasks`, `subscribeToMyTasks`), merges, sorts. No new
collection, no new index beyond D3.

1.3 Triage classification as a pure function over `WorkItem` — testable without the
emulator, which is where the group definitions get pinned down.

### Phase 2 — the page

2.1 Build **My Work** at `/flow`, on the inbox's codebase (it owns the live
subscription, filters and search), with `CreateTaskDialog` ported over from
`/flow/tasks`. `/flow/inbox` and `/flow/tasks` become redirects. One canonical
surface (rule 32), not a third one. `PageHeader` + `FilterBar` (rule 34). Under
`output: 'export'` the redirects are static pages that `router.replace('/flow')` on
mount — verify against rule 30's placeholder behaviour before relying on them.

2.2 One row component for both kinds, replacing `TaskCard` and `ManualTaskCard`:
complete/dismiss control on the left, title + source badge + due date, actions on
hover. Group headers sticky with counts.

2.3 Source-driven items are **not hand-completable** — respect the existing
`autoCompletable` flag: those rows offer "Open" and (if informational) "Dismiss",
never "Mark done". A manual task keeps its checkbox.

2.4 Delete the unmounted `TaskNotificationList` / `TaskNotificationItem` /
`TaskNotificationBell` (rule 32), or mount the bell against the same union model.
Delete `lib/notifications/notification/helpers.ts` and `notificationService.ts` in
the same pass — a second creation path that bypasses Phase 0.2's auto-close wiring.

### Phase 3 — automatic project/proposal tasks

3.1 They are created as **notifications**, not manual tasks, so the source can close
them (a deliverable's status drives its own item). They appear in "Needs you" for
free.

3.2 New categories go in `TaskNotificationCategory` **and** on a channel in
`TASK_CHANNEL_DEFINITIONS` — a category on no channel routes nowhere. Labels in
`@vapour/constants/labels.ts` (rule 29).

---

## 4. Open decisions

**D1 — Feedback notifications (221 open, 55% of the backlog).** Audited 2026-08-12 —
**this is a bug, not a notification-volume policy.** All 221 are one category,
`FEEDBACK_RESOLUTION_CHECK`, created when feedback reaches `resolved` so the reporter
can verify the fix. Breakdown by the source item's current status:

| Source feedback status                     | Open notifications |
| ------------------------------------------ | ------------------ |
| **closed**                                 | **211**            |
| resolved (genuinely awaiting the reporter) | 8                  |
| in_progress                                | 2                  |

None has ever completed, and each is created with `autoCompletable: true` — closing a
feedback item simply never calls `completeTaskNotificationsByEntity('FEEDBACK', …)`.
Re-resolving also creates a duplicate rather than reusing the open one (one doc has 4;
rule 9). Feedback corpus for scale: 292 docs — 270 closed, 8 resolved, 7 in_progress,
7 new.

Folds into Phase 0.2 (wire close → complete, make re-resolve idempotent) and Phase 0.4
(backfill the 211).

**Remaining decision:** does an admin closing a feedback item auto-complete the
reporter's verify task, or must the reporter confirm? Proposed: auto-complete — the
reporter already receives the `resolved` notification and can reopen via follow-up.
Requiring confirmation is what produced the 211-item pile.

**D2 — Which surface absorbs which?** Proposed (awaiting confirmation): **neither —
My Work is served at `/flow`**, and `/flow/inbox` and `/flow/tasks` both redirect to
it so existing links survive.

- Inbox contributes the engine: live subscription, 10 category filter chips, search,
  optimistic completion, and the only one proven at 400 items. My Tasks is a 3-tab
  list over 11 rows.
- My Tasks contributes the create flow (`CreateTaskDialog`); the inbox has none.
- Neither name is accurate for the merged list — "Inbox" excludes what you authored,
  "My Tasks" excludes what the system generated. **My Work** is the honest name.
- `/flow` is currently a `ModuleLandingPage` of five cards whose destinations are all
  already in the sidebar — it costs a click and adds nothing. Trade-off: Flow stops
  matching the other modules' landing-page convention. Judged correct here, because
  Accounting/Procurement are catalogs of tools to navigate while Flow is one list you
  live in. Team Board, Meetings and Portfolio keep their own routes.

**D3 — Is "Waiting on others" in v1? — RESOLVED 2026-08-12: yes.** Audited, and the
data settles it:

- `assignedBy` is populated on **401 of 401** open notifications (100%). Every
  service writes it on every create — PO 5/5, PR 4/4, RFQ 2/2, amendment 1/1,
  charter 3/3, submission 1/1, accounting 3/3, proposals 4/4.
- Definition: `type == 'actionable' AND assignedBy == me AND userId != me AND status
open`. The `actionable` filter matters — for the primary user today the raw
  `assignedBy` match is 61 items, but 40 of those are informational
  ("your X was approved") and belong in FYI. **21 are genuine waiting-on-others.**
- Cost: one query plus one composite index `(assignedBy ASC, status ASC, createdAt
DESC)` (rule 2). No schema change, no backfill.
- **Known limitation:** `assignedBy` records who _created_ the notification, not who
  is blocked. In a two-approver PO chain the second approver's item is attributed to
  the first approver, not to the originator. Acceptable for v1; do not describe the
  group as "everything I am waiting on".
- 5 open items have `assignedBy == userId` (self-notification); excluded by the
  `userId != me` clause.

**D4 — Do notifications get a `dueDate`?** `TaskNotification` has only `createdAt`,
so "overdue" can apply to the 11 manual tasks and nothing else, and date sections stay
off the table. Two honest sources for a date:

- explicit at each of the 24 `createTaskNotification` call sites — most have no
  natural date (a PO awaiting approval is aging, not due);
- a derived SLA table in `@vapour/constants` (category → days), computed at render,
  no writes to existing docs, reversible.

Proposed: **no for v1.** Sort "Needs you" by age and render "waiting 6 days" — the
oldest open item is 2025-12-11, so age already tells the story. Revisit with the SLA
table after the backlog clears. A nullable field added later is cheap; a field
written inconsistently across 24 call sites is not.

**D5 — Auto-acknowledge on read?** Note that `read: boolean` and
`status: 'acknowledged'` are separate fields, so "seen" and "dismissed" are
independently trackable. Proposed: **no auto-acknowledge on render.** Set `read: true`
on render (drives the unread badge), keep `acknowledged` explicit, and make bulk
clearing cheap via Dismiss all scoped to the current group/filter. Rendering is not
reading — 20 FYI rows scroll past in one flick, and some of them matter ("your PR was
rejected"). If less clicking is still wanted, the safer variant is time-based: a
scheduled function acknowledging informational items older than N days.

---

**D6 — Sequencing, and who authorises the backfill.** Phase 0 stands alone: it clears
~300 stale items using today's UI, with no redesign. Proposed: ship Phase 0 first and
live with it for a few days, so the triage groups get designed against a real
workload rather than a backlog. Phases 1–3 follow as one piece.

The backfill (0.4) writes to production — roughly 211 feedback completions plus
whatever the source-status sweep finds — and it touches other people's inboxes, not
just yours: the open feedback items sit with two other users (115 and 100). It needs
an explicit go-ahead, a dry-run count reviewed first, and a record of what it changed.

**D7 — the un-closable categories.** `WCC_READY_FOR_BILLING` and
`DOCUMENT_INTERNAL_REVIEW` are `autoCompletable: true` with no workflow able to
complete them and no manual Complete button. Proposed: drop `autoCompletable` on both
so they can be ticked off by hand, and treat the WCC→bill path as separate product
work rather than blocking the backlog clean-up on it.

## 5. Rules this touches

2 (composite index for any new `where`+`orderBy`), 3 (no `!=` soft-delete filters),
9 (idempotent completes), 20 (chunk bulk writes at 500), 27 (no silent catches —
the inbox subscription currently has none), 29 (status labels from constants),
30b (`history.replaceState` for group/filter URL state), 32 (one canonical surface;
delete the dead notification UI), 34 (PageHeader / FilterBar / StatusChip / useToast).
