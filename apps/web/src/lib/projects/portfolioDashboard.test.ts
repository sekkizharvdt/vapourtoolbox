/**
 * Tests for the pure portfolio/review dashboard computations (Track B3).
 *
 * No Firestore mocking needed — `loadPortfolioDashboard` (the only
 * Firestore-touching function in the module) is thin wiring over these pure
 * functions and is exercised manually / via the page, per house convention
 * (see deliverableService.test.ts, budgetAlerts.test.ts).
 */

import { Timestamp } from 'firebase/firestore';
import type {
  ManualTask,
  Meeting,
  Project,
  ProcurementItem,
  ProjectDeliverable,
} from '@vapour/types';
import {
  selectActiveProjects,
  groupOpenTasksByProject,
  countOverdueTasks,
  reduceMeetingsToLatestByProject,
  daysSinceLastReview,
  classifyDeliverables,
  countInFlightProcurement,
  getBudgetUtilizationColor,
  buildPortfolioRows,
} from './portfolioDashboard';

// ============================================================================
// Fixtures
// ============================================================================

const NOW = new Date('2026-07-16T12:00:00Z');

function ts(iso: string): Timestamp {
  const date = new Date(iso);
  const raw = {
    toDate: () => date,
    toMillis: () => date.getTime(),
    seconds: Math.floor(date.getTime() / 1000),
    nanoseconds: 0,
  };
  return raw as Timestamp;
}

function task(overrides: Partial<ManualTask> = {}): ManualTask {
  return {
    id: 'task-1',
    title: 'Do the thing',
    createdBy: 'u1',
    createdByName: 'User One',
    assigneeId: 'u1',
    assigneeName: 'User One',
    status: 'todo',
    priority: 'MEDIUM',
    tenantId: 'default-entity',
    createdAt: ts('2026-07-01T00:00:00Z'),
    ...overrides,
  };
}

function meeting(overrides: Partial<Meeting> = {}): Meeting {
  return {
    id: 'meeting-1',
    title: 'Weekly review',
    date: ts('2026-07-10T00:00:00Z'),
    createdBy: 'u1',
    createdByName: 'User One',
    attendeeIds: [],
    attendeeNames: [],
    status: 'finalized',
    tenantId: 'default-entity',
    createdAt: ts('2026-07-01T00:00:00Z'),
    ...overrides,
  };
}

function deliverable(overrides: Partial<ProjectDeliverable> = {}): ProjectDeliverable {
  return {
    id: 'd1',
    name: 'Deliverable',
    description: '',
    type: 'DOCUMENT',
    acceptanceCriteria: [],
    status: 'PENDING',
    ...overrides,
  };
}

function procurementItem(overrides: Partial<ProcurementItem> = {}): ProcurementItem {
  return {
    id: 'p1',
    itemName: 'Item',
    description: '',
    category: 'COMPONENT',
    quantity: 1,
    unit: 'nos',
    priority: 'MEDIUM',
    status: 'PLANNING',
    ...overrides,
  };
}

function project(overrides: Partial<Project> = {}): Project {
  const raw = {
    id: 'proj-1',
    code: 'PRJ-001',
    name: 'Project One',
    status: 'ACTIVE',
    priority: 'MEDIUM',
    client: {
      entityId: 'e1',
      entityName: 'Client',
      contactPerson: '',
      contactEmail: '',
      contactPhone: '',
    },
    projectManager: { userId: 'pm1', userName: 'PM One' },
    team: [],
    dates: { startDate: ts('2026-01-01T00:00:00Z') },
    ownerId: 'pm1',
    visibility: 'company',
    createdAt: ts('2026-01-01T00:00:00Z'),
    updatedAt: ts('2026-01-01T00:00:00Z'),
    ...overrides,
  };
  return raw as Project;
}

// ============================================================================
// selectActiveProjects
// ============================================================================

describe('selectActiveProjects', () => {
  it('keeps only ACTIVE, non-deleted projects', () => {
    const projects = [
      project({ id: 'a', status: 'ACTIVE' }),
      project({ id: 'b', status: 'PLANNING' }),
      project({ id: 'c', status: 'ACTIVE', isDeleted: true }),
      project({ id: 'd', status: 'COMPLETED' }),
    ];
    expect(selectActiveProjects(projects).map((p) => p.id)).toEqual(['a']);
  });
});

// ============================================================================
// groupOpenTasksByProject
// ============================================================================

describe('groupOpenTasksByProject', () => {
  it('groups tasks by projectId and drops unlinked tasks', () => {
    const tasks = [
      task({ id: 't1', projectId: 'p1' }),
      task({ id: 't2', projectId: 'p1' }),
      task({ id: 't3', projectId: 'p2' }),
      task({ id: 't4' }), // no projectId
    ];
    const grouped = groupOpenTasksByProject(tasks);
    expect(grouped.get('p1')?.map((t) => t.id)).toEqual(['t1', 't2']);
    expect(grouped.get('p2')?.map((t) => t.id)).toEqual(['t3']);
    expect(grouped.has('p3')).toBe(false);
    expect([...grouped.values()].flat().length).toBe(3);
  });

  it('returns an empty map for no tasks', () => {
    expect(groupOpenTasksByProject([]).size).toBe(0);
  });
});

// ============================================================================
// countOverdueTasks
// ============================================================================

describe('countOverdueTasks', () => {
  it('counts only tasks with a past dueDate', () => {
    const tasks = [
      task({ id: 't1', dueDate: ts('2026-07-01T00:00:00Z') }), // overdue
      task({ id: 't2', dueDate: ts('2026-08-01T00:00:00Z') }), // future
      task({ id: 't3' }), // no due date
    ];
    expect(countOverdueTasks(tasks, NOW)).toBe(1);
  });

  it('returns 0 for an empty list', () => {
    expect(countOverdueTasks([], NOW)).toBe(0);
  });
});

// ============================================================================
// reduceMeetingsToLatestByProject
// ============================================================================

describe('reduceMeetingsToLatestByProject', () => {
  it('keeps the first (most recent) meeting per project, assuming desc-sorted input', () => {
    const meetings = [
      meeting({ id: 'm1', projectId: 'p1', date: ts('2026-07-10T00:00:00Z') }),
      meeting({ id: 'm2', projectId: 'p1', date: ts('2026-07-01T00:00:00Z') }), // older, ignored
      meeting({ id: 'm3', projectId: 'p2', date: ts('2026-07-05T00:00:00Z') }),
    ];
    const result = reduceMeetingsToLatestByProject(meetings);
    expect(result.get('p1')?.toMillis()).toBe(new Date('2026-07-10T00:00:00Z').getTime());
    expect(result.get('p2')?.toMillis()).toBe(new Date('2026-07-05T00:00:00Z').getTime());
    expect(result.has('p3')).toBe(false);
  });

  it('ignores meetings with no projectId', () => {
    const meetings = [meeting({ projectId: undefined })];
    expect(reduceMeetingsToLatestByProject(meetings).size).toBe(0);
  });
});

// ============================================================================
// daysSinceLastReview
// ============================================================================

describe('daysSinceLastReview', () => {
  it('returns Infinity when never reviewed', () => {
    expect(daysSinceLastReview(null, NOW)).toBe(Infinity);
    expect(daysSinceLastReview(undefined, NOW)).toBe(Infinity);
  });

  it('computes whole days since the last meeting', () => {
    expect(daysSinceLastReview(ts('2026-07-09T12:00:00Z'), NOW)).toBe(7);
  });

  it('returns 0 for a meeting today', () => {
    expect(daysSinceLastReview(ts('2026-07-16T00:00:00Z'), NOW)).toBe(0);
  });
});

// ============================================================================
// classifyDeliverables
// ============================================================================

describe('classifyDeliverables', () => {
  it('classifies overdue vs upcoming (14-day lookahead) and ignores terminal statuses', () => {
    const deliverables = [
      deliverable({ id: 'd1', status: 'PENDING', dueDate: ts('2026-07-10T00:00:00Z') }), // overdue
      deliverable({ id: 'd2', status: 'IN_PROGRESS', dueDate: ts('2026-07-20T00:00:00Z') }), // upcoming (4d)
      deliverable({ id: 'd3', status: 'SUBMITTED', dueDate: ts('2026-08-15T00:00:00Z') }), // too far out
      deliverable({ id: 'd4', status: 'ACCEPTED', dueDate: ts('2026-07-01T00:00:00Z') }), // terminal, ignored
      deliverable({ id: 'd5', status: 'REJECTED', dueDate: ts('2026-07-01T00:00:00Z') }), // terminal, ignored
      deliverable({ id: 'd6', status: 'PENDING' }), // no due date, ignored
    ];
    expect(classifyDeliverables(deliverables, NOW)).toEqual({ upcoming: 1, overdue: 1 });
  });

  it('treats the 14-day boundary as inclusive', () => {
    const boundary = new Date(NOW.getTime() + 14 * 24 * 60 * 60 * 1000);
    const deliverables = [deliverable({ status: 'PENDING', dueDate: ts(boundary.toISOString()) })];
    expect(classifyDeliverables(deliverables, NOW)).toEqual({ upcoming: 1, overdue: 0 });
  });

  it('returns zeroes for undefined/empty deliverables', () => {
    expect(classifyDeliverables(undefined, NOW)).toEqual({ upcoming: 0, overdue: 0 });
    expect(classifyDeliverables([], NOW)).toEqual({ upcoming: 0, overdue: 0 });
  });
});

// ============================================================================
// countInFlightProcurement
// ============================================================================

describe('countInFlightProcurement', () => {
  it('counts items not yet DELIVERED/CANCELLED with a status breakdown', () => {
    const items = [
      procurementItem({ id: 'i1', status: 'PLANNING' }),
      procurementItem({ id: 'i2', status: 'PO_PLACED' }),
      procurementItem({ id: 'i3', status: 'PO_PLACED' }),
      procurementItem({ id: 'i4', status: 'DELIVERED' }),
      procurementItem({ id: 'i5', status: 'CANCELLED' }),
    ];
    expect(countInFlightProcurement(items)).toEqual({
      inFlight: 3,
      breakdown: { PLANNING: 1, PO_PLACED: 2 },
    });
  });

  it('returns zero/empty for undefined/empty items', () => {
    expect(countInFlightProcurement(undefined)).toEqual({ inFlight: 0, breakdown: {} });
    expect(countInFlightProcurement([])).toEqual({ inFlight: 0, breakdown: {} });
  });
});

// ============================================================================
// getBudgetUtilizationColor
// ============================================================================

describe('getBudgetUtilizationColor', () => {
  it('maps utilization to the B5 90/100 thresholds', () => {
    expect(getBudgetUtilizationColor(null)).toBe('default');
    expect(getBudgetUtilizationColor(undefined)).toBe('default');
    expect(getBudgetUtilizationColor(50)).toBe('success');
    expect(getBudgetUtilizationColor(89.9)).toBe('success');
    expect(getBudgetUtilizationColor(90)).toBe('warning');
    expect(getBudgetUtilizationColor(99.9)).toBe('warning');
    expect(getBudgetUtilizationColor(100)).toBe('error');
    expect(getBudgetUtilizationColor(150)).toBe('error');
  });
});

// ============================================================================
// buildPortfolioRows (integration of the pure pieces)
// ============================================================================

describe('buildPortfolioRows', () => {
  it('assembles a full row from projects + grouped tasks + last-review map', () => {
    const p1 = project({
      id: 'p1',
      code: 'PRJ-001',
      name: 'Desal Plant',
      charter: {
        authorization: {
          sponsorName: 's',
          sponsorTitle: 't',
          approvalStatus: 'APPROVED',
          budgetAuthority: 'b',
        },
        objectives: [],
        deliverables: [
          deliverable({ status: 'PENDING', dueDate: ts('2026-07-10T00:00:00Z') }), // overdue
        ],
        scope: { inScope: [], outOfScope: [], assumptions: [], constraints: [] },
        budgetSummary: {
          totalEstimated: 100,
          totalActual: 95,
          totalVariance: 5,
          utilizationPercentage: 95,
          currency: 'INR',
        },
        risks: [],
        stakeholders: [],
      },
      procurementItems: [procurementItem({ status: 'RFQ_ISSUED' })],
      progress: { percentage: 40, completedMilestones: 2, totalMilestones: 5 },
    });
    const p2 = project({ id: 'p2', code: 'PRJ-002', name: 'No Charter Project' });

    const tasksByProject = groupOpenTasksByProject([
      task({ id: 't1', projectId: 'p1', dueDate: ts('2026-07-01T00:00:00Z') }), // overdue
      task({ id: 't2', projectId: 'p1' }),
    ]);
    const lastReviewByProject = reduceMeetingsToLatestByProject([
      meeting({ projectId: 'p1', date: ts('2026-07-09T00:00:00Z') }),
    ]);

    const rows = buildPortfolioRows([p1, p2], tasksByProject, lastReviewByProject, NOW);

    expect(rows).toHaveLength(2);
    const row1 = rows.find((r) => r.projectId === 'p1')!;
    expect(row1).toMatchObject({
      code: 'PRJ-001',
      name: 'Desal Plant',
      openTasksCount: 2,
      overdueTasksCount: 1,
      deliverablesUpcoming: 0,
      deliverablesOverdue: 1,
      procurementInFlight: 1,
      budgetUtilizationPercentage: 95,
      progressPercentage: 40,
      daysSinceReview: 7,
    });

    const row2 = rows.find((r) => r.projectId === 'p2')!;
    expect(row2).toMatchObject({
      openTasksCount: 0,
      overdueTasksCount: 0,
      deliverablesUpcoming: 0,
      deliverablesOverdue: 0,
      procurementInFlight: 0,
      budgetUtilizationPercentage: null,
      progressPercentage: null,
      daysSinceReview: Infinity,
    });
  });
});
