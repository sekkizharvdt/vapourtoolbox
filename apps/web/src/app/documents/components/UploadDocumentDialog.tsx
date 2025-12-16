'use client';

/**
 * Upload Document Dialog
 *
 * Dialog for uploading new company documents with metadata.
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
  Alert,
  Box,
  Typography,
  CircularProgress,
} from '@mui/material';
import { CloudUpload as UploadIcon } from '@mui/icons-material';
import { getFirebase } from '@/lib/firebase';
import { useAuth } from '@/contexts/AuthContext';
import { uploadCompanyDocument } from '@/lib/companyDocuments';
import type { CompanyDocumentCategory, CompanyDocumentInput, TemplateType } from '@vapour/types';
import { COMPANY_DOCUMENT_CATEGORIES, TEMPLATE_TYPES } from '@vapour/types';

interface UploadDocumentDialogProps {
  open: boolean;
  onClose: () => void;
  onSuccess: () => void;
}

export function UploadDocumentDialog({ open, onClose, onSuccess }: UploadDocumentDialogProps) {
  const { db, storage } = getFirebase();
  const { user } = useAuth();

  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [category, setCategory] = useState<CompanyDocumentCategory>('SOP');
  const [isTemplate, setIsTemplate] = useState(false);
  const [templateType, setTemplateType] = useState<TemplateType>('OTHER');
  const [file, setFile] = useState<File | null>(null);
  const [uploading, setUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [error, setError] = useState<string | null>(null);

  const handleFileChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    const selectedFile = event.target.files?.[0];
    if (selectedFile) {
      setFile(selectedFile);
      if (!title) {
        // Auto-fill title from filename
        setTitle(selectedFile.name.replace(/\.[^/.]+$/, ''));
      }
    }
  };

  const handleSubmit = async () => {
    if (!db || !storage || !user || !file) return;

    setUploading(true);
    setError(null);

    try {
      const input: CompanyDocumentInput = {
        title,
        description,
        category,
        isTemplate: category === 'TEMPLATE' ? true : isTemplate,
        templateType: category === 'TEMPLATE' || isTemplate ? templateType : undefined,
      };

      await uploadCompanyDocument(
        db,
        storage,
        file,
        input,
        user.uid,
        user.displayName || 'Unknown',
        setUploadProgress
      );

      onSuccess();
      // Reset form
      setTitle('');
      setDescription('');
      setCategory('SOP');
      setIsTemplate(false);
      setFile(null);
      setUploadProgress(0);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Upload failed');
    } finally {
      setUploading(false);
    }
  };

  return (
    <Dialog open={open} onClose={onClose} maxWidth="sm" fullWidth>
      <DialogTitle>Upload Company Document</DialogTitle>
      <DialogContent>
        <Stack spacing={3} sx={{ mt: 1 }}>
          {error && <Alert severity="error">{error}</Alert>}

          <Button variant="outlined" component="label" startIcon={<UploadIcon />} fullWidth>
            {file ? file.name : 'Select File'}
            <input type="file" hidden onChange={handleFileChange} />
          </Button>

          <TextField
            label="Title"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            required
            fullWidth
          />

          <TextField
            label="Description"
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            multiline
            rows={2}
            fullWidth
          />

          <FormControl fullWidth>
            <InputLabel>Category</InputLabel>
            <Select
              value={category}
              onChange={(e) => setCategory(e.target.value as CompanyDocumentCategory)}
              label="Category"
            >
              {(Object.keys(COMPANY_DOCUMENT_CATEGORIES) as CompanyDocumentCategory[]).map(
                (cat) => (
                  <MenuItem key={cat} value={cat}>
                    {COMPANY_DOCUMENT_CATEGORIES[cat].label}
                  </MenuItem>
                )
              )}
            </Select>
          </FormControl>

          {(category === 'TEMPLATE' || isTemplate) && (
            <FormControl fullWidth>
              <InputLabel>Template Type</InputLabel>
              <Select
                value={templateType}
                onChange={(e) => setTemplateType(e.target.value as TemplateType)}
                label="Template Type"
              >
                {(Object.keys(TEMPLATE_TYPES) as TemplateType[]).map((type) => (
                  <MenuItem key={type} value={type}>
                    {TEMPLATE_TYPES[type].label}
                  </MenuItem>
                ))}
              </Select>
            </FormControl>
          )}

          {uploading && (
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
              <CircularProgress variant="determinate" value={uploadProgress} size={24} />
              <Typography variant="body2">{Math.round(uploadProgress)}%</Typography>
            </Box>
          )}
        </Stack>
      </DialogContent>
      <DialogActions>
        <Button onClick={onClose} disabled={uploading}>
          Cancel
        </Button>
        <Button onClick={handleSubmit} variant="contained" disabled={!file || !title || uploading}>
          {uploading ? 'Uploading...' : 'Upload'}
        </Button>
      </DialogActions>
    </Dialog>
  );
}
