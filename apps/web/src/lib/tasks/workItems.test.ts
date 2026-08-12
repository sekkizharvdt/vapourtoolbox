/**
 * Tests for workItems — the My Work union model.
 *
 * These pin down the grouping rules, which are the part of the design most
 * likely to drift: what counts as "waiting on others", when a row may be ticked
 * off by hand, and how items order inside a group.
 */

import type { Timestamp } from 'firebase/firestore';
import type { ManualTask, TaskNotification } from '@vapour/types';
import {
  compareWorkItems,
  fromManualTask,
  fromNotification,
  groupBySource,
  groupByTriage,
  isOverdue,
  notificationSource,
  taskSource,
  triageNotification,
} from './workItems';

const ME = 'user-me';
const OTHER = 'user-other';

/** Minimal Timestamp stand-in — only toMillis/toDate are ever called. */
function ts(iso: string): Timestamp {
  const date = new Date(iso);
  const stub = {
    toMillis: () => date.getTime(),
    toDate: () => date,
  };
  return stub as unknown as Timestamp;
}

function notification(overrides: Partial<TaskNotification> = {}): TaskNotification {
  const base: TaskNotification = {
    id: 'n-1',
    type: 'actionable',
    category: 'PO_PENDING_APPROVAL',
    userId: ME,
    assignedBy: OTHER,
    title: 'Approve PO/2026/001',
    message: 'Waiting for your approval',
    priority: 'HIGH',
    entityType: 'PURCHASE_ORDER',
    entityId: 'po-1',
    linkUrl: '/procurement/pos/po-1',
    status: 'pending',
    read: false,
    autoCompletable: false,
    completionConfirmed: false,
    createdAt: ts('2026-08-01T10:00:00Z'),
  };
  return { ...base, ...overrides };
}

function manualTask(overrides: Partial<ManualTask> = {}): ManualTask {
  const base: ManualTask = {
    id: 't-1',
    title: 'Data sheet generation',
    createdBy: ME,
    createdByName: 'Me',
    assigneeId: ME,
    assigneeName: 'Me',
    status: 'todo',
    priority: 'HIGH',
    tenantId: 'default-entity',
    createdAt: ts('2026-08-01T10:00:00Z'),
  };
  return { ...base, ...overrides };
}

describe('triageNotification', () => {
  it('puts an actionable item assigned to me in needs-you', () => {
    expect(triageNotification(notification({ userId: ME }), ME)).toBe('needs-you');
  });

  it('puts an actionable item I raised for someone else in waiting', () => {
    expect(triageNotification(notification({ userId: OTHER, assignedBy: ME }), ME)).toBe('waiting');
  });

  it('keeps informational items in fyi even when I raised them', () => {
    // The 40 "your X was approved" items are informational — they are not work
    // anyone is waiting on, so they must not inflate the Waiting group.
    expect(
      triageNotification(notification({ type: 'informational', userId: OTHER, assignedBy: ME }), ME)
    ).toBe('fyi');
  });

  it('does not claim an item that is neither mine nor raised by me', () => {
    expect(triageNotification(notification({ userId: OTHER, assignedBy: OTHER }), ME)).toBe('fyi');
  });
});

describe('notificationSource', () => {
  it('routes an approval back to the module it came from, not to "approvals"', () => {
    // PO_PENDING_APPROVAL lives on the approvals channel, but a PO approval is
    // procurement work — grouping by source must say procurement.
    expect(notificationSource(notification({ category: 'PO_PENDING_APPROVAL' }))).toBe(
      'procurement'
    );
  });

  it('maps HR entity types to hr', () => {
    expect(
      notificationSource(
        notification({ category: 'LEAVE_SUBMITTED', entityType: 'HR_LEAVE_REQUEST' })
      )
    ).toBe('hr');
  });

  it('maps feedback', () => {
    expect(
      notificationSource(
        notification({ category: 'FEEDBACK_RESOLUTION_CHECK', entityType: 'FEEDBACK' })
      )
    ).toBe('feedback');
  });
});

describe('taskSource', () => {
  it('prefers the meeting over the project when a task carries both', () => {
    const result = taskSource(
      manualTask({
        meetingId: 'm-1',
        meetingTitle: 'MDL review',
        projectId: 'p-1',
        projectName: 'Desolenator',
      })
    );
    expect(result).toEqual({ source: 'meeting', label: 'MDL review' });
  });

  it('falls back to the project', () => {
    expect(taskSource(manualTask({ projectId: 'p-1', projectName: 'Desolenator' }))).toEqual({
      source: 'project',
      label: 'Desolenator',
    });
  });

  it('is general with no parent references', () => {
    expect(taskSource(manualTask())).toEqual({ source: 'general' });
  });
});

describe('fromNotification actions', () => {
  it('offers a manual complete on an ordinary actionable item', () => {
    expect(fromNotification(notification(), ME).actions).toEqual({
      canComplete: true,
      canDismiss: false,
      canDelete: false,
    });
  });

  it('withholds complete when a workflow owns closure', () => {
    // autoCompletable means the source document closes it; a hand-tick would
    // hide the row while the work is still outstanding.
    expect(fromNotification(notification({ autoCompletable: true }), ME).actions.canComplete).toBe(
      false
    );
  });

  it('offers dismiss on informational items only', () => {
    const actions = fromNotification(notification({ type: 'informational' }), ME).actions;
    expect(actions.canDismiss).toBe(true);
    expect(actions.canComplete).toBe(false);
  });

  it('offers nothing once the item is completed', () => {
    const actions = fromNotification(notification({ status: 'completed' }), ME).actions;
    expect(actions).toEqual({ canComplete: false, canDismiss: false, canDelete: false });
  });

  it('never offers delete — notifications belong to their source', () => {
    expect(fromNotification(notification(), ME).actions.canDelete).toBe(false);
  });
});

describe('fromManualTask', () => {
  it('is needs-you while open and completable', () => {
    const item = fromManualTask(manualTask(), ME);
    expect(item.triage).toBe('needs-you');
    expect(item.actions.canComplete).toBe(true);
  });

  it('moves to fyi and stops being completable once done', () => {
    const item = fromManualTask(manualTask({ status: 'done' }), ME);
    expect(item.triage).toBe('fyi');
    expect(item.actions.canComplete).toBe(false);
  });

  it('treats a legacy in_progress task as open', () => {
    // `in_progress` is no longer reachable from the UI, but older docs have it.
    expect(fromManualTask(manualTask({ status: 'in_progress' }), ME).triage).toBe('needs-you');
  });

  it('allows delete only for the creator', () => {
    expect(fromManualTask(manualTask({ createdBy: ME }), ME).actions.canDelete).toBe(true);
    expect(fromManualTask(manualTask({ createdBy: OTHER }), ME).actions.canDelete).toBe(false);
  });
});

describe('compareWorkItems', () => {
  it('puts dated items before undated ones', () => {
    const dated = fromManualTask(manualTask({ id: 'a', dueDate: ts('2026-09-01T00:00:00Z') }), ME);
    const undated = fromNotification(notification({ id: 'b' }), ME);
    expect([undated, dated].sort(compareWorkItems)[0]!.id).toBe('a');
  });

  it('orders by due date first', () => {
    const later = fromManualTask(manualTask({ id: 'a', dueDate: ts('2026-09-10T00:00:00Z') }), ME);
    const sooner = fromManualTask(manualTask({ id: 'b', dueDate: ts('2026-09-01T00:00:00Z') }), ME);
    expect([later, sooner].sort(compareWorkItems)[0]!.id).toBe('b');
  });

  it('falls back to priority, then to age', () => {
    const low = fromNotification(notification({ id: 'a', priority: 'LOW' }), ME);
    const urgent = fromNotification(notification({ id: 'b', priority: 'URGENT' }), ME);
    expect([low, urgent].sort(compareWorkItems)[0]!.id).toBe('b');

    const newer = fromNotification(
      notification({ id: 'c', createdAt: ts('2026-08-10T00:00:00Z') }),
      ME
    );
    const older = fromNotification(
      notification({ id: 'd', createdAt: ts('2026-01-10T00:00:00Z') }),
      ME
    );
    // Age is the only urgency signal a notification has — oldest first.
    expect([newer, older].sort(compareWorkItems)[0]!.id).toBe('d');
  });
});

describe('groupByTriage', () => {
  it('splits a mixed feed into the three groups', () => {
    const items = [
      fromNotification(notification({ id: 'mine', userId: ME }), ME),
      fromNotification(notification({ id: 'theirs', userId: OTHER, assignedBy: ME }), ME),
      fromNotification(notification({ id: 'fyi', type: 'informational' }), ME),
      fromManualTask(manualTask({ id: 'task' }), ME),
    ];

    const groups = groupByTriage(items);

    expect(groups['needs-you'].map((i) => i.id).sort()).toEqual(['mine', 'task']);
    expect(groups.waiting.map((i) => i.id)).toEqual(['theirs']);
    expect(groups.fyi.map((i) => i.id)).toEqual(['fyi']);
  });

  it('returns every group even when empty', () => {
    const groups = groupByTriage([]);
    expect(Object.keys(groups).sort()).toEqual(['fyi', 'needs-you', 'waiting']);
  });
});

describe('groupBySource', () => {
  it('returns only sources present, biggest first', () => {
    const items = [
      fromNotification(notification({ id: 'po-1', entityType: 'PURCHASE_ORDER' }), ME),
      fromNotification(notification({ id: 'po-2', entityType: 'PURCHASE_ORDER' }), ME),
      fromManualTask(manualTask({ id: 'm-1', meetingId: 'meet-1' }), ME),
    ];

    const groups = groupBySource(items);

    expect(groups.map((g) => g.source)).toEqual(['procurement', 'meeting']);
    expect(groups[0]!.items).toHaveLength(2);
  });
});

describe('isOverdue', () => {
  const now = new Date('2026-08-12T09:00:00Z');

  it('is true for a past due date', () => {
    const item = fromManualTask(manualTask({ dueDate: ts('2026-08-01T00:00:00Z') }), ME);
    expect(isOverdue(item, now)).toBe(true);
  });

  it('is false on the due date itself', () => {
    const item = fromManualTask(manualTask({ dueDate: ts('2026-08-12T23:00:00Z') }), ME);
    expect(isOverdue(item, now)).toBe(false);
  });

  it('is false for a completed task, however old', () => {
    const item = fromManualTask(
      manualTask({ status: 'done', dueDate: ts('2026-01-01T00:00:00Z') }),
      ME
    );
    expect(isOverdue(item, now)).toBe(false);
  });

  it('is false for notifications, which carry no due date', () => {
    expect(isOverdue(fromNotification(notification(), ME), now)).toBe(false);
  });
});
