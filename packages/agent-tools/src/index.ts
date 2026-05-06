/**
 * @vapour/agent-tools
 *
 * Phase 0 of AI-AGENT-ROADMAP-2026-04-25.md — "Tool framework" workstream.
 *
 * Host-agnostic tool framework. The package exports:
 *
 *   - `defineTool(...)` — type-safe tool registration with input
 *     schema, HITL gate, risk class, and execute body.
 *   - `executeTool(...)` — runtime that wraps a tool definition with
 *     Zod validation, audit logging, HITL gating, and error mapping.
 *     Hosts (web app, MCP server, Cloud Function) supply a
 *     `ToolRuntime` adapter.
 *   - `ToolContext`, `ToolResult`, `ToolDefinition`, `ToolRuntime`,
 *     `ToolStartLog`, `ToolEndLog`, `HitlRequestParams` — types that
 *     tool authors and host adapters consume.
 *
 * Implementing a host: see apps/web/src/lib/agent/toolRuntime.ts for
 * the canonical web-side runtime that bridges to clientAuditService
 * + lib/agent/hitl.
 */

export { defineTool } from './defineTool';
export { executeTool } from './executeTool';
export type {
  ToolContext,
  ToolDefinition,
  ToolResult,
  ToolRuntime,
  ToolStartLog,
  ToolEndLog,
  HitlRequestParams,
} from './types';
