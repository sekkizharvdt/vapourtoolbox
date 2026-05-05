/**
 * Agent Run Service
 *
 * Phase 0 of AI-AGENT-ROADMAP-2026-04-25.md — "Memory store" workstream.
 *
 * CRUD for the `agentRuns` collection. The orchestrator creates a row at
 * the top of every run, updates incrementally as tools fire, and lands on
 * a terminal status (COMPLETED / FAILED / CANCELLED) at the end. Status
 * transitions are validated by `agentRunStateMachine` per CLAUDE.md
 * rule #8.
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
  AgentRun,
  AgentRunStatus,
  AgentRunTriggerType,
  CreateAgentRunInput,
  UpdateAgentRunInput,
} from '@vapour/types';
import { requireValidTransition } from '@/lib/utils/stateMachine';
import { agentRunStateMachine } from '@/lib/workflow/stateMachines';

const logger = createLogger({ context: 'agentRunService' });

/**
 * Create a new agent run row in PENDING status. Returns the new doc id;
 * the orchestrator should pass this id back as `agentRunId` in every
 * audit log it writes during the run so transcripts join cleanly.
 */
export async function createAgentRun(db: Firestore, input: CreateAgentRunInput): Promise<string> {
  // rule5-exempt: agent infrastructure write; firestore.rules require tenantId on agentRuns.create and the orchestrator runs as a privileged identity (Phase 0 § Agent identity tightens this further)
  const now = Timestamp.now();

  const data: Omit<AgentRun, 'id'> = {
    tenantId: input.tenantId,
    agentId: input.agentId,
    triggerType: input.triggerType,
    ...(input.triggerSource !== undefined && { triggerSource: input.triggerSource }),
    ...(input.triggerPayload !== undefined && { triggerPayload: input.triggerPayload }),
    status: 'PENDING',
    startedAt: now,
    toolCallCount: 0,
    toolNames: [],
    hitlRequestCount: 0,
    hitlPendingCount: 0,
    entityIdsTouched: [],
    ...(input.parentRunId !== undefined && { parentRunId: input.parentRunId }),
    ...(input.sessionId !== undefined && { sessionId: input.sessionId }),
    createdAt: now,
    createdBy: input.initiatedBy,
  };

  const ref = await addDoc(collection(db, COLLECTIONS.AGENT_RUNS), data);
  logger.info('agent run created', {
    runId: ref.id,
    triggerType: input.triggerType,
    agentId: input.agentId,
  });
  return ref.id;
}

/**
 * Fetch a single agent run by id.
 */
export async function getAgentRunById(db: Firestore, runId: string): Promise<AgentRun | null> {
  const snap = await getDoc(doc(db, COLLECTIONS.AGENT_RUNS, runId));
  if (!snap.exists()) return null;
  return docToTyped<AgentRun>(snap.id, snap.data());
}

/**
 * Update an in-flight run. Status changes are validated by the agent run
 * state machine (rule #8); other fields (token counters, tool list, etc.)
 * pass through.
 *
 * The orchestrator typically calls this twice per tool invocation — once
 * to bump `toolCallCount` + add to `toolNames`, and once at the end of
 * the run to set the terminal status.
 */
export async function updateAgentRun(
  db: Firestore,
  runId: string,
  input: UpdateAgentRunInput
): Promise<void> {
  // rule5-exempt: agent infrastructure write; firestore.rules + state-machine guard enforce safety. Caller authority comes from the agent identity (Phase 0).
  // rule19-exempt: agent runs are owned by a single orchestrator instance — concurrent writers on the same row aren't expected; the state-machine guard rejects invalid transitions on the rare race; transactional wrap deferred to the orchestrator-runtime workstream when sub-runs need it
  const ref = doc(db, COLLECTIONS.AGENT_RUNS, runId);

  if (input.status !== undefined) {
    const snap = await getDoc(ref);
    if (!snap.exists()) {
      throw new Error(`Agent run ${runId} not found`);
    }
    const current = snap.data() as AgentRun;
    requireValidTransition(agentRunStateMachine, current.status, input.status, 'AgentRun');
  }

  const patch: Record<string, unknown> = {};
  if (input.status !== undefined) {
    patch.status = input.status;
    if (input.status === 'COMPLETED' || input.status === 'FAILED' || input.status === 'CANCELLED') {
      const completedAt = Timestamp.now();
      patch.completedAt = completedAt;
      // Compute duration if we have startedAt — orchestrator can override.
      const snap = await getDoc(ref);
      const started = (snap.data() as AgentRun).startedAt;
      if (started) {
        patch.totalDurationMs = completedAt.toMillis() - started.toMillis();
      }
    }
  }
  if (input.inputTokens !== undefined) patch.inputTokens = input.inputTokens;
  if (input.outputTokens !== undefined) patch.outputTokens = input.outputTokens;
  if (input.cachedInputTokens !== undefined) patch.cachedInputTokens = input.cachedInputTokens;
  if (input.costUsd !== undefined) patch.costUsd = input.costUsd;
  if (input.toolCallCount !== undefined) patch.toolCallCount = input.toolCallCount;
  if (input.toolNames !== undefined) patch.toolNames = input.toolNames;
  if (input.hitlRequestCount !== undefined) patch.hitlRequestCount = input.hitlRequestCount;
  if (input.hitlPendingCount !== undefined) patch.hitlPendingCount = input.hitlPendingCount;
  if (input.summary !== undefined) patch.summary = input.summary;
  if (input.errorMessage !== undefined) patch.errorMessage = input.errorMessage;
  if (input.entityIdsTouched !== undefined) patch.entityIdsTouched = input.entityIdsTouched;

  await updateDoc(ref, patch);
}

/**
 * List runs for a tenant, optionally filtered by status / trigger type.
 * Powers the observability dashboard.
 */
export interface ListAgentRunsOptions {
  tenantId: string;
  status?: AgentRunStatus;
  triggerType?: AgentRunTriggerType;
  limit?: number;
}

export async function listAgentRuns(
  db: Firestore,
  options: ListAgentRunsOptions
): Promise<AgentRun[]> {
  const constraints: QueryConstraint[] = [where('tenantId', '==', options.tenantId)];
  if (options.status) constraints.push(where('status', '==', options.status));
  if (options.triggerType) constraints.push(where('triggerType', '==', options.triggerType));
  constraints.push(orderBy('startedAt', 'desc'));
  constraints.push(fsLimit(options.limit ?? 100));
  const q = query(collection(db, COLLECTIONS.AGENT_RUNS), ...constraints);
  const snap = await getDocs(q);
  return snap.docs.map((d) => docToTyped<AgentRun>(d.id, d.data()));
}

/**
 * Fetch every run that belongs to the same session, in chronological
 * order. Used by the chat / session view to replay multi-turn history.
 */
export async function listSessionRuns(db: Firestore, sessionId: string): Promise<AgentRun[]> {
  const q = query(
    collection(db, COLLECTIONS.AGENT_RUNS),
    where('sessionId', '==', sessionId),
    orderBy('startedAt', 'asc')
  );
  const snap = await getDocs(q);
  return snap.docs.map((d) => docToTyped<AgentRun>(d.id, d.data()));
}
