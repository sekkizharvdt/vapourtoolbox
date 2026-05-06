'use client';

/**
 * Agent Task List (HITL approval inbox)
 *
 * Phase 0 of AI-AGENT-ROADMAP-2026-04-25.md — HITL infrastructure.
 *
 * Shows pending agent approval requests with Approve / Reject buttons,
 * plus a tab for decided history. Subscribes to agentTasks via
 * onSnapshot so the inbox updates in real time as the agent mints new
 * requests or other approvers act on them.
 */

import { useState, useEffect, useMemo } from 'react';
import {
  Box,
  Typography,
  Chip,
  Stack,
  CircularProgress,
  Alert,
  Paper,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Button,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  TextField,
  Tabs,
  Tab,
} from '@mui/material';
import {
  CheckCircle as ApproveIcon,
  Cancel as RejectIcon,
  Warning as RiskHighIcon,
  Info as RiskLowIcon,
} from '@mui/icons-material';
import {
  collection,
  query,
  where,
  orderBy,
  limit,
  onSnapshot,
  type QueryConstraint,
} from 'firebase/firestore';
import { getFirebase } from '@/lib/firebase';
import { COLLECTIONS } from '@vapour/firebase';
import { useAuth } from '@/contexts/AuthContext';
import { formatDistanceToNow, format } from 'date-fns';
import type { AgentTask, AgentTaskStatus, AgentTaskRiskLevel } from '@vapour/types';
import { approveAgentTask, rejectAgentTask } from '@/lib/agent';
import { docToTyped } from '@/lib/firebase/typeHelpers';

const RISK_COLORS: Record<AgentTaskRiskLevel, 'success' | 'warning' | 'error'> = {
  LOW: 'success',
  MEDIUM: 'warning',
  HIGH: 'error',
};

const STATUS_COLORS: Record<AgentTaskStatus, 'default' | 'warning' | 'success' | 'error'> = {
  PENDING: 'warning',
  APPROVED: 'success',
  REJECTED: 'error',
  EXPIRED: 'default',
  CANCELLED: 'default',
};

type TabValue = 'pending' | 'history';

export function AgentTaskList() {
  const { user, claims } = useAuth();
  const [tasks, setTasks] = useState<AgentTask[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [tab, setTab] = useState<TabValue>('pending');

  // Reject dialog state
  const [rejectingTask, setRejectingTask] = useState<AgentTask | null>(null);
  const [rejectReason, setRejectReason] = useState('');
  const [actionInFlight, setActionInFlight] = useState(false);

  // Subscribe to the slice the active tab needs.
  useEffect(() => {
    const tenantId = claims?.tenantId || 'default-entity';
    const { db } = getFirebase();

    const constraints: QueryConstraint[] = [
      where('tenantId', '==', tenantId),
      where('status', tab === 'pending' ? '==' : '!=', 'PENDING'),
      orderBy('status'), // required when using `!=`
      orderBy('requestedAt', tab === 'pending' ? 'asc' : 'desc'),
      limit(200),
    ];
    const q = query(collection(db, COLLECTIONS.AGENT_TASKS), ...constraints);

    const unsub = onSnapshot(
      q,
      (snap) => {
        const rows = snap.docs.map((d) => docToTyped<AgentTask>(d.id, d.data()));
        setTasks(rows);
        setLoading(false);
      },
      (err) => {
        setError(err.message);
        setLoading(false);
      }
    );
    return () => unsub();
  }, [claims?.tenantId, tab]);

  const handleApprove = async (task: AgentTask) => {
    if (!user) return;
    setActionInFlight(true);
    setError(null);
    try {
      const { db } = getFirebase();
      await approveAgentTask(db, {
        taskId: task.id,
        decidedBy: user.uid,
        decidedByName: user.displayName || user.email || 'Unknown',
      });
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to approve');
    } finally {
      setActionInFlight(false);
    }
  };

  const openRejectDialog = (task: AgentTask) => {
    setRejectingTask(task);
    setRejectReason('');
  };

  const handleReject = async () => {
    if (!user || !rejectingTask) return;
    setActionInFlight(true);
    setError(null);
    try {
      const { db } = getFirebase();
      await rejectAgentTask(db, {
        taskId: rejectingTask.id,
        decidedBy: user.uid,
        decidedByName: user.displayName || user.email || 'Unknown',
        reason: rejectReason || undefined,
      });
      setRejectingTask(null);
      setRejectReason('');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to reject');
    } finally {
      setActionInFlight(false);
    }
  };

  const summary = useMemo(() => {
    const pending = tasks.filter((t) => t.status === 'PENDING').length;
    return { pending, total: tasks.length };
  }, [tasks]);

  return (
    <Box>
      <Tabs value={tab} onChange={(_, v) => setTab(v as TabValue)} sx={{ mb: 2 }}>
        <Tab label="Pending" value="pending" />
        <Tab label="History" value="history" />
      </Tabs>

      {error && (
        <Alert severity="error" sx={{ mb: 2 }}>
          {error}
        </Alert>
      )}

      {loading ? (
        <Box sx={{ display: 'flex', justifyContent: 'center', py: 6 }}>
          <CircularProgress />
        </Box>
      ) : tasks.length === 0 ? (
        <Paper sx={{ p: 6, textAlign: 'center' }}>
          <Typography color="text.secondary">
            {tab === 'pending'
              ? 'Inbox empty — the agent has no pending approval requests.'
              : 'No decided agent tasks yet.'}
          </Typography>
        </Paper>
      ) : (
        <Paper variant="outlined">
          {tab === 'pending' && (
            <Box sx={{ p: 1.5, borderBottom: 1, borderColor: 'divider' }}>
              <Typography variant="body2" color="text.secondary">
                {summary.pending} pending approval{summary.pending === 1 ? '' : 's'}
              </Typography>
            </Box>
          )}
          <TableContainer>
            <Table size="small">
              <TableHead>
                <TableRow>
                  <TableCell sx={{ width: 90 }}>Risk</TableCell>
                  <TableCell sx={{ width: 140 }}>Tool</TableCell>
                  <TableCell>Description</TableCell>
                  <TableCell sx={{ width: 140 }}>Run</TableCell>
                  <TableCell sx={{ width: 130 }}>Requested</TableCell>
                  <TableCell sx={{ width: 110 }}>Status</TableCell>
                  <TableCell sx={{ width: 200 }} align="right">
                    Actions
                  </TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {tasks.map((task) => (
                  <TableRow key={task.id} hover>
                    <TableCell>
                      <Chip
                        size="small"
                        color={RISK_COLORS[task.risk]}
                        icon={
                          task.risk === 'HIGH' ? (
                            <RiskHighIcon sx={{ fontSize: 14 }} />
                          ) : (
                            <RiskLowIcon sx={{ fontSize: 14 }} />
                          )
                        }
                        label={task.risk}
                      />
                    </TableCell>
                    <TableCell>
                      <Typography
                        variant="body2"
                        sx={{ fontFamily: 'monospace', fontSize: '0.78rem' }}
                      >
                        {task.toolName}
                      </Typography>
                    </TableCell>
                    <TableCell>
                      <Typography variant="body2">{task.description}</Typography>
                      {task.entityName && (
                        <Typography variant="caption" color="text.secondary">
                          {task.entityType}: {task.entityName}
                        </Typography>
                      )}
                    </TableCell>
                    <TableCell>
                      <Typography
                        variant="caption"
                        sx={{ fontFamily: 'monospace', fontSize: '0.7rem' }}
                      >
                        {task.agentRunId.slice(0, 12)}…
                      </Typography>
                    </TableCell>
                    <TableCell>
                      <Typography variant="caption">
                        {task.requestedAt
                          ? formatDistanceToNow(task.requestedAt.toDate(), { addSuffix: true })
                          : '—'}
                      </Typography>
                    </TableCell>
                    <TableCell>
                      <Chip size="small" color={STATUS_COLORS[task.status]} label={task.status} />
                      {task.status !== 'PENDING' && task.decidedByName && (
                        <Typography variant="caption" component="div" color="text.secondary">
                          by {task.decidedByName}
                          {task.decidedAt && (
                            <> · {format(task.decidedAt.toDate(), 'd MMM HH:mm')}</>
                          )}
                        </Typography>
                      )}
                    </TableCell>
                    <TableCell align="right">
                      {task.status === 'PENDING' ? (
                        <Stack direction="row" spacing={1} justifyContent="flex-end">
                          <Button
                            size="small"
                            variant="contained"
                            color="success"
                            startIcon={<ApproveIcon />}
                            onClick={() => handleApprove(task)}
                            disabled={actionInFlight}
                          >
                            Approve
                          </Button>
                          <Button
                            size="small"
                            variant="outlined"
                            color="error"
                            startIcon={<RejectIcon />}
                            onClick={() => openRejectDialog(task)}
                            disabled={actionInFlight}
                          >
                            Reject
                          </Button>
                        </Stack>
                      ) : (
                        <Typography variant="caption" color="text.secondary">
                          {task.decisionReason || '—'}
                        </Typography>
                      )}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </TableContainer>
        </Paper>
      )}

      {/* Reject dialog */}
      <Dialog open={!!rejectingTask} onClose={() => setRejectingTask(null)} maxWidth="sm" fullWidth>
        <DialogTitle>Reject agent action</DialogTitle>
        <DialogContent>
          <Typography variant="body2" sx={{ mb: 2 }}>
            {rejectingTask?.description}
          </Typography>
          <TextField
            label="Reason (optional but recommended)"
            multiline
            rows={3}
            fullWidth
            value={rejectReason}
            onChange={(e) => setRejectReason(e.target.value)}
            placeholder="Why is this action being rejected? The agent stores this on the task and may surface it in future runs."
          />
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setRejectingTask(null)} disabled={actionInFlight}>
            Cancel
          </Button>
          <Button
            onClick={handleReject}
            color="error"
            variant="contained"
            disabled={actionInFlight}
          >
            Reject
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
}
