'use client';

/**
 * Proposals Files Page
 *
 * Document browser for the Proposals module
 * Shows all proposal-related documents with folder navigation
 */

import { useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { Container, Box, Typography, Breadcrumbs, Link } from '@mui/material';
import { Home as HomeIcon } from '@mui/icons-material';
import { PageHeader } from '@vapour/ui';
import { useAuth } from '@/contexts/AuthContext';
import { canViewProposals } from '@vapour/constants';
import { DocumentBrowser } from '@/components/documents/browser';
import type { DocumentRecord } from '@vapour/types';

export default function ProposalsFilesPage() {
  const router = useRouter();
  const { claims } = useAuth();

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
    // TODO: Open upload dialog - integrate with existing upload component
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
      <Breadcrumbs sx={{ mb: 2 }}>
        <Link
          color="inherit"
          href="/proposals"
          onClick={(e: React.MouseEvent) => {
            e.preventDefault();
            router.push('/proposals');
          }}
          sx={{ display: 'flex', alignItems: 'center', cursor: 'pointer' }}
        >
          <HomeIcon sx={{ mr: 0.5 }} fontSize="small" />
          Proposals
        </Link>
        <Typography color="text.primary">Files</Typography>
      </Breadcrumbs>
      <Box sx={{ mb: 2 }}>
        <PageHeader
          title="Proposals Files"
          subtitle="Browse and manage proposal-related documents"
        />
      </Box>

      <Box sx={{ height: 'calc(100% - 80px)' }}>
        <DocumentBrowser
          module="PROPOSALS"
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
