'use client';

/**
 * New Version Dialog
 *
 * Dialog for uploading a new version of an existing company document.
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
  Alert,
  Box,
  Typography,
  CircularProgress,
} from '@mui/material';
import { CloudUpload as UploadIcon } from '@mui/icons-material';
import { getFirebase } from '@/lib/firebase';
import { useAuth } from '@/contexts/AuthContext';
import { createNewVersion } from '@/lib/companyDocuments';
import type { CompanyDocument } from '@vapour/types';

interface NewVersionDialogProps {
  open: boolean;
  document: CompanyDocument;
  onClose: () => void;
  onSuccess: () => void;
}

export function NewVersionDialog({ open, document, onClose, onSuccess }: NewVersionDialogProps) {
  const { db, storage } = getFirebase();
  const { user } = useAuth();

  const [file, setFile] = useState<File | null>(null);
  const [revisionNotes, setRevisionNotes] = useState('');
  const [uploading, setUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);

  const handleFileChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    const selectedFile = event.target.files?.[0];
    if (selectedFile) {
      setFile(selectedFile);
    }
  };

  const handleSubmit = async () => {
    if (!db || !storage || !user || !file) return;

    setUploading(true);
    try {
      await createNewVersion(
        db,
        storage,
        document.id,
        file,
        revisionNotes,
        user.uid,
        user.displayName || 'Unknown',
        setUploadProgress
      );
      onSuccess();
      setFile(null);
      setRevisionNotes('');
      setUploadProgress(0);
    } catch (error) {
      console.error('Failed to upload new version:', error);
    } finally {
      setUploading(false);
    }
  };

  return (
    <Dialog open={open} onClose={onClose} maxWidth="sm" fullWidth>
      <DialogTitle>Upload New Version: {document.title}</DialogTitle>
      <DialogContent>
        <Stack spacing={3} sx={{ mt: 1 }}>
          <Alert severity="info">
            Current version: v{document.version}. New version will be v{document.version + 1}.
          </Alert>

          <Button variant="outlined" component="label" startIcon={<UploadIcon />} fullWidth>
            {file ? file.name : 'Select New File'}
            <input type="file" hidden onChange={handleFileChange} />
          </Button>

          <TextField
            label="Revision Notes"
            value={revisionNotes}
            onChange={(e) => setRevisionNotes(e.target.value)}
            multiline
            rows={2}
            fullWidth
            placeholder="What changed in this version?"
          />

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
        <Button onClick={handleSubmit} variant="contained" disabled={!file || uploading}>
          {uploading ? 'Uploading...' : 'Upload Version'}
        </Button>
      </DialogActions>
    </Dialog>
  );
}
