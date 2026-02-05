'use client';

/**
 * Projects Files Page
 *
 * Global document browser for all project-related documents
 * Shows documents across all projects with folder navigation
 */

import { useState, useCallback } from 'react';
import { Box, Breadcrumbs, Link, Typography } from '@mui/material';
import { Home as HomeIcon } from '@mui/icons-material';
import { PageHeader } from '@vapour/ui';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/contexts/AuthContext';
import { canViewProjects } from '@vapour/constants';
import { DocumentBrowser, UploadDocumentDialog } from '@/components/documents/browser';
import type { DocumentRecord } from '@vapour/types';

export default function ProjectsFilesPage() {
  const { claims } = useAuth();
  const router = useRouter();
  const [uploadDialogOpen, setUploadDialogOpen] = useState(false);
  const [refreshKey, setRefreshKey] = useState(0);

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
    setUploadDialogOpen(true);
  }, []);

  // Handle upload success - refresh the browser
  const handleUploadSuccess = useCallback(() => {
    setRefreshKey((k) => k + 1);
  }, []);

  if (!hasViewAccess) {
    return (
      <>
        <Box sx={{ mb: 4 }}>
          <Typography variant="h4" component="h1" gutterBottom>
            Projects Files
          </Typography>
          <Typography variant="body1" color="error">
            You do not have permission to access the Projects module.
          </Typography>
        </Box>
      </>
    );
  }

  return (
    <>
      <Breadcrumbs sx={{ mb: 2 }}>
        <Link
          color="inherit"
          href="/projects"
          onClick={(e: React.MouseEvent) => {
            e.preventDefault();
            router.push('/projects');
          }}
          sx={{ display: 'flex', alignItems: 'center', cursor: 'pointer' }}
        >
          <HomeIcon sx={{ mr: 0.5 }} fontSize="small" />
          Projects
        </Link>
        <Typography color="text.primary">Files</Typography>
      </Breadcrumbs>
      <Box sx={{ mb: 2 }}>
        <PageHeader
          title="Projects Files"
          subtitle="Browse and manage project-related documents across all projects"
        />
      </Box>

      <Box sx={{ height: 'calc(100vh - 200px)' }}>
        <DocumentBrowser
          key={refreshKey}
          module="PROJECTS"
          showViewToggle={true}
          allowFolderCreation={true}
          allowUpload={true}
          onViewDocument={handleViewDocument}
          onDownloadDocument={handleDownloadDocument}
          onUploadClick={handleUploadClick}
        />
      </Box>

      {/* Upload Dialog */}
      <UploadDocumentDialog
        open={uploadDialogOpen}
        onClose={() => setUploadDialogOpen(false)}
        onSuccess={handleUploadSuccess}
        module="PROJECTS"
      />
    </>
  );
}
