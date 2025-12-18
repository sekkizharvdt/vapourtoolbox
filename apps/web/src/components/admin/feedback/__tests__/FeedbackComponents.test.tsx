/**
 * Feedback Admin Components Tests
 *
 * Tests for FeedbackFilters, FeedbackTable, FeedbackDetailDialog, and config
 */

import { render, screen, fireEvent, within } from '@testing-library/react';
import { Timestamp } from 'firebase/firestore';
import { FeedbackFilters } from '../FeedbackFilters';
import { FeedbackTable } from '../FeedbackTable';
import { FeedbackDetailDialog } from '../FeedbackDetailDialog';
import { typeConfig, statusConfig } from '../config';
import type { FeedbackItem } from '../types';

// Helper to create mock Timestamp
const mockTimestamp = (date: Date = new Date()): Timestamp =>
  ({
    toDate: () => date,
    toMillis: () => date.getTime(),
    seconds: Math.floor(date.getTime() / 1000),
    nanoseconds: 0,
    isEqual: () => false,
    valueOf: () => '',
    toJSON: () => ({ seconds: Math.floor(date.getTime() / 1000), nanoseconds: 0 }),
  }) as unknown as Timestamp;

// Factory for creating mock feedback items
function createMockFeedbackItem(overrides: Partial<FeedbackItem> = {}): FeedbackItem {
  return {
    id: 'feedback-1',
    type: 'bug',
    title: 'Test Bug Report',
    description: 'This is a test bug description',
    screenshotUrls: [],
    userId: 'user-1',
    userEmail: 'test@example.com',
    userName: 'Test User',
    status: 'new',
    createdAt: mockTimestamp(new Date('2024-01-15')),
    ...overrides,
  };
}

describe('typeConfig', () => {
  it('should have configuration for all feedback types', () => {
    expect(typeConfig.bug).toBeDefined();
    expect(typeConfig.feature).toBeDefined();
    expect(typeConfig.general).toBeDefined();
  });

  it('should have correct labels', () => {
    expect(typeConfig.bug.label).toBe('Bug Report');
    expect(typeConfig.feature.label).toBe('Feature Request');
    expect(typeConfig.general.label).toBe('General Feedback');
  });

  it('should have icons defined', () => {
    expect(typeConfig.bug.icon).toBeDefined();
    expect(typeConfig.feature.icon).toBeDefined();
    expect(typeConfig.general.icon).toBeDefined();
  });

  it('should have appropriate colors', () => {
    expect(typeConfig.bug.color).toBe('error');
    expect(typeConfig.feature.color).toBe('info');
    expect(typeConfig.general.color).toBe('default');
  });
});

describe('statusConfig', () => {
  it('should have configuration for all status types', () => {
    expect(statusConfig.new).toBeDefined();
    expect(statusConfig.in_progress).toBeDefined();
    expect(statusConfig.resolved).toBeDefined();
    expect(statusConfig.closed).toBeDefined();
    expect(statusConfig.wont_fix).toBeDefined();
  });

  it('should have correct labels', () => {
    expect(statusConfig.new.label).toBe('New');
    expect(statusConfig.in_progress.label).toBe('In Progress');
    expect(statusConfig.resolved.label).toBe('Resolved');
    expect(statusConfig.closed.label).toBe('Closed');
    expect(statusConfig.wont_fix.label).toBe("Won't Fix");
  });

  it('should have appropriate colors', () => {
    expect(statusConfig.new.color).toBe('primary');
    expect(statusConfig.in_progress.color).toBe('warning');
    expect(statusConfig.resolved.color).toBe('success');
    expect(statusConfig.closed.color).toBe('default');
    expect(statusConfig.wont_fix.color).toBe('error');
  });
});

describe('FeedbackFilters', () => {
  const mockReporters = [
    { id: 'user1', name: 'John Doe', email: 'john@example.com' },
    { id: 'user2', name: 'Jane Smith', email: 'jane@example.com' },
  ];

  const defaultProps = {
    searchQuery: '',
    setSearchQuery: jest.fn(),
    typeFilter: 'all' as const,
    setTypeFilter: jest.fn(),
    statusFilter: 'all' as const,
    setStatusFilter: jest.fn(),
    moduleFilter: 'all' as const,
    setModuleFilter: jest.fn(),
    reporterFilter: 'all',
    setReporterFilter: jest.fn(),
    reporters: mockReporters,
    filteredCount: 10,
    totalCount: 25,
  };

  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('Rendering', () => {
    it('should render search input', () => {
      render(<FeedbackFilters {...defaultProps} />);

      expect(screen.getByPlaceholderText('Search feedback...')).toBeInTheDocument();
    });

    it('should render type filter toggle buttons', () => {
      render(<FeedbackFilters {...defaultProps} />);

      expect(screen.getByRole('button', { name: /all types/i })).toBeInTheDocument();
      expect(screen.getByRole('button', { name: /bugs/i })).toBeInTheDocument();
      expect(screen.getByRole('button', { name: /features/i })).toBeInTheDocument();
      expect(screen.getByRole('button', { name: /general/i })).toBeInTheDocument();
    });

    it('should render status filter dropdown', () => {
      render(<FeedbackFilters {...defaultProps} />);

      // The status dropdown should be present - look for the select combobox
      const statusSelects = screen.getAllByRole('combobox');
      expect(statusSelects.length).toBeGreaterThan(0);
    });

    it('should display filtered count correctly', () => {
      render(<FeedbackFilters {...defaultProps} filteredCount={5} totalCount={20} />);

      expect(screen.getByText('5 of 20 items')).toBeInTheDocument();
    });
  });

  describe('Interactions', () => {
    it('should call setSearchQuery when typing in search input', () => {
      const setSearchQuery = jest.fn();
      render(<FeedbackFilters {...defaultProps} setSearchQuery={setSearchQuery} />);

      fireEvent.change(screen.getByPlaceholderText('Search feedback...'), {
        target: { value: 'test query' },
      });

      expect(setSearchQuery).toHaveBeenCalledWith('test query');
    });

    it('should call setTypeFilter when clicking type buttons', () => {
      const setTypeFilter = jest.fn();
      render(<FeedbackFilters {...defaultProps} setTypeFilter={setTypeFilter} />);

      fireEvent.click(screen.getByRole('button', { name: /bugs/i }));

      expect(setTypeFilter).toHaveBeenCalledWith('bug');
    });

    it('should call setStatusFilter when changing status dropdown', () => {
      const setStatusFilter = jest.fn();
      render(<FeedbackFilters {...defaultProps} setStatusFilter={setStatusFilter} />);

      // Open the status select dropdown (first combobox)
      const comboboxes = screen.getAllByRole('combobox');
      fireEvent.mouseDown(comboboxes[0]!); // Status dropdown is first

      // Click on "New" option
      const listbox = within(screen.getByRole('listbox'));
      fireEvent.click(listbox.getByText('New'));

      expect(setStatusFilter).toHaveBeenCalledWith('new');
    });
  });

  describe('Filter State', () => {
    it('should show active type filter', () => {
      render(<FeedbackFilters {...defaultProps} typeFilter="bug" />);

      const bugButton = screen.getByRole('button', { name: /bugs/i });
      expect(bugButton).toHaveAttribute('aria-pressed', 'true');
    });

    it('should show current search value', () => {
      render(<FeedbackFilters {...defaultProps} searchQuery="existing search" />);

      expect(screen.getByPlaceholderText('Search feedback...')).toHaveValue('existing search');
    });
  });
});

describe('FeedbackTable', () => {
  const mockItems: FeedbackItem[] = [
    createMockFeedbackItem({
      id: '1',
      type: 'bug',
      title: 'Login Button Bug',
      userName: 'John Doe',
      userEmail: 'john@example.com',
      status: 'new',
      screenshotUrls: ['http://example.com/screenshot1.png'],
      pageUrl: 'http://example.com/login',
    }),
    createMockFeedbackItem({
      id: '2',
      type: 'feature',
      title: 'Dark Mode Feature',
      userName: 'Jane Smith',
      userEmail: 'jane@example.com',
      status: 'in_progress',
      screenshotUrls: [],
    }),
    createMockFeedbackItem({
      id: '3',
      type: 'general',
      title: 'General Feedback',
      userName: 'Bob Wilson',
      userEmail: 'bob@example.com',
      status: 'resolved',
      screenshotUrls: ['http://example.com/s1.png', 'http://example.com/s2.png'],
    }),
  ];

  const defaultProps = {
    items: mockItems,
    page: 0,
    rowsPerPage: 10,
    totalCount: 3,
    onPageChange: jest.fn(),
    onRowsPerPageChange: jest.fn(),
    onViewDetails: jest.fn(),
  };

  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('Rendering', () => {
    it('should render table headers', () => {
      render(<FeedbackTable {...defaultProps} />);

      expect(screen.getByText('Type')).toBeInTheDocument();
      expect(screen.getByText('Module')).toBeInTheDocument();
      expect(screen.getByText('Title')).toBeInTheDocument();
      expect(screen.getByText('Submitted By')).toBeInTheDocument();
      expect(screen.getByText('Status')).toBeInTheDocument();
      expect(screen.getByText('Submitted')).toBeInTheDocument();
      expect(screen.getByText('Actions')).toBeInTheDocument();
    });

    it('should render all feedback items', () => {
      render(<FeedbackTable {...defaultProps} />);

      expect(screen.getByText('Login Button Bug')).toBeInTheDocument();
      expect(screen.getByText('Dark Mode Feature')).toBeInTheDocument();
      expect(screen.getByText('General Feedback')).toBeInTheDocument();
    });

    it('should display user names and emails', () => {
      render(<FeedbackTable {...defaultProps} />);

      expect(screen.getByText('John Doe')).toBeInTheDocument();
      expect(screen.getByText('john@example.com')).toBeInTheDocument();
      expect(screen.getByText('Jane Smith')).toBeInTheDocument();
    });

    it('should display status chips with correct labels', () => {
      render(<FeedbackTable {...defaultProps} />);

      expect(screen.getByText('New')).toBeInTheDocument();
      expect(screen.getByText('In Progress')).toBeInTheDocument();
      expect(screen.getByText('Resolved')).toBeInTheDocument();
    });

    it('should show attachment badge for items with screenshots', () => {
      render(<FeedbackTable {...defaultProps} />);

      // Item 1 has 1 screenshot, Item 3 has 2 screenshots
      // We should see the attachment icons
      const attachmentBadges = document.querySelectorAll('.MuiBadge-badge');
      expect(attachmentBadges.length).toBeGreaterThan(0);
    });

    it('should show page URL button when available', () => {
      render(<FeedbackTable {...defaultProps} />);

      // First item has pageUrl, check for the link icon button
      const linkButtons = screen.getAllByRole('link');
      expect(linkButtons.length).toBeGreaterThan(0);
    });
  });

  describe('Interactions', () => {
    it('should call onViewDetails when clicking view button', () => {
      const onViewDetails = jest.fn();
      render(<FeedbackTable {...defaultProps} onViewDetails={onViewDetails} />);

      const viewButtons = screen.getAllByRole('button', { name: /view feedback details/i });
      fireEvent.click(viewButtons[0]!);

      expect(onViewDetails).toHaveBeenCalledWith(mockItems[0]);
    });

    it('should call onPageChange when pagination is changed', () => {
      const onPageChange = jest.fn();
      render(<FeedbackTable {...defaultProps} onPageChange={onPageChange} totalCount={50} />);

      // Click next page button
      const nextButton = screen.getByRole('button', { name: /next page/i });
      fireEvent.click(nextButton);

      expect(onPageChange).toHaveBeenCalled();
    });
  });

  describe('Empty State', () => {
    it('should render empty table when no items', () => {
      render(<FeedbackTable {...defaultProps} items={[]} totalCount={0} />);

      // Table should still render headers
      expect(screen.getByText('Type')).toBeInTheDocument();
      // But no data rows
      expect(screen.queryByText('Login Button Bug')).not.toBeInTheDocument();
    });
  });

  describe('Pagination', () => {
    it('should show correct rows per page options', () => {
      render(<FeedbackTable {...defaultProps} />);

      // Check pagination exists
      expect(screen.getByRole('combobox', { name: /rows per page/i })).toBeInTheDocument();
    });

    it('should display pagination component', () => {
      render(<FeedbackTable {...defaultProps} page={0} rowsPerPage={10} totalCount={25} />);

      // Verify pagination renders with items count
      expect(screen.getByRole('combobox', { name: /rows per page/i })).toBeInTheDocument();
    });
  });
});

describe('FeedbackDetailDialog', () => {
  const mockFeedback = createMockFeedbackItem({
    id: 'feedback-detail-1',
    type: 'bug',
    title: 'Critical Bug Report',
    description: 'Detailed bug description here',
    stepsToReproduce: '1. Click button\n2. See error',
    expectedBehavior: 'Should work correctly',
    actualBehavior: 'Crashes the app',
    consoleErrors: 'TypeError: undefined is not a function',
    screenshotUrls: ['http://example.com/screenshot.png'],
    pageUrl: 'http://example.com/page',
    browserInfo: 'Chrome 120.0',
    adminNotes: 'Looking into this',
    status: 'in_progress',
  });

  const defaultProps = {
    open: true,
    onClose: jest.fn(),
    feedback: mockFeedback,
    onFeedbackChange: jest.fn(),
    onStatusChange: jest.fn(),
    onAdminNotesChange: jest.fn(),
    onResolutionNotesChange: jest.fn(),
    updating: false,
  };

  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('Rendering', () => {
    it('should render dialog when open and feedback provided', () => {
      render(<FeedbackDetailDialog {...defaultProps} />);

      expect(screen.getByRole('dialog')).toBeInTheDocument();
      expect(screen.getByText('Critical Bug Report')).toBeInTheDocument();
    });

    it('should not render when feedback is null', () => {
      render(<FeedbackDetailDialog {...defaultProps} feedback={null} />);

      expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    });

    it('should not render when open is false', () => {
      render(<FeedbackDetailDialog {...defaultProps} open={false} />);

      expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    });

    it('should display user information', () => {
      render(<FeedbackDetailDialog {...defaultProps} />);

      expect(screen.getByText(/Test User/)).toBeInTheDocument();
      expect(screen.getByText(/test@example.com/)).toBeInTheDocument();
    });

    it('should display description', () => {
      render(<FeedbackDetailDialog {...defaultProps} />);

      expect(screen.getByText('Detailed bug description here')).toBeInTheDocument();
    });
  });

  describe('Bug Report Fields', () => {
    it('should show steps to reproduce for bug type', () => {
      render(<FeedbackDetailDialog {...defaultProps} />);

      expect(screen.getByText('Steps to Reproduce')).toBeInTheDocument();
      expect(screen.getByText(/1. Click button/)).toBeInTheDocument();
    });

    it('should show expected behavior for bug type', () => {
      render(<FeedbackDetailDialog {...defaultProps} />);

      expect(screen.getByText('Expected Behavior')).toBeInTheDocument();
      expect(screen.getByText('Should work correctly')).toBeInTheDocument();
    });

    it('should show actual behavior for bug type', () => {
      render(<FeedbackDetailDialog {...defaultProps} />);

      expect(screen.getByText('Actual Behavior')).toBeInTheDocument();
      expect(screen.getByText('Crashes the app')).toBeInTheDocument();
    });

    it('should show console errors in code style', () => {
      render(<FeedbackDetailDialog {...defaultProps} />);

      expect(screen.getByText('Console Errors')).toBeInTheDocument();
      expect(screen.getByText('TypeError: undefined is not a function')).toBeInTheDocument();
    });
  });

  describe('Feature Request Fields', () => {
    it('should show use case for feature type', () => {
      const featureFeedback = createMockFeedbackItem({
        type: 'feature',
        title: 'Feature Request',
        stepsToReproduce: 'Use case description here',
      });

      render(<FeedbackDetailDialog {...defaultProps} feedback={featureFeedback} />);

      expect(screen.getByText('Use Case')).toBeInTheDocument();
      expect(screen.getByText('Use case description here')).toBeInTheDocument();
    });
  });

  describe('Technical Info', () => {
    it('should display page URL', () => {
      render(<FeedbackDetailDialog {...defaultProps} />);

      expect(screen.getByText('Technical Information')).toBeInTheDocument();
      expect(screen.getByText(/Page URL:/)).toBeInTheDocument();
      expect(screen.getByRole('link', { name: 'http://example.com/page' })).toBeInTheDocument();
    });

    it('should display browser info', () => {
      render(<FeedbackDetailDialog {...defaultProps} />);

      expect(screen.getByText(/Browser:/)).toBeInTheDocument();
      expect(screen.getByText(/Chrome 120.0/)).toBeInTheDocument();
    });
  });

  describe('Screenshots', () => {
    it('should display screenshots when available', () => {
      render(<FeedbackDetailDialog {...defaultProps} />);

      expect(screen.getByText(/Screenshots \(1\)/)).toBeInTheDocument();
      expect(screen.getByAltText('Screenshot 1')).toBeInTheDocument();
    });

    it('should not show screenshots section when none available', () => {
      const feedbackNoScreenshots = createMockFeedbackItem({
        screenshotUrls: [],
      });

      render(<FeedbackDetailDialog {...defaultProps} feedback={feedbackNoScreenshots} />);

      expect(screen.queryByText(/Screenshots/)).not.toBeInTheDocument();
    });
  });

  describe('Status Changes', () => {
    it('should call onStatusChange when status is changed', () => {
      const onStatusChange = jest.fn();
      render(<FeedbackDetailDialog {...defaultProps} onStatusChange={onStatusChange} />);

      // Find the status select and change it
      const statusSelect = screen.getByRole('combobox');
      fireEvent.mouseDown(statusSelect);

      const listbox = within(screen.getByRole('listbox'));
      fireEvent.click(listbox.getByText('Resolved'));

      expect(onStatusChange).toHaveBeenCalledWith('feedback-detail-1', 'resolved');
    });

    it('should disable status select when updating', () => {
      render(<FeedbackDetailDialog {...defaultProps} updating={true} />);

      const statusSelect = screen.getByRole('combobox');
      expect(statusSelect).toHaveAttribute('aria-disabled', 'true');
    });
  });

  describe('Admin Notes', () => {
    it('should display admin notes input', () => {
      render(<FeedbackDetailDialog {...defaultProps} />);

      expect(screen.getByText('Admin Notes (internal only)')).toBeInTheDocument();
      expect(screen.getByDisplayValue('Looking into this')).toBeInTheDocument();
    });

    it('should call onFeedbackChange when typing admin notes', () => {
      const onFeedbackChange = jest.fn();
      render(<FeedbackDetailDialog {...defaultProps} onFeedbackChange={onFeedbackChange} />);

      const adminNotesInput = screen.getByDisplayValue('Looking into this');
      fireEvent.change(adminNotesInput, { target: { value: 'Updated notes' } });

      expect(onFeedbackChange).toHaveBeenCalled();
    });

    it('should call onAdminNotesChange on blur', () => {
      const onAdminNotesChange = jest.fn();
      render(<FeedbackDetailDialog {...defaultProps} onAdminNotesChange={onAdminNotesChange} />);

      const adminNotesInput = screen.getByDisplayValue('Looking into this');
      fireEvent.blur(adminNotesInput);

      expect(onAdminNotesChange).toHaveBeenCalledWith('feedback-detail-1', 'Looking into this');
    });
  });

  describe('Resolution Notes', () => {
    it('should show resolution notes for resolved status', () => {
      const resolvedFeedback = createMockFeedbackItem({
        status: 'resolved',
        resolutionNotes: 'Fixed in v1.2.0',
      });

      render(<FeedbackDetailDialog {...defaultProps} feedback={resolvedFeedback} />);

      expect(screen.getByText('Resolution Notes (visible to user)')).toBeInTheDocument();
    });

    it('should show resolution notes for closed status', () => {
      const closedFeedback = createMockFeedbackItem({
        status: 'closed',
      });

      render(<FeedbackDetailDialog {...defaultProps} feedback={closedFeedback} />);

      expect(screen.getByText('Resolution Notes (visible to user)')).toBeInTheDocument();
    });

    it('should show resolution notes for wont_fix status', () => {
      const wontFixFeedback = createMockFeedbackItem({
        status: 'wont_fix',
      });

      render(<FeedbackDetailDialog {...defaultProps} feedback={wontFixFeedback} />);

      expect(screen.getByText('Resolution Notes (visible to user)')).toBeInTheDocument();
    });

    it('should not show resolution notes for new status', () => {
      const newFeedback = createMockFeedbackItem({
        status: 'new',
      });

      render(<FeedbackDetailDialog {...defaultProps} feedback={newFeedback} />);

      expect(screen.queryByText('Resolution Notes (visible to user)')).not.toBeInTheDocument();
    });

    it('should not show resolution notes for in_progress status', () => {
      const inProgressFeedback = createMockFeedbackItem({
        status: 'in_progress',
      });

      render(<FeedbackDetailDialog {...defaultProps} feedback={inProgressFeedback} />);

      expect(screen.queryByText('Resolution Notes (visible to user)')).not.toBeInTheDocument();
    });
  });

  describe('Close Dialog', () => {
    it('should call onClose when close button is clicked', () => {
      const onClose = jest.fn();
      render(<FeedbackDetailDialog {...defaultProps} onClose={onClose} />);

      fireEvent.click(screen.getByRole('button', { name: 'Close' }));

      expect(onClose).toHaveBeenCalled();
    });
  });
});
