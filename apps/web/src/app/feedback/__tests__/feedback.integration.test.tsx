/**
 * Integration Tests for Feedback Module
 *
 * Tests the complete feedback submission and management flows.
 * These tests verify that components work together correctly.
 */

import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';

// Mock modules before imports
const mockAddDoc = jest.fn();
const mockGetDocs = jest.fn();
const mockOnSnapshot = jest.fn();
const mockUpdateDoc = jest.fn();
const mockDoc = jest.fn();

jest.mock('firebase/firestore', () => ({
  collection: jest.fn(() => 'mock-collection'),
  addDoc: (...args: unknown[]) => mockAddDoc(...args),
  getDocs: (...args: unknown[]) => mockGetDocs(...args),
  doc: (...args: unknown[]) => mockDoc(...args),
  updateDoc: (...args: unknown[]) => mockUpdateDoc(...args),
  onSnapshot: (...args: unknown[]) => mockOnSnapshot(...args),
  query: jest.fn(() => 'mock-query'),
  where: jest.fn(),
  orderBy: jest.fn(),
  limit: jest.fn(),
  Timestamp: {
    now: jest.fn(() => ({ toDate: () => new Date() })),
  },
}));

jest.mock('firebase/storage', () => ({
  ref: jest.fn(),
  uploadBytes: jest.fn().mockResolvedValue({}),
  getDownloadURL: jest.fn().mockResolvedValue('https://example.com/screenshot.png'),
}));

jest.mock('@/lib/firebase', () => ({
  getFirebase: jest.fn(() => ({
    db: {},
    storage: {},
  })),
}));

// Import components after mocks
import { FeedbackForm } from '@/components/common/FeedbackForm';

// Mock AuthContext
const mockUser = {
  uid: 'integration-test-user',
  email: 'integration@test.com',
  displayName: 'Integration Test User',
};

jest.mock('@/contexts/AuthContext', () => ({
  useAuth: jest.fn(() => ({
    user: mockUser,
    loading: false,
  })),
}));

// Mock subcomponents to simplify testing
jest.mock('@/components/common/FeedbackForm/FeedbackTypeSelector', () => ({
  FeedbackTypeSelector: ({
    value,
    onChange,
  }: {
    value: string;
    onChange: (type: string) => void;
  }) => (
    <div data-testid="type-selector">
      <span>Type: {value}</span>
      <button data-testid="select-bug" onClick={() => onChange('bug')}>
        Bug
      </button>
      <button data-testid="select-feature" onClick={() => onChange('feature')}>
        Feature
      </button>
      <button data-testid="select-general" onClick={() => onChange('general')}>
        General
      </button>
    </div>
  ),
}));

jest.mock('@/components/common/FeedbackForm/BugDetailsSection', () => ({
  BugDetailsSection: () => <div data-testid="bug-details">Bug Details Section</div>,
}));

jest.mock('@/components/common/FeedbackForm/FeatureRequestSection', () => ({
  FeatureRequestSection: () => <div data-testid="feature-details">Feature Request Section</div>,
}));

// Mock MUI icons
jest.mock('@mui/icons-material/CheckCircle', () => {
  const Mock = () => <span data-testid="check-icon" />;
  Mock.displayName = 'MockCheckCircle';
  return Mock;
});

jest.mock('@mui/icons-material/Send', () => {
  const Mock = () => <span data-testid="send-icon" />;
  Mock.displayName = 'MockSend';
  return Mock;
});

describe('Feedback Integration Tests', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockAddDoc.mockResolvedValue({ id: 'new-feedback-id' });
  });

  describe('Bug Report Submission Flow', () => {
    it('should complete full bug report submission flow', async () => {
      render(<FeedbackForm />);

      // Step 1: Verify initial state (bug type is default)
      expect(screen.getByTestId('bug-details')).toBeInTheDocument();

      // Step 2: Fill page URL (required for bugs)
      const urlField = screen.getByLabelText(/Page URL where issue occurred/i);
      fireEvent.change(urlField, { target: { value: 'https://example.com/procurement/pos/123' } });

      // Step 3: Fill title
      const titleField = screen.getByLabelText(/Title/i);
      fireEvent.change(titleField, {
        target: { value: 'PO creation fails with validation error' },
      });

      // Step 4: Fill description
      const descriptionField = screen.getByLabelText(/Description/i);
      fireEvent.change(descriptionField, {
        target: {
          value:
            'When trying to create a new PO, the form shows a validation error even with all fields filled.',
        },
      });

      // Step 5: Submit
      const submitButton = screen.getByRole('button', { name: /Submit Feedback/i });
      fireEvent.click(submitButton);

      // Step 6: Verify submission
      await waitFor(() => {
        expect(mockAddDoc).toHaveBeenCalledTimes(1);
        const submittedData = mockAddDoc.mock.calls[0][1];

        expect(submittedData).toMatchObject({
          type: 'bug',
          pageUrl: 'https://example.com/procurement/pos/123',
          title: 'PO creation fails with validation error',
          description: expect.stringContaining('validation error'),
          userId: 'integration-test-user',
          userEmail: 'integration@test.com',
          userName: 'Integration Test User',
          status: 'new',
          priority: 'medium',
        });
      });

      // Step 7: Verify success message
      await waitFor(() => {
        expect(screen.getByText(/Thank you for your feedback/i)).toBeInTheDocument();
      });
    });

    it('should submit bug report with all required fields', async () => {
      render(<FeedbackForm />);

      // Fill required fields using fireEvent for speed
      const urlField = screen.getByLabelText(/Page URL where issue occurred/i);
      fireEvent.change(urlField, { target: { value: 'https://example.com/page' } });

      const titleField = screen.getByLabelText(/Title/i);
      fireEvent.change(titleField, { target: { value: 'Bug with screenshot' } });

      const descriptionField = screen.getByLabelText(/Description/i);
      fireEvent.change(descriptionField, { target: { value: 'Description with evidence' } });

      // Submit
      fireEvent.click(screen.getByRole('button', { name: /Submit Feedback/i }));

      await waitFor(() => {
        expect(mockAddDoc).toHaveBeenCalled();
      });
    });
  });

  describe('Feature Request Submission Flow', () => {
    it('should complete full feature request submission flow', async () => {
      render(<FeedbackForm />);

      // Step 1: Switch to feature type
      fireEvent.click(screen.getByTestId('select-feature'));

      await waitFor(() => {
        expect(screen.getByTestId('feature-details')).toBeInTheDocument();
      });

      // Step 2: Fill title using fireEvent for speed
      const titleField = screen.getByLabelText(/Title/i);
      fireEvent.change(titleField, { target: { value: 'Export transactions to Excel' } });

      // Step 3: Fill description
      const descriptionField = screen.getByLabelText(/Description/i);
      fireEvent.change(descriptionField, {
        target: {
          value: 'Add ability to export filtered transactions to Excel format for reporting.',
        },
      });

      // Step 4: Submit
      fireEvent.click(screen.getByRole('button', { name: /Submit Feedback/i }));

      // Step 5: Verify submission
      await waitFor(() => {
        expect(mockAddDoc).toHaveBeenCalledTimes(1);
        const submittedData = mockAddDoc.mock.calls[0][1];

        expect(submittedData).toMatchObject({
          type: 'feature',
          title: 'Export transactions to Excel',
          description: expect.stringContaining('Excel format'),
          status: 'new',
          priority: 'low', // Features get low priority by default
        });

        // Feature requests should NOT have bug-specific fields
        expect(submittedData).not.toHaveProperty('severity');
        expect(submittedData).not.toHaveProperty('frequency');
      });
    });
  });

  describe('General Feedback Submission Flow', () => {
    it('should complete full general feedback submission flow', async () => {
      render(<FeedbackForm />);

      // Step 1: Switch to general type
      fireEvent.click(screen.getByTestId('select-general'));

      await waitFor(() => {
        expect(screen.queryByTestId('bug-details')).not.toBeInTheDocument();
        expect(screen.queryByTestId('feature-details')).not.toBeInTheDocument();
      });

      // Step 2: Fill title using fireEvent for speed
      const titleField = screen.getByLabelText(/Title/i);
      fireEvent.change(titleField, { target: { value: 'Great work on the new UI' } });

      // Step 3: Fill description
      const descriptionField = screen.getByLabelText(/Description/i);
      fireEvent.change(descriptionField, {
        target: { value: 'The new dashboard layout is much more intuitive. Great improvement!' },
      });

      // Step 4: Submit
      fireEvent.click(screen.getByRole('button', { name: /Submit Feedback/i }));

      // Step 5: Verify submission
      await waitFor(() => {
        expect(mockAddDoc).toHaveBeenCalledTimes(1);
        const submittedData = mockAddDoc.mock.calls[0][1];

        expect(submittedData).toMatchObject({
          type: 'general',
          title: 'Great work on the new UI',
          description: expect.stringContaining('intuitive'),
          status: 'new',
          priority: 'low',
        });

        // General feedback should NOT have type-specific fields
        expect(submittedData).not.toHaveProperty('severity');
        expect(submittedData).not.toHaveProperty('frequency');
        expect(submittedData).not.toHaveProperty('impact');
      });
    });
  });

  describe('Validation Flow', () => {
    it('should prevent submission without required fields', async () => {
      render(<FeedbackForm />);

      // Try to submit without filling required fields
      fireEvent.click(screen.getByRole('button', { name: /Submit Feedback/i }));

      // Firebase should not be called
      expect(mockAddDoc).not.toHaveBeenCalled();

      // Fill title but not description
      const titleField = screen.getByLabelText(/Title/i);
      fireEvent.change(titleField, { target: { value: 'Test Bug' } });

      fireEvent.click(screen.getByRole('button', { name: /Submit Feedback/i }));

      expect(mockAddDoc).not.toHaveBeenCalled();

      // Fill description but not URL (required for bugs)
      const descriptionField = screen.getByLabelText(/Description/i);
      fireEvent.change(descriptionField, { target: { value: 'Test description' } });

      fireEvent.click(screen.getByRole('button', { name: /Submit Feedback/i }));

      // Still should not call Firebase because URL is required for bugs
      expect(mockAddDoc).not.toHaveBeenCalled();

      // Fill URL
      const urlField = screen.getByLabelText(/Page URL where issue occurred/i);
      fireEvent.change(urlField, { target: { value: 'https://example.com/page' } });

      // Now submit should work
      fireEvent.click(screen.getByRole('button', { name: /Submit Feedback/i }));

      await waitFor(() => {
        expect(mockAddDoc).toHaveBeenCalled();
      });
    });

    it('should allow feature request submission without URL', async () => {
      render(<FeedbackForm />);

      // Switch to feature
      fireEvent.click(screen.getByTestId('select-feature'));

      // Fill only required fields (no URL needed)
      const titleField = screen.getByLabelText(/Title/i);
      fireEvent.change(titleField, { target: { value: 'New Feature Request' } });

      const descriptionField = screen.getByLabelText(/Description/i);
      fireEvent.change(descriptionField, { target: { value: 'Feature description' } });

      // Submit
      fireEvent.click(screen.getByRole('button', { name: /Submit Feedback/i }));

      // Should succeed
      await waitFor(() => {
        expect(mockAddDoc).toHaveBeenCalled();
      });
    });
  });

  describe('Error Handling Flow', () => {
    it('should handle Firebase submission errors gracefully', async () => {
      mockAddDoc.mockRejectedValueOnce(new Error('Network error'));

      render(<FeedbackForm />);

      // Switch to general (simpler form)
      fireEvent.click(screen.getByTestId('select-general'));

      // Fill required fields
      const titleField = screen.getByLabelText(/Title/i);
      fireEvent.change(titleField, { target: { value: 'Test Feedback' } });

      const descriptionField = screen.getByLabelText(/Description/i);
      fireEvent.change(descriptionField, { target: { value: 'Test description' } });

      // Submit
      fireEvent.click(screen.getByRole('button', { name: /Submit Feedback/i }));

      // Should show error
      await waitFor(() => {
        expect(screen.getByText(/Failed to submit feedback/i)).toBeInTheDocument();
      });
    });

    it('should allow retry after submission error', async () => {
      mockAddDoc.mockRejectedValueOnce(new Error('Network error'));
      mockAddDoc.mockResolvedValueOnce({ id: 'retry-feedback-id' });

      render(<FeedbackForm />);

      // Switch to general
      fireEvent.click(screen.getByTestId('select-general'));

      // Fill required fields
      const titleField = screen.getByLabelText(/Title/i);
      fireEvent.change(titleField, { target: { value: 'Test Feedback' } });

      const descriptionField = screen.getByLabelText(/Description/i);
      fireEvent.change(descriptionField, { target: { value: 'Test description' } });

      // First submission fails
      fireEvent.click(screen.getByRole('button', { name: /Submit Feedback/i }));

      await waitFor(() => {
        expect(screen.getByText(/Failed to submit feedback/i)).toBeInTheDocument();
      });

      // Retry - should succeed
      fireEvent.click(screen.getByRole('button', { name: /Submit Feedback/i }));

      await waitFor(() => {
        expect(screen.getByText(/Thank you for your feedback/i)).toBeInTheDocument();
      });
    });
  });

  describe('Form Reset Flow', () => {
    it('should reset form after successful submission', async () => {
      render(<FeedbackForm />);

      // Switch to general
      fireEvent.click(screen.getByTestId('select-general'));

      // Fill fields
      const titleField = screen.getByLabelText(/Title/i);
      fireEvent.change(titleField, { target: { value: 'Test Title' } });

      const descriptionField = screen.getByLabelText(/Description/i);
      fireEvent.change(descriptionField, { target: { value: 'Test Description' } });

      // Submit
      fireEvent.click(screen.getByRole('button', { name: /Submit Feedback/i }));

      // Wait for success
      await waitFor(() => {
        expect(screen.getByText(/Thank you for your feedback/i)).toBeInTheDocument();
      });

      // Form should be reset
      await waitFor(() => {
        expect(titleField).toHaveValue('');
        expect(descriptionField).toHaveValue('');
      });
    });

    it('should reset form when Clear button is clicked', async () => {
      render(<FeedbackForm />);

      // Fill fields
      const titleField = screen.getByLabelText(/Title/i);
      fireEvent.change(titleField, { target: { value: 'Test Title' } });

      const descriptionField = screen.getByLabelText(/Description/i);
      fireEvent.change(descriptionField, { target: { value: 'Test Description' } });

      // Click clear
      fireEvent.click(screen.getByRole('button', { name: /Clear Form/i }));

      // Form should be cleared
      expect(titleField).toHaveValue('');
      expect(descriptionField).toHaveValue('');
    });
  });

  describe('Type Switching Flow', () => {
    it('should switch between types and show appropriate fields', async () => {
      render(<FeedbackForm />);

      // Initially bug type
      expect(screen.getByTestId('bug-details')).toBeInTheDocument();
      expect(screen.getByLabelText(/Severity/i)).toBeInTheDocument();

      // Switch to feature
      fireEvent.click(screen.getByTestId('select-feature'));

      await waitFor(() => {
        expect(screen.getByTestId('feature-details')).toBeInTheDocument();
        expect(screen.getByLabelText(/Impact/i)).toBeInTheDocument();
        expect(screen.queryByLabelText(/Severity/i)).not.toBeInTheDocument();
      });

      // Switch to general
      fireEvent.click(screen.getByTestId('select-general'));

      await waitFor(() => {
        expect(screen.queryByTestId('bug-details')).not.toBeInTheDocument();
        expect(screen.queryByTestId('feature-details')).not.toBeInTheDocument();
        expect(screen.queryByLabelText(/Severity/i)).not.toBeInTheDocument();
        expect(screen.queryByLabelText(/Impact/i)).not.toBeInTheDocument();
      });

      // Switch back to bug
      fireEvent.click(screen.getByTestId('select-bug'));

      await waitFor(() => {
        expect(screen.getByTestId('bug-details')).toBeInTheDocument();
        expect(screen.getByLabelText(/Severity/i)).toBeInTheDocument();
      });
    });
  });
});
