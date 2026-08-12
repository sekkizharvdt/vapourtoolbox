'use client';

/**
 * My Work — the Flow module's home
 *
 * One list of everything the user owes, merging actionable notifications with
 * manual tasks. Replaces the old hub page of navigation cards (the destinations
 * moved to the sub-nav in the layout) and supersedes /flow/inbox and
 * /flow/tasks, which now redirect here.
 *
 * Default grouping is triage — Needs you / Waiting on others / FYI — because
 * the question this page answers is "what do I do next", and notifications
 * carry no due date to sort by. Grouping by source is the alternate view.
 *
 * Plan: docs/reviews/2026-08-12-flow-my-work-plan.md (Phase 2)
 */

import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  Alert,
  Badge,
  Box,
  Button,
  Chip,
  Collapse,
  Stack,
  ToggleButton,
  ToggleButtonGroup,
  Typography,
} from '@mui/material';
import {
  Add as AddIcon,
  ExpandLess as CollapseIcon,
  ExpandMore as ExpandIcon,
} from '@mui/icons-material';
import { PageHeader, EmptyState, LoadingState } from '@vapour/ui';
import { useFirestore } from '@/lib/firebase/hooks';
import { useAuth } from '@/contexts/AuthContext';
import { useToast } from '@/components/common/Toast';
import { useConfirmDialog } from '@/components/common/ConfirmDialog';
import { subscribeToMyWork, type MyWorkSnapshot } from '@/lib/tasks/myWorkService';
import {
  groupBySource,
  groupByTriage,
  type TriageGroup,
  type WorkItem,
  type WorkItemSource,
} from '@/lib/tasks/workItems';
import {
  acknowledgeInformational,
  acknowledgeInformationalBatch,
  completeActionableTask,
} from '@/lib/tasks/taskNotificationService';
import { deleteManualTask, updateTaskStatus } from '@/lib/tasks/manualTaskService';
import { WorkItemRow } from './components/WorkItemRow';
import { CreateTaskDialog } from './components/CreateTaskDialog';

type GroupMode = 'triage' | 'source';

const TRIAGE_ORDER: TriageGroup[] = ['needs-you', 'waiting', 'fyi'];

const TRIAGE_LABELS: Record<TriageGroup, string> = {
  'needs-you': 'Needs you',
  waiting: 'Waiting on others',
  fyi: 'FYI',
};

const TRIAGE_HINTS: Record<TriageGroup, string> = {
  'needs-you': 'Nothing waiting on you.',
  waiting: 'Nothing outstanding with anyone else.',
  fyi: 'No updates to read.',
};

const SOURCE_LABELS: Record<WorkItemSource, string> = {
  meeting: 'Meetings',
  project: 'Projects',
  proposal: 'Proposals',
  procurement: 'Procurement',
  accounting: 'Accounting',
  hr: 'HR',
  documents: 'Documents',
  enquiries: 'Enquiries',
  feedback: 'Feedback',
  general: 'General',
};

export default function MyWorkPage() {
  const db = useFirestore();
  const { user, claims } = useAuth();
  const { toast } = useToast();
  const { confirm } = useConfirmDialog();

  const [snapshot, setSnapshot] = useState<MyWorkSnapshot>({
    items: [],
    loaded: false,
    error: null,
  });
  const [groupMode, setGroupMode] = useState<GroupMode>('triage');
  const [collapsed, setCollapsed] = useState<Record<string, boolean>>({ fyi: true });
  const [createOpen, setCreateOpen] = useState(false);

  const tenantId = claims?.tenantId || 'default-entity';

  // Restore the grouping choice from the URL on first paint, so a shared or
  // reloaded link opens the same way, and honour ?new=true from the dashboard
  // and command palette. Read from `window.location` rather than
  // `useSearchParams` so the page needs no Suspense boundary.
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);

    const mode = params.get('group');
    if (mode === 'source' || mode === 'triage') setGroupMode(mode);

    if (params.get('new') === 'true') {
      setCreateOpen(true);
      // Strip the flag so a reload does not reopen the dialog (rule 30b —
      // replaceState, not router.replace, which would scroll to the top).
      params.delete('new');
      const url = new URL(window.location.href);
      url.search = params.toString();
      window.history.replaceState(null, '', url.toString());
    }
  }, []);

  useEffect(() => {
    if (!db || !user) return;
    return subscribeToMyWork(db, tenantId, user.uid, setSnapshot);
  }, [db, user, tenantId]);

  const handleGroupModeChange = useCallback((mode: GroupMode | null) => {
    if (!mode) return;
    setGroupMode(mode);
    // rule 30b: replaceState, not router.replace — App Router navigation
    // re-focuses the page root and scrolls to the top on every call.
    const url = new URL(window.location.href);
    url.searchParams.set('group', mode);
    window.history.replaceState(null, '', url.toString());
  }, []);

  const triageGroups = useMemo(() => groupByTriage(snapshot.items), [snapshot.items]);
  const sourceGroups = useMemo(() => groupBySource(snapshot.items), [snapshot.items]);

  const dismissableFyi = useMemo(
    () => triageGroups.fyi.filter((item) => item.actions.canDismiss),
    [triageGroups.fyi]
  );

  // --- Actions -------------------------------------------------------------
  // Each mutation is optimistic against the live subscription: the listener
  // re-emits within milliseconds, so the only thing to handle is failure.

  const handleComplete = useCallback(
    async (item: WorkItem) => {
      try {
        if (item.kind === 'task') {
          if (!db) return;
          await updateTaskStatus(db, item.id, 'done');
        } else {
          if (!user) return;
          await completeActionableTask(item.id, user.uid, false);
        }
        toast.success('Marked as done');
      } catch (err) {
        toast.error(err instanceof Error ? err.message : 'Could not complete this');
      }
    },
    [db, user, toast]
  );

  const handleDismiss = useCallback(
    async (item: WorkItem) => {
      try {
        await acknowledgeInformational(item.id);
      } catch (err) {
        toast.error(err instanceof Error ? err.message : 'Could not dismiss this');
      }
    },
    [toast]
  );

  const handleDismissAll = useCallback(async () => {
    if (dismissableFyi.length === 0) return;

    const confirmed = await confirm({
      title: 'Dismiss updates',
      message: `Dismiss ${dismissableFyi.length} update${
        dismissableFyi.length !== 1 ? 's' : ''
      }? They are archived, not deleted, and anything needing action from you is left alone.`,
      confirmText: 'Dismiss all',
    });
    if (!confirmed) return;

    try {
      const notifications = dismissableFyi
        .filter((item) => item.kind === 'notification')
        .map((item) => (item.kind === 'notification' ? item.notification : null))
        .filter((n): n is NonNullable<typeof n> => n !== null);

      const count = await acknowledgeInformationalBatch(notifications);
      toast.success(`Dismissed ${count} update${count !== 1 ? 's' : ''}`);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Could not dismiss these');
    }
  }, [dismissableFyi, confirm, toast]);

  const handleDelete = useCallback(
    async (item: WorkItem) => {
      if (!db || item.kind !== 'task') return;

      const confirmed = await confirm({
        title: 'Delete task',
        message: `Delete "${item.title}"? This cannot be undone.`,
        confirmText: 'Delete',
        confirmColor: 'error',
      });
      if (!confirmed) return;

      try {
        await deleteManualTask(db, item.id, user?.uid);
        toast.success('Task deleted');
      } catch (err) {
        toast.error(err instanceof Error ? err.message : 'Could not delete this task');
      }
    },
    [db, user, confirm, toast]
  );

  const toggleGroup = useCallback((key: string) => {
    setCollapsed((prev) => ({ ...prev, [key]: !prev[key] }));
  }, []);

  const renderGroup = (
    key: string,
    label: string,
    items: WorkItem[],
    emptyHint: string | null,
    action?: React.ReactNode
  ) => {
    const isCollapsed = collapsed[key] ?? false;

    return (
      <Box key={key} sx={{ mb: 2 }}>
        <Stack
          direction="row"
          alignItems="center"
          spacing={1}
          sx={{ py: 1, cursor: 'pointer' }}
          onClick={() => toggleGroup(key)}
        >
          {isCollapsed ? <ExpandIcon fontSize="small" /> : <CollapseIcon fontSize="small" />}
          <Typography variant="subtitle2">{label}</Typography>
          <Badge
            badgeContent={items.length}
            color={key === 'needs-you' && items.length > 0 ? 'primary' : 'default'}
            showZero
            sx={{ '& .MuiBadge-badge': { position: 'static', transform: 'none' } }}
          />
          <Box sx={{ flexGrow: 1 }} />
          <Box onClick={(e) => e.stopPropagation()}>{action}</Box>
        </Stack>

        <Collapse in={!isCollapsed}>
          {items.length === 0 ? (
            emptyHint && (
              <Typography variant="body2" color="text.secondary" sx={{ px: 1.5, py: 1 }}>
                {emptyHint}
              </Typography>
            )
          ) : (
            <Box sx={{ border: 1, borderColor: 'divider', borderRadius: 1, overflow: 'hidden' }}>
              {items.map((item) => (
                <WorkItemRow
                  key={item.id}
                  item={item}
                  onComplete={handleComplete}
                  onDismiss={handleDismiss}
                  onDelete={handleDelete}
                />
              ))}
            </Box>
          )}
        </Collapse>
      </Box>
    );
  };

  if (!snapshot.loaded && snapshot.items.length === 0) {
    return <LoadingState message="Loading your work…" />;
  }

  const needsYouCount = triageGroups['needs-you'].length;

  return (
    <Box>
      <PageHeader
        title="My Work"
        subtitle={
          needsYouCount > 0
            ? `${needsYouCount} thing${needsYouCount !== 1 ? 's' : ''} need${
                needsYouCount === 1 ? 's' : ''
              } you`
            : 'Nothing waiting on you'
        }
        action={
          <Button variant="contained" startIcon={<AddIcon />} onClick={() => setCreateOpen(true)}>
            New Task
          </Button>
        }
      />

      {snapshot.error && (
        <Alert severity="error" sx={{ mb: 2 }}>
          Some of your work could not be loaded: {snapshot.error}
        </Alert>
      )}

      <Stack direction="row" alignItems="center" sx={{ mb: 1 }}>
        <ToggleButtonGroup
          size="small"
          exclusive
          value={groupMode}
          onChange={(_, mode: GroupMode | null) => handleGroupModeChange(mode)}
        >
          <ToggleButton value="triage">Triage</ToggleButton>
          <ToggleButton value="source">By source</ToggleButton>
        </ToggleButtonGroup>
      </Stack>

      {snapshot.items.length === 0 ? (
        <EmptyState
          message="Nothing on your plate. New work appears here as it is assigned or created."
          action={
            <Button variant="contained" startIcon={<AddIcon />} onClick={() => setCreateOpen(true)}>
              New Task
            </Button>
          }
        />
      ) : groupMode === 'triage' ? (
        TRIAGE_ORDER.map((group) =>
          renderGroup(
            group,
            TRIAGE_LABELS[group],
            triageGroups[group],
            TRIAGE_HINTS[group],
            group === 'fyi' && dismissableFyi.length > 0 ? (
              <Button size="small" onClick={handleDismissAll}>
                Dismiss all ({dismissableFyi.length})
              </Button>
            ) : null
          )
        )
      ) : (
        sourceGroups.map(({ source, items }) =>
          renderGroup(source, SOURCE_LABELS[source], items, null)
        )
      )}

      {snapshot.loaded && snapshot.items.length > 0 && (
        <Chip
          label={`${snapshot.items.length} item${snapshot.items.length !== 1 ? 's' : ''}`}
          size="small"
          variant="outlined"
          sx={{ mt: 1 }}
        />
      )}

      <CreateTaskDialog
        open={createOpen}
        onClose={() => setCreateOpen(false)}
        onCreated={() => {
          // The subscription picks it up; nothing to refetch.
        }}
      />
    </Box>
  );
}
