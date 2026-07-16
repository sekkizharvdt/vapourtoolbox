/**
 * Deliverable Service
 *
 * Canonical write path for charter deliverables (rule 16) — all UI callers
 * route through here. Every write recomputes `Project.progress` from
 * deliverable acceptance (accepted / total) inside the same Firestore
 * transaction (rule 19), so the stored progress can never drift from the
 * deliverable list.
 */

import { doc, runTransaction, Timestamp, type Firestore } from 'firebase/firestore';
import { COLLECTIONS } from '@vapour/firebase';
import { PERMISSION_FLAGS } from '@vapour/constants';
import type { Project, ProjectDeliverable } from '@vapour/types';
import { requirePermission } from '@/lib/auth/authorizationService';
import { logAuditEvent, createAuditContext } from '@/lib/audit/clientAuditService';
import { createLogger } from '@vapour/logger';
import { retryOnStaleToken } from '@/lib/firebase/retryOnStaleToken';

const logger = createLogger({ context: 'deliverableService' });

/**
 * Compute project progress from charter deliverables.
 *
 * A deliverable counts as complete only when ACCEPTED (client sign-off),
 * not when SUBMITTED. Percentage is a rounded integer; 0 when there are
 * no deliverables.
 */
export function computeProjectProgress(
  deliverables: readonly Pick<ProjectDeliverable, 'status'>[]
): NonNullable<Project['progress']> {
  const total = deliverables.length;
  const accepted = deliverables.filter((d) => d.status === 'ACCEPTED').length;
  return {
    percentage: total > 0 ? Math.round((accepted / total) * 100) : 0,
    completedMilestones: accepted,
    totalMilestones: total,
  };
}

export type DeliverableInput = Omit<ProjectDeliverable, 'id'> & { id?: string };

/**
 * Create or update a charter deliverable and recompute project progress.
 *
 * Reads the current deliverable list inside the transaction (never trusts
 * the caller's possibly-stale copy) and writes deliverables + progress
 * atomically.
 */
export async function saveDeliverable(
  db: Firestore,
  projectId: string,
  deliverableData: DeliverableInput,
  userId: string,
  userPermissions: number
): Promise<void> {
  requirePermission(
    userPermissions,
    PERMISSION_FLAGS.MANAGE_PROJECTS,
    userId,
    'save project deliverable'
  );

  await retryOnStaleToken(() =>
    runTransaction(db, async (tx) => {
      const projectRef = doc(db, COLLECTIONS.PROJECTS, projectId);
      const snap = await tx.get(projectRef);
      if (!snap.exists()) {
        throw new Error(`Project ${projectId} not found`);
      }

      const deliverables: ProjectDeliverable[] =
        (snap.data() as Project).charter?.deliverables ?? [];

      // Separate the (possibly undefined) id from the field payload so we
      // never spread `id: undefined` into Firestore data (rule 12).
      const { id: incomingId, ...fields } = deliverableData;

      let updated: ProjectDeliverable[];
      if (incomingId) {
        if (!deliverables.some((d) => d.id === incomingId)) {
          throw new Error(`Deliverable ${incomingId} not found on project ${projectId}`);
        }
        updated = deliverables.map(
          (d): ProjectDeliverable => (d.id === incomingId ? { ...d, ...fields } : d)
        );
      } else {
        updated = [...deliverables, { ...fields, id: `del-${crypto.randomUUID().slice(0, 8)}` }];
      }

      tx.update(projectRef, {
        'charter.deliverables': updated,
        progress: computeProjectProgress(updated),
        updatedAt: Timestamp.now(),
        updatedBy: userId,
      });
    })
  );
}

/**
 * Pure merge: upsert a batch of deliverables into an existing list, using
 * the same id-generation and upsert-by-id rules as `saveDeliverable`.
 *
 * Exported (not just inlined into `saveDeliverablesBatch`) so a caller that
 * needs to fold a deliverable-batch write into a *different* atomic
 * transaction — e.g. `approveOrderAcceptance` in orderAcceptanceService.ts,
 * which must apply order-acceptance terms and seed deliverables in one
 * transaction (rule 19) — can reuse this exact logic instead of duplicating
 * it (rule 16), without nesting a `runTransaction` inside another.
 */
export function mergeDeliverablesBatch(
  existing: readonly ProjectDeliverable[],
  deliverablesInput: readonly DeliverableInput[]
): ProjectDeliverable[] {
  let updated: ProjectDeliverable[] = [...existing];

  for (const deliverableData of deliverablesInput) {
    // Separate the (possibly undefined) id from the field payload so we
    // never spread `id: undefined` into Firestore data (rule 12).
    const { id: incomingId, ...fields } = deliverableData;

    if (incomingId) {
      if (!updated.some((d) => d.id === incomingId)) {
        throw new Error(`Deliverable ${incomingId} not found`);
      }
      updated = updated.map(
        (d): ProjectDeliverable => (d.id === incomingId ? { ...d, ...fields } : d)
      );
    } else {
      updated = [...updated, { ...fields, id: `del-${crypto.randomUUID().slice(0, 8)}` }];
    }
  }

  return updated;
}

/**
 * Create or update MULTIPLE charter deliverables in one pass and recompute
 * project progress ONCE — the batch counterpart to `saveDeliverable` (which
 * stays single-item; this is an addition, not a refactor, rule 16). Used
 * when a caller has a whole list to seed at once (e.g. importing a
 * deliverables register) rather than one dialog save at a time.
 */
export async function saveDeliverablesBatch(
  db: Firestore,
  projectId: string,
  deliverablesInput: DeliverableInput[],
  userId: string,
  userPermissions: number
): Promise<void> {
  requirePermission(
    userPermissions,
    PERMISSION_FLAGS.MANAGE_PROJECTS,
    userId,
    'save project deliverables (batch)'
  );

  if (deliverablesInput.length === 0) {
    return;
  }

  await retryOnStaleToken(() =>
    runTransaction(db, async (tx) => {
      const projectRef = doc(db, COLLECTIONS.PROJECTS, projectId);
      const snap = await tx.get(projectRef);
      if (!snap.exists()) {
        throw new Error(`Project ${projectId} not found`);
      }

      const existing: ProjectDeliverable[] = (snap.data() as Project).charter?.deliverables ?? [];
      const updated = mergeDeliverablesBatch(existing, deliverablesInput);

      tx.update(projectRef, {
        'charter.deliverables': updated,
        progress: computeProjectProgress(updated),
        updatedAt: Timestamp.now(),
        updatedBy: userId,
      });
    })
  );
}

/**
 * Delete a charter deliverable and recompute project progress atomically.
 */
export async function deleteDeliverable(
  db: Firestore,
  projectId: string,
  deliverableId: string,
  userId: string,
  userPermissions: number
): Promise<void> {
  requirePermission(
    userPermissions,
    PERMISSION_FLAGS.MANAGE_PROJECTS,
    userId,
    'delete project deliverable'
  );

  await retryOnStaleToken(() =>
    runTransaction(db, async (tx) => {
      const projectRef = doc(db, COLLECTIONS.PROJECTS, projectId);
      const snap = await tx.get(projectRef);
      if (!snap.exists()) {
        throw new Error(`Project ${projectId} not found`);
      }

      const deliverables: ProjectDeliverable[] =
        (snap.data() as Project).charter?.deliverables ?? [];
      const updated = deliverables.filter((d) => d.id !== deliverableId);

      tx.update(projectRef, {
        'charter.deliverables': updated,
        progress: computeProjectProgress(updated),
        updatedAt: Timestamp.now(),
        updatedBy: userId,
      });
    })
  );

  // Hard delete of charter content is a sensitive op (rule 18)
  await logAuditEvent(
    db,
    createAuditContext(userId, '', ''),
    'PROJECT_UPDATED',
    'PROJECT',
    projectId,
    `Charter deliverable ${deliverableId} deleted`,
    { entityName: projectId, metadata: { deliverableId } }
  ).catch((err) => logger.error('Failed to log audit event', { error: err }));
}
