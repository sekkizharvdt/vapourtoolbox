'use client';

/**
 * Submit Document Dialog
 *
 * Dialog for submitting a new document revision to the client
 * - Multi-file upload (Native + PDF + Supporting)
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
  IconButton,
  List,
  ListItem,
  ListItemIcon,
  ListItemText,
  ListItemSecondaryAction,
  FormControl,
  Select,
  MenuItem,
} from '@mui/material';
import {
  CloudUpload as UploadIcon,
  Delete as DeleteIcon,
  PictureAsPdf as PdfIcon,
  InsertDriveFile as FileIcon,
  Description as NativeIcon,
} from '@mui/icons-material';
import type { MasterDocumentEntry, SubmissionFileType } from '@vapour/types';
import { ApproverSelector } from '@/components/common/forms/ApproverSelector';

interface SubmitDocumentDialogProps {
  open: boolean;
  onClose: () => void;
  document: MasterDocumentEntry;
  onSubmit: (data: SubmissionData) => Promise<void>;
}

export interface SubmissionFileData {
  file: File;
  fileType: SubmissionFileType;
  isPrimary: boolean;
}

export interface SubmissionData {
  files: SubmissionFileData[];
  revision: string;
  submissionNotes: string;
  clientVisible: boolean;
  reviewerId?: string;
}

const FILE_TYPE_LABELS: Record<SubmissionFileType, string> = {
  NATIVE: 'Native (Editable)',
  PDF: 'PDF',
  SUPPORTING: 'Supporting',
};

const FILE_TYPE_ICONS: Record<SubmissionFileType, React.ReactNode> = {
  NATIVE: <NativeIcon color="primary" />,
  PDF: <PdfIcon color="error" />,
  SUPPORTING: <FileIcon color="action" />,
};

export default function SubmitDocumentDialog({
  open,
  onClose,
  document,
  onSubmit,
}: SubmitDocumentDialogProps) {
  const [selectedFiles, setSelectedFiles] = useState<SubmissionFileData[]>([]);
  const [submissionNotes, setSubmissionNotes] = useState('');
  const [clientVisible, setClientVisible] = useState(true);
  const [reviewerId, setReviewerId] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Calculate next revision
  // First submission should be R0 (when submissionCount is 0)
  // Subsequent submissions increment from current revision
  const getNextRevision = (): string => {
    // If no submissions yet, first submission is R0
    if (document.submissionCount === 0) {
      return 'R0';
    }
    // Otherwise increment from current revision
    const current = document.currentRevision || 'R0';
    const match = current.match(/R(\d+)/);
    if (match && match[1]) {
      const num = parseInt(match[1], 10);
      return `R${num + 1}`;
    }
    return 'R1';
  };

  const nextRevision = getNextRevision();

  const detectFileType = (file: File): SubmissionFileType => {
    const ext = file.name.split('.').pop()?.toLowerCase();
    if (ext === 'pdf') return 'PDF';
    if (['dwg', 'dxf', 'doc', 'docx', 'xls', 'xlsx', 'ppt', 'pptx'].includes(ext || '')) {
      return 'NATIVE';
    }
    return 'SUPPORTING';
  };

  const handleFileSelect = (event: React.ChangeEvent<HTMLInputElement>) => {
    const files = event.target.files;
    if (!files) return;

    const newFiles: SubmissionFileData[] = [];
    let hasError = false;

    Array.from(files).forEach((file) => {
      // Validate file size (50MB max)
      if (file.size > 50 * 1024 * 1024) {
        setError(`File "${file.name}" exceeds 50MB limit`);
        hasError = true;
        return;
      }

      // Check for duplicate
      if (selectedFiles.some((f) => f.file.name === file.name)) {
        return; // Skip duplicates
      }

      const fileType = detectFileType(file);
      const isPrimary = fileType === 'PDF' && !selectedFiles.some((f) => f.isPrimary);

      newFiles.push({
        file,
        fileType,
        isPrimary,
      });
    });

    if (!hasError) {
      setError(null);
      setSelectedFiles((prev) => [...prev, ...newFiles]);
    }

    // Reset input
    event.target.value = '';
  };

  const handleRemoveFile = (index: number) => {
    setSelectedFiles((prev) => {
      const newFiles = [...prev];
      const removed = newFiles.splice(index, 1)[0];

      // If we removed the primary file, set a new primary
      if (removed?.isPrimary && newFiles.length > 0) {
        const pdfFile = newFiles.find((f) => f.fileType === 'PDF');
        if (pdfFile) {
          pdfFile.isPrimary = true;
        } else if (newFiles[0]) {
          newFiles[0].isPrimary = true;
        }
      }

      return newFiles;
    });
  };

  const handleSetPrimary = (index: number) => {
    setSelectedFiles((prev) =>
      prev.map((f, i) => ({
        ...f,
        isPrimary: i === index,
      }))
    );
  };

  const handleChangeFileType = (index: number, fileType: SubmissionFileType) => {
    setSelectedFiles((prev) => prev.map((f, i) => (i === index ? { ...f, fileType } : f)));
  };

  const handleSubmit = async () => {
    if (selectedFiles.length === 0) {
      setError('Please select at least one file to upload');
      return;
    }

    // Ensure there's a primary file
    if (!selectedFiles.some((f) => f.isPrimary)) {
      setError('Please mark one file as the primary file');
      return;
    }

    setSubmitting(true);
    setError(null);

    try {
      await onSubmit({
        files: selectedFiles,
        revision: nextRevision,
        submissionNotes,
        clientVisible,
        reviewerId: reviewerId || undefined,
      });

      // Reset form
      setSelectedFiles([]);
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
      setSelectedFiles([]);
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
              <Chip label={document.currentRevision || 'None'} size="small" />
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
              accept=".pdf,.doc,.docx,.dwg,.dxf,.xlsx,.xls,.ppt,.pptx,.jpg,.jpeg,.png,.zip"
              style={{ display: 'none' }}
              id="document-file-upload"
              type="file"
              multiple
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
                Add Files
              </Button>
            </label>

            <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mt: 1 }}>
              Upload native file (DWG, DOCX, etc.) and/or PDF. Max 50MB per file.
            </Typography>
          </Box>

          {/* Selected Files List */}
          {selectedFiles.length > 0 && (
            <Box sx={{ border: 1, borderColor: 'divider', borderRadius: 1 }}>
              <List dense>
                {selectedFiles.map((fileData, index) => (
                  <ListItem
                    key={index}
                    sx={{
                      bgcolor: fileData.isPrimary ? 'action.selected' : 'transparent',
                    }}
                  >
                    <ListItemIcon sx={{ minWidth: 40 }}>
                      {FILE_TYPE_ICONS[fileData.fileType]}
                    </ListItemIcon>
                    <ListItemText
                      primary={
                        <Stack direction="row" spacing={1} alignItems="center">
                          <Typography variant="body2" noWrap sx={{ maxWidth: 200 }}>
                            {fileData.file.name}
                          </Typography>
                          {fileData.isPrimary && (
                            <Chip label="Primary" size="small" color="primary" />
                          )}
                        </Stack>
                      }
                      secondary={formatFileSize(fileData.file.size)}
                    />
                    <ListItemSecondaryAction>
                      <Stack direction="row" spacing={1} alignItems="center">
                        <FormControl size="small" sx={{ minWidth: 100 }}>
                          <Select
                            value={fileData.fileType}
                            onChange={(e) =>
                              handleChangeFileType(index, e.target.value as SubmissionFileType)
                            }
                            size="small"
                            disabled={submitting}
                          >
                            <MenuItem value="NATIVE">{FILE_TYPE_LABELS.NATIVE}</MenuItem>
                            <MenuItem value="PDF">{FILE_TYPE_LABELS.PDF}</MenuItem>
                            <MenuItem value="SUPPORTING">{FILE_TYPE_LABELS.SUPPORTING}</MenuItem>
                          </Select>
                        </FormControl>
                        {!fileData.isPrimary && (
                          <Button
                            size="small"
                            onClick={() => handleSetPrimary(index)}
                            disabled={submitting}
                          >
                            Set Primary
                          </Button>
                        )}
                        <IconButton
                          size="small"
                          onClick={() => handleRemoveFile(index)}
                          disabled={submitting}
                        >
                          <DeleteIcon fontSize="small" />
                        </IconButton>
                      </Stack>
                    </ListItemSecondaryAction>
                  </ListItem>
                ))}
              </List>
            </Box>
          )}

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
                Uploading {selectedFiles.length} file{selectedFiles.length > 1 ? 's' : ''}...
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
        <Button
          onClick={handleSubmit}
          variant="contained"
          disabled={selectedFiles.length === 0 || submitting}
        >
          {submitting ? 'Submitting...' : 'Submit'}
        </Button>
      </DialogActions>
    </Dialog>
  );
}
