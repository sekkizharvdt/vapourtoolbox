/**
 * Agent Task Expiry — scheduled cron sweep.
 *
 * Phase 0 of AI-AGENT-ROADMAP-2026-04-25.md — "Inbox triggers" workstream.
 *
 * agentTasks rows can be created with an optional `expiresAt` TTL. When
 * the deadline passes without a human decision, the task should move to
 * EXPIRED so the orchestrator can take its parallel path (timeout
 * handler) instead of waiting forever.
 *
 * This Cloud Function runs every 10 minutes, picks up PENDING rows
 * whose expiresAt has passed, and writes the EXPIRED transition with
 * actorType: 'system' on the matching audit row.
 *
 * It is intentionally separate from the orchestrator runtime — the
 * orchestrator might be down (cold start, deploy, network blip) when a
 * deadline elapses; the cron stays online so timeouts are deterministic.
 */

import { onSchedule } from 'firebase-functions/v2/scheduler';
import { logger } from 'firebase-functions/v2';
import * as admin from 'firebase-admin';
import { FieldValue } from 'firebase-admin/firestore';
import { createAuditLog } from './utils/audit';

const COLLECTIONS = {
  AGENT_TASKS: 'agentTasks',
  AGENT_RUNS: 'agentRuns',
};

interface AgentTaskRow {
  status: string;
  expiresAt?: admin.firestore.Timestamp;
  agentRunId?: string;
  toolName?: string;
  tenantId?: string;
}

/**
 * Sweep agentTasks: any PENDING row with expiresAt < now becomes EXPIRED.
 *
 * Schedule: every 10 minutes — granular enough that timeouts feel close
 * to user-set deadlines, infrequent enough that we're not banging on
 * Firestore for free.
 */
export const expireStaleAgentTasks = onSchedule(
  {
    schedule: 'every 10 minutes',
    timeZone: 'UTC',
    region: 'us-central1',
    memory: '256MiB',
    maxInstances: 1,
  },
  async (event) => {
    logger.info('agent-task expiry sweep', { scheduledTime: event.scheduleTime });
    const db = admin.firestore();
    const now = admin.firestore.Timestamp.now();

    // PENDING rows whose expiresAt has passed. The composite index on
    // (status, expiresAt) doesn't exist yet, so for Phase 0 we narrow
    // first by status then filter expiresAt client-side. The dataset is
    // small (Phase 0 scope is one tenant, low task volume); add an
    // index when we see N > a few hundred PENDING rows in a sweep.
    const snapshot = await db
      .collection(COLLECTIONS.AGENT_TASKS)
      .where('status', '==', 'PENDING')
      .get();

    if (snapshot.empty) {
      logger.info('no pending agent tasks');
      return;
    }

    const expired: { id: string; data: AgentTaskRow }[] = [];
    snapshot.docs.forEach((doc) => {
      const data = doc.data() as AgentTaskRow;
      if (data.expiresAt && data.expiresAt.toMillis() < now.toMillis()) {
        expired.push({ id: doc.id, data });
      }
    });

    if (expired.length === 0) {
      logger.info('no stale pending tasks', { scanned: snapshot.size });
      return;
    }

    logger.info('expiring stale agent tasks', {
      count: expired.length,
      scanned: snapshot.size,
    });

    // Apply transitions in batches of 500 (CLAUDE.md rule #20). Each
    // expiry is one update on the task + one increment on the parent
    // run's hitlPendingCount, so we cap at 250 expired tasks per batch.
    // rule20-exempt: bounded by the small dataset (Phase 0 scope) AND
    // by the explicit chunkSize guard below.
    const chunkSize = 250;
    for (let i = 0; i < expired.length; i += chunkSize) {
      const slice = expired.slice(i, i + chunkSize);
      const batch = db.batch();
      const auditPayloads: Array<{
        agentRunId: string;
        toolName: string;
        taskId: string;
        tenantId?: string;
      }> = [];

      slice.forEach(({ id, data }) => {
        batch.update(db.collection(COLLECTIONS.AGENT_TASKS).doc(id), {
          status: 'EXPIRED',
          decidedAt: now,
          decidedBy: 'system',
          decidedByName: 'System',
          decisionReason: 'TTL elapsed without a decision',
          updatedAt: now,
        });

        if (data.agentRunId) {
          batch.update(db.collection(COLLECTIONS.AGENT_RUNS).doc(data.agentRunId), {
            hitlPendingCount: FieldValue.increment(-1),
            updatedAt: now,
          });
          auditPayloads.push({
            agentRunId: data.agentRunId,
            toolName: data.toolName ?? 'unknown',
            taskId: id,
            ...(data.tenantId !== undefined && { tenantId: data.tenantId }),
          });
        }
      });

      await batch.commit();

      // Write the matching audit log row outside the batch — auditLogs
      // create rule expects a write per row, not a batched commit, and
      // we want to record EVERY expiry even if the batch update raced.
      for (const payload of auditPayloads) {
        await createAuditLog({
          actorId: 'system',
          actorEmail: 'system@vapourdesal.com',
          actorName: 'System',
          actorType: 'system',
          agentRunId: payload.agentRunId,
          agentToolName: payload.toolName,
          action: 'AGENT_HITL_REJECTED',
          severity: 'WARNING',
          entityType: 'AGENT_TASK',
          entityId: payload.taskId,
          description: `HITL request expired: ${payload.toolName}`,
          metadata: { reason: 'TTL elapsed' },
        });
      }
    }

    logger.info('expiry sweep complete', { expired: expired.length });
  }
);
