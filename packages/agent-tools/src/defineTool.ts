/**
 * defineTool — the canonical way to register a tool that the agent can call.
 *
 * Phase 0 of AI-AGENT-ROADMAP-2026-04-25.md — "Tool framework" workstream.
 *
 * Pattern:
 *
 *   const createDraftPR = defineTool({
 *     name: 'createDraftPR',
 *     description: 'Draft a Purchase Request from a list of items',
 *     inputSchema: z.object({ projectId: z.string(), items: z.array(...) }),
 *     requireHumanApproval: true,
 *     risk: 'MEDIUM',
 *     async execute(input, ctx) {
 *       // ...calls @vapour/firebase-scoped service code...
 *       return { prId };
 *     },
 *   });
 *
 *   // Later, in the orchestrator host:
 *   const result = await executeTool(createDraftPR, input, ctx, runtime);
 *
 * The function is just a typed pass-through that adds inference; the
 * runtime in executeTool.ts is where the cross-cutting concerns
 * (Zod validation, audit, HITL, error mapping) live.
 */

import type { ZodTypeAny } from 'zod';
import type { ToolDefinition } from './types';

export function defineTool<TIn extends ZodTypeAny, TOut>(
  def: ToolDefinition<TIn, TOut>
): ToolDefinition<TIn, TOut> {
  // Cheap compile-time guards become runtime invariants for free —
  // the host catches misconfiguration as soon as the registry loads
  // rather than when the agent first calls the tool.
  if (!def.name || def.name.length === 0) {
    throw new Error('defineTool: name is required');
  }
  if (def.requireHumanApproval && !def.risk) {
    throw new Error(
      `defineTool[${def.name}]: risk must be supplied when requireHumanApproval is set`
    );
  }
  return def;
}
