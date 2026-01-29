import { useState, useCallback, useEffect } from 'react';

interface UseFormDialogOptions {
  /**
   * Whether the dialog is currently open
   */
  isOpen?: boolean;
  /**
   * Callback when form is reset (dialog opens or closes)
   */
  onReset?: () => void;
}

interface UseFormDialogReturn {
  /**
   * Whether an async operation is in progress
   */
  loading: boolean;
  /**
   * Current error message, or empty string if no error
   */
  error: string;
  /**
   * Set loading state
   */
  setLoading: (loading: boolean) => void;
  /**
   * Set error message
   */
  setError: (error: string) => void;
  /**
   * Clear the current error
   */
  clearError: () => void;
  /**
   * Wrap an async submit handler with loading/error management
   * Automatically sets loading state and catches errors
   *
   * @param handler - Async function to execute
   * @param onSuccess - Optional callback on success
   * @returns Promise that resolves when handler completes
   *
   * @example
   * ```tsx
   * const handleSave = () => handleSubmit(async () => {
   *   await saveData(formData);
   * }, onClose);
   * ```
   */
  handleSubmit: (handler: () => Promise<void>, onSuccess?: () => void) => Promise<void>;
  /**
   * Reset the dialog state (clear loading and error)
   */
  reset: () => void;
}

/**
 * Custom hook for managing common form dialog state.
 * Handles loading state, error display, and submit wrapper.
 * Automatically resets state when dialog opens/closes.
 *
 * @example
 * ```tsx
 * function MyDialog({ open, onClose }) {
 *   const { loading, error, setError, handleSubmit } = useFormDialog({ isOpen: open });
 *
 *   const handleSave = () => handleSubmit(async () => {
 *     const result = await saveData();
 *     if (!result.success) {
 *       throw new Error(result.error);
 *     }
 *   }, onClose);
 *
 *   return (
 *     <FormDialog
 *       open={open}
 *       onClose={onClose}
 *       title="My Form"
 *       loading={loading}
 *       error={error}
 *       onError={setError}
 *       actions={
 *         <FormDialogActions
 *           onCancel={onClose}
 *           onSubmit={handleSave}
 *           loading={loading}
 *         />
 *       }
 *     >
 *       {/* form content *\/}
 *     </FormDialog>
 *   );
 * }
 * ```
 */
export function useFormDialog(options: UseFormDialogOptions = {}): UseFormDialogReturn {
  const { isOpen, onReset } = options;

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const clearError = useCallback(() => {
    setError('');
  }, []);

  const reset = useCallback(() => {
    setLoading(false);
    setError('');
    onReset?.();
  }, [onReset]);

  // Reset state when dialog opens or closes
  useEffect(() => {
    if (isOpen !== undefined) {
      reset();
    }
    // Only trigger on isOpen changes, not on reset reference changes
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isOpen]);

  const handleSubmit = useCallback(
    async (handler: () => Promise<void>, onSuccess?: () => void): Promise<void> => {
      setLoading(true);
      setError('');

      try {
        await handler();
        onSuccess?.();
      } catch (err) {
        const message =
          err instanceof Error
            ? err.message
            : typeof err === 'string'
              ? err
              : 'An unexpected error occurred';
        setError(message);
      } finally {
        setLoading(false);
      }
    },
    []
  );

  return {
    loading,
    error,
    setLoading,
    setError,
    clearError,
    handleSubmit,
    reset,
  };
}
