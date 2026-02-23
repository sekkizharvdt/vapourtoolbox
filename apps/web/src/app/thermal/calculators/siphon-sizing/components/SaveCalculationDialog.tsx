'use client';

import { useState } from 'react';
import {
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Button,
  TextField,
  Alert,
  CircularProgress,
} from '@mui/material';
import { Save as SaveIcon } from '@mui/icons-material';
import { getFirebase } from '@/lib/firebase';
import { saveCalculation } from '@/lib/thermal/savedCalculationService';
import { useAuth } from '@/contexts/AuthContext';
import type { SavedCalculation } from '@vapour/types';

interface SaveCalculationDialogProps {
  open: boolean;
  onClose: () => void;
  inputs: Record<string, unknown>;
  calculatorType?: SavedCalculation['calculatorType'];
}

export function SaveCalculationDialog({
  open,
  onClose,
  inputs,
  calculatorType = 'SIPHON_SIZING',
}: SaveCalculationDialogProps) {
  const { user } = useAuth();
  const [name, setName] = useState('');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSave = async () => {
    if (!user || !name.trim()) return;
    setSaving(true);
    setError(null);

    try {
      const { db } = getFirebase();
      await saveCalculation(db, user.uid, calculatorType, name.trim(), inputs);
      setName('');
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to save');
    } finally {
      setSaving(false);
    }
  };

  const handleClose = () => {
    if (!saving) {
      setError(null);
      setName('');
      onClose();
    }
  };

  return (
    <Dialog open={open} onClose={handleClose} maxWidth="xs" fullWidth>
      <DialogTitle>Save Calculation</DialogTitle>
      <DialogContent>
        {error && (
          <Alert severity="error" sx={{ mb: 2 }}>
            {error}
          </Alert>
        )}
        <TextField
          label="Name"
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="E.g., MED Unit 1 — S-101/102"
          fullWidth
          autoFocus
          sx={{ mt: 1 }}
        />
      </DialogContent>
      <DialogActions>
        <Button onClick={handleClose} disabled={saving}>
          Cancel
        </Button>
        <Button
          onClick={handleSave}
          variant="contained"
          disabled={saving || !name.trim() || !user}
          startIcon={saving ? <CircularProgress size={20} /> : <SaveIcon />}
        >
          {saving ? 'Saving...' : 'Save'}
        </Button>
      </DialogActions>
    </Dialog>
  );
}
