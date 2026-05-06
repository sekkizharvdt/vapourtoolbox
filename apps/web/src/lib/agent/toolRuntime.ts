/**
 * Web-side ToolRuntime
 *
 * Phase 0 of AI-AGENT-ROADMAP-2026-04-25.md — Tool framework + HITL.
 *
 * Bridges the host-agnostic `@vapour/agent-tools` framework to the
 * web app's:
 *   - clientAuditService (audit log writes for tool start / end)
 *   - hitl library (mints agentTasks rows when a tool is gated)
 *
 * Usage from a web-side caller:
 *
 *   const runtime = createWebToolRuntime(db);
 *   const result = await executeTool(myTool, input, ctx, runtime);
 */

import type { Firestore } from 'firebase/firestore';
import type { ToolRuntime, ToolStartLog, ToolEndLog, HitlRequestParams } from '@vapour/agent-tools';
import { createAgentAuditContext, logAuditEvent } from '@/lib/audit/clientAuditService';
import { requestApproval } from './hitl';
import { AGENT_DISPLAY_NAME } from './identity';

/**
 * Build a ToolRuntime backed by the web Firebase SDK + clientAuditService.
 *
 * Tool-start and tool-end events are written as auditLogs rows with
 * `actorType: 'agent'` so the admin viewer + every per-run transcript
 * query already in place picks them up automatically. The HITL hook
 * delegates to `requestApproval` in lib/agent/hitl.ts.
 */
export function createWebToolRuntime(db: Firestore): ToolRuntime {
  return {
    logToolStart: async (params: ToolStartLog) => {
      const auditCtx = createAgentAuditContext(
        params.ctx.agentUserId,
        params.ctx.agentRunId,
        params.tool,
        params.ctx.tenantId
      );
      await logAuditEvent(
        db,
        auditCtx,
        'AGENT_TOOL_INVOKED',
        'AGENT_TOOL',
        params.tool,
        `Agent invoked tool ${params.tool}`,
        {
          metadata: {
            inputJson: params.inputJson,
            ...(params.metadata ?? {}),
          },
          severity: 'INFO',
        }
      );
    },

    logToolEnd: async (params: ToolEndLog) => {
      const auditCtx = createAgentAuditContext(
        params.ctx.agentUserId,
        params.ctx.agentRunId,
        params.tool,
        params.ctx.tenantId
      );
      await logAuditEvent(
        db,
        auditCtx,
        params.success ? 'AGENT_TOOL_COMPLETED' : 'AGENT_TOOL_FAILED',
        'AGENT_TOOL',
        params.tool,
        params.success
          ? `Tool ${params.tool} completed (${params.durationMs}ms)`
          : `Tool ${params.tool} failed: ${params.errorMessage ?? 'unknown error'}`,
        {
          metadata: {
            durationMs: params.durationMs,
            ...(params.outputSummary !== undefined && { outputSummary: params.outputSummary }),
            ...(params.errorMessage !== undefined && { errorMessage: params.errorMessage }),
          },
          severity: params.success ? 'INFO' : 'ERROR',
          success: params.success,
          ...(params.errorMessage !== undefined && { errorMessage: params.errorMessage }),
        }
      );
    },

    requestApproval: async (params: HitlRequestParams) => {
      // The runtime delegates straight to lib/agent/hitl. The agent
      // identity acts as `requestedBy` so firestore.rules' isAgent()
      // gate accepts the create.
      return requestApproval(db, {
        tenantId: params.ctx.tenantId,
        agentRunId: params.ctx.agentRunId,
        toolName: params.toolName,
        description: params.description,
        proposedAction: params.proposedAction,
        risk: params.risk,
        ...(params.approverPermission !== undefined && {
          requiredPermission: params.approverPermission,
        }),
        requestedBy: params.ctx.agentUserId,
        metadata: { agentName: AGENT_DISPLAY_NAME },
      });
    },
  };
}
