/**
 * My Work Service
 *
 * Fans three real-time queries into one `WorkItem[]`:
 *
 *   1. notifications assigned to me            (`subscribeToUserTasks`)
 *   2. manual tasks assigned to me             (`subscribeToMyTasks`)
 *   3. notifications I raised for someone else ("Waiting on others", plan D3)
 *
 * The collections stay separate — a notification is closed by the workflow that
 * owns its source document, a manual task is closed by hand — and only the view
 * is merged. Classification and ordering live in `workItems.ts`, which is pure;
 * this file is the wiring.
 *
 * **Required Firestore Composite Index:**
 * - taskNotifications: (assigneeBy → `assignedBy` ASC, status ASC, createdAt DESC)
 *   for the waiting-on-others query.
 *
 * Plan: docs/reviews/2026-08-12-flow-my-work-plan.md (Phase 1)
 */

import {
  collection,
  query,
  where,
  orderBy,
  onSnapshot,
  type Firestore,
  type Unsubscribe,
} from 'firebase/firestore';
import { COLLECTIONS } from '@vapour/firebase';
import { createLogger } from '@vapour/logger';
import type { ManualTask, TaskNotification } from '@vapour/types';
import { subscribeToUserTasks } from './channelService';
import { subscribeToMyTasks } from './manualTaskService';
import { docToTaskNotification } from './taskNotificationService';
import { fromManualTask, fromNotification, type WorkItem } from './workItems';

const logger = createLogger({ context: 'myWorkService' });

const OPEN_STATUSES = ['pending', 'in_progress'] as const;

export interface MyWorkSnapshot {
  items: WorkItem[];
  /** Set once every underlying stream has produced at least one snapshot. */
  loaded: boolean;
  /** Non-null when a stream failed — surfaced rather than shown as "all clear". */
  error: string | null;
}

/**
 * Subscribe to everything the user owes, plus what they are waiting on.
 *
 * The callback fires on every underlying change with the merged, classified
 * list. Items are deduplicated by id: a notification you raised for yourself
 * appears in two streams, and `triageNotification` puts it in "Needs you"
 * because the assignee test comes first.
 */
export function subscribeToMyWork(
  db: Firestore,
  tenantId: string,
  userId: string,
  onUpdate: (snapshot: MyWorkSnapshot) => void
): Unsubscribe {
  let myNotifications: TaskNotification[] = [];
  let myTasks: ManualTask[] = [];
  let waitingOn: TaskNotification[] = [];

  const seen = { notifications: false, tasks: false, waiting: false };
  let error: string | null = null;

  const emit = () => {
    const byId = new Map<string, WorkItem>();

    // Mine first — a self-raised notification must classify as "needs you",
    // never as something you are waiting on yourself for.
    myNotifications.forEach((n) => byId.set(n.id, fromNotification(n, userId)));
    waitingOn.forEach((n) => {
      if (!byId.has(n.id)) byId.set(n.id, fromNotification(n, userId));
    });
    myTasks.forEach((t) => byId.set(t.id, fromManualTask(t, userId)));

    onUpdate({
      items: [...byId.values()],
      loaded: seen.notifications && seen.tasks && seen.waiting,
      error,
    });
  };

  const unsubscribeNotifications = subscribeToUserTasks(userId, (notifications) => {
    myNotifications = notifications;
    seen.notifications = true;
    emit();
  });

  const unsubscribeTasks = subscribeToMyTasks(
    db,
    tenantId,
    userId,
    (tasks) => {
      // Terminal tasks stay out of the feed; the Done view reads them directly.
      myTasks = tasks.filter((t) => t.status !== 'cancelled');
      seen.tasks = true;
      emit();
    },
    (err) => {
      error = err instanceof Error ? err.message : String(err);
      seen.tasks = true;
      emit();
    }
  );

  // Waiting on others: raised by me, owed by somebody else. `type` and the
  // `userId !== me` test are applied in `workItems`, not in the query — adding
  // them here would need a wider composite index for no gain at this volume.
  const waitingQuery = query(
    collection(db, COLLECTIONS.TASK_NOTIFICATIONS),
    where('assignedBy', '==', userId),
    where('status', 'in', [...OPEN_STATUSES]),
    orderBy('createdAt', 'desc')
  );

  const unsubscribeWaiting = onSnapshot(
    waitingQuery,
    (snapshot) => {
      waitingOn = snapshot.docs
        .map((d) => docToTaskNotification(d.id, d.data()))
        .filter((n) => n.userId !== userId && n.type === 'actionable');
      seen.waiting = true;
      emit();
    },
    (err) => {
      // Degrade rather than blank the page: the two groups the user acts on
      // still render, and the failure is reported instead of read as "nothing
      // is waiting" (rule 27).
      logger.error('waiting-on-others listener failed', { userId, error: err });
      error = err instanceof Error ? err.message : String(err);
      seen.waiting = true;
      emit();
    }
  );

  return () => {
    unsubscribeNotifications();
    unsubscribeTasks();
    unsubscribeWaiting();
  };
}
