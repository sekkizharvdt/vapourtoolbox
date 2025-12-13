'use client';

/**
 * Accounting Files Page
 *
 * Document browser for the Accounting module
 * Shows all accounting-related documents with folder navigation
 */

import { useCallback } from 'react';
import { Container, Box, Typography } from '@mui/material';
import { PageHeader } from '@vapour/ui';
import { useAuth } from '@/contexts/AuthContext';
import { hasAnyPermission, PermissionFlag } from '@vapour/types';
import { DocumentBrowser } from '@/components/documents/browser';
import type { DocumentRecord } from '@vapour/types';

export default function AccountingFilesPage() {
  const { claims } = useAuth();

  // Check permissions - accounting users need VIEW_REPORTS or CREATE_TRANSACTIONS
  const hasViewAccess = claims?.permissions
    ? hasAnyPermission(
        claims.permissions,
        PermissionFlag.VIEW_REPORTS,
        PermissionFlag.CREATE_TRANSACTIONS
      )
    : false;

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
            Accounting Files
          </Typography>
          <Typography variant="body1" color="error">
            You do not have permission to access the Accounting module.
          </Typography>
        </Box>
      </Container>
    );
  }

  return (
    <Container maxWidth="xl" sx={{ height: 'calc(100vh - 120px)' }}>
      <Box sx={{ mb: 2 }}>
        <PageHeader
          title="Accounting Files"
          subtitle="Browse and manage accounting-related documents"
        />
      </Box>

      <Box sx={{ height: 'calc(100% - 80px)' }}>
        <DocumentBrowser
          module="ACCOUNTING"
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
