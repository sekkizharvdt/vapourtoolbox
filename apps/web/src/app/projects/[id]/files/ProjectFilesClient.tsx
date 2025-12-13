'use client';

/**
 * Project Files Client Component
 *
 * Document browser for a specific project
 * Shows all project-related documents across all modules
 */

import { useState, useEffect, useCallback } from 'react';
import { usePathname } from 'next/navigation';
import { Container, Box, Typography, Alert } from '@mui/material';
import { PageHeader, LoadingState } from '@vapour/ui';
import { useAuth } from '@/contexts/AuthContext';
import { hasAnyPermission, PermissionFlag } from '@vapour/types';
import { DocumentBrowser } from '@/components/documents/browser';
import { getFirebase } from '@/lib/firebase';
import { doc, getDoc } from 'firebase/firestore';
import { COLLECTIONS } from '@vapour/firebase';
import type { DocumentRecord, Project } from '@vapour/types';

export default function ProjectFilesClient() {
  const pathname = usePathname();
  const { claims } = useAuth();
  const { db } = getFirebase();

  const [project, setProject] = useState<Project | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Extract project ID from pathname
  const projectId = pathname?.split('/projects/')[1]?.split('/')[0] || '';

  // Check permissions - user needs VIEW_ALL_PROJECTS or ASSIGN_PROJECTS (can view assigned projects)
  const hasViewAccess = claims?.permissions
    ? hasAnyPermission(
        claims.permissions,
        PermissionFlag.VIEW_ALL_PROJECTS,
        PermissionFlag.ASSIGN_PROJECTS
      )
    : false;

  // Load project details
  useEffect(() => {
    const loadProject = async () => {
      if (!projectId || projectId === 'placeholder' || !db) {
        setLoading(false);
        return;
      }

      try {
        const projectRef = doc(db, COLLECTIONS.PROJECTS, projectId);
        const projectSnap = await getDoc(projectRef);

        if (projectSnap.exists()) {
          setProject({
            id: projectSnap.id,
            ...projectSnap.data(),
          } as Project);
        } else {
          setError('Project not found');
        }
      } catch (err) {
        console.error('[ProjectFilesClient] Error loading project:', err);
        setError('Failed to load project');
      } finally {
        setLoading(false);
      }
    };

    loadProject();
  }, [projectId, db]);

  // Handle document view
  const handleViewDocument = useCallback((document: DocumentRecord) => {
    if (document.fileUrl) {
      window.open(document.fileUrl, '_blank');
    }
  }, []);

  // Handle document download
  const handleDownloadDocument = useCallback((document: DocumentRecord) => {
    if (document.fileUrl) {
      const link = window.document.createElement('a');
      link.href = document.fileUrl;
      link.download = document.fileName;
      link.click();
    }
  }, []);

  // Handle upload click
  const handleUploadClick = useCallback(() => {
    // TODO: Open upload dialog - integrate with existing upload component
  }, []);

  if (loading) {
    return (
      <Container maxWidth="xl">
        <LoadingState message="Loading project..." variant="page" />
      </Container>
    );
  }

  if (error) {
    return (
      <Container maxWidth="xl">
        <Box sx={{ mb: 4 }}>
          <Typography variant="h4" component="h1" gutterBottom>
            Project Files
          </Typography>
          <Alert severity="error">{error}</Alert>
        </Box>
      </Container>
    );
  }

  if (!hasViewAccess) {
    return (
      <Container maxWidth="xl">
        <Box sx={{ mb: 4 }}>
          <Typography variant="h4" component="h1" gutterBottom>
            Project Files
          </Typography>
          <Typography variant="body1" color="error">
            You do not have permission to access this project.
          </Typography>
        </Box>
      </Container>
    );
  }

  const projectTitle = project ? `${project.code} - ${project.name}` : 'Project';

  return (
    <Container maxWidth="xl" sx={{ height: 'calc(100vh - 120px)' }}>
      <Box sx={{ mb: 2 }}>
        <PageHeader
          title={`${projectTitle} Files`}
          subtitle="Browse and manage all documents for this project"
        />
      </Box>

      <Box sx={{ height: 'calc(100% - 80px)' }}>
        <DocumentBrowser
          module="PROJECTS"
          projectId={projectId}
          showViewToggle={false}
          allowFolderCreation={true}
          allowUpload={true}
          onViewDocument={handleViewDocument}
          onDownloadDocument={handleDownloadDocument}
          onUploadClick={handleUploadClick}
        />
      </Box>
    </Container>
  );
}
