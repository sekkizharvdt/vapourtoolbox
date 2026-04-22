'use client';

/**
 * Accounting Files Page
 *
 * Document browser for the Accounting module
 * Shows all accounting-related documents with folder navigation
 */

import { useState, useCallback } from 'react';
import { Box, Typography } from '@mui/material';
import { PageBreadcrumbs } from '@/components/common/PageBreadcrumbs';
import { Home as HomeIcon } from '@mui/icons-material';
import { PageHeader } from '@vapour/ui';
import { useAuth } from '@/contexts/AuthContext';
import { PERMISSION_FLAGS, hasAnyPermission } from '@vapour/constants';
import { DocumentBrowser, UploadDocumentDialog } from '@/components/documents/browser';
import type { DocumentRecord } from '@vapour/types';

export default function AccountingFilesPage() {
  const { claims } = useAuth();
  const [uploadDialogOpen, setUploadDialogOpen] = useState(false);
  const [refreshKey, setRefreshKey] = useState(0);

  // Check permissions - accounting users need VIEW_REPORTS or CREATE_TRANSACTIONS
  const hasViewAccess = claims?.permissions
    ? hasAnyPermission(
        claims.permissions,
        PERMISSION_FLAGS.VIEW_ACCOUNTING,
        PERMISSION_FLAGS.MANAGE_ACCOUNTING
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
            Accounting Files
          </Typography>
          <Typography variant="body1" color="error">
            You do not have permission to access the Accounting module.
          </Typography>
        </Box>
      </>
    );
  }

  return (
    <Box sx={{ height: 'calc(100vh - 120px)' }}>
      <Box sx={{ mb: 2 }}>
        <PageBreadcrumbs
          items={[
            { label: 'Accounting', href: '/accounting', icon: <HomeIcon fontSize="small" /> },
            { label: 'Files' },
          ]}
        />

        <PageHeader
          title="Accounting Files"
          subtitle="Browse and manage accounting-related documents"
        />
      </Box>

      <Box sx={{ height: 'calc(100% - 80px)' }}>
        <DocumentBrowser
          key={refreshKey}
          module="ACCOUNTING"
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
        module="ACCOUNTING"
      />
    </Box>
  );
}
