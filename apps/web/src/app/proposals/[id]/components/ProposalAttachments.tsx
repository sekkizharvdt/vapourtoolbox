'use client';

/**
 * Proposal Attachments Component
 *
 * Displays and manages attachments for a proposal.
 * Supports multi-file upload with file type selection.
 */

import { useState } from 'react';
import {
  Box,
  Typography,
  Stack,
  Paper,
  Button,
  IconButton,
  Tooltip,
  Chip,
  List,
  ListItem,
  ListItemIcon,
  ListItemText,
  ListItemSecondaryAction,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  FormControl,
  InputLabel,
  Select,
  MenuItem,
  TextField,
  LinearProgress,
  Alert,
  Link,
  Divider,
} from '@mui/material';
import {
  CloudUpload as UploadIcon,
  Delete as DeleteIcon,
  Download as DownloadIcon,
  OpenInNew as OpenIcon,
  Description as FileIcon,
  Architecture as DrawingIcon,
  Article as SpecIcon,
  TableChart as DatasheetIcon,
} from '@mui/icons-material';
import type { Proposal, ProposalAttachment, ProposalAttachmentType } from '@vapour/types';
import { PROPOSAL_ATTACHMENT_TYPE_LABELS } from '@vapour/types';
import { useFirestore } from '@/lib/firebase/hooks';
import { useAuth } from '@/contexts/AuthContext';
import {
  uploadProposalAttachment,
  removeProposalAttachment,
  detectAttachmentType,
  formatFileSize,
} from '@/lib/proposal/proposalAttachmentService';
import { formatDate } from '@/lib/utils/formatters';

interface ProposalAttachmentsProps {
  proposal: Proposal;
  onUpdate: () => void;
  readOnly?: boolean;
}

interface UploadFileData {
  file: File;
  fileType: ProposalAttachmentType;
  description: string;
}

const FILE_TYPE_ICONS: Record<ProposalAttachmentType, React.ReactNode> = {
  DRAWING: <DrawingIcon color="primary" />,
  SPECIFICATION: <SpecIcon color="info" />,
  DATASHEET: <DatasheetIcon color="success" />,
  SUPPORTING: <FileIcon color="action" />,
  OTHER: <FileIcon color="disabled" />,
};

export default function ProposalAttachments({
  proposal,
  onUpdate,
  readOnly = false,
}: ProposalAttachmentsProps) {
  const db = useFirestore();
  const { user } = useAuth();

  const [uploadDialogOpen, setUploadDialogOpen] = useState(false);
  const [selectedFiles, setSelectedFiles] = useState<UploadFileData[]>([]);
  const [uploading, setUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState<Record<number, number>>({});
  const [error, setError] = useState<string | null>(null);
  const [deleteConfirm, setDeleteConfirm] = useState<ProposalAttachment | null>(null);
  const [deleting, setDeleting] = useState(false);

  const attachments = proposal.attachments || [];

  const handleFileSelect = (event: React.ChangeEvent<HTMLInputElement>) => {
    const files = event.target.files;
    if (!files) return;

    const newFiles: UploadFileData[] = [];

    Array.from(files).forEach((file) => {
      // Validate file size (50MB max)
      if (file.size > 50 * 1024 * 1024) {
        setError(`File "${file.name}" exceeds 50MB limit`);
        return;
      }

      // Check for duplicate
      if (selectedFiles.some((f) => f.file.name === file.name)) {
        return;
      }

      newFiles.push({
        file,
        fileType: detectAttachmentType(file.name),
        description: '',
      });
    });

    setSelectedFiles((prev) => [...prev, ...newFiles]);
    setError(null);

    // Reset input
    event.target.value = '';
  };

  const handleRemoveSelectedFile = (index: number) => {
    setSelectedFiles((prev) => prev.filter((_, i) => i !== index));
  };

  const handleChangeFileType = (index: number, fileType: ProposalAttachmentType) => {
    setSelectedFiles((prev) => prev.map((f, i) => (i === index ? { ...f, fileType } : f)));
  };

  const handleChangeDescription = (index: number, description: string) => {
    setSelectedFiles((prev) => prev.map((f, i) => (i === index ? { ...f, description } : f)));
  };

  const handleUpload = async () => {
    if (!db || !user || selectedFiles.length === 0) return;

    setUploading(true);
    setUploadProgress({});
    setError(null);

    try {
      for (let i = 0; i < selectedFiles.length; i++) {
        const { file, fileType, description } = selectedFiles[i]!;

        await uploadProposalAttachment(db, {
          proposalId: proposal.id,
          entityId: proposal.entityId,
          file,
          fileType,
          description: description || undefined,
          uploadedBy: user.uid,
          uploadedByName: user.displayName || user.email || 'Unknown',
          onProgress: (progress) => {
            setUploadProgress((prev) => ({ ...prev, [i]: progress }));
          },
        });
      }

      // Success
      setUploadDialogOpen(false);
      setSelectedFiles([]);
      onUpdate();
    } catch (err) {
      console.error('[ProposalAttachments] Upload error:', err);
      setError(err instanceof Error ? err.message : 'Failed to upload files');
    } finally {
      setUploading(false);
    }
  };

  const handleDelete = async () => {
    if (!db || !deleteConfirm) return;

    setDeleting(true);
    setError(null);

    try {
      await removeProposalAttachment(db, proposal.id, deleteConfirm);
      setDeleteConfirm(null);
      onUpdate();
    } catch (err) {
      console.error('[ProposalAttachments] Delete error:', err);
      setError(err instanceof Error ? err.message : 'Failed to delete attachment');
    } finally {
      setDeleting(false);
    }
  };

  const handleCloseUploadDialog = () => {
    if (!uploading) {
      setUploadDialogOpen(false);
      setSelectedFiles([]);
      setError(null);
    }
  };

  return (
    <Paper variant="outlined" sx={{ p: 2 }}>
      <Stack spacing={2}>
        <Stack direction="row" justifyContent="space-between" alignItems="center">
          <Typography variant="subtitle1" fontWeight="medium">
            Attachments ({attachments.length})
          </Typography>
          {!readOnly && (
            <Button
              variant="outlined"
              size="small"
              startIcon={<UploadIcon />}
              onClick={() => setUploadDialogOpen(true)}
            >
              Add Files
            </Button>
          )}
        </Stack>

        {error && (
          <Alert severity="error" onClose={() => setError(null)}>
            {error}
          </Alert>
        )}

        {attachments.length === 0 ? (
          <Typography variant="body2" color="text.secondary" sx={{ py: 2, textAlign: 'center' }}>
            No attachments yet.
            {!readOnly &&
              ' Click "Add Files" to upload drawings, specifications, or other documents.'}
          </Typography>
        ) : (
          <List dense>
            {attachments.map((attachment) => (
              <ListItem
                key={attachment.id}
                sx={{
                  border: 1,
                  borderColor: 'divider',
                  borderRadius: 1,
                  mb: 1,
                  '&:hover': { bgcolor: 'action.hover' },
                }}
              >
                <ListItemIcon sx={{ minWidth: 40 }}>
                  {FILE_TYPE_ICONS[attachment.fileType]}
                </ListItemIcon>
                <ListItemText
                  primary={
                    <Stack direction="row" spacing={1} alignItems="center">
                      <Typography variant="body2" noWrap sx={{ maxWidth: 250 }}>
                        {attachment.fileName}
                      </Typography>
                      <Chip
                        label={PROPOSAL_ATTACHMENT_TYPE_LABELS[attachment.fileType]}
                        size="small"
                        variant="outlined"
                      />
                    </Stack>
                  }
                  secondary={
                    <Stack direction="row" spacing={2} sx={{ mt: 0.5 }}>
                      <Typography variant="caption" color="text.secondary">
                        {formatFileSize(attachment.fileSize)}
                      </Typography>
                      <Typography variant="caption" color="text.secondary">
                        {attachment.uploadedByName}
                      </Typography>
                      <Typography variant="caption" color="text.secondary">
                        {formatDate(attachment.uploadedAt)}
                      </Typography>
                    </Stack>
                  }
                />
                <ListItemSecondaryAction>
                  <Stack direction="row" spacing={0.5}>
                    <Tooltip title="Open">
                      <IconButton
                        size="small"
                        component={Link}
                        href={attachment.fileUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                      >
                        <OpenIcon fontSize="small" />
                      </IconButton>
                    </Tooltip>
                    <Tooltip title="Download">
                      <IconButton
                        size="small"
                        component="a"
                        href={attachment.fileUrl}
                        download={attachment.fileName}
                      >
                        <DownloadIcon fontSize="small" />
                      </IconButton>
                    </Tooltip>
                    {!readOnly && (
                      <Tooltip title="Delete">
                        <IconButton
                          size="small"
                          color="error"
                          onClick={() => setDeleteConfirm(attachment)}
                        >
                          <DeleteIcon fontSize="small" />
                        </IconButton>
                      </Tooltip>
                    )}
                  </Stack>
                </ListItemSecondaryAction>
              </ListItem>
            ))}
          </List>
        )}
      </Stack>

      {/* Upload Dialog */}
      <Dialog open={uploadDialogOpen} onClose={handleCloseUploadDialog} maxWidth="sm" fullWidth>
        <DialogTitle>Upload Attachments</DialogTitle>
        <DialogContent>
          <Stack spacing={3} sx={{ mt: 1 }}>
            {/* File Input */}
            <Box>
              <input
                accept=".pdf,.doc,.docx,.dwg,.dxf,.xlsx,.xls,.jpg,.jpeg,.png,.zip"
                style={{ display: 'none' }}
                id="proposal-attachment-upload"
                type="file"
                multiple
                onChange={handleFileSelect}
                disabled={uploading}
              />
              <label htmlFor="proposal-attachment-upload">
                <Button
                  variant="outlined"
                  component="span"
                  startIcon={<UploadIcon />}
                  fullWidth
                  disabled={uploading}
                >
                  Select Files
                </Button>
              </label>
              <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mt: 1 }}>
                Accepted: PDF, Word, Excel, CAD files (DWG, DXF), Images. Max 50MB per file.
              </Typography>
            </Box>

            {/* Selected Files List */}
            {selectedFiles.length > 0 && (
              <Box sx={{ border: 1, borderColor: 'divider', borderRadius: 1 }}>
                <List dense>
                  {selectedFiles.map((fileData, index) => (
                    <Box key={index}>
                      <ListItem>
                        <ListItemIcon sx={{ minWidth: 40 }}>
                          {FILE_TYPE_ICONS[fileData.fileType]}
                        </ListItemIcon>
                        <ListItemText
                          primary={
                            <Typography variant="body2" noWrap>
                              {fileData.file.name}
                            </Typography>
                          }
                          secondary={formatFileSize(fileData.file.size)}
                        />
                        {!uploading && (
                          <IconButton size="small" onClick={() => handleRemoveSelectedFile(index)}>
                            <DeleteIcon fontSize="small" />
                          </IconButton>
                        )}
                      </ListItem>

                      <Box sx={{ px: 2, pb: 1 }}>
                        <Stack direction="row" spacing={2}>
                          <FormControl size="small" sx={{ minWidth: 140 }}>
                            <InputLabel>Type</InputLabel>
                            <Select
                              value={fileData.fileType}
                              onChange={(e) =>
                                handleChangeFileType(
                                  index,
                                  e.target.value as ProposalAttachmentType
                                )
                              }
                              label="Type"
                              disabled={uploading}
                            >
                              {Object.entries(PROPOSAL_ATTACHMENT_TYPE_LABELS).map(
                                ([value, label]) => (
                                  <MenuItem key={value} value={value}>
                                    {label}
                                  </MenuItem>
                                )
                              )}
                            </Select>
                          </FormControl>
                          <TextField
                            size="small"
                            placeholder="Description (optional)"
                            value={fileData.description}
                            onChange={(e) => handleChangeDescription(index, e.target.value)}
                            disabled={uploading}
                            sx={{ flex: 1 }}
                          />
                        </Stack>
                      </Box>

                      {uploading && uploadProgress[index] !== undefined && (
                        <Box sx={{ px: 2, pb: 1 }}>
                          <LinearProgress variant="determinate" value={uploadProgress[index]} />
                        </Box>
                      )}

                      {index < selectedFiles.length - 1 && <Divider />}
                    </Box>
                  ))}
                </List>
              </Box>
            )}

            {error && <Alert severity="error">{error}</Alert>}
          </Stack>
        </DialogContent>
        <DialogActions>
          <Button onClick={handleCloseUploadDialog} disabled={uploading}>
            Cancel
          </Button>
          <Button
            variant="contained"
            onClick={handleUpload}
            disabled={uploading || selectedFiles.length === 0}
            startIcon={uploading ? null : <UploadIcon />}
          >
            {uploading
              ? 'Uploading...'
              : `Upload ${selectedFiles.length} File${selectedFiles.length !== 1 ? 's' : ''}`}
          </Button>
        </DialogActions>
      </Dialog>

      {/* Delete Confirmation Dialog */}
      <Dialog open={!!deleteConfirm} onClose={() => setDeleteConfirm(null)}>
        <DialogTitle>Delete Attachment?</DialogTitle>
        <DialogContent>
          <Typography>
            Are you sure you want to delete &quot;{deleteConfirm?.fileName}&quot;? This action
            cannot be undone.
          </Typography>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setDeleteConfirm(null)} disabled={deleting}>
            Cancel
          </Button>
          <Button variant="contained" color="error" onClick={handleDelete} disabled={deleting}>
            {deleting ? 'Deleting...' : 'Delete'}
          </Button>
        </DialogActions>
      </Dialog>
    </Paper>
  );
}
