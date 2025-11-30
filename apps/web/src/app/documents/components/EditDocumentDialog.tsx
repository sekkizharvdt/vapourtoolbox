'use client';

/**
 * Edit Document Dialog
 *
 * Dialog for editing master document metadata:
 * - Document title
 * - Discipline code
 * - Sub-code
 * - Description
 * - Visibility
 * - Status
 */

import { useState, useEffect } from 'react';
import {
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Button,
  TextField,
  Stack,
  Typography,
  FormControl,
  InputLabel,
  Select,
  MenuItem,
  Alert,
  FormControlLabel,
  Switch,
} from '@mui/material';
import type { MasterDocumentEntry, MasterDocumentStatus } from '@vapour/types';
import { STANDARD_DISCIPLINE_CODES } from '@/lib/documents/documentNumberingService';
import { updateMasterDocument } from '@/lib/documents/masterDocumentService';

interface EditDocumentDialogProps {
  open: boolean;
  onClose: () => void;
  document: MasterDocumentEntry;
  onUpdate: () => void;
}

const STATUS_OPTIONS: { value: MasterDocumentStatus; label: string; description: string }[] = [
  { value: 'DRAFT', label: 'Draft', description: 'Initial state - not yet started' },
  { value: 'IN_PROGRESS', label: 'In Progress', description: 'User working on document' },
  { value: 'SUBMITTED', label: 'Submitted', description: 'Submitted to client' },
  {
    value: 'UNDER_REVIEW',
    label: 'Under Review',
    description: 'Client reviewing or comments pending',
  },
  { value: 'APPROVED', label: 'Approved', description: 'Client approved' },
  { value: 'ACCEPTED', label: 'Accepted', description: 'Final - no further revisions' },
  { value: 'ON_HOLD', label: 'On Hold', description: 'Temporarily paused' },
  { value: 'CANCELLED', label: 'Cancelled', description: 'Document cancelled' },
];

export default function EditDocumentDialog({
  open,
  onClose,
  document,
  onUpdate,
}: EditDocumentDialogProps) {
  const [documentTitle, setDocumentTitle] = useState(document.documentTitle);
  const [disciplineCode, setDisciplineCode] = useState(document.disciplineCode);
  const [subCode, setSubCode] = useState(document.subCode || '');
  const [description, setDescription] = useState(document.description || '');
  const [clientVisible, setClientVisible] = useState(document.visibility === 'CLIENT_VISIBLE');
  const [status, setStatus] = useState<MasterDocumentStatus>(document.status);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Reset form when document changes
  useEffect(() => {
    setDocumentTitle(document.documentTitle);
    setDisciplineCode(document.disciplineCode);
    setSubCode(document.subCode || '');
    setDescription(document.description || '');
    setClientVisible(document.visibility === 'CLIENT_VISIBLE');
    setStatus(document.status);
  }, [document]);

  const handleSave = async () => {
    if (!documentTitle.trim()) {
      setError('Document title is required');
      return;
    }

    setSaving(true);
    setError(null);

    try {
      await updateMasterDocument(document.projectId, document.id, {
        documentTitle: documentTitle.trim(),
        disciplineCode,
        subCode: subCode.trim() || undefined,
        description: description.trim() || undefined,
        visibility: clientVisible ? 'CLIENT_VISIBLE' : 'INTERNAL_ONLY',
        status,
      });

      onUpdate();
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to update document');
    } finally {
      setSaving(false);
    }
  };

  const handleClose = () => {
    if (!saving) {
      setError(null);
      onClose();
    }
  };

  return (
    <Dialog open={open} onClose={handleClose} maxWidth="sm" fullWidth>
      <DialogTitle>
        Edit Document
        <Typography variant="body2" color="text.secondary" sx={{ mt: 0.5 }}>
          {document.documentNumber}
        </Typography>
      </DialogTitle>

      <DialogContent>
        <Stack spacing={3} sx={{ mt: 1 }}>
          {/* Document Title */}
          <TextField
            label="Document Title"
            value={documentTitle}
            onChange={(e) => setDocumentTitle(e.target.value)}
            required
            fullWidth
            disabled={saving}
          />

          {/* Discipline Code */}
          <FormControl fullWidth disabled={saving}>
            <InputLabel>Discipline</InputLabel>
            <Select
              value={disciplineCode}
              onChange={(e) => setDisciplineCode(e.target.value)}
              label="Discipline"
            >
              {STANDARD_DISCIPLINE_CODES.map((disc) => (
                <MenuItem key={disc.code} value={disc.code}>
                  {disc.code} - {disc.name}
                </MenuItem>
              ))}
            </Select>
          </FormControl>

          {/* Sub-code */}
          <TextField
            label="Sub-code (Optional)"
            value={subCode}
            onChange={(e) => setSubCode(e.target.value)}
            fullWidth
            disabled={saving}
            placeholder="e.g., 01, 02"
          />

          {/* Description */}
          <TextField
            label="Description (Optional)"
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            multiline
            rows={3}
            fullWidth
            disabled={saving}
          />

          {/* Status */}
          <FormControl fullWidth disabled={saving}>
            <InputLabel>Status</InputLabel>
            <Select
              value={status}
              onChange={(e) => setStatus(e.target.value as MasterDocumentStatus)}
              label="Status"
            >
              {STATUS_OPTIONS.map((opt) => (
                <MenuItem key={opt.value} value={opt.value}>
                  <Stack>
                    <Typography variant="body2">{opt.label}</Typography>
                    <Typography variant="caption" color="text.secondary">
                      {opt.description}
                    </Typography>
                  </Stack>
                </MenuItem>
              ))}
            </Select>
          </FormControl>

          {/* Client Visibility */}
          <FormControlLabel
            control={
              <Switch
                checked={clientVisible}
                onChange={(e) => setClientVisible(e.target.checked)}
                disabled={saving}
              />
            }
            label={
              <Stack>
                <Typography variant="body2">Client Visible</Typography>
                <Typography variant="caption" color="text.secondary">
                  {clientVisible ? 'Document is visible to client' : 'Document is internal only'}
                </Typography>
              </Stack>
            }
          />

          {/* Error Message */}
          {error && <Alert severity="error">{error}</Alert>}
        </Stack>
      </DialogContent>

      <DialogActions>
        <Button onClick={handleClose} disabled={saving}>
          Cancel
        </Button>
        <Button onClick={handleSave} variant="contained" disabled={saving}>
          {saving ? 'Saving...' : 'Save Changes'}
        </Button>
      </DialogActions>
    </Dialog>
  );
}
