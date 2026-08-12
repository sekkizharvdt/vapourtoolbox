'use client';

/**
 * Task List Page
 *
 * Displays the user's tasks with filter tabs (All | Todo | In Progress | Done).
 * Supports quick-add via the "New Task" button or the ?new=true query param.
 */

import { useState, useEffect, useCallback, Suspense } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { Box, Typography, Tabs, Tab, Button, CircularProgress, Alert, Chip } from '@mui/material';
import { PageBreadcrumbs } from '@/components/common/PageBreadcrumbs';
import { Add as AddIcon, Home as HomeIcon, CheckCircle as DoneIcon } from '@mui/icons-material';
import { useFirestore } from '@/lib/firebase/hooks';
import { useAuth } from '@/contexts/AuthContext';
import { useToast } from '@/components/common/Toast';
import {
  subscribeToMyTasks,
  updateTaskStatus,
  deleteManualTask,
} from '@/lib/tasks/manualTaskService';
import { ManualTaskCard } from './components/ManualTaskCard';
import { CreateTaskDialog } from './components/CreateTaskDialog';
import type { ManualTask, ManualTaskStatus } from '@vapour/types';

/**
 * A task is open or done — `in_progress` is not reachable from the UI, so the
 * Open tab covers any task left in that state before the change.
 */
type TabValue = 'all' | 'open' | 'done';

function TaskListInner() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const db = useFirestore();
  const { user, claims } = useAuth();
  const { toast } = useToast();

  const [tasks, setTasks] = useState<ManualTask[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [tab, setTab] = useState<TabValue>('all');
  const [createOpen, setCreateOpen] = useState(false);

  const tenantId = claims?.tenantId || 'default-entity';

  // Open dialog if ?new=true
  useEffect(() => {
    if (searchParams.get('new') === 'true') {
      setCreateOpen(true);
      // Remove query param without navigation
      router.replace('/flow/tasks', { scroll: false });
    }
  }, [searchParams, router]);

  // Subscribe to tasks
  useEffect(() => {
    if (!db || !user) return;

    setLoading(true);
    setLoadError(null);

    const unsubscribe = subscribeToMyTasks(
      db,
      tenantId,
      user.uid,
      (updatedTasks) => {
        setTasks(updatedTasks);
        setLoadError(null);
        setLoading(false);
      },
      (error) => {
        // A failed listener used to leave an empty list that looked like
        // "no tasks yet" — while the local cache could still make the same
        // page look populated after another page had loaded the same docs.
        setLoadError(error instanceof Error ? error.message : String(error));
        setLoading(false);
      }
    );

    return () => unsubscribe();
  }, [db, user, tenantId]);

  const isOpen = (t: ManualTask) => t.status === 'todo' || t.status === 'in_progress';

  // Filter tasks by tab
  const filteredTasks = tasks.filter((t) => {
    if (tab === 'all') return t.status !== 'cancelled';
    if (tab === 'open') return isOpen(t);
    return t.status === 'done';
  });

  // Counts for tab badges
  const openCount = tasks.filter(isOpen).length;
  const doneCount = tasks.filter((t) => t.status === 'done').length;

  const handleStatusChange = useCallback(
    async (taskId: string, status: ManualTaskStatus) => {
      if (!db) return;
      try {
        await updateTaskStatus(db, taskId, status);
        if (status === 'done') toast.success('Task completed');
        else if (status === 'in_progress') toast.success('Task started');
      } catch (err) {
        toast.error(err instanceof Error ? err.message : String(err));
      }
    },
    [db, toast]
  );

  const handleDelete = useCallback(
    async (taskId: string) => {
      if (!db) return;
      try {
        await deleteManualTask(db, taskId, user?.uid);
        toast.success('Task deleted');
      } catch (err) {
        toast.error(
          err instanceof Error && err.message.includes('creator')
            ? err.message
            : 'Failed to delete task'
        );
      }
    },
    [db, toast, user]
  );

  if (loading) {
    return (
      <Box sx={{ display: 'flex', justifyContent: 'center', py: 8 }}>
        <CircularProgress />
      </Box>
    );
  }

  return (
    <Box>
      <PageBreadcrumbs
        items={[
          { label: 'Flow', href: '/flow', icon: <HomeIcon fontSize="small" /> },
          { label: 'My Tasks' },
        ]}
      />

      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 2 }}>
        <Typography variant="h4" component="h1">
          My Tasks
        </Typography>
        <Button variant="contained" startIcon={<AddIcon />} onClick={() => setCreateOpen(true)}>
          New Task
        </Button>
      </Box>

      <Tabs
        value={tab}
        onChange={(_, v) => setTab(v)}
        sx={{ mb: 2, borderBottom: 1, borderColor: 'divider' }}
      >
        <Tab
          label={
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
              All
              <Chip
                label={tasks.filter((t) => t.status !== 'cancelled').length}
                size="small"
                sx={{ height: 20 }}
              />
            </Box>
          }
          value="all"
        />
        <Tab
          label={
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
              Open
              {openCount > 0 && (
                <Chip label={openCount} size="small" color="default" sx={{ height: 20 }} />
              )}
            </Box>
          }
          value="open"
        />
        <Tab
          label={
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
              Done
              {doneCount > 0 && (
                <Chip label={doneCount} size="small" color="success" sx={{ height: 20 }} />
              )}
            </Box>
          }
          value="done"
        />
      </Tabs>

      {loadError ? (
        <Alert severity="error" sx={{ mt: 2 }}>
          <Typography variant="body2">Could not load your tasks: {loadError}</Typography>
        </Alert>
      ) : filteredTasks.length === 0 ? (
        <Alert severity="info" sx={{ mt: 2 }}>
          {tab === 'all' ? (
            <>
              <Typography variant="body2" gutterBottom>
                No tasks yet. Click <strong>New Task</strong> to create one.
              </Typography>
            </>
          ) : tab === 'done' ? (
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
              <DoneIcon color="success" />
              <Typography variant="body2">No completed tasks yet.</Typography>
            </Box>
          ) : (
            <Typography variant="body2">No open tasks — everything is done.</Typography>
          )}
        </Alert>
      ) : (
        <Box>
          {filteredTasks.map((task) => (
            <ManualTaskCard
              key={task.id}
              task={task}
              onStatusChange={handleStatusChange}
              onDelete={handleDelete}
            />
          ))}
        </Box>
      )}

      <CreateTaskDialog
        open={createOpen}
        onClose={() => setCreateOpen(false)}
        onCreated={() => {
          // Tasks are auto-updated via subscription
        }}
      />
    </Box>
  );
}

export default function TaskListPage() {
  return (
    <Suspense
      fallback={
        <Box sx={{ display: 'flex', justifyContent: 'center', py: 8 }}>
          <CircularProgress />
        </Box>
      }
    >
      <TaskListInner />
    </Suspense>
  );
}
