'use client';

import { useState, useCallback, createContext, useContext, ReactNode } from 'react';
import {
  Dialog,
  DialogTitle,
  DialogContent,
  DialogContentText,
  DialogActions,
  Button,
} from '@mui/material';

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

/**
 * Standalone ConfirmDialog component for cases where you manage state externally.
 *
 * @example
 * ```tsx
 * const [open, setOpen] = useState(false);
 *
 * <ConfirmDialog
 *   open={open}
 *   title="Delete Item"
 *   message="Are you sure?"
 *   onConfirm={() => { deleteItem(); setOpen(false); }}
 *   onCancel={() => setOpen(false)}
 * />
 * ```
 */
export function ConfirmDialog({
  open,
  title = 'Confirm',
  message,
  confirmText = 'Confirm',
  cancelText = 'Cancel',
  confirmColor = 'primary',
  focusConfirm = false,
  onConfirm,
  onCancel,
}: {
  open: boolean;
  title?: string;
  message: string;
  confirmText?: string;
  cancelText?: string;
  confirmColor?: 'primary' | 'secondary' | 'error' | 'warning' | 'info' | 'success';
  focusConfirm?: boolean;
  onConfirm: () => void;
  onCancel: () => void;
}) {
  return (
    <Dialog
      open={open}
      onClose={onCancel}
      aria-labelledby="confirm-dialog-title"
      aria-describedby="confirm-dialog-description"
      maxWidth="xs"
      fullWidth
    >
      <DialogTitle id="confirm-dialog-title">{title}</DialogTitle>
      <DialogContent>
        <DialogContentText id="confirm-dialog-description">{message}</DialogContentText>
      </DialogContent>
      <DialogActions>
        <Button onClick={onCancel} autoFocus={!focusConfirm} color="inherit">
          {cancelText}
        </Button>
        <Button
          onClick={onConfirm}
          autoFocus={focusConfirm}
          color={confirmColor}
          variant="contained"
        >
          {confirmText}
        </Button>
      </DialogActions>
    </Dialog>
  );
}
