/**
 * FormDialog Component Tests
 *
 * Tests for the reusable dialog wrapper component including:
 * - Rendering states (open/closed, loading, error)
 * - User interactions (close, submit, cancel)
 * - Props handling
 */

import { render, screen, fireEvent } from '@testing-library/react';
import { FormDialog, FormDialogActions } from './FormDialog';

describe('FormDialog', () => {
  const defaultProps = {
    open: true,
    onClose: jest.fn(),
    title: 'Test Dialog',
    children: <div>Dialog Content</div>,
  };

  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('Rendering', () => {
    it('should render dialog when open is true', () => {
      render(<FormDialog {...defaultProps} />);

      expect(screen.getByRole('dialog')).toBeInTheDocument();
      expect(screen.getByText('Test Dialog')).toBeInTheDocument();
      expect(screen.getByText('Dialog Content')).toBeInTheDocument();
    });

    it('should not render dialog when open is false', () => {
      render(<FormDialog {...defaultProps} open={false} />);

      expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    });

    it('should render title correctly', () => {
      render(<FormDialog {...defaultProps} title="Custom Title" />);

      expect(screen.getByText('Custom Title')).toBeInTheDocument();
    });

    it('should render children content', () => {
      render(
        <FormDialog {...defaultProps}>
          <input placeholder="Name" />
          <input placeholder="Email" />
        </FormDialog>
      );

      expect(screen.getByPlaceholderText('Name')).toBeInTheDocument();
      expect(screen.getByPlaceholderText('Email')).toBeInTheDocument();
    });

    it('should render actions when provided', () => {
      render(
        <FormDialog {...defaultProps} actions={<button>Submit</button>}>
          Content
        </FormDialog>
      );

      expect(screen.getByRole('button', { name: 'Submit' })).toBeInTheDocument();
    });

    it('should not render actions section when not provided', () => {
      const { container } = render(<FormDialog {...defaultProps} />);

      // DialogActions has specific MUI class
      expect(container.querySelector('.MuiDialogActions-root')).not.toBeInTheDocument();
    });
  });

  describe('Loading State', () => {
    it('should show loading spinner when loading is true', () => {
      render(<FormDialog {...defaultProps} loading={true} />);

      expect(screen.getByRole('progressbar')).toBeInTheDocument();
    });

    it('should not show loading spinner when loading is false', () => {
      render(<FormDialog {...defaultProps} loading={false} />);

      expect(screen.queryByRole('progressbar')).not.toBeInTheDocument();
    });

    it('should prevent closing when loading', () => {
      const onClose = jest.fn();
      render(<FormDialog {...defaultProps} onClose={onClose} loading={true} />);

      // Try to close by clicking backdrop (pressing Escape)
      fireEvent.keyDown(screen.getByRole('dialog'), { key: 'Escape' });

      expect(onClose).not.toHaveBeenCalled();
    });

    it('should allow closing when not loading', () => {
      const onClose = jest.fn();
      render(<FormDialog {...defaultProps} onClose={onClose} loading={false} />);

      fireEvent.keyDown(screen.getByRole('dialog'), { key: 'Escape' });

      expect(onClose).toHaveBeenCalled();
    });
  });

  describe('Error State', () => {
    it('should display error alert when error is provided', () => {
      render(<FormDialog {...defaultProps} error="Something went wrong" />);

      expect(screen.getByRole('alert')).toBeInTheDocument();
      expect(screen.getByText('Something went wrong')).toBeInTheDocument();
    });

    it('should not display error alert when no error', () => {
      render(<FormDialog {...defaultProps} />);

      expect(screen.queryByRole('alert')).not.toBeInTheDocument();
    });

    it('should show close button on alert when onError is provided', () => {
      const onError = jest.fn();
      render(<FormDialog {...defaultProps} error="Error message" onError={onError} />);

      const closeButton = screen.getByRole('button', { name: /close/i });
      expect(closeButton).toBeInTheDocument();
    });

    it('should call onError with empty string when alert is dismissed', () => {
      const onError = jest.fn();
      render(<FormDialog {...defaultProps} error="Error message" onError={onError} />);

      const closeButton = screen.getByRole('button', { name: /close/i });
      fireEvent.click(closeButton);

      expect(onError).toHaveBeenCalledWith('');
    });

    it('should not show close button on alert when onError is not provided', () => {
      render(<FormDialog {...defaultProps} error="Error message" />);

      // Alert should exist but without close button
      expect(screen.getByRole('alert')).toBeInTheDocument();
      expect(screen.queryByRole('button', { name: /close/i })).not.toBeInTheDocument();
    });
  });

  describe('Size and Layout', () => {
    it('should render dialog with default settings', () => {
      render(<FormDialog {...defaultProps} />);

      // Dialog should be visible with correct structure
      const dialog = screen.getByRole('dialog');
      expect(dialog).toBeInTheDocument();
    });

    it('should accept custom maxWidth prop', () => {
      // Test that component doesn't crash with different maxWidth values
      const { rerender } = render(<FormDialog {...defaultProps} maxWidth="xs" />);
      expect(screen.getByRole('dialog')).toBeInTheDocument();

      rerender(<FormDialog {...defaultProps} maxWidth="lg" />);
      expect(screen.getByRole('dialog')).toBeInTheDocument();

      rerender(<FormDialog {...defaultProps} maxWidth="xl" />);
      expect(screen.getByRole('dialog')).toBeInTheDocument();
    });

    it('should accept fullWidth prop', () => {
      // Test that component works with both fullWidth values
      const { rerender } = render(<FormDialog {...defaultProps} fullWidth={true} />);
      expect(screen.getByRole('dialog')).toBeInTheDocument();

      rerender(<FormDialog {...defaultProps} fullWidth={false} />);
      expect(screen.getByRole('dialog')).toBeInTheDocument();
    });
  });

  describe('Close Behavior', () => {
    it('should call onClose when Escape is pressed', () => {
      const onClose = jest.fn();
      render(<FormDialog {...defaultProps} onClose={onClose} />);

      fireEvent.keyDown(screen.getByRole('dialog'), { key: 'Escape' });

      expect(onClose).toHaveBeenCalledTimes(1);
    });

    it('should call onClose when backdrop is clicked', () => {
      const onClose = jest.fn();
      render(<FormDialog {...defaultProps} onClose={onClose} />);

      // MUI Dialog backdrop has specific class
      const backdrop = document.querySelector('.MuiBackdrop-root');
      if (backdrop) {
        fireEvent.click(backdrop);
        expect(onClose).toHaveBeenCalledTimes(1);
      }
    });
  });
});

describe('FormDialogActions', () => {
  const defaultProps = {
    onCancel: jest.fn(),
    onSubmit: jest.fn(),
  };

  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('Rendering', () => {
    it('should render cancel and submit buttons', () => {
      render(<FormDialogActions {...defaultProps} />);

      expect(screen.getByRole('button', { name: 'Cancel' })).toBeInTheDocument();
      expect(screen.getByRole('button', { name: 'Save' })).toBeInTheDocument();
    });

    it('should use custom labels', () => {
      render(<FormDialogActions {...defaultProps} cancelLabel="Discard" submitLabel="Create" />);

      expect(screen.getByRole('button', { name: 'Discard' })).toBeInTheDocument();
      expect(screen.getByRole('button', { name: 'Create' })).toBeInTheDocument();
    });

    it('should show "Saving..." when loading', () => {
      render(<FormDialogActions {...defaultProps} loading={true} />);

      expect(screen.getByRole('button', { name: 'Saving...' })).toBeInTheDocument();
    });
  });

  describe('Button States', () => {
    it('should disable both buttons when loading', () => {
      render(<FormDialogActions {...defaultProps} loading={true} />);

      expect(screen.getByRole('button', { name: 'Cancel' })).toBeDisabled();
      expect(screen.getByRole('button', { name: 'Saving...' })).toBeDisabled();
    });

    it('should enable buttons when not loading', () => {
      render(<FormDialogActions {...defaultProps} loading={false} />);

      expect(screen.getByRole('button', { name: 'Cancel' })).not.toBeDisabled();
      expect(screen.getByRole('button', { name: 'Save' })).not.toBeDisabled();
    });

    it('should disable submit button when submitDisabled is true', () => {
      render(<FormDialogActions {...defaultProps} submitDisabled={true} />);

      expect(screen.getByRole('button', { name: 'Save' })).toBeDisabled();
      expect(screen.getByRole('button', { name: 'Cancel' })).not.toBeDisabled();
    });
  });

  describe('Click Handlers', () => {
    it('should call onCancel when cancel button is clicked', () => {
      const onCancel = jest.fn();
      render(<FormDialogActions {...defaultProps} onCancel={onCancel} />);

      fireEvent.click(screen.getByRole('button', { name: 'Cancel' }));

      expect(onCancel).toHaveBeenCalledTimes(1);
    });

    it('should call onSubmit when submit button is clicked', () => {
      const onSubmit = jest.fn();
      render(<FormDialogActions {...defaultProps} onSubmit={onSubmit} />);

      fireEvent.click(screen.getByRole('button', { name: 'Save' }));

      expect(onSubmit).toHaveBeenCalledTimes(1);
    });

    it('should not call handlers when buttons are disabled', () => {
      const onCancel = jest.fn();
      const onSubmit = jest.fn();
      render(
        <FormDialogActions
          {...defaultProps}
          onCancel={onCancel}
          onSubmit={onSubmit}
          loading={true}
        />
      );

      fireEvent.click(screen.getByRole('button', { name: 'Cancel' }));
      fireEvent.click(screen.getByRole('button', { name: 'Saving...' }));

      expect(onCancel).not.toHaveBeenCalled();
      expect(onSubmit).not.toHaveBeenCalled();
    });
  });

  describe('Button Styling', () => {
    it('should render submit button as contained variant', () => {
      const { container } = render(<FormDialogActions {...defaultProps} />);

      const submitButton = container.querySelector('.MuiButton-contained');
      expect(submitButton).toBeInTheDocument();
      expect(submitButton).toHaveTextContent('Save');
    });

    it('should render cancel button as text variant (default)', () => {
      const { container } = render(<FormDialogActions {...defaultProps} />);

      const cancelButton = container.querySelector('.MuiButton-text');
      expect(cancelButton).toBeInTheDocument();
      expect(cancelButton).toHaveTextContent('Cancel');
    });
  });
});

describe('FormDialog Integration', () => {
  it('should work with FormDialogActions as actions prop', () => {
    const onClose = jest.fn();
    const onSubmit = jest.fn();

    render(
      <FormDialog
        open={true}
        onClose={onClose}
        title="Create Item"
        actions={<FormDialogActions onCancel={onClose} onSubmit={onSubmit} submitLabel="Create" />}
      >
        <input placeholder="Item Name" />
      </FormDialog>
    );

    expect(screen.getByText('Create Item')).toBeInTheDocument();
    expect(screen.getByPlaceholderText('Item Name')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Cancel' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Create' })).toBeInTheDocument();
  });

  it('should handle form submission workflow', () => {
    const onClose = jest.fn();
    const onSubmit = jest.fn();

    const { rerender } = render(
      <FormDialog
        open={true}
        onClose={onClose}
        title="Create Item"
        loading={false}
        actions={<FormDialogActions onCancel={onClose} onSubmit={onSubmit} loading={false} />}
      >
        <input placeholder="Item Name" />
      </FormDialog>
    );

    // User fills form and clicks submit
    fireEvent.change(screen.getByPlaceholderText('Item Name'), {
      target: { value: 'Test Item' },
    });
    fireEvent.click(screen.getByRole('button', { name: 'Save' }));

    expect(onSubmit).toHaveBeenCalled();

    // Simulate loading state after submit
    rerender(
      <FormDialog
        open={true}
        onClose={onClose}
        title="Create Item"
        loading={true}
        actions={<FormDialogActions onCancel={onClose} onSubmit={onSubmit} loading={true} />}
      >
        <input placeholder="Item Name" />
      </FormDialog>
    );

    expect(screen.getByRole('progressbar')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Saving...' })).toBeDisabled();
  });

  it('should display and clear errors', () => {
    const onClose = jest.fn();
    const onError = jest.fn();

    const { rerender } = render(
      <FormDialog
        open={true}
        onClose={onClose}
        title="Create Item"
        error="Failed to save"
        onError={onError}
      >
        Content
      </FormDialog>
    );

    expect(screen.getByText('Failed to save')).toBeInTheDocument();

    // User dismisses error
    fireEvent.click(screen.getByRole('button', { name: /close/i }));
    expect(onError).toHaveBeenCalledWith('');

    // Error is cleared
    rerender(
      <FormDialog open={true} onClose={onClose} title="Create Item" onError={onError}>
        Content
      </FormDialog>
    );

    expect(screen.queryByRole('alert')).not.toBeInTheDocument();
  });
});
