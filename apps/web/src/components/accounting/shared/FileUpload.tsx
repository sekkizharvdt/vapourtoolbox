'use client';

import React, { useState, useRef } from 'react';
import {
  Box,
  Button,
  List,
  ListItem,
  ListItemText,
  ListItemSecondaryAction,
  IconButton,
  Typography,
  LinearProgress,
  Alert,
  Chip,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
} from '@mui/material';
import {
  CloudUpload as UploadIcon,
  Delete as DeleteIcon,
  Download as DownloadIcon,
  InsertDriveFile as FileIcon,
  Visibility as PreviewIcon,
} from '@mui/icons-material';
import { ref, uploadBytesResumable, getDownloadURL, deleteObject } from 'firebase/storage';
import { getFirebase } from '@/lib/firebase';

export interface FileAttachment {
  id: string;
  name: string;
  url: string;
  size: number;
  type: string;
  uploadedAt: Date;
  uploadedBy?: string;
}

interface FileUploadProps {
  /**
   * Current attachments
   */
  attachments: FileAttachment[];
  /**
   * Callback when attachments change
   */
  onChange: (attachments: FileAttachment[]) => void;
  /**
   * Storage path prefix (e.g., 'invoices/INV-9735/')
   */
  storagePath: string;
  /**
   * Maximum file size in MB
   */
  maxSizeMB?: number;
  /**
   * Allowed file types
   */
  acceptedTypes?: string[];
  /**
   * Whether upload is disabled (view-only mode)
   */
  disabled?: boolean;
  /**
   * Maximum number of files
   */
  maxFiles?: number;
}

const DEFAULT_ACCEPTED_TYPES = [
  'application/pdf',
  'image/jpeg',
  'image/png',
  'image/jpg',
  'application/msword',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  'application/vnd.ms-excel',
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
];

export function FileUpload({
  attachments,
  onChange,
  storagePath,
  maxSizeMB = 10,
  acceptedTypes = DEFAULT_ACCEPTED_TYPES,
  disabled = false,
  maxFiles = 5,
}: FileUploadProps) {
  const [uploading, setUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const [previewFile, setPreviewFile] = useState<FileAttachment | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const formatFileSize = (bytes: number): string => {
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  };

  const getFileExtension = (filename: string): string => {
    const parts = filename.split('.');
    const lastPart = parts[parts.length - 1];
    return parts.length > 1 && lastPart ? lastPart.toUpperCase() : 'FILE';
  };

  const handleFileSelect = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const files = event.target.files;
    if (!files || files.length === 0) return;

    setError(null);

    // Check max files limit
    if (attachments.length + files.length > maxFiles) {
      setError(`Maximum ${maxFiles} files allowed`);
      return;
    }

    const file = files[0]; // For now, handle one file at a time
    if (!file) return;

    // Validate file type
    if (!acceptedTypes.includes(file.type)) {
      setError(`File type not allowed. Accepted types: ${acceptedTypes.join(', ')}`);
      return;
    }

    // Validate file size
    const maxBytes = maxSizeMB * 1024 * 1024;
    if (file.size > maxBytes) {
      setError(`File size exceeds ${maxSizeMB}MB limit`);
      return;
    }

    try {
      setUploading(true);
      setUploadProgress(0);

      const { storage } = getFirebase();
      const fileName = `${Date.now()}_${file.name}`;
      const storageRef = ref(storage, `${storagePath}${fileName}`);

      const uploadTask = uploadBytesResumable(storageRef, file);

      uploadTask.on(
        'state_changed',
        (snapshot) => {
          const progress = (snapshot.bytesTransferred / snapshot.totalBytes) * 100;
          setUploadProgress(progress);
        },
        (err) => {
          console.error('Upload error:', err);
          setError('Failed to upload file');
          setUploading(false);
        },
        async () => {
          // Upload completed
          const downloadURL = await getDownloadURL(uploadTask.snapshot.ref);

          const newAttachment: FileAttachment = {
            id: fileName,
            name: file.name,
            url: downloadURL,
            size: file.size,
            type: file.type,
            uploadedAt: new Date(),
          };

          onChange([...attachments, newAttachment]);
          setUploading(false);
          setUploadProgress(0);

          // Reset file input
          if (fileInputRef.current) {
            fileInputRef.current.value = '';
          }
        }
      );
    } catch (err) {
      console.error('Error uploading file:', err);
      setError('Failed to upload file');
      setUploading(false);
    }
  };

  const handleDelete = async (attachment: FileAttachment) => {
    if (!confirm(`Delete ${attachment.name}?`)) return;

    try {
      const { storage } = getFirebase();
      const fileRef = ref(storage, `${storagePath}${attachment.id}`);
      await deleteObject(fileRef);

      onChange(attachments.filter((a) => a.id !== attachment.id));
    } catch (err) {
      console.error('Error deleting file:', err);
      setError('Failed to delete file');
    }
  };

  const handleDownload = (attachment: FileAttachment) => {
    window.open(attachment.url, '_blank');
  };

  const handlePreview = (attachment: FileAttachment) => {
    setPreviewFile(attachment);
  };

  const handleClosePreview = () => {
    setPreviewFile(null);
  };

  return (
    <Box>
      <Box sx={{ display: 'flex', alignItems: 'center', gap: 2, mb: 2 }}>
        <input
          ref={fileInputRef}
          type="file"
          accept={acceptedTypes.join(',')}
          onChange={handleFileSelect}
          style={{ display: 'none' }}
          disabled={disabled || uploading}
        />
        <Button
          variant="outlined"
          startIcon={<UploadIcon />}
          onClick={() => fileInputRef.current?.click()}
          disabled={disabled || uploading || attachments.length >= maxFiles}
        >
          Upload File
        </Button>
        <Typography variant="caption" color="text.secondary">
          {attachments.length}/{maxFiles} files • Max {maxSizeMB}MB per file
        </Typography>
      </Box>

      {error && (
        <Alert severity="error" onClose={() => setError(null)} sx={{ mb: 2 }}>
          {error}
        </Alert>
      )}

      {uploading && (
        <Box sx={{ mb: 2 }}>
          <Typography variant="caption" color="text.secondary" gutterBottom>
            Uploading... {Math.round(uploadProgress)}%
          </Typography>
          <LinearProgress variant="determinate" value={uploadProgress} />
        </Box>
      )}

      {attachments.length > 0 && (
        <List>
          {attachments.map((attachment) => (
            <ListItem
              key={attachment.id}
              sx={{
                border: 1,
                borderColor: 'divider',
                borderRadius: 1,
                mb: 1,
              }}
            >
              <FileIcon sx={{ mr: 2, color: 'primary.main' }} />
              <ListItemText
                primary={
                  <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                    <Typography variant="body2">{attachment.name}</Typography>
                    <Chip label={getFileExtension(attachment.name)} size="small" />
                  </Box>
                }
                secondary={`${formatFileSize(attachment.size)} • ${attachment.uploadedAt instanceof Date ? attachment.uploadedAt.toLocaleDateString() : new Date(attachment.uploadedAt).toLocaleDateString()}`}
              />
              <ListItemSecondaryAction>
                {attachment.type === 'application/pdf' && (
                  <IconButton
                    edge="end"
                    aria-label="preview"
                    onClick={() => handlePreview(attachment)}
                    sx={{ mr: 1 }}
                  >
                    <PreviewIcon />
                  </IconButton>
                )}
                <IconButton
                  edge="end"
                  aria-label="download"
                  onClick={() => handleDownload(attachment)}
                  sx={{ mr: 1 }}
                >
                  <DownloadIcon />
                </IconButton>
                {!disabled && (
                  <IconButton
                    edge="end"
                    aria-label="delete"
                    onClick={() => handleDelete(attachment)}
                    color="error"
                  >
                    <DeleteIcon />
                  </IconButton>
                )}
              </ListItemSecondaryAction>
            </ListItem>
          ))}
        </List>
      )}

      {attachments.length === 0 && (
        <Typography variant="body2" color="text.secondary" sx={{ fontStyle: 'italic' }}>
          No files uploaded yet
        </Typography>
      )}

      {/* PDF Preview Dialog */}
      <Dialog
        open={!!previewFile}
        onClose={handleClosePreview}
        maxWidth="lg"
        fullWidth
        PaperProps={{
          sx: { height: '90vh' },
        }}
      >
        <DialogTitle>
          {previewFile?.name}
        </DialogTitle>
        <DialogContent sx={{ p: 0, display: 'flex', flexDirection: 'column' }}>
          {previewFile?.type === 'application/pdf' ? (
            <iframe
              src={previewFile.url}
              style={{
                width: '100%',
                height: '100%',
                border: 'none',
              }}
              title={previewFile.name}
            />
          ) : (
            <Box sx={{ p: 3, textAlign: 'center' }}>
              <Typography variant="body1" color="text.secondary">
                Preview not available for this file type
              </Typography>
            </Box>
          )}
        </DialogContent>
        <DialogActions>
          <Button onClick={() => previewFile && handleDownload(previewFile)}>
            Download
          </Button>
          <Button onClick={handleClosePreview} variant="contained">
            Close
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
}
