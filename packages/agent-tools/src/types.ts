/**
 * Tool Framework Types
 *
 * Phase 0 of AI-AGENT-ROADMAP-2026-04-25.md — "Tool framework" workstream.
 *
 * The framework is intentionally I/O-shape-only. The wiring (audit
 * logging via clientAuditService, HITL via lib/agent/hitl) lives in the
 * web-side runtime so that pulling agent-tools into a different host
 * (the Cloud Function tool surface, an MCP server, a Node.js
 * orchestrator) just means giving it a different runtime adapter.
 *
 * The host implements `ToolRuntime` and passes a `ToolContext` per call;
 * the tool's `execute` function is pure with respect to that context.
 */

import type { z, ZodTypeAny } from 'zod';
import type { AgentTaskRiskLevel } from '@vapour/types';

/**
 * Per-call context the runtime hands to a tool. The agent identity,
 * the run id, and the tenant come from the orchestrator; the tool
 * uses them to scope its work and to stamp every Firestore write
 * with a matching audit row.
 */
export interface ToolContext {
  /** Tenant scope for the run (CLAUDE.md rule #1). */
  tenantId: string;
  /** Foreign key to the parent `agentRuns` row. */
  agentRunId: string;
  /** Firebase UID of the calling agent identity. */
  agentUserId: string;
  /**
   * Permissions bitfield from the agent's custom claims. The runtime
   * does NOT enforce permissions here — that's firestore.rules' job.
   * Tools may use it for early-exit hints.
   */
  agentPermissions: number;
  /** Optional human partner if the tool is run from a chat session. */
  humanUserId?: string;
}

/**
 * Result the runtime returns for a single tool invocation.
 *
 * - `kind: 'ok'`        — tool finished; `output` is the typed return value.
 * - `kind: 'pending-hitl'` — tool was gated; `taskId` is the agentTasks
 *                            row that the orchestrator must wait on.
 * - `kind: 'error'`     — tool threw / Zod validation failed; `error`
 *                          carries the message + optional cause.
 */
export type ToolResult<TOut> =
  | { kind: 'ok'; output: TOut }
  | { kind: 'pending-hitl'; taskId: string }
  | { kind: 'error'; error: string; cause?: unknown };

/**
 * A single agent tool definition. The agent orchestrator imports this
 * shape and exposes it via MCP / function-calling; the runtime wraps
 * `execute` with audit + HITL + Zod.
 */
export interface ToolDefinition<TIn extends ZodTypeAny, TOut> {
  /** Stable tool identifier (e.g. 'createDraftPR'). Also written to
   *  auditLogs.agentToolName. Must be unique within a registry. */
  name: string;

  /** One-line description for the LLM — appears in the tool catalog
   *  the orchestrator passes as the `tools` parameter to the model. */
  description: string;

  /** Zod schema for the input payload. The runtime validates the
   *  caller's args against this before invoking `execute`. */
  inputSchema: TIn;

  /**
   * HITL gate. When `true`, the runtime mints an agentTasks row
   *   instead of calling `execute`, and returns kind: 'pending-hitl'.
   *   The orchestrator either polls (synchronous) or parks the run
   *   in AWAITING_HITL (asynchronous).
   * Pass a function instead of a literal to derive HITL from input —
   *   e.g. require approval only when amount > ₹50k.
   */
  requireHumanApproval?:
    | boolean
    | ((input: z.infer<TIn>, ctx: ToolContext) => boolean | Promise<boolean>);

  /**
   * Risk class for the audit dashboard + HITL queue chip. Drives the
   * default approver permission and severity. Must be supplied when
   * `requireHumanApproval` is anything but literal `false`.
   */
  risk?: AgentTaskRiskLevel;

  /**
   * If the runtime mints an HITL request, this is the permission flag
   * the human approver must hold. Defaults are derived per risk class
   * by the runtime when omitted.
   */
  approverPermission?: number;

  /** Free-form metadata — surfaced on the auditLogs row's metadata
   *  field for cross-tool analytics. */
  metadata?: Record<string, unknown>;

  /** The actual implementation. The runtime guarantees:
   *    - input has been Zod-validated;
   *    - if requireHumanApproval was true, this won't be called until
   *      a human approver said yes;
   *    - execute MAY throw — the runtime maps thrown errors to a
   *      ToolResult of kind: 'error'. */
  execute: (input: z.infer<TIn>, ctx: ToolContext) => Promise<TOut>;
}

/**
 * Adapter the host (web app, MCP server, Cloud Function) supplies. The
 * runtime calls these to actually write to Firestore / log audits /
 * mint HITL rows. Keeping the adapters separate from the tool registry
 * means the same tool definition can be called from any host without
 * pulling client-side Firebase into a server-side bundle (and vice
 * versa).
 */
export interface ToolRuntime {
  /** Log an audit row for the tool invocation (start). The runtime
   *  calls this even when the tool is HITL-gated, so the request side
   *  of the queue is also recorded. */
  logToolStart: (params: ToolStartLog) => Promise<void>;
  /** Log an audit row for the tool's result (success or error). */
  logToolEnd: (params: ToolEndLog) => Promise<void>;
  /** Mint an HITL approval request and return the task id. */
  requestApproval: (params: HitlRequestParams) => Promise<string>;
}

export interface ToolStartLog {
  tool: string;
  ctx: ToolContext;
  inputJson: string;
  metadata?: Record<string, unknown>;
}

export interface ToolEndLog {
  tool: string;
  ctx: ToolContext;
  durationMs: number;
  success: boolean;
  errorMessage?: string;
  outputSummary?: string;
}

export interface HitlRequestParams {
  ctx: ToolContext;
  toolName: string;
  description: string;
  proposedAction: string;
  risk: AgentTaskRiskLevel;
  approverPermission?: number;
}
