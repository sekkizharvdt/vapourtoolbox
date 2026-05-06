'use client';

/**
 * Agent Inbox (HITL) Page
 *
 * Phase 0 of AI-AGENT-ROADMAP-2026-04-25.md — HITL infrastructure.
 *
 * Admin-side approval inbox: lists `agentTasks` rows, lets approvers
 * Approve / Reject pending requests, and shows the decision history
 * for completed ones. Permission check is handled by the parent admin
 * layout.
 */

import { Box, Typography, Stack } from '@mui/material';
import { AgentTaskList } from '@/components/admin/AgentTaskList';

export default function AgentTasksPage() {
  return (
    <Box>
      <Stack direction="row" justifyContent="space-between" alignItems="center" sx={{ mb: 3 }}>
        <Box>
          <Typography variant="h4">Agent Inbox</Typography>
          <Typography variant="body1" color="text.secondary">
            Review and decide on pending AI agent actions. Approving unblocks the agent run;
            rejecting cancels it.
          </Typography>
        </Box>
      </Stack>

      <AgentTaskList />
    </Box>
  );
}
