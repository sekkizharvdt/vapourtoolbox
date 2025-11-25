'use client';

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
  FormControl,
  InputLabel,
  Select,
  MenuItem,
  Typography,
} from '@mui/material';
import type { MasterDocumentEntry, WorkActivityType } from '@vapour/types';

interface AddWorkItemDialogProps {
  open: boolean;
  onClose: () => void;
  document: MasterDocumentEntry;
  onSubmit: (data: WorkItemData) => Promise<void>;
}

export interface WorkItemData {
  activityName: string;
  activityType: WorkActivityType;
  description: string;
  estimatedHours?: number;
  notes?: string;
}

const ACTIVITY_TYPES: { value: WorkActivityType; label: string }[] = [
  { value: 'INSPECTION', label: 'Inspection' },
  { value: 'TRANSPORTATION', label: 'Transportation' },
  { value: 'FABRICATION', label: 'Fabrication' },
  { value: 'ROLLING', label: 'Rolling' },
  { value: 'WELDING', label: 'Welding' },
  { value: 'TESTING', label: 'Testing' },
  { value: 'ASSEMBLY', label: 'Assembly' },
  { value: 'MACHINING', label: 'Machining' },
  { value: 'PAINTING', label: 'Painting' },
  { value: 'DOCUMENTATION', label: 'Documentation' },
  { value: 'REVIEW', label: 'Review' },
  { value: 'OTHER', label: 'Other' },
];

export default function AddWorkItemDialog({
  open,
  onClose,
  document,
  onSubmit,
}: AddWorkItemDialogProps) {
  const [activityName, setActivityName] = useState('');
  const [activityType, setActivityType] = useState<WorkActivityType>('FABRICATION');
  const [description, setDescription] = useState('');
  const [estimatedHours, setEstimatedHours] = useState('');
  const [notes, setNotes] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async () => {
    if (!activityName.trim() || !description.trim()) {
      setError('Please enter activity name and description');
      return;
    }

    setSubmitting(true);
    setError(null);

    try {
      const data: WorkItemData = {
        activityName: activityName.trim(),
        activityType,
        description: description.trim(),
      };

      if (estimatedHours && parseFloat(estimatedHours) > 0) {
        data.estimatedHours = parseFloat(estimatedHours);
      }
      if (notes.trim()) {
        data.notes = notes.trim();
      }

      await onSubmit(data);

      setActivityName('');
      setActivityType('FABRICATION');
      setDescription('');
      setEstimatedHours('');
      setNotes('');
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to add work item');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Dialog open={open} onClose={onClose} maxWidth="sm" fullWidth>
      <DialogTitle>
        Add Work Item
        <Typography variant="body2" color="text.secondary" sx={{ mt: 0.5 }}>
          {document.documentNumber}
        </Typography>
      </DialogTitle>

      <DialogContent>
        <Stack spacing={2} sx={{ mt: 1 }}>
          <TextField
            label="Activity Name"
            value={activityName}
            onChange={(e) => setActivityName(e.target.value)}
            required
            fullWidth
          />

          <FormControl fullWidth required>
            <InputLabel>Activity Type</InputLabel>
            <Select
              value={activityType}
              onChange={(e) => setActivityType(e.target.value as WorkActivityType)}
              label="Activity Type"
            >
              {ACTIVITY_TYPES.map((type) => (
                <MenuItem key={type.value} value={type.value}>
                  {type.label}
                </MenuItem>
              ))}
            </Select>
          </FormControl>

          <TextField
            label="Description"
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            required
            fullWidth
            multiline
            rows={3}
          />

          <TextField
            label="Estimated Hours"
            type="number"
            value={estimatedHours}
            onChange={(e) => setEstimatedHours(e.target.value)}
            inputProps={{ min: 0, step: 0.5 }}
            fullWidth
          />

          <TextField
            label="Notes"
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            fullWidth
            multiline
            rows={2}
          />

          {error && <Alert severity="error">{error}</Alert>}
        </Stack>
      </DialogContent>

      <DialogActions>
        <Button onClick={onClose}>Cancel</Button>
        <Button onClick={handleSubmit} variant="contained" disabled={submitting}>
          {submitting ? 'Adding...' : 'Add'}
        </Button>
      </DialogActions>
    </Dialog>
  );
}
