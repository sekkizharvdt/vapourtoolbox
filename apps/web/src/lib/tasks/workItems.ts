/**
 * Work Items — the union behind "My Work"
 *
 * One list has to hold two different things: `taskNotifications` (derived from a
 * source document, closed by the workflow that owns it) and `manualTasks`
 * (authored by a person, closed by hand). Rather than merge the collections —
 * their lifecycles genuinely differ — this module maps both onto a `WorkItem`
 * discriminated union and answers the three questions the list asks:
 *
 *   - which triage group does it belong to (Needs you / Waiting / FYI)
 *   - which source did it come from (Meeting / Project / Procurement / …)
 *   - what can the user actually do to it
 *
 * Everything here is pure. No Firestore, no React — so the grouping rules are
 * unit-testable without an emulator. The subscription that feeds it lives in
 * `myWorkService.ts`.
 *
 * Plan: docs/reviews/2026-08-12-flow-my-work-plan.md (Phase 1)
 */

import {
  getChannelIdFromCategory,
  type ManualTask,
  type TaskNotification,
  type DefaultTaskChannelId,
} from '@vapour/types';
import type { Timestamp } from 'firebase/firestore';

// ============================================================================
// TYPES
// ============================================================================

/**
 * Triage groups — the default grouping.
 *
 * The primary split is not date or module but whether you are blocking someone
 * else. `TaskNotification` carries no `dueDate` (see plan D4), so a date-first
 * layout would strand most items in "no date".
 */
export type TriageGroup = 'needs-you' | 'waiting' | 'fyi';

/** Where the item came from, for the alternate "group by source" view. */
export type WorkItemSource =
  | 'meeting'
  | 'project'
  | 'proposal'
  | 'procurement'
  | 'accounting'
  | 'hr'
  | 'documents'
  | 'enquiries'
  | 'feedback'
  | 'general';

/** What the UI is allowed to offer on a row. */
export interface WorkItemActions {
  /** Tick it off by hand. False when a workflow owns the item's closure. */
  canComplete: boolean;
  /** Acknowledge an informational item so it leaves the list. */
  canDismiss: boolean;
  /** Only the creator may delete a manual task; notifications are never deleted. */
  canDelete: boolean;
}

interface WorkItemBase {
  id: string;
  title: string;
  /** Second line — the notification message, or a task's description. */
  subtitle?: string;
  priority: string;
  source: WorkItemSource;
  /** Human label for the source, e.g. a meeting or project name. */
  sourceLabel?: string;
  triage: TriageGroup;
  /** Where clicking the row goes. Manual tasks have no detail page yet. */
  linkUrl?: string;
  dueDate?: Timestamp;
  createdAt: Timestamp;
  actions: WorkItemActions;
}

export interface NotificationWorkItem extends WorkItemBase {
  kind: 'notification';
  notification: TaskNotification;
}

export interface TaskWorkItem extends WorkItemBase {
  kind: 'task';
  task: ManualTask;
}

export type WorkItem = NotificationWorkItem | TaskWorkItem;

// ============================================================================
// SOURCE MAPPING
// ============================================================================

/**
 * Channel ids and source ids overlap but are not identical: `approvals` is a
 * cross-cutting channel (a PO approval is still procurement work), and there is
 * no `meeting` channel because meetings only ever produce manual tasks.
 */
const CHANNEL_TO_SOURCE: Record<DefaultTaskChannelId, WorkItemSource> = {
  general: 'general',
  procurement: 'procurement',
  documents: 'documents',
  accounting: 'accounting',
  approvals: 'general',
  enquiries: 'enquiries',
  proposals: 'proposal',
  feedback: 'feedback',
  hr: 'hr',
};

export function notificationSource(notification: TaskNotification): WorkItemSource {
  const channel = getChannelIdFromCategory(notification.category);
  // `approvals` says how it reached you, not where it came from — fall back to
  // the entity type so a PO approval still groups under procurement.
  if (channel === 'approvals') {
    return entityTypeToSource(notification.entityType);
  }
  return CHANNEL_TO_SOURCE[channel] ?? 'general';
}

function entityTypeToSource(entityType: string): WorkItemSource {
  if (entityType.startsWith('HR_')) return 'hr';
  if (entityType.startsWith('DOCUMENT')) return 'documents';
  switch (entityType) {
    case 'PURCHASE_REQUEST':
    case 'PURCHASE_ORDER':
    case 'PURCHASE_ORDER_AMENDMENT':
    case 'RFQ':
    case 'GOODS_RECEIPT':
    case 'WORK_COMPLETION_CERTIFICATE':
      return 'procurement';
    case 'INVOICE':
    case 'BILL':
    case 'PAYMENT':
    case 'TRANSACTION':
      return 'accounting';
    case 'PROPOSAL':
      return 'proposal';
    case 'PROJECT':
      return 'project';
    case 'ENQUIRY':
      return 'enquiries';
    case 'FEEDBACK':
      return 'feedback';
    default:
      return 'general';
  }
}

/**
 * A manual task's source comes from the parent references rule 26 already
 * denormalizes onto it. Meeting wins over project: a task generated from a
 * project review meeting carries both, and the meeting is the more specific
 * origin.
 */
export function taskSource(task: ManualTask): { source: WorkItemSource; label?: string } {
  if (task.meetingId) return { source: 'meeting', label: task.meetingTitle };
  if (task.proposalId) return { source: 'proposal' };
  if (task.projectId) return { source: 'project', label: task.projectName };
  return { source: 'general' };
}

// ============================================================================
// TRIAGE
// ============================================================================

/**
 * Classify a notification for the given viewer.
 *
 * - informational → FYI, whoever it is for
 * - actionable and assigned to me → I owe it
 * - actionable, raised by me, owed by someone else → I am waiting (plan D3)
 *
 * `assignedBy` is populated on every notification (verified: 401/401 open), but
 * it records who *created* the notification rather than who is blocked — in a
 * two-approver chain the second request is attributed to the first approver.
 */
export function triageNotification(notification: TaskNotification, viewerId: string): TriageGroup {
  if (notification.type === 'informational') return 'fyi';
  if (notification.userId === viewerId) return 'needs-you';
  if (notification.assignedBy === viewerId) return 'waiting';
  // Actionable, someone else's, not raised by me — should not be in the
  // viewer's feed at all, but classify defensively rather than drop it.
  return 'fyi';
}

// ============================================================================
// MAPPERS
// ============================================================================

export function fromNotification(
  notification: TaskNotification,
  viewerId: string
): NotificationWorkItem {
  const triage = triageNotification(notification, viewerId);
  const isOpen = notification.status === 'pending' || notification.status === 'in_progress';

  return {
    kind: 'notification',
    notification,
    id: notification.id,
    title: notification.title,
    subtitle: notification.message,
    priority: notification.priority,
    source: notificationSource(notification),
    triage,
    linkUrl: notification.linkUrl,
    createdAt: notification.createdAt,
    actions: {
      // A workflow owns closure for autoCompletable items — offering a manual
      // tick would let the row disappear while the source document is still
      // waiting. (Two categories are autoCompletable with no workflow able to
      // close them; see plan D7.)
      canComplete: isOpen && notification.type === 'actionable' && !notification.autoCompletable,
      canDismiss: isOpen && notification.type === 'informational',
      canDelete: false,
    },
  };
}

export function fromManualTask(task: ManualTask, viewerId: string): TaskWorkItem {
  const { source, label } = taskSource(task);
  const isOpen = task.status === 'todo' || task.status === 'in_progress';

  return {
    kind: 'task',
    task,
    id: task.id,
    title: task.title,
    subtitle: task.description,
    priority: task.priority,
    source,
    sourceLabel: label,
    // A manual task is only ever in your list because it is assigned to you;
    // one you assigned to someone else is their work, and the Team Board shows
    // that. So it is always "needs you" while open, and FYI once closed.
    triage: isOpen ? 'needs-you' : 'fyi',
    dueDate: task.dueDate,
    createdAt: task.createdAt,
    actions: {
      canComplete: isOpen,
      canDismiss: false,
      canDelete: task.createdBy === viewerId,
    },
  };
}

// ============================================================================
// SORTING & GROUPING
// ============================================================================

const PRIORITY_RANK: Record<string, number> = {
  URGENT: 0,
  HIGH: 1,
  MEDIUM: 2,
  LOW: 3,
};

function toMillis(value?: Timestamp): number | null {
  if (!value) return null;
  // Firestore hands back a Timestamp at runtime even where the type says Date
  // (rule 14) — go through toMillis/toDate rather than assuming either.
  if (typeof (value as { toMillis?: () => number }).toMillis === 'function') {
    return (value as { toMillis: () => number }).toMillis();
  }
  if (typeof (value as { toDate?: () => Date }).toDate === 'function') {
    return (value as { toDate: () => Date }).toDate().getTime();
  }
  return null;
}

/**
 * Order within a group: dated items before undated (a date is a commitment),
 * earliest due first, then priority, then oldest first — age is the only
 * urgency signal a notification has, since it carries no due date.
 */
export function compareWorkItems(a: WorkItem, b: WorkItem): number {
  const aDue = toMillis(a.dueDate);
  const bDue = toMillis(b.dueDate);

  if (aDue !== null && bDue !== null && aDue !== bDue) return aDue - bDue;
  if (aDue !== null && bDue === null) return -1;
  if (aDue === null && bDue !== null) return 1;

  const aRank = PRIORITY_RANK[a.priority] ?? 99;
  const bRank = PRIORITY_RANK[b.priority] ?? 99;
  if (aRank !== bRank) return aRank - bRank;

  const aCreated = toMillis(a.createdAt) ?? 0;
  const bCreated = toMillis(b.createdAt) ?? 0;
  return aCreated - bCreated;
}

export function groupByTriage(items: WorkItem[]): Record<TriageGroup, WorkItem[]> {
  const groups: Record<TriageGroup, WorkItem[]> = {
    'needs-you': [],
    waiting: [],
    fyi: [],
  };

  items.forEach((item) => groups[item.triage].push(item));
  (Object.keys(groups) as TriageGroup[]).forEach((key) => groups[key].sort(compareWorkItems));

  return groups;
}

/**
 * Group by origin. Returns only the sources present, so the UI renders no empty
 * sections, each sorted the same way as the triage groups.
 */
export function groupBySource(
  items: WorkItem[]
): Array<{ source: WorkItemSource; items: WorkItem[] }> {
  const bySource = new Map<WorkItemSource, WorkItem[]>();

  items.forEach((item) => {
    const list = bySource.get(item.source);
    if (list) list.push(item);
    else bySource.set(item.source, [item]);
  });

  return [...bySource.entries()]
    .map(([source, list]) => ({ source, items: [...list].sort(compareWorkItems) }))
    .sort((a, b) => b.items.length - a.items.length || a.source.localeCompare(b.source));
}

/** True when the item is overdue — only manual tasks can be, today (plan D4). */
export function isOverdue(item: WorkItem, now: Date = new Date()): boolean {
  const due = toMillis(item.dueDate);
  if (due === null || !item.actions.canComplete) return false;

  const dueDate = new Date(due);
  // Date-only comparison, so an item due today is never "overdue" (FL-16)
  const dueDay = new Date(dueDate.getFullYear(), dueDate.getMonth(), dueDate.getDate());
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  return dueDay < today;
}
