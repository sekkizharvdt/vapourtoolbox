# Flow Module Enhancement Plan

## Overview

Two major features to implement:

1. **Weekly Priority Tasks** - Monday meeting task assignment system
2. **Email Notifications** - Email delivery for Flow module notifications

---

## Feature 1: Weekly Priority Tasks

### Purpose

Enable the Monday morning weekly meeting to assign priority tasks to team members, tagged with relevant context (project, proposal, accounting, etc.).

### Data Model

```typescript
// New interface: WeeklyPriorityTask
interface WeeklyPriorityTask {
  id: string;

  // Meeting context
  weekStartDate: Timestamp; // Monday of the week
  meetingId?: string; // Optional: Link to meeting record

  // Task content
  title: string;
  description: string;
  priority: 'LOW' | 'MEDIUM' | 'HIGH' | 'URGENT';

  // Assignment
  assigneeId: string;
  assigneeName: string;
  assignedById: string;
  assignedByName: string;

  // Module context (one of these)
  contextType:
    | 'PROJECT'
    | 'PROPOSAL'
    | 'ENQUIRY'
    | 'ACCOUNTING'
    | 'HR'
    | 'PROCUREMENT'
    | 'DOCUMENTS'
    | 'GENERAL';
  contextId?: string; // ID of project/proposal/etc.
  contextName?: string; // Display name

  // Status
  status: 'pending' | 'in_progress' | 'completed' | 'deferred';
  dueDate?: Timestamp;

  // Progress tracking
  progressNotes?: string;
  completedAt?: Timestamp;

  // Standard timestamps
  createdAt: Timestamp;
  updatedAt?: Timestamp;
}

// Optional: Meeting record
interface WeeklyMeeting {
  id: string;
  meetingDate: Timestamp;
  weekStartDate: Timestamp;
  attendees: string[]; // User IDs
  notes?: string;
  taskCount: number;
  createdById: string;
  createdByName: string;
  createdAt: Timestamp;
}
```

### Firestore Collections

```
weeklyPriorityTasks/
  - id
  - weekStartDate
  - title, description, priority
  - assigneeId, assigneeName
  - contextType, contextId, contextName
  - status, dueDate
  - createdAt, updatedAt

weeklyMeetings/  (optional)
  - id
  - meetingDate, weekStartDate
  - attendees[]
  - notes
  - taskCount
```

### UI Components

#### 1. Weekly Planning Page (`/app/flow/weekly/page.tsx`)

- **Header**: Week selector (default: current week)
- **Meeting Controls**: Start new meeting, add notes, list attendees
- **Task List**: All priority tasks for the selected week
- **Quick Add**: Form to add new priority task

#### 2. Add Priority Task Dialog

Fields:

- Title (required)
- Description (optional)
- Assignee (user selector - required)
- Priority (dropdown - default: MEDIUM)
- Context Type (dropdown: Project, Proposal, Enquiry, Accounting, etc.)
- Context Selector (conditional - project picker, proposal picker, etc.)
- Due Date (optional)

#### 3. My Priorities View (in Flow sidebar)

- Shows current user's priority tasks for the week
- Can update status, add progress notes

#### 4. Priority Task Card

- Title, priority badge
- Assignee avatar + name
- Context chip (e.g., "Project: CMCE Ghana")
- Status indicator
- Due date (if set)

### Integration with Existing Flow Module

1. **New Channel**: Add "priorities" channel to default channels
2. **Workspace**: Priority tasks appear in relevant project workspace OR in a "Company" workspace
3. **Navigation**: Add "Weekly Planning" link in Flow sidebar

### Service Layer

```typescript
// weeklyPlanningService.ts

// Meetings
createWeeklyMeeting(meetingDate: Date, attendees: string[]): Promise<string>
getWeeklyMeetings(startDate: Date, endDate: Date): Promise<WeeklyMeeting[]>
getCurrentWeekMeeting(): Promise<WeeklyMeeting | null>

// Priority Tasks
createPriorityTask(input: CreatePriorityTaskInput): Promise<string>
updatePriorityTask(taskId: string, updates: Partial<WeeklyPriorityTask>): Promise<void>
deletePriorityTask(taskId: string): Promise<void>

getPriorityTasksForWeek(weekStart: Date): Promise<WeeklyPriorityTask[]>
getUserPriorityTasks(userId: string, weekStart?: Date): Promise<WeeklyPriorityTask[]>
getPriorityTasksByContext(contextType: string, contextId: string): Promise<WeeklyPriorityTask[]>

updateTaskStatus(taskId: string, status: string, notes?: string): Promise<void>
completeTask(taskId: string): Promise<void>

// Subscriptions
subscribeToWeeklyTasks(weekStart: Date, callback: (tasks) => void): Unsubscribe
subscribeToUserPriorityTasks(userId: string, callback: (tasks) => void): Unsubscribe
```

### Implementation Phases

**Phase 1: Core Data Model & Service (1-2 days)**

- Add types to `@vapour/types`
- Create `weeklyPlanningService.ts`
- Add Firestore security rules

**Phase 2: Weekly Planning UI (2-3 days)**

- Create `/app/flow/weekly/` page
- Add priority task dialog
- Week selector component
- Task list with filtering

**Phase 3: Flow Integration (1 day)**

- Add "priorities" channel
- My Priorities sidebar view
- Priority task cards

**Phase 4: Context Linking (1 day)**

- Project selector integration
- Proposal/Enquiry selector
- Module-based filtering

---

## Feature 2: Email Notifications

### Current State

- No email infrastructure exists
- All notifications are in-app only
- Firebase Cloud Functions are already set up

### Options Analysis

#### Option A: Firebase + SendGrid (Recommended)

**Pros:**

- Industry standard for transactional email
- Firebase extension available
- Excellent deliverability
- Free tier: 100 emails/day

**Cons:**

- Requires SendGrid account setup
- API key management

**Implementation:**

```typescript
// Cloud Function approach
import * as sgMail from '@sendgrid/mail';

export const sendTaskNotificationEmail = functions.firestore
  .document('taskNotifications/{taskId}')
  .onCreate(async (snap, context) => {
    const task = snap.data();
    const user = await getUser(task.userId);

    if (user.emailNotifications !== false) {
      await sgMail.send({
        to: user.email,
        from: 'notifications@vapourtoolbox.com',
        templateId: getTemplateId(task.category),
        dynamicTemplateData: {
          userName: user.displayName,
          taskTitle: task.title,
          taskMessage: task.message,
          actionUrl: `https://app.vapourtoolbox.com${task.linkUrl}`,
          priority: task.priority,
        },
      });
    }
  });
```

#### Option B: Firebase Extension - "Trigger Email"

**Pros:**

- No code needed for basic emails
- Built into Firebase
- Uses any SMTP (Gmail, SendGrid, etc.)

**Cons:**

- Less control over templates
- Harder to customize

**Implementation:**

```typescript
// Write to mail collection, extension sends automatically
await addDoc(collection(db, 'mail'), {
  to: user.email,
  template: {
    name: 'taskNotification',
    data: { task, user },
  },
});
```

#### Option C: Resend (Modern Alternative)

**Pros:**

- Modern API, React email templates
- Great developer experience
- Generous free tier

**Cons:**

- Newer service
- Less documentation

### Recommended Approach: SendGrid via Cloud Functions

### Email Types

| Trigger                | Email Type        | Recipients                   |
| ---------------------- | ----------------- | ---------------------------- |
| New actionable task    | Task Assignment   | Assignee                     |
| Task approaching due   | Reminder          | Assignee                     |
| Task completed         | Completion Notice | Assigner                     |
| @mention in thread     | Mention Alert     | Mentioned user               |
| Priority task assigned | Priority Alert    | Assignee                     |
| Weekly summary         | Digest            | All users with pending tasks |

### User Preferences

```typescript
// Add to User type or create UserPreferences
interface EmailPreferences {
  taskAssignments: boolean; // Default: true
  taskReminders: boolean; // Default: true
  mentions: boolean; // Default: true
  priorityAlerts: boolean; // Default: true
  weeklyDigest: boolean; // Default: true
  digestDay: 'MONDAY' | 'FRIDAY'; // Default: MONDAY
}
```

### Email Templates

1. **Task Assignment**
   - Subject: "[Priority] Task Assigned: {title}"
   - Body: Task details, context, due date, action button

2. **Priority Task**
   - Subject: "[Weekly Priority] {title}"
   - Body: Priority level, context, notes, action button

3. **Mention Alert**
   - Subject: "{userName} mentioned you in {taskTitle}"
   - Body: Message preview, thread link

4. **Weekly Digest**
   - Subject: "Your Week: {pendingCount} pending tasks"
   - Body: Summary table, priority items, overdue items

### Implementation Phases

**Phase 1: Infrastructure Setup (1 day)**

- Create SendGrid account
- Add API key to Firebase secrets
- Install `@sendgrid/mail` in functions

**Phase 2: Basic Email Service (1-2 days)**

- Create `emailService.ts` in Cloud Functions
- Implement `sendTaskEmail()` function
- Add Firestore trigger for taskNotifications

**Phase 3: Email Templates (1-2 days)**

- Create SendGrid dynamic templates
- Design responsive email layouts
- Test across email clients

**Phase 4: User Preferences (1 day)**

- Add EmailPreferences to user profile
- Create preferences UI in settings
- Respect preferences in email triggers

**Phase 5: Digest Emails (1 day)**

- Scheduled Cloud Function (weekly)
- Aggregate pending tasks per user
- Send personalized digest

### Firebase Function Structure

```
functions/
  src/
    email/
      emailService.ts      # Core send functions
      templates.ts         # Template IDs and helpers
      triggers/
        taskNotification.ts  # On task create
        mention.ts           # On mention create
        priorityTask.ts      # On priority task create
      scheduled/
        weeklyDigest.ts      # Cron job for digest
```

### Security Considerations

1. **API Key Storage**: Use Firebase Secret Manager
2. **Rate Limiting**: Prevent email flooding
3. **Unsubscribe**: Include in all emails
4. **GDPR**: Respect opt-out preferences

---

## Combined Implementation Timeline

| Week | Feature 1: Weekly Planning       | Feature 2: Emails                   |
| ---- | -------------------------------- | ----------------------------------- |
| 1    | Phase 1-2: Core + UI             | Phase 1-2: Infrastructure + Service |
| 2    | Phase 3-4: Integration + Linking | Phase 3-4: Templates + Preferences  |
| 3    | Testing + Polish                 | Phase 5: Digest + Testing           |

**Total Estimate: 2-3 weeks for both features**

---

## Questions for Discussion

### Weekly Planning

1. Should priority tasks integrate with existing taskNotifications or be separate?
2. Do we need meeting minutes/notes feature?
3. Should completed tasks roll over or archive weekly?
4. Who can create priority tasks? (Admin only vs all users)

### Email Notifications

1. Which email provider preference? (SendGrid recommended)
2. What domain for sending? (notifications@vapourtoolbox.com)
3. Should emails include company branding/logo?
4. Frequency limits? (e.g., max 10 emails/day per user)

---

## Files to Create/Modify

### Feature 1: Weekly Planning

```
packages/types/src/
  └── weeklyPlanning.ts           # New types

apps/web/src/
  ├── app/flow/weekly/
  │   ├── page.tsx                # Weekly planning page
  │   └── components/
  │       ├── WeekSelector.tsx
  │       ├── PriorityTaskList.tsx
  │       ├── PriorityTaskCard.tsx
  │       └── AddPriorityTaskDialog.tsx
  └── lib/tasks/
      └── weeklyPlanningService.ts
```

### Feature 2: Emails

```
functions/src/
  └── email/
      ├── emailService.ts
      ├── templates.ts
      ├── triggers/
      │   ├── taskNotification.ts
      │   ├── mention.ts
      │   └── priorityTask.ts
      └── scheduled/
          └── weeklyDigest.ts

apps/web/src/
  └── app/settings/
      └── notifications/
          └── page.tsx            # Email preferences UI
```
