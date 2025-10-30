'use client';

import { useState } from 'react';
import {
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Button,
  Typography,
  Alert,
  CircularProgress,
  Box,
} from '@mui/material';
import { Warning as WarningIcon } from '@mui/icons-material';
import { doc, updateDoc, Timestamp } from 'firebase/firestore';
import { getFirebase } from '@/lib/firebase';
import { COLLECTIONS } from '@vapour/firebase';
import type { BusinessEntity } from '@vapour/types';

interface DeleteEntityDialogProps {
  open: boolean;
  entity: BusinessEntity | null;
  onClose: () => void;
  onSuccess: () => void;
}

export function DeleteEntityDialog({ open, entity, onClose, onSuccess }: DeleteEntityDialogProps) {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const handleDelete = async () => {
    if (!entity?.id) return;

    setLoading(true);
    setError('');

    try {
      const { db } = getFirebase();
      const entityRef = doc(db, COLLECTIONS.ENTITIES, entity.id);

      // Soft delete - mark as inactive
      await updateDoc(entityRef, {
        isActive: false,
        status: 'inactive',
        updatedAt: Timestamp.now(),
      });

      onSuccess();
      onClose();
    } catch (err: unknown) {
      console.error('Error deleting entity:', err);
      const errorMessage = err instanceof Error ? err.message : 'Failed to delete entity. Please try again.';
      setError(errorMessage);
    } finally {
      setLoading(false);
    }
  };

  return (
    <Dialog open={open} onClose={onClose} maxWidth="sm" fullWidth>
      <DialogTitle>
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
          <WarningIcon color="error" />
          Delete Entity
        </Box>
      </DialogTitle>
      <DialogContent>
        {error && (
          <Alert severity="error" sx={{ mb: 2 }}>
            {error}
          </Alert>
        )}

        <Typography variant="body1" gutterBottom>
          Are you sure you want to delete <strong>{entity?.name}</strong>?
        </Typography>
        <Typography variant="body2" color="text.secondary">
          This will mark the entity as inactive. The entity and its data will be preserved in the system but will not appear in active lists.
        </Typography>
      </DialogContent>
      <DialogActions sx={{ px: 3, pb: 3 }}>
        <Button onClick={onClose} disabled={loading}>
          Cancel
        </Button>
        <Button
          onClick={handleDelete}
          variant="contained"
          color="error"
          disabled={loading}
          startIcon={loading && <CircularProgress size={20} />}
        >
          {loading ? 'Deleting...' : 'Delete'}
        </Button>
      </DialogActions>
    </Dialog>
  );
}
