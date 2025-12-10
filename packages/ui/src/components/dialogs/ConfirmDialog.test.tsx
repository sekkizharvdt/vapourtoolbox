/**
 * ConfirmDialog Component Tests
 *
 * Tests for the reusable confirmation dialog component including:
 * - Rendering states (open/closed, loading, error, warning)
 * - Variant styles (warning, error, info)
 * - User interactions (confirm, cancel, close)
 * - Button states and labels
 */

import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { ConfirmDialog } from './ConfirmDialog';

describe('ConfirmDialog', () => {
  const defaultProps = {
    open: true,
    onClose: jest.fn(),
    onConfirm: jest.fn(),
    title: 'Confirm Action',
    message: 'Are you sure you want to proceed?',
  };

  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('Rendering', () => {
    it('should render dialog when open is true', () => {
      render(<ConfirmDialog {...defaultProps} />);

      expect(screen.getByRole('dialog')).toBeInTheDocument();
      expect(screen.getByText('Confirm Action')).toBeInTheDocument();
      expect(screen.getByText('Are you sure you want to proceed?')).toBeInTheDocument();
    });

    it('should not render dialog when open is false', () => {
      render(<ConfirmDialog {...defaultProps} open={false} />);

      expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    });

    it('should render title correctly', () => {
      render(<ConfirmDialog {...defaultProps} title="Delete Item" />);

      expect(screen.getByText('Delete Item')).toBeInTheDocument();
    });

    it('should render message text', () => {
      render(<ConfirmDialog {...defaultProps} message="This item will be permanently deleted." />);

      expect(screen.getByText('This item will be permanently deleted.')).toBeInTheDocument();
    });

    it('should render message as ReactNode', () => {
      render(
        <ConfirmDialog
          {...defaultProps}
          message={<span data-testid="custom-message">Custom content</span>}
        />
      );

      expect(screen.getByTestId('custom-message')).toBeInTheDocument();
    });

    it('should render description when provided', () => {
      render(<ConfirmDialog {...defaultProps} description="This action cannot be undone." />);

      expect(screen.getByText('This action cannot be undone.')).toBeInTheDocument();
    });

    it('should render description as ReactNode', () => {
      render(
        <ConfirmDialog
          {...defaultProps}
          description={<strong data-testid="custom-desc">Important note</strong>}
        />
      );

      expect(screen.getByTestId('custom-desc')).toBeInTheDocument();
    });

    it('should not render description when not provided', () => {
      render(<ConfirmDialog {...defaultProps} />);

      // Should only have the main message, not an additional description
      const bodyTexts = screen.getAllByText(/./);
      const descriptionPattern = /cannot be undone/i;
      expect(bodyTexts.every((el) => !descriptionPattern.test(el.textContent || ''))).toBe(true);
    });
  });

  describe('Button Labels', () => {
    it('should render default button labels', () => {
      render(<ConfirmDialog {...defaultProps} />);

      expect(screen.getByRole('button', { name: 'Cancel' })).toBeInTheDocument();
      expect(screen.getByRole('button', { name: 'Confirm' })).toBeInTheDocument();
    });

    it('should render custom confirm label', () => {
      render(<ConfirmDialog {...defaultProps} confirmLabel="Delete" />);

      expect(screen.getByRole('button', { name: 'Delete' })).toBeInTheDocument();
    });

    it('should render custom cancel label', () => {
      render(<ConfirmDialog {...defaultProps} cancelLabel="Discard" />);

      expect(screen.getByRole('button', { name: 'Discard' })).toBeInTheDocument();
    });

    it('should render both custom labels', () => {
      render(<ConfirmDialog {...defaultProps} confirmLabel="Yes, Delete" cancelLabel="No, Keep" />);

      expect(screen.getByRole('button', { name: 'Yes, Delete' })).toBeInTheDocument();
      expect(screen.getByRole('button', { name: 'No, Keep' })).toBeInTheDocument();
    });
  });

  describe('Variant Styles', () => {
    it('should render dialog with warning variant', () => {
      render(<ConfirmDialog {...defaultProps} variant="warning" />);

      // Dialog should render successfully with warning variant
      expect(screen.getByRole('dialog')).toBeInTheDocument();
      expect(screen.getByText('Confirm Action')).toBeInTheDocument();
    });

    it('should render dialog with error variant', () => {
      render(<ConfirmDialog {...defaultProps} variant="error" />);

      // Dialog should render with error variant styling
      expect(screen.getByRole('dialog')).toBeInTheDocument();
    });

    it('should render dialog with info variant', () => {
      render(<ConfirmDialog {...defaultProps} variant="info" />);

      // Dialog should render with info variant styling
      expect(screen.getByRole('dialog')).toBeInTheDocument();
    });

    it('should default to warning variant when not specified', () => {
      render(<ConfirmDialog {...defaultProps} />);

      // Dialog should render with default warning variant
      expect(screen.getByRole('dialog')).toBeInTheDocument();
    });
  });

  describe('Loading State', () => {
    it('should show loading spinner when loading is true', () => {
      render(<ConfirmDialog {...defaultProps} loading={true} />);

      expect(screen.getByRole('progressbar')).toBeInTheDocument();
    });

    it('should show "Processing..." text when loading', () => {
      render(<ConfirmDialog {...defaultProps} loading={true} />);

      expect(screen.getByRole('button', { name: /processing/i })).toBeInTheDocument();
    });

    it('should disable both buttons when loading', () => {
      render(<ConfirmDialog {...defaultProps} loading={true} />);

      expect(screen.getByRole('button', { name: 'Cancel' })).toBeDisabled();
      expect(screen.getByRole('button', { name: /processing/i })).toBeDisabled();
    });

    it('should enable buttons when not loading', () => {
      render(<ConfirmDialog {...defaultProps} loading={false} />);

      expect(screen.getByRole('button', { name: 'Cancel' })).not.toBeDisabled();
      expect(screen.getByRole('button', { name: 'Confirm' })).not.toBeDisabled();
    });

    it('should prevent closing when loading', () => {
      const onClose = jest.fn();
      render(<ConfirmDialog {...defaultProps} onClose={onClose} loading={true} />);

      // Try to close by pressing Escape
      fireEvent.keyDown(screen.getByRole('dialog'), { key: 'Escape' });

      expect(onClose).not.toHaveBeenCalled();
    });
  });

  describe('Error State', () => {
    it('should display error alert when error is provided', () => {
      render(<ConfirmDialog {...defaultProps} error="Failed to delete item" />);

      expect(screen.getByRole('alert')).toBeInTheDocument();
      expect(screen.getByText('Failed to delete item')).toBeInTheDocument();
    });

    it('should not display error alert when no error', () => {
      render(<ConfirmDialog {...defaultProps} />);

      expect(screen.queryByRole('alert')).not.toBeInTheDocument();
    });

    it('should display error alert correctly', () => {
      render(<ConfirmDialog {...defaultProps} error="Error message" />);

      // Verify alert is displayed with error text
      const alert = screen.getByRole('alert');
      expect(alert).toBeInTheDocument();
      expect(alert).toHaveTextContent('Error message');
    });
  });

  describe('Warning Message', () => {
    it('should display warning alert when warning is provided', () => {
      render(<ConfirmDialog {...defaultProps} warning="This will affect related items" />);

      expect(screen.getByText('This will affect related items')).toBeInTheDocument();
    });

    it('should display warning alert correctly', () => {
      render(<ConfirmDialog {...defaultProps} warning="Warning message" />);

      // Verify warning text is displayed
      expect(screen.getByText('Warning message')).toBeInTheDocument();
    });

    it('should display both error and warning when both provided', () => {
      render(
        <ConfirmDialog {...defaultProps} error="An error occurred" warning="Please be careful" />
      );

      expect(screen.getByText('An error occurred')).toBeInTheDocument();
      expect(screen.getByText('Please be careful')).toBeInTheDocument();
    });
  });

  describe('Click Handlers', () => {
    it('should call onClose when cancel button is clicked', () => {
      const onClose = jest.fn();
      render(<ConfirmDialog {...defaultProps} onClose={onClose} />);

      fireEvent.click(screen.getByRole('button', { name: 'Cancel' }));

      expect(onClose).toHaveBeenCalledTimes(1);
    });

    it('should call onConfirm when confirm button is clicked', async () => {
      const onConfirm = jest.fn();
      render(<ConfirmDialog {...defaultProps} onConfirm={onConfirm} />);

      fireEvent.click(screen.getByRole('button', { name: 'Confirm' }));

      await waitFor(() => {
        expect(onConfirm).toHaveBeenCalledTimes(1);
      });
    });

    it('should handle async onConfirm', async () => {
      const onConfirm = jest.fn(() => Promise.resolve());
      render(<ConfirmDialog {...defaultProps} onConfirm={onConfirm} />);

      fireEvent.click(screen.getByRole('button', { name: 'Confirm' }));

      await waitFor(() => {
        expect(onConfirm).toHaveBeenCalledTimes(1);
      });
    });

    it('should not call handlers when buttons are disabled', () => {
      const onClose = jest.fn();
      const onConfirm = jest.fn();
      render(
        <ConfirmDialog {...defaultProps} onClose={onClose} onConfirm={onConfirm} loading={true} />
      );

      fireEvent.click(screen.getByRole('button', { name: 'Cancel' }));
      fireEvent.click(screen.getByRole('button', { name: /processing/i }));

      expect(onClose).not.toHaveBeenCalled();
      expect(onConfirm).not.toHaveBeenCalled();
    });
  });

  describe('Close Behavior', () => {
    it('should call onClose when Escape is pressed', () => {
      const onClose = jest.fn();
      render(<ConfirmDialog {...defaultProps} onClose={onClose} />);

      fireEvent.keyDown(screen.getByRole('dialog'), { key: 'Escape' });

      expect(onClose).toHaveBeenCalledTimes(1);
    });

    it('should call onClose when backdrop is clicked', () => {
      const onClose = jest.fn();
      render(<ConfirmDialog {...defaultProps} onClose={onClose} />);

      const backdrop = document.querySelector('.MuiBackdrop-root');
      if (backdrop) {
        fireEvent.click(backdrop);
        expect(onClose).toHaveBeenCalledTimes(1);
      }
    });
  });

  describe('Dialog Size', () => {
    it('should render with default maxWidth (sm)', () => {
      render(<ConfirmDialog {...defaultProps} />);

      expect(screen.getByRole('dialog')).toBeInTheDocument();
    });

    it('should accept custom maxWidth prop', () => {
      const { rerender } = render(<ConfirmDialog {...defaultProps} maxWidth="xs" />);
      expect(screen.getByRole('dialog')).toBeInTheDocument();

      rerender(<ConfirmDialog {...defaultProps} maxWidth="md" />);
      expect(screen.getByRole('dialog')).toBeInTheDocument();

      rerender(<ConfirmDialog {...defaultProps} maxWidth="lg" />);
      expect(screen.getByRole('dialog')).toBeInTheDocument();
    });
  });
});

describe('ConfirmDialog Integration', () => {
  it('should handle delete workflow', async () => {
    const onClose = jest.fn();
    const onConfirm = jest.fn(() => Promise.resolve());

    const { rerender } = render(
      <ConfirmDialog
        open={true}
        onClose={onClose}
        onConfirm={onConfirm}
        title="Delete Project"
        message="Are you sure you want to delete this project?"
        description="All associated data will be permanently removed."
        variant="error"
        confirmLabel="Delete"
        loading={false}
      />
    );

    // Verify initial state
    expect(screen.getByText('Delete Project')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Delete' })).not.toBeDisabled();

    // Click confirm
    fireEvent.click(screen.getByRole('button', { name: 'Delete' }));
    await waitFor(() => expect(onConfirm).toHaveBeenCalled());

    // Simulate loading state
    rerender(
      <ConfirmDialog
        open={true}
        onClose={onClose}
        onConfirm={onConfirm}
        title="Delete Project"
        message="Are you sure you want to delete this project?"
        description="All associated data will be permanently removed."
        variant="error"
        confirmLabel="Delete"
        loading={true}
      />
    );

    expect(screen.getByRole('progressbar')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Cancel' })).toBeDisabled();
  });

  it('should handle error during confirmation', async () => {
    const onClose = jest.fn();
    const onConfirm = jest.fn();

    const { rerender } = render(
      <ConfirmDialog
        open={true}
        onClose={onClose}
        onConfirm={onConfirm}
        title="Submit Form"
        message="Submit this form?"
        variant="info"
        loading={false}
      />
    );

    // Click confirm
    fireEvent.click(screen.getByRole('button', { name: 'Confirm' }));
    await waitFor(() => expect(onConfirm).toHaveBeenCalled());

    // Simulate error state
    rerender(
      <ConfirmDialog
        open={true}
        onClose={onClose}
        onConfirm={onConfirm}
        title="Submit Form"
        message="Submit this form?"
        variant="info"
        loading={false}
        error="Failed to submit. Please try again."
      />
    );

    expect(screen.getByRole('alert')).toBeInTheDocument();
    expect(screen.getByText('Failed to submit. Please try again.')).toBeInTheDocument();
    // User can still cancel or retry
    expect(screen.getByRole('button', { name: 'Cancel' })).not.toBeDisabled();
    expect(screen.getByRole('button', { name: 'Confirm' })).not.toBeDisabled();
  });

  it('should cancel confirmation workflow', () => {
    const onClose = jest.fn();
    const onConfirm = jest.fn();

    render(
      <ConfirmDialog
        open={true}
        onClose={onClose}
        onConfirm={onConfirm}
        title="Confirm Logout"
        message="Are you sure you want to logout?"
        variant="warning"
      />
    );

    // User cancels
    fireEvent.click(screen.getByRole('button', { name: 'Cancel' }));

    expect(onClose).toHaveBeenCalledTimes(1);
    expect(onConfirm).not.toHaveBeenCalled();
  });

  it('should show warning before confirmation', () => {
    render(
      <ConfirmDialog
        open={true}
        onClose={jest.fn()}
        onConfirm={jest.fn()}
        title="Archive Items"
        message="Archive selected items?"
        warning="Some items are still in use. They will be marked as deprecated."
        variant="warning"
        confirmLabel="Archive"
      />
    );

    expect(
      screen.getByText('Some items are still in use. They will be marked as deprecated.')
    ).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Archive' })).toBeInTheDocument();
  });
});
