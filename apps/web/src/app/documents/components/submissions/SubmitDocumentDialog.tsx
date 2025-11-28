'use client';

/**
 * Submit Document Dialog
 *
 * Dialog for submitting a new document revision to the client
 * - File upload
 * - Revision auto-increment
 * - Submission notes
 * - Client visibility toggle
 */

import { useState } from 'react';
import {
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Button,
  TextField,
  Stack,
  Typography,
  FormControlLabel,
  Switch,
  Alert,
  Box,
  Chip,
  LinearProgress,
} from '@mui/material';
import { CloudUpload as UploadIcon } from '@mui/icons-material';
import type { MasterDocumentEntry } from '@vapour/types';
import { ApproverSelector } from '@/components/common/forms/ApproverSelector';

interface SubmitDocumentDialogProps {
  open: boolean;
  onClose: () => void;
  document: MasterDocumentEntry;
  onSubmit: (data: SubmissionData) => Promise<void>;
}

export interface SubmissionData {
  file: File;
  revision: string;
  submissionNotes: string;
  clientVisible: boolean;
  reviewerId?: string;
}

export default function SubmitDocumentDialog({
  open,
  onClose,
  document,
  onSubmit,
}: SubmitDocumentDialogProps) {
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [submissionNotes, setSubmissionNotes] = useState('');
  const [clientVisible, setClientVisible] = useState(true);
  const [reviewerId, setReviewerId] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Calculate next revision
  const getNextRevision = (): string => {
    const current = document.currentRevision || 'R0';
    const match = current.match(/R(\d+)/);
    if (match && match[1]) {
      const num = parseInt(match[1], 10);
      return `R${num + 1}`;
    }
    return 'R1';
  };

  const nextRevision = getNextRevision();

  const handleFileSelect = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (file) {
      // Validate file size (50MB max)
      if (file.size > 50 * 1024 * 1024) {
        setError('File size must be less than 50MB');
        return;
      }
      setSelectedFile(file);
      setError(null);
    }
  };

  const handleSubmit = async () => {
    if (!selectedFile) {
      setError('Please select a file to upload');
      return;
    }

    setSubmitting(true);
    setError(null);

    try {
      await onSubmit({
        file: selectedFile,
        revision: nextRevision,
        submissionNotes,
        clientVisible,
        reviewerId: reviewerId || undefined,
      });

      // Reset form
      setSelectedFile(null);
      setSubmissionNotes('');
      setClientVisible(true);
      setReviewerId(null);
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to submit document');
    } finally {
      setSubmitting(false);
    }
  };

  const handleClose = () => {
    if (!submitting) {
      setSelectedFile(null);
      setSubmissionNotes('');
      setReviewerId(null);
      setError(null);
      onClose();
    }
  };

  const formatFileSize = (bytes: number): string => {
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  };

  return (
    <Dialog open={open} onClose={handleClose} maxWidth="sm" fullWidth>
      <DialogTitle>
        Submit Document Revision
        <Typography variant="body2" color="text.secondary" sx={{ mt: 0.5 }}>
          {document.documentNumber} - {document.documentTitle}
        </Typography>
      </DialogTitle>

      <DialogContent>
        <Stack spacing={3} sx={{ mt: 1 }}>
          {/* Revision Info */}
          <Box>
            <Stack direction="row" spacing={1} alignItems="center" sx={{ mb: 1 }}>
              <Typography variant="body2" color="text.secondary">
                Current Revision:
              </Typography>
              <Chip label={document.currentRevision} size="small" />
              <Typography variant="body2" color="text.secondary">
                →
              </Typography>
              <Typography variant="body2" color="text.secondary">
                New Revision:
              </Typography>
              <Chip label={nextRevision} size="small" color="primary" />
            </Stack>
            <Typography variant="caption" color="text.secondary">
              Submission #{document.submissionCount + 1}
            </Typography>
          </Box>

          {/* File Upload */}
          <Box>
            <input
              accept=".pdf,.doc,.docx,.dwg,.dxf,.xlsx,.xls"
              style={{ display: 'none' }}
              id="document-file-upload"
              type="file"
              onChange={handleFileSelect}
              disabled={submitting}
            />
            <label htmlFor="document-file-upload">
              <Button
                variant="outlined"
                component="span"
                startIcon={<UploadIcon />}
                fullWidth
                disabled={submitting}
              >
                {selectedFile ? 'Change File' : 'Select File'}
              </Button>
            </label>

            {selectedFile && (
              <Box
                sx={{
                  mt: 1,
                  p: 2,
                  border: 1,
                  borderColor: 'divider',
                  borderRadius: 1,
                  bgcolor: 'background.default',
                }}
              >
                <Typography variant="body2" fontWeight="medium">
                  {selectedFile.name}
                </Typography>
                <Typography variant="caption" color="text.secondary">
                  {formatFileSize(selectedFile.size)}
                </Typography>
              </Box>
            )}

            <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mt: 1 }}>
              Supported formats: PDF, Word, AutoCAD (DWG/DXF), Excel (max 50MB)
            </Typography>
          </Box>

          {/* Submission Notes */}
          <TextField
            label="Submission Notes"
            multiline
            rows={4}
            value={submissionNotes}
            onChange={(e) => setSubmissionNotes(e.target.value)}
            placeholder="Enter cover notes, changes summary, or special instructions..."
            disabled={submitting}
            fullWidth
          />

          {/* Reviewer Assignment */}
          <ApproverSelector
            value={reviewerId}
            onChange={setReviewerId}
            label="Assign Reviewer"
            approvalType="document"
            helperText="Select a reviewer to be notified when this document is submitted (optional)"
            disabled={submitting}
          />

          {/* Client Visibility */}
          <FormControlLabel
            control={
              <Switch
                checked={clientVisible}
                onChange={(e) => setClientVisible(e.target.checked)}
                disabled={submitting}
              />
            }
            label={
              <Box>
                <Typography variant="body2">Client Visible</Typography>
                <Typography variant="caption" color="text.secondary">
                  {clientVisible
                    ? 'Client will be able to view and download this submission'
                    : 'This will be an internal submission only'}
                </Typography>
              </Box>
            }
          />

          {/* Error Message */}
          {error && <Alert severity="error">{error}</Alert>}

          {/* Progress */}
          {submitting && (
            <Box>
              <Typography variant="body2" color="text.secondary" gutterBottom>
                Uploading and submitting...
              </Typography>
              <LinearProgress />
            </Box>
          )}
        </Stack>
      </DialogContent>

      <DialogActions>
        <Button onClick={handleClose} disabled={submitting}>
          Cancel
        </Button>
        <Button onClick={handleSubmit} variant="contained" disabled={!selectedFile || submitting}>
          {submitting ? 'Submitting...' : 'Submit'}
        </Button>
      </DialogActions>
    </Dialog>
  );
}
