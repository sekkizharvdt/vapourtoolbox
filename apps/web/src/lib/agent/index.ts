/**
 * AI Agent Foundation — barrel export.
 *
 * Phase 0 of AI-AGENT-ROADMAP-2026-04-25.md.
 *
 * Currently exposes the persistence layer (agent runs + memory). The
 * tool framework, HITL helpers, and orchestrator land in subsequent
 * Phase 0 workstreams; their entry points will join this barrel.
 */

export {
  createAgentRun,
  getAgentRunById,
  updateAgentRun,
  listAgentRuns,
  listSessionRuns,
  type ListAgentRunsOptions,
} from './agentRunService';

export {
  upsertAgentMemory,
  verifyAgentMemory,
  deactivateAgentMemory,
  listAgentMemory,
  type ListAgentMemoryOptions,
} from './agentMemoryService';
