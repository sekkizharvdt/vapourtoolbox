'use client';

/**
 * Projects Module - Hub Dashboard
 *
 * Card-based navigation to project sub-modules
 */

import { useMemo } from 'react';
import {
  List as ListIcon,
  PlayArrow as ActiveIcon,
  Edit as PlanningIcon,
  Folder as FolderIcon,
  PauseCircle as OnHoldIcon,
  CheckCircle as CompletedIcon,
} from '@mui/icons-material';
import { useAuth } from '@/contexts/AuthContext';
import { canViewProjects, canManageProjects } from '@vapour/constants';
import { collection, query, orderBy, limit as firestoreLimit } from 'firebase/firestore';
import { getFirebase } from '@/lib/firebase';
import { COLLECTIONS } from '@vapour/firebase';
import type { Project } from '@vapour/types';
import { useFirestoreQuery } from '@/hooks/useFirestoreQuery';
import { ModuleLandingPage, type ModuleItem } from '@/components/modules';

export default function ProjectsPage() {
  const { claims } = useAuth();

  // Firestore query for stats
  const { db } = getFirebase();
  const projectsQuery = useMemo(
    () =>
      query(
        collection(db, COLLECTIONS.PROJECTS),
        orderBy('createdAt', 'desc'),
        firestoreLimit(100)
      ),
    [db]
  );

  const { data: projects, loading } = useFirestoreQuery<Project>(projectsQuery);

  // Calculate stats
  const stats = {
    total: projects.length,
    active: projects.filter((p) => p.status === 'ACTIVE').length,
    planning: projects.filter((p) => p.status === 'PLANNING').length,
    onHold: projects.filter((p) => p.status === 'ON_HOLD').length,
    completed: projects.filter((p) => p.status === 'COMPLETED').length,
  };

  // Check permissions
  const permissions = claims?.permissions || 0;
  const hasViewAccess = canViewProjects(permissions);
  const hasManagePermission = canManageProjects(permissions);

  const modules: ModuleItem[] = [
    {
      id: 'all-projects',
      title: 'All Projects',
      description: 'View and manage all projects',
      icon: <ListIcon sx={{ fontSize: 48, color: 'primary.main' }} />,
      path: '/projects/list',
      count: stats.total,
      countLoading: loading,
    },
    {
      id: 'active-projects',
      title: 'Active Projects',
      description: 'Projects currently in progress',
      icon: <ActiveIcon sx={{ fontSize: 48, color: 'success.main' }} />,
      path: '/projects/list?status=ACTIVE',
      count: stats.active,
      countLoading: loading,
    },
    {
      id: 'planning',
      title: 'Planning',
      description: 'Projects in planning stage',
      icon: <PlanningIcon sx={{ fontSize: 48, color: 'info.main' }} />,
      path: '/projects/list?status=PLANNING',
      count: stats.planning,
      countLoading: loading,
    },
    {
      id: 'on-hold',
      title: 'On Hold',
      description: 'Projects temporarily paused',
      icon: <OnHoldIcon sx={{ fontSize: 48, color: 'warning.main' }} />,
      path: '/projects/list?status=ON_HOLD',
      count: stats.onHold,
      countLoading: loading,
    },
    {
      id: 'completed',
      title: 'Completed',
      description: 'Successfully completed projects',
      icon: <CompletedIcon sx={{ fontSize: 48, color: 'success.main' }} />,
      path: '/projects/list?status=COMPLETED',
      count: stats.completed,
      countLoading: loading,
    },
    {
      id: 'files',
      title: 'Files',
      description: 'Browse project-related documents',
      icon: <FolderIcon sx={{ fontSize: 48, color: 'primary.main' }} />,
      path: '/projects/files',
    },
  ];

  return (
    <ModuleLandingPage
      title="Projects"
      description="Manage projects from initiation to completion"
      items={modules}
      newAction={
        hasManagePermission
          ? {
              label: 'New Project',
              path: '/projects/list',
            }
          : undefined
      }
      permissionDenied={!hasViewAccess}
    />
  );
}
