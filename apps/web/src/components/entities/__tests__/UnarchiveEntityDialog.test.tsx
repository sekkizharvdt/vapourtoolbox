import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { UnarchiveEntityDialog } from '../UnarchiveEntityDialog';
import { createMockArchivedEntity, mockTimestamp } from './test-utils';

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

// Mock useAuth
jest.mock('@/contexts/AuthContext', () => ({
  useAuth: () => ({
    user: { uid: 'test-user-id', email: 'test@example.com', displayName: 'Test User' },
    claims: { admin: false },
    loading: false,
    error: null,
  }),
}));

// Mock audit logging (fire-and-forget, no need to await in tests)
jest.mock('@/lib/audit/clientAuditService', () => ({
  logAuditEvent: jest.fn().mockResolvedValue(undefined),
  createAuditContext: jest.fn().mockReturnValue({
    userId: 'test-user-id',
    userEmail: 'test@example.com',
    userName: 'Test User',
  }),
}));

describe('UnarchiveEntityDialog', () => {
  const archivedEntity = createMockArchivedEntity({
    name: 'Archived Entity',
    id: 'entity-123',
    archiveReason: 'Company closed operations',
    archivedByName: 'Admin User',
    archivedAt: new Date('2024-01-15'),
  });

  const defaultProps = {
    open: true,
    entity: archivedEntity,
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
    mockUpdateDoc.mockResolvedValue(undefined);
  });

  describe('Rendering', () => {
    it('should render dialog when open is true', () => {
      render(<UnarchiveEntityDialog {...defaultProps} />);

      expect(screen.getByRole('dialog')).toBeInTheDocument();
      expect(screen.getByText('Unarchive Entity')).toBeInTheDocument();
    });

    it('should not render dialog when open is false', () => {
      render(<UnarchiveEntityDialog {...defaultProps} open={false} />);

      expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    });

    it('should display entity name in confirmation message', () => {
      render(<UnarchiveEntityDialog {...defaultProps} />);

      expect(screen.getByText(/Do you want to restore/)).toBeInTheDocument();
      expect(screen.getByText('Archived Entity')).toBeInTheDocument();
      expect(screen.getByText(/to active status/)).toBeInTheDocument();
    });

    it('should display Cancel and Restore buttons', () => {
      render(<UnarchiveEntityDialog {...defaultProps} />);

      expect(screen.getByRole('button', { name: /Cancel/i })).toBeInTheDocument();
      expect(screen.getByRole('button', { name: /Restore Entity/i })).toBeInTheDocument();
    });

    it('should have Restore button enabled by default', () => {
      render(<UnarchiveEntityDialog {...defaultProps} />);

      expect(screen.getByRole('button', { name: /Restore Entity/i })).not.toBeDisabled();
    });
  });

  describe('Archive Info Display', () => {
    it('should display archive reason when provided', () => {
      render(<UnarchiveEntityDialog {...defaultProps} />);

      expect(screen.getByText('Archive Reason')).toBeInTheDocument();
      expect(screen.getByText('Company closed operations')).toBeInTheDocument();
    });

    it('should display archived by name', () => {
      render(<UnarchiveEntityDialog {...defaultProps} />);

      expect(screen.getByText(/Archived by Admin User/)).toBeInTheDocument();
    });

    it('should display archive date', () => {
      render(<UnarchiveEntityDialog {...defaultProps} />);

      // Date should be formatted as "15 Jan 2024" (en-IN locale)
      expect(screen.getByText(/15 Jan 2024/)).toBeInTheDocument();
    });

    it('should not display archive info box when no archive reason', () => {
      const entityWithoutReason = createMockArchivedEntity({
        archiveReason: undefined,
      });
      render(<UnarchiveEntityDialog {...defaultProps} entity={entityWithoutReason} />);

      expect(screen.queryByText('Archive Reason')).not.toBeInTheDocument();
    });

    it('should show Unknown for missing archived by name', () => {
      const entityWithoutArchivedBy = createMockArchivedEntity({
        archiveReason: 'Some reason',
        archivedByName: undefined,
      });
      render(<UnarchiveEntityDialog {...defaultProps} entity={entityWithoutArchivedBy} />);

      expect(screen.getByText(/Archived by Unknown/)).toBeInTheDocument();
    });

    it('should show Unknown for missing archive date', () => {
      const entityWithoutDate = createMockArchivedEntity({
        archiveReason: 'Some reason',
        archivedAt: undefined,
      });
      render(<UnarchiveEntityDialog {...defaultProps} entity={entityWithoutDate} />);

      // The formatDate function should return "Unknown"
      expect(screen.getByText(/on Unknown/)).toBeInTheDocument();
    });
  });

  describe('Unarchive Submission', () => {
    it('should call updateDoc with correct unarchive data', async () => {
      const user = userEvent.setup();
      render(<UnarchiveEntityDialog {...defaultProps} />);

      const restoreButton = screen.getByRole('button', { name: /Restore Entity/i });
      await user.click(restoreButton);

      await waitFor(() => {
        expect(mockUpdateDoc).toHaveBeenCalled();
        const updateArgs = mockUpdateDoc.mock.calls[0][1];
        expect(updateArgs).toMatchObject({
          isActive: true,
          isArchived: false,
          archivedAt: null,
          archivedBy: null,
          archivedByName: null,
          archiveReason: null,
        });
      });
    });

    it('should call onSuccess and onClose after successful unarchive', async () => {
      const user = userEvent.setup();
      render(<UnarchiveEntityDialog {...defaultProps} />);

      const restoreButton = screen.getByRole('button', { name: /Restore Entity/i });
      await user.click(restoreButton);

      await waitFor(() => {
        expect(defaultProps.onSuccess).toHaveBeenCalled();
        expect(defaultProps.onClose).toHaveBeenCalled();
      });
    });

    it('should show error when unarchiving fails', async () => {
      mockUpdateDoc.mockRejectedValue(new Error('Database connection failed'));
      const user = userEvent.setup();
      render(<UnarchiveEntityDialog {...defaultProps} />);

      const restoreButton = screen.getByRole('button', { name: /Restore Entity/i });
      await user.click(restoreButton);

      await waitFor(() => {
        expect(screen.getByRole('alert')).toBeInTheDocument();
        expect(screen.getByText('Database connection failed')).toBeInTheDocument();
      });
    });

    it('should show default error message for unknown errors', async () => {
      mockUpdateDoc.mockRejectedValue('Unknown error');
      const user = userEvent.setup();
      render(<UnarchiveEntityDialog {...defaultProps} />);

      const restoreButton = screen.getByRole('button', { name: /Restore Entity/i });
      await user.click(restoreButton);

      await waitFor(() => {
        expect(screen.getByText(/Failed to unarchive entity/)).toBeInTheDocument();
      });
    });
  });

  describe('Loading State', () => {
    it('should show loading indicator when unarchiving', async () => {
      mockUpdateDoc.mockImplementation(() => new Promise(() => {}));
      const user = userEvent.setup();
      render(<UnarchiveEntityDialog {...defaultProps} />);

      const restoreButton = screen.getByRole('button', { name: /Restore Entity/i });
      await user.click(restoreButton);

      await waitFor(() => {
        expect(screen.getByText('Restoring...')).toBeInTheDocument();
      });
    });

    it('should disable Restore button during loading', async () => {
      mockUpdateDoc.mockImplementation(() => new Promise(() => {}));
      const user = userEvent.setup();
      render(<UnarchiveEntityDialog {...defaultProps} />);

      const restoreButton = screen.getByRole('button', { name: /Restore Entity/i });
      await user.click(restoreButton);

      await waitFor(() => {
        expect(screen.getByRole('button', { name: /Restoring/i })).toBeDisabled();
      });
    });

    it('should disable Cancel button during loading', async () => {
      mockUpdateDoc.mockImplementation(() => new Promise(() => {}));
      const user = userEvent.setup();
      render(<UnarchiveEntityDialog {...defaultProps} />);

      const restoreButton = screen.getByRole('button', { name: /Restore Entity/i });
      await user.click(restoreButton);

      await waitFor(() => {
        expect(screen.getByRole('button', { name: /Cancel/i })).toBeDisabled();
      });
    });
  });

  describe('Cancel Behavior', () => {
    it('should call onClose when Cancel is clicked', async () => {
      const user = userEvent.setup();
      render(<UnarchiveEntityDialog {...defaultProps} />);

      const cancelButton = screen.getByRole('button', { name: /Cancel/i });
      await user.click(cancelButton);

      expect(defaultProps.onClose).toHaveBeenCalled();
    });

    it('should reset error state when Cancel is clicked', async () => {
      mockUpdateDoc.mockRejectedValueOnce(new Error('Error'));
      const user = userEvent.setup();
      const { rerender } = render(<UnarchiveEntityDialog {...defaultProps} />);

      // Trigger error
      const restoreButton = screen.getByRole('button', { name: /Restore Entity/i });
      await user.click(restoreButton);

      await waitFor(() => {
        expect(screen.getByRole('alert')).toBeInTheDocument();
      });

      // Cancel
      const cancelButton = screen.getByRole('button', { name: /Cancel/i });
      await user.click(cancelButton);

      // Reopen dialog
      rerender(<UnarchiveEntityDialog {...defaultProps} />);

      expect(screen.queryByRole('alert')).not.toBeInTheDocument();
    });

    it('should not close dialog when loading', async () => {
      mockUpdateDoc.mockImplementation(() => new Promise(() => {}));
      const user = userEvent.setup();
      render(<UnarchiveEntityDialog {...defaultProps} />);

      const restoreButton = screen.getByRole('button', { name: /Restore Entity/i });
      await user.click(restoreButton);

      await waitFor(() => {
        expect(screen.getByRole('button', { name: /Cancel/i })).toBeDisabled();
      });

      // Click disabled Cancel button
      fireEvent.click(screen.getByRole('button', { name: /Cancel/i }));
      expect(defaultProps.onClose).not.toHaveBeenCalled();
    });
  });

  describe('Edge Cases', () => {
    it('should handle null entity gracefully', () => {
      render(<UnarchiveEntityDialog {...defaultProps} entity={null} />);

      expect(screen.getByRole('dialog')).toBeInTheDocument();
      expect(screen.getByText(/Do you want to restore/)).toBeInTheDocument();
    });

    it('should not call updateDoc when entity id is missing', async () => {
      const entityWithoutId = createMockArchivedEntity({ id: '' });
      const user = userEvent.setup();
      render(<UnarchiveEntityDialog {...defaultProps} entity={entityWithoutId} />);

      const restoreButton = screen.getByRole('button', { name: /Restore Entity/i });
      await user.click(restoreButton);

      expect(mockUpdateDoc).not.toHaveBeenCalled();
    });

    it('should handle entity with all archive fields missing', () => {
      const minimalEntity = createMockArchivedEntity({
        archiveReason: undefined,
        archivedAt: undefined,
        archivedBy: undefined,
        archivedByName: undefined,
      });
      render(<UnarchiveEntityDialog {...defaultProps} entity={minimalEntity} />);

      // Should not show archive info box
      expect(screen.queryByText('Archive Reason')).not.toBeInTheDocument();
      // Dialog should still render
      expect(screen.getByRole('dialog')).toBeInTheDocument();
    });
  });

  describe('Date Formatting', () => {
    it('should format date in en-IN locale', () => {
      const entityWithDate = createMockArchivedEntity({
        archiveReason: 'Test',
        archivedAt: new Date('2024-12-25'),
      });
      render(<UnarchiveEntityDialog {...defaultProps} entity={entityWithDate} />);

      // Should be formatted as "25 Dec 2024"
      expect(screen.getByText(/25 Dec 2024/)).toBeInTheDocument();
    });

    it('should handle various date formats', () => {
      const entityWithDate = createMockArchivedEntity({
        archiveReason: 'Test',
        archivedAt: new Date('2023-03-05'),
      });
      render(<UnarchiveEntityDialog {...defaultProps} entity={entityWithDate} />);

      expect(screen.getByText(/5 Mar 2023/)).toBeInTheDocument();
    });
  });
});
