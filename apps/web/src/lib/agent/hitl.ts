/**
 * Human-In-The-Loop (HITL) Library
 *
 * Phase 0 of AI-AGENT-ROADMAP-2026-04-25.md — "HITL infrastructure".
 *
 * Every risky tool call from the agent routes through here:
 *
 *   1. Tool framework's executeTool() detects the tool was registered
 *      with `requireHumanApproval: true` and calls `requestApproval()`.
 *   2. requestApproval() writes a PENDING row to `agentTasks` and
 *      returns its id.
 *   3. The orchestrator either polls via `awaitApproval()` (synchronous
 *      flow), OR the run transitions to AWAITING_HITL and parks until
 *      the inbox UI flips the row to APPROVED / REJECTED.
 *   4. A human approver clicks Approve/Reject in /admin/agent-tasks,
 *      which calls `approveAgentTask()` / `rejectAgentTask()`.
 *   5. The orchestrator resumes (or aborts) based on the decision.
 *
 * State transitions are validated by `agentTaskStateMachine` per
 * CLAUDE.md rule #8.
 */

import {
  collection,
  doc,
  addDoc,
  updateDoc,
  getDoc,
  getDocs,
  query,
  where,
  orderBy,
  limit as fsLimit,
  Timestamp,
  type Firestore,
  type QueryConstraint,
} from 'firebase/firestore';
import { COLLECTIONS } from '@vapour/firebase';
import { createLogger } from '@vapour/logger';
import { docToTyped } from '@/lib/firebase/typeHelpers';
import type {
  AgentTask,
  AgentTaskStatus,
  AgentTaskRiskLevel,
  CreateAgentTaskInput,
  DecideAgentTaskInput,
} from '@vapour/types';
import { requireValidTransition } from '@/lib/utils/stateMachine';
import { agentTaskStateMachine } from '@/lib/workflow/stateMachines';

const logger = createLogger({ context: 'hitl' });

// ─── Request approval ─────────────────────────────────────────────────────

/**
 * Mint a PENDING approval request and return its task id.
 *
 * The orchestrator gets the id back so it can either:
 *   - hand it to `awaitApproval()` for synchronous flows (a single tool
 *     call that blocks); or
 *   - persist it on the agentRun (`hitlPendingCount += 1`) and let the
 *     run transition to AWAITING_HITL, where a separate worker picks
 *     up the decision later.
 */
export async function requestApproval(db: Firestore, input: CreateAgentTaskInput): Promise<string> {
  // rule5-exempt: HITL queue write; firestore.rules require isAgent() OR isSuperAdmin() to create. The orchestrator runs as the agent identity in production.
  const now = Timestamp.now();
  const data: Omit<AgentTask, 'id'> = {
    tenantId: input.tenantId,
    agentRunId: input.agentRunId,
    toolName: input.toolName,
    description: input.description,
    proposedAction: input.proposedAction,
    risk: input.risk,
    ...(input.entityType !== undefined && { entityType: input.entityType }),
    ...(input.entityId !== undefined && { entityId: input.entityId }),
    ...(input.entityName !== undefined && { entityName: input.entityName }),
    status: 'PENDING',
    ...(input.requiredPermission !== undefined && {
      requiredPermission: input.requiredPermission,
    }),
    ...(input.allowedApproverIds !== undefined && {
      allowedApproverIds: input.allowedApproverIds,
    }),
    requestedAt: now,
    requestedBy: input.requestedBy,
    ...(input.expiresAt !== undefined && { expiresAt: input.expiresAt }),
    ...(input.metadata !== undefined && { metadata: input.metadata }),
    createdAt: now,
    updatedAt: now,
  };

  const ref = await addDoc(collection(db, COLLECTIONS.AGENT_TASKS), data);
  logger.info('hitl approval requested', {
    taskId: ref.id,
    runId: input.agentRunId,
    tool: input.toolName,
    risk: input.risk,
  });
  return ref.id;
}

// ─── Decide (approve / reject / cancel) ──────────────────────────────────

/**
 * Internal: apply a terminal status transition to an agentTasks row.
 * Status guard via `agentTaskStateMachine`.
 */
async function decideAgentTask(
  db: Firestore,
  taskId: string,
  decision: AgentTaskStatus,
  decidedBy: string,
  decidedByName: string,
  reason?: string
): Promise<void> {
  // rule5-exempt: HITL decision write; firestore.rules + state-machine guard enforce safety. The decided-by identity is preserved on the row for audit.
  // rule19-exempt: state-machine transition on a single doc; concurrent approve/reject converges to the first decision (state machine rejects the second), and any race lands on a deterministic terminal state
  const ref = doc(db, COLLECTIONS.AGENT_TASKS, taskId);
  const snap = await getDoc(ref);
  if (!snap.exists()) {
    throw new Error(`Agent task ${taskId} not found`);
  }
  const current = snap.data() as AgentTask;
  requireValidTransition(agentTaskStateMachine, current.status, decision, 'AgentTask');

  await updateDoc(ref, {
    status: decision,
    decidedAt: Timestamp.now(),
    decidedBy,
    decidedByName,
    ...(reason !== undefined && { decisionReason: reason }),
    updatedAt: Timestamp.now(),
  });

  logger.info('hitl decision recorded', { taskId, decision, decidedBy });
}

/** Human approver said yes. */
export async function approveAgentTask(db: Firestore, input: DecideAgentTaskInput): Promise<void> {
  await decideAgentTask(
    db,
    input.taskId,
    'APPROVED',
    input.decidedBy,
    input.decidedByName,
    input.reason
  );
}

/** Human approver said no. */
export async function rejectAgentTask(db: Firestore, input: DecideAgentTaskInput): Promise<void> {
  await decideAgentTask(
    db,
    input.taskId,
    'REJECTED',
    input.decidedBy,
    input.decidedByName,
    input.reason
  );
}

/**
 * Orchestrator pulls the request — e.g. it found the answer another way,
 * or the parent agentRun was aborted. No human approver involved; the
 * decidedBy identity is the agent itself.
 */
export async function cancelAgentTask(
  db: Firestore,
  taskId: string,
  cancelledByAgentUid: string
): Promise<void> {
  await decideAgentTask(db, taskId, 'CANCELLED', cancelledByAgentUid, 'Vapour Agent');
}

/** Sweep: mark a task EXPIRED if its TTL elapsed. Used by a future cron. */
export async function expireAgentTask(db: Firestore, taskId: string): Promise<void> {
  await decideAgentTask(db, taskId, 'EXPIRED', 'system', 'System');
}

// ─── Wait / list ──────────────────────────────────────────────────────────

/**
 * Block until the task transitions out of PENDING, or the timeout
 * elapses. Polls every `intervalMs` (default 2s).
 *
 * The orchestrator uses this for synchronous tools where the agent is
 * mid-thought and willing to wait. For long-running flows (overnight
 * approvals) the run should park in AWAITING_HITL instead.
 */
export interface AwaitApprovalOptions {
  /** Timeout in milliseconds (default 5 minutes). */
  timeoutMs?: number;
  /** Poll interval in milliseconds (default 2 seconds). */
  intervalMs?: number;
}

export async function awaitApproval(
  db: Firestore,
  taskId: string,
  options: AwaitApprovalOptions = {}
): Promise<AgentTask> {
  const timeoutMs = options.timeoutMs ?? 5 * 60 * 1000;
  const intervalMs = options.intervalMs ?? 2000;
  const deadline = Date.now() + timeoutMs;

  while (Date.now() < deadline) {
    const snap = await getDoc(doc(db, COLLECTIONS.AGENT_TASKS, taskId));
    if (!snap.exists()) {
      throw new Error(`Agent task ${taskId} disappeared while awaiting approval`);
    }
    const task = docToTyped<AgentTask>(snap.id, snap.data());
    if (task.status !== 'PENDING') return task;
    await new Promise((resolve) => setTimeout(resolve, intervalMs));
  }

  throw new Error(`Timed out after ${timeoutMs}ms waiting for agent task ${taskId}`);
}

/**
 * Get a single agent task by id (read-only).
 */
export async function getAgentTaskById(db: Firestore, taskId: string): Promise<AgentTask | null> {
  const snap = await getDoc(doc(db, COLLECTIONS.AGENT_TASKS, taskId));
  if (!snap.exists()) return null;
  return docToTyped<AgentTask>(snap.id, snap.data());
}

/**
 * List approval requests for the inbox UI. Defaults to PENDING rows for
 * the tenant ordered by oldest first (so approvers chip away at the
 * oldest backlog first).
 */
export interface ListAgentTasksOptions {
  tenantId: string;
  status?: AgentTaskStatus;
  agentRunId?: string;
  risk?: AgentTaskRiskLevel;
  limit?: number;
}

export async function listAgentTasks(
  db: Firestore,
  options: ListAgentTasksOptions
): Promise<AgentTask[]> {
  const constraints: QueryConstraint[] = [where('tenantId', '==', options.tenantId)];
  if (options.status) constraints.push(where('status', '==', options.status));
  if (options.agentRunId) constraints.push(where('agentRunId', '==', options.agentRunId));
  if (options.risk) constraints.push(where('risk', '==', options.risk));
  // PENDING ascends (oldest first); decided rows descend (newest first).
  constraints.push(orderBy('requestedAt', options.status === 'PENDING' ? 'asc' : 'desc'));
  constraints.push(fsLimit(options.limit ?? 100));

  const q = query(collection(db, COLLECTIONS.AGENT_TASKS), ...constraints);
  const snap = await getDocs(q);
  return snap.docs.map((d) => docToTyped<AgentTask>(d.id, d.data()));
}
