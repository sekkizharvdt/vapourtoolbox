/**
 * Portfolio / Review Dashboard (Track B3)
 *
 * One page, per active project: open tasks, overdue tasks, upcoming/overdue
 * charter deliverables, in-flight procurement, budget utilization, progress,
 * and days since the last review meeting. This IS the weekly meeting agenda
 * (B2) — the default sort (days-since-review, descending, "never reviewed"
 * first) puts the most overdue-for-review project at the top.
 *
 * Design (no new Firestore composite indexes — see MODULE_MAP / rule 2):
 * - Projects: `getProjects(tenantId)` (existing `(tenantId, createdAt DESC)`
 *   index), filtered client-side to ACTIVE + not soft-deleted (rule 3).
 * - Tasks: ONE query — `tenantId ==` + `status in ['todo','in_progress']`
 *   — covered by the existing `(tenantId, status, createdAt DESC)` index
 *   (Firestore's `in` uses the same composite shape as equality). Grouped
 *   client-side into a `projectId -> ManualTask[]` map.
 * - Meetings: ONE query — `tenantId ==` + `status == 'finalized'`,
 *   `orderBy('date', 'desc')` — covered by the existing
 *   `(tenantId, status, date DESC)` index. Reduced client-side to
 *   `projectId -> most recent Timestamp` (first occurrence wins, since the
 *   query is already sorted newest-first).
 *
 * The pure functions below take `now: Date` as an explicit parameter (never
 * read `new Date()` internally) so they're deterministic and unit-testable.
 * Only `loadPortfolioDashboard` at the bottom touches Firestore.
 */

import { collection, getDocs, query, where, orderBy, type Firestore } from 'firebase/firestore';
import { Timestamp } from 'firebase/firestore';
import { COLLECTIONS } from '@vapour/firebase';
import type {
  ManualTask,
  Meeting,
  Project,
  ProcurementItem,
  ProjectDeliverable,
} from '@vapour/types';
import { daysBetween, MS_PER_DAY } from '@/lib/utils/date';
import { getProjects } from './projectService';

// ============================================================================
// CONSTANTS
// ============================================================================

/** Charter deliverables due within this many days count as "upcoming". */
export const DELIVERABLE_LOOKAHEAD_DAYS = 14;

/** Deliverable statuses that no longer need review-meeting attention. */
const TERMINAL_DELIVERABLE_STATUSES: ReadonlySet<ProjectDeliverable['status']> = new Set([
  'ACCEPTED',
  'REJECTED',
]);

/** Procurement item statuses that are no longer "in flight". */
const TERMINAL_PROCUREMENT_STATUSES: ReadonlySet<ProcurementItem['status']> = new Set([
  'DELIVERED',
  'CANCELLED',
]);

/** Budget utilization thresholds — mirrors `functions/src/utils/budgetAlerts.ts` (B5). */
export const BUDGET_WARNING_THRESHOLD = 90;
export const BUDGET_EXCEEDED_THRESHOLD = 100;

// ============================================================================
// SMALL HELPERS
// ============================================================================

/**
 * Safe Timestamp -> Date conversion (rule 14): check `toDate` first, then
 * `instanceof Date`, then give up. Never call `.toDate()`/`.getTime()`
 * blind on a field typed `Timestamp` — Firestore data survives serialization
 * boundaries (tests, cached documents) in different shapes.
 */
function toJsDate(value: Timestamp | Date | null | undefined): Date | null {
  if (!value) return null;
  if (typeof value === 'object' && 'toDate' in value && typeof value.toDate === 'function') {
    return value.toDate();
  }
  if (value instanceof Date) return value;
  return null;
}

// ============================================================================
// PURE COMPUTATION
// ============================================================================

/**
 * Active, non-deleted projects — the dashboard's scope (rule 3: soft-deleted
 * docs must be filtered client-side, never trusted to a `!=` query).
 */
export function selectActiveProjects(projects: Project[]): Project[] {
  return projects.filter((p) => p.status === 'ACTIVE' && !p.isDeleted);
}

/**
 * Group open tasks by `projectId`. Tasks without a `projectId` (personal /
 * unlinked tasks) are dropped — they don't belong to any project row.
 */
export function groupOpenTasksByProject(tasks: ManualTask[]): Map<string, ManualTask[]> {
  const map = new Map<string, ManualTask[]>();
  for (const task of tasks) {
    if (!task.projectId) continue;
    const existing = map.get(task.projectId);
    if (existing) {
      existing.push(task);
    } else {
      map.set(task.projectId, [task]);
    }
  }
  return map;
}

/** Open tasks whose `dueDate` is in the past relative to `now`. */
export function countOverdueTasks(tasks: ManualTask[], now: Date): number {
  return tasks.filter((task) => {
    const due = toJsDate(task.dueDate ?? null);
    return due !== null && due < now;
  }).length;
}

/**
 * Reduce finalized meetings to the most recent one per project.
 *
 * Assumes `meetings` is already sorted newest-first (the query orders by
 * `date desc`) — first occurrence of a `projectId` wins, so this is a single
 * linear pass with no per-item comparison.
 */
export function reduceMeetingsToLatestByProject(meetings: Meeting[]): Map<string, Timestamp> {
  const map = new Map<string, Timestamp>();
  for (const meeting of meetings) {
    if (!meeting.projectId) continue;
    if (!map.has(meeting.projectId)) {
      map.set(meeting.projectId, meeting.date);
    }
  }
  return map;
}

/**
 * Days since the last review meeting. `Infinity` when the project has never
 * been reviewed — sorts it as the most urgent (top of the agenda) under a
 * plain numeric descending sort, no special-casing needed at the call site.
 */
export function daysSinceLastReview(
  lastMeetingDate: Timestamp | null | undefined,
  now: Date
): number {
  const date = toJsDate(lastMeetingDate ?? null);
  if (!date) return Infinity;
  return daysBetween(date, now);
}

export interface DeliverableCounts {
  upcoming: number;
  overdue: number;
}

/**
 * Classify a project's charter deliverables relative to `now`:
 * - `overdue`: has a `dueDate` in the past and isn't ACCEPTED/REJECTED yet.
 * - `upcoming`: has a `dueDate` within `lookaheadDays` from now (inclusive)
 *   and isn't ACCEPTED/REJECTED yet.
 * Deliverables with no `dueDate`, or already ACCEPTED/REJECTED, are ignored.
 */
export function classifyDeliverables(
  deliverables: ProjectDeliverable[] | undefined,
  now: Date,
  lookaheadDays: number = DELIVERABLE_LOOKAHEAD_DAYS
): DeliverableCounts {
  const horizon = new Date(now.getTime() + lookaheadDays * MS_PER_DAY);
  let upcoming = 0;
  let overdue = 0;

  for (const deliverable of deliverables ?? []) {
    if (TERMINAL_DELIVERABLE_STATUSES.has(deliverable.status)) continue;
    const due = toJsDate(deliverable.dueDate ?? null);
    if (!due) continue;

    if (due < now) {
      overdue++;
    } else if (due <= horizon) {
      upcoming++;
    }
  }

  return { upcoming, overdue };
}

export interface ProcurementInFlightSummary {
  inFlight: number;
  breakdown: Partial<Record<ProcurementItem['status'], number>>;
}

/**
 * Count procurement items still "in flight" (not DELIVERED/CANCELLED), with
 * a per-status breakdown for the one-line summary in the row.
 */
export function countInFlightProcurement(
  items: ProcurementItem[] | undefined
): ProcurementInFlightSummary {
  const breakdown: Partial<Record<ProcurementItem['status'], number>> = {};
  let inFlight = 0;

  for (const item of items ?? []) {
    if (TERMINAL_PROCUREMENT_STATUSES.has(item.status)) continue;
    inFlight++;
    breakdown[item.status] = (breakdown[item.status] ?? 0) + 1;
  }

  return { inFlight, breakdown };
}

export type BudgetUtilizationColor = 'success' | 'warning' | 'error' | 'default';

/**
 * Color-code budget utilization %, mirroring the 90/100 thresholds already
 * used by the B5 budget-alert Cloud Function (`functions/src/utils/budgetAlerts.ts`):
 * green under 90%, amber 90–100%, red at/over 100%. `null`/`undefined`
 * (no charter budget summary yet) renders as neutral.
 */
export function getBudgetUtilizationColor(
  utilizationPercentage: number | null | undefined
): BudgetUtilizationColor {
  if (utilizationPercentage == null || Number.isNaN(utilizationPercentage)) return 'default';
  if (utilizationPercentage >= BUDGET_EXCEEDED_THRESHOLD) return 'error';
  if (utilizationPercentage >= BUDGET_WARNING_THRESHOLD) return 'warning';
  return 'success';
}

/**
 * One row of the portfolio/review dashboard.
 */
export interface PortfolioProjectRow {
  projectId: string;
  code: string;
  name: string;
  status: Project['status'];
  projectManagerName: string;
  openTasksCount: number;
  overdueTasksCount: number;
  deliverablesUpcoming: number;
  deliverablesOverdue: number;
  procurementInFlight: number;
  procurementBreakdown: Partial<Record<ProcurementItem['status'], number>>;
  budgetUtilizationPercentage: number | null;
  progressPercentage: number | null;
  lastReviewDate: Timestamp | null;
  /** `Infinity` when the project has never had a finalized review meeting. */
  daysSinceReview: number;
}

/**
 * Assemble the dashboard rows from already-fetched/grouped data. Pure —
 * takes `now` explicitly so tests are deterministic.
 */
export function buildPortfolioRows(
  projects: Project[],
  openTasksByProject: Map<string, ManualTask[]>,
  lastReviewByProject: Map<string, Timestamp>,
  now: Date
): PortfolioProjectRow[] {
  return projects.map((project) => {
    const tasks = openTasksByProject.get(project.id) ?? [];
    const { upcoming, overdue } = classifyDeliverables(project.charter?.deliverables, now);
    const { inFlight, breakdown } = countInFlightProcurement(project.procurementItems);
    const lastReviewDate = lastReviewByProject.get(project.id) ?? null;

    return {
      projectId: project.id,
      code: project.code,
      name: project.name,
      status: project.status,
      projectManagerName: project.projectManager?.userName ?? '',
      openTasksCount: tasks.length,
      overdueTasksCount: countOverdueTasks(tasks, now),
      deliverablesUpcoming: upcoming,
      deliverablesOverdue: overdue,
      procurementInFlight: inFlight,
      procurementBreakdown: breakdown,
      budgetUtilizationPercentage: project.charter?.budgetSummary?.utilizationPercentage ?? null,
      progressPercentage: project.progress?.percentage ?? null,
      lastReviewDate,
      daysSinceReview: daysSinceLastReview(lastReviewDate, now),
    };
  });
}

// ============================================================================
// FIRESTORE ORCHESTRATION (not unit-tested — thin wiring over the pure fns)
// ============================================================================

/**
 * Fetch every open (`todo`/`in_progress`) task for the tenant in one query.
 * Covered by the existing `manualTasks (tenantId, status, createdAt DESC)`
 * composite index — no new index required.
 */
async function fetchOpenTasks(db: Firestore, tenantId: string): Promise<ManualTask[]> {
  const q = query(
    collection(db, COLLECTIONS.MANUAL_TASKS),
    where('tenantId', '==', tenantId),
    where('status', 'in', ['todo', 'in_progress']),
    orderBy('createdAt', 'desc')
  );
  const snapshot = await getDocs(q);
  const tasks: ManualTask[] = [];
  snapshot.forEach((d) => {
    tasks.push({ id: d.id, ...d.data() } as ManualTask);
  });
  return tasks;
}

/**
 * Fetch every finalized meeting for the tenant, newest first, in one query.
 * Covered by the existing `meetings (tenantId, status, date DESC)` composite
 * index — no new index required.
 */
async function fetchFinalizedMeetings(db: Firestore, tenantId: string): Promise<Meeting[]> {
  const q = query(
    collection(db, COLLECTIONS.MEETINGS),
    where('tenantId', '==', tenantId),
    where('status', '==', 'finalized'),
    orderBy('date', 'desc')
  );
  const snapshot = await getDocs(q);
  const meetings: Meeting[] = [];
  snapshot.forEach((d) => {
    meetings.push({ id: d.id, ...d.data() } as Meeting);
  });
  return meetings;
}

/**
 * Load the full portfolio dashboard: active projects + their open tasks +
 * their last review meeting date, assembled into rows. One-time fetch (no
 * live listeners) — matches the "recompute on load" performance approach
 * used elsewhere in the app (e.g. BOM cost sheet blocks).
 */
export async function loadPortfolioDashboard(
  db: Firestore,
  tenantId: string
): Promise<PortfolioProjectRow[]> {
  const [allProjects, openTasks, finalizedMeetings] = await Promise.all([
    getProjects(tenantId),
    fetchOpenTasks(db, tenantId),
    fetchFinalizedMeetings(db, tenantId),
  ]);

  const activeProjects = selectActiveProjects(allProjects);
  const openTasksByProject = groupOpenTasksByProject(openTasks);
  const lastReviewByProject = reduceMeetingsToLatestByProject(finalizedMeetings);

  return buildPortfolioRows(activeProjects, openTasksByProject, lastReviewByProject, new Date());
}
