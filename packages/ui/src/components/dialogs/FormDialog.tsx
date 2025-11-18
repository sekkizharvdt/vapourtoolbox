'use client';

import { ReactNode } from 'react';
import {
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Button,
  Alert,
  Box,
  CircularProgress,
} from '@mui/material';

interface FormDialogProps {
  open: boolean;
  onClose: () => void;
  title: string;
  loading?: boolean;
  error?: string;
  onError?: (error: string) => void;
  children: ReactNode;
  actions?: ReactNode;
  maxWidth?: 'xs' | 'sm' | 'md' | 'lg' | 'xl';
  fullWidth?: boolean;
}

/**
 * Reusable dialog wrapper for forms
 * Provides consistent error handling, loading states, and layout
 */
export function FormDialog({
  open,
  onClose,
  title,
  loading = false,
  error,
  onError,
  children,
  actions,
  maxWidth = 'md',
  fullWidth = true,
}: FormDialogProps) {
  const handleClose = () => {
    if (!loading) {
      onClose();
    }
  };

  return (
    <Dialog open={open} onClose={handleClose} maxWidth={maxWidth} fullWidth={fullWidth}>
      <DialogTitle>{title}</DialogTitle>
      <DialogContent>
        <Box sx={{ pt: 2 }}>
          {children}

          {error && (
            <Alert
              severity="error"
              sx={{ mt: 2 }}
              onClose={onError ? () => onError('') : undefined}
            >
              {error}
            </Alert>
          )}

          {loading && (
            <Box sx={{ display: 'flex', justifyContent: 'center', mt: 2 }}>
              <CircularProgress />
            </Box>
          )}
        </Box>
      </DialogContent>

      {actions && <DialogActions>{actions}</DialogActions>}
    </Dialog>
  );
}

interface FormDialogActionsProps {
  onCancel: () => void;
  onSubmit: () => void;
  loading?: boolean;
  submitLabel?: string;
  cancelLabel?: string;
  submitDisabled?: boolean;
}

/**
 * Standard action buttons for FormDialog
 */
export function FormDialogActions({
  onCancel,
  onSubmit,
  loading = false,
  submitLabel = 'Save',
  cancelLabel = 'Cancel',
  submitDisabled = false,
}: FormDialogActionsProps) {
  return (
    <>
      <Button onClick={onCancel} disabled={loading}>
        {cancelLabel}
      </Button>
      <Button onClick={onSubmit} variant="contained" disabled={loading || submitDisabled}>
        {loading ? 'Saving...' : submitLabel}
      </Button>
    </>
  );
}
