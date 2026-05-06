'use client';

/**
 * Agent Run List + summary metrics.
 *
 * Phase 0 of AI-AGENT-ROADMAP-2026-04-25.md — Observability dashboard.
 *
 * Subscribes to agentRuns via onSnapshot. Shows a top-of-page metrics
 * card (today's totals + per-status counts) and a paginated table with
 * filters by status / trigger type. Click-through routes to the run
 * detail page for the full audit transcript.
 */

import { useState, useEffect, useMemo } from 'react';
import {
  Box,
  Card,
  CardContent,
  Chip,
  CircularProgress,
  Alert,
  Paper,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  TablePagination,
  Stack,
  Typography,
  FormControl,
  InputLabel,
  Select,
  MenuItem,
  Grid,
} from '@mui/material';
import {
  collection,
  query,
  where,
  orderBy,
  limit,
  onSnapshot,
  type QueryConstraint,
} from 'firebase/firestore';
import Link from 'next/link';
import { getFirebase } from '@/lib/firebase';
import { COLLECTIONS } from '@vapour/firebase';
import { useAuth } from '@/contexts/AuthContext';
import { docToTyped } from '@/lib/firebase/typeHelpers';
import { formatDistanceToNow } from 'date-fns';
import type { AgentRun, AgentRunStatus, AgentRunTriggerType } from '@vapour/types';

const STATUS_COLORS: Record<AgentRunStatus, 'default' | 'info' | 'warning' | 'success' | 'error'> =
  {
    PENDING: 'default',
    RUNNING: 'info',
    AWAITING_HITL: 'warning',
    COMPLETED: 'success',
    FAILED: 'error',
    CANCELLED: 'default',
  };

const TRIGGER_LABELS: Record<AgentRunTriggerType, string> = {
  human: 'Human',
  cron: 'Cron',
  gmail: 'Email',
  webhook: 'Webhook',
  agentTask: 'Queue',
  'sub-run': 'Sub-run',
};

function formatDurationMs(ms: number | undefined): string {
  if (ms == null) return '—';
  if (ms < 1000) return `${ms}ms`;
  if (ms < 60_000) return `${(ms / 1000).toFixed(1)}s`;
  const min = Math.floor(ms / 60_000);
  const sec = Math.floor((ms % 60_000) / 1000);
  return `${min}m ${sec}s`;
}

function formatCostUsd(usd: number | undefined): string {
  if (usd == null) return '—';
  if (usd < 0.01) return `$${usd.toFixed(4)}`;
  return `$${usd.toFixed(2)}`;
}

export function AgentRunList() {
  const { claims } = useAuth();
  const [runs, setRuns] = useState<AgentRun[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [statusFilter, setStatusFilter] = useState<AgentRunStatus | 'all'>('all');
  const [triggerFilter, setTriggerFilter] = useState<AgentRunTriggerType | 'all'>('all');

  const [page, setPage] = useState(0);
  const [rowsPerPage, setRowsPerPage] = useState(25);

  // Subscribe to the latest 500 runs for this tenant. Filtering /
  // pagination happens client-side because the row count fits comfortably
  // in memory and onSnapshot keeps the live counters honest.
  useEffect(() => {
    const tenantId = claims?.tenantId || 'default-entity';
    const { db } = getFirebase();

    const constraints: QueryConstraint[] = [
      where('tenantId', '==', tenantId),
      orderBy('startedAt', 'desc'),
      limit(500),
    ];
    const q = query(collection(db, COLLECTIONS.AGENT_RUNS), ...constraints);
    const unsub = onSnapshot(
      q,
      (snap) => {
        setRuns(snap.docs.map((d) => docToTyped<AgentRun>(d.id, d.data())));
        setLoading(false);
      },
      (err) => {
        setError(err.message);
        setLoading(false);
      }
    );
    return () => unsub();
  }, [claims?.tenantId]);

  const filteredRuns = useMemo(() => {
    return runs.filter((r) => {
      if (statusFilter !== 'all' && r.status !== statusFilter) return false;
      if (triggerFilter !== 'all' && r.triggerType !== triggerFilter) return false;
      return true;
    });
  }, [runs, statusFilter, triggerFilter]);

  const paginatedRuns = useMemo(
    () => filteredRuns.slice(page * rowsPerPage, page * rowsPerPage + rowsPerPage),
    [filteredRuns, page, rowsPerPage]
  );

  // Headline metrics — computed across the unfiltered window so the
  // numbers stay stable as the user toggles filters below.
  const metrics = useMemo(() => {
    const startOfToday = new Date();
    startOfToday.setHours(0, 0, 0, 0);
    const startMs = startOfToday.getTime();

    let todayCount = 0;
    let runningCount = 0;
    let awaitingHitlCount = 0;
    let completedToday = 0;
    let failedToday = 0;
    let costTodayUsd = 0;
    let toolCallsToday = 0;

    for (const r of runs) {
      if (r.status === 'RUNNING' || r.status === 'PENDING') runningCount++;
      if (r.status === 'AWAITING_HITL') awaitingHitlCount++;
      const startedMs = r.startedAt?.toMillis?.() ?? 0;
      if (startedMs >= startMs) {
        todayCount++;
        if (r.status === 'COMPLETED') completedToday++;
        if (r.status === 'FAILED') failedToday++;
        costTodayUsd += r.costUsd ?? 0;
        toolCallsToday += r.toolCallCount ?? 0;
      }
    }

    return {
      todayCount,
      runningCount,
      awaitingHitlCount,
      completedToday,
      failedToday,
      costTodayUsd,
      toolCallsToday,
    };
  }, [runs]);

  return (
    <Box>
      {/* Top metrics card */}
      <Grid container spacing={2} sx={{ mb: 3 }}>
        <Grid size={{ xs: 6, md: 3 }}>
          <MetricCard
            label="Runs today"
            value={metrics.todayCount}
            sub={`${metrics.completedToday} ok · ${metrics.failedToday} failed`}
          />
        </Grid>
        <Grid size={{ xs: 6, md: 3 }}>
          <MetricCard label="Running now" value={metrics.runningCount} sub="In flight" />
        </Grid>
        <Grid size={{ xs: 6, md: 3 }}>
          <MetricCard
            label="Awaiting HITL"
            value={metrics.awaitingHitlCount}
            sub="Parked on approval"
            highlight={metrics.awaitingHitlCount > 0}
          />
        </Grid>
        <Grid size={{ xs: 6, md: 3 }}>
          <MetricCard
            label="Cost today"
            value={formatCostUsd(metrics.costTodayUsd)}
            sub={`${metrics.toolCallsToday} tool calls`}
          />
        </Grid>
      </Grid>

      {error && (
        <Alert severity="error" sx={{ mb: 2 }}>
          {error}
        </Alert>
      )}

      {/* Filters */}
      <Stack direction="row" spacing={2} sx={{ mb: 2 }}>
        <FormControl size="small" sx={{ minWidth: 160 }}>
          <InputLabel>Status</InputLabel>
          <Select
            value={statusFilter}
            label="Status"
            onChange={(e) => {
              setStatusFilter(e.target.value as AgentRunStatus | 'all');
              setPage(0);
            }}
          >
            <MenuItem value="all">All Statuses</MenuItem>
            {(
              ['PENDING', 'RUNNING', 'AWAITING_HITL', 'COMPLETED', 'FAILED', 'CANCELLED'] as const
            ).map((s) => (
              <MenuItem key={s} value={s}>
                {s}
              </MenuItem>
            ))}
          </Select>
        </FormControl>

        <FormControl size="small" sx={{ minWidth: 160 }}>
          <InputLabel>Trigger</InputLabel>
          <Select
            value={triggerFilter}
            label="Trigger"
            onChange={(e) => {
              setTriggerFilter(e.target.value as AgentRunTriggerType | 'all');
              setPage(0);
            }}
          >
            <MenuItem value="all">All Triggers</MenuItem>
            {(['human', 'cron', 'gmail', 'webhook', 'agentTask', 'sub-run'] as const).map((t) => (
              <MenuItem key={t} value={t}>
                {TRIGGER_LABELS[t]}
              </MenuItem>
            ))}
          </Select>
        </FormControl>
      </Stack>

      {loading ? (
        <Box sx={{ display: 'flex', justifyContent: 'center', py: 6 }}>
          <CircularProgress />
        </Box>
      ) : filteredRuns.length === 0 ? (
        <Paper sx={{ p: 6, textAlign: 'center' }}>
          <Typography color="text.secondary">
            {runs.length === 0
              ? 'No agent runs yet. Once the orchestrator starts up, runs will appear here.'
              : 'No runs match the current filters.'}
          </Typography>
        </Paper>
      ) : (
        <Paper variant="outlined">
          <TableContainer>
            <Table size="small">
              <TableHead>
                <TableRow>
                  <TableCell sx={{ width: 110 }}>Status</TableCell>
                  <TableCell sx={{ width: 110 }}>Trigger</TableCell>
                  <TableCell>Run ID</TableCell>
                  <TableCell sx={{ width: 130 }}>Started</TableCell>
                  <TableCell sx={{ width: 90 }}>Duration</TableCell>
                  <TableCell sx={{ width: 80 }} align="right">
                    Tools
                  </TableCell>
                  <TableCell sx={{ width: 80 }} align="right">
                    HITL
                  </TableCell>
                  <TableCell sx={{ width: 90 }} align="right">
                    Cost
                  </TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {paginatedRuns.map((run) => (
                  <TableRow
                    key={run.id}
                    hover
                    component={Link}
                    href={`/admin/agent-runs/${run.id}`}
                    sx={{
                      cursor: 'pointer',
                      textDecoration: 'none',
                      color: 'inherit',
                    }}
                  >
                    <TableCell>
                      <Chip
                        size="small"
                        color={STATUS_COLORS[run.status]}
                        label={run.status.replace('_', ' ')}
                      />
                    </TableCell>
                    <TableCell>
                      <Typography variant="caption">{TRIGGER_LABELS[run.triggerType]}</Typography>
                      {run.triggerSource && (
                        <Typography
                          variant="caption"
                          component="div"
                          color="text.secondary"
                          noWrap
                          sx={{ maxWidth: 100, fontSize: '0.65rem' }}
                        >
                          {run.triggerSource}
                        </Typography>
                      )}
                    </TableCell>
                    <TableCell>
                      <Typography
                        variant="caption"
                        sx={{ fontFamily: 'monospace', fontSize: '0.7rem' }}
                      >
                        {run.id}
                      </Typography>
                      {run.summary && (
                        <Typography
                          variant="caption"
                          component="div"
                          color="text.secondary"
                          noWrap
                          sx={{ maxWidth: 320 }}
                        >
                          {run.summary}
                        </Typography>
                      )}
                    </TableCell>
                    <TableCell>
                      <Typography variant="caption">
                        {run.startedAt
                          ? formatDistanceToNow(run.startedAt.toDate(), { addSuffix: true })
                          : '—'}
                      </Typography>
                    </TableCell>
                    <TableCell>{formatDurationMs(run.totalDurationMs)}</TableCell>
                    <TableCell align="right">{run.toolCallCount ?? 0}</TableCell>
                    <TableCell align="right">
                      {run.hitlPendingCount ? (
                        <Chip
                          size="small"
                          color="warning"
                          label={`${run.hitlPendingCount}/${run.hitlRequestCount ?? 0}`}
                        />
                      ) : (
                        <Typography variant="caption" color="text.secondary">
                          {run.hitlRequestCount ?? 0}
                        </Typography>
                      )}
                    </TableCell>
                    <TableCell align="right">{formatCostUsd(run.costUsd)}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </TableContainer>
          <TablePagination
            component="div"
            count={filteredRuns.length}
            page={page}
            onPageChange={(_, n) => setPage(n)}
            rowsPerPage={rowsPerPage}
            onRowsPerPageChange={(e) => {
              setRowsPerPage(parseInt(e.target.value, 10));
              setPage(0);
            }}
            rowsPerPageOptions={[10, 25, 50, 100]}
          />
        </Paper>
      )}
    </Box>
  );
}

interface MetricCardProps {
  label: string;
  value: number | string;
  sub: string;
  highlight?: boolean;
}

function MetricCard({ label, value, sub, highlight }: MetricCardProps) {
  return (
    <Card variant="outlined" sx={{ borderColor: highlight ? 'warning.main' : undefined }}>
      <CardContent>
        <Typography variant="caption" color="text.secondary">
          {label}
        </Typography>
        <Typography variant="h4" sx={{ mt: 0.5, color: highlight ? 'warning.main' : undefined }}>
          {value}
        </Typography>
        <Typography variant="caption" color="text.secondary">
          {sub}
        </Typography>
      </CardContent>
    </Card>
  );
}
