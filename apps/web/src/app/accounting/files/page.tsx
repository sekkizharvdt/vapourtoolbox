'use client';

/**
 * Accounting Files Page
 *
 * Document browser for the Accounting module
 * Shows all accounting-related documents with folder navigation
 */

import { useCallback } from 'react';
import { Box, Typography, Breadcrumbs, Link } from '@mui/material';
import { Home as HomeIcon } from '@mui/icons-material';
import { PageHeader } from '@vapour/ui';
import { useAuth } from '@/contexts/AuthContext';
import { hasAnyPermission, PermissionFlag } from '@vapour/types';
import { DocumentBrowser } from '@/components/documents/browser';
import type { DocumentRecord } from '@vapour/types';
import { useRouter } from 'next/navigation';

export default function AccountingFilesPage() {
  const router = useRouter();
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
        <Breadcrumbs sx={{ mb: 2 }}>
          <Link
            color="inherit"
            href="/accounting"
            onClick={(e: React.MouseEvent) => {
              e.preventDefault();
              router.push('/accounting');
            }}
            sx={{ display: 'flex', alignItems: 'center', cursor: 'pointer' }}
          >
            <HomeIcon sx={{ mr: 0.5 }} fontSize="small" />
            Accounting
          </Link>
          <Typography color="text.primary">Files</Typography>
        </Breadcrumbs>

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
    </Box>
  );
}
