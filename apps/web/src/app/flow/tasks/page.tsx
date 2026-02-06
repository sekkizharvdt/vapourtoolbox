'use client';

/**
 * Task List Page
 *
 * Displays the user's tasks with filter tabs (All | Todo | In Progress | Done).
 * Supports quick-add via the "New Task" button or the ?new=true query param.
 */

import { useState, useEffect, useCallback, Suspense } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import {
  Box,
  Typography,
  Tabs,
  Tab,
  Button,
  CircularProgress,
  Alert,
  Breadcrumbs,
  Link,
  Chip,
} from '@mui/material';
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

type TabValue = 'all' | 'todo' | 'in_progress' | 'done';

function TaskListInner() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const db = useFirestore();
  const { user, claims } = useAuth();
  const { toast } = useToast();

  const [tasks, setTasks] = useState<ManualTask[]>([]);
  const [loading, setLoading] = useState(true);
  const [tab, setTab] = useState<TabValue>('all');
  const [createOpen, setCreateOpen] = useState(false);

  const entityId = claims?.entityId || 'default-entity';

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

    const unsubscribe = subscribeToMyTasks(
      db,
      entityId,
      user.uid,
      (updatedTasks) => {
        setTasks(updatedTasks);
        setLoading(false);
      },
      () => {
        setLoading(false);
      }
    );

    return () => unsubscribe();
  }, [db, user, entityId]);

  // Filter tasks by tab
  const filteredTasks = tasks.filter((t) => {
    if (tab === 'all') return t.status !== 'cancelled';
    return t.status === tab;
  });

  // Counts for tab badges
  const todoCount = tasks.filter((t) => t.status === 'todo').length;
  const inProgressCount = tasks.filter((t) => t.status === 'in_progress').length;
  const doneCount = tasks.filter((t) => t.status === 'done').length;

  const handleStatusChange = useCallback(
    async (taskId: string, status: ManualTaskStatus) => {
      if (!db) return;
      try {
        await updateTaskStatus(db, taskId, status);
        if (status === 'done') toast.success('Task completed');
      } catch {
        toast.error('Failed to update task');
      }
    },
    [db, toast]
  );

  const handleDelete = useCallback(
    async (taskId: string) => {
      if (!db) return;
      try {
        await deleteManualTask(db, taskId);
        toast.success('Task deleted');
      } catch {
        toast.error('Failed to delete task');
      }
    },
    [db, toast]
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
      <Breadcrumbs sx={{ mb: 2 }}>
        <Link
          color="inherit"
          href="/flow"
          onClick={(e: React.MouseEvent) => {
            e.preventDefault();
            router.push('/flow');
          }}
          sx={{ display: 'flex', alignItems: 'center', cursor: 'pointer' }}
        >
          <HomeIcon sx={{ mr: 0.5 }} fontSize="small" />
          Flow
        </Link>
        <Typography color="text.primary">My Tasks</Typography>
      </Breadcrumbs>

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
              Todo
              {todoCount > 0 && (
                <Chip label={todoCount} size="small" color="default" sx={{ height: 20 }} />
              )}
            </Box>
          }
          value="todo"
        />
        <Tab
          label={
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
              In Progress
              {inProgressCount > 0 && (
                <Chip label={inProgressCount} size="small" color="primary" sx={{ height: 20 }} />
              )}
            </Box>
          }
          value="in_progress"
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

      {filteredTasks.length === 0 ? (
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
            <Typography variant="body2">
              No {tab === 'todo' ? 'pending' : 'in progress'} tasks.
            </Typography>
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
