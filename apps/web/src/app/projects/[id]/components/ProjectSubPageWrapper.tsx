'use client';

import { useRouter } from 'next/navigation';
import {
  Container,
  Typography,
  Box,
  CircularProgress,
  Alert,
  Breadcrumbs,
  Link,
  Button,
} from '@mui/material';
import { Home as HomeIcon, ArrowBack as BackIcon } from '@mui/icons-material';
import type { Project } from '@vapour/types';

interface ProjectSubPageWrapperProps {
  project: Project | null;
  projectId: string | null;
  loading: boolean;
  error: string | null;
  hasViewAccess: boolean;
  title: string;
  children: React.ReactNode;
}

/**
 * Shared wrapper component for project sub-module pages
 * Provides breadcrumbs, back button, and loading/error states
 */
export function ProjectSubPageWrapper({
  project,
  projectId,
  loading,
  error,
  hasViewAccess,
  title,
  children,
}: ProjectSubPageWrapperProps) {
  const router = useRouter();

  if (!hasViewAccess) {
    return (
      <Container maxWidth="xl">
        <Box sx={{ py: 4 }}>
          <Alert severity="error">You do not have permission to view project details.</Alert>
        </Box>
      </Container>
    );
  }

  if (loading) {
    return (
      <Container maxWidth="xl">
        <Box sx={{ display: 'flex', justifyContent: 'center', py: 8 }}>
          <CircularProgress />
        </Box>
      </Container>
    );
  }

  if (error || !project) {
    return (
      <Container maxWidth="xl">
        <Box sx={{ py: 4 }}>
          <Alert severity="error">{error || 'Project not found'}</Alert>
        </Box>
      </Container>
    );
  }

  return (
    <Container maxWidth="xl">
      <Box sx={{ mb: 4 }}>
        {/* Breadcrumbs */}
        <Breadcrumbs sx={{ mb: 2 }}>
          <Link
            underline="hover"
            color="inherit"
            href="/dashboard"
            sx={{ display: 'flex', alignItems: 'center', cursor: 'pointer' }}
          >
            <HomeIcon sx={{ mr: 0.5 }} fontSize="small" />
            Home
          </Link>
          <Link
            underline="hover"
            color="inherit"
            href="/projects"
            sx={{ cursor: 'pointer' }}
            onClick={(e) => {
              e.preventDefault();
              router.push('/projects');
            }}
          >
            Projects
          </Link>
          <Link
            underline="hover"
            color="inherit"
            href={`/projects/${projectId}`}
            sx={{ cursor: 'pointer' }}
            onClick={(e) => {
              e.preventDefault();
              router.push(`/projects/${projectId}`);
            }}
          >
            {project.code}
          </Link>
          <Typography color="text.primary">{title}</Typography>
        </Breadcrumbs>

        {/* Back Button and Header */}
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 2, mb: 3 }}>
          <Button
            startIcon={<BackIcon />}
            onClick={() => router.push(`/projects/${projectId}`)}
            variant="outlined"
            size="small"
          >
            Back to Project
          </Button>
        </Box>

        <Typography variant="h4" component="h1" gutterBottom>
          {title}
        </Typography>
        <Typography variant="body1" color="text.secondary" sx={{ mb: 3 }}>
          {project.name} ({project.code})
        </Typography>

        {/* Page Content */}
        {children}
      </Box>
    </Container>
  );
}
