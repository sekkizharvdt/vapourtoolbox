# Task Module - Slack-Like Interface Plan

## Overview

Transform the existing task module into a Slack-like interface with project-based workspaces, module-based channels, threaded discussions, @mentions, and real-time updates. The MVP focuses on reorganizing the UI and adding collaboration features while preserving the existing task notification infrastructure.

## Key Decisions (Confirmed)

- **Structure**: Project-based workspaces with module-based channels within each project
- **Proposals**: "Pre-Sales" workspace for enquiries and proposals (before project exists)
- **Channels**: Hybrid approach - default channels (procurement, documents, etc.) + custom channels per project
- **Thread Storage**: Top-level `taskThreads` collection (better for querying, long-term scalability)
- **My Tasks View**: Yes - shows all tasks assigned to current user across ALL projects/channels
- **Auto-tagging**: Future feature - requires approver selector first
- **File sharing**: Links to Document Management module only
- **Real-time**: Firebase subscriptions
- **Permissions**: Channel visibility respects existing module permissions

## Architecture

### Hierarchy

```
Workspaces (Project-level)
├── PRJ-001 - Singapore Project
│   ├── #general (project-wide announcements)
│   ├── #procurement (PRs, RFQs, POs, GRs)
│   ├── #documents (document reviews, submissions)
│   ├── #engineering (technical tasks)
│   ├── #accounting (invoices, bills, payments)
│   └── #approvals (cross-module approval tasks)
│
├── PRJ-002 - Malaysia Project
│   └── ... (same channel structure)
│
└── Pre-Sales (Special Workspace)
    ├── #enquiries
    └── #proposals
```

### Channel Mapping

| Module       | Channel Name | Task Categories                           |
| ------------ | ------------ | ----------------------------------------- |
| Procurement  | #procurement | PR*\*, RFQ*_, PO\__, GOODS*\*, PAYMENT*\* |
| Documents    | #documents   | DOCUMENT*\*, WORK_ITEM*_, SUPPLY*LIST*_   |
| Accounting   | #accounting  | INVOICE*\*, BILL*_, PAYMENT\__            |
| Projects     | #general     | PROJECT*\*, MILESTONE*_, DELIVERABLE\__   |
| Proposals    | #proposals   | PROPOSAL*\*, ENQUIRY*\*                   |
| Cross-module | #approvals   | All approval-type tasks                   |

### Permission Inheritance

Users only see channels for modules they have permission to access:

- User with `PROCUREMENT` permission → sees #procurement channel
- User with `DOCUMENTS` permission → sees #documents channel
- User without module permission → channel is hidden
- Project-level permissions control workspace visibility

---

## Navigation Approach

The Tasks module will have its **own dedicated layout** - when entering `/tasks`:

- The main app sidebar (modules list) will be **collapsed/hidden**
- The workspace sidebar (projects + channels) becomes the primary navigation
- A toggle/button allows returning to full app navigation
- Similar to how Slack hides non-workspace navigation when focused

### Layout Structure

```
┌─────────────────────────────────────────────────────────────┐
│ Header (existing)                                            │
├──────────┬──────────────────────────────────────────────────┤
│ Workspace│ Channel Header: #procurement - Singapore Project  │
│ Sidebar  ├──────────────────────────────────────────────────┤
│          │                                                   │
│ Projects │ Task Cards (filtered by channel)                  │
│ ├ PRJ-001│ ┌─────────────────────────────────────────────┐  │
│ │ #general│ │ PR-2024-001 needs approval                  │  │
│ │ #procure│ │ @john.doe • 2h ago • HIGH                   │  │
│ │ #docs   │ │ [View Thread (3)] [Start] [Approve]         │  │
│ │ #account│ └─────────────────────────────────────────────┘  │
│ ├ PRJ-002│                                                   │
│ └ ...    │ ┌─────────────────────────────────────────────┐  │
│          │ │ RFQ-2024-015 - Vendor offers received        │  │
│ Pre-Sales│ │ @jane.smith • 5h ago • MEDIUM                │  │
│ ├ #enquir│ │ [View Thread (1)] [Evaluate]                 │  │
│ └ #propos│ └─────────────────────────────────────────────┘  │
│          │                                                   │
│ ──────── │ Thread Panel (slides in from right)              │
│ My Tasks │ ┌─────────────────────────────────────────────┐  │
│ @Mentions│ │ Thread: PR-2024-001                          │  │
│          │ │ ─────────────────────────────────────────── │  │
│          │ │ John: Please review the specs               │  │
│          │ │ Jane: @mike can you check pricing?          │  │
│          │ │ Mike: Approved. Looks good.                 │  │
│          │ │ ─────────────────────────────────────────── │  │
│          │ │ [Type a message... @mention]         [Send] │  │
│          │ └─────────────────────────────────────────────┘  │
└──────────┴──────────────────────────────────────────────────┘
```

---

## Data Model

### New Types (packages/types/src/task.ts)

```typescript
// Channel definition (derived, not stored for defaults)
interface TaskChannel {
  id: string; // e.g., 'procurement', 'documents'
  name: string;
  icon: string;
  categories: TaskNotificationCategory[];
}

// Thread for discussions
interface TaskThread {
  id: string;
  taskNotificationId: string;
  projectId: string;
  channelId: string;
  messageCount: number;
  lastMessageAt: Timestamp;
  createdAt: Timestamp;
  updatedAt: Timestamp;
}

// Message in a thread
interface TaskMessage {
  id: string;
  threadId: string;
  userId: string;
  userName: string;
  userAvatar?: string;
  content: string;
  mentions: string[]; // userIds mentioned
  createdAt: Timestamp;
  editedAt?: Timestamp;
}

// Mention notification
interface TaskMention {
  id: string;
  messageId: string;
  threadId: string;
  taskNotificationId: string;
  mentionedUserId: string;
  mentionedByUserId: string;
  mentionedByName: string;
  read: boolean;
  createdAt: Timestamp;
}
```

### Firebase Collections

```
taskNotifications (existing)
└── {taskId}

taskThreads (NEW - top-level for better querying)
└── {threadId}
    ├── taskNotificationId: string
    ├── projectId: string
    ├── channelId: string
    ├── messageCount: number
    ├── lastMessageAt: Timestamp
    └── createdAt: Timestamp

taskMessages (NEW - top-level)
└── {messageId}
    ├── threadId: string
    ├── userId: string
    ├── content: string
    ├── mentions: string[]
    └── createdAt: Timestamp

taskMentions (NEW)
└── {mentionId}
    ├── mentionedUserId: string
    ├── messageId: string
    ├── threadId: string
    ├── read: boolean
    └── createdAt: Timestamp

projectChannels (NEW - for custom channels only)
└── {channelId}
    ├── projectId: string
    ├── name: string
    ├── isDefault: boolean
    ├── icon: string
    └── createdAt: Timestamp
```

---

## Implementation Phases

### PHASE A: Workspace Sidebar + Channel View (First Priority)

#### Step A1: Types & Constants

- Add ProjectChannel interface for custom channels
- Add TASK_CHANNELS constant mapping categories to default channels
- Add channel icons and display names
- Add TaskChannelView type for UI state

#### Step A2: Firebase Setup for Channels

- Add `projectChannels` to COLLECTIONS constant
- Add Firestore indexes for channel queries
- Update security rules for channels

#### Step A3: Channel Service

- Create channelService.ts (get default + custom channels)
- Update taskNotificationService.ts (add channel grouping helper)
- Add getTasksByProjectAndChannel() function

#### Step A4: Tasks Layout Restructure

- Create TasksLayout.tsx (hides main sidebar, shows workspace sidebar)
- Update /tasks/page.tsx to use new layout
- Add toggle button to return to main app navigation

#### Step A5: Workspace Sidebar

- Create WorkspaceSidebar component
- Fetch projects and create "workspace" entries
- Add "Pre-Sales" workspace for proposals/enquiries
- Collapsible project sections with channel lists
- Show unread counts per channel
- Add "My Tasks" quick filter (cross-project)

#### Step A6: Channel View

- Create ChannelView component
- Create ChannelHeader component (channel name, description, search)
- Create compact TaskCard component
- Filter tasks by project + channel
- Real-time subscription for task updates

#### Step A7: My Tasks View

- Create MyTasksView component
- Query all tasks assigned to current user
- Group by project/channel for context
- Include time tracking stats

---

### PHASE B: Approver Selector (Second Priority)

#### Step B1: ApproverSelector Component

- Create ApproverSelector.tsx (reusable user picker)
- Fetch users by role/permission
- Autocomplete with search
- Show user avatar, name, role

#### Step B2: Procurement Integration

- Add ApproverSelector to PR submission (EditPRClient.tsx)
- Add ApproverSelector to PO creation
- Update task creation to use selected approver

#### Step B3: Document Integration

- Add ApproverSelector to document review assignment
- Update document task creation

#### Step B4: Accounting Integration

- Add ApproverSelector to invoice/bill approval flows
- Update accounting task creation

---

### PHASE C: Thread/Comment System (Third Priority)

#### Step C1: Thread Types & Firebase

- Add TaskThread, TaskMessage, TaskMention types
- Add collections to COLLECTIONS constant
- Add Firestore indexes for threads/messages/mentions
- Update security rules

#### Step C2: Thread Services

- Create threadService.ts (CRUD for threads/messages)
- Create mentionService.ts (create mention, mark read, query)
- Add real-time subscription helpers

#### Step C3: Thread UI Components

- Create TaskThread component (slide-in panel)
- Create ThreadMessage component
- Create MessageInput with @mention detection
- Create MentionPopover for user selection

#### Step C4: @Mentions View

- Add "@Mentions" section to workspace sidebar
- Create MentionsView component
- Show unread mention count in sidebar

#### Step C5: Polish & Testing

- Add loading states and error handling
- Mobile responsive adjustments
- Keyboard shortcuts

---

## Critical Files to Modify

### Types

- `packages/types/src/task.ts` - Add new interfaces

### Firebase

- `packages/firebase/src/collections.ts` - Add new collections
- `firestore.indexes.json` - Add indexes
- `firestore.rules` - Add security rules

### Services

- `apps/web/src/lib/tasks/taskNotificationService.ts` - Add channel grouping
- `apps/web/src/lib/tasks/channelService.ts` - NEW
- `apps/web/src/lib/tasks/threadService.ts` - NEW
- `apps/web/src/lib/tasks/mentionService.ts` - NEW

### UI Components

- `apps/web/src/app/tasks/page.tsx` - Restructure layout
- `apps/web/src/app/tasks/layout.tsx` - NEW (custom layout)
- `apps/web/src/app/tasks/components/` - All new components

### Module Integration (for ApproverSelector)

- `apps/web/src/lib/procurement/purchaseRequest/workflow.ts` - Add approver selection
- `apps/web/src/app/procurement/purchase-requests/[id]/edit/` - Add ApproverSelector

---

## Proposals Handling

Proposals don't belong to a project yet (they ARE the pre-project stage):

**"Pre-Sales" Workspace** contains:

- #enquiries - New enquiry assignments, follow-ups
- #proposals - Proposal drafts, approvals, client responses

When a proposal is converted to a project, related tasks automatically move to the new project's channels.

---

## Future Enhancements (Post-MVP)

1. **Auto-tagging/Assignment Rules** - Define rules like "Engineering approvals go to @engineering-head"
2. **Workflow Templates** - Pre-defined approval chains per task type
3. **Notifications** - Push notifications, email digests
4. **Search** - Global search across all channels/threads
5. **Pinned Messages** - Important announcements per channel
6. **Reactions** - Emoji reactions on messages
7. **Direct Messages** - User-to-user messaging

---

## Existing Task Infrastructure (Preserved)

The following existing task infrastructure remains unchanged and continues to work:

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

### Cloud Functions (Already Exist)

- `functions/src/taskAutoCompletion/purchaseRequestAutoComplete.ts` ✓
- `functions/src/taskAutoCompletion/purchaseOrderAutoComplete.ts` ✓
- `functions/src/taskAutoCompletion/documentAutoComplete.ts` ✓
- `functions/src/taskAutoCompletion/invoiceAutoComplete.ts` ✓

---

## Task Notification Points by Module (Reference)

### Procurement Module

| Step                 | Action                            | Task Category                 | Auto-completable | Status             |
| -------------------- | --------------------------------- | ----------------------------- | ---------------- | ------------------ |
| PR Created           | Engineer submits PR for approval  | `PR_SUBMITTED`                | Yes              | ⚠️ Commented out   |
| PR Approved/Rejected | Approver reviews PR               | `PR_APPROVED` / `PR_REJECTED` | No               | ⚠️ Partial         |
| RFQ Issued           | Procurement issues RFQ to vendors | `RFQ_ISSUED`                  | No               | ❌ Not implemented |
| Offer Received       | Vendor submits offer              | `OFFER_RECEIVED`              | No               | ❌ Not implemented |
| Offer Evaluation     | Procurement compares offers       | `OFFER_EVALUATION_REQUIRED`   | Yes              | ❌ Not implemented |
| PO Created           | PO submitted for approval         | `PO_PENDING_APPROVAL`         | Yes              | ⚠️ Partial         |
| PO Approved/Rejected | Approver reviews PO               | `PO_APPROVED` / `PO_REJECTED` | No               | ⚠️ Partial         |
| GR Created           | Goods received at site            | `GR_CREATED`                  | No               | ❌ Not implemented |
| WCC Created          | Work completion certified         | `WCC_CREATED`                 | No               | ❌ Not implemented |
| Three-Way Match      | Match PO/GR/Invoice               | `THREE_WAY_MATCH_REQUIRED`    | Yes              | ❌ Not implemented |
| Payment Request      | Finance processes payment         | `PAYMENT_REQUESTED`           | Yes              | ⚠️ Backend only    |

### Documents Module

| Step              | Action                         | Task Category                  | Auto-completable | Status                    |
| ----------------- | ------------------------------ | ------------------------------ | ---------------- | ------------------------- |
| Document Assigned | PM assigns doc to engineer     | `DOCUMENT_ASSIGNED`            | Yes              | ❌ Web app doesn't create |
| Work In Progress  | Engineer works on document     | -                              | -                | Time tracking available   |
| Internal Review   | Engineer submits for PM review | `DOCUMENT_INTERNAL_REVIEW`     | Yes              | ❌ Web app doesn't create |
| PM Approved       | PM approves for client         | `DOCUMENT_PM_APPROVED`         | No               | ❌ Not implemented        |
| Client Submission | Doc sent to client             | `DOCUMENT_SUBMITTED_TO_CLIENT` | No               | ❌ Not implemented        |
| Client Commented  | Client returns with comments   | `DOCUMENT_CLIENT_COMMENTED`    | Yes              | ❌ Web app doesn't create |
| Client Approved   | Client approves document       | `DOCUMENT_CLIENT_APPROVED`     | No               | ❌ Not implemented        |
| Revision Required | Doc needs revision             | `DOCUMENT_REVISION_REQUIRED`   | Yes              | ❌ Not implemented        |

### Proposals Module

| Step               | Action                       | Task Category        | Auto-completable | Status     |
| ------------------ | ---------------------------- | -------------------- | ---------------- | ---------- |
| Enquiry Received   | New enquiry logged           | `ENQUIRY_RECEIVED`   | No               | ✅ Working |
| Enquiry Assigned   | Enquiry assigned to engineer | `ENQUIRY_ASSIGNED`   | Yes              | ✅ Working |
| Proposal Created   | Engineer creates proposal    | `PROPOSAL_CREATED`   | No               | ✅ Working |
| Proposal Submitted | Proposal sent for approval   | `PROPOSAL_SUBMITTED` | Yes              | ✅ Working |
| Proposal Approved  | Director approves            | `PROPOSAL_APPROVED`  | No               | ✅ Working |
| Proposal Rejected  | Director rejects             | `PROPOSAL_REJECTED`  | No               | ✅ Working |

### Accounting Module

| Step             | Action                       | Task Category               | Auto-completable | Status             |
| ---------------- | ---------------------------- | --------------------------- | ---------------- | ------------------ |
| Invoice Created  | Invoice needs approval       | `INVOICE_APPROVAL_REQUIRED` | Yes              | ❌ Backend only    |
| Invoice Approved | Invoice approved             | `INVOICE_APPROVED`          | No               | ❌ Not implemented |
| Bill Created     | Bill needs processing        | `BILL_APPROVAL_REQUIRED`    | Yes              | ❌ Backend only    |
| Payment Due      | Payment deadline approaching | `PAYMENT_DUE`               | No               | ❌ Not implemented |

### Projects Module

| Step                  | Action                           | Task Category            | Auto-completable | Status             |
| --------------------- | -------------------------------- | ------------------------ | ---------------- | ------------------ |
| Milestone Due         | Milestone deadline approaching   | `MILESTONE_DUE`          | No               | ❌ Not implemented |
| Deliverable Due       | Deliverable deadline approaching | `DELIVERABLE_DUE`        | No               | ❌ Not implemented |
| Project Status Update | Periodic status required         | `STATUS_UPDATE_REQUIRED` | Yes              | ❌ Not implemented |

---

_Last Updated: November 2024_
