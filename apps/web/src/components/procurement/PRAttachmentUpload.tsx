'use client';

/**
 * PR Attachment Upload Component
 *
 * Provides file upload functionality for Purchase Request attachments.
 * Supports drag-and-drop, file type selection, and displays uploaded files.
 */

import { useState, useCallback, useRef } from 'react';
import {
  Box,
  Button,
  Stack,
  Typography,
  IconButton,
  Paper,
  TextField,
  MenuItem,
  List,
  ListItem,
  ListItemIcon,
  ListItemText,
  ListItemSecondaryAction,
  Chip,
  CircularProgress,
  Alert,
} from '@mui/material';
import {
  CloudUpload as UploadIcon,
  AttachFile as AttachIcon,
  Delete as DeleteIcon,
  Description as DocIcon,
  Image as ImageIcon,
  PictureAsPdf as PdfIcon,
  InsertDriveFile as FileIcon,
  Download as DownloadIcon,
} from '@mui/icons-material';
import type { PurchaseRequestAttachment, PurchaseRequestAttachmentType } from '@vapour/types';
import { PR_ATTACHMENT_TYPE_LABELS } from '@vapour/types';
import {
  uploadPRAttachment,
  deletePRAttachment,
  getAttachmentDownloadUrl,
} from '@/lib/procurement/purchaseRequest';
import { useAuth } from '@/contexts/AuthContext';

interface PRAttachmentUploadProps {
  /** Purchase Request ID */
  prId: string;
  /** Optional: Link attachments to specific line item */
  itemId?: string;
  /** List of existing attachments */
  attachments: PurchaseRequestAttachment[];
  /** Callback when attachments list changes */
  onAttachmentsChange: (attachments: PurchaseRequestAttachment[]) => void;
  /** Disabled state */
  disabled?: boolean;
}

/** Get icon for file type */
function getFileIcon(mimeType: string) {
  if (mimeType === 'application/pdf') return <PdfIcon color="error" />;
  if (mimeType.startsWith('image/')) return <ImageIcon color="primary" />;
  if (mimeType.includes('word')) return <DocIcon color="info" />;
  return <FileIcon color="action" />;
}

/** Format file size */
function formatFileSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

export default function PRAttachmentUpload({
  prId,
  itemId,
  attachments,
  onAttachmentsChange,
  disabled = false,
}: PRAttachmentUploadProps) {
  const { user } = useAuth();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [selectedType, setSelectedType] = useState<PurchaseRequestAttachmentType>('TECHNICAL_SPEC');
  const [description, setDescription] = useState('');
  const [dragOver, setDragOver] = useState(false);

  const handleFileSelect = useCallback(
    async (files: FileList | null) => {
      if (!files || files.length === 0 || !user || !prId) return;

      setError(null);
      setUploading(true);

      try {
        const newAttachments: PurchaseRequestAttachment[] = [];

        for (let i = 0; i < files.length; i++) {
          const file = files[i];
          if (!file) continue;

          const attachment = await uploadPRAttachment(
            prId,
            file,
            selectedType,
            user.uid,
            user.displayName || user.email || 'Unknown',
            itemId,
            description || undefined
          );

          newAttachments.push(attachment);
        }

        onAttachmentsChange([...attachments, ...newAttachments]);
        setDescription('');

        // Reset file input
        if (fileInputRef.current) {
          fileInputRef.current.value = '';
        }
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Failed to upload file');
      } finally {
        setUploading(false);
      }
    },
    [prId, itemId, user, selectedType, description, attachments, onAttachmentsChange]
  );

  const handleDelete = async (attachment: PurchaseRequestAttachment) => {
    try {
      await deletePRAttachment(attachment.id, attachment.storagePath);
      onAttachmentsChange(attachments.filter((a) => a.id !== attachment.id));
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to delete file');
    }
  };

  const handleDownload = async (attachment: PurchaseRequestAttachment) => {
    try {
      const url = await getAttachmentDownloadUrl(attachment.storagePath);
      window.open(url, '_blank');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to get download link');
    }
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    if (!disabled) setDragOver(true);
  };

  const handleDragLeave = () => {
    setDragOver(false);
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setDragOver(false);
    if (!disabled) {
      handleFileSelect(e.dataTransfer.files);
    }
  };

  return (
    <Box>
      {error && (
        <Alert severity="error" onClose={() => setError(null)} sx={{ mb: 2 }}>
          {error}
        </Alert>
      )}

      {/* Upload Area */}
      <Paper
        variant="outlined"
        sx={{
          p: 2,
          mb: 2,
          border: dragOver ? '2px dashed primary.main' : '2px dashed',
          borderColor: dragOver ? 'primary.main' : 'divider',
          bgcolor: dragOver ? 'action.hover' : 'transparent',
          transition: 'all 0.2s',
          opacity: disabled ? 0.5 : 1,
        }}
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
        onDrop={handleDrop}
      >
        <Stack spacing={2}>
          {/* Type and Description Row */}
          <Stack direction={{ xs: 'column', sm: 'row' }} spacing={2}>
            <TextField
              select
              label="Attachment Type"
              value={selectedType}
              onChange={(e) => setSelectedType(e.target.value as PurchaseRequestAttachmentType)}
              size="small"
              sx={{ minWidth: 180 }}
              disabled={disabled || uploading}
            >
              {Object.entries(PR_ATTACHMENT_TYPE_LABELS).map(([value, label]) => (
                <MenuItem key={value} value={value}>
                  {label}
                </MenuItem>
              ))}
            </TextField>

            <TextField
              label="Description (optional)"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              size="small"
              fullWidth
              placeholder="Brief description of the document"
              disabled={disabled || uploading}
            />
          </Stack>

          {/* Upload Button / Drop Zone */}
          <Box
            sx={{
              textAlign: 'center',
              py: 2,
            }}
          >
            <input
              type="file"
              ref={fileInputRef}
              onChange={(e) => handleFileSelect(e.target.files)}
              style={{ display: 'none' }}
              multiple
              accept=".pdf,.doc,.docx,.xls,.xlsx,.jpg,.jpeg,.png,.dwg,.dxf"
              disabled={disabled || uploading}
            />

            {uploading ? (
              <Stack alignItems="center" spacing={1}>
                <CircularProgress size={32} />
                <Typography variant="body2" color="text.secondary">
                  Uploading...
                </Typography>
              </Stack>
            ) : (
              <Stack alignItems="center" spacing={1}>
                <UploadIcon sx={{ fontSize: 40, color: 'text.secondary' }} />
                <Typography variant="body2" color="text.secondary">
                  Drag & drop files here, or
                </Typography>
                <Button
                  variant="outlined"
                  startIcon={<AttachIcon />}
                  onClick={() => fileInputRef.current?.click()}
                  disabled={disabled}
                  size="small"
                >
                  Browse Files
                </Button>
                <Typography variant="caption" color="text.secondary">
                  PDF, Word, Excel, Images, CAD files (max 25MB)
                </Typography>
              </Stack>
            )}
          </Box>
        </Stack>
      </Paper>

      {/* Uploaded Files List */}
      {attachments.length > 0 && (
        <Box>
          <Typography variant="subtitle2" sx={{ mb: 1 }}>
            Attached Files ({attachments.length})
          </Typography>
          <List dense>
            {attachments.map((attachment) => (
              <ListItem
                key={attachment.id}
                sx={{
                  bgcolor: 'background.paper',
                  borderRadius: 1,
                  mb: 0.5,
                  border: 1,
                  borderColor: 'divider',
                }}
              >
                <ListItemIcon sx={{ minWidth: 40 }}>
                  {getFileIcon(attachment.mimeType)}
                </ListItemIcon>
                <ListItemText
                  primary={
                    <Stack direction="row" spacing={1} alignItems="center">
                      <Typography variant="body2" noWrap sx={{ maxWidth: 200 }}>
                        {attachment.fileName}
                      </Typography>
                      <Chip
                        label={PR_ATTACHMENT_TYPE_LABELS[attachment.attachmentType]}
                        size="small"
                        variant="outlined"
                      />
                    </Stack>
                  }
                  secondary={
                    <Typography variant="caption" color="text.secondary">
                      {formatFileSize(attachment.fileSize)}
                      {attachment.description && ` - ${attachment.description}`}
                    </Typography>
                  }
                />
                <ListItemSecondaryAction>
                  <IconButton
                    edge="end"
                    size="small"
                    onClick={() => handleDownload(attachment)}
                    sx={{ mr: 0.5 }}
                  >
                    <DownloadIcon fontSize="small" />
                  </IconButton>
                  {!disabled && (
                    <IconButton
                      edge="end"
                      size="small"
                      onClick={() => handleDelete(attachment)}
                      color="error"
                    >
                      <DeleteIcon fontSize="small" />
                    </IconButton>
                  )}
                </ListItemSecondaryAction>
              </ListItem>
            ))}
          </List>
        </Box>
      )}
    </Box>
  );
}
