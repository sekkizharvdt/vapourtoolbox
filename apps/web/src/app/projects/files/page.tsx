'use client';

/**
 * Projects Files Page
 *
 * Global document browser for all project-related documents
 * Shows documents across all projects with folder navigation
 */

import { useCallback } from 'react';
import { Container, Box, Typography } from '@mui/material';
import { PageHeader } from '@vapour/ui';
import { useAuth } from '@/contexts/AuthContext';
import { canViewProjects } from '@vapour/constants';
import { DocumentBrowser } from '@/components/documents/browser';
import type { DocumentRecord } from '@vapour/types';

export default function ProjectsFilesPage() {
  const { claims } = useAuth();

  // Check permissions
  const hasViewAccess = claims?.permissions ? canViewProjects(claims.permissions) : false;

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

  if (!hasViewAccess) {
    return (
      <Container maxWidth="xl">
        <Box sx={{ mb: 4 }}>
          <Typography variant="h4" component="h1" gutterBottom>
            Projects Files
          </Typography>
          <Typography variant="body1" color="error">
            You do not have permission to access the Projects module.
          </Typography>
        </Box>
      </Container>
    );
  }

  return (
    <Container maxWidth="xl" sx={{ height: 'calc(100vh - 120px)' }}>
      <Box sx={{ mb: 2 }}>
        <PageHeader
          title="Projects Files"
          subtitle="Browse and manage project-related documents across all projects"
        />
      </Box>

      <Box sx={{ height: 'calc(100% - 80px)' }}>
        <DocumentBrowser
          module="PROJECTS"
          showViewToggle={true}
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
