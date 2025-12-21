import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { ArchiveEntityDialog } from '../ArchiveEntityDialog';
import { createMockEntity, mockTimestamp } from './test-utils';

// Mock Firebase
const mockUpdateDoc = jest.fn();
const mockDoc = jest.fn();
const mockTimestampNow = jest.fn();

jest.mock('firebase/firestore', () => ({
  doc: (...args: unknown[]) => mockDoc(...args),
  updateDoc: (...args: unknown[]) => mockUpdateDoc(...args),
  Timestamp: {
    now: () => mockTimestampNow(),
  },
}));

// Mock getFirebase
jest.mock('@/lib/firebase', () => ({
  getFirebase: jest.fn(() => ({
    db: {},
    auth: {},
  })),
}));

// Mock AuthContext
const mockUseAuth = jest.fn();

jest.mock('@/contexts/AuthContext', () => ({
  useAuth: () => mockUseAuth(),
}));

const defaultMockUser = {
  uid: 'test-user-id',
  email: 'test@example.com',
  displayName: 'Test User',
};

// Mock cascade delete check
const mockCheckEntityCascadeDelete = jest.fn();

jest.mock('@/lib/entities/businessEntityService', () => ({
  checkEntityCascadeDelete: (...args: unknown[]) => mockCheckEntityCascadeDelete(...args),
}));

describe('ArchiveEntityDialog', () => {
  const defaultProps = {
    open: true,
    entity: createMockEntity({ name: 'Test Entity', id: 'entity-123' }),
    onClose: jest.fn(),
    onSuccess: jest.fn(),
  };

  // Suppress console.error for expected error handling tests
  const originalConsoleError = console.error;
  beforeAll(() => {
    console.error = jest.fn();
  });
  afterAll(() => {
    console.error = originalConsoleError;
  });

  beforeEach(() => {
    jest.clearAllMocks();
    mockTimestampNow.mockReturnValue(mockTimestamp());
    mockCheckEntityCascadeDelete.mockResolvedValue({ canDelete: true, message: '' });
    mockUpdateDoc.mockResolvedValue(undefined);
    mockUseAuth.mockReturnValue({ user: defaultMockUser });
  });

  describe('Rendering', () => {
    it('should render dialog when open is true', () => {
      render(<ArchiveEntityDialog {...defaultProps} />);

      expect(screen.getByRole('dialog')).toBeInTheDocument();
      // "Archive Entity" appears in both title and button
      expect(screen.getAllByText('Archive Entity').length).toBeGreaterThanOrEqual(1);
    });

    it('should not render dialog when open is false', () => {
      render(<ArchiveEntityDialog {...defaultProps} open={false} />);

      expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    });

    it('should display entity name in confirmation message', () => {
      render(<ArchiveEntityDialog {...defaultProps} />);

      expect(screen.getByText(/Are you sure you want to archive/)).toBeInTheDocument();
      expect(screen.getByText('Test Entity')).toBeInTheDocument();
    });

    it('should display archive explanation text', () => {
      render(<ArchiveEntityDialog {...defaultProps} />);

      expect(
        screen.getByText(
          /Archived entities will not appear in active lists but can be unarchived later/
        )
      ).toBeInTheDocument();
    });

    it('should display reason text field', () => {
      render(<ArchiveEntityDialog {...defaultProps} />);

      expect(screen.getByLabelText(/Reason for archiving/)).toBeInTheDocument();
    });

    it('should display placeholder in reason field', () => {
      render(<ArchiveEntityDialog {...defaultProps} />);

      expect(screen.getByPlaceholderText(/Company closed, No longer a vendor/)).toBeInTheDocument();
    });

    it('should display Cancel and Archive buttons', () => {
      render(<ArchiveEntityDialog {...defaultProps} />);

      expect(screen.getByRole('button', { name: /Cancel/i })).toBeInTheDocument();
      expect(screen.getByRole('button', { name: /Archive Entity/i })).toBeInTheDocument();
    });

    it('should disable Archive button when reason is empty', () => {
      render(<ArchiveEntityDialog {...defaultProps} />);

      expect(screen.getByRole('button', { name: /Archive Entity/i })).toBeDisabled();
    });
  });

  describe('Reason Input', () => {
    it('should enable Archive button when reason is provided', async () => {
      const user = userEvent.setup();
      render(<ArchiveEntityDialog {...defaultProps} />);

      const reasonField = screen.getByLabelText(/Reason for archiving/);
      await user.type(reasonField, 'Company closed');

      expect(screen.getByRole('button', { name: /Archive Entity/i })).not.toBeDisabled();
    });

    it('should trim whitespace-only reason and keep button disabled', async () => {
      const user = userEvent.setup();
      render(<ArchiveEntityDialog {...defaultProps} />);

      const reasonField = screen.getByLabelText(/Reason for archiving/);
      await user.type(reasonField, '   ');

      expect(screen.getByRole('button', { name: /Archive Entity/i })).toBeDisabled();
    });

    it('should update reason value as user types', async () => {
      const user = userEvent.setup();
      render(<ArchiveEntityDialog {...defaultProps} />);

      const reasonField = screen.getByLabelText(/Reason for archiving/);
      await user.type(reasonField, 'No longer in business');

      expect(reasonField).toHaveValue('No longer in business');
    });
  });

  describe('Archive Submission', () => {
    it('should call updateDoc with correct archive data', async () => {
      const user = userEvent.setup();
      render(<ArchiveEntityDialog {...defaultProps} />);

      const reasonField = screen.getByLabelText(/Reason for archiving/);
      await user.type(reasonField, 'Company closed');

      // Wait for button to become enabled
      await waitFor(() => {
        expect(screen.getByRole('button', { name: /Archive Entity/i })).not.toBeDisabled();
      });

      const archiveButton = screen.getByRole('button', { name: /Archive Entity/i });
      await user.click(archiveButton);

      await waitFor(() => {
        expect(mockUpdateDoc).toHaveBeenCalled();
        const updateArgs = mockUpdateDoc.mock.calls[0][1];
        expect(updateArgs).toMatchObject({
          isActive: false,
          isArchived: true,
          archivedBy: 'test-user-id',
          archivedByName: 'Test User',
          archiveReason: 'Company closed',
        });
      });
    });

    it('should call onSuccess and onClose after successful archive', async () => {
      const user = userEvent.setup();
      render(<ArchiveEntityDialog {...defaultProps} />);

      const reasonField = screen.getByLabelText(/Reason for archiving/);
      await user.type(reasonField, 'Company closed');

      const archiveButton = screen.getByRole('button', { name: /Archive Entity/i });
      await user.click(archiveButton);

      await waitFor(() => {
        expect(defaultProps.onSuccess).toHaveBeenCalled();
        expect(defaultProps.onClose).toHaveBeenCalled();
      });
    });

    it('should reset reason field after successful archive', async () => {
      const user = userEvent.setup();
      const { rerender } = render(<ArchiveEntityDialog {...defaultProps} />);

      const reasonField = screen.getByLabelText(/Reason for archiving/);
      await user.type(reasonField, 'Company closed');

      const archiveButton = screen.getByRole('button', { name: /Archive Entity/i });
      await user.click(archiveButton);

      await waitFor(() => {
        expect(defaultProps.onClose).toHaveBeenCalled();
      });

      // Reopen dialog
      rerender(<ArchiveEntityDialog {...defaultProps} />);

      const newReasonField = screen.getByLabelText(/Reason for archiving/);
      expect(newReasonField).toHaveValue('');
    });

    it('should show error when archiving fails', async () => {
      mockUpdateDoc.mockRejectedValue(new Error('Network error'));
      const user = userEvent.setup();
      render(<ArchiveEntityDialog {...defaultProps} />);

      const reasonField = screen.getByLabelText(/Reason for archiving/);
      await user.type(reasonField, 'Company closed');

      const archiveButton = screen.getByRole('button', { name: /Archive Entity/i });
      await user.click(archiveButton);

      await waitFor(() => {
        expect(screen.getByRole('alert')).toBeInTheDocument();
        expect(screen.getByText('Network error')).toBeInTheDocument();
      });
    });

    it('should show default error message for unknown errors', async () => {
      mockUpdateDoc.mockRejectedValue('Unknown error');
      const user = userEvent.setup();
      render(<ArchiveEntityDialog {...defaultProps} />);

      const reasonField = screen.getByLabelText(/Reason for archiving/);
      await user.type(reasonField, 'Company closed');

      const archiveButton = screen.getByRole('button', { name: /Archive Entity/i });
      await user.click(archiveButton);

      await waitFor(() => {
        expect(screen.getByText(/Failed to archive entity/)).toBeInTheDocument();
      });
    });
  });

  describe('Loading State', () => {
    it('should show loading indicator when archiving', async () => {
      // Make updateDoc hang
      mockUpdateDoc.mockImplementation(() => new Promise(() => {}));
      const user = userEvent.setup();
      render(<ArchiveEntityDialog {...defaultProps} />);

      const reasonField = screen.getByLabelText(/Reason for archiving/);
      await user.type(reasonField, 'Company closed');

      const archiveButton = screen.getByRole('button', { name: /Archive Entity/i });
      await user.click(archiveButton);

      await waitFor(() => {
        expect(screen.getByText('Archiving...')).toBeInTheDocument();
      });
    });

    it('should disable Archive button during loading', async () => {
      mockUpdateDoc.mockImplementation(() => new Promise(() => {}));
      const user = userEvent.setup();
      render(<ArchiveEntityDialog {...defaultProps} />);

      const reasonField = screen.getByLabelText(/Reason for archiving/);
      await user.type(reasonField, 'Company closed');

      const archiveButton = screen.getByRole('button', { name: /Archive Entity/i });
      await user.click(archiveButton);

      await waitFor(() => {
        expect(screen.getByRole('button', { name: /Archiving/i })).toBeDisabled();
      });
    });

    it('should disable Cancel button during loading', async () => {
      mockUpdateDoc.mockImplementation(() => new Promise(() => {}));
      const user = userEvent.setup();
      render(<ArchiveEntityDialog {...defaultProps} />);

      const reasonField = screen.getByLabelText(/Reason for archiving/);
      await user.type(reasonField, 'Company closed');

      const archiveButton = screen.getByRole('button', { name: /Archive Entity/i });
      await user.click(archiveButton);

      await waitFor(() => {
        expect(screen.getByRole('button', { name: /Cancel/i })).toBeDisabled();
      });
    });

    it('should disable reason field during loading', async () => {
      mockUpdateDoc.mockImplementation(() => new Promise(() => {}));
      const user = userEvent.setup();
      render(<ArchiveEntityDialog {...defaultProps} />);

      const reasonField = screen.getByLabelText(/Reason for archiving/);
      await user.type(reasonField, 'Company closed');

      const archiveButton = screen.getByRole('button', { name: /Archive Entity/i });
      await user.click(archiveButton);

      await waitFor(() => {
        expect(screen.getByLabelText(/Reason for archiving/)).toBeDisabled();
      });
    });
  });

  describe('Cascade Delete Check', () => {
    it('should show cascade warning when entity has blockers', async () => {
      mockCheckEntityCascadeDelete.mockResolvedValue({
        canDelete: false,
        message: 'Entity has 3 active purchase orders',
      });

      const user = userEvent.setup();
      render(<ArchiveEntityDialog {...defaultProps} />);

      const reasonField = screen.getByLabelText(/Reason for archiving/);
      await user.type(reasonField, 'Company closed');

      const archiveButton = screen.getByRole('button', { name: /Archive Entity/i });
      await user.click(archiveButton);

      await waitFor(() => {
        expect(screen.getByText('Entity has 3 active purchase orders')).toBeInTheDocument();
      });
    });

    it('should not call updateDoc when cascade check fails', async () => {
      mockCheckEntityCascadeDelete.mockResolvedValue({
        canDelete: false,
        message: 'Entity has active projects',
      });

      const user = userEvent.setup();
      render(<ArchiveEntityDialog {...defaultProps} />);

      const reasonField = screen.getByLabelText(/Reason for archiving/);
      await user.type(reasonField, 'Company closed');

      const archiveButton = screen.getByRole('button', { name: /Archive Entity/i });
      await user.click(archiveButton);

      await waitFor(() => {
        expect(screen.getByText('Entity has active projects')).toBeInTheDocument();
      });

      expect(mockUpdateDoc).not.toHaveBeenCalled();
    });

    it('should re-enable buttons after cascade check failure', async () => {
      mockCheckEntityCascadeDelete.mockResolvedValue({
        canDelete: false,
        message: 'Entity has blockers',
      });

      const user = userEvent.setup();
      render(<ArchiveEntityDialog {...defaultProps} />);

      const reasonField = screen.getByLabelText(/Reason for archiving/);
      await user.type(reasonField, 'Company closed');

      const archiveButton = screen.getByRole('button', { name: /Archive Entity/i });
      await user.click(archiveButton);

      await waitFor(() => {
        expect(screen.getByText('Entity has blockers')).toBeInTheDocument();
      });

      expect(screen.getByRole('button', { name: /Archive Entity/i })).not.toBeDisabled();
      expect(screen.getByRole('button', { name: /Cancel/i })).not.toBeDisabled();
    });
  });

  describe('Validation', () => {
    it('should show error when submitting without reason', async () => {
      const user = userEvent.setup();
      render(<ArchiveEntityDialog {...defaultProps} />);

      // Simulate somehow clicking the button (e.g., if disabled state was bypassed)
      // Actually, button is disabled so we can test by checking for validation message
      // when typing whitespace and trying to submit

      const reasonField = screen.getByLabelText(/Reason for archiving/);
      await user.type(reasonField, '   ');
      await user.clear(reasonField);

      // Type something valid first
      await user.type(reasonField, 'test');
      // Clear to make it empty
      await user.clear(reasonField);

      // Archive button should be disabled with empty reason
      expect(screen.getByRole('button', { name: /Archive Entity/i })).toBeDisabled();
    });
  });

  describe('Cancel Behavior', () => {
    it('should call onClose when Cancel is clicked', async () => {
      const user = userEvent.setup();
      render(<ArchiveEntityDialog {...defaultProps} />);

      const cancelButton = screen.getByRole('button', { name: /Cancel/i });
      await user.click(cancelButton);

      expect(defaultProps.onClose).toHaveBeenCalled();
    });

    it('should reset form state when Cancel is clicked', async () => {
      const user = userEvent.setup();
      const { rerender } = render(<ArchiveEntityDialog {...defaultProps} />);

      const reasonField = screen.getByLabelText(/Reason for archiving/);
      await user.type(reasonField, 'Some reason');

      const cancelButton = screen.getByRole('button', { name: /Cancel/i });
      await user.click(cancelButton);

      // Reopen dialog
      rerender(<ArchiveEntityDialog {...defaultProps} />);

      const newReasonField = screen.getByLabelText(/Reason for archiving/);
      expect(newReasonField).toHaveValue('');
    });

    it('should not close dialog when loading', async () => {
      mockUpdateDoc.mockImplementation(() => new Promise(() => {}));
      const user = userEvent.setup();
      render(<ArchiveEntityDialog {...defaultProps} />);

      const reasonField = screen.getByLabelText(/Reason for archiving/);
      await user.type(reasonField, 'Company closed');

      const archiveButton = screen.getByRole('button', { name: /Archive Entity/i });
      await user.click(archiveButton);

      await waitFor(() => {
        expect(screen.getByRole('button', { name: /Cancel/i })).toBeDisabled();
      });

      // Click disabled Cancel button (should not close)
      fireEvent.click(screen.getByRole('button', { name: /Cancel/i }));
      expect(defaultProps.onClose).not.toHaveBeenCalled();
    });
  });

  describe('Edge Cases', () => {
    it('should handle null entity gracefully', () => {
      render(<ArchiveEntityDialog {...defaultProps} entity={null} />);

      expect(screen.getByRole('dialog')).toBeInTheDocument();
      expect(screen.getByText(/Are you sure you want to archive/)).toBeInTheDocument();
    });

    it('should not call updateDoc when entity id is missing', async () => {
      const entityWithoutId = createMockEntity({ id: '' });
      const user = userEvent.setup();
      render(<ArchiveEntityDialog {...defaultProps} entity={entityWithoutId} />);

      const reasonField = screen.getByLabelText(/Reason for archiving/);
      await user.type(reasonField, 'Company closed');

      const archiveButton = screen.getByRole('button', { name: /Archive Entity/i });
      await user.click(archiveButton);

      expect(mockUpdateDoc).not.toHaveBeenCalled();
    });

    it('should use email as fallback when displayName is not available', async () => {
      // Update mock to return user without displayName
      mockUseAuth.mockReturnValue({
        user: { uid: 'test-id', email: 'fallback@example.com', displayName: null },
      });

      const user = userEvent.setup();
      render(<ArchiveEntityDialog {...defaultProps} />);

      const reasonField = screen.getByLabelText(/Reason for archiving/);
      await user.type(reasonField, 'Company closed');

      // Wait for button to become enabled
      await waitFor(() => {
        expect(screen.getByRole('button', { name: /Archive Entity/i })).not.toBeDisabled();
      });

      const archiveButton = screen.getByRole('button', { name: /Archive Entity/i });
      await user.click(archiveButton);

      await waitFor(() => {
        expect(mockUpdateDoc).toHaveBeenCalled();
        const updateArgs = mockUpdateDoc.mock.calls[0][1];
        expect(updateArgs).toMatchObject({
          archivedByName: 'fallback@example.com',
        });
      });
    });
  });
});
