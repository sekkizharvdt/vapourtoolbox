/**
 * Meeting Service Tests
 *
 * Covers Track B (weekly review cadence):
 * - finalizeMeeting propagates the meeting's projectId/projectName onto
 *   generated ManualTasks (B1)
 * - selectCarryForwardItems / computeNextReviewDate / deriveNextReviewTitle /
 *   buildCarryForwardAgenda pure functions (B2)
 * - startNextReview idempotency via nextMeetingId (B2, rule 9)
 */

import type { Timestamp, Firestore } from 'firebase/firestore';
import type { MeetingActionItem, ManualTaskStatus } from '@vapour/types';

// ============================================================================
// Mocks
// ============================================================================

const mockGetDoc = jest.fn();
const mockGetDocs = jest.fn();
const mockRunTransaction = jest.fn();

jest.mock('firebase/firestore', () => ({
  collection: jest.fn((_db: unknown, name: string) => ({ collection: name })),
  doc: jest.fn((dbOrColl: unknown, name?: string, id?: string) => {
    if (name === undefined) {
      // doc(collectionRef) — new auto-ID ref
      return { id: 'new-meeting-id', collection: dbOrColl };
    }
    return { doc: name, id: id ?? 'auto' };
  }),
  addDoc: jest.fn(),
  getDoc: (...args: unknown[]) => mockGetDoc(...args),
  getDocs: (...args: unknown[]) => mockGetDocs(...args),
  updateDoc: jest.fn(),
  deleteDoc: jest.fn(),
  query: jest.fn((...args: unknown[]) => ({ query: args })),
  where: jest.fn((field: string, op: string, value: unknown) => ({ where: [field, op, value] })),
  orderBy: jest.fn((field: string, dir?: string) => ({ orderBy: [field, dir] })),
  onSnapshot: jest.fn(),
  writeBatch: jest.fn(),
  runTransaction: (...args: unknown[]) => mockRunTransaction(...args),
  Timestamp: {
    now: jest.fn(() => ({
      seconds: 1735689600,
      nanoseconds: 0,
      toDate: () => new Date('2025-01-01T00:00:00Z'),
      toMillis: () => new Date('2025-01-01T00:00:00Z').getTime(),
    })),
    fromDate: jest.fn((d: Date) => ({
      toDate: () => d,
      toMillis: () => d.getTime(),
      seconds: Math.floor(d.getTime() / 1000),
      nanoseconds: 0,
    })),
    fromMillis: jest.fn((ms: number) => ({
      toDate: () => new Date(ms),
      toMillis: () => ms,
      seconds: Math.floor(ms / 1000),
      nanoseconds: 0,
    })),
  },
}));

jest.mock('@vapour/firebase', () => ({
  COLLECTIONS: {
    MEETINGS: 'meetings',
    MEETING_ACTION_ITEMS: 'meetingActionItems',
    MANUAL_TASKS: 'manualTasks',
    USERS: 'users',
  },
}));

jest.mock('@/lib/auth/authorizationService', () => ({
  AuthorizationError: class AuthorizationError extends Error {},
}));

const mockGetManualTasksByIds = jest.fn();
jest.mock('./manualTaskService', () => ({
  getManualTasksByIds: (...args: unknown[]) => mockGetManualTasksByIds(...args),
}));

// Import after mocks
import {
  finalizeMeeting,
  startNextReview,
  selectCarryForwardItems,
  computeNextReviewDate,
  deriveNextReviewTitle,
  buildCarryForwardAgenda,
} from './meetingService';

// ============================================================================
// Fixtures
// ============================================================================

const db = {} as unknown as Firestore;

function makeTimestamp(date: Date): Timestamp {
  return {
    toDate: () => date,
    toMillis: () => date.getTime(),
    seconds: Math.floor(date.getTime() / 1000),
    nanoseconds: 0,
  } as unknown as Timestamp;
}

function makeItem(overrides: Partial<MeetingActionItem> = {}): MeetingActionItem {
  return {
    id: 'item-1',
    meetingId: 'meeting-1',
    description: 'Discussed pump vendor delay',
    action: 'Follow up with vendor',
    assigneeId: 'user-2',
    assigneeName: 'Priya',
    priority: 'MEDIUM',
    createdAt: makeTimestamp(new Date('2026-07-01')),
    ...overrides,
  };
}

const baseMeetingData = {
  title: 'Weekly review — Desal Project — 6 Jul 2026',
  date: makeTimestamp(new Date('2026-07-06T10:30:00')),
  duration: 45,
  location: 'Site office',
  createdBy: 'user-1',
  createdByName: 'Sekkizhar',
  attendeeIds: ['user-1', 'user-2'],
  attendeeNames: ['Sekkizhar', 'Priya'],
  status: 'finalized',
  projectId: 'proj-1',
  projectName: 'Desal Project',
  tenantId: 'default-entity',
  createdAt: makeTimestamp(new Date('2026-07-06')),
};

function mockMeetingDoc(data: Record<string, unknown>) {
  mockGetDoc.mockResolvedValueOnce({
    exists: () => true,
    id: 'meeting-1',
    data: () => data,
  });
}

function mockActionItemsSnapshot(items: MeetingActionItem[]) {
  mockGetDocs.mockResolvedValueOnce({
    docs: items.map((item) => ({ id: item.id, data: () => item })),
  });
}

beforeEach(() => {
  jest.clearAllMocks();
});

// ============================================================================
// Pure functions (B2)
// ============================================================================

describe('selectCarryForwardItems', () => {
  const statusMap = (m: Record<string, ManualTaskStatus>) => m;

  it('carries forward items whose task is still todo or in_progress', () => {
    const items = [
      makeItem({ id: 'a', generatedTaskId: 't-a' }),
      makeItem({ id: 'b', generatedTaskId: 't-b' }),
    ];
    const result = selectCarryForwardItems(
      items,
      statusMap({ 't-a': 'todo', 't-b': 'in_progress' })
    );
    expect(result.map((i) => i.id)).toEqual(['a', 'b']);
  });

  it('drops items whose task is done or cancelled', () => {
    const items = [
      makeItem({ id: 'a', generatedTaskId: 't-a' }),
      makeItem({ id: 'b', generatedTaskId: 't-b' }),
      makeItem({ id: 'c', generatedTaskId: 't-c' }),
    ];
    const result = selectCarryForwardItems(
      items,
      statusMap({ 't-a': 'done', 't-b': 'cancelled', 't-c': 'todo' })
    );
    expect(result.map((i) => i.id)).toEqual(['c']);
  });

  it('carries forward items that never generated a task', () => {
    const items = [makeItem({ id: 'a', generatedTaskId: undefined })];
    expect(selectCarryForwardItems(items, {})).toHaveLength(1);
  });

  it('carries forward items whose generated task was deleted (unknown status)', () => {
    const items = [makeItem({ id: 'a', generatedTaskId: 't-gone' })];
    expect(selectCarryForwardItems(items, {})).toHaveLength(1);
  });

  it('returns empty for empty input', () => {
    expect(selectCarryForwardItems([], {})).toEqual([]);
  });
});

describe('computeNextReviewDate', () => {
  it('adds exactly 7 days, preserving the time of day', () => {
    const monday = makeTimestamp(new Date('2026-07-06T10:30:00'));
    const next = computeNextReviewDate(monday);
    expect(next.toDate().getTime()).toBe(new Date('2026-07-13T10:30:00').getTime());
  });
});

describe('deriveNextReviewTitle', () => {
  const nextDate = new Date('2026-07-13T10:30:00');

  it('uses the project name when the meeting is project-linked', () => {
    const title = deriveNextReviewTitle(
      { title: 'Kickoff sync', projectName: 'Desal Project' },
      nextDate
    );
    expect(title).toMatch(/^Weekly review — Desal Project — /);
    expect(title).toContain('2026');
  });

  it('reuses the previous title when there is no project', () => {
    const title = deriveNextReviewTitle(
      { title: 'Ops team sync', projectName: undefined },
      nextDate
    );
    expect(title).toMatch(/^Weekly review — Ops team sync — /);
  });

  it('does not nest "Weekly review" prefixes week over week', () => {
    const title = deriveNextReviewTitle(
      { title: 'Weekly review — Ops team — 6 Jul 2026', projectName: undefined },
      nextDate
    );
    expect(title).toMatch(/^Weekly review — Ops team — /);
    expect(title).not.toContain('Weekly review — Weekly review');
  });
});

describe('buildCarryForwardAgenda', () => {
  it('returns undefined when nothing carries forward', () => {
    expect(buildCarryForwardAgenda('Old meeting', [])).toBeUndefined();
  });

  it('lists each carried item with its action and assignee', () => {
    const agenda = buildCarryForwardAgenda('Weekly review — 6 Jul', [
      makeItem({ action: 'Follow up with vendor', assigneeName: 'Priya' }),
      makeItem({ id: 'item-2', action: 'Send revised P&ID', assigneeName: 'Arun' }),
    ]);
    expect(agenda).toContain('Carried forward from "Weekly review — 6 Jul"');
    expect(agenda).toContain('- Follow up with vendor — Priya');
    expect(agenda).toContain('- Send revised P&ID — Arun');
  });
});

// ============================================================================
// finalizeMeeting — projectId propagation (B1)
// ============================================================================

describe('finalizeMeeting', () => {
  function runFinalize(meetingData: Record<string, unknown>, items: MeetingActionItem[]) {
    mockMeetingDoc(meetingData);

    const txSets: Array<{ ref: unknown; data: Record<string, unknown> }> = [];
    const txUpdates: Array<{ ref: unknown; data: Record<string, unknown> }> = [];
    const tx = {
      get: jest.fn().mockResolvedValue({
        exists: () => true,
        data: () => ({ isActive: true, displayName: 'Priya' }),
      }),
      set: (ref: unknown, data: Record<string, unknown>) => txSets.push({ ref, data }),
      update: (ref: unknown, data: Record<string, unknown>) => txUpdates.push({ ref, data }),
    };
    mockRunTransaction.mockImplementationOnce(async (_db: unknown, fn: (t: unknown) => unknown) =>
      fn(tx)
    );
    // getActionItems runs inside the transaction body
    mockActionItemsSnapshot(items);

    return finalizeMeeting(db, 'meeting-1', 'user-1', 'Sekkizhar', 'default-entity').then(
      (count) => ({ count, txSets, txUpdates })
    );
  }

  it('propagates the meeting projectId and projectName onto generated tasks', async () => {
    const { count, txSets } = await runFinalize({ ...baseMeetingData, status: 'draft' }, [
      makeItem(),
    ]);

    expect(count).toBe(1);
    expect(txSets).toHaveLength(1);
    expect(txSets[0]!.data).toEqual(
      expect.objectContaining({
        projectId: 'proj-1',
        projectName: 'Desal Project',
        meetingId: 'meeting-1',
        assigneeId: 'user-2',
      })
    );
  });

  it('omits project fields when the meeting has no project link (rule 12)', async () => {
    const { txSets } = await runFinalize(
      { ...baseMeetingData, status: 'draft', projectId: undefined, projectName: undefined },
      [makeItem()]
    );

    expect(txSets).toHaveLength(1);
    expect(txSets[0]!.data).not.toHaveProperty('projectId');
    expect(txSets[0]!.data).not.toHaveProperty('projectName');
  });
});

// ============================================================================
// startNextReview — idempotency + carry-forward (B2)
// ============================================================================

describe('startNextReview', () => {
  it('returns the existing next meeting without writing when nextMeetingId is set (rule 9)', async () => {
    mockMeetingDoc({ ...baseMeetingData, nextMeetingId: 'meeting-2' });

    const result = await startNextReview(db, 'meeting-1', 'user-1', 'Sekkizhar', 'default-entity');

    expect(result).toEqual({ meetingId: 'meeting-2', created: false });
    expect(mockRunTransaction).not.toHaveBeenCalled();
  });

  it('rejects meetings that are not finalized', async () => {
    mockMeetingDoc({ ...baseMeetingData, status: 'draft' });

    await expect(
      startNextReview(db, 'meeting-1', 'user-1', 'Sekkizhar', 'default-entity')
    ).rejects.toThrow('Only a finalized meeting');
  });

  it('rejects callers who are neither creator nor attendee', async () => {
    mockMeetingDoc(baseMeetingData);

    await expect(
      startNextReview(db, 'meeting-1', 'stranger', 'Stranger', 'default-entity')
    ).rejects.toThrow('creator or an attendee');
  });

  function setupCreatePath(options: {
    itemStatuses: Array<{ item: MeetingActionItem; taskStatus?: ManualTaskStatus }>;
    txMeetingData?: Record<string, unknown>;
  }) {
    mockMeetingDoc(baseMeetingData);
    mockActionItemsSnapshot(options.itemStatuses.map((s) => s.item));
    mockGetManualTasksByIds.mockResolvedValueOnce(
      options.itemStatuses
        .filter((s) => s.item.generatedTaskId && s.taskStatus)
        .map((s) => ({ id: s.item.generatedTaskId, status: s.taskStatus }))
    );

    const txSets: Array<{ ref: { id: string }; data: Record<string, unknown> }> = [];
    const txUpdates: Array<{ ref: unknown; data: Record<string, unknown> }> = [];
    const tx = {
      get: jest.fn().mockResolvedValue({
        exists: () => true,
        data: () => options.txMeetingData ?? baseMeetingData,
      }),
      set: (ref: { id: string }, data: Record<string, unknown>) => txSets.push({ ref, data }),
      update: (ref: unknown, data: Record<string, unknown>) => txUpdates.push({ ref, data }),
    };
    mockRunTransaction.mockImplementationOnce(async (_db: unknown, fn: (t: unknown) => unknown) =>
      fn(tx)
    );

    return { txSets, txUpdates };
  }

  it('creates next week meeting with attendees, project link, previousMeetingId, and carried agenda', async () => {
    const { txSets, txUpdates } = setupCreatePath({
      itemStatuses: [
        {
          item: makeItem({ id: 'a', generatedTaskId: 't-a', action: 'Still open item' }),
          taskStatus: 'todo',
        },
        {
          item: makeItem({ id: 'b', generatedTaskId: 't-b', action: 'Completed item' }),
          taskStatus: 'done',
        },
      ],
    });

    const result = await startNextReview(db, 'meeting-1', 'user-2', 'Priya', 'default-entity');

    expect(result).toEqual({ meetingId: 'new-meeting-id', created: true });
    expect(txSets).toHaveLength(1);

    const created = txSets[0]!.data;
    expect(created).toEqual(
      expect.objectContaining({
        status: 'draft',
        attendeeIds: ['user-1', 'user-2'],
        attendeeNames: ['Sekkizhar', 'Priya'],
        projectId: 'proj-1',
        projectName: 'Desal Project',
        previousMeetingId: 'meeting-1',
        duration: 45,
        location: 'Site office',
        createdBy: 'user-2',
        tenantId: 'default-entity',
      })
    );
    // Same weekday +7 days, same time
    const newDate = created.date as { toMillis: () => number };
    expect(newDate.toMillis()).toBe(new Date('2026-07-13T10:30:00').getTime());
    // Title derived from project name, no nesting
    expect(created.title).toMatch(/^Weekly review — Desal Project — /);
    // Agenda carries only the open item
    expect(created.agenda).toContain('Still open item');
    expect(created.agenda).not.toContain('Completed item');
    // Old meeting stamped with nextMeetingId
    expect(txUpdates).toHaveLength(1);
    expect(txUpdates[0]!.data).toEqual(
      expect.objectContaining({ nextMeetingId: 'new-meeting-id' })
    );
  });

  it('omits agenda entirely when every action item is done (rule 12)', async () => {
    const { txSets } = setupCreatePath({
      itemStatuses: [{ item: makeItem({ id: 'a', generatedTaskId: 't-a' }), taskStatus: 'done' }],
    });

    await startNextReview(db, 'meeting-1', 'user-1', 'Sekkizhar', 'default-entity');

    expect(txSets).toHaveLength(1);
    expect(txSets[0]!.data).not.toHaveProperty('agenda');
  });

  it('returns the concurrent winner inside the transaction instead of duplicating (rule 9)', async () => {
    const { txSets, txUpdates } = setupCreatePath({
      itemStatuses: [{ item: makeItem({ id: 'a', generatedTaskId: 't-a' }), taskStatus: 'todo' }],
      // Simulate a concurrent click that already created the next meeting
      txMeetingData: { ...baseMeetingData, nextMeetingId: 'meeting-from-other-click' },
    });

    const result = await startNextReview(db, 'meeting-1', 'user-1', 'Sekkizhar', 'default-entity');

    expect(result).toEqual({ meetingId: 'meeting-from-other-click', created: false });
    expect(txSets).toHaveLength(0);
    expect(txUpdates).toHaveLength(0);
  });
});
