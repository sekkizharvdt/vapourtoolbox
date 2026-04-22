'use client';

/**
 * Proposals Files Page
 *
 * Document browser for the Proposals module
 * Shows all proposal-related documents with folder navigation
 */

import { useState, useCallback } from 'react';
import { Container, Box, Typography } from '@mui/material';
import { PageBreadcrumbs } from '@/components/common/PageBreadcrumbs';
import { Home as HomeIcon } from '@mui/icons-material';
import { PageHeader } from '@vapour/ui';
import { useAuth } from '@/contexts/AuthContext';
import { canViewProposals } from '@vapour/constants';
import { DocumentBrowser, UploadDocumentDialog } from '@/components/documents/browser';
import type { DocumentRecord } from '@vapour/types';

export default function ProposalsFilesPage() {
  const { claims } = useAuth();
  const [uploadDialogOpen, setUploadDialogOpen] = useState(false);
  const [refreshKey, setRefreshKey] = useState(0);

  // Check permissions
  const hasViewAccess = claims?.permissions ? canViewProposals(claims.permissions) : false;

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
      <Container maxWidth="xl">
        <Box sx={{ mb: 4 }}>
          <Typography variant="h4" component="h1" gutterBottom>
            Proposals Files
          </Typography>
          <Typography variant="body1" color="error">
            You do not have permission to access the Proposals module.
          </Typography>
        </Box>
      </Container>
    );
  }

  return (
    <Container maxWidth="xl" sx={{ height: 'calc(100vh - 120px)' }}>
      <PageBreadcrumbs
        items={[
          { label: 'Proposals', href: '/proposals', icon: <HomeIcon fontSize="small" /> },
          { label: 'Files' },
        ]}
      />
      <Box sx={{ mb: 2 }}>
        <PageHeader
          title="Proposals Files"
          subtitle="Browse and manage proposal-related documents"
        />
      </Box>

      <Box sx={{ height: 'calc(100% - 80px)' }}>
        <DocumentBrowser
          key={refreshKey}
          module="PROPOSALS"
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
        module="PROPOSALS"
      />
    </Container>
  );
}
