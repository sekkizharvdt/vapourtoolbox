'use client';

/**
 * Document Revisions & Submissions Tab
 *
 * Displays the revision/submission history for a master document
 * and allows uploading new revisions. Shows a timeline of submissions
 * ordered newest-first with file attachments and client review status.
 */

import { useState, useEffect, useCallback } from 'react';
import dynamic from 'next/dynamic';
import {
  Box,
  Paper,
  Typography,
  Stack,
  Chip,
  Button,
  IconButton,
  Alert,
  Divider,
  CircularProgress,
} from '@mui/material';
import {
  CloudUpload as UploadIcon,
  Download as DownloadIcon,
  Description as FileIcon,
} from '@mui/icons-material';
import type {
  MasterDocumentEntry,
  DocumentSubmission,
  SubmissionFile,
  ClientReviewStatus,
} from '@vapour/types';
import { getDocumentSubmissions } from '@/lib/documents/submissionService';
import { getFirebase } from '@/lib/firebase';
import { useAuth } from '@/contexts/AuthContext';
import { canSubmitDocuments, canManageDocuments } from '@vapour/constants';

const SubmitRevisionDialog = dynamic(() => import('./SubmitRevisionDialog'), {
  ssr: false,
});

// ============================================================================
// TYPES
// ============================================================================

interface DocumentRevisionsProps {
  document: MasterDocumentEntry;
  onUpdate: () => void;
}

// ============================================================================
// HELPERS
// ============================================================================

const TERMINAL_STATUSES = ['APPROVED', 'ACCEPTED', 'CANCELLED'] as const;

function formatDate(timestamp: { seconds: number } | undefined | null): string {
  if (!timestamp || typeof timestamp !== 'object' || !('seconds' in timestamp)) {
    return '-';
  }
  return new Date(timestamp.seconds * 1000).toLocaleDateString('en-IN', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
  });
}

function formatFileSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

function getClientStatusColor(
  status: ClientReviewStatus
): 'default' | 'success' | 'error' | 'warning' | 'info' {
  switch (status) {
    case 'APPROVED':
      return 'success';
    case 'REJECTED':
      return 'error';
    case 'APPROVED_WITH_COMMENTS':
    case 'CONDITIONALLY_APPROVED':
      return 'warning';
    case 'UNDER_REVIEW':
      return 'info';
    case 'PENDING':
    default:
      return 'default';
  }
}

function getClientStatusLabel(status: ClientReviewStatus): string {
  switch (status) {
    case 'APPROVED_WITH_COMMENTS':
      return 'Approved w/ Comments';
    case 'CONDITIONALLY_APPROVED':
      return 'Conditionally Approved';
    case 'UNDER_REVIEW':
      return 'Under Review';
    default:
      return status.charAt(0) + status.slice(1).toLowerCase();
  }
}

function getFileTypeColor(fileType: SubmissionFile['fileType']): 'primary' | 'error' | 'default' {
  switch (fileType) {
    case 'NATIVE':
      return 'primary';
    case 'PDF':
      return 'error';
    case 'SUPPORTING':
    default:
      return 'default';
  }
}

// ============================================================================
// COMPONENT
// ============================================================================

export default function DocumentRevisions({ document, onUpdate }: DocumentRevisionsProps) {
  const { claims } = useAuth();
  const { db } = getFirebase();

  const [submissions, setSubmissions] = useState<DocumentSubmission[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [dialogOpen, setDialogOpen] = useState(false);

  // Permission check
  const userPermissions = claims?.permissions ?? 0;
  const hasSubmitPermission =
    canSubmitDocuments(userPermissions) || canManageDocuments(userPermissions);

  // Terminal status check — disable new submissions for completed documents
  const isTerminalStatus = TERMINAL_STATUSES.includes(
    document.status as (typeof TERMINAL_STATUSES)[number]
  );

  const loadSubmissions = useCallback(async () => {
    if (!document.projectId || !document.id) return;

    setLoading(true);
    setError(null);

    try {
      const result = await getDocumentSubmissions(db, document.projectId, document.id);
      setSubmissions(result);
    } catch (err) {
      console.error('Failed to load submissions:', err);
      setError('Failed to load submissions. Please try again.');
    } finally {
      setLoading(false);
    }
  }, [db, document.projectId, document.id]);

  useEffect(() => {
    loadSubmissions();
  }, [loadSubmissions]);

  const handleDialogClose = (submitted?: boolean) => {
    setDialogOpen(false);
    if (submitted) {
      loadSubmissions();
      onUpdate();
    }
  };

  // --------------------------------------------------------------------------
  // RENDER: File Row
  // --------------------------------------------------------------------------

  const renderFileRow = (file: SubmissionFile) => (
    <Stack
      key={file.id}
      direction="row"
      alignItems="center"
      spacing={1.5}
      sx={{
        py: 0.75,
        px: 1.5,
        borderRadius: 1,
        bgcolor: 'action.hover',
      }}
    >
      <Chip
        label={file.fileType}
        size="small"
        color={getFileTypeColor(file.fileType)}
        variant="outlined"
        sx={{ minWidth: 90, fontFamily: 'monospace', fontSize: '0.75rem' }}
      />
      <FileIcon fontSize="small" color="action" />
      <Typography
        component="a"
        href={file.fileUrl}
        target="_blank"
        rel="noopener noreferrer"
        variant="body2"
        sx={{
          flex: 1,
          color: 'primary.main',
          textDecoration: 'none',
          '&:hover': { textDecoration: 'underline' },
          overflow: 'hidden',
          textOverflow: 'ellipsis',
          whiteSpace: 'nowrap',
        }}
      >
        {file.fileName}
      </Typography>
      <Typography
        variant="caption"
        color="text.secondary"
        sx={{ minWidth: 70, textAlign: 'right' }}
      >
        {formatFileSize(file.fileSize)}
      </Typography>
      <IconButton
        size="small"
        component="a"
        href={file.fileUrl}
        target="_blank"
        rel="noopener noreferrer"
        aria-label={`Download ${file.fileName}`}
      >
        <DownloadIcon fontSize="small" />
      </IconButton>
    </Stack>
  );

  // --------------------------------------------------------------------------
  // RENDER: Submission Card
  // --------------------------------------------------------------------------

  const renderSubmissionCard = (submission: DocumentSubmission) => {
    const hasFiles = submission.files && submission.files.length > 0;

    return (
      <Paper key={submission.id} variant="outlined" sx={{ p: 2.5 }}>
        {/* Top row: revision info + status */}
        <Stack
          direction={{ xs: 'column', sm: 'row' }}
          justifyContent="space-between"
          alignItems={{ xs: 'flex-start', sm: 'center' }}
          spacing={1.5}
          sx={{ mb: hasFiles || !hasFiles ? 1.5 : 0 }}
        >
          {/* Left: Revision + Submission # */}
          <Stack direction="row" alignItems="center" spacing={1.5}>
            <Chip
              label={submission.revision}
              size="small"
              color="primary"
              sx={{ fontWeight: 700, fontFamily: 'monospace' }}
            />
            <Typography variant="body2" color="text.secondary">
              #{submission.submissionNumber}
            </Typography>
          </Stack>

          {/* Middle: Submitter + Date + Notes */}
          <Stack sx={{ flex: 1 }} spacing={0.25}>
            <Stack direction="row" alignItems="center" spacing={1}>
              <Typography variant="body2" fontWeight={500}>
                {submission.submittedByName}
              </Typography>
              <Typography variant="caption" color="text.secondary">
                {formatDate(submission.submittedAt as { seconds: number } | undefined)}
              </Typography>
            </Stack>
            {submission.submissionNotes && (
              <Typography variant="body2" color="text.secondary" sx={{ fontStyle: 'italic' }}>
                {submission.submissionNotes}
              </Typography>
            )}
          </Stack>

          {/* Right: Client status */}
          <Chip
            label={getClientStatusLabel(submission.clientStatus)}
            size="small"
            color={getClientStatusColor(submission.clientStatus)}
            variant="filled"
          />
        </Stack>

        {/* File list */}
        {hasFiles ? (
          <>
            <Divider sx={{ mb: 1.5 }} />
            <Stack spacing={0.75}>{submission.files!.map(renderFileRow)}</Stack>
          </>
        ) : (
          // Legacy submission without files array — show single link
          <>
            <Divider sx={{ mb: 1.5 }} />
            <Stack
              direction="row"
              alignItems="center"
              spacing={1.5}
              sx={{ py: 0.75, px: 1.5, borderRadius: 1, bgcolor: 'action.hover' }}
            >
              <FileIcon fontSize="small" color="action" />
              <Typography
                component="a"
                href={`/documents/${submission.documentId}`}
                variant="body2"
                sx={{
                  flex: 1,
                  color: 'primary.main',
                  textDecoration: 'none',
                  '&:hover': { textDecoration: 'underline' },
                }}
              >
                View Document
              </Typography>
            </Stack>
          </>
        )}
      </Paper>
    );
  };

  // --------------------------------------------------------------------------
  // RENDER: Main
  // --------------------------------------------------------------------------

  return (
    <Box sx={{ px: 3 }}>
      {/* Header */}
      <Stack direction="row" justifyContent="space-between" alignItems="center" sx={{ mb: 3 }}>
        <Typography variant="h6">Revisions &amp; Submissions</Typography>
        {hasSubmitPermission && (
          <Button
            variant="contained"
            startIcon={<UploadIcon />}
            onClick={() => setDialogOpen(true)}
            disabled={isTerminalStatus}
          >
            Submit New Revision
          </Button>
        )}
      </Stack>

      {/* Error */}
      {error && (
        <Alert severity="error" sx={{ mb: 2 }} onClose={() => setError(null)}>
          {error}
        </Alert>
      )}

      {/* Loading */}
      {loading && (
        <Box sx={{ display: 'flex', justifyContent: 'center', py: 6 }}>
          <CircularProgress />
        </Box>
      )}

      {/* Submissions list */}
      {!loading && submissions.length > 0 && (
        <Stack spacing={2}>{submissions.map(renderSubmissionCard)}</Stack>
      )}

      {/* Empty state */}
      {!loading && submissions.length === 0 && !error && (
        <Paper
          variant="outlined"
          sx={{
            p: 6,
            textAlign: 'center',
            bgcolor: 'action.hover',
          }}
        >
          <UploadIcon sx={{ fontSize: 48, color: 'text.disabled', mb: 1.5 }} />
          <Typography variant="body1" color="text.secondary">
            No submissions yet. Upload your first revision to get started.
          </Typography>
        </Paper>
      )}

      {/* Submit Revision Dialog */}
      {dialogOpen && (
        <SubmitRevisionDialog
          open={dialogOpen}
          onClose={() => handleDialogClose()}
          document={document}
          onSuccess={() => handleDialogClose(true)}
        />
      )}
    </Box>
  );
}
