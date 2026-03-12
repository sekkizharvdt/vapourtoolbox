'use client';

/**
 * Submit Revision Dialog
 *
 * Allows users to upload a new document revision with multiple files
 * (native, PDF, and supporting documents). Opened from the DocumentRevisions tab.
 */

import { useState, useCallback } from 'react';
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
  Chip,
  Autocomplete,
} from '@mui/material';
import {
  CloudUpload as UploadIcon,
  Close as CloseIcon,
  AttachFile as AttachIcon,
} from '@mui/icons-material';
import type { MasterDocumentEntry, ProjectMember } from '@vapour/types';
import { submitDocument, type SubmissionFileData } from '@/lib/documents/submissionService';
import { getFirebase } from '@/lib/firebase';
import { useAuth } from '@/contexts/AuthContext';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface SubmitRevisionDialogProps {
  open: boolean;
  onClose: () => void;
  document: MasterDocumentEntry;
  onSuccess: () => void;
  teamMembers?: ProjectMember[];
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/**
 * Calculate the next revision string from the current one.
 * "R0" -> "R1", "R1" -> "R2", etc.
 */
function getNextRevision(current: string): string {
  const match = current.match(/R(\d+)/);
  if (!match) return 'R1';
  return `R${parseInt(match[1] ?? '0', 10) + 1}`;
}

/**
 * Format bytes into a human-readable string.
 */
function formatFileSize(bytes: number): string {
  if (bytes === 0) return '0 B';
  const units = ['B', 'KB', 'MB', 'GB'];
  const i = Math.min(Math.floor(Math.log(bytes) / Math.log(1024)), units.length - 1);
  const size = bytes / Math.pow(1024, i);
  return `${size.toFixed(i === 0 ? 0 : 1)} ${units[i] ?? 'GB'}`;
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export default function SubmitRevisionDialog({
  open,
  onClose,
  document: masterDocument,
  onSuccess,
  teamMembers = [],
}: SubmitRevisionDialogProps) {
  const { db, storage } = getFirebase();
  const { user } = useAuth();

  // Form state
  const [revision, setRevision] = useState(() => getNextRevision(masterDocument.currentRevision));
  const [nativeFiles, setNativeFiles] = useState<File[]>([]);
  const [pdfFiles, setPdfFiles] = useState<File[]>([]);
  const [supportingFiles, setSupportingFiles] = useState<File[]>([]);
  const [submissionNotes, setSubmissionNotes] = useState('');
  const [selectedSubmitter, setSelectedSubmitter] = useState<ProjectMember | null>(null);

  // UI state
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [uploadedCount, setUploadedCount] = useState(0);

  const totalFiles = nativeFiles.length + pdfFiles.length + supportingFiles.length;
  const canSubmit = totalFiles > 0 && revision.trim() !== '' && !uploading;

  // Reset form when dialog re-opens with a potentially different document
  const handleEnter = useCallback(() => {
    setRevision(getNextRevision(masterDocument.currentRevision));
    setNativeFiles([]);
    setPdfFiles([]);
    setSupportingFiles([]);
    setSubmissionNotes('');
    setSelectedSubmitter(null);
    setError(null);
    setUploadedCount(0);
    setUploading(false);
  }, [masterDocument.currentRevision]);

  // ------ File selection handlers ------

  const handleNativeFilesChange = useCallback((event: React.ChangeEvent<HTMLInputElement>) => {
    const selected = event.target.files;
    if (selected) {
      setNativeFiles((prev) => [...prev, ...Array.from(selected)]);
    }
    // Reset the input so re-selecting the same file works
    event.target.value = '';
  }, []);

  const handlePdfFilesChange = useCallback((event: React.ChangeEvent<HTMLInputElement>) => {
    const selected = event.target.files;
    if (selected) {
      setPdfFiles((prev) => [...prev, ...Array.from(selected)]);
    }
    event.target.value = '';
  }, []);

  const handleSupportingFilesChange = useCallback((event: React.ChangeEvent<HTMLInputElement>) => {
    const selected = event.target.files;
    if (selected) {
      setSupportingFiles((prev) => [...prev, ...Array.from(selected)]);
    }
    event.target.value = '';
  }, []);

  const removeNativeFile = useCallback((index: number) => {
    setNativeFiles((prev) => prev.filter((_, i) => i !== index));
  }, []);

  const removePdfFile = useCallback((index: number) => {
    setPdfFiles((prev) => prev.filter((_, i) => i !== index));
  }, []);

  const removeSupportingFile = useCallback((index: number) => {
    setSupportingFiles((prev) => prev.filter((_, i) => i !== index));
  }, []);

  // ------ Submit handler ------

  const handleSubmit = async () => {
    if (!db || !storage || !user) return;

    setUploading(true);
    setError(null);
    setUploadedCount(0);

    try {
      // Build SubmissionFileData array
      const files: SubmissionFileData[] = [];

      // Determine which file gets isPrimary — first native file, or first PDF if no native
      const hasPrimaryNative = nativeFiles.length > 0;

      nativeFiles.forEach((file, index) => {
        files.push({
          file,
          fileType: 'NATIVE',
          isPrimary: hasPrimaryNative && index === 0,
        });
      });

      pdfFiles.forEach((file, index) => {
        files.push({
          file,
          fileType: 'PDF',
          isPrimary: !hasPrimaryNative && index === 0,
        });
      });

      supportingFiles.forEach((file) => {
        files.push({
          file,
          fileType: 'SUPPORTING',
          isPrimary: false,
        });
      });

      await submitDocument(db, storage, {
        projectId: masterDocument.projectId,
        masterDocumentId: masterDocument.id,
        masterDocument,
        files,
        revision: revision.trim(),
        submissionNotes: submissionNotes.trim() || undefined,
        clientVisible: masterDocument.visibility === 'CLIENT_VISIBLE',
        submittedBy: selectedSubmitter?.userId || user.uid,
        submittedByName: selectedSubmitter?.userName || user.displayName || 'Unknown',
      });

      setUploadedCount(files.length);
      onSuccess();
      onClose();
    } catch (err) {
      const message =
        err instanceof Error ? err.message : 'An unexpected error occurred during submission.';
      setError(message);
    } finally {
      setUploading(false);
    }
  };

  // ------ Render helpers ------

  const renderFileSection = (
    label: string,
    files: File[],
    onRemove: (index: number) => void,
    inputId: string,
    onChange: (e: React.ChangeEvent<HTMLInputElement>) => void,
    accept?: string
  ) => (
    <Box>
      <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', mb: 1 }}>
        <Typography variant="subtitle2" color="text.secondary">
          {label}
        </Typography>
        <Button
          size="small"
          variant="outlined"
          component="label"
          startIcon={<AttachIcon />}
          disabled={uploading}
        >
          Add Files
          <input
            id={inputId}
            type="file"
            hidden
            multiple
            onChange={onChange}
            {...(accept ? { accept } : {})}
          />
        </Button>
      </Box>
      {files.length > 0 ? (
        <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 1 }}>
          {files.map((file, index) => (
            <Chip
              key={`${file.name}-${index}`}
              label={`${file.name} (${formatFileSize(file.size)})`}
              onDelete={uploading ? undefined : () => onRemove(index)}
              deleteIcon={<CloseIcon fontSize="small" />}
              variant="outlined"
              size="small"
              sx={{ maxWidth: 320 }}
            />
          ))}
        </Box>
      ) : (
        <Typography variant="body2" color="text.disabled" sx={{ fontStyle: 'italic' }}>
          No files selected
        </Typography>
      )}
    </Box>
  );

  return (
    <Dialog
      open={open}
      onClose={uploading ? undefined : onClose}
      maxWidth="md"
      fullWidth
      TransitionProps={{ onEnter: handleEnter }}
    >
      <DialogTitle>Submit New Revision &mdash; {masterDocument.documentNumber}</DialogTitle>

      <DialogContent>
        <Stack spacing={3} sx={{ mt: 1 }}>
          {/* Revision field */}
          <TextField
            label="Revision"
            value={revision}
            onChange={(e) => setRevision(e.target.value)}
            size="small"
            fullWidth
            disabled={uploading}
            helperText={`Current revision: ${masterDocument.currentRevision}`}
          />

          {/* Submitter */}
          {teamMembers.length > 0 && (
            <Autocomplete
              options={teamMembers.filter((m) => m.isActive)}
              getOptionLabel={(option) => option.userName}
              value={selectedSubmitter}
              onChange={(_e, value) => setSelectedSubmitter(value)}
              isOptionEqualToValue={(option, value) => option.userId === value.userId}
              renderInput={(params) => (
                <TextField
                  {...params}
                  label="Submitted By"
                  size="small"
                  placeholder={user?.displayName || 'Select team member'}
                  helperText="Select the person who prepared this revision"
                />
              )}
              disabled={uploading}
            />
          )}

          {/* File upload sections */}
          {renderFileSection(
            'Native Files (DWG, XLSX, DOCX, etc.)',
            nativeFiles,
            removeNativeFile,
            'native-file-input',
            handleNativeFilesChange
          )}

          {renderFileSection(
            'PDF Files',
            pdfFiles,
            removePdfFile,
            'pdf-file-input',
            handlePdfFilesChange,
            '.pdf'
          )}

          {renderFileSection(
            'Supporting Documents',
            supportingFiles,
            removeSupportingFile,
            'supporting-file-input',
            handleSupportingFilesChange
          )}

          {/* Submission notes */}
          <TextField
            label="Submission Notes"
            value={submissionNotes}
            onChange={(e) => setSubmissionNotes(e.target.value)}
            multiline
            rows={3}
            fullWidth
            disabled={uploading}
            placeholder="Optional notes about this revision..."
          />

          {/* Reviewer note */}
          <Typography variant="body2" color="text.secondary">
            Internal reviewer will be notified (reviewer selection coming soon).
          </Typography>

          {/* Upload progress */}
          {uploading && (
            <Box>
              <Box
                sx={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  mb: 0.5,
                }}
              >
                <Typography variant="body2" color="text.secondary">
                  Uploading {totalFiles} file{totalFiles !== 1 ? 's' : ''}...
                </Typography>
                <Typography variant="body2" color="text.secondary">
                  {uploadedCount} / {totalFiles}
                </Typography>
              </Box>
              <LinearProgress />
            </Box>
          )}

          {/* Error display */}
          {error && (
            <Alert severity="error" onClose={() => setError(null)}>
              {error}
            </Alert>
          )}
        </Stack>
      </DialogContent>

      <DialogActions>
        <Button onClick={onClose} disabled={uploading}>
          Cancel
        </Button>
        <Button
          onClick={handleSubmit}
          variant="contained"
          disabled={!canSubmit}
          startIcon={<UploadIcon />}
        >
          {uploading ? 'Submitting...' : 'Submit Revision'}
        </Button>
      </DialogActions>
    </Dialog>
  );
}
