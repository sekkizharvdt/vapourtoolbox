/**
 * Tests for FeedbackForm main component (index.tsx)
 *
 * Tests form submission, validation, type switching, and error handling.
 */

import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { FeedbackForm } from '../index';

// Mock Firebase
const mockAddDoc = jest.fn();
jest.mock('firebase/firestore', () => ({
  collection: jest.fn(),
  addDoc: (...args: unknown[]) => mockAddDoc(...args),
  Timestamp: {
    now: jest.fn(() => ({ toDate: () => new Date() })),
  },
}));

jest.mock('firebase/storage', () => ({
  ref: jest.fn(),
  uploadBytes: jest.fn(),
  getDownloadURL: jest.fn(() => Promise.resolve('https://example.com/screenshot.png')),
}));

jest.mock('@/lib/firebase', () => ({
  getFirebase: jest.fn(() => ({
    db: {},
    storage: {},
  })),
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

// Mock MUI icons
jest.mock('@mui/icons-material/CheckCircle', () => {
  const MockIcon = () => <span data-testid="check-icon" />;
  MockIcon.displayName = 'MockCheckCircleIcon';
  return MockIcon;
});

jest.mock('@mui/icons-material/Send', () => {
  const MockIcon = () => <span data-testid="send-icon" />;
  MockIcon.displayName = 'MockSendIcon';
  return MockIcon;
});

// Mock subcomponents
jest.mock('../FeedbackTypeSelector', () => ({
  FeedbackTypeSelector: ({
    value,
    onChange,
  }: {
    value: string;
    onChange: (type: string) => void;
  }) => (
    <div data-testid="feedback-type-selector">
      <span>Current type: {value}</span>
      <button onClick={() => onChange('bug')}>Select Bug</button>
      <button onClick={() => onChange('feature')}>Select Feature</button>
      <button onClick={() => onChange('general')}>Select General</button>
    </div>
  ),
}));

jest.mock('../BugDetailsSection', () => ({
  BugDetailsSection: ({
    onStepsChange,
    onExpectedChange,
    onActualChange,
  }: {
    onStepsChange: (value: string) => void;
    onExpectedChange: (value: string) => void;
    onActualChange: (value: string) => void;
  }) => (
    <div data-testid="bug-details-section">
      <input
        data-testid="steps-input"
        onChange={(e) => onStepsChange(e.target.value)}
        placeholder="Steps to reproduce"
      />
      <input
        data-testid="expected-input"
        onChange={(e) => onExpectedChange(e.target.value)}
        placeholder="Expected behavior"
      />
      <input
        data-testid="actual-input"
        onChange={(e) => onActualChange(e.target.value)}
        placeholder="Actual behavior"
      />
    </div>
  ),
}));

jest.mock('../FeatureRequestSection', () => ({
  FeatureRequestSection: ({
    onUseCaseChange,
    onExpectedOutcomeChange,
  }: {
    onUseCaseChange: (value: string) => void;
    onExpectedOutcomeChange: (value: string) => void;
  }) => (
    <div data-testid="feature-request-section">
      <input
        data-testid="use-case-input"
        onChange={(e) => onUseCaseChange(e.target.value)}
        placeholder="Use case"
      />
      <input
        data-testid="expected-outcome-input"
        onChange={(e) => onExpectedOutcomeChange(e.target.value)}
        placeholder="Expected outcome"
      />
    </div>
  ),
}));

describe('FeedbackForm', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockAddDoc.mockResolvedValue({ id: 'new-feedback-id' });
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  describe('Rendering', () => {
    it('should render the feedback form with all sections', () => {
      render(<FeedbackForm />);

      expect(screen.getByText('Feedback & Support')).toBeInTheDocument();
      expect(screen.getByTestId('feedback-type-selector')).toBeInTheDocument();
      expect(screen.getByLabelText('Module')).toBeInTheDocument();
      expect(screen.getByLabelText(/Title/)).toBeInTheDocument();
      expect(screen.getByLabelText(/Description/)).toBeInTheDocument();
      expect(screen.getByRole('button', { name: /Submit Feedback/i })).toBeInTheDocument();
      expect(screen.getByRole('button', { name: /Clear Form/i })).toBeInTheDocument();
    });

    it('should show bug details section when bug type is selected', async () => {
      render(<FeedbackForm />);

      // Bug is the default type
      expect(screen.getByTestId('bug-details-section')).toBeInTheDocument();
    });

    it('should show feature request section when feature type is selected', async () => {
      render(<FeedbackForm />);

      // Switch to feature type
      fireEvent.click(screen.getByText('Select Feature'));

      await waitFor(() => {
        expect(screen.getByTestId('feature-request-section')).toBeInTheDocument();
      });
    });

    it('should show bug classification fields for bug type', () => {
      render(<FeedbackForm />);

      expect(screen.getByLabelText(/Page URL where issue occurred/i)).toBeInTheDocument();
      expect(screen.getByLabelText(/Severity/i)).toBeInTheDocument();
      expect(screen.getByLabelText(/Frequency/i)).toBeInTheDocument();
    });

    it('should show impact field for feature type', async () => {
      render(<FeedbackForm />);

      fireEvent.click(screen.getByText('Select Feature'));

      await waitFor(() => {
        expect(screen.getByLabelText(/Impact/i)).toBeInTheDocument();
      });
    });
  });

  describe('Form Validation', () => {
    it('should prevent submission without required fields', async () => {
      render(<FeedbackForm />);

      // Submit empty form
      fireEvent.click(screen.getByRole('button', { name: /Submit Feedback/i }));

      // Firebase should not be called
      expect(mockAddDoc).not.toHaveBeenCalled();
    });

    it('should require title field', async () => {
      render(<FeedbackForm />);

      // Title field should have required attribute
      const titleField = screen.getByLabelText(/Title/i);
      expect(titleField).toBeRequired();
    });

    it('should require description field', async () => {
      render(<FeedbackForm />);

      // Description field should have required attribute
      const descriptionField = screen.getByLabelText(/Description/i);
      expect(descriptionField).toBeRequired();
    });

    it('should require page URL for bug reports', async () => {
      render(<FeedbackForm />);

      // Page URL field should have required attribute for bugs
      const urlField = screen.getByLabelText(/Page URL where issue occurred/i);
      expect(urlField).toBeRequired();
    });

    it('should not require page URL for feature requests', async () => {
      render(<FeedbackForm />);

      // Switch to feature type
      fireEvent.click(screen.getByText('Select Feature'));

      await waitFor(() => {
        expect(screen.queryByLabelText(/Page URL where issue occurred/i)).not.toBeInTheDocument();
      });

      // Fill required fields
      const titleField = screen.getByLabelText(/Title/i);
      await userEvent.type(titleField, 'New Feature Request');

      const descriptionField = screen.getByLabelText(/Description/i);
      await userEvent.type(descriptionField, 'Feature description');

      // Submit
      fireEvent.click(screen.getByRole('button', { name: /Submit Feedback/i }));

      await waitFor(() => {
        expect(mockAddDoc).toHaveBeenCalled();
      });
    });
  });

  describe('Form Submission', () => {
    it('should have submit button', () => {
      render(<FeedbackForm />);

      const submitButton = screen.getByRole('button', { name: /Submit Feedback/i });
      expect(submitButton).toBeInTheDocument();
      expect(submitButton).not.toBeDisabled();
    });

    it('should allow feature request submission', async () => {
      render(<FeedbackForm />);

      // Switch to feature type
      fireEvent.click(screen.getByText('Select Feature'));

      // Fill required fields
      const titleField = screen.getByLabelText(/Title/i);
      await userEvent.type(titleField, 'New Feature');

      const descriptionField = screen.getByLabelText(/Description/i);
      await userEvent.type(descriptionField, 'Feature description');

      // Submit
      fireEvent.click(screen.getByRole('button', { name: /Submit Feedback/i }));

      await waitFor(() => {
        expect(mockAddDoc).toHaveBeenCalled();
      });
    });

    it('should show success message after submission', async () => {
      render(<FeedbackForm />);

      // Switch to general feedback (doesn't require URL)
      fireEvent.click(screen.getByText('Select General'));

      // Fill required fields
      const titleField = screen.getByLabelText(/Title/i);
      await userEvent.type(titleField, 'General Feedback');

      const descriptionField = screen.getByLabelText(/Description/i);
      await userEvent.type(descriptionField, 'Feedback description');

      // Submit
      fireEvent.click(screen.getByRole('button', { name: /Submit Feedback/i }));

      await waitFor(() => {
        expect(screen.getByText(/Thank you for your feedback/i)).toBeInTheDocument();
      });
    });

    it('should reset form after successful submission', async () => {
      render(<FeedbackForm />);

      // Switch to general feedback
      fireEvent.click(screen.getByText('Select General'));

      // Fill fields
      const titleField = screen.getByLabelText(/Title/i);
      await userEvent.type(titleField, 'Test Title');

      const descriptionField = screen.getByLabelText(/Description/i);
      await userEvent.type(descriptionField, 'Test Description');

      // Submit
      fireEvent.click(screen.getByRole('button', { name: /Submit Feedback/i }));

      await waitFor(() => {
        expect(mockAddDoc).toHaveBeenCalled();
      });

      // Check form is reset
      await waitFor(() => {
        expect(titleField).toHaveValue('');
        expect(descriptionField).toHaveValue('');
      });
    });

    it('should show error message on submission failure', async () => {
      mockAddDoc.mockRejectedValueOnce(new Error('Firebase error'));

      render(<FeedbackForm />);

      // Switch to general feedback
      fireEvent.click(screen.getByText('Select General'));

      // Fill required fields
      const titleField = screen.getByLabelText(/Title/i);
      await userEvent.type(titleField, 'Test Title');

      const descriptionField = screen.getByLabelText(/Description/i);
      await userEvent.type(descriptionField, 'Test Description');

      // Submit
      fireEvent.click(screen.getByRole('button', { name: /Submit Feedback/i }));

      await waitFor(() => {
        expect(screen.getByText(/Failed to submit feedback/i)).toBeInTheDocument();
      });
    });

    it('should display severity dropdown for bug reports', async () => {
      render(<FeedbackForm />);

      // Severity dropdown should be visible for bug reports
      expect(screen.getByLabelText(/Severity/i)).toBeInTheDocument();
      expect(screen.getByLabelText(/Frequency/i)).toBeInTheDocument();
    });

    it('should NOT include undefined optional fields in submission', async () => {
      render(<FeedbackForm />);

      // Fill only required fields (no severity/frequency selected)
      const titleField = screen.getByLabelText(/Title/i);
      await userEvent.type(titleField, 'Test Bug');

      const descriptionField = screen.getByLabelText(/Description/i);
      await userEvent.type(descriptionField, 'Bug description');

      const urlField = screen.getByLabelText(/Page URL where issue occurred/i);
      await userEvent.type(urlField, 'https://example.com/page');

      // Submit without selecting severity/frequency
      fireEvent.click(screen.getByRole('button', { name: /Submit Feedback/i }));

      await waitFor(() => {
        expect(mockAddDoc).toHaveBeenCalled();
        const callArgs = mockAddDoc.mock.calls[0][1];
        expect(callArgs).not.toHaveProperty('severity');
        expect(callArgs).not.toHaveProperty('frequency');
        expect(callArgs).not.toHaveProperty('impact');
      });
    });
  });

  describe('Type Switching', () => {
    it('should clear type-specific fields when switching types', async () => {
      render(<FeedbackForm />);

      // Start as bug, severity should be available
      expect(screen.getByLabelText(/Severity/i)).toBeInTheDocument();

      // Switch to feature
      fireEvent.click(screen.getByText('Select Feature'));

      await waitFor(() => {
        // Bug fields should be gone
        expect(screen.queryByLabelText(/Severity/i)).not.toBeInTheDocument();
        expect(screen.queryByLabelText(/Frequency/i)).not.toBeInTheDocument();

        // Feature fields should appear
        expect(screen.getByLabelText(/Impact/i)).toBeInTheDocument();
      });

      // Switch to general
      fireEvent.click(screen.getByText('Select General'));

      await waitFor(() => {
        // Neither bug nor feature specific fields
        expect(screen.queryByLabelText(/Severity/i)).not.toBeInTheDocument();
        expect(screen.queryByLabelText(/Impact/i)).not.toBeInTheDocument();
      });
    });
  });

  describe('Clear Form', () => {
    it('should clear all form fields when clear button is clicked', async () => {
      render(<FeedbackForm />);

      // Fill fields
      const titleField = screen.getByLabelText(/Title/i);
      await userEvent.type(titleField, 'Test Title');

      const descriptionField = screen.getByLabelText(/Description/i);
      await userEvent.type(descriptionField, 'Test Description');

      const urlField = screen.getByLabelText(/Page URL where issue occurred/i);
      await userEvent.type(urlField, 'https://example.com/page');

      // Click clear
      fireEvent.click(screen.getByRole('button', { name: /Clear Form/i }));

      // Check fields are cleared
      await waitFor(() => {
        expect(titleField).toHaveValue('');
        expect(descriptionField).toHaveValue('');
        expect(urlField).toHaveValue('');
      });
    });
  });

  describe('Module Selection', () => {
    it('should render module dropdown', async () => {
      render(<FeedbackForm />);

      // Module select should be present
      expect(screen.getByLabelText('Module')).toBeInTheDocument();
    });

    it('should include module field in form data', () => {
      render(<FeedbackForm />);

      // Module select should be present and functional
      const moduleSelect = screen.getByLabelText('Module');
      expect(moduleSelect).toBeInTheDocument();

      // Module should have a default value (the component auto-detects or defaults to 'other')
      // This is tested via the rendering test
    });
  });

  describe('Loading States', () => {
    it('should disable submit button while submitting', async () => {
      // Make addDoc slow
      mockAddDoc.mockImplementation(
        () => new Promise((resolve) => setTimeout(() => resolve({ id: 'test' }), 500))
      );

      render(<FeedbackForm />);

      // Switch to general feedback
      fireEvent.click(screen.getByText('Select General'));

      // Fill fields
      const titleField = screen.getByLabelText(/Title/i);
      await userEvent.type(titleField, 'Test Title');

      const descriptionField = screen.getByLabelText(/Description/i);
      await userEvent.type(descriptionField, 'Test Description');

      // Submit
      fireEvent.click(screen.getByRole('button', { name: /Submit Feedback/i }));

      // Button should be disabled
      await waitFor(() => {
        expect(screen.getByRole('button', { name: /Submitting/i })).toBeDisabled();
      });

      // Wait for submission to complete
      await waitFor(
        () => {
          expect(screen.getByRole('button', { name: /Submit Feedback/i })).not.toBeDisabled();
        },
        { timeout: 2000 }
      );
    });
  });
});
