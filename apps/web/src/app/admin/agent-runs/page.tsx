// rule28-exempt: observability surface — list + per-run detail; no new/ or edit because runs are written by the orchestrator and are immutable from the UI's perspective

'use client';

/**
 * Agent Runs (observability) Page
 *
 * Phase 0 of AI-AGENT-ROADMAP-2026-04-25.md — Observability dashboard.
 *
 * Lists every orchestrator invocation with status, cost, tool usage,
 * duration, and HITL counts. Click through to the per-run drill-down
 * to see the full audit trail + HITL tasks for a run.
 */

import { Box, Typography, Stack } from '@mui/material';
import { AgentRunList } from '@/components/admin/AgentRunList';

export default function AgentRunsPage() {
  return (
    <Box>
      <Stack direction="row" justifyContent="space-between" alignItems="center" sx={{ mb: 3 }}>
        <Box>
          <Typography variant="h4">Agent Runs</Typography>
          <Typography variant="body1" color="text.secondary">
            Every orchestrator invocation, with status / cost / tools / HITL counts. Click a row to
            see the full transcript reconstructed from the audit trail.
          </Typography>
        </Box>
      </Stack>

      <AgentRunList />
    </Box>
  );
}
