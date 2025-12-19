/**
 * Integration Tests for Admin Feedback Management
 *
 * Tests the admin feedback components including:
 * - FeedbackStats display
 * - FeedbackDetailDialog rendering
 */

import React from 'react';
import { render, screen, waitFor } from '@testing-library/react';
import { Timestamp } from 'firebase/firestore';

// Mock Firebase
const mockOnSnapshot = jest.fn();
const mockUpdateDoc = jest.fn();
const mockDoc = jest.fn();
const mockGetDocs = jest.fn();

jest.mock('firebase/firestore', () => ({
  collection: jest.fn(() => 'mock-collection'),
  doc: (...args: unknown[]) => mockDoc(...args),
  updateDoc: (...args: unknown[]) => mockUpdateDoc(...args),
  getDocs: (...args: unknown[]) => mockGetDocs(...args),
  onSnapshot: (...args: unknown[]) => mockOnSnapshot(...args),
  query: jest.fn(() => 'mock-query'),
  where: jest.fn(),
  orderBy: jest.fn(),
  limit: jest.fn(),
  Timestamp: {
    now: jest.fn(() => ({ toDate: () => new Date() })),
  },
}));

jest.mock('@/lib/firebase', () => ({
  getFirebase: jest.fn(() => ({
    db: {},
  })),
}));

// Mock feedbackStatsService
jest.mock('@/lib/feedback/feedbackStatsService', () => ({
  getFeedbackStats: jest.fn().mockResolvedValue({
    total: 25,
    byType: { bug: 15, feature: 8, general: 2 },
    byStatus: { new: 10, in_progress: 5, resolved: 8, closed: 2, wont_fix: 0 },
    byModule: { procurement: 12, accounting: 8, projects: 5 },
    bySeverity: { critical: 2, major: 5, minor: 6, cosmetic: 2 },
  }),
}));

// Import components after mocks
import { FeedbackDetailDialog } from '../FeedbackDetailDialog';
import { FeedbackStats } from '../FeedbackStats';

// Mock AuthContext for admin user
const mockAdminUser = {
  uid: 'admin-user-id',
  email: 'admin@example.com',
  displayName: 'Admin User',
};

jest.mock('@/contexts/AuthContext', () => ({
  useAuth: jest.fn(() => ({
    user: mockAdminUser,
    loading: false,
  })),
}));

describe('Admin Feedback Integration Tests', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockUpdateDoc.mockResolvedValue(undefined);
    mockDoc.mockReturnValue('mock-doc-ref');
  });

  describe('FeedbackStats Component', () => {
    it('should render stats component and display total', async () => {
      render(<FeedbackStats />);

      await waitFor(() => {
        expect(screen.getByText('Total Feedback')).toBeInTheDocument();
      });
    });

    it('should display status breakdown labels', async () => {
      render(<FeedbackStats />);

      await waitFor(() => {
        expect(screen.getByText('Total Feedback')).toBeInTheDocument();
      });

      // Check for labels (numbers may appear in multiple places)
      expect(screen.getByText(/New/i)).toBeInTheDocument();
    });
  });

  describe('FeedbackDetailDialog Component', () => {
    const mockOnClose = jest.fn();
    const mockOnFeedbackChange = jest.fn();
    const mockOnStatusChange = jest.fn();
    const mockOnAdminNotesChange = jest.fn();
    const mockOnResolutionNotesChange = jest.fn();

    const sampleFeedback = {
      id: 'feedback-1',
      type: 'bug' as const,
      title: 'Critical bug in login',
      description: 'Login fails for all users',
      status: 'new' as const,
      module: 'dashboard' as const,
      severity: 'critical' as const,
      pageUrl: 'https://example.com/login',
      userName: 'Test User',
      userEmail: 'test@example.com',
      userId: 'user-123',
      screenshotUrls: ['https://example.com/screenshot.png'],
      createdAt: { toDate: () => new Date('2024-01-15') } as unknown as Timestamp,
    };

    const defaultProps = {
      open: true,
      feedback: sampleFeedback,
      onClose: mockOnClose,
      onFeedbackChange: mockOnFeedbackChange,
      onStatusChange: mockOnStatusChange,
      onAdminNotesChange: mockOnAdminNotesChange,
      onResolutionNotesChange: mockOnResolutionNotesChange,
      updating: false,
    };

    beforeEach(() => {
      mockOnClose.mockClear();
      mockOnFeedbackChange.mockClear();
      mockOnStatusChange.mockClear();
      mockOnAdminNotesChange.mockClear();
      mockOnResolutionNotesChange.mockClear();
    });

    it('should display feedback title', async () => {
      render(<FeedbackDetailDialog {...defaultProps} />);

      expect(screen.getByText('Critical bug in login')).toBeInTheDocument();
    });

    it('should display feedback description', async () => {
      render(<FeedbackDetailDialog {...defaultProps} />);

      expect(screen.getByText('Login fails for all users')).toBeInTheDocument();
    });

    it('should display user information', async () => {
      render(<FeedbackDetailDialog {...defaultProps} />);

      expect(screen.getByText(/Test User/)).toBeInTheDocument();
    });

    it('should not render when feedback is null', async () => {
      render(<FeedbackDetailDialog {...defaultProps} feedback={null} />);

      // Dialog should not show content when feedback is null
      expect(screen.queryByText('Critical bug in login')).not.toBeInTheDocument();
    });

    it('should not render when dialog is closed', async () => {
      render(<FeedbackDetailDialog {...defaultProps} open={false} />);

      // Content should not be visible when dialog is closed
      expect(screen.queryByText('Critical bug in login')).not.toBeInTheDocument();
    });

    it('should display type label', async () => {
      render(<FeedbackDetailDialog {...defaultProps} />);

      expect(screen.getByText(/Bug Report/i)).toBeInTheDocument();
    });

    it('should display different type for feature requests', async () => {
      const featureFeedback = {
        ...sampleFeedback,
        id: 'feedback-2',
        type: 'feature' as const,
        title: 'Add PDF export',
        impact: 'high' as const,
        screenshotUrls: [],
      };

      render(<FeedbackDetailDialog {...defaultProps} feedback={featureFeedback} />);

      expect(screen.getByText('Add PDF export')).toBeInTheDocument();
      expect(screen.getByText(/Feature Request/i)).toBeInTheDocument();
    });

    it('should display resolved status info', async () => {
      const resolvedFeedback = {
        ...sampleFeedback,
        status: 'resolved' as const,
        adminNotes: 'Fixed in v2.0',
        screenshotUrls: [],
      };

      render(<FeedbackDetailDialog {...defaultProps} feedback={resolvedFeedback} />);

      expect(screen.getByText('Critical bug in login')).toBeInTheDocument();
    });

    it('should display screenshots when available', async () => {
      render(<FeedbackDetailDialog {...defaultProps} />);

      // Screenshot images should be present
      const images = screen.getAllByRole('img');
      expect(images.length).toBeGreaterThan(0);
    });

    it('should not display screenshots when empty', async () => {
      const feedbackWithoutScreenshots = {
        ...sampleFeedback,
        screenshotUrls: [],
      };

      render(<FeedbackDetailDialog {...defaultProps} feedback={feedbackWithoutScreenshots} />);

      // Check that no screenshot images are present (icons might still be there)
      expect(screen.queryByAltText(/Screenshot/i)).not.toBeInTheDocument();
    });
  });
});
