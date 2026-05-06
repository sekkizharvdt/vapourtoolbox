/**
 * executeTool — the host-agnostic runtime that wraps a tool definition
 * with all the cross-cutting concerns the orchestrator wants to be
 * applied uniformly:
 *
 *   1. Zod-validate the input.
 *   2. Log a "tool started" audit row.
 *   3. If requireHumanApproval is on, mint an HITL request and return
 *      kind: 'pending-hitl' WITHOUT calling execute.
 *   4. Otherwise call execute and capture timing.
 *   5. Log a "tool ended" audit row (success or failure).
 *   6. Map thrown errors to kind: 'error'.
 *
 * The host (web app / MCP server / Cloud Function) supplies a
 * `ToolRuntime` that adapts steps 2, 3, 5 to its environment. Tool
 * implementations don't need to know which host called them.
 */

import type { ZodTypeAny, z } from 'zod';
import type { ToolContext, ToolDefinition, ToolResult, ToolRuntime } from './types';

export async function executeTool<TIn extends ZodTypeAny, TOut>(
  tool: ToolDefinition<TIn, TOut>,
  rawInput: unknown,
  ctx: ToolContext,
  runtime: ToolRuntime
): Promise<ToolResult<TOut>> {
  // 1. Zod validation. Schema errors are surfaced as ToolResult.error
  //    so the orchestrator's error path is uniform across "Anthropic
  //    sent us a malformed call" vs "tool itself failed".
  const parsed = tool.inputSchema.safeParse(rawInput);
  if (!parsed.success) {
    return {
      kind: 'error',
      error: `input validation failed for tool '${tool.name}': ${parsed.error.message}`,
      cause: parsed.error,
    };
  }
  const input = parsed.data as z.infer<TIn>;

  // 2. Log start. This is fire-and-forget on purpose — even if the
  //    audit-log write fails, we still want to attempt the tool.
  const startTime = Date.now();
  await runtime
    .logToolStart({
      tool: tool.name,
      ctx,
      inputJson: safeStringify(input),
      ...(tool.metadata !== undefined && { metadata: tool.metadata }),
    })
    .catch(() => {
      /* swallow — audit failures must not block tool execution */
    });

  // 3. HITL gate. Resolve dynamic gates (function-based) here so the
  //    tool author can branch on input.
  const needsApproval = await resolveHitl(tool, input, ctx);
  if (needsApproval) {
    if (!tool.risk) {
      // defineTool already enforces this, but be belt-and-suspenders
      // when the gate is dynamic and only resolved at call time.
      return {
        kind: 'error',
        error: `tool '${tool.name}' requires HITL but has no risk class declared`,
      };
    }
    try {
      const taskId = await runtime.requestApproval({
        ctx,
        toolName: tool.name,
        description: humanDescriptionOf(tool, input),
        proposedAction: safeStringify(input),
        risk: tool.risk,
        ...(tool.approverPermission !== undefined && {
          approverPermission: tool.approverPermission,
        }),
      });
      await runtime
        .logToolEnd({
          tool: tool.name,
          ctx,
          durationMs: Date.now() - startTime,
          success: true,
          outputSummary: `HITL pending — agentTasks/${taskId}`,
        })
        .catch(() => {
          /* swallow */
        });
      return { kind: 'pending-hitl', taskId };
    } catch (err) {
      return wrapError(tool.name, err);
    }
  }

  // 4 + 5. Execute and log the result.
  try {
    const output = await tool.execute(input, ctx);
    await runtime
      .logToolEnd({
        tool: tool.name,
        ctx,
        durationMs: Date.now() - startTime,
        success: true,
        outputSummary: shortOutputSummary(output),
      })
      .catch(() => {
        /* swallow */
      });
    return { kind: 'ok', output };
  } catch (err) {
    const errorMessage = err instanceof Error ? err.message : String(err);
    await runtime
      .logToolEnd({
        tool: tool.name,
        ctx,
        durationMs: Date.now() - startTime,
        success: false,
        errorMessage,
      })
      .catch(() => {
        /* swallow */
      });
    return wrapError(tool.name, err);
  }
}

// ─── Helpers ──────────────────────────────────────────────────────────────

async function resolveHitl<TIn extends ZodTypeAny, TOut>(
  tool: ToolDefinition<TIn, TOut>,
  input: z.infer<TIn>,
  ctx: ToolContext
): Promise<boolean> {
  if (!tool.requireHumanApproval) return false;
  if (typeof tool.requireHumanApproval === 'boolean') return tool.requireHumanApproval;
  return tool.requireHumanApproval(input, ctx);
}

function humanDescriptionOf<TIn extends ZodTypeAny, TOut>(
  tool: ToolDefinition<TIn, TOut>,
  input: z.infer<TIn>
): string {
  // Default description used by the inbox when the tool author hasn't
  // supplied a richer summary. The tool itself can attach a friendlier
  // string via metadata.descriptionTemplate in a future iteration.
  return `Agent proposes ${tool.name}: ${truncate(safeStringify(input), 200)}`;
}

function wrapError(toolName: string, err: unknown): ToolResult<never> {
  const message = err instanceof Error ? err.message : String(err);
  return {
    kind: 'error',
    error: `tool '${toolName}' failed: ${message}`,
    cause: err,
  };
}

function safeStringify(value: unknown): string {
  try {
    return JSON.stringify(value);
  } catch {
    return String(value);
  }
}

function shortOutputSummary(output: unknown): string {
  if (output === null || output === undefined) return 'ok';
  const s = safeStringify(output);
  return truncate(s, 200);
}

function truncate(s: string, max: number): string {
  return s.length > max ? `${s.slice(0, max - 1)}…` : s;
}
