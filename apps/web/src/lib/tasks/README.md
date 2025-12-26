# Tasks Module

Unified task and notification system for the Vapour Toolbox application.

## Overview

The tasks module provides a Slack-like notification and task management system:

1. **Task Notifications** - Actionable items requiring user attention
2. **Channels** - Project-based discussion channels
3. **Threads** - Threaded conversations on tasks
4. **Mentions** - @user notifications

## Directory Structure

```
tasks/
├── index.ts                      # Main barrel export
│
├── channelService.ts             # Project channel management
├── mentionService.ts             # @mention handling
├── taskNotificationService.ts    # Core notification system
├── taskNotificationService.test.ts
├── threadService.ts              # Threaded discussions
└── hooks/
    └── useTasks.ts               # React Query hooks
```

## Task Notification Categories

### Actionable Tasks

- `LEAVE_SUBMITTED` - Review and approve/reject leave
- `TRAVEL_EXPENSE_SUBMITTED` - Review expense report
- `PR_PENDING_APPROVAL` - Approve purchase request
- `PO_PENDING_APPROVAL` - Approve purchase order
- `DOCUMENT_FOR_REVIEW` - Review document
- `OFFER_RECEIVED` - Evaluate vendor offer

### Informational Notifications

- `LEAVE_APPROVED` - Your leave was approved
- `LEAVE_REJECTED` - Your leave was rejected
- `PO_ISSUED` - Purchase order issued
- `GR_APPROVED` - Goods receipt approved

## Task States

```
PENDING → IN_PROGRESS → COMPLETED / CANCELLED
```

## Key Services

### Task Notifications

```typescript
import { createTaskNotification, markTaskComplete, getMyPendingTasks } from '@/lib/tasks';
```

### Channels

```typescript
import { createProjectChannel, getProjectChannels, sendChannelMessage } from '@/lib/tasks';
```

### Threads

```typescript
import { createThread, addThreadReply, getThreadMessages } from '@/lib/tasks';
```

## Creating Notifications

```typescript
await createTaskNotification({
  category: 'LEAVE_SUBMITTED',
  title: 'Leave Request: John Doe',
  description: 'Sick leave for 2 days',
  assigneeId: managerId,
  priority: 'MEDIUM',
  relatedEntity: {
    type: 'leave',
    id: leaveId,
    name: 'Sick Leave Request',
  },
});
```

## Mention System

Use @username in thread messages to notify users:

```typescript
await addThreadReply(threadId, {
  content: '@john.doe Please review this',
  authorId: currentUserId,
});
// Automatically creates notification for john.doe
```

## Project Channels

Each project can have custom channels for team communication:

- **General** - Default project channel
- **Procurement** - Procurement discussions
- **Engineering** - Technical discussions
- Custom channels as needed

## Testing

```bash
pnpm --filter @vapour/web test src/lib/tasks
```

## Related Modules

- `@/lib/notifications` - Email/push notifications
- `@/lib/hr` - Leave/expense task integration
- `@/lib/procurement` - Approval workflow integration
