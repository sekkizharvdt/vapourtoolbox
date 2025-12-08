'use client';

import { useState } from 'react';
import {
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Button,
  TextField,
  Typography,
  Alert,
  CircularProgress,
} from '@mui/material';
import { doc, updateDoc, Timestamp } from 'firebase/firestore';
import { getFirebase } from '@/lib/firebase';
import { COLLECTIONS } from '@vapour/firebase';
import type { BusinessEntity } from '@vapour/types';
import { useAuth } from '@/contexts/AuthContext';
import { checkEntityCascadeDelete } from '@/lib/entities/businessEntityService';

interface ArchiveEntityDialogProps {
  open: boolean;
  entity: BusinessEntity | null;
  onClose: () => void;
  onSuccess: () => void;
}

export function ArchiveEntityDialog({
  open,
  entity,
  onClose,
  onSuccess,
}: ArchiveEntityDialogProps) {
  const { user } = useAuth();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [cascadeWarning, setCascadeWarning] = useState<string | null>(null);
  const [reason, setReason] = useState('');

  const handleArchive = async () => {
    if (!entity?.id || !user) return;

    if (!reason.trim()) {
      setError('Please provide a reason for archiving this entity');
      return;
    }

    setLoading(true);
    setError('');
    setCascadeWarning(null);

    try {
      const { db } = getFirebase();

      // Check for cascade issues (active projects, transactions, etc.)
      const cascadeCheck = await checkEntityCascadeDelete(db, entity.id);

      if (!cascadeCheck.canDelete) {
        setCascadeWarning(cascadeCheck.message);
        setLoading(false);
        return;
      }

      const entityRef = doc(db, COLLECTIONS.ENTITIES, entity.id);

      // Archive the entity
      await updateDoc(entityRef, {
        isActive: false,
        isArchived: true,
        archivedAt: Timestamp.now(),
        archivedBy: user.uid,
        archivedByName: user.displayName || user.email || 'Unknown',
        archiveReason: reason.trim(),
        updatedAt: Timestamp.now(),
      });

      // Reset and close
      setReason('');
      onSuccess();
      onClose();
    } catch (err: unknown) {
      console.error('Error archiving entity:', err);
      const errorMessage =
        err instanceof Error ? err.message : 'Failed to archive entity. Please try again.';
      setError(errorMessage);
    } finally {
      setLoading(false);
    }
  };

  const handleClose = () => {
    if (!loading) {
      setReason('');
      setError('');
      setCascadeWarning(null);
      onClose();
    }
  };

  return (
    <Dialog open={open} onClose={handleClose} maxWidth="sm" fullWidth>
      <DialogTitle>Archive Entity</DialogTitle>
      <DialogContent>
        <Typography gutterBottom>
          Are you sure you want to archive <strong>{entity?.name}</strong>?
        </Typography>
        <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
          Archived entities will not appear in active lists but can be unarchived later.
        </Typography>

        {error && (
          <Alert severity="error" sx={{ mb: 2 }}>
            {error}
          </Alert>
        )}

        {cascadeWarning && (
          <Alert severity="warning" sx={{ mb: 2 }}>
            {cascadeWarning}
          </Alert>
        )}

        <TextField
          label="Reason for archiving"
          value={reason}
          onChange={(e) => setReason(e.target.value)}
          multiline
          rows={3}
          fullWidth
          required
          placeholder="e.g., Company closed, No longer a vendor, Merged with another entity..."
          disabled={loading}
          error={!!error && !reason.trim()}
        />
      </DialogContent>
      <DialogActions sx={{ px: 3, pb: 2 }}>
        <Button onClick={handleClose} disabled={loading}>
          Cancel
        </Button>
        <Button
          onClick={handleArchive}
          variant="contained"
          color="warning"
          disabled={loading || !reason.trim()}
          startIcon={loading && <CircularProgress size={20} />}
        >
          {loading ? 'Archiving...' : 'Archive Entity'}
        </Button>
      </DialogActions>
    </Dialog>
  );
}
