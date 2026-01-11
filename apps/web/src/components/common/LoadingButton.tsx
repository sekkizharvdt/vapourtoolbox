'use client';

import { forwardRef } from 'react';
import { Button, ButtonProps, CircularProgress } from '@mui/material';

/**
 * LoadingButton Component
 *
 * A button that shows a loading state with optional text change.
 * Use this for form submissions, async actions, and any button that
 * triggers an operation that takes time.
 *
 * @example
 * ```tsx
 * // Basic usage
 * <LoadingButton loading={isSubmitting}>
 *   Save
 * </LoadingButton>
 *
 * // With loading text
 * <LoadingButton loading={isSubmitting} loadingText="Saving...">
 *   Save
 * </LoadingButton>
 *
 * // With React Query mutation
 * <LoadingButton loading={mutation.isPending} loadingText="Creating...">
 *   Create Invoice
 * </LoadingButton>
 * ```
 */

export interface LoadingButtonProps extends ButtonProps {
  /** Whether the button is in a loading state */
  loading?: boolean;
  /** Text to show while loading. If not provided, shows original children with spinner */
  loadingText?: string;
  /** Size of the loading spinner. Defaults to 16 */
  spinnerSize?: number;
}

export const LoadingButton = forwardRef<HTMLButtonElement, LoadingButtonProps>(
  function LoadingButton(
    { loading = false, loadingText, spinnerSize = 16, children, disabled, ...props },
    ref
  ) {
    return (
      <Button ref={ref} disabled={disabled || loading} {...props}>
        {loading ? (
          <>
            <CircularProgress size={spinnerSize} color="inherit" sx={{ mr: loadingText ? 1 : 0 }} />
            {loadingText || children}
          </>
        ) : (
          children
        )}
      </Button>
    );
  }
);
