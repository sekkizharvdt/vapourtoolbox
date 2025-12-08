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
import { doc, updateDoc, Timestamp } from 'firebase/firestore';
import { getFirebase } from '@/lib/firebase';
import { COLLECTIONS } from '@vapour/firebase';
import type { BusinessEntity } from '@vapour/types';

interface UnarchiveEntityDialogProps {
  open: boolean;
  entity: BusinessEntity | null;
  onClose: () => void;
  onSuccess: () => void;
}

export function UnarchiveEntityDialog({
  open,
  entity,
  onClose,
  onSuccess,
}: UnarchiveEntityDialogProps) {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const handleUnarchive = async () => {
    if (!entity?.id) return;

    setLoading(true);
    setError('');

    try {
      const { db } = getFirebase();
      const entityRef = doc(db, COLLECTIONS.ENTITIES, entity.id);

      // Unarchive the entity
      await updateDoc(entityRef, {
        isActive: true,
        isArchived: false,
        archivedAt: null,
        archivedBy: null,
        archivedByName: null,
        archiveReason: null,
        updatedAt: Timestamp.now(),
      });

      onSuccess();
      onClose();
    } catch (err: unknown) {
      console.error('Error unarchiving entity:', err);
      const errorMessage =
        err instanceof Error ? err.message : 'Failed to unarchive entity. Please try again.';
      setError(errorMessage);
    } finally {
      setLoading(false);
    }
  };

  const handleClose = () => {
    if (!loading) {
      setError('');
      onClose();
    }
  };

  // Format archive date for display
  const formatDate = (date: Date | undefined) => {
    if (!date) return 'Unknown';
    return new Date(date).toLocaleDateString('en-IN', {
      day: 'numeric',
      month: 'short',
      year: 'numeric',
    });
  };

  return (
    <Dialog open={open} onClose={handleClose} maxWidth="sm" fullWidth>
      <DialogTitle>Unarchive Entity</DialogTitle>
      <DialogContent>
        <Typography gutterBottom>
          Do you want to restore <strong>{entity?.name}</strong> to active status?
        </Typography>

        {entity?.archiveReason && (
          <Box sx={{ mt: 2, p: 2, bgcolor: 'action.hover', borderRadius: 1 }}>
            <Typography variant="caption" color="text.secondary">
              Archive Reason
            </Typography>
            <Typography variant="body2">{entity.archiveReason}</Typography>
            <Typography variant="caption" color="text.secondary" sx={{ mt: 1, display: 'block' }}>
              Archived by {entity.archivedByName || 'Unknown'} on {formatDate(entity.archivedAt)}
            </Typography>
          </Box>
        )}

        {error && (
          <Alert severity="error" sx={{ mt: 2 }}>
            {error}
          </Alert>
        )}
      </DialogContent>
      <DialogActions sx={{ px: 3, pb: 2 }}>
        <Button onClick={handleClose} disabled={loading}>
          Cancel
        </Button>
        <Button
          onClick={handleUnarchive}
          variant="contained"
          color="success"
          disabled={loading}
          startIcon={loading && <CircularProgress size={20} />}
        >
          {loading ? 'Restoring...' : 'Restore Entity'}
        </Button>
      </DialogActions>
    </Dialog>
  );
}
