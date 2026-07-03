'use client';

import { useState, useCallback, createContext, useContext, ReactNode } from 'react';
import {
  Dialog,
  DialogTitle,
  DialogContent,
  DialogContentText,
  DialogActions,
  Button,
  Typography,
  Alert,
  CircularProgress,
  Box,
} from '@mui/material';
import { Warning as WarningIcon, Error as ErrorIcon, Info as InfoIcon } from '@mui/icons-material';

interface ConfirmDialogOptions {
  title?: string;
  message: string;
  confirmText?: string;
  cancelText?: string;
  confirmColor?: 'primary' | 'secondary' | 'error' | 'warning' | 'info' | 'success';
  /**
   * If true, the confirm button will be focused by default (use for non-destructive actions)
   * If false, the cancel button will be focused (use for destructive actions like delete)
   */
  focusConfirm?: boolean;
}

interface ConfirmDialogState extends ConfirmDialogOptions {
  open: boolean;
  resolve: ((value: boolean) => void) | null;
}

interface ConfirmDialogContextValue {
  confirm: (options: ConfirmDialogOptions) => Promise<boolean>;
}

const ConfirmDialogContext = createContext<ConfirmDialogContextValue | null>(null);

/**
 * Hook to show a confirm dialog.
 * Must be used within a ConfirmDialogProvider.
 *
 * @example
 * ```tsx
 * const { confirm } = useConfirmDialog();
 *
 * const handleDelete = async () => {
 *   const confirmed = await confirm({
 *     title: 'Delete Item',
 *     message: 'Are you sure you want to delete this item? This action cannot be undone.',
 *     confirmText: 'Delete',
 *     confirmColor: 'error',
 *   });
 *
 *   if (confirmed) {
 *     await deleteItem();
 *   }
 * };
 * ```
 */
export function useConfirmDialog(): ConfirmDialogContextValue {
  const context = useContext(ConfirmDialogContext);
  if (!context) {
    throw new Error('useConfirmDialog must be used within a ConfirmDialogProvider');
  }
  return context;
}

interface ConfirmDialogProviderProps {
  children: ReactNode;
}

/**
 * Provider component for the confirm dialog.
 * Wrap your app or a section with this to enable useConfirmDialog.
 *
 * @example
 * ```tsx
 * <ConfirmDialogProvider>
 *   <App />
 * </ConfirmDialogProvider>
 * ```
 */
export function ConfirmDialogProvider({ children }: ConfirmDialogProviderProps) {
  const [state, setState] = useState<ConfirmDialogState>({
    open: false,
    title: '',
    message: '',
    confirmText: 'Confirm',
    cancelText: 'Cancel',
    confirmColor: 'primary',
    focusConfirm: false,
    resolve: null,
  });

  const confirm = useCallback((options: ConfirmDialogOptions): Promise<boolean> => {
    return new Promise((resolve) => {
      setState({
        open: true,
        title: options.title || 'Confirm',
        message: options.message,
        confirmText: options.confirmText || 'Confirm',
        cancelText: options.cancelText || 'Cancel',
        confirmColor: options.confirmColor || 'primary',
        focusConfirm: options.focusConfirm ?? false,
        resolve,
      });
    });
  }, []);

  const handleClose = useCallback((confirmed: boolean) => {
    setState((prev) => {
      if (prev.resolve) {
        prev.resolve(confirmed);
      }
      return {
        ...prev,
        open: false,
        resolve: null,
      };
    });
  }, []);

  return (
    <ConfirmDialogContext.Provider value={{ confirm }}>
      {children}
      <Dialog
        open={state.open}
        onClose={() => handleClose(false)}
        aria-labelledby="confirm-dialog-title"
        aria-describedby="confirm-dialog-description"
        maxWidth="xs"
        fullWidth
      >
        {state.title && <DialogTitle id="confirm-dialog-title">{state.title}</DialogTitle>}
        <DialogContent>
          <DialogContentText id="confirm-dialog-description">{state.message}</DialogContentText>
        </DialogContent>
        <DialogActions>
          <Button
            onClick={() => handleClose(false)}
            autoFocus={!state.focusConfirm}
            color="inherit"
          >
            {state.cancelText}
          </Button>
          <Button
            onClick={() => handleClose(true)}
            autoFocus={state.focusConfirm}
            color={state.confirmColor}
            variant="contained"
          >
            {state.confirmText}
          </Button>
        </DialogActions>
      </Dialog>
    </ConfirmDialogContext.Provider>
  );
}

interface ConfirmDialogProps {
  open: boolean;
  onClose: () => void;
  onConfirm: () => void | Promise<void>;
  title: string;
  message: string | ReactNode;
  description?: string | ReactNode;
  confirmLabel?: string;
  cancelLabel?: string;
  variant?: 'warning' | 'error' | 'info';
  loading?: boolean;
  error?: string;
  warning?: string;
  maxWidth?: 'xs' | 'sm' | 'md' | 'lg' | 'xl';
}

/**
 * Standalone ConfirmDialog component for cases where you manage open/loading
 * state externally (e.g. per-row delete confirmations). For simple one-shot
 * confirms, prefer the `useConfirmDialog()` hook above instead.
 *
 * @example
 * ```tsx
 * <ConfirmDialog
 *   open={open}
 *   onClose={handleClose}
 *   onConfirm={handleDelete}
 *   title="Delete Entity"
 *   message="Are you sure you want to delete this entity?"
 *   description="This action cannot be undone."
 *   variant="error"
 *   confirmLabel="Delete"
 *   loading={deleting}
 * />
 * ```
 */
export function ConfirmDialog({
  open,
  onClose,
  onConfirm,
  title,
  message,
  description,
  confirmLabel = 'Confirm',
  cancelLabel = 'Cancel',
  variant = 'warning',
  loading = false,
  error,
  warning,
  maxWidth = 'sm',
}: ConfirmDialogProps) {
  const handleConfirm = async () => {
    await onConfirm();
  };

  const getIcon = () => {
    switch (variant) {
      case 'error':
        return <ErrorIcon color="error" />;
      case 'info':
        return <InfoIcon color="info" />;
      case 'warning':
      default:
        return <WarningIcon color="warning" />;
    }
  };

  const getButtonColor = () => {
    switch (variant) {
      case 'error':
        return 'error';
      case 'info':
        return 'primary';
      case 'warning':
      default:
        return 'warning';
    }
  };

  return (
    <Dialog open={open} onClose={loading ? undefined : onClose} maxWidth={maxWidth} fullWidth>
      <DialogTitle>
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
          {getIcon()}
          {title}
        </Box>
      </DialogTitle>
      <DialogContent>
        {error && (
          <Alert severity="error" sx={{ mb: 2 }}>
            {error}
          </Alert>
        )}

        {warning && (
          <Alert severity="warning" sx={{ mb: 2 }}>
            {warning}
          </Alert>
        )}

        <Typography variant="body1" gutterBottom>
          {message}
        </Typography>

        {description && (
          <Typography variant="body2" color="text.secondary" sx={{ mt: 1 }}>
            {description}
          </Typography>
        )}
      </DialogContent>
      <DialogActions sx={{ px: 3, pb: 3 }}>
        <Button onClick={onClose} disabled={loading}>
          {cancelLabel}
        </Button>
        <Button
          onClick={handleConfirm}
          variant="contained"
          color={getButtonColor()}
          disabled={loading}
          startIcon={loading && <CircularProgress size={20} />}
        >
          {loading ? 'Processing...' : confirmLabel}
        </Button>
      </DialogActions>
    </Dialog>
  );
}
