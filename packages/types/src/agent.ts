/**
 * AI Agent Foundation Types
 *
 * Phase 0 of AI-AGENT-ROADMAP-2026-04-25.md — "Memory store" workstream.
 *
 * Three collections form the agent's persistence layer:
 *
 * - `agentRuns` — one document per orchestrator invocation. The transcript
 *   sink that pairs with the `agentRunId` carried on every agent-origin
 *   audit log row (see audit.ts). Tracks status, cost, tools used,
 *   entities touched, and links back to the trigger that started it.
 *
 * - `agentMemory` — long-term facts the agent reads at the start of a run
 *   ("vendor X always responds within 2 days", "PO batches > ₹5L need CFO
 *   sign-off"). Curated by humans or learned by the agent itself; the
 *   `source` field tracks which.
 *
 * - `agentSessions` — multi-turn conversation threads. Optional for v1
 *   (agent is mostly cron/inbox-triggered) but defined now so the data
 *   model is stable when chat-style use cases come online.
 */

import type { Timestamp } from 'firebase/firestore';

// ─── AgentRun ─────────────────────────────────────────────────────────────

/**
 * Lifecycle of a single agent run. The orchestrator transitions through
 * these states deterministically; the state machine in
 * apps/web/src/lib/workflow/stateMachines.ts validates transitions.
 *
 * - PENDING       — queued; orchestrator hasn't picked it up yet
 * - RUNNING       — orchestrator is actively executing tools
 * - AWAITING_HITL — paused; waiting for human approval on a sensitive op
 * - COMPLETED     — terminal: finished successfully
 * - FAILED        — terminal: hit an unrecoverable error
 * - CANCELLED     — terminal: a human rejected an HITL prompt or aborted
 */
export type AgentRunStatus =
  | 'PENDING'
  | 'RUNNING'
  | 'AWAITING_HITL'
  | 'COMPLETED'
  | 'FAILED'
  | 'CANCELLED';

/**
 * What initiated the run. Used for analytics + observability.
 */
export type AgentRunTriggerType =
  | 'human' // a user clicked "Ask the agent"
  | 'cron' // scheduled job (daily digest, overdue chase, etc.)
  | 'gmail' // incoming email triggered the run
  | 'webhook' // external webhook
  | 'agentTask' // queue worker picked up an `agentTasks` row
  | 'sub-run'; // parent run invoked a sub-agent

export interface AgentRun {
  id: string;

  // Tenant scoping (CLAUDE.md rule #1)
  tenantId: string;

  // Identity of the agent that ran. Foreign key to the agent's Firebase
  // user (see AI-AGENT-ROADMAP Phase 0 § "Agent identity"). Stored as a
  // free string for now so this layer compiles before the identity is
  // provisioned; tighten to a literal once `agent@vapourtoolbox.internal`
  // is the canonical uid.
  agentId: string;

  // What kicked off the run + a free-text pointer to the trigger source
  // (user uid for 'human', cron job name for 'cron', message id for
  // 'gmail', etc.).
  triggerType: AgentRunTriggerType;
  triggerSource?: string;

  // Original input the agent received. Truncated client-side if large
  // (e.g. an email body) — full content lives in linked entities.
  triggerPayload?: string;

  // Status + state-machine timestamps
  status: AgentRunStatus;
  startedAt: Timestamp;
  completedAt?: Timestamp;
  totalDurationMs?: number;

  // Cost tracking (Anthropic API). Null while running.
  inputTokens?: number;
  outputTokens?: number;
  cachedInputTokens?: number;
  costUsd?: number;

  // Tool usage rollup
  toolCallCount: number;
  toolNames: string[]; // distinct tools, in call order

  // HITL rollup
  hitlRequestCount: number;
  hitlPendingCount: number;

  // Result
  summary?: string; // human-readable one-liner ("Created 3 PRs and 1 RFQ")
  errorMessage?: string;

  // Foreign keys to entities the run wrote (for cross-run analytics + the
  // observability dashboard's "what did the agent touch today" view).
  entityIdsTouched: string[];

  // Hierarchy: a run can spawn sub-runs (delegate to a specialist agent)
  // or belong to an ongoing session.
  parentRunId?: string;
  sessionId?: string;

  // Audit
  createdAt: Timestamp;
  createdBy: string; // userId of the human / agent that initiated
}

// ─── AgentMemory ──────────────────────────────────────────────────────────

/**
 * Origin of a memory entry. Provenance matters because human-curated
 * facts override agent-learned ones, and "imported" tags are needed for
 * compliance audits.
 */
export type AgentMemorySource = 'human' | 'agent' | 'imported';

/**
 * Coarse classification for filter UIs and prompt slicing — the agent
 * loads memory by category at run start ("give me everything about
 * vendors" / "give me my user preferences").
 */
export type AgentMemoryCategory =
  | 'vendor'
  | 'customer'
  | 'project'
  | 'user-preference'
  | 'organization'
  | 'process'
  | 'fact';

export interface AgentMemory {
  id: string;

  // Tenant scoping (CLAUDE.md rule #1)
  tenantId: string;

  // Stable identifier — used as a lookup key when re-reading the same
  // fact. Convention: dot-segmented ("vendor.acme.lead-time",
  // "user.skk.preferences.po-batching"). Unique within a tenant.
  key: string;

  // The fact body. String for free-text; serialise structured payloads
  // to JSON if needed.
  value: string;

  // Filter axis for prompt slicing
  category: AgentMemoryCategory;

  // Optional link to a domain entity so memory can be loaded "for the
  // doc the agent is currently working on".
  entityType?: string; // matches AuditEntityType when set
  entityId?: string;

  // Confidence on a 0..1 scale — affects how the prompt presents the fact
  // ("definitely" vs "probably"). Required so the agent can't quietly
  // present 0.3-confidence guesses as facts.
  confidence: number;

  // Provenance
  source: AgentMemorySource;
  sourceRunId?: string; // when source === 'agent'
  sourceCitation?: string; // free text — "from email thread X", "PO/2026/004 vendor said"

  // Verification — humans can confirm an agent-learned fact, which
  // promotes its weight in the prompt
  verifiedAt?: Timestamp;
  verifiedBy?: string;

  // Optional TTL for time-sensitive facts (e.g. "vendor X is on holiday
  // until 2026-05-30"). The orchestrator filters expired rows at load.
  expiresAt?: Timestamp;

  // Soft active flag (rule #3 prefers active flags over isDeleted for
  // queryable lists)
  isActive: boolean;

  // Audit
  createdAt: Timestamp;
  createdBy: string;
  updatedAt: Timestamp;
  updatedBy: string;
}

// ─── AgentSession ─────────────────────────────────────────────────────────

export type AgentSessionStatus = 'ACTIVE' | 'CLOSED';

export interface AgentSession {
  id: string;

  // Tenant scoping (CLAUDE.md rule #1)
  tenantId: string;

  // The human partner in the session (or null for purely autonomous runs
  // that share a session for analytics).
  userId?: string;

  // Auto-derived from the first message; admin can rename
  title: string;

  // Latest activity — used to order the user's session list
  lastMessageAt: Timestamp;
  messageCount: number;

  // Runs that belong to this session (in order). The session itself
  // stores the rollup; the actual transcript lives in agentRuns.
  runIds: string[];

  status: AgentSessionStatus;

  // Optional free-form context the agent maintains across turns
  // (selected project, current focus, etc.).
  metadata?: Record<string, unknown>;

  // Audit
  createdAt: Timestamp;
  updatedAt: Timestamp;
}

// ─── Input shapes (used by the service layer + Cloud Functions) ──────────

export interface CreateAgentRunInput {
  tenantId: string;
  agentId: string;
  triggerType: AgentRunTriggerType;
  triggerSource?: string;
  triggerPayload?: string;
  parentRunId?: string;
  sessionId?: string;
  /** uid of the human (or agent) that initiated the run */
  initiatedBy: string;
}

export interface UpdateAgentRunInput {
  // Status transition — validated by agentRunStateMachine
  status?: AgentRunStatus;

  // Token / cost rollups (incremental updates accepted)
  inputTokens?: number;
  outputTokens?: number;
  cachedInputTokens?: number;
  costUsd?: number;

  toolCallCount?: number;
  toolNames?: string[];
  hitlRequestCount?: number;
  hitlPendingCount?: number;

  summary?: string;
  errorMessage?: string;
  entityIdsTouched?: string[];
}

export interface UpsertAgentMemoryInput {
  tenantId: string;
  key: string;
  value: string;
  category: AgentMemoryCategory;
  entityType?: string;
  entityId?: string;
  confidence: number;
  source: AgentMemorySource;
  sourceRunId?: string;
  sourceCitation?: string;
  expiresAt?: Timestamp;
  /** uid of the writer (human admin or agent) */
  writtenBy: string;
}

// ─── AgentTask (HITL queue) ───────────────────────────────────────────────

/**
 * Lifecycle of a Human-In-The-Loop approval request.
 *
 * - PENDING   — waiting for a human to decide
 * - APPROVED  — human said yes; orchestrator resumes the run
 * - REJECTED  — human said no; orchestrator cancels the run (or the run
 *               handles the rejection however it wants)
 * - EXPIRED   — TTL elapsed without a decision; orchestrator must
 *               retry or fail the run
 * - CANCELLED — orchestrator pulled the request (e.g. it figured the
 *               action out a different way, or the run was aborted)
 */
export type AgentTaskStatus = 'PENDING' | 'APPROVED' | 'REJECTED' | 'EXPIRED' | 'CANCELLED';

/**
 * Risk class drives default UI treatment + logging severity.
 *
 * - LOW    — routine, idempotent ops (e.g. send a draft vendor email)
 * - MEDIUM — non-financial state changes (e.g. transition PR DRAFT → SUBMITTED)
 * - HIGH   — financial postings, deletions, irreversible state changes
 *
 * The orchestrator writes this; the admin UI surfaces it as a chip.
 */
export type AgentTaskRiskLevel = 'LOW' | 'MEDIUM' | 'HIGH';

export interface AgentTask {
  id: string;

  // Tenant scoping (CLAUDE.md rule #1)
  tenantId: string;

  // Origin: which run is awaiting this approval, and which tool fired the request
  agentRunId: string;
  toolName: string;

  // Human-readable summary the approver sees in the inbox
  // ("Create PR for ₹50,000 to ACME Pumps for project P-2026-008")
  description: string;

  // Verbose proposed action — the full tool input the agent intends to
  // execute on approval. Stored as a JSON-stringified payload so the
  // schema is open-ended; the admin UI renders it pretty-printed.
  proposedAction: string;

  risk: AgentTaskRiskLevel;

  // Optional context — used by the inbox to show "this is about <doc>"
  // and let the approver click through to the entity's detail page.
  entityType?: string;
  entityId?: string;
  entityName?: string;

  status: AgentTaskStatus;

  // Permission / approver gating
  // - requiredPermission: the bitwise flag the approver must hold (e.g.
  //   PERMISSION_FLAGS.MANAGE_PROCUREMENT for procurement tools)
  // - allowedApproverIds: optional explicit list (e.g. routing to a
  //   specific user); takes precedence over requiredPermission when set.
  requiredPermission?: number;
  allowedApproverIds?: string[];

  // Timing
  requestedAt: Timestamp;
  /** uid of the agent identity (or human user, for chained workflows) */
  requestedBy: string;
  expiresAt?: Timestamp;
  decidedAt?: Timestamp;
  decidedBy?: string;
  decidedByName?: string;
  decisionReason?: string;

  // Optional free-form context the orchestrator attaches
  metadata?: Record<string, unknown>;

  // Audit
  createdAt: Timestamp;
  updatedAt: Timestamp;
}

export interface CreateAgentTaskInput {
  tenantId: string;
  agentRunId: string;
  toolName: string;
  description: string;
  proposedAction: string;
  risk: AgentTaskRiskLevel;
  entityType?: string;
  entityId?: string;
  entityName?: string;
  requiredPermission?: number;
  allowedApproverIds?: string[];
  expiresAt?: Timestamp;
  metadata?: Record<string, unknown>;
  /** uid of the requester — the agent identity in the canonical case */
  requestedBy: string;
}

export interface DecideAgentTaskInput {
  taskId: string;
  /** uid of the human approver */
  decidedBy: string;
  /** display name (cached on the row so the inbox doesn't have to re-fetch) */
  decidedByName: string;
  /** optional rationale; required for REJECT in the UI but not in the type */
  reason?: string;
}
