'use client';

/**
 * Document Upload Widget
 *
 * Reusable component for uploading documents to Firebase Storage
 * Links documents to procurement entities (PR, RFQ, PO, etc.)
 */

import { useState } from 'react';
import {
  Box,
  Paper,
  Typography,
  Button,
  Stack,
  IconButton,
  LinearProgress,
  Alert,
  Chip,
  List,
  ListItem,
  ListItemText,
  ListItemSecondaryAction,
} from '@mui/material';
import {
  CloudUpload as CloudUploadIcon,
  Description as DescriptionIcon,
  Delete as DeleteIcon,
  GetApp as GetAppIcon,
} from '@mui/icons-material';
import { formatDate } from '@/lib/utils/formatters';

interface UploadedDocument {
  id: string;
  fileName: string;
  fileUrl: string;
  fileSize: number;
  uploadedAt: Date;
}

interface DocumentUploadWidgetProps {
  documents: UploadedDocument[];
  onUpload: (file: File) => Promise<void>;
  onDelete: (documentId: string) => Promise<void>;
  onDownload?: (document: UploadedDocument) => void;
  maxFiles?: number;
  maxFileSizeMB?: number;
  acceptedTypes?: string[];
  disabled?: boolean;
}

export default function DocumentUploadWidget({
  documents,
  onUpload,
  onDelete,
  onDownload,
  maxFiles = 10,
  maxFileSizeMB = 25,
  acceptedTypes = ['.pdf', '.jpg', '.jpeg', '.png', '.xlsx', '.xls', '.doc', '.docx', '.dwg'],
  disabled = false,
}: DocumentUploadWidgetProps) {
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [uploadProgress, setUploadProgress] = useState(0);

  const handleFileSelect = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const selectedFile = event.target.files?.[0];
    if (!selectedFile) return;

    setError(null);

    // Validate file count
    if (documents.length >= maxFiles) {
      setError(`Maximum ${maxFiles} files allowed`);
      return;
    }

    // Validate file size
    const fileSizeMB = selectedFile.size / (1024 * 1024);
    if (fileSizeMB > maxFileSizeMB) {
      setError(`File size exceeds ${maxFileSizeMB}MB limit`);
      return;
    }

    // Validate file type
    const fileExtension = '.' + selectedFile.name.split('.').pop()?.toLowerCase();
    if (!acceptedTypes.includes(fileExtension)) {
      setError(`File type ${fileExtension} not supported. Accepted: ${acceptedTypes.join(', ')}`);
      return;
    }

    // Upload file
    setUploading(true);
    setUploadProgress(0);

    try {
      // Simulate progress (TODO: implement real progress tracking with Firebase)
      const progressInterval = setInterval(() => {
        setUploadProgress((prev) => Math.min(prev + 10, 90));
      }, 200);

      await onUpload(selectedFile);

      clearInterval(progressInterval);
      setUploadProgress(100);

      // Reset after 1 second
      setTimeout(() => {
        setUploadProgress(0);
      }, 1000);
    } catch (err) {
      console.error('[DocumentUploadWidget] Upload error:', err);
      setError(err instanceof Error ? err.message : 'Failed to upload file');
    } finally {
      setUploading(false);
    }

    // Reset input
    event.target.value = '';
  };

  const handleDelete = async (documentId: string) => {
    try {
      await onDelete(documentId);
    } catch (err) {
      console.error('[DocumentUploadWidget] Delete error:', err);
      setError(err instanceof Error ? err.message : 'Failed to delete file');
    }
  };

  const formatFileSize = (bytes: number): string => {
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(2)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(2)} MB`;
  };

  return (
    <Paper sx={{ p: 3 }}>
      <Stack spacing={2}>
        {/* Header */}
        <Stack direction="row" justifyContent="space-between" alignItems="center">
          <Typography variant="subtitle1" fontWeight={600}>
            Documents ({documents.length}/{maxFiles})
          </Typography>
          {!disabled && documents.length < maxFiles && (
            <Button
              component="label"
              variant="outlined"
              startIcon={<CloudUploadIcon />}
              disabled={uploading}
              size="small"
            >
              Upload
              <input
                type="file"
                hidden
                accept={acceptedTypes.join(',')}
                onChange={handleFileSelect}
              />
            </Button>
          )}
        </Stack>

        {/* Upload Progress */}
        {uploading && (
          <Box>
            <Typography variant="body2" color="text.secondary" gutterBottom>
              Uploading... {uploadProgress}%
            </Typography>
            <LinearProgress variant="determinate" value={uploadProgress} />
          </Box>
        )}

        {/* Error */}
        {error && (
          <Alert severity="error" onClose={() => setError(null)}>
            {error}
          </Alert>
        )}

        {/* File List */}
        {documents.length > 0 ? (
          <List dense>
            {documents.map((doc) => (
              <ListItem
                key={doc.id}
                sx={{
                  border: 1,
                  borderColor: 'divider',
                  borderRadius: 1,
                  mb: 1,
                }}
              >
                <DescriptionIcon sx={{ mr: 2, color: 'text.secondary' }} />
                <ListItemText
                  primary={doc.fileName}
                  secondary={
                    <Stack direction="row" spacing={1} sx={{ mt: 0.5 }}>
                      <Chip label={formatFileSize(doc.fileSize)} size="small" />
                      <Chip label={formatDate(doc.uploadedAt)} size="small" variant="outlined" />
                    </Stack>
                  }
                />
                <ListItemSecondaryAction>
                  <Stack direction="row" spacing={1}>
                    {onDownload && (
                      <IconButton size="small" onClick={() => onDownload(doc)} title="Download">
                        <GetAppIcon fontSize="small" />
                      </IconButton>
                    )}
                    {!disabled && (
                      <IconButton
                        size="small"
                        onClick={() => handleDelete(doc.id)}
                        title="Delete"
                        color="error"
                      >
                        <DeleteIcon fontSize="small" />
                      </IconButton>
                    )}
                  </Stack>
                </ListItemSecondaryAction>
              </ListItem>
            ))}
          </List>
        ) : (
          <Box sx={{ textAlign: 'center', py: 3 }}>
            <DescriptionIcon sx={{ fontSize: 48, color: 'text.secondary', mb: 1 }} />
            <Typography variant="body2" color="text.secondary">
              No documents uploaded yet
            </Typography>
            <Typography variant="caption" color="text.secondary">
              Accepted formats: {acceptedTypes.join(', ')}
            </Typography>
          </Box>
        )}

        {/* Info */}
        <Alert severity="info">
          <Typography variant="caption">
            Max file size: {maxFileSizeMB}MB • Max files: {maxFiles}
          </Typography>
        </Alert>
      </Stack>
    </Paper>
  );
}
