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
import { DatePicker } from '@mui/x-date-pickers/DatePicker';
import type { MasterDocumentEntry, MasterDocumentStatus } from '@vapour/types';
import { Timestamp } from 'firebase/firestore';
import { STANDARD_DISCIPLINE_CODES } from '@/lib/documents/documentNumberingService';
import { updateMasterDocument } from '@/lib/documents/masterDocumentService';
import { masterDocumentStateMachine } from '@/lib/workflow/stateMachines';

interface EditDocumentDialogProps {
  open: boolean;
  onClose: () => void;
  document: MasterDocumentEntry;
  onUpdate: () => void;
}

/* eslint-disable react-hooks/exhaustive-deps -- open is intentionally included to re-sync state */

const STATUS_LABELS: Record<MasterDocumentStatus, { label: string; description: string }> = {
  DRAFT: { label: 'Draft', description: 'Initial state - not yet started' },
  IN_PROGRESS: { label: 'In Progress', description: 'User working on document' },
  SUBMITTED: { label: 'Submitted', description: 'Submitted to client' },
  UNDER_REVIEW: { label: 'Under Review', description: 'Client reviewing or comments pending' },
  APPROVED: { label: 'Approved', description: 'Client approved' },
  ACCEPTED: { label: 'Accepted', description: 'Final - no further revisions' },
  ON_HOLD: { label: 'On Hold', description: 'Temporarily paused' },
  CANCELLED: { label: 'Cancelled', description: 'Document cancelled' },
};

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
  const [priority, setPriority] = useState<'LOW' | 'MEDIUM' | 'HIGH' | 'URGENT'>(
    document.priority || 'MEDIUM'
  );
  const [dueDate, setDueDate] = useState<Date | null>(() => {
    if (!document.dueDate) return null;
    const raw = document.dueDate as unknown;
    if (raw && typeof raw === 'object' && 'toDate' in raw) {
      return (raw as { toDate: () => Date }).toDate();
    }
    if (raw && typeof raw === 'object' && 'seconds' in raw) {
      return new Date((raw as { seconds: number }).seconds * 1000);
    }
    return null;
  });
  const [clientVisible, setClientVisible] = useState(document.visibility === 'CLIENT_VISIBLE');
  const [status, setStatus] = useState<MasterDocumentStatus>(document.status);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Valid status transitions from current document status
  const availableStatuses: MasterDocumentStatus[] = [
    document.status,
    ...masterDocumentStateMachine.getAvailableTransitions(document.status),
  ];

  // Reset form when document changes or dialog reopens
  useEffect(() => {
    if (!open) return;
    setDocumentTitle(document.documentTitle);
    setDisciplineCode(document.disciplineCode);
    setSubCode(document.subCode || '');
    setDescription(document.description || '');
    setPriority(document.priority || 'MEDIUM');
    setClientVisible(document.visibility === 'CLIENT_VISIBLE');
    setStatus(document.status);
    setError(null);
    // Handle dueDate
    const raw = document.dueDate as unknown;
    if (!raw) {
      setDueDate(null);
    } else if (typeof raw === 'object' && 'toDate' in raw) {
      setDueDate((raw as { toDate: () => Date }).toDate());
    } else if (typeof raw === 'object' && 'seconds' in raw) {
      setDueDate(new Date((raw as { seconds: number }).seconds * 1000));
    } else {
      setDueDate(null);
    }
  }, [open, document]);

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
        priority,
        ...(dueDate !== undefined && {
          dueDate: dueDate ? Timestamp.fromDate(dueDate) : undefined,
        }),
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
              {availableStatuses.map((s) => {
                const info = STATUS_LABELS[s];
                return (
                  <MenuItem key={s} value={s}>
                    <Stack>
                      <Typography variant="body2">
                        {info?.label || s}
                        {s === document.status ? ' (current)' : ''}
                      </Typography>
                      <Typography variant="caption" color="text.secondary">
                        {info?.description || ''}
                      </Typography>
                    </Stack>
                  </MenuItem>
                );
              })}
            </Select>
          </FormControl>

          {/* Priority */}
          <FormControl fullWidth disabled={saving}>
            <InputLabel>Priority</InputLabel>
            <Select
              value={priority}
              onChange={(e) => setPriority(e.target.value as 'LOW' | 'MEDIUM' | 'HIGH' | 'URGENT')}
              label="Priority"
            >
              <MenuItem value="LOW">Low</MenuItem>
              <MenuItem value="MEDIUM">Medium</MenuItem>
              <MenuItem value="HIGH">High</MenuItem>
              <MenuItem value="URGENT">Urgent</MenuItem>
            </Select>
          </FormControl>

          {/* Due Date */}
          <DatePicker
            label="Due Date"
            value={dueDate}
            onChange={(newValue) => setDueDate(newValue as Date | null)}
            format="dd/MM/yyyy"
            disabled={saving}
            slotProps={{
              textField: {
                fullWidth: true,
              },
            }}
          />

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
