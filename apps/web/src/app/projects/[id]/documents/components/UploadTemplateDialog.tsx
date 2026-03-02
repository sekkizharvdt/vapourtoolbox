'use client';

/**
 * Upload Template Dialog
 *
 * Dialog for uploading new document templates with metadata.
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
  FormControl,
  InputLabel,
  Select,
  MenuItem,
  Typography,
  Alert,
  Box,
  LinearProgress,
} from '@mui/material';
import { CloudUpload as UploadIcon } from '@mui/icons-material';
import type { TemplateCategory, TemplateApplicability } from '@vapour/types';
import { useAuth } from '@/contexts/AuthContext';
import { getFirebase } from '@/lib/firebase';
import { ref, uploadBytesResumable, getDownloadURL } from 'firebase/storage';
import { createDocumentTemplate } from '@/lib/documents/documentTemplateService';

interface UploadTemplateDialogProps {
  open: boolean;
  onClose: () => void;
  projectId: string;
  projectName: string;
  onUploadComplete: () => void;
}

export default function UploadTemplateDialog({
  open,
  onClose,
  projectId,
  projectName,
  onUploadComplete,
}: UploadTemplateDialogProps) {
  const { user } = useAuth();
  const { storage } = getFirebase();

  // Form state
  const [templateName, setTemplateName] = useState('');
  const [description, setDescription] = useState('');
  const [category, setCategory] = useState<TemplateCategory>('DOCUMENT');
  const [applicability, setApplicability] = useState<TemplateApplicability>('COMPANY_WIDE');
  const [usageInstructions, setUsageInstructions] = useState('');
  const [file, setFile] = useState<File | null>(null);

  // Upload state
  const [uploading, setUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [error, setError] = useState<string | null>(null);

  const handleFileSelect = (event: React.ChangeEvent<HTMLInputElement>) => {
    const selectedFile = event.target.files?.[0];
    if (!selectedFile) return;

    if (selectedFile.size > 50 * 1024 * 1024) {
      setError('File size exceeds 50MB limit');
      return;
    }

    setFile(selectedFile);
    setError(null);

    // Auto-fill name if empty
    if (!templateName) {
      const nameWithoutExt = selectedFile.name.replace(/\.[^/.]+$/, '');
      setTemplateName(nameWithoutExt);
    }
  };

  const handleSubmit = async () => {
    if (!user || !storage || !file) return;

    if (!templateName.trim()) {
      setError('Template name is required');
      return;
    }

    setUploading(true);
    setError(null);

    try {
      // Upload file to Storage
      const fileExtension = file.name.split('.').pop() || '';
      const timestamp = Date.now();
      const storagePath = `templates/${timestamp}_${file.name}`;
      const storageReference = ref(storage, storagePath);

      const uploadTask = uploadBytesResumable(storageReference, file);

      const fileUrl = await new Promise<string>((resolve, reject) => {
        uploadTask.on(
          'state_changed',
          (snapshot) => {
            const progress = (snapshot.bytesTransferred / snapshot.totalBytes) * 100;
            setUploadProgress(progress);
          },
          (err) => reject(err),
          async () => {
            const url = await getDownloadURL(uploadTask.snapshot.ref);
            resolve(url);
          }
        );
      });

      // Create template record
      await createDocumentTemplate({
        templateName: templateName.trim(),
        description: description.trim(),
        category,
        applicability,
        ...(applicability === 'PROJECT_SPECIFIC' && {
          projectId,
          projectName,
        }),
        fileName: file.name,
        fileUrl,
        storageRef: storagePath,
        fileSize: file.size,
        mimeType: file.type,
        fileExtension,
        version: '1.0',
        downloadCount: 0,
        isActive: true,
        isLatest: true,
        tags: [],
        ...(usageInstructions.trim() && { usageInstructions: usageInstructions.trim() }),
        isDeleted: false,
        createdBy: user.uid,
        createdByName: user.displayName || user.email || 'Unknown',
      });

      resetForm();
      onUploadComplete();
    } catch (err) {
      console.error('[UploadTemplateDialog] Error:', err);
      setError(err instanceof Error ? err.message : 'Failed to upload template');
    } finally {
      setUploading(false);
      setUploadProgress(0);
    }
  };

  const resetForm = () => {
    setTemplateName('');
    setDescription('');
    setCategory('DOCUMENT');
    setApplicability('COMPANY_WIDE');
    setUsageInstructions('');
    setFile(null);
    setError(null);
  };

  const handleClose = () => {
    if (!uploading) {
      resetForm();
      onClose();
    }
  };

  return (
    <Dialog open={open} onClose={handleClose} maxWidth="sm" fullWidth>
      <DialogTitle>Upload Document Template</DialogTitle>
      <DialogContent>
        <Stack spacing={3} sx={{ mt: 1 }}>
          {error && <Alert severity="error">{error}</Alert>}

          {/* File Upload */}
          {!file ? (
            <Box
              sx={{
                border: '2px dashed',
                borderColor: 'divider',
                borderRadius: 2,
                p: 3,
                textAlign: 'center',
                cursor: 'pointer',
                '&:hover': { borderColor: 'primary.main', bgcolor: 'action.hover' },
              }}
              component="label"
            >
              <input type="file" hidden onChange={handleFileSelect} />
              <UploadIcon sx={{ fontSize: 40, color: 'text.secondary', mb: 1 }} />
              <Typography variant="body2">Click to select file (max 50MB)</Typography>
            </Box>
          ) : (
            <Alert severity="info">
              <Typography variant="body2">
                <strong>{file.name}</strong> ({(file.size / 1024).toFixed(1)} KB)
              </Typography>
              {!uploading && (
                <Button size="small" onClick={() => setFile(null)} sx={{ mt: 0.5 }}>
                  Remove
                </Button>
              )}
            </Alert>
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

          {/* Template Name */}
          <TextField
            label="Template Name"
            value={templateName}
            onChange={(e) => setTemplateName(e.target.value)}
            required
            fullWidth
            disabled={uploading}
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

          {/* Category */}
          <FormControl fullWidth disabled={uploading}>
            <InputLabel>Category</InputLabel>
            <Select
              value={category}
              onChange={(e) => setCategory(e.target.value as TemplateCategory)}
              label="Category"
            >
              <MenuItem value="DRAWING">Drawing</MenuItem>
              <MenuItem value="DOCUMENT">Document</MenuItem>
              <MenuItem value="SPREADSHEET">Spreadsheet</MenuItem>
              <MenuItem value="CALCULATION">Calculation</MenuItem>
              <MenuItem value="REPORT">Report</MenuItem>
              <MenuItem value="FORM">Form</MenuItem>
              <MenuItem value="PROCEDURE">Procedure</MenuItem>
              <MenuItem value="OTHER">Other</MenuItem>
            </Select>
          </FormControl>

          {/* Applicability */}
          <FormControl fullWidth disabled={uploading}>
            <InputLabel>Scope</InputLabel>
            <Select
              value={applicability}
              onChange={(e) => setApplicability(e.target.value as TemplateApplicability)}
              label="Scope"
            >
              <MenuItem value="COMPANY_WIDE">Company Wide</MenuItem>
              <MenuItem value="PROJECT_SPECIFIC">This Project Only</MenuItem>
              <MenuItem value="DISCIPLINE_SPECIFIC">Discipline Specific</MenuItem>
            </Select>
          </FormControl>

          {/* Usage Instructions */}
          <TextField
            label="Usage Instructions (Optional)"
            value={usageInstructions}
            onChange={(e) => setUsageInstructions(e.target.value)}
            multiline
            rows={2}
            fullWidth
            disabled={uploading}
            placeholder="How should this template be used?"
          />
        </Stack>
      </DialogContent>
      <DialogActions>
        <Button onClick={handleClose} disabled={uploading}>
          Cancel
        </Button>
        <Button
          onClick={handleSubmit}
          variant="contained"
          disabled={uploading || !file || !templateName.trim()}
        >
          {uploading ? 'Uploading...' : 'Upload Template'}
        </Button>
      </DialogActions>
    </Dialog>
  );
}
