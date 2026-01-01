import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { EditUserDialog } from '../EditUserDialog';
import { PERMISSION_FLAGS, getAllPermissions, getAllPermissions2 } from '@vapour/constants';
import type { User } from '@vapour/types';

// Mock Firebase
const mockUpdateDoc = jest.fn();
jest.mock('firebase/firestore', () => ({
  doc: jest.fn(() => ({ id: 'mock-doc-ref' })),
  updateDoc: (...args: unknown[]) => mockUpdateDoc(...args),
  Timestamp: {
    now: jest.fn(() => ({ seconds: Date.now() / 1000, nanoseconds: 0 })),
  },
}));

jest.mock('@/lib/firebase', () => ({
  getFirebase: jest.fn(() => ({
    db: { collection: jest.fn() },
  })),
}));

jest.mock('@vapour/firebase', () => ({
  COLLECTIONS: {
    USERS: 'users',
  },
}));

// Create a mock user for testing
const createMockUser = (overrides: Partial<User> = {}): User => ({
  uid: 'test-user-id',
  email: 'test@example.com',
  displayName: 'Test User',
  phone: '123-456-7890',
  mobile: '098-765-4321',
  jobTitle: 'Developer',
  department: 'ENGINEERING' as const,
  status: 'active' as const,
  permissions: PERMISSION_FLAGS.VIEW_PROJECTS,
  permissions2: 0,
  isActive: true,
  assignedProjects: [],
  createdAt: { seconds: Date.now() / 1000, nanoseconds: 0 } as unknown as User['createdAt'],
  updatedAt: { seconds: Date.now() / 1000, nanoseconds: 0 } as unknown as User['updatedAt'],
  ...overrides,
});

describe('EditUserDialog', () => {
  const defaultProps = {
    open: true,
    user: createMockUser(),
    onClose: jest.fn(),
    onSuccess: jest.fn(),
  };

  beforeEach(() => {
    jest.clearAllMocks();
    mockUpdateDoc.mockResolvedValue(undefined);
  });

  describe('Rendering', () => {
    it('should render the dialog when open', () => {
      render(<EditUserDialog {...defaultProps} />);
      expect(screen.getByRole('dialog')).toBeInTheDocument();
      expect(screen.getByText('Edit User')).toBeInTheDocument();
    });

    it('should not render when user is null', () => {
      render(<EditUserDialog {...defaultProps} user={null} />);
      expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    });

    it('should display user email as readonly', () => {
      render(<EditUserDialog {...defaultProps} />);
      const emailField = screen.getByLabelText(/Email/i);
      expect(emailField).toBeDisabled();
      expect(emailField).toHaveValue('test@example.com');
    });

    it('should initialize form with user data', () => {
      render(<EditUserDialog {...defaultProps} />);
      expect(screen.getByLabelText(/Display Name/i)).toHaveValue('Test User');
      expect(screen.getByLabelText(/^Phone$/i)).toHaveValue('123-456-7890');
      expect(screen.getByLabelText(/Mobile/i)).toHaveValue('098-765-4321');
      expect(screen.getByLabelText(/Job Title/i)).toHaveValue('Developer');
    });
  });

  describe('Form Validation', () => {
    it('should show error when display name is empty', async () => {
      render(<EditUserDialog {...defaultProps} />);
      const user = userEvent.setup();

      // Clear display name
      const displayNameField = screen.getByLabelText(/Display Name/i);
      await user.clear(displayNameField);

      // Try to save
      await user.click(screen.getByRole('button', { name: /Save Changes/i }));

      expect(screen.getByText('Display name is required')).toBeInTheDocument();
      expect(mockUpdateDoc).not.toHaveBeenCalled();
    });

    it('should trim whitespace from display name before validation', async () => {
      render(<EditUserDialog {...defaultProps} />);
      const user = userEvent.setup();

      // Enter only whitespace
      const displayNameField = screen.getByLabelText(/Display Name/i);
      await user.clear(displayNameField);
      await user.type(displayNameField, '   ');

      // Try to save
      await user.click(screen.getByRole('button', { name: /Save Changes/i }));

      expect(screen.getByText('Display name is required')).toBeInTheDocument();
      expect(mockUpdateDoc).not.toHaveBeenCalled();
    });
  });

  describe('Form Submission', () => {
    it('should call updateDoc with correct data on save', async () => {
      render(<EditUserDialog {...defaultProps} />);
      const user = userEvent.setup();

      // Modify display name
      const displayNameField = screen.getByLabelText(/Display Name/i);
      await user.clear(displayNameField);
      await user.type(displayNameField, 'Updated Name');

      // Save
      await user.click(screen.getByRole('button', { name: /Save Changes/i }));

      await waitFor(() => {
        expect(mockUpdateDoc).toHaveBeenCalled();
      });

      const updateCall = mockUpdateDoc.mock.calls[0];
      expect(updateCall[1]).toMatchObject({
        displayName: 'Updated Name',
        status: 'active',
      });
    });

    it('should show loading state during save', async () => {
      // Create a deferred promise to control when updateDoc resolves
      let resolveUpdate: () => void;
      mockUpdateDoc.mockImplementation(
        () =>
          new Promise<void>((resolve) => {
            resolveUpdate = resolve;
          })
      );

      render(<EditUserDialog {...defaultProps} />);
      const user = userEvent.setup();

      // Click save
      await user.click(screen.getByRole('button', { name: /Save Changes/i }));

      // Should show loading state
      expect(screen.getByText('Saving...')).toBeInTheDocument();

      // Resolve the promise
      resolveUpdate!();

      await waitFor(() => {
        expect(screen.queryByText('Saving...')).not.toBeInTheDocument();
      });
    });

    it('should show success message after successful save', async () => {
      render(<EditUserDialog {...defaultProps} />);
      const user = userEvent.setup();

      await user.click(screen.getByRole('button', { name: /Save Changes/i }));

      await waitFor(() => {
        expect(screen.getByText(/User updated successfully!/i)).toBeInTheDocument();
      });
    });

    it('should show error message on save failure', async () => {
      mockUpdateDoc.mockRejectedValue(new Error('Network error'));

      render(<EditUserDialog {...defaultProps} />);
      const user = userEvent.setup();

      await user.click(screen.getByRole('button', { name: /Save Changes/i }));

      await waitFor(() => {
        expect(screen.getByText('Network error')).toBeInTheDocument();
      });
    });
  });

  describe('Permission Management', () => {
    it('should display module permission accordions', () => {
      render(<EditUserDialog {...defaultProps} />);

      // Check for module accordion headers
      expect(screen.getByText('Projects')).toBeInTheDocument();
      expect(screen.getByText('Accounting')).toBeInTheDocument();
      expect(screen.getByText('Procurement')).toBeInTheDocument();
    });

    it('should display admin permissions section', () => {
      render(<EditUserDialog {...defaultProps} />);

      expect(screen.getByText('Admin Permissions')).toBeInTheDocument();
      // User Management should be in the admin section
      expect(screen.getByText('User Management')).toBeInTheDocument();
    });

    it('should have checkboxes in the dialog', () => {
      render(<EditUserDialog {...defaultProps} />);

      // There should be multiple checkboxes for permissions
      const checkboxes = screen.getAllByRole('checkbox');
      expect(checkboxes.length).toBeGreaterThan(0);
    });

    it('should toggle permission when checkbox is clicked', async () => {
      render(<EditUserDialog {...defaultProps} />);
      const user = userEvent.setup();

      // Get the first unchecked checkbox
      const checkboxes = screen.getAllByRole('checkbox');
      const uncheckedCheckbox = checkboxes.find((cb) => !(cb as HTMLInputElement).checked);

      if (uncheckedCheckbox) {
        expect(uncheckedCheckbox).not.toBeChecked();

        // Click to toggle on
        await user.click(uncheckedCheckbox);
        expect(uncheckedCheckbox).toBeChecked();

        // Click to toggle off
        await user.click(uncheckedCheckbox);
        expect(uncheckedCheckbox).not.toBeChecked();
      }
    });
  });

  describe('Quick Actions', () => {
    it('should select all regular permissions when Select All is clicked', async () => {
      render(<EditUserDialog {...defaultProps} />);
      const user = userEvent.setup();

      await user.click(screen.getByRole('button', { name: /Select All/i }));

      // Check that multiple permissions are now selected
      const checkboxes = screen.getAllByRole('checkbox');
      const checkedCount = checkboxes.filter((cb) => (cb as HTMLInputElement).checked).length;

      // Should have more than just the initial permission checked
      expect(checkedCount).toBeGreaterThan(5);
    });

    it('should clear all permissions when Clear is clicked', async () => {
      const userWithPerms = createMockUser({
        permissions:
          PERMISSION_FLAGS.VIEW_PROJECTS |
          PERMISSION_FLAGS.MANAGE_PROJECTS |
          PERMISSION_FLAGS.VIEW_ACCOUNTING,
      });

      render(<EditUserDialog {...defaultProps} user={userWithPerms} />);
      const user = userEvent.setup();

      await user.click(screen.getByRole('button', { name: /^Clear$/i }));

      // All checkboxes should be unchecked
      const checkboxes = screen.getAllByRole('checkbox');
      checkboxes.forEach((cb) => {
        expect(cb).not.toBeChecked();
      });
    });

    it('should grant full access when Full Access is clicked', async () => {
      render(<EditUserDialog {...defaultProps} />);
      const user = userEvent.setup();

      await user.click(screen.getByRole('button', { name: /Full Access/i }));

      // All checkboxes should be checked
      const checkboxes = screen.getAllByRole('checkbox');
      checkboxes.forEach((cb) => {
        expect(cb).toBeChecked();
      });
    });

    it('should save full permissions when Full Access is granted', async () => {
      render(<EditUserDialog {...defaultProps} />);
      const user = userEvent.setup();

      await user.click(screen.getByRole('button', { name: /Full Access/i }));
      await user.click(screen.getByRole('button', { name: /Save Changes/i }));

      await waitFor(() => {
        expect(mockUpdateDoc).toHaveBeenCalled();
      });

      const updateCall = mockUpdateDoc.mock.calls[0];
      expect(updateCall[1].permissions).toBe(getAllPermissions());
      expect(updateCall[1].permissions2).toBe(getAllPermissions2());
    });
  });

  describe('Dialog Behavior', () => {
    it('should call onClose when Cancel is clicked', async () => {
      const onClose = jest.fn();
      render(<EditUserDialog {...defaultProps} onClose={onClose} />);
      const user = userEvent.setup();

      await user.click(screen.getByRole('button', { name: /Cancel/i }));

      expect(onClose).toHaveBeenCalled();
    });

    it('should not allow closing during save', async () => {
      let resolveUpdate: () => void;
      mockUpdateDoc.mockImplementation(
        () =>
          new Promise<void>((resolve) => {
            resolveUpdate = resolve;
          })
      );

      const onClose = jest.fn();
      render(<EditUserDialog {...defaultProps} onClose={onClose} />);
      const user = userEvent.setup();

      // Start save
      await user.click(screen.getByRole('button', { name: /Save Changes/i }));

      // Verify cancel button is disabled during save (has pointer-events: none)
      const cancelButton = screen.getByRole('button', { name: /Cancel/i });
      expect(cancelButton).toHaveStyle({ pointerEvents: 'none' });
      expect(onClose).not.toHaveBeenCalled();

      // Resolve the update
      resolveUpdate!();

      await waitFor(() => {
        expect(screen.queryByText('Saving...')).not.toBeInTheDocument();
      });
    });

    it('should display open modules info', () => {
      render(<EditUserDialog {...defaultProps} />);
      expect(screen.getByText(/Open to all:/i)).toBeInTheDocument();
    });
  });

  describe('Status Management', () => {
    it('should initialize with correct status', () => {
      const inactiveUser = createMockUser({ status: 'inactive' });
      render(<EditUserDialog {...defaultProps} user={inactiveUser} />);

      // The status field should show 'Inactive'
      expect(screen.getByText('Inactive')).toBeInTheDocument();
    });

    it('should save current status when saving', async () => {
      render(<EditUserDialog {...defaultProps} />);
      const user = userEvent.setup();

      // Save without changing status
      await user.click(screen.getByRole('button', { name: /Save Changes/i }));

      await waitFor(() => {
        expect(mockUpdateDoc).toHaveBeenCalled();
      });

      const updateCall = mockUpdateDoc.mock.calls[0];
      expect(updateCall[1].status).toBe('active');
    });
  });

  describe('Field Updates', () => {
    it('should update phone number', async () => {
      render(<EditUserDialog {...defaultProps} />);
      const user = userEvent.setup();

      const phoneField = screen.getByLabelText(/^Phone$/i);
      await user.clear(phoneField);
      await user.type(phoneField, '999-888-7777');

      await user.click(screen.getByRole('button', { name: /Save Changes/i }));

      await waitFor(() => {
        expect(mockUpdateDoc).toHaveBeenCalled();
      });

      const updateCall = mockUpdateDoc.mock.calls[0];
      expect(updateCall[1].phone).toBe('999-888-7777');
    }, 15000);

    it('should save null for empty optional fields', async () => {
      render(<EditUserDialog {...defaultProps} />);
      const user = userEvent.setup();

      // Clear phone
      const phoneField = screen.getByLabelText(/^Phone$/i);
      await user.clear(phoneField);

      await user.click(screen.getByRole('button', { name: /Save Changes/i }));

      await waitFor(() => {
        expect(mockUpdateDoc).toHaveBeenCalled();
      });

      const updateCall = mockUpdateDoc.mock.calls[0];
      expect(updateCall[1].phone).toBeNull();
    }, 15000);
  });
});
