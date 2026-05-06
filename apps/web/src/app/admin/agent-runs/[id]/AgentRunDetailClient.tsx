'use client';

/**
 * Agent Run Detail Client
 *
 * Phase 0 of AI-AGENT-ROADMAP-2026-04-25.md — Observability dashboard.
 *
 * Joins three data sources keyed by agentRunId:
 *   - the run row itself (cost / status / tool counters);
 *   - every audit-log row for the run (the full transcript — tool
 *     starts, completions, HITL events, side-effect writes);
 *   - the HITL tasks the run minted (pending or decided).
 *
 * Read via usePathname() per CLAUDE.md rule #30 — useParams() returns
 * 'placeholder' under static export.
 */

import { useState, useEffect } from 'react';
import { usePathname } from 'next/navigation';
import {
  Box,
  Typography,
  Chip,
  Stack,
  CircularProgress,
  Alert,
  Paper,
  Grid,
  Card,
  CardContent,
  Divider,
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableRow,
  TableContainer,
} from '@mui/material';
import {
  collection,
  doc,
  query,
  where,
  orderBy,
  onSnapshot,
  type QueryConstraint,
} from 'firebase/firestore';
import { getFirebase } from '@/lib/firebase';
import { COLLECTIONS } from '@vapour/firebase';
import { docToTyped } from '@/lib/firebase/typeHelpers';
import { format } from 'date-fns';
import type { AgentRun, AgentRunStatus, AgentTask, AgentTaskStatus, AuditLog } from '@vapour/types';

const STATUS_COLORS: Record<AgentRunStatus, 'default' | 'info' | 'warning' | 'success' | 'error'> =
  {
    PENDING: 'default',
    RUNNING: 'info',
    AWAITING_HITL: 'warning',
    COMPLETED: 'success',
    FAILED: 'error',
    CANCELLED: 'default',
  };

const TASK_STATUS_COLORS: Record<AgentTaskStatus, 'default' | 'warning' | 'success' | 'error'> = {
  PENDING: 'warning',
  APPROVED: 'success',
  REJECTED: 'error',
  EXPIRED: 'default',
  CANCELLED: 'default',
};

function formatDurationMs(ms: number | undefined): string {
  if (ms == null) return '—';
  if (ms < 1000) return `${ms}ms`;
  if (ms < 60_000) return `${(ms / 1000).toFixed(2)}s`;
  const min = Math.floor(ms / 60_000);
  const sec = Math.floor((ms % 60_000) / 1000);
  return `${min}m ${sec}s`;
}

function formatCostUsd(usd: number | undefined): string {
  if (usd == null) return '—';
  if (usd < 0.01) return `$${usd.toFixed(4)}`;
  return `$${usd.toFixed(2)}`;
}

export default function AgentRunDetailClient() {
  const pathname = usePathname();
  const [runId, setRunId] = useState<string | null>(null);

  useEffect(() => {
    if (!pathname) return;
    const match = pathname.match(/\/agent-runs\/([^/]+)(?:\/|$)/);
    const extracted = match?.[1];
    if (extracted && extracted !== 'placeholder') setRunId(extracted);
  }, [pathname]);

  const [run, setRun] = useState<AgentRun | null>(null);
  const [auditLogs, setAuditLogs] = useState<AuditLog[]>([]);
  const [tasks, setTasks] = useState<AgentTask[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Subscribe to the run document.
  useEffect(() => {
    if (!runId) return;
    const { db } = getFirebase();
    const unsub = onSnapshot(
      doc(db, COLLECTIONS.AGENT_RUNS, runId),
      (snap) => {
        if (!snap.exists()) {
          setError('Run not found');
          setLoading(false);
          return;
        }
        setRun(docToTyped<AgentRun>(snap.id, snap.data()));
        setLoading(false);
      },
      (err) => {
        setError(err.message);
        setLoading(false);
      }
    );
    return () => unsub();
  }, [runId]);

  // Subscribe to the audit transcript for this run.
  useEffect(() => {
    if (!runId) return;
    const { db } = getFirebase();
    const constraints: QueryConstraint[] = [
      where('agentRunId', '==', runId),
      orderBy('timestamp', 'asc'),
    ];
    const unsub = onSnapshot(
      query(collection(db, COLLECTIONS.AUDIT_LOGS), ...constraints),
      (snap) => {
        setAuditLogs(snap.docs.map((d) => docToTyped<AuditLog>(d.id, d.data())));
      }
    );
    return () => unsub();
  }, [runId]);

  // Subscribe to HITL tasks for this run.
  useEffect(() => {
    if (!runId) return;
    const { db } = getFirebase();
    const constraints: QueryConstraint[] = [
      where('agentRunId', '==', runId),
      orderBy('requestedAt', 'asc'),
    ];
    const unsub = onSnapshot(
      query(collection(db, COLLECTIONS.AGENT_TASKS), ...constraints),
      (snap) => {
        setTasks(snap.docs.map((d) => docToTyped<AgentTask>(d.id, d.data())));
      }
    );
    return () => unsub();
  }, [runId]);

  if (!runId || loading) {
    return (
      <Box sx={{ display: 'flex', justifyContent: 'center', py: 6 }}>
        <CircularProgress />
      </Box>
    );
  }

  if (error || !run) {
    return <Alert severity="error">{error || 'Run not found'}</Alert>;
  }

  return (
    <Box>
      {/* Breadcrumbs are rendered by admin/layout.tsx — see UI-STANDARDS rule 5.4. */}

      {/* Header */}
      <Stack
        direction={{ xs: 'column', md: 'row' }}
        justifyContent="space-between"
        alignItems={{ xs: 'flex-start', md: 'center' }}
        sx={{ mb: 3 }}
      >
        <Box>
          <Typography variant="h4" gutterBottom>
            Agent Run
          </Typography>
          <Typography variant="body2" color="text.secondary" sx={{ fontFamily: 'monospace' }}>
            {run.id}
          </Typography>
        </Box>
        <Chip
          color={STATUS_COLORS[run.status]}
          label={run.status.replace('_', ' ')}
          sx={{ fontSize: '0.95rem', px: 1, height: 32 }}
        />
      </Stack>

      {/* Headline metrics */}
      <Grid container spacing={2} sx={{ mb: 3 }}>
        <Grid size={{ xs: 6, md: 3 }}>
          <SummaryStat label="Trigger" value={run.triggerType} sub={run.triggerSource} />
        </Grid>
        <Grid size={{ xs: 6, md: 3 }}>
          <SummaryStat
            label="Duration"
            value={formatDurationMs(run.totalDurationMs)}
            sub={
              run.startedAt
                ? `Started ${format(run.startedAt.toDate(), 'd MMM HH:mm:ss')}`
                : undefined
            }
          />
        </Grid>
        <Grid size={{ xs: 6, md: 3 }}>
          <SummaryStat
            label="Cost"
            value={formatCostUsd(run.costUsd)}
            sub={`${run.inputTokens ?? 0} in · ${run.outputTokens ?? 0} out`}
          />
        </Grid>
        <Grid size={{ xs: 6, md: 3 }}>
          <SummaryStat
            label="Tools / HITL"
            value={`${run.toolCallCount ?? 0} / ${run.hitlRequestCount ?? 0}`}
            sub={
              run.hitlPendingCount
                ? `${run.hitlPendingCount} pending approval`
                : 'No pending approvals'
            }
          />
        </Grid>
      </Grid>

      {/* Run summary / error */}
      {run.summary && (
        <Paper variant="outlined" sx={{ p: 2, mb: 3 }}>
          <Typography variant="subtitle2" color="text.secondary" gutterBottom>
            Summary
          </Typography>
          <Typography variant="body2">{run.summary}</Typography>
        </Paper>
      )}
      {run.errorMessage && (
        <Alert severity="error" sx={{ mb: 3 }}>
          <Typography variant="subtitle2" gutterBottom>
            Run failed
          </Typography>
          <Typography variant="body2" sx={{ fontFamily: 'monospace', fontSize: '0.8rem' }}>
            {run.errorMessage}
          </Typography>
        </Alert>
      )}

      {/* HITL tasks */}
      {tasks.length > 0 && (
        <Card variant="outlined" sx={{ mb: 3 }}>
          <CardContent>
            <Typography variant="h6" gutterBottom>
              Human approvals ({tasks.length})
            </Typography>
            <TableContainer>
              <Table size="small">
                <TableHead>
                  <TableRow>
                    <TableCell sx={{ width: 110 }}>Status</TableCell>
                    <TableCell sx={{ width: 80 }}>Risk</TableCell>
                    <TableCell sx={{ width: 140 }}>Tool</TableCell>
                    <TableCell>Description</TableCell>
                    <TableCell sx={{ width: 160 }}>Decided</TableCell>
                  </TableRow>
                </TableHead>
                <TableBody>
                  {tasks.map((t) => (
                    <TableRow key={t.id}>
                      <TableCell>
                        <Chip size="small" color={TASK_STATUS_COLORS[t.status]} label={t.status} />
                      </TableCell>
                      <TableCell>
                        <Chip
                          size="small"
                          variant="outlined"
                          color={
                            t.risk === 'HIGH'
                              ? 'error'
                              : t.risk === 'MEDIUM'
                                ? 'warning'
                                : 'success'
                          }
                          label={t.risk}
                        />
                      </TableCell>
                      <TableCell sx={{ fontFamily: 'monospace', fontSize: '0.78rem' }}>
                        {t.toolName}
                      </TableCell>
                      <TableCell>
                        <Typography variant="body2">{t.description}</Typography>
                        {t.decisionReason && (
                          <Typography variant="caption" color="text.secondary">
                            Reason: {t.decisionReason}
                          </Typography>
                        )}
                      </TableCell>
                      <TableCell>
                        {t.decidedByName ? (
                          <Stack>
                            <Typography variant="caption">{t.decidedByName}</Typography>
                            {t.decidedAt && (
                              <Typography variant="caption" color="text.secondary">
                                {format(t.decidedAt.toDate(), 'd MMM HH:mm')}
                              </Typography>
                            )}
                          </Stack>
                        ) : (
                          <Typography variant="caption" color="text.secondary">
                            —
                          </Typography>
                        )}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </TableContainer>
          </CardContent>
        </Card>
      )}

      {/* Audit transcript */}
      <Card variant="outlined">
        <CardContent>
          <Typography variant="h6" gutterBottom>
            Transcript ({auditLogs.length} events)
          </Typography>
          <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mb: 2 }}>
            Every audit log row for this run, in the order they fired. Side-effect writes the agent
            triggered (PR creates, status flips, etc.) appear inline alongside the tool invocations.
          </Typography>
          <Divider sx={{ mb: 2 }} />
          {auditLogs.length === 0 ? (
            <Typography variant="body2" color="text.secondary">
              No audit events recorded for this run yet.
            </Typography>
          ) : (
            <Stack spacing={1.5}>
              {auditLogs.map((log) => (
                <Box
                  key={log.id}
                  sx={{
                    pl: 2,
                    py: 1,
                    borderLeft: 3,
                    borderColor: log.success === false ? 'error.main' : 'divider',
                  }}
                >
                  <Stack direction="row" spacing={1} alignItems="center">
                    <Typography
                      variant="caption"
                      color="text.secondary"
                      sx={{ fontFamily: 'monospace', minWidth: 90 }}
                    >
                      {log.timestamp ? format(log.timestamp.toDate(), 'HH:mm:ss.SSS') : '—'}
                    </Typography>
                    <Chip
                      size="small"
                      variant="outlined"
                      sx={{ fontSize: '0.65rem', height: 18 }}
                      label={log.action}
                    />
                    {log.agentToolName && (
                      <Chip
                        size="small"
                        color="secondary"
                        sx={{ fontSize: '0.65rem', height: 18 }}
                        label={log.agentToolName}
                      />
                    )}
                  </Stack>
                  <Typography variant="body2" sx={{ mt: 0.5 }}>
                    {log.description}
                  </Typography>
                  {log.entityName && (
                    <Typography variant="caption" color="text.secondary">
                      {log.entityType}: {log.entityName}
                    </Typography>
                  )}
                  {log.errorMessage && (
                    <Typography
                      variant="caption"
                      color="error"
                      component="div"
                      sx={{ fontFamily: 'monospace', mt: 0.5 }}
                    >
                      {log.errorMessage}
                    </Typography>
                  )}
                </Box>
              ))}
            </Stack>
          )}
        </CardContent>
      </Card>
    </Box>
  );
}

interface SummaryStatProps {
  label: string;
  value: string | number | undefined;
  sub?: string;
}

function SummaryStat({ label, value, sub }: SummaryStatProps) {
  return (
    <Card variant="outlined">
      <CardContent>
        <Typography variant="caption" color="text.secondary">
          {label}
        </Typography>
        <Typography variant="h6" sx={{ mt: 0.5 }}>
          {value ?? '—'}
        </Typography>
        {sub && (
          <Typography variant="caption" color="text.secondary" component="div" noWrap>
            {sub}
          </Typography>
        )}
      </CardContent>
    </Card>
  );
}
