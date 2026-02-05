'use client';

/**
 * Procurement Files Page
 *
 * Document browser for the Procurement module
 * Shows all procurement-related documents with folder navigation
 */

import { useState, useCallback } from 'react';
import { Box, Typography, Breadcrumbs, Link } from '@mui/material';
import { Home as HomeIcon } from '@mui/icons-material';
import { PageHeader } from '@vapour/ui';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/contexts/AuthContext';
import { canViewProcurement } from '@vapour/constants';
import { DocumentBrowser, UploadDocumentDialog } from '@/components/documents/browser';
import type { DocumentRecord } from '@vapour/types';

export default function ProcurementFilesPage() {
  const router = useRouter();
  const { claims } = useAuth();
  const [uploadDialogOpen, setUploadDialogOpen] = useState(false);
  const [refreshKey, setRefreshKey] = useState(0);

  // Check permissions
  const hasViewAccess = claims?.permissions ? canViewProcurement(claims.permissions) : false;

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
            Procurement Files
          </Typography>
          <Typography variant="body1" color="error">
            You do not have permission to access the Procurement module.
          </Typography>
        </Box>
      </>
    );
  }

  return (
    <>
      <Box sx={{ mb: 2 }}>
        <Breadcrumbs sx={{ mb: 2 }}>
          <Link
            color="inherit"
            href="/procurement"
            onClick={(e: React.MouseEvent) => {
              e.preventDefault();
              router.push('/procurement');
            }}
            sx={{ display: 'flex', alignItems: 'center', cursor: 'pointer' }}
          >
            <HomeIcon sx={{ mr: 0.5 }} fontSize="small" />
            Procurement
          </Link>
          <Typography color="text.primary">Files</Typography>
        </Breadcrumbs>

        <PageHeader
          title="Procurement Files"
          subtitle="Browse and manage procurement-related documents"
        />
      </Box>

      <Box sx={{ height: 'calc(100vh - 200px)' }}>
        <DocumentBrowser
          key={refreshKey}
          module="PROCUREMENT"
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
        module="PROCUREMENT"
      />
    </>
  );
}
