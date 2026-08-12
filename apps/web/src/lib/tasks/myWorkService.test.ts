/**
 * Tests for myWorkService — the My Work fan-in.
 *
 * The risky parts are not the queries but the merge: three streams arriving in
 * any order, an item that legitimately appears in two of them, and a stream
 * that fails without the page pretending everything is clear.
 */

import type { ManualTask, TaskNotification } from '@vapour/types';
import type { Timestamp } from 'firebase/firestore';

// --- Firestore: capture the waiting-on-others listener ----------------------
type SnapshotHandler = (snapshot: { docs: Array<{ id: string; data: () => unknown }> }) => void;
type ErrorHandler = (error: Error) => void;

let waitingOnNext: SnapshotHandler | null = null;
let waitingOnError: ErrorHandler | null = null;
const mockUnsubscribeWaiting = jest.fn();

jest.mock('firebase/firestore', () => ({
  collection: jest.fn(() => 'collection-ref'),
  query: jest.fn(() => 'query-ref'),
  where: jest.fn(() => 'where-clause'),
  orderBy: jest.fn(() => 'order-clause'),
  onSnapshot: (_query: unknown, next: SnapshotHandler, error: ErrorHandler) => {
    waitingOnNext = next;
    waitingOnError = error;
    return mockUnsubscribeWaiting;
  },
}));

// --- The two existing subscriptions ----------------------------------------
type NotificationHandler = (notifications: TaskNotification[]) => void;
type TaskHandler = (tasks: ManualTask[]) => void;

let notificationsNext: NotificationHandler | null = null;
let tasksNext: TaskHandler | null = null;
let tasksError: ((error: Error) => void) | null = null;
const mockUnsubscribeNotifications = jest.fn();
const mockUnsubscribeTasks = jest.fn();

jest.mock('./channelService', () => ({
  subscribeToUserTasks: (_userId: string, next: NotificationHandler) => {
    notificationsNext = next;
    return mockUnsubscribeNotifications;
  },
}));

jest.mock('./manualTaskService', () => ({
  subscribeToMyTasks: (
    _db: unknown,
    _tenantId: string,
    _userId: string,
    next: TaskHandler,
    error: (err: Error) => void
  ) => {
    tasksNext = next;
    tasksError = error;
    return mockUnsubscribeTasks;
  },
}));

jest.mock('./taskNotificationService', () => ({
  docToTaskNotification: (id: string, data: Record<string, unknown>) => ({ id, ...data }),
}));

jest.mock('@vapour/firebase', () => ({
  COLLECTIONS: { TASK_NOTIFICATIONS: 'taskNotifications' },
}));

jest.mock('@vapour/logger', () => ({
  createLogger: () => ({ error: jest.fn(), warn: jest.fn(), info: jest.fn(), debug: jest.fn() }),
}));

import { subscribeToMyWork, type MyWorkSnapshot } from './myWorkService';

const ME = 'user-me';
const OTHER = 'user-other';
// Asserted via an identifier, not an object literal, so the lint rule that
// bans `{ ... } as T` is satisfied.
const dbStub = {};
const db = dbStub as never;

function ts(iso: string): Timestamp {
  const date = new Date(iso);
  const stub = { toMillis: () => date.getTime(), toDate: () => date };
  return stub as unknown as Timestamp;
}

function notification(overrides: Partial<TaskNotification> = {}): TaskNotification {
  const base: TaskNotification = {
    id: 'n-1',
    type: 'actionable',
    category: 'PO_PENDING_APPROVAL',
    userId: ME,
    assignedBy: OTHER,
    title: 'Approve PO',
    message: 'Needs approval',
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

describe('subscribeToMyWork', () => {
  let updates: MyWorkSnapshot[];
  let unsubscribe: () => void;

  beforeEach(() => {
    jest.clearAllMocks();
    waitingOnNext = null;
    waitingOnError = null;
    notificationsNext = null;
    tasksNext = null;
    tasksError = null;
    updates = [];
    unsubscribe = subscribeToMyWork(db, 'default-entity', ME, (snapshot) => updates.push(snapshot));
  });

  const latest = () => updates[updates.length - 1]!;

  it('reports loaded only once all three streams have answered', () => {
    notificationsNext!([]);
    expect(latest().loaded).toBe(false);

    tasksNext!([]);
    expect(latest().loaded).toBe(false);

    waitingOnNext!({ docs: [] });
    expect(latest().loaded).toBe(true);
  });

  it('merges the three streams into one list', () => {
    notificationsNext!([notification({ id: 'mine' })]);
    tasksNext!([manualTask({ id: 'task' })]);
    // The query is `assignedBy == me`, so everything on this stream was raised
    // by the viewer — the fixture has to say so.
    waitingOnNext!({
      docs: [
        { id: 'theirs', data: () => notification({ id: 'theirs', userId: OTHER, assignedBy: ME }) },
      ],
    });

    expect(
      latest()
        .items.map((i) => i.id)
        .sort()
    ).toEqual(['mine', 'task', 'theirs']);
    expect(latest().items.find((i) => i.id === 'theirs')!.triage).toBe('waiting');
  });

  it('deduplicates a notification I raised for myself, keeping it in needs-you', () => {
    // 5 such self-notifications exist in production; they arrive on both streams.
    const selfRaised = notification({ id: 'self', userId: ME, assignedBy: ME });
    notificationsNext!([selfRaised]);
    waitingOnNext!({ docs: [{ id: 'self', data: () => selfRaised }] });
    tasksNext!([]);

    expect(latest().items).toHaveLength(1);
    expect(latest().items[0]!.triage).toBe('needs-you');
  });

  it('keeps informational and self-owned rows out of the waiting stream', () => {
    notificationsNext!([]);
    tasksNext!([]);
    waitingOnNext!({
      docs: [
        {
          id: 'fyi',
          data: () =>
            notification({ id: 'fyi', type: 'informational', userId: OTHER, assignedBy: ME }),
        },
        { id: 'mine', data: () => notification({ id: 'mine', userId: ME, assignedBy: ME }) },
        { id: 'real', data: () => notification({ id: 'real', userId: OTHER, assignedBy: ME }) },
      ],
    });

    expect(latest().items.map((i) => i.id)).toEqual(['real']);
  });

  it('drops cancelled manual tasks', () => {
    notificationsNext!([]);
    waitingOnNext!({ docs: [] });
    tasksNext!([manualTask({ id: 'live' }), manualTask({ id: 'gone', status: 'cancelled' })]);

    expect(latest().items.map((i) => i.id)).toEqual(['live']);
  });

  it('surfaces a failed waiting stream instead of showing an empty group', () => {
    notificationsNext!([notification({ id: 'mine' })]);
    tasksNext!([]);
    waitingOnError!(new Error('The query requires an index.'));

    // The index ships with the next deploy; until then the two groups the user
    // acts on must still render, with the failure visible.
    expect(latest().error).toBe('The query requires an index.');
    expect(latest().loaded).toBe(true);
    expect(latest().items.map((i) => i.id)).toEqual(['mine']);
  });

  it('surfaces a failed manual-task stream', () => {
    notificationsNext!([]);
    waitingOnNext!({ docs: [] });
    tasksError!(new Error('Missing or insufficient permissions.'));

    expect(latest().error).toBe('Missing or insufficient permissions.');
    expect(latest().loaded).toBe(true);
  });

  it('tears down every listener', () => {
    unsubscribe();

    expect(mockUnsubscribeNotifications).toHaveBeenCalledTimes(1);
    expect(mockUnsubscribeTasks).toHaveBeenCalledTimes(1);
    expect(mockUnsubscribeWaiting).toHaveBeenCalledTimes(1);
  });
});
