import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { ApproveUserDialog } from '../ApproveUserDialog';
import { PERMISSION_PRESETS, getAllPermissions, getAllPermissions2 } from '@vapour/constants';
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

// Mock window.confirm for reject action
const mockConfirm = jest.fn();
window.confirm = mockConfirm;

// Helper to select a department (MUI Select requires special handling)
async function selectDepartment(user: ReturnType<typeof userEvent.setup>, departmentName: string) {
  // MUI Select renders as a button with role="combobox"
  // First find the FormControl containing the Department label, then find its select
  const formControl = screen.getByText('Department').closest('.MuiFormControl-root');
  const selectButton = formControl?.querySelector('[role="combobox"]') as HTMLElement;
  if (selectButton) {
    await user.click(selectButton);
    await user.click(screen.getByRole('option', { name: new RegExp(departmentName, 'i') }));
  }
}

// Create a mock pending user for testing
const createMockPendingUser = (overrides: Partial<User> = {}): User => ({
  uid: 'pending-user-id',
  email: 'newuser@example.com',
  displayName: 'New User',
  phone: undefined,
  mobile: undefined,
  jobTitle: undefined,
  department: undefined,
  status: 'pending' as const,
  permissions: 0,
  permissions2: 0,
  isActive: false,
  assignedProjects: [],
  createdAt: {
    seconds: Date.now() / 1000,
    nanoseconds: 0,
    toDate: () => new Date(),
  } as unknown as User['createdAt'],
  updatedAt: { seconds: Date.now() / 1000, nanoseconds: 0 } as unknown as User['updatedAt'],
  ...overrides,
});

describe('ApproveUserDialog', () => {
  const defaultProps = {
    open: true,
    user: createMockPendingUser(),
    onClose: jest.fn(),
    onSuccess: jest.fn(),
  };

  beforeEach(() => {
    jest.clearAllMocks();
    mockUpdateDoc.mockResolvedValue(undefined);
    mockConfirm.mockReturnValue(true);
  });

  describe('Rendering', () => {
    it('should render the dialog when open', () => {
      render(<ApproveUserDialog {...defaultProps} />);
      expect(screen.getByRole('dialog')).toBeInTheDocument();
      expect(screen.getByText('Approve New User')).toBeInTheDocument();
    });

    it('should not render when user is null', () => {
      render(<ApproveUserDialog {...defaultProps} user={null} />);
      expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    });

    it('should display user information', () => {
      render(<ApproveUserDialog {...defaultProps} />);
      expect(screen.getByText(/Name:/)).toBeInTheDocument();
      expect(screen.getByText('New User')).toBeInTheDocument();
      expect(screen.getByText(/Email:/)).toBeInTheDocument();
      expect(screen.getByText('newuser@example.com')).toBeInTheDocument();
    });

    it('should display job title and department fields', () => {
      render(<ApproveUserDialog {...defaultProps} />);
      expect(screen.getByLabelText(/Job Title/i)).toBeInTheDocument();
      // MUI Select label - check the text exists
      expect(screen.getByText('Department')).toBeInTheDocument();
    });

    it('should display quick preset buttons', () => {
      render(<ApproveUserDialog {...defaultProps} />);
      // Multiple Full Access buttons exist, so use getAllByRole
      expect(screen.getAllByRole('button', { name: /Full Access/i }).length).toBeGreaterThan(0);
      expect(screen.getByRole('button', { name: /Manager/i })).toBeInTheDocument();
      expect(screen.getByRole('button', { name: /Finance/i })).toBeInTheDocument();
      expect(screen.getByRole('button', { name: /Engineering/i })).toBeInTheDocument();
      expect(screen.getByRole('button', { name: /Procurement/i })).toBeInTheDocument();
      expect(screen.getByRole('button', { name: /Viewer/i })).toBeInTheDocument();
    });

    it('should display Approve, Reject, and Cancel buttons', () => {
      render(<ApproveUserDialog {...defaultProps} />);
      expect(screen.getByRole('button', { name: /Approve User/i })).toBeInTheDocument();
      expect(screen.getByRole('button', { name: /Reject/i })).toBeInTheDocument();
      expect(screen.getByRole('button', { name: /Cancel/i })).toBeInTheDocument();
    });

    it('should display open modules info', () => {
      render(<ApproveUserDialog {...defaultProps} />);
      expect(screen.getByText(/Open to all:/i)).toBeInTheDocument();
    });
  });

  describe('Form Validation', () => {
    it('should show error when no permissions selected', async () => {
      render(<ApproveUserDialog {...defaultProps} />);
      const user = userEvent.setup();

      // Select a department first
      await selectDepartment(user, 'Engineering');

      // Try to approve without permissions
      await user.click(screen.getByRole('button', { name: /Approve User/i }));

      expect(screen.getByText('At least one permission is required')).toBeInTheDocument();
      expect(mockUpdateDoc).not.toHaveBeenCalled();
    });

    it('should show error when no department selected', async () => {
      render(<ApproveUserDialog {...defaultProps} />);
      const user = userEvent.setup();

      // Select a permission first
      const viewProjectsCheckbox = screen.getAllByRole('checkbox').find((cb) => {
        const label = cb.closest('label');
        return label?.textContent?.includes('View Projects');
      });
      await user.click(viewProjectsCheckbox!);

      // Try to approve without department
      await user.click(screen.getByRole('button', { name: /Approve User/i }));

      expect(screen.getByText('Department is required')).toBeInTheDocument();
      expect(mockUpdateDoc).not.toHaveBeenCalled();
    });
  });

  describe('Approval Flow', () => {
    it('should call updateDoc with correct data on approval', async () => {
      render(<ApproveUserDialog {...defaultProps} />);
      const user = userEvent.setup();

      // Fill in job title
      const jobTitleField = screen.getByLabelText(/Job Title/i);
      await user.type(jobTitleField, 'Senior Engineer');

      // Select department
      await selectDepartment(user, 'Engineering');

      // Select a permission
      const viewProjectsCheckbox = screen.getAllByRole('checkbox').find((cb) => {
        const label = cb.closest('label');
        return label?.textContent?.includes('View Projects');
      });
      await user.click(viewProjectsCheckbox!);

      // Approve
      await user.click(screen.getByRole('button', { name: /Approve User/i }));

      await waitFor(() => {
        expect(mockUpdateDoc).toHaveBeenCalled();
      });

      const updateCall = mockUpdateDoc.mock.calls[0];
      expect(updateCall[1]).toMatchObject({
        department: 'ENGINEERING',
        jobTitle: 'Senior Engineer',
        status: 'active',
        isActive: true,
      });
      expect(updateCall[1].permissions).toBeGreaterThan(0);
    });

    it('should call onSuccess and onClose after successful approval', async () => {
      const onClose = jest.fn();
      const onSuccess = jest.fn();
      render(<ApproveUserDialog {...defaultProps} onClose={onClose} onSuccess={onSuccess} />);
      const user = userEvent.setup();

      // Setup valid form data
      await selectDepartment(user, 'Engineering');

      const viewProjectsCheckbox = screen.getAllByRole('checkbox').find((cb) => {
        const label = cb.closest('label');
        return label?.textContent?.includes('View Projects');
      });
      await user.click(viewProjectsCheckbox!);

      // Approve
      await user.click(screen.getByRole('button', { name: /Approve User/i }));

      await waitFor(() => {
        expect(onSuccess).toHaveBeenCalled();
        expect(onClose).toHaveBeenCalled();
      });
    });

    it('should show loading state during approval', async () => {
      let resolveUpdate: () => void;
      mockUpdateDoc.mockImplementation(
        () =>
          new Promise<void>((resolve) => {
            resolveUpdate = resolve;
          })
      );

      render(<ApproveUserDialog {...defaultProps} />);
      const user = userEvent.setup();

      // Setup valid form
      await selectDepartment(user, 'Engineering');

      const viewProjectsCheckbox = screen.getAllByRole('checkbox').find((cb) => {
        const label = cb.closest('label');
        return label?.textContent?.includes('View Projects');
      });
      await user.click(viewProjectsCheckbox!);

      // Start approval
      await user.click(screen.getByRole('button', { name: /Approve User/i }));

      expect(screen.getByText('Approving...')).toBeInTheDocument();

      // Resolve
      resolveUpdate!();

      await waitFor(() => {
        expect(screen.queryByText('Approving...')).not.toBeInTheDocument();
      });
    });

    it('should show error message on approval failure', async () => {
      mockUpdateDoc.mockRejectedValue(new Error('Network error'));

      render(<ApproveUserDialog {...defaultProps} />);
      const user = userEvent.setup();

      // Setup valid form
      await selectDepartment(user, 'Engineering');

      const viewProjectsCheckbox = screen.getAllByRole('checkbox').find((cb) => {
        const label = cb.closest('label');
        return label?.textContent?.includes('View Projects');
      });
      await user.click(viewProjectsCheckbox!);

      // Try to approve
      await user.click(screen.getByRole('button', { name: /Approve User/i }));

      await waitFor(() => {
        expect(screen.getByText('Network error')).toBeInTheDocument();
      });
    });
  });

  describe('Rejection Flow', () => {
    it('should show confirmation dialog when rejecting', async () => {
      render(<ApproveUserDialog {...defaultProps} />);
      const user = userEvent.setup();

      await user.click(screen.getByRole('button', { name: /Reject/i }));

      expect(mockConfirm).toHaveBeenCalledWith(
        'Are you sure you want to reject New User? This will mark them as inactive.'
      );
    });

    it('should call updateDoc with inactive status on rejection', async () => {
      mockConfirm.mockReturnValue(true);

      render(<ApproveUserDialog {...defaultProps} />);
      const user = userEvent.setup();

      await user.click(screen.getByRole('button', { name: /Reject/i }));

      await waitFor(() => {
        expect(mockUpdateDoc).toHaveBeenCalled();
      });

      const updateCall = mockUpdateDoc.mock.calls[0];
      expect(updateCall[1]).toMatchObject({
        status: 'inactive',
        isActive: false,
      });
    });

    it('should not reject if user cancels confirmation', async () => {
      mockConfirm.mockReturnValue(false);

      render(<ApproveUserDialog {...defaultProps} />);
      const user = userEvent.setup();

      await user.click(screen.getByRole('button', { name: /Reject/i }));

      expect(mockUpdateDoc).not.toHaveBeenCalled();
    });

    it('should call onSuccess and onClose after successful rejection', async () => {
      const onClose = jest.fn();
      const onSuccess = jest.fn();
      mockConfirm.mockReturnValue(true);

      render(<ApproveUserDialog {...defaultProps} onClose={onClose} onSuccess={onSuccess} />);
      const user = userEvent.setup();

      await user.click(screen.getByRole('button', { name: /Reject/i }));

      await waitFor(() => {
        expect(onSuccess).toHaveBeenCalled();
        expect(onClose).toHaveBeenCalled();
      });
    });
  });

  describe('Permission Presets', () => {
    it('should apply MANAGER preset when clicked', async () => {
      render(<ApproveUserDialog {...defaultProps} />);
      const user = userEvent.setup();

      // Click Manager preset button
      const managerPresetButtons = screen.getAllByRole('button', { name: /Manager/i });
      const presetButton = managerPresetButtons.find(
        (btn) => !btn.textContent?.includes('Full Access')
      );
      await user.click(presetButton!);

      // Setup department for approval
      await selectDepartment(user, 'Engineering');

      // Approve and check permissions
      await user.click(screen.getByRole('button', { name: /Approve User/i }));

      await waitFor(() => {
        expect(mockUpdateDoc).toHaveBeenCalled();
      });

      const updateCall = mockUpdateDoc.mock.calls[0];
      expect(updateCall[1].permissions).toBe(PERMISSION_PRESETS.MANAGER);
    });

    it('should apply FINANCE preset when clicked', async () => {
      render(<ApproveUserDialog {...defaultProps} />);
      const user = userEvent.setup();

      await user.click(screen.getByRole('button', { name: /Finance/i }));

      // Setup department for approval
      await selectDepartment(user, 'Finance');

      // Approve and check permissions
      await user.click(screen.getByRole('button', { name: /Approve User/i }));

      await waitFor(() => {
        expect(mockUpdateDoc).toHaveBeenCalled();
      });

      const updateCall = mockUpdateDoc.mock.calls[0];
      expect(updateCall[1].permissions).toBe(PERMISSION_PRESETS.FINANCE);
    });

    it('should apply FULL_ACCESS preset with permissions2 when clicked', async () => {
      render(<ApproveUserDialog {...defaultProps} />);
      const user = userEvent.setup();

      // Click the Full Access preset button in Quick Presets section
      const fullAccessButtons = screen.getAllByRole('button', { name: /Full Access/i });
      // First one in presets section (not the quick action one)
      await user.click(fullAccessButtons[0]!);

      // Setup department for approval
      await selectDepartment(user, 'Engineering');

      // Approve
      await user.click(screen.getByRole('button', { name: /Approve User/i }));

      await waitFor(() => {
        expect(mockUpdateDoc).toHaveBeenCalled();
      });

      const updateCall = mockUpdateDoc.mock.calls[0];
      expect(updateCall[1].permissions).toBe(PERMISSION_PRESETS.FULL_ACCESS);
      expect(updateCall[1].permissions2).toBe(getAllPermissions2());
    });
  });

  describe('Quick Actions', () => {
    it('should select all regular permissions when Select All is clicked', async () => {
      render(<ApproveUserDialog {...defaultProps} />);
      const user = userEvent.setup();

      await user.click(screen.getByRole('button', { name: /Select All/i }));

      // Check that multiple permissions are selected
      const checkboxes = screen.getAllByRole('checkbox');
      const checkedCount = checkboxes.filter((cb) => (cb as HTMLInputElement).checked).length;
      expect(checkedCount).toBeGreaterThan(5);
    });

    it('should clear all permissions when Clear is clicked', async () => {
      render(<ApproveUserDialog {...defaultProps} />);
      const user = userEvent.setup();

      // First select some permissions
      await user.click(screen.getByRole('button', { name: /Select All/i }));

      // Then clear
      await user.click(screen.getByRole('button', { name: /^Clear$/i }));

      // All checkboxes should be unchecked
      const checkboxes = screen.getAllByRole('checkbox');
      checkboxes.forEach((cb) => {
        expect(cb).not.toBeChecked();
      });
    });

    it('should grant full access when Full Access button is clicked', async () => {
      render(<ApproveUserDialog {...defaultProps} />);
      const user = userEvent.setup();

      // Find the Full Access quick action button (not the preset)
      const fullAccessButtons = screen.getAllByRole('button', { name: /Full Access/i });
      // The quick action button is the second one (in the permissions section)
      await user.click(fullAccessButtons[1]!);

      // All checkboxes should be checked
      const checkboxes = screen.getAllByRole('checkbox');
      checkboxes.forEach((cb) => {
        expect(cb).toBeChecked();
      });
    });

    it('should save all permissions when Full Access is granted', async () => {
      render(<ApproveUserDialog {...defaultProps} />);
      const user = userEvent.setup();

      // Grant full access
      const fullAccessButtons = screen.getAllByRole('button', { name: /Full Access/i });
      await user.click(fullAccessButtons[1]!);

      // Setup department
      await selectDepartment(user, 'Engineering');

      // Approve
      await user.click(screen.getByRole('button', { name: /Approve User/i }));

      await waitFor(() => {
        expect(mockUpdateDoc).toHaveBeenCalled();
      });

      const updateCall = mockUpdateDoc.mock.calls[0];
      expect(updateCall[1].permissions).toBe(getAllPermissions());
      expect(updateCall[1].permissions2).toBe(getAllPermissions2());
    });
  });

  describe('Permission Checkboxes', () => {
    it('should display regular permissions checkboxes', () => {
      render(<ApproveUserDialog {...defaultProps} />);

      expect(screen.getByText('View Projects')).toBeInTheDocument();
      expect(screen.getByText('Manage Projects')).toBeInTheDocument();
      expect(screen.getByText('View Accounting')).toBeInTheDocument();
    });

    it('should display admin permissions section', () => {
      render(<ApproveUserDialog {...defaultProps} />);

      expect(screen.getByText('Admin Permissions')).toBeInTheDocument();
      expect(screen.getByText('Manage Users')).toBeInTheDocument();
    });

    it('should toggle permission when checkbox is clicked', async () => {
      render(<ApproveUserDialog {...defaultProps} />);
      const user = userEvent.setup();

      const viewProjectsCheckbox = screen.getAllByRole('checkbox').find((cb) => {
        const label = cb.closest('label');
        return label?.textContent?.includes('View Projects');
      });

      expect(viewProjectsCheckbox).not.toBeChecked();

      // Toggle on
      await user.click(viewProjectsCheckbox!);
      expect(viewProjectsCheckbox).toBeChecked();

      // Toggle off
      await user.click(viewProjectsCheckbox!);
      expect(viewProjectsCheckbox).not.toBeChecked();
    });
  });

  describe('Dialog Behavior', () => {
    it('should call onClose when Cancel is clicked', async () => {
      const onClose = jest.fn();
      render(<ApproveUserDialog {...defaultProps} onClose={onClose} />);
      const user = userEvent.setup();

      await user.click(screen.getByRole('button', { name: /Cancel/i }));

      expect(onClose).toHaveBeenCalled();
    });

    it('should reset form when dialog closes', async () => {
      const onClose = jest.fn();
      const { rerender } = render(<ApproveUserDialog {...defaultProps} onClose={onClose} />);
      const user = userEvent.setup();

      // Fill in some data
      await user.type(screen.getByLabelText(/Job Title/i), 'Test Title');

      // Select a permission
      const viewProjectsCheckbox = screen.getAllByRole('checkbox').find((cb) => {
        const label = cb.closest('label');
        return label?.textContent?.includes('View Projects');
      });
      await user.click(viewProjectsCheckbox!);

      // Close the dialog
      await user.click(screen.getByRole('button', { name: /Cancel/i }));

      // Rerender with open=true again
      rerender(<ApproveUserDialog {...defaultProps} onClose={onClose} />);

      // Check that job title is empty and checkbox is unchecked
      expect(screen.getByLabelText(/Job Title/i)).toHaveValue('');
      const checkbox = screen.getAllByRole('checkbox').find((cb) => {
        const label = cb.closest('label');
        return label?.textContent?.includes('View Projects');
      });
      expect(checkbox).not.toBeChecked();
    });

    it('should not allow closing during loading', async () => {
      let resolveUpdate: () => void;
      mockUpdateDoc.mockImplementation(
        () =>
          new Promise<void>((resolve) => {
            resolveUpdate = resolve;
          })
      );

      const onClose = jest.fn();
      render(<ApproveUserDialog {...defaultProps} onClose={onClose} />);
      const user = userEvent.setup();

      // Setup valid form
      await selectDepartment(user, 'Engineering');

      const viewProjectsCheckbox = screen.getAllByRole('checkbox').find((cb) => {
        const label = cb.closest('label');
        return label?.textContent?.includes('View Projects');
      });
      await user.click(viewProjectsCheckbox!);

      // Start approval
      await user.click(screen.getByRole('button', { name: /Approve User/i }));

      // Verify cancel button is disabled
      const cancelButton = screen.getByRole('button', { name: /Cancel/i });
      expect(cancelButton).toBeDisabled();
      expect(onClose).not.toHaveBeenCalled();

      // Resolve the update
      resolveUpdate!();

      await waitFor(() => {
        expect(screen.queryByText('Approving...')).not.toBeInTheDocument();
      });
    });
  });

  describe('Job Title Field', () => {
    it('should save trimmed job title', async () => {
      render(<ApproveUserDialog {...defaultProps} />);
      const user = userEvent.setup();

      // Enter job title with whitespace
      await user.type(screen.getByLabelText(/Job Title/i), '  Senior Engineer  ');

      // Setup department
      await selectDepartment(user, 'Engineering');

      // Select permission
      const viewProjectsCheckbox = screen.getAllByRole('checkbox').find((cb) => {
        const label = cb.closest('label');
        return label?.textContent?.includes('View Projects');
      });
      await user.click(viewProjectsCheckbox!);

      // Approve
      await user.click(screen.getByRole('button', { name: /Approve User/i }));

      await waitFor(() => {
        expect(mockUpdateDoc).toHaveBeenCalled();
      });

      const updateCall = mockUpdateDoc.mock.calls[0];
      expect(updateCall[1].jobTitle).toBe('Senior Engineer');
    });

    it('should save null for empty job title', async () => {
      render(<ApproveUserDialog {...defaultProps} />);
      const user = userEvent.setup();

      // Setup department
      await selectDepartment(user, 'Engineering');

      // Select permission
      const viewProjectsCheckbox = screen.getAllByRole('checkbox').find((cb) => {
        const label = cb.closest('label');
        return label?.textContent?.includes('View Projects');
      });
      await user.click(viewProjectsCheckbox!);

      // Approve without filling job title
      await user.click(screen.getByRole('button', { name: /Approve User/i }));

      await waitFor(() => {
        expect(mockUpdateDoc).toHaveBeenCalled();
      });

      const updateCall = mockUpdateDoc.mock.calls[0];
      expect(updateCall[1].jobTitle).toBeNull();
    });
  });
});
