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
  Box,
} from '@mui/material';
import { doc, updateDoc, Timestamp } from 'firebase/firestore';
import { getFirebase } from '@/lib/firebase';
import { COLLECTIONS } from '@vapour/firebase';
import type { Project } from '@vapour/types';
import { useAuth } from '@/contexts/AuthContext';

interface DeleteProjectDialogProps {
  open: boolean;
  project: Project | null;
  onClose: () => void;
  onSuccess: () => void;
}

export function DeleteProjectDialog({ open, project, onClose, onSuccess }: DeleteProjectDialogProps) {
  const { user } = useAuth();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const handleDelete = async () => {
    if (!project) return;

    try {
      setLoading(true);
      setError('');

      const { db } = getFirebase();
      const projectRef = doc(db, COLLECTIONS.PROJECTS, project.id);

      // Soft delete
      await updateDoc(projectRef, {
        isActive: false,
        isDeleted: true,
        status: 'ARCHIVED',
        updatedAt: Timestamp.now(),
        updatedBy: user?.uid || '',
      });

      onSuccess();
    } catch (err) {
      console.error('Error deleting project:', err);
      setError('Failed to delete project. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  if (!project) return null;

  return (
    <Dialog open={open} onClose={onClose} maxWidth="sm" fullWidth>
      <DialogTitle>Delete Project</DialogTitle>
      <DialogContent>
        {error && <Alert severity="error" sx={{ mb: 2 }}>{error}</Alert>}

        <Typography variant="body1" gutterBottom>
          Are you sure you want to delete this project?
        </Typography>

        <Box sx={{ mt: 2, p: 2, bgcolor: 'grey.100', borderRadius: 1 }}>
          <Typography variant="body2" color="text.secondary">
            <strong>Project:</strong> {project.name}
          </Typography>
          <Typography variant="body2" color="text.secondary">
            <strong>Code:</strong> {project.code}
          </Typography>
          <Typography variant="body2" color="text.secondary">
            <strong>Client:</strong> {project.client.entityName}
          </Typography>
        </Box>

        <Alert severity="warning" sx={{ mt: 2 }}>
          This will archive the project and mark it as inactive. The project data will be preserved but hidden from active lists.
        </Alert>
      </DialogContent>
      <DialogActions>
        <Button onClick={onClose} disabled={loading}>
          Cancel
        </Button>
        <Button
          onClick={handleDelete}
          variant="contained"
          color="error"
          disabled={loading}
        >
          {loading ? 'Deleting...' : 'Delete Project'}
        </Button>
      </DialogActions>
    </Dialog>
  );
}
