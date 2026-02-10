/**
 * User Management Page Integration Tests
 *
 * These tests verify the integration of the user management page
 * with Firestore and its various components.
 */
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import type { User } from '@vapour/types';

// Mock next/navigation
const mockPush = jest.fn();
const mockRouter = {
  push: mockPush,
  replace: jest.fn(),
  prefetch: jest.fn(),
};
jest.mock('next/navigation', () => ({
  useRouter: () => mockRouter,
}));

// Mock next/image
jest.mock('next/image', () => ({
  __esModule: true,
  default: (props: Record<string, unknown>) => {
    // eslint-disable-next-line @next/next/no-img-element, jsx-a11y/alt-text
    return <img {...props} />;
  },
}));

// Mock Firestore
const mockUnsubscribe = jest.fn();
const mockOnSnapshot = jest.fn();

jest.mock('firebase/firestore', () => ({
  collection: jest.fn(() => ({ id: 'users' })),
  query: jest.fn(() => ({ id: 'mock-query' })),
  where: jest.fn(() => 'where-clause'),
  orderBy: jest.fn(() => 'orderBy-clause'),
  limit: jest.fn(() => 'limit-clause'),
  onSnapshot: (...args: unknown[]) => mockOnSnapshot(...args),
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

jest.mock('@/contexts/AuthContext', () => ({
  useAuth: jest.fn(() => ({
    user: { uid: 'admin-uid', email: 'admin@example.com', displayName: 'Admin User' },
  })),
}));

jest.mock('@/lib/audit', () => ({
  logAuditEvent: jest.fn(),
  createFieldChanges: jest.fn(() => []),
  createAuditContext: jest.fn(() => ({
    userId: 'admin-uid',
    userEmail: 'admin@example.com',
    userName: 'Admin User',
  })),
}));

// Import after mocks are set up
import UserManagementPage from '../page';
import { getAllPermissions } from '@vapour/constants';

// Test data factory
const createMockUser = (overrides: Partial<User> = {}): User => ({
  uid: `user-${Math.random().toString(36).substr(2, 9)}`,
  email: 'user@example.com',
  displayName: 'Test User',
  phone: undefined,
  mobile: undefined,
  jobTitle: 'Engineer',
  department: 'ENGINEERING' as const,
  status: 'active' as const,
  permissions: 16, // VIEW_PROJECTS
  permissions2: 0,
  isActive: true,
  assignedProjects: [],
  createdAt: {
    seconds: Date.now() / 1000,
    nanoseconds: 0,
    toDate: () => new Date(),
  } as unknown as User['createdAt'],
  updatedAt: { seconds: Date.now() / 1000, nanoseconds: 0 } as unknown as User['updatedAt'],
  ...overrides,
});

describe('UserManagementPage', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    // Default: return empty snapshot
    mockOnSnapshot.mockImplementation((_, onSuccess) => {
      onSuccess({
        forEach: jest.fn(),
      });
      return mockUnsubscribe;
    });
  });

  describe('Initial Render', () => {
    it('should render page title', async () => {
      render(<UserManagementPage />);

      expect(screen.getByText('User Management')).toBeInTheDocument();
      expect(screen.getByText('Manage users, permissions, and module access')).toBeInTheDocument();
    });

    it('should render action buttons', async () => {
      render(<UserManagementPage />);

      expect(screen.getByRole('button', { name: /Permission Matrix/i })).toBeInTheDocument();
      expect(screen.getByRole('button', { name: /Invite User/i })).toBeInTheDocument();
    });

    it('should render filter controls', async () => {
      render(<UserManagementPage />);

      expect(screen.getByPlaceholderText(/Search by name or email/i)).toBeInTheDocument();
      // Status filter - there are multiple Status texts (label + column header), check at least one exists
      expect(screen.getAllByText('Status').length).toBeGreaterThan(0);
    });

    it('should display open modules info', () => {
      render(<UserManagementPage />);

      expect(screen.getByText(/Open to all users:/i)).toBeInTheDocument();
    });
  });

  describe('Loading State', () => {
    it('should show loading state initially', async () => {
      // Mock onSnapshot to not call success immediately
      mockOnSnapshot.mockImplementation(() => mockUnsubscribe);

      render(<UserManagementPage />);

      expect(screen.getByText('Loading users...')).toBeInTheDocument();
    });
  });

  describe('User List', () => {
    it('should display users from Firestore', async () => {
      const testUsers = [
        createMockUser({ uid: 'user-1', displayName: 'Alice Smith', email: 'alice@example.com' }),
        createMockUser({ uid: 'user-2', displayName: 'Bob Jones', email: 'bob@example.com' }),
      ];

      mockOnSnapshot.mockImplementation((_, onSuccess) => {
        onSuccess({
          forEach: (callback: (doc: unknown) => void) => {
            testUsers.forEach((user) => {
              callback({ id: user.uid, data: () => user });
            });
          },
        });
        return mockUnsubscribe;
      });

      render(<UserManagementPage />);

      await waitFor(() => {
        expect(screen.getByText('Alice Smith')).toBeInTheDocument();
        expect(screen.getByText('Bob Jones')).toBeInTheDocument();
      });
    });

    it('should display user emails', async () => {
      const testUser = createMockUser({
        uid: 'user-1',
        displayName: 'Test User',
        email: 'test@company.com',
      });

      mockOnSnapshot.mockImplementation((_, onSuccess) => {
        onSuccess({
          forEach: (callback: (doc: unknown) => void) => {
            callback({ id: testUser.uid, data: () => testUser });
          },
        });
        return mockUnsubscribe;
      });

      render(<UserManagementPage />);

      await waitFor(() => {
        expect(screen.getByText('test@company.com')).toBeInTheDocument();
      });
    });

    it('should display empty state when no users', async () => {
      mockOnSnapshot.mockImplementation((_, onSuccess) => {
        onSuccess({
          forEach: jest.fn(),
        });
        return mockUnsubscribe;
      });

      render(<UserManagementPage />);

      await waitFor(() => {
        expect(screen.getByText('No users found')).toBeInTheDocument();
      });
    });
  });

  describe('Search Filtering', () => {
    it('should filter users by name', async () => {
      const testUsers = [
        createMockUser({ uid: 'user-1', displayName: 'Alice Johnson', email: 'alice@test.com' }),
        createMockUser({ uid: 'user-2', displayName: 'Bob Smith', email: 'bob@test.com' }),
      ];

      mockOnSnapshot.mockImplementation((_, onSuccess) => {
        onSuccess({
          forEach: (callback: (doc: unknown) => void) => {
            testUsers.forEach((user) => {
              callback({ id: user.uid, data: () => user });
            });
          },
        });
        return mockUnsubscribe;
      });

      render(<UserManagementPage />);
      const user = userEvent.setup();

      // Wait for initial render
      await waitFor(() => {
        expect(screen.getByText('Alice Johnson')).toBeInTheDocument();
      });

      // Search for "Bob"
      const searchInput = screen.getByPlaceholderText(/Search by name or email/i);
      await user.type(searchInput, 'Bob');

      // Should only show Bob
      expect(screen.queryByText('Alice Johnson')).not.toBeInTheDocument();
      expect(screen.getByText('Bob Smith')).toBeInTheDocument();
    });

    it('should filter users by email', async () => {
      const testUsers = [
        createMockUser({
          uid: 'user-1',
          displayName: 'User One',
          email: 'engineering@company.com',
        }),
        createMockUser({
          uid: 'user-2',
          displayName: 'User Two',
          email: 'finance@company.com',
        }),
      ];

      mockOnSnapshot.mockImplementation((_, onSuccess) => {
        onSuccess({
          forEach: (callback: (doc: unknown) => void) => {
            testUsers.forEach((user) => {
              callback({ id: user.uid, data: () => user });
            });
          },
        });
        return mockUnsubscribe;
      });

      render(<UserManagementPage />);
      const user = userEvent.setup();

      await waitFor(() => {
        expect(screen.getByText('User One')).toBeInTheDocument();
      });

      // Search for email domain
      const searchInput = screen.getByPlaceholderText(/Search by name or email/i);
      await user.type(searchInput, 'finance@');

      expect(screen.queryByText('User One')).not.toBeInTheDocument();
      expect(screen.getByText('User Two')).toBeInTheDocument();
    });
  });

  describe('Pending Users Section', () => {
    it('should show pending users section when pending users exist', async () => {
      const pendingUser = createMockUser({
        uid: 'pending-1',
        displayName: 'Pending User',
        email: 'pending@example.com',
        status: 'pending',
      });

      mockOnSnapshot.mockImplementation((_, onSuccess) => {
        onSuccess({
          forEach: (callback: (doc: unknown) => void) => {
            callback({ id: pendingUser.uid, data: () => pendingUser });
          },
        });
        return mockUnsubscribe;
      });

      render(<UserManagementPage />);

      await waitFor(() => {
        expect(screen.getByText(/Users? Awaiting Approval/i)).toBeInTheDocument();
        expect(screen.getByText('Pending User')).toBeInTheDocument();
      });
    });

    it('should display Review & Approve button for pending users', async () => {
      const pendingUser = createMockUser({
        uid: 'pending-1',
        displayName: 'Pending User',
        status: 'pending',
      });

      mockOnSnapshot.mockImplementation((_, onSuccess) => {
        onSuccess({
          forEach: (callback: (doc: unknown) => void) => {
            callback({ id: pendingUser.uid, data: () => pendingUser });
          },
        });
        return mockUnsubscribe;
      });

      render(<UserManagementPage />);

      await waitFor(() => {
        expect(screen.getByRole('button', { name: /Review & Approve/i })).toBeInTheDocument();
      });
    });

    it('should not show pending users section when no pending users', async () => {
      const activeUser = createMockUser({
        uid: 'user-1',
        displayName: 'Active User',
        status: 'active',
      });

      mockOnSnapshot.mockImplementation((_, onSuccess) => {
        onSuccess({
          forEach: (callback: (doc: unknown) => void) => {
            callback({ id: activeUser.uid, data: () => activeUser });
          },
        });
        return mockUnsubscribe;
      });

      render(<UserManagementPage />);

      await waitFor(() => {
        expect(screen.getByText('Active User')).toBeInTheDocument();
      });

      expect(screen.queryByText(/Users? Awaiting Approval/i)).not.toBeInTheDocument();
    });
  });

  describe('Module Access Display', () => {
    it('should show Full Access chip for users with all permissions', async () => {
      const fullAccessUser = createMockUser({
        uid: 'admin-1',
        displayName: 'Admin User',
        permissions: getAllPermissions(), // All permissions
      });

      mockOnSnapshot.mockImplementation((_, onSuccess) => {
        onSuccess({
          forEach: (callback: (doc: unknown) => void) => {
            callback({ id: fullAccessUser.uid, data: () => fullAccessUser });
          },
        });
        return mockUnsubscribe;
      });

      render(<UserManagementPage />);

      await waitFor(() => {
        expect(screen.getByText('Full Access')).toBeInTheDocument();
      });
    });

    it('should show No module access for users with zero permissions', async () => {
      const noAccessUser = createMockUser({
        uid: 'user-1',
        displayName: 'No Access User',
        permissions: 0,
        permissions2: 0,
      });

      mockOnSnapshot.mockImplementation((_, onSuccess) => {
        onSuccess({
          forEach: (callback: (doc: unknown) => void) => {
            callback({ id: noAccessUser.uid, data: () => noAccessUser });
          },
        });
        return mockUnsubscribe;
      });

      render(<UserManagementPage />);

      await waitFor(() => {
        expect(screen.getByText('No module access')).toBeInTheDocument();
      });
    });
  });

  describe('Navigation', () => {
    it('should navigate to Permission Matrix when button clicked', async () => {
      render(<UserManagementPage />);
      const user = userEvent.setup();

      await user.click(screen.getByRole('button', { name: /Permission Matrix/i }));

      expect(mockPush).toHaveBeenCalledWith('/admin/users/permissions');
    });
  });

  describe('Edit User Dialog', () => {
    it('should open edit dialog when Edit button clicked', async () => {
      const testUser = createMockUser({
        uid: 'user-1',
        displayName: 'Editable User',
        email: 'edit@example.com',
      });

      mockOnSnapshot.mockImplementation((_, onSuccess) => {
        onSuccess({
          forEach: (callback: (doc: unknown) => void) => {
            callback({ id: testUser.uid, data: () => testUser });
          },
        });
        return mockUnsubscribe;
      });

      render(<UserManagementPage />);
      const user = userEvent.setup();

      await waitFor(() => {
        expect(screen.getByText('Editable User')).toBeInTheDocument();
      });

      // Find and click the edit button (there may be multiple action cells)
      const editButtons = screen.getAllByLabelText(/Edit User/i);
      await user.click(editButtons[0]!);

      // Edit dialog should open
      await waitFor(() => {
        expect(screen.getByText('Edit User')).toBeInTheDocument();
      });
    });
  });

  describe('Approve User Dialog', () => {
    it('should open approve dialog when Review & Approve clicked', async () => {
      const pendingUser = createMockUser({
        uid: 'pending-1',
        displayName: 'Pending User',
        email: 'pending@example.com',
        status: 'pending',
      });

      mockOnSnapshot.mockImplementation((_, onSuccess) => {
        onSuccess({
          forEach: (callback: (doc: unknown) => void) => {
            callback({ id: pendingUser.uid, data: () => pendingUser });
          },
        });
        return mockUnsubscribe;
      });

      render(<UserManagementPage />);
      const user = userEvent.setup();

      await waitFor(() => {
        expect(screen.getByText('Pending User')).toBeInTheDocument();
      });

      // Click Review & Approve
      await user.click(screen.getByRole('button', { name: /Review & Approve/i }));

      // Approve dialog should open
      await waitFor(() => {
        expect(screen.getByText('Approve New User')).toBeInTheDocument();
      });
    });
  });

  describe('Error Handling', () => {
    it('should display error message on Firestore error', async () => {
      mockOnSnapshot.mockImplementation((_, __, onError) => {
        onError(new Error('Firestore connection failed'));
        return mockUnsubscribe;
      });

      render(<UserManagementPage />);

      await waitFor(() => {
        expect(screen.getByText('Failed to load users. Please try again.')).toBeInTheDocument();
      });
    });
  });

  describe('Cleanup', () => {
    it('should unsubscribe from Firestore on unmount', () => {
      mockOnSnapshot.mockImplementation((_, onSuccess) => {
        onSuccess({ forEach: jest.fn() });
        return mockUnsubscribe;
      });

      const { unmount } = render(<UserManagementPage />);

      unmount();

      expect(mockUnsubscribe).toHaveBeenCalled();
    });
  });
});
