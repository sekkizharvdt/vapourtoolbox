'use client';

/**
 * Flow Layout
 *
 * Provides the Slack-like interface layout for the Flow module.
 * Uses AuthenticatedLayout with collapsed main sidebar + workspace sidebar
 * - Main app sidebar: Collapsed by default (64px icons)
 * - Workspace sidebar: 260px (projects + channels)
 * - Responsive: drawer on mobile, fixed on desktop
 */

import { Suspense, useState, useEffect, useCallback, useMemo } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { Box, Drawer, useTheme, useMediaQuery, CircularProgress } from '@mui/material';
import { useAuth } from '@/contexts/AuthContext';
import { AuthenticatedLayout } from '@/components/layout/AuthenticatedLayout';
import { WorkspaceSidebar } from './components/WorkspaceSidebar';
import { buildWorkspaces, subscribeToUserTasks } from '@/lib/tasks/channelService';
import { TasksLayoutContext, type TasksLayoutContextValue } from './context';
import type { TaskNotification, DefaultTaskChannelId } from '@vapour/types';

const WORKSPACE_SIDEBAR_WIDTH = 260;

// Loading fallback for Suspense
function TasksLayoutSkeleton() {
  return (
    <Box
      sx={{
        display: 'flex',
        justifyContent: 'center',
        alignItems: 'center',
        minHeight: '100vh',
      }}
    >
      <CircularProgress />
    </Box>
  );
}

// Inner layout component that uses useSearchParams
function TasksLayoutInner({ children }: { children: React.ReactNode }) {
  const { user } = useAuth();
  const router = useRouter();
  const searchParams = useSearchParams();
  const theme = useTheme();
  const isMobile = useMediaQuery(theme.breakpoints.down('md'));

  // Mobile workspace sidebar state
  const [mobileOpen, setMobileOpen] = useState(false);

  // Task data
  const [tasks, setTasks] = useState<TaskNotification[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  // Projects data (mock for now - will integrate with project service)
  const [projects, setProjects] = useState<
    Array<{ id: string; name: string; projectNumber?: string }>
  >([]);

  // Selection state (from URL params)
  const workspaceId = searchParams.get('workspace');
  const channelId = searchParams.get('channel') as DefaultTaskChannelId | null;
  const viewParam = searchParams.get('view');

  // Determine current view
  const selectedView = useMemo<'channel' | 'my-tasks' | 'mentions'>(() => {
    if (viewParam === 'mentions') return 'mentions';
    if (viewParam === 'my-tasks' || (!workspaceId && !channelId)) return 'my-tasks';
    return 'channel';
  }, [viewParam, workspaceId, channelId]);

  // Group tasks by workspace
  const tasksByWorkspace = useMemo(() => {
    const grouped: Record<string, TaskNotification[]> = {};

    tasks.forEach((task) => {
      const wsId = task.projectId || 'pre-sales';
      if (!grouped[wsId]) {
        grouped[wsId] = [];
      }
      grouped[wsId].push(task);
    });

    return grouped;
  }, [tasks]);

  // Build workspaces from projects
  const workspaces = useMemo(() => {
    return buildWorkspaces(projects, tasksByWorkspace);
  }, [projects, tasksByWorkspace]);

  // Get selected workspace name
  const selectedWorkspaceName = useMemo(() => {
    const ws = workspaces.find((w) => w.id === workspaceId);
    return ws?.name || '';
  }, [workspaces, workspaceId]);

  // Count tasks for My Tasks view
  const myTasksCount = useMemo(() => {
    return tasks.filter((t) => (t.status === 'pending' || t.status === 'in_progress') && !t.read)
      .length;
  }, [tasks]);

  // Load projects
  useEffect(() => {
    async function loadProjects() {
      if (!user) return;

      try {
        // Import project service dynamically to avoid circular deps
        const { getProjects } = await import('@/lib/projects/projectService');
        const projectList = await getProjects();
        setProjects(
          projectList.map((p) => ({
            id: p.id,
            name: p.name,
            projectNumber: p.code,
          }))
        );
      } catch (error) {
        console.error('[TasksLayout] Failed to load projects:', error);
        setProjects([]);
      }
    }

    loadProjects();
  }, [user]);

  // Subscribe to user tasks
  useEffect(() => {
    if (!user) return;

    setIsLoading(true);

    const unsubscribe = subscribeToUserTasks(user.uid, (updatedTasks) => {
      setTasks(updatedTasks);
      setIsLoading(false);
    });

    return () => unsubscribe();
  }, [user]);

  // Navigation handlers
  const handleSelectChannel = useCallback(
    (wsId: string, chId: DefaultTaskChannelId) => {
      router.push(`/flow?workspace=${wsId}&channel=${chId}`);
      if (isMobile) setMobileOpen(false);
    },
    [router, isMobile]
  );

  const handleSelectMyTasks = useCallback(() => {
    router.push('/flow?view=my-tasks');
    if (isMobile) setMobileOpen(false);
  }, [router, isMobile]);

  const handleSelectMentions = useCallback(() => {
    router.push('/flow?view=mentions');
    if (isMobile) setMobileOpen(false);
  }, [router, isMobile]);

  const refreshTasks = useCallback(() => {
    // Tasks are already subscribed, this is for manual refresh if needed
    setIsLoading(true);
    setTimeout(() => setIsLoading(false), 500);
  }, []);

  // Toggle mobile workspace sidebar
  const handleToggleSidebar = useCallback(() => {
    setMobileOpen((prev) => !prev);
  }, []);

  // Context value
  const contextValue: TasksLayoutContextValue = {
    workspaces,
    selectedWorkspaceId: workspaceId,
    selectedChannelId: channelId,
    selectedView,
    tasks,
    tasksByWorkspace,
    isLoading,
    selectedWorkspaceName,
    onSelectChannel: handleSelectChannel,
    onSelectMyTasks: handleSelectMyTasks,
    onSelectMentions: handleSelectMentions,
    onToggleSidebar: handleToggleSidebar,
    showSidebarToggle: isMobile,
    refreshTasks,
  };

  // Workspace sidebar content
  const workspaceSidebarContent = (
    <WorkspaceSidebar
      workspaces={workspaces}
      selectedWorkspaceId={workspaceId}
      selectedChannelId={channelId}
      selectedView={selectedView}
      tasksByWorkspace={tasksByWorkspace}
      onSelectChannel={handleSelectChannel}
      onSelectMyTasks={handleSelectMyTasks}
      onSelectMentions={handleSelectMentions}
      onClose={isMobile ? handleToggleSidebar : undefined}
      mentionsCount={0} // Placeholder for Phase C
      myTasksCount={myTasksCount}
    />
  );

  return (
    <AuthenticatedLayout defaultSidebarCollapsed noPadding>
      <TasksLayoutContext.Provider value={contextValue}>
        <Box sx={{ display: 'flex', height: 'calc(100vh - 64px)', overflow: 'hidden' }}>
          {/* Mobile Workspace Drawer */}
          {isMobile && (
            <Drawer
              variant="temporary"
              open={mobileOpen}
              onClose={handleToggleSidebar}
              ModalProps={{ keepMounted: true }}
              sx={{
                '& .MuiDrawer-paper': {
                  width: WORKSPACE_SIDEBAR_WIDTH,
                  boxSizing: 'border-box',
                },
              }}
            >
              {workspaceSidebarContent}
            </Drawer>
          )}

          {/* Desktop Workspace Sidebar */}
          {!isMobile && (
            <Box
              component="nav"
              sx={{
                width: WORKSPACE_SIDEBAR_WIDTH,
                flexShrink: 0,
                borderRight: 1,
                borderColor: 'divider',
                height: '100%',
                overflow: 'auto',
              }}
            >
              {workspaceSidebarContent}
            </Box>
          )}

          {/* Main Content */}
          <Box
            component="main"
            sx={{
              flexGrow: 1,
              display: 'flex',
              flexDirection: 'column',
              height: '100%',
              overflow: 'hidden',
              bgcolor: 'background.default',
            }}
          >
            {children}
          </Box>
        </Box>
      </TasksLayoutContext.Provider>
    </AuthenticatedLayout>
  );
}

// Main layout export wrapped in Suspense
export default function TasksLayout({ children }: { children: React.ReactNode }) {
  return (
    <Suspense fallback={<TasksLayoutSkeleton />}>
      <TasksLayoutInner>{children}</TasksLayoutInner>
    </Suspense>
  );
}
