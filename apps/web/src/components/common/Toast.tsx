'use client';

import { useState, useCallback, createContext, useContext, ReactNode } from 'react';
import { Snackbar, Alert, AlertColor, Slide, SlideProps } from '@mui/material';

/**
 * Toast/Snackbar Provider
 *
 * A global toast notification system for ephemeral UI feedback.
 * Use this for success/error messages after form submissions.
 *
 * This is DIFFERENT from NotificationCenter:
 * - Toast: Ephemeral UI feedback (auto-dismisses, not persisted)
 * - NotificationCenter: Persistent activity notifications (stored in Firestore)
 *
 * @example
 * ```tsx
 * const { toast } = useToast();
 *
 * // After successful operation
 * toast.success('Invoice created successfully');
 *
 * // After error
 * toast.error('Failed to save changes');
 *
 * // With custom options
 * toast.info('Processing...', { duration: 10000 });
 * ```
 */

interface ToastOptions {
  /** Duration in milliseconds before auto-hide. Default: 6000 (6 seconds) */
  duration?: number;
  /** Anchor origin for positioning. Default: bottom-right */
  position?: {
    vertical: 'top' | 'bottom';
    horizontal: 'left' | 'center' | 'right';
  };
}

interface ToastState {
  open: boolean;
  message: string;
  severity: AlertColor;
  duration: number;
  position: {
    vertical: 'top' | 'bottom';
    horizontal: 'left' | 'center' | 'right';
  };
}

interface ToastContextValue {
  /** Show a success toast */
  success: (message: string, options?: ToastOptions) => void;
  /** Show an error toast */
  error: (message: string, options?: ToastOptions) => void;
  /** Show an info toast */
  info: (message: string, options?: ToastOptions) => void;
  /** Show a warning toast */
  warning: (message: string, options?: ToastOptions) => void;
  /** Generic toast with custom severity */
  show: (message: string, severity: AlertColor, options?: ToastOptions) => void;
  /** Dismiss the current toast */
  dismiss: () => void;
}

const ToastContext = createContext<ToastContextValue | null>(null);

const DEFAULT_DURATION = 6000;
const DEFAULT_POSITION = { vertical: 'bottom' as const, horizontal: 'right' as const };

/**
 * Hook to show toast notifications.
 * Must be used within a ToastProvider.
 *
 * @example
 * ```tsx
 * const { toast } = useToast();
 *
 * const handleSave = async () => {
 *   try {
 *     await saveData();
 *     toast.success('Changes saved successfully');
 *   } catch (error) {
 *     toast.error('Failed to save changes');
 *   }
 * };
 * ```
 */
export function useToast(): { toast: ToastContextValue } {
  const context = useContext(ToastContext);
  if (!context) {
    throw new Error('useToast must be used within a ToastProvider');
  }
  return { toast: context };
}

interface ToastProviderProps {
  children: ReactNode;
}

// Slide transition from right
function SlideTransition(props: SlideProps) {
  return <Slide {...props} direction="left" />;
}

/**
 * Provider component for toast notifications.
 * Already included in ClientProviders - no need to add manually.
 *
 * @example
 * ```tsx
 * <ToastProvider>
 *   <App />
 * </ToastProvider>
 * ```
 */
export function ToastProvider({ children }: ToastProviderProps) {
  const [state, setState] = useState<ToastState>({
    open: false,
    message: '',
    severity: 'info',
    duration: DEFAULT_DURATION,
    position: DEFAULT_POSITION,
  });

  const show = useCallback((message: string, severity: AlertColor, options?: ToastOptions) => {
    setState({
      open: true,
      message,
      severity,
      duration: options?.duration ?? DEFAULT_DURATION,
      position: options?.position ?? DEFAULT_POSITION,
    });
  }, []);

  const success = useCallback(
    (message: string, options?: ToastOptions) => show(message, 'success', options),
    [show]
  );

  const error = useCallback(
    (message: string, options?: ToastOptions) => show(message, 'error', options),
    [show]
  );

  const info = useCallback(
    (message: string, options?: ToastOptions) => show(message, 'info', options),
    [show]
  );

  const warning = useCallback(
    (message: string, options?: ToastOptions) => show(message, 'warning', options),
    [show]
  );

  const dismiss = useCallback(() => {
    setState((prev) => ({ ...prev, open: false }));
  }, []);

  const handleClose = useCallback(
    (_event?: React.SyntheticEvent | Event, reason?: string) => {
      // Don't close on clickaway - only on timeout or explicit close
      if (reason === 'clickaway') {
        return;
      }
      dismiss();
    },
    [dismiss]
  );

  return (
    <ToastContext.Provider value={{ success, error, info, warning, show, dismiss }}>
      {children}
      <Snackbar
        open={state.open}
        autoHideDuration={state.duration}
        onClose={handleClose}
        anchorOrigin={state.position}
        TransitionComponent={SlideTransition}
      >
        <Alert
          onClose={handleClose}
          severity={state.severity}
          variant="filled"
          sx={{ width: '100%', minWidth: 300 }}
        >
          {state.message}
        </Alert>
      </Snackbar>
    </ToastContext.Provider>
  );
}
