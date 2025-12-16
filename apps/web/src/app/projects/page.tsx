'use client';

/**
 * Projects Module - Hub Dashboard
 *
 * Card-based navigation to project sub-modules
 */

import { useMemo } from 'react';
import { Typography, Box, Card, CardContent, CardActions, Button, Grid } from '@mui/material';
import {
  List as ListIcon,
  PlayArrow as ActiveIcon,
  Edit as PlanningIcon,
  Folder as FolderIcon,
  Add as AddIcon,
  PauseCircle as OnHoldIcon,
  CheckCircle as CompletedIcon,
} from '@mui/icons-material';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/contexts/AuthContext';
import { canViewProjects, canManageProjects } from '@vapour/constants';
import { collection, query, orderBy, limit as firestoreLimit } from 'firebase/firestore';
import { getFirebase } from '@/lib/firebase';
import { COLLECTIONS } from '@vapour/firebase';
import type { Project } from '@vapour/types';
import { useFirestoreQuery } from '@/hooks/useFirestoreQuery';

interface ProjectModule {
  title: string;
  description: string;
  icon: React.ReactNode;
  path: string;
  count?: number;
}

export default function ProjectsPage() {
  const router = useRouter();
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

  const { data: projects } = useFirestoreQuery<Project>(projectsQuery);

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

  const modules: ProjectModule[] = [
    {
      title: 'All Projects',
      description: 'View and manage all projects',
      icon: <ListIcon sx={{ fontSize: 48, color: 'primary.main' }} />,
      path: '/projects/list',
      count: stats.total,
    },
    {
      title: 'Active Projects',
      description: 'Projects currently in progress',
      icon: <ActiveIcon sx={{ fontSize: 48, color: 'success.main' }} />,
      path: '/projects/list?status=ACTIVE',
      count: stats.active,
    },
    {
      title: 'Planning',
      description: 'Projects in planning stage',
      icon: <PlanningIcon sx={{ fontSize: 48, color: 'info.main' }} />,
      path: '/projects/list?status=PLANNING',
      count: stats.planning,
    },
    {
      title: 'On Hold',
      description: 'Projects temporarily paused',
      icon: <OnHoldIcon sx={{ fontSize: 48, color: 'warning.main' }} />,
      path: '/projects/list?status=ON_HOLD',
      count: stats.onHold,
    },
    {
      title: 'Completed',
      description: 'Successfully completed projects',
      icon: <CompletedIcon sx={{ fontSize: 48, color: 'success.main' }} />,
      path: '/projects/list?status=COMPLETED',
      count: stats.completed,
    },
    {
      title: 'Files',
      description: 'Browse project-related documents',
      icon: <FolderIcon sx={{ fontSize: 48, color: 'primary.main' }} />,
      path: '/projects/files',
    },
  ];

  if (!hasViewAccess) {
    return (
      <Box sx={{ mb: 4 }}>
        <Typography variant="h4" component="h1" gutterBottom>
          Projects
        </Typography>
        <Typography variant="body1" color="error">
          You do not have permission to access the Projects module.
        </Typography>
      </Box>
    );
  }

  return (
    <>
      <Box
        sx={{ mb: 4, display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}
      >
        <Box>
          <Typography variant="h4" component="h1" gutterBottom>
            Projects
          </Typography>
          <Typography variant="body1" color="text.secondary">
            Manage projects from initiation to completion
          </Typography>
        </Box>
        {hasManagePermission && (
          <Button
            variant="contained"
            startIcon={<AddIcon />}
            onClick={() => router.push('/projects/list')}
          >
            New Project
          </Button>
        )}
      </Box>

      <Grid container spacing={3}>
        {modules.map((module) => (
          <Grid size={{ xs: 12, sm: 6, md: 4 }} key={module.path}>
            <Card
              sx={{
                height: '100%',
                display: 'flex',
                flexDirection: 'column',
                position: 'relative',
              }}
            >
              {module.count !== undefined && (
                <Box
                  sx={{
                    position: 'absolute',
                    top: 8,
                    right: 8,
                    bgcolor: 'primary.main',
                    color: 'primary.contrastText',
                    px: 1.5,
                    py: 0.5,
                    borderRadius: 1,
                    fontSize: '0.875rem',
                    fontWeight: 'bold',
                  }}
                >
                  {module.count}
                </Box>
              )}

              <CardContent sx={{ flexGrow: 1, textAlign: 'center', pt: 4 }}>
                <Box sx={{ mb: 2 }}>{module.icon}</Box>
                <Typography variant="h6" component="h2" gutterBottom>
                  {module.title}
                </Typography>
                <Typography variant="body2" color="text.secondary">
                  {module.description}
                </Typography>
              </CardContent>

              <CardActions sx={{ justifyContent: 'center', pb: 2 }}>
                <Button variant="contained" onClick={() => router.push(module.path)}>
                  Open Module
                </Button>
              </CardActions>
            </Card>
          </Grid>
        ))}
      </Grid>
    </>
  );
}
