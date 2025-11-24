'use client';

/**
 * Document Submissions Component
 *
 * Main component for managing document submissions
 * Features:
 * - Submission history table
 * - Submit new revision dialog
 * - View submission details
 * - Download documents and CRTs
 * - Comment navigation
 */

import { useState, useEffect } from 'react';
import { Box, Typography, Button, Stack, Alert, CircularProgress } from '@mui/material';
import { Add as AddIcon, Refresh as RefreshIcon } from '@mui/icons-material';
import type { MasterDocumentEntry, DocumentSubmission } from '@vapour/types';
import { getFirebase } from '@/lib/firebase';
import { collection, query, where, getDocs, orderBy } from 'firebase/firestore';
import SubmitDocumentDialog, { type SubmissionData } from './submissions/SubmitDocumentDialog';
import SubmissionsTable from './submissions/SubmissionsTable';
import SubmissionDetailsDialog from './submissions/SubmissionDetailsDialog';

interface DocumentSubmissionsProps {
  document: MasterDocumentEntry;
  onUpdate: () => void;
}

export default function DocumentSubmissions({ document, onUpdate }: DocumentSubmissionsProps) {
  const { db } = getFirebase();

  const [submissions, setSubmissions] = useState<DocumentSubmission[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Dialog states
  const [submitDialogOpen, setSubmitDialogOpen] = useState(false);
  const [detailsDialogOpen, setDetailsDialogOpen] = useState(false);
  const [selectedSubmission, setSelectedSubmission] = useState<DocumentSubmission | null>(null);

  useEffect(() => {
    loadSubmissions();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [document.id]);

  const loadSubmissions = async () => {
    if (!db) {
      console.error('[DocumentSubmissions] Firebase db not initialized');
      setLoading(false);
      return;
    }

    setLoading(true);
    setError(null);

    try {
      const submissionsRef = collection(db, 'projects', document.projectId, 'documentSubmissions');
      const q = query(
        submissionsRef,
        where('masterDocumentId', '==', document.id),
        orderBy('submissionNumber', 'desc')
      );

      const snapshot = await getDocs(q);
      const data: DocumentSubmission[] = [];

      snapshot.forEach((doc) => {
        data.push({
          id: doc.id,
          ...doc.data(),
        } as DocumentSubmission);
      });

      setSubmissions(data);
    } catch (err) {
      console.error('[DocumentSubmissions] Error loading submissions:', err);
      setError(err instanceof Error ? err.message : 'Failed to load submissions');
    } finally {
      setLoading(false);
    }
  };

  const handleSubmit = async (data: SubmissionData) => {
    try {
      // TODO: Implement actual file upload and submission creation
      // This will involve:
      // 1. Upload file to Firebase Storage
      // 2. Create DocumentRecord in Firestore
      // 3. Create DocumentSubmission in Firestore
      // 4. Update MasterDocumentEntry with new revision and submission count

      console.log('Submitting document:', data);

      // For now, show a placeholder alert
      alert('Document submission will be implemented with Firebase Storage integration');

      // Reload submissions and update parent
      await loadSubmissions();
      onUpdate();
    } catch (err) {
      throw new Error(err instanceof Error ? err.message : 'Failed to submit document');
    }
  };

  const handleViewSubmission = (submission: DocumentSubmission) => {
    setSelectedSubmission(submission);
    setDetailsDialogOpen(true);
  };

  const handleViewComments = (submission: DocumentSubmission) => {
    // TODO: Navigate to comments tab with this submission filtered
    console.log('View comments for submission:', submission.id);
    alert('Comment navigation will be implemented');
  };

  const handleDownloadCRT = (submission: DocumentSubmission) => {
    // TODO: Download CRT document
    console.log('Download CRT for submission:', submission.id);
    alert('CRT download will be implemented');
  };

  if (loading) {
    return (
      <Box sx={{ px: 3, py: 4, textAlign: 'center' }}>
        <CircularProgress />
        <Typography variant="body2" color="text.secondary" sx={{ mt: 2 }}>
          Loading submissions...
        </Typography>
      </Box>
    );
  }

  return (
    <Box sx={{ px: 3 }}>
      <Stack spacing={3}>
        {/* Header */}
        <Stack direction="row" justifyContent="space-between" alignItems="center">
          <Box>
            <Typography variant="h6">Document Submissions</Typography>
            <Typography variant="body2" color="text.secondary">
              {submissions.length} submission{submissions.length !== 1 ? 's' : ''} • Current
              Revision: {document.currentRevision}
            </Typography>
          </Box>
          <Stack direction="row" spacing={1}>
            <Button
              startIcon={<RefreshIcon />}
              onClick={loadSubmissions}
              disabled={loading}
              size="small"
            >
              Refresh
            </Button>
            <Button
              variant="contained"
              startIcon={<AddIcon />}
              onClick={() => setSubmitDialogOpen(true)}
            >
              New Submission
            </Button>
          </Stack>
        </Stack>

        {/* Error Alert */}
        {error && (
          <Alert severity="error" onClose={() => setError(null)}>
            {error}
          </Alert>
        )}

        {/* Submissions Table */}
        <SubmissionsTable
          submissions={submissions}
          onViewSubmission={handleViewSubmission}
          onViewComments={handleViewComments}
          onDownloadCRT={handleDownloadCRT}
        />

        {/* Submission Info */}
        {submissions.length > 0 && (
          <Alert severity="info" sx={{ mt: 2 }}>
            <Typography variant="body2">
              <strong>Next Submission:</strong> Will be Revision{' '}
              {`R${parseInt(document.currentRevision.replace('R', ''), 10) + 1}`} (Submission #
              {document.submissionCount + 1})
            </Typography>
          </Alert>
        )}
      </Stack>

      {/* Dialogs */}
      <SubmitDocumentDialog
        open={submitDialogOpen}
        onClose={() => setSubmitDialogOpen(false)}
        document={document}
        onSubmit={handleSubmit}
      />

      <SubmissionDetailsDialog
        open={detailsDialogOpen}
        onClose={() => {
          setDetailsDialogOpen(false);
          setSelectedSubmission(null);
        }}
        submission={selectedSubmission}
      />
    </Box>
  );
}
