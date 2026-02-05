'use client';

/**
 * Upload Document Dialog
 *
 * Dialog for uploading documents to the document browser.
 * Works with all document modules (Proposals, Projects, Procurement, etc.)
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
  FormControl,
  InputLabel,
  Select,
  MenuItem,
  Alert,
  Box,
  Typography,
  CircularProgress,
  LinearProgress,
  Chip,
} from '@mui/material';
import { CloudUpload as UploadIcon, Close as CloseIcon } from '@mui/icons-material';
import { useAuth } from '@/contexts/AuthContext';
import { uploadDocument } from '@/lib/documents/documentService';
import type { DocumentModule, DocumentType, DocumentEntityType } from '@vapour/types';

interface UploadDocumentDialogProps {
  open: boolean;
  onClose: () => void;
  onSuccess: () => void;
  module: DocumentModule;
  projectId?: string;
  currentFolder?: string;
}

// Document types by module (using actual types from @vapour/types)
const DOCUMENT_TYPES_BY_MODULE: Record<DocumentModule, { value: DocumentType; label: string }[]> = {
  PROPOSALS: [
    { value: 'PROPOSAL', label: 'Proposal' },
    { value: 'CLIENT_RFQ', label: 'Client RFQ' },
    { value: 'COST_ESTIMATE', label: 'Cost Estimate' },
    { value: 'OTHER', label: 'Other' },
  ],
  PROJECTS: [
    { value: 'PROJECT_PLAN', label: 'Project Plan' },
    { value: 'PROGRESS_REPORT', label: 'Progress Report' },
    { value: 'TECHNICAL_DRAWING', label: 'Technical Drawing' },
    { value: 'SPECIFICATION', label: 'Specification' },
    { value: 'CONTRACT', label: 'Contract' },
    { value: 'MEETING_MINUTES', label: 'Meeting Minutes' },
    { value: 'OTHER', label: 'Other' },
  ],
  PROCUREMENT: [
    { value: 'PR_SPECIFICATION', label: 'Specification' },
    { value: 'PR_DRAWING', label: 'Drawing' },
    { value: 'VENDOR_OFFER', label: 'Vendor Offer' },
    { value: 'PACKING_LIST_PDF', label: 'Packing List' },
    { value: 'TEST_CERTIFICATE', label: 'Test Certificate' },
    { value: 'OTHER', label: 'Other' },
  ],
  ACCOUNTING: [
    { value: 'INVOICE', label: 'Invoice' },
    { value: 'BILL', label: 'Bill' },
    { value: 'PAYMENT_RECEIPT', label: 'Payment Receipt' },
    { value: 'BANK_STATEMENT', label: 'Bank Statement' },
    { value: 'TAX_CERTIFICATE', label: 'Tax Certificate' },
    { value: 'FINANCIAL_REPORT', label: 'Financial Report' },
    { value: 'OTHER', label: 'Other' },
  ],
  ESTIMATION: [
    { value: 'COST_ESTIMATE', label: 'Cost Estimate' },
    { value: 'BOQ', label: 'Bill of Quantities' },
    { value: 'CLIENT_RFQ', label: 'Client RFQ' },
    { value: 'OTHER', label: 'Other' },
  ],
  TIME_TRACKING: [{ value: 'OTHER', label: 'Other' }],
  GENERAL: [{ value: 'OTHER', label: 'Other' }],
};

// Default entity type by module
const DEFAULT_ENTITY_TYPE: Record<DocumentModule, DocumentEntityType> = {
  PROPOSALS: 'ESTIMATE',
  PROJECTS: 'PROJECT',
  PROCUREMENT: 'PURCHASE_REQUEST',
  ACCOUNTING: 'INVOICE',
  ESTIMATION: 'BOQ',
  TIME_TRACKING: 'OTHER',
  GENERAL: 'OTHER',
};

export function UploadDocumentDialog({
  open,
  onClose,
  onSuccess,
  module,
  projectId,
  currentFolder,
}: UploadDocumentDialogProps) {
  const { user } = useAuth();

  const [file, setFile] = useState<File | null>(null);
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [documentType, setDocumentType] = useState<DocumentType>('OTHER');
  const [tags, setTags] = useState<string[]>([]);
  const [tagInput, setTagInput] = useState('');

  const [uploading, setUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [error, setError] = useState<string | null>(null);

  const documentTypes = DOCUMENT_TYPES_BY_MODULE[module] || [{ value: 'OTHER', label: 'Other' }];

  const handleFileChange = useCallback(
    (event: React.ChangeEvent<HTMLInputElement>) => {
      const selectedFile = event.target.files?.[0];
      if (selectedFile) {
        setFile(selectedFile);
        // Auto-fill title from filename if empty
        if (!title) {
          setTitle(selectedFile.name.replace(/\.[^/.]+$/, ''));
        }
      }
    },
    [title]
  );

  const handleAddTag = useCallback(() => {
    const trimmedTag = tagInput.trim().toLowerCase();
    if (trimmedTag && !tags.includes(trimmedTag)) {
      setTags([...tags, trimmedTag]);
      setTagInput('');
    }
  }, [tagInput, tags]);

  const handleRemoveTag = useCallback(
    (tagToRemove: string) => {
      setTags(tags.filter((tag) => tag !== tagToRemove));
    },
    [tags]
  );

  const handleTagKeyDown = useCallback(
    (event: React.KeyboardEvent) => {
      if (event.key === 'Enter') {
        event.preventDefault();
        handleAddTag();
      }
    },
    [handleAddTag]
  );

  const handleSubmit = useCallback(async () => {
    if (!file || !user) {
      setError('Please select a file');
      return;
    }

    setUploading(true);
    setError(null);
    setUploadProgress(0);

    try {
      // Simulate upload progress (actual progress tracking would need storage upload events)
      const progressInterval = setInterval(() => {
        setUploadProgress((prev) => Math.min(prev + 10, 90));
      }, 200);

      await uploadDocument(
        {
          file,
          module,
          documentType,
          projectId,
          entityType: DEFAULT_ENTITY_TYPE[module],
          entityId: projectId || 'general',
          title: title || file.name,
          description: description || undefined,
          tags: tags.length > 0 ? tags : undefined,
          folder: currentFolder || undefined,
        },
        user.uid,
        user.displayName || user.email || 'Unknown'
      );

      clearInterval(progressInterval);
      setUploadProgress(100);

      // Reset form
      setFile(null);
      setTitle('');
      setDescription('');
      setDocumentType('OTHER');
      setTags([]);
      setTagInput('');
      setUploadProgress(0);

      onSuccess();
      onClose();
    } catch (err) {
      console.error('[UploadDocumentDialog] Upload failed:', err);
      setError(err instanceof Error ? err.message : 'Upload failed. Please try again.');
    } finally {
      setUploading(false);
    }
  }, [
    file,
    user,
    module,
    documentType,
    projectId,
    title,
    description,
    tags,
    currentFolder,
    onSuccess,
    onClose,
  ]);

  const handleClose = useCallback(() => {
    if (!uploading) {
      setFile(null);
      setTitle('');
      setDescription('');
      setDocumentType('OTHER');
      setTags([]);
      setTagInput('');
      setError(null);
      setUploadProgress(0);
      onClose();
    }
  }, [uploading, onClose]);

  return (
    <Dialog open={open} onClose={handleClose} maxWidth="sm" fullWidth>
      <DialogTitle>Upload Document</DialogTitle>
      <DialogContent>
        <Stack spacing={3} sx={{ mt: 1 }}>
          {error && <Alert severity="error">{error}</Alert>}

          {/* File Selection */}
          <Button
            variant="outlined"
            component="label"
            startIcon={<UploadIcon />}
            fullWidth
            disabled={uploading}
          >
            {file ? file.name : 'Select File'}
            <input type="file" hidden onChange={handleFileChange} />
          </Button>

          {file && (
            <Typography variant="caption" color="text.secondary">
              Size: {(file.size / 1024 / 1024).toFixed(2)} MB
            </Typography>
          )}

          {/* Title */}
          <TextField
            label="Title"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            fullWidth
            disabled={uploading}
            helperText="Auto-filled from filename. Modify if needed."
          />

          {/* Description */}
          <TextField
            label="Description"
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            multiline
            rows={2}
            fullWidth
            disabled={uploading}
          />

          {/* Document Type */}
          <FormControl fullWidth disabled={uploading}>
            <InputLabel>Document Type</InputLabel>
            <Select
              value={documentType}
              onChange={(e) => setDocumentType(e.target.value as DocumentType)}
              label="Document Type"
            >
              {documentTypes.map((type) => (
                <MenuItem key={type.value} value={type.value}>
                  {type.label}
                </MenuItem>
              ))}
            </Select>
          </FormControl>

          {/* Tags */}
          <Box>
            <TextField
              label="Add Tags"
              value={tagInput}
              onChange={(e) => setTagInput(e.target.value)}
              onKeyDown={handleTagKeyDown}
              fullWidth
              disabled={uploading}
              helperText="Press Enter to add a tag"
              size="small"
            />
            {tags.length > 0 && (
              <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 0.5, mt: 1 }}>
                {tags.map((tag) => (
                  <Chip
                    key={tag}
                    label={tag}
                    size="small"
                    onDelete={() => handleRemoveTag(tag)}
                    deleteIcon={<CloseIcon />}
                  />
                ))}
              </Box>
            )}
          </Box>

          {/* Upload Progress */}
          {uploading && (
            <Box>
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 2, mb: 1 }}>
                <CircularProgress size={20} />
                <Typography variant="body2">Uploading... {Math.round(uploadProgress)}%</Typography>
              </Box>
              <LinearProgress variant="determinate" value={uploadProgress} />
            </Box>
          )}
        </Stack>
      </DialogContent>
      <DialogActions>
        <Button onClick={handleClose} disabled={uploading}>
          Cancel
        </Button>
        <Button onClick={handleSubmit} variant="contained" disabled={!file || uploading}>
          {uploading ? 'Uploading...' : 'Upload'}
        </Button>
      </DialogActions>
    </Dialog>
  );
}
