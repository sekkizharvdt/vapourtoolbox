# Phase 5: Flow Module Audit (Tasks/Inbox/Meetings)

**Status**: PENDING
**Priority**: Medium (recently redesigned — needs validation)

## Scope

### Service Files

- [ ] `apps/web/src/lib/tasks/manualTaskService.ts` — Manual task CRUD
- [ ] `apps/web/src/lib/tasks/taskNotificationService.ts` — Task notifications
- [ ] `apps/web/src/lib/tasks/meetingService.ts` — Meeting minutes
- [ ] `apps/web/src/lib/workflow/` — Workflow engine, state machines

### Pages (`apps/web/src/app/flow/`)

- [ ] Landing page (module hub)
- [ ] Tasks (list, create, detail)
- [ ] Inbox (notifications with filter chips)
- [ ] Team Board (member grid)
- [ ] Meeting Minutes (list, create, detail, finalize)

### Types

- [ ] ManualTask
- [ ] TaskNotification, TaskNotificationCategory
- [ ] Meeting, MeetingActionItem
- [ ] TASK_CHANNEL_DEFINITIONS

## Audit Checklist

### Security

- [ ] Tasks visible only to assigned user + creator + team members
- [ ] Meeting minutes visible only to attendees + creator
- [ ] Task reassignment respects permissions
- [ ] entityId filtering on all queries
- [ ] Can't complete/close someone else's task without permission
- [ ] Notification links don't expose entity IDs in URLs

### Data Integrity

- [ ] Task status transitions are valid (no skipping states)
- [ ] Meeting finalization is atomic (batch write for action items -> tasks)
- [ ] Completing a meeting action item updates the parent meeting
- [ ] Task notification auto-complete works for all categories
- [ ] No orphaned notifications (entity deleted but notification persists)
- [ ] TASK_CHANNEL_DEFINITIONS covers all notification categories
- [ ] Composite indexes for inbox queries (userId + channel + status)
- [ ] Team Board query returns correct data per member

### UX/Workflow

- [ ] Inbox filter chips work correctly for all channels
- [ ] "My Tasks" default view shows assigned tasks
- [ ] Task creation from meeting minutes works
- [ ] Meeting two-step creation flow is clear
- [ ] Meeting finalization shows confirmation
- [ ] Team Board handles members with no tasks gracefully
- [ ] Due date overdue indicators work
- [ ] Empty states for inbox/tasks/meetings

### Code Quality

- [ ] Consistent use of subscribeToX pattern for real-time updates
- [ ] No duplicate task/notification logic
- [ ] Meeting action item to task conversion is clean
- [ ] Filter chip logic is maintainable (adding new channels)

## Known Context

- Phase 1-4 of Flow redesign are complete
- Old components (WorkspaceSidebar, ChannelView, etc.) may still exist unused
- Default task view should be "My Tasks" (user preference)

## Findings

_To be filled during audit execution._
