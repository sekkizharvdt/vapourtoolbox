'use client';

/**
 * Edit Company Document Dialog
 *
 * Dialog for editing company document metadata (title, description, category).
 * Distinct from EditDocumentDialog which edits MasterDocumentEntry for project documents.
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
} from '@mui/material';
import { getFirebase } from '@/lib/firebase';
import { useAuth } from '@/contexts/AuthContext';
import { updateCompanyDocument } from '@/lib/companyDocuments';
import type { CompanyDocument, CompanyDocumentCategory } from '@vapour/types';
import { COMPANY_DOCUMENT_CATEGORIES } from '@vapour/types';

interface EditCompanyDocumentDialogProps {
  open: boolean;
  document: CompanyDocument;
  onClose: () => void;
  onSuccess: () => void;
}

export function EditCompanyDocumentDialog({
  open,
  document,
  onClose,
  onSuccess,
}: EditCompanyDocumentDialogProps) {
  const { db } = getFirebase();
  const { user } = useAuth();

  const [title, setTitle] = useState(document.title);
  const [description, setDescription] = useState(document.description);
  const [category, setCategory] = useState<CompanyDocumentCategory>(document.category);
  const [saving, setSaving] = useState(false);

  const handleSubmit = async () => {
    if (!db || !user) return;

    setSaving(true);
    try {
      await updateCompanyDocument(
        db,
        document.id,
        { title, description, category },
        user.uid,
        user.displayName || 'Unknown'
      );
      onSuccess();
    } catch (error) {
      console.error('Failed to update document:', error);
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open={open} onClose={onClose} maxWidth="sm" fullWidth>
      <DialogTitle>Edit Document Details</DialogTitle>
      <DialogContent>
        <Stack spacing={3} sx={{ mt: 1 }}>
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
        </Stack>
      </DialogContent>
      <DialogActions>
        <Button onClick={onClose} disabled={saving}>
          Cancel
        </Button>
        <Button onClick={handleSubmit} variant="contained" disabled={!title || saving}>
          {saving ? 'Saving...' : 'Save'}
        </Button>
      </DialogActions>
    </Dialog>
  );
}
