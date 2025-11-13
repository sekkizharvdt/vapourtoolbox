/**
 * Match Confirmation Dialog Component
 *
 * Dialog for confirming transaction matches with optional notes
 */

'use client';

import {
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Button,
  Typography,
  TextField,
} from '@mui/material';

interface MatchConfirmationDialogProps {
  open: boolean;
  notes: string;
  onNotesChange: (notes: string) => void;
  onConfirm: () => void;
  onCancel: () => void;
}

export function MatchConfirmationDialog({
  open,
  notes,
  onNotesChange,
  onConfirm,
  onCancel,
}: MatchConfirmationDialogProps) {
  return (
    <Dialog open={open} onClose={onCancel} maxWidth="sm" fullWidth>
      <DialogTitle>Confirm Transaction Match</DialogTitle>
      <DialogContent>
        <Typography variant="body2" sx={{ mb: 2 }}>
          Are you sure you want to match these transactions?
        </Typography>
        <TextField
          fullWidth
          label="Notes (Optional)"
          value={notes}
          onChange={(e) => onNotesChange(e.target.value)}
          multiline
          rows={3}
          placeholder="Add any notes about this match..."
        />
      </DialogContent>
      <DialogActions>
        <Button onClick={onCancel}>Cancel</Button>
        <Button onClick={onConfirm} variant="contained">
          Confirm Match
        </Button>
      </DialogActions>
    </Dialog>
  );
}
