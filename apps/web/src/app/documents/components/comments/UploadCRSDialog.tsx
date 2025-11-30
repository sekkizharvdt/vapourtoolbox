'use client';

/**
 * Upload Comment Resolution Sheet Dialog
 *
 * Dialog for uploading a Comment Resolution Sheet from the client.
 * CRS files contain client feedback that can be manually entered as comments.
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
  Alert,
  Box,
  LinearProgress,
  FormControl,
  InputLabel,
  Select,
  MenuItem,
  Chip,
} from '@mui/material';
import { CloudUpload as UploadIcon, Description as FileIcon } from '@mui/icons-material';
import type { MasterDocumentEntry, DocumentSubmission } from '@vapour/types';
import { useAuth } from '@/contexts/AuthContext';
import { getFirebase } from '@/lib/firebase';
import { uploadCommentResolutionSheet } from '@/lib/documents/crsService';

interface UploadCRSDialogProps {
  open: boolean;
  onClose: () => void;
  document: MasterDocumentEntry;
  submissions: DocumentSubmission[];
  onSuccess: () => void;
}

export default function UploadCRSDialog({
  open,
  onClose,
  document,
  submissions,
  onSuccess,
}: UploadCRSDialogProps) {
  const { user } = useAuth();
  const { db } = getFirebase();

  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [selectedSubmissionId, setSelectedSubmissionId] = useState<string>('');
  const [notes, setNotes] = useState('');
  const [uploading, setUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [error, setError] = useState<string | null>(null);

  // Auto-select latest submission
  const latestSubmission = submissions.length > 0 ? submissions[0] : null;

  const handleFileSelect = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    // Validate file type
    const allowedTypes = [
      'application/pdf',
      'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      'application/vnd.ms-excel',
      'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
      'application/msword',
    ];

    if (!allowedTypes.includes(file.type)) {
      setError('Please upload a PDF, Excel, or Word document');
      return;
    }

    const maxSize = 50 * 1024 * 1024; // 50MB
    if (file.size > maxSize) {
      setError('File size exceeds 50MB limit');
      return;
    }

    setSelectedFile(file);
    setError(null);

    // Auto-select latest submission if not already selected
    if (!selectedSubmissionId && latestSubmission) {
      setSelectedSubmissionId(latestSubmission.id);
    }

    // Reset file input
    event.target.value = '';
  };

  const handleUpload = async () => {
    if (!db || !user || !selectedFile || !selectedSubmissionId) {
      setError('Missing required data');
      return;
    }

    const selectedSubmission = submissions.find((s) => s.id === selectedSubmissionId);
    if (!selectedSubmission) {
      setError('Selected submission not found');
      return;
    }

    setUploading(true);
    setUploadProgress(0);
    setError(null);

    try {
      await uploadCommentResolutionSheet(db, {
        projectId: document.projectId,
        masterDocument: document,
        submission: selectedSubmission,
        file: selectedFile,
        uploadedBy: user.uid,
        uploadedByName: user.displayName || user.email || 'Unknown',
        onProgress: setUploadProgress,
      });

      // Success
      handleClose();
      onSuccess();
    } catch (err) {
      console.error('[UploadCRSDialog] Upload error:', err);
      setError(err instanceof Error ? err.message : 'Failed to upload file');
    } finally {
      setUploading(false);
    }
  };

  const handleClose = () => {
    if (uploading) return;

    setSelectedFile(null);
    setSelectedSubmissionId('');
    setNotes('');
    setUploadProgress(0);
    setError(null);
    onClose();
  };

  const formatFileSize = (bytes: number): string => {
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  };

  return (
    <Dialog open={open} onClose={handleClose} maxWidth="sm" fullWidth>
      <DialogTitle>
        Upload Comment Resolution Sheet
        <Typography variant="body2" color="text.secondary" sx={{ mt: 0.5 }}>
          {document.documentNumber} - {document.documentTitle}
        </Typography>
      </DialogTitle>

      <DialogContent>
        <Stack spacing={3} sx={{ mt: 1 }}>
          {/* Error Alert */}
          {error && (
            <Alert severity="error" onClose={() => setError(null)}>
              {error}
            </Alert>
          )}

          {/* Info */}
          <Alert severity="info">
            Upload the Comment Resolution Sheet received from the client. You can then manually
            enter comments from this sheet into the system.
          </Alert>

          {/* Submission Selector */}
          <FormControl fullWidth>
            <InputLabel>Select Submission</InputLabel>
            <Select
              value={selectedSubmissionId}
              onChange={(e) => setSelectedSubmissionId(e.target.value)}
              label="Select Submission"
              disabled={uploading || submissions.length === 0}
            >
              {submissions.map((sub) => (
                <MenuItem key={sub.id} value={sub.id}>
                  <Stack direction="row" spacing={1} alignItems="center">
                    <Typography>{sub.revision}</Typography>
                    <Chip label={`#${sub.submissionNumber}`} size="small" variant="outlined" />
                    <Typography variant="caption" color="text.secondary">
                      {sub.commentCount} comments
                    </Typography>
                  </Stack>
                </MenuItem>
              ))}
            </Select>
          </FormControl>

          {submissions.length === 0 && (
            <Alert severity="warning">
              No submissions found for this document. Please submit the document first before
              uploading a Comment Resolution Sheet.
            </Alert>
          )}

          {/* File Upload */}
          <Box>
            <input
              accept=".pdf,.xlsx,.xls,.docx,.doc"
              style={{ display: 'none' }}
              id="crs-file-upload"
              type="file"
              onChange={handleFileSelect}
              disabled={uploading}
            />
            <label htmlFor="crs-file-upload">
              <Button
                variant="outlined"
                component="span"
                startIcon={<UploadIcon />}
                fullWidth
                disabled={uploading}
              >
                Select File
              </Button>
            </label>

            <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mt: 1 }}>
              Accepted formats: PDF, Excel (.xlsx, .xls), Word (.docx, .doc). Max 50MB.
            </Typography>
          </Box>

          {/* Selected File Preview */}
          {selectedFile && (
            <Box
              sx={{
                p: 2,
                border: 1,
                borderColor: 'primary.main',
                borderRadius: 1,
                bgcolor: 'action.hover',
              }}
            >
              <Stack direction="row" spacing={2} alignItems="center">
                <FileIcon color="primary" />
                <Box flex={1}>
                  <Typography variant="body2" fontWeight="medium">
                    {selectedFile.name}
                  </Typography>
                  <Typography variant="caption" color="text.secondary">
                    {formatFileSize(selectedFile.size)}
                  </Typography>
                </Box>
                <Button
                  size="small"
                  color="error"
                  onClick={() => setSelectedFile(null)}
                  disabled={uploading}
                >
                  Remove
                </Button>
              </Stack>
            </Box>
          )}

          {/* Upload Progress */}
          {uploading && (
            <Box>
              <LinearProgress variant="determinate" value={uploadProgress} />
              <Typography variant="caption" color="text.secondary" sx={{ mt: 0.5 }}>
                Uploading... {Math.round(uploadProgress)}%
              </Typography>
            </Box>
          )}

          {/* Optional Notes */}
          <TextField
            label="Notes (Optional)"
            multiline
            rows={2}
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            placeholder="Any notes about this comment resolution sheet..."
            disabled={uploading}
          />
        </Stack>
      </DialogContent>

      <DialogActions>
        <Button onClick={handleClose} disabled={uploading}>
          Cancel
        </Button>
        <Button
          variant="contained"
          onClick={handleUpload}
          disabled={uploading || !selectedFile || !selectedSubmissionId}
          startIcon={<UploadIcon />}
        >
          {uploading ? 'Uploading...' : 'Upload'}
        </Button>
      </DialogActions>
    </Dialog>
  );
}
