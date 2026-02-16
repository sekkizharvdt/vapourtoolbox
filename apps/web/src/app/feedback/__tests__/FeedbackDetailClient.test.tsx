/**
 * Tests for FeedbackDetailClient component
 *
 * Tests feedback detail view, follow-up comments, and closing feedback.
 */

import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import FeedbackDetailClient from '../[id]/FeedbackDetailClient';

// Mock Firebase
const mockOnSnapshot = jest.fn();
const mockDoc = jest.fn();

jest.mock('firebase/firestore', () => ({
  doc: (...args: unknown[]) => mockDoc(...args),
  onSnapshot: (...args: unknown[]) => mockOnSnapshot(...args),
  getDoc: jest.fn(() => Promise.resolve({ exists: () => false, data: () => null })),
  Timestamp: {
    now: jest.fn(() => ({ toDate: () => new Date() })),
  },
}));

jest.mock('@/lib/firebase', () => ({
  getFirebase: jest.fn(() => ({
    db: {},
  })),
}));

// Mock feedbackTaskService
const mockCloseFeedbackFromTask = jest.fn();
const mockAddFollowUpToFeedback = jest.fn();

jest.mock('@/lib/feedback/feedbackTaskService', () => ({
  closeFeedbackFromTask: (...args: unknown[]) => mockCloseFeedbackFromTask(...args),
  addFollowUpToFeedback: (...args: unknown[]) => mockAddFollowUpToFeedback(...args),
}));

// Mock taskNotificationService
const mockFindTaskNotificationByEntity = jest.fn();
const mockCompleteActionableTask = jest.fn();

jest.mock('@/lib/tasks/taskNotificationService', () => ({
  findTaskNotificationByEntity: (...args: unknown[]) => mockFindTaskNotificationByEntity(...args),
  completeActionableTask: (...args: unknown[]) => mockCompleteActionableTask(...args),
}));

// Mock AuthContext
const mockUser = {
  uid: 'test-user-id',
  email: 'test@example.com',
  displayName: 'Test User',
};

jest.mock('@/contexts/AuthContext', () => ({
  useAuth: jest.fn(() => ({
    user: mockUser,
    loading: false,
  })),
}));

// Mock next/navigation
const mockPush = jest.fn();
jest.mock('next/navigation', () => ({
  usePathname: jest.fn(() => '/feedback/test-feedback-id'),
  useRouter: jest.fn(() => ({
    push: mockPush,
  })),
}));

// Mock AuthenticatedLayout
jest.mock('@/components/layout/AuthenticatedLayout', () => ({
  AuthenticatedLayout: ({ children }: { children: React.ReactNode }) => (
    <div data-testid="authenticated-layout">{children}</div>
  ),
}));

// Mock PageHeader
jest.mock('@vapour/ui', () => ({
  PageHeader: ({ title }: { title: string }) => <h1 data-testid="page-header">{title}</h1>,
}));

// Mock MUI icons - these are imported as named exports
jest.mock('@mui/icons-material', () => {
  const BugReportIcon = () => <span data-testid="bug-icon" />;
  BugReportIcon.displayName = 'MockBugReportIcon';

  const LightbulbIcon = () => <span data-testid="lightbulb-icon" />;
  LightbulbIcon.displayName = 'MockLightbulbIcon';

  const ChatBubbleIcon = () => <span data-testid="chat-icon" />;
  ChatBubbleIcon.displayName = 'MockChatBubbleIcon';

  const CheckCircleIcon = () => <span data-testid="check-icon" />;
  CheckCircleIcon.displayName = 'MockCheckCircleIcon';

  const ReplayIcon = () => <span data-testid="replay-icon" />;
  ReplayIcon.displayName = 'MockReplayIcon';

  const HomeIcon = () => <span data-testid="home-icon" />;
  HomeIcon.displayName = 'MockHomeIcon';

  return {
    BugReport: BugReportIcon,
    Lightbulb: LightbulbIcon,
    ChatBubble: ChatBubbleIcon,
    CheckCircle: CheckCircleIcon,
    Replay: ReplayIcon,
    Home: HomeIcon,
  };
});

// Sample feedback data
const createMockFeedback = (overrides = {}) => ({
  id: 'test-feedback-id',
  type: 'bug' as const,
  title: 'Test Bug Report',
  description: 'This is a test bug description',
  status: 'new' as const,
  userName: 'Test User',
  userEmail: 'test@example.com',
  userId: 'test-user-id',
  createdAt: { toDate: () => new Date('2024-01-15') },
  updatedAt: { toDate: () => new Date('2024-01-16') },
  ...overrides,
});

describe('FeedbackDetailClient', () => {
  let unsubscribeMock: jest.Mock;

  beforeEach(() => {
    jest.clearAllMocks();
    unsubscribeMock = jest.fn();

    // Default snapshot behavior - returns mock feedback
    mockOnSnapshot.mockImplementation((_, callback) => {
      callback({
        exists: () => true,
        id: 'test-feedback-id',
        data: () => createMockFeedback(),
      });
      return unsubscribeMock;
    });

    mockCloseFeedbackFromTask.mockResolvedValue(undefined);
    mockAddFollowUpToFeedback.mockResolvedValue(undefined);
    mockFindTaskNotificationByEntity.mockResolvedValue(null);
    mockCompleteActionableTask.mockResolvedValue(undefined);
  });

  describe('Loading State', () => {
    it('should show loading spinner initially', async () => {
      // Delay the snapshot callback
      mockOnSnapshot.mockImplementation(() => {
        return unsubscribeMock;
      });

      const { useAuth } = jest.requireMock('@/contexts/AuthContext');
      useAuth.mockReturnValue({ user: mockUser, loading: true });

      render(<FeedbackDetailClient />);

      expect(screen.getByRole('progressbar')).toBeInTheDocument();

      // Reset for other tests
      useAuth.mockReturnValue({ user: mockUser, loading: false });
    });
  });

  describe('Error State', () => {
    it('should show error when feedback not found', async () => {
      mockOnSnapshot.mockImplementation((_, callback) => {
        callback({
          exists: () => false,
        });
        return unsubscribeMock;
      });

      render(<FeedbackDetailClient />);

      await waitFor(() => {
        expect(screen.getByText('Feedback not found')).toBeInTheDocument();
      });
    });

    it('should show error on Firebase error', async () => {
      mockOnSnapshot.mockImplementation((_, __, errorCallback) => {
        errorCallback(new Error('Firebase error'));
        return unsubscribeMock;
      });

      render(<FeedbackDetailClient />);

      await waitFor(() => {
        expect(screen.getByText('Failed to load feedback')).toBeInTheDocument();
      });
    });

    it('should show back button on error', async () => {
      mockOnSnapshot.mockImplementation((_, callback) => {
        callback({
          exists: () => false,
        });
        return unsubscribeMock;
      });

      render(<FeedbackDetailClient />);

      await waitFor(() => {
        expect(screen.getByText('Back to Feedback')).toBeInTheDocument();
      });
    });
  });

  describe('Feedback Display', () => {
    it('should display feedback title', async () => {
      render(<FeedbackDetailClient />);

      await waitFor(() => {
        expect(screen.getByTestId('page-header')).toHaveTextContent('Test Bug Report');
      });
    });

    it('should display feedback description', async () => {
      render(<FeedbackDetailClient />);

      await waitFor(() => {
        expect(screen.getByText('This is a test bug description')).toBeInTheDocument();
      });
    });

    it('should display status chip', async () => {
      render(<FeedbackDetailClient />);

      await waitFor(() => {
        expect(screen.getByText('New')).toBeInTheDocument();
      });
    });

    it('should display type chip for bug report', async () => {
      render(<FeedbackDetailClient />);

      await waitFor(() => {
        expect(screen.getByText('Bug Report')).toBeInTheDocument();
      });
    });

    it('should display type chip for feature request', async () => {
      mockOnSnapshot.mockImplementation((_, callback) => {
        callback({
          exists: () => true,
          id: 'test-feedback-id',
          data: () => createMockFeedback({ type: 'feature' }),
        });
        return unsubscribeMock;
      });

      render(<FeedbackDetailClient />);

      await waitFor(() => {
        expect(screen.getByText('Feature Request')).toBeInTheDocument();
      });
    });

    it('should display submitter information', async () => {
      render(<FeedbackDetailClient />);

      await waitFor(() => {
        expect(screen.getByText('Test User')).toBeInTheDocument();
      });
    });

    it('should display screenshots when available', async () => {
      mockOnSnapshot.mockImplementation((_, callback) => {
        callback({
          exists: () => true,
          id: 'test-feedback-id',
          data: () =>
            createMockFeedback({
              screenshotUrls: ['https://example.com/screenshot1.png'],
            }),
        });
        return unsubscribeMock;
      });

      render(<FeedbackDetailClient />);

      await waitFor(() => {
        expect(screen.getByText('Screenshots')).toBeInTheDocument();
        expect(screen.getByAltText('Screenshot 1')).toBeInTheDocument();
      });
    });

    it('should display admin notes when available', async () => {
      mockOnSnapshot.mockImplementation((_, callback) => {
        callback({
          exists: () => true,
          id: 'test-feedback-id',
          data: () =>
            createMockFeedback({
              adminNotes: 'This has been fixed in version 1.2.3',
            }),
        });
        return unsubscribeMock;
      });

      render(<FeedbackDetailClient />);

      await waitFor(() => {
        expect(screen.getByText('Resolution Notes')).toBeInTheDocument();
        expect(screen.getByText('This has been fixed in version 1.2.3')).toBeInTheDocument();
      });
    });

    it('should display follow-up comments when available', async () => {
      mockOnSnapshot.mockImplementation((_, callback) => {
        callback({
          exists: () => true,
          id: 'test-feedback-id',
          data: () =>
            createMockFeedback({
              followUpComments: [
                {
                  userId: 'test-user-id',
                  userName: 'Test User',
                  comment: 'Still having this issue',
                  createdAt: { toDate: () => new Date() },
                },
              ],
            }),
        });
        return unsubscribeMock;
      });

      render(<FeedbackDetailClient />);

      await waitFor(() => {
        expect(screen.getByText('Follow-up Comments')).toBeInTheDocument();
        expect(screen.getByText('Still having this issue')).toBeInTheDocument();
      });
    });
  });

  describe('Resolved Feedback Actions', () => {
    beforeEach(() => {
      mockOnSnapshot.mockImplementation((_, callback) => {
        callback({
          exists: () => true,
          id: 'test-feedback-id',
          data: () =>
            createMockFeedback({
              status: 'resolved',
              userId: 'test-user-id', // User is the owner
            }),
        });
        return unsubscribeMock;
      });
    });

    it('should show action banner for resolved feedback owned by user', async () => {
      render(<FeedbackDetailClient />);

      await waitFor(() => {
        expect(screen.getByText(/This issue has been marked as resolved/i)).toBeInTheDocument();
      });
    });

    it('should show Close and Follow Up buttons', async () => {
      render(<FeedbackDetailClient />);

      await waitFor(() => {
        expect(screen.getByRole('button', { name: /Close - Resolved/i })).toBeInTheDocument();
        expect(screen.getByRole('button', { name: /Follow Up/i })).toBeInTheDocument();
      });
    });

    it('should NOT show action banner for non-owner', async () => {
      mockOnSnapshot.mockImplementation((_, callback) => {
        callback({
          exists: () => true,
          id: 'test-feedback-id',
          data: () =>
            createMockFeedback({
              status: 'resolved',
              userId: 'different-user-id', // Different user
            }),
        });
        return unsubscribeMock;
      });

      render(<FeedbackDetailClient />);

      await waitFor(() => {
        expect(screen.getByText('Resolved')).toBeInTheDocument();
      });

      expect(screen.queryByText(/This issue has been marked as resolved/i)).not.toBeInTheDocument();
    });
  });

  describe('Close Feedback', () => {
    beforeEach(() => {
      mockOnSnapshot.mockImplementation((_, callback) => {
        callback({
          exists: () => true,
          id: 'test-feedback-id',
          data: () =>
            createMockFeedback({
              status: 'resolved',
              userId: 'test-user-id',
            }),
        });
        return unsubscribeMock;
      });
    });

    it('should open confirmation dialog when Close button is clicked', async () => {
      render(<FeedbackDetailClient />);

      await waitFor(() => {
        fireEvent.click(screen.getByRole('button', { name: /Close - Resolved/i }));
      });

      expect(screen.getByText('Close Feedback')).toBeInTheDocument();
      expect(screen.getByText(/Are you satisfied with the resolution/i)).toBeInTheDocument();
    });

    it('should close feedback when confirmed', async () => {
      render(<FeedbackDetailClient />);

      await waitFor(() => {
        fireEvent.click(screen.getByRole('button', { name: /Close - Resolved/i }));
      });

      fireEvent.click(screen.getByRole('button', { name: /Yes, Close Feedback/i }));

      await waitFor(() => {
        expect(mockCloseFeedbackFromTask).toHaveBeenCalledWith(
          expect.anything(),
          'test-feedback-id',
          'test-user-id',
          'Test User'
        );
      });
    });

    it('should cancel close when Cancel is clicked', async () => {
      render(<FeedbackDetailClient />);

      await waitFor(() => {
        fireEvent.click(screen.getByRole('button', { name: /Close - Resolved/i }));
      });

      fireEvent.click(screen.getByRole('button', { name: /Cancel/i }));

      expect(mockCloseFeedbackFromTask).not.toHaveBeenCalled();
    });
  });

  describe('Follow-up Comments', () => {
    beforeEach(() => {
      mockOnSnapshot.mockImplementation((_, callback) => {
        callback({
          exists: () => true,
          id: 'test-feedback-id',
          data: () =>
            createMockFeedback({
              status: 'resolved',
              userId: 'test-user-id',
            }),
        });
        return unsubscribeMock;
      });
    });

    it('should open follow-up dialog when Follow Up button is clicked', async () => {
      render(<FeedbackDetailClient />);

      await waitFor(() => {
        fireEvent.click(screen.getByRole('button', { name: /Follow Up/i }));
      });

      expect(screen.getByText('Add Follow-up Comment')).toBeInTheDocument();
    });

    it('should submit follow-up comment', async () => {
      render(<FeedbackDetailClient />);

      await waitFor(() => {
        fireEvent.click(screen.getByRole('button', { name: /Follow Up/i }));
      });

      const textarea = screen.getByPlaceholderText(/Describe what is still not working/i);
      await userEvent.type(textarea, 'The issue is still occurring');

      fireEvent.click(screen.getByRole('button', { name: /Submit Follow-up/i }));

      await waitFor(() => {
        expect(mockAddFollowUpToFeedback).toHaveBeenCalledWith(
          expect.anything(),
          'test-feedback-id',
          'The issue is still occurring',
          'test-user-id',
          'Test User'
        );
      });
    });

    it('should disable submit button when comment is empty', async () => {
      render(<FeedbackDetailClient />);

      await waitFor(() => {
        fireEvent.click(screen.getByRole('button', { name: /Follow Up/i }));
      });

      expect(screen.getByRole('button', { name: /Submit Follow-up/i })).toBeDisabled();
    });
  });

  describe('Navigation', () => {
    it('should navigate back when Back button is clicked', async () => {
      render(<FeedbackDetailClient />);

      await waitFor(() => {
        expect(screen.getByTestId('page-header')).toHaveTextContent('Test Bug Report');
      });

      fireEvent.click(screen.getByText('Back to Feedback'));

      expect(mockPush).toHaveBeenCalledWith('/feedback');
    });

    it('should render breadcrumbs', async () => {
      render(<FeedbackDetailClient />);

      await waitFor(() => {
        expect(screen.getByText('Feedback')).toBeInTheDocument();
      });
    });
  });

  describe('Closed Feedback', () => {
    it('should display closed message when status is closed', async () => {
      mockOnSnapshot.mockImplementation((_, callback) => {
        callback({
          exists: () => true,
          id: 'test-feedback-id',
          data: () =>
            createMockFeedback({
              status: 'closed',
              closedAt: { toDate: () => new Date() },
              closedByName: 'Test User',
            }),
        });
        return unsubscribeMock;
      });

      render(<FeedbackDetailClient />);

      await waitFor(() => {
        expect(screen.getByText(/This feedback was closed by Test User/i)).toBeInTheDocument();
      });
    });
  });

  describe('Cleanup', () => {
    it('should unsubscribe from snapshot on unmount', async () => {
      const { unmount } = render(<FeedbackDetailClient />);

      await waitFor(() => {
        expect(screen.getByTestId('page-header')).toHaveTextContent('Test Bug Report');
      });

      unmount();

      expect(unsubscribeMock).toHaveBeenCalled();
    });
  });
});
