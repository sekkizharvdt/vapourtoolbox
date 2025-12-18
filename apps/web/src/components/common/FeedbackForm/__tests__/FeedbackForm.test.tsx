/**
 * Tests for FeedbackForm components
 *
 * Tests the FeedbackTypeSelector, BugDetailsSection, FeatureRequestSection,
 * and related form components.
 */

import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react';
import { FeedbackTypeSelector, getTypeConfig } from '../FeedbackTypeSelector';
import { BugDetailsSection } from '../BugDetailsSection';
import { FeatureRequestSection } from '../FeatureRequestSection';
import {
  detectModuleFromUrl,
  initialFormData,
  MODULE_OPTIONS,
  SEVERITY_OPTIONS,
  FREQUENCY_OPTIONS,
  IMPACT_OPTIONS,
} from '../types';

// Mock MUI icons to avoid rendering issues
jest.mock('@mui/icons-material/BugReport', () => {
  const MockBugIcon = () => <span data-testid="bug-icon" />;
  MockBugIcon.displayName = 'MockBugIcon';
  return MockBugIcon;
});

jest.mock('@mui/icons-material/Lightbulb', () => {
  const MockLightbulbIcon = () => <span data-testid="lightbulb-icon" />;
  MockLightbulbIcon.displayName = 'MockLightbulbIcon';
  return MockLightbulbIcon;
});

jest.mock('@mui/icons-material/Feedback', () => {
  const MockFeedbackIcon = () => <span data-testid="feedback-icon" />;
  MockFeedbackIcon.displayName = 'MockFeedbackIcon';
  return MockFeedbackIcon;
});

jest.mock('@mui/icons-material/Warning', () => {
  const MockWarningIcon = () => <span data-testid="warning-icon" />;
  MockWarningIcon.displayName = 'MockWarningIcon';
  return MockWarningIcon;
});

jest.mock('@mui/icons-material/Code', () => {
  const MockCodeIcon = () => <span data-testid="code-icon" />;
  MockCodeIcon.displayName = 'MockCodeIcon';
  return MockCodeIcon;
});

jest.mock('@mui/icons-material/Screenshot', () => {
  const MockScreenshotIcon = () => <span data-testid="screenshot-icon" />;
  MockScreenshotIcon.displayName = 'MockScreenshotIcon';
  return MockScreenshotIcon;
});

// Mock ScreenshotUpload component
jest.mock('../ScreenshotUpload', () => ({
  ScreenshotUpload: ({
    screenshots,
    onAdd,
    onRemove,
    isUploading,
  }: {
    screenshots: string[];
    onAdd: (file: File) => void;
    onRemove: (index: number) => void;
    isUploading: boolean;
  }) => (
    <div data-testid="screenshot-upload">
      <span>Screenshots: {screenshots.length}</span>
      <span>Uploading: {isUploading ? 'yes' : 'no'}</span>
      <button onClick={() => onAdd(new File([], 'test.png'))}>Add screenshot</button>
      <button onClick={() => onRemove(0)}>Remove screenshot</button>
    </div>
  ),
}));

// Mock ConsoleErrorInstructions component
jest.mock('../ConsoleErrorInstructions', () => ({
  ConsoleErrorInstructions: () => (
    <div data-testid="console-instructions">Console instructions</div>
  ),
}));

describe('FeedbackTypeSelector', () => {
  const mockOnChange = jest.fn();

  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('should render all feedback type options', () => {
    render(<FeedbackTypeSelector value="bug" onChange={mockOnChange} />);

    expect(screen.getByText('Bug Report')).toBeInTheDocument();
    expect(screen.getByText('Feature Request')).toBeInTheDocument();
    expect(screen.getByText('General Feedback')).toBeInTheDocument();
  });

  it('should display the selected type description', () => {
    render(<FeedbackTypeSelector value="bug" onChange={mockOnChange} />);

    expect(screen.getByText('Report an error or unexpected behavior')).toBeInTheDocument();
  });

  it('should display feature request description when selected', () => {
    render(<FeedbackTypeSelector value="feature" onChange={mockOnChange} />);

    expect(screen.getByText('Suggest a new feature or improvement')).toBeInTheDocument();
  });

  it('should display general feedback description when selected', () => {
    render(<FeedbackTypeSelector value="general" onChange={mockOnChange} />);

    expect(screen.getByText('Share your thoughts or suggestions')).toBeInTheDocument();
  });

  it('should call onChange when type is selected', () => {
    render(<FeedbackTypeSelector value="bug" onChange={mockOnChange} />);

    // Click on Feature Request button
    const featureButton = screen.getByText('Feature Request').closest('button');
    if (featureButton) {
      fireEvent.click(featureButton);
      expect(mockOnChange).toHaveBeenCalledWith('feature');
    }
  });

  it('should not call onChange when clicking on already selected type', () => {
    render(<FeedbackTypeSelector value="bug" onChange={mockOnChange} />);

    // Click on already selected Bug Report button - MUI ToggleButtonGroup returns null
    const bugButton = screen.getByText('Bug Report').closest('button');
    if (bugButton) {
      fireEvent.click(bugButton);
      // When clicking already selected item, the handler receives null and we don't call onChange
      expect(mockOnChange).not.toHaveBeenCalled();
    }
  });
});

describe('getTypeConfig', () => {
  it('should return correct config for bug type', () => {
    const config = getTypeConfig('bug');

    expect(config.label).toBe('Bug Report');
    expect(config.color).toBe('error');
    expect(config.description).toBe('Report an error or unexpected behavior');
  });

  it('should return correct config for feature type', () => {
    const config = getTypeConfig('feature');

    expect(config.label).toBe('Feature Request');
    expect(config.color).toBe('warning');
    expect(config.description).toBe('Suggest a new feature or improvement');
  });

  it('should return correct config for general type', () => {
    const config = getTypeConfig('general');

    expect(config.label).toBe('General Feedback');
    expect(config.color).toBe('info');
    expect(config.description).toBe('Share your thoughts or suggestions');
  });
});

describe('BugDetailsSection', () => {
  const defaultProps = {
    stepsToReproduce: '',
    expectedBehavior: '',
    actualBehavior: '',
    consoleErrors: '',
    screenshotUrls: [],
    isUploading: false,
    onStepsChange: jest.fn(),
    onExpectedChange: jest.fn(),
    onActualChange: jest.fn(),
    onConsoleErrorsChange: jest.fn(),
    onScreenshotAdd: jest.fn(),
    onScreenshotRemove: jest.fn(),
  };

  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('should render all bug detail fields', () => {
    render(<BugDetailsSection {...defaultProps} />);

    expect(screen.getByLabelText(/Steps to Reproduce/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/Expected Behavior/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/Actual Behavior/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/Console Errors/i)).toBeInTheDocument();
  });

  it('should render screenshot upload component', () => {
    render(<BugDetailsSection {...defaultProps} />);

    expect(screen.getByTestId('screenshot-upload')).toBeInTheDocument();
  });

  it('should render console error instructions', () => {
    render(<BugDetailsSection {...defaultProps} />);

    expect(screen.getByTestId('console-instructions')).toBeInTheDocument();
  });

  it('should display existing values in fields', () => {
    render(
      <BugDetailsSection
        {...defaultProps}
        stepsToReproduce="1. Click button"
        expectedBehavior="Should work"
        actualBehavior="Does not work"
        consoleErrors="Error: Something went wrong"
        screenshotUrls={['url1', 'url2']}
      />
    );

    expect(screen.getByDisplayValue('1. Click button')).toBeInTheDocument();
    expect(screen.getByDisplayValue('Should work')).toBeInTheDocument();
    expect(screen.getByDisplayValue('Does not work')).toBeInTheDocument();
    expect(screen.getByDisplayValue('Error: Something went wrong')).toBeInTheDocument();
    expect(screen.getByText('Screenshots: 2')).toBeInTheDocument();
  });

  it('should call onStepsChange when steps field changes', () => {
    render(<BugDetailsSection {...defaultProps} />);

    const stepsField = screen.getByLabelText(/Steps to Reproduce/i);
    fireEvent.change(stepsField, { target: { value: 'New steps' } });

    expect(defaultProps.onStepsChange).toHaveBeenCalledWith('New steps');
  });

  it('should call onExpectedChange when expected behavior field changes', () => {
    render(<BugDetailsSection {...defaultProps} />);

    const expectedField = screen.getByLabelText(/Expected Behavior/i);
    fireEvent.change(expectedField, { target: { value: 'Expected outcome' } });

    expect(defaultProps.onExpectedChange).toHaveBeenCalledWith('Expected outcome');
  });

  it('should call onActualChange when actual behavior field changes', () => {
    render(<BugDetailsSection {...defaultProps} />);

    const actualField = screen.getByLabelText(/Actual Behavior/i);
    fireEvent.change(actualField, { target: { value: 'Actual outcome' } });

    expect(defaultProps.onActualChange).toHaveBeenCalledWith('Actual outcome');
  });

  it('should call onConsoleErrorsChange when console errors field changes', () => {
    render(<BugDetailsSection {...defaultProps} />);

    const consoleField = screen.getByLabelText(/Console Errors/i);
    fireEvent.change(consoleField, { target: { value: 'New error' } });

    expect(defaultProps.onConsoleErrorsChange).toHaveBeenCalledWith('New error');
  });

  it('should call onScreenshotAdd when add button is clicked', () => {
    render(<BugDetailsSection {...defaultProps} />);

    const addButton = screen.getByText('Add screenshot');
    fireEvent.click(addButton);

    expect(defaultProps.onScreenshotAdd).toHaveBeenCalled();
  });

  it('should call onScreenshotRemove when remove button is clicked', () => {
    render(<BugDetailsSection {...defaultProps} screenshotUrls={['url1']} />);

    const removeButton = screen.getByText('Remove screenshot');
    fireEvent.click(removeButton);

    expect(defaultProps.onScreenshotRemove).toHaveBeenCalledWith(0);
  });

  it('should show uploading state', () => {
    render(<BugDetailsSection {...defaultProps} isUploading={true} />);

    expect(screen.getByText('Uploading: yes')).toBeInTheDocument();
  });

  it('should display keyboard shortcut hints', () => {
    render(<BugDetailsSection {...defaultProps} />);

    expect(screen.getByText('Windows: Win+Shift+S')).toBeInTheDocument();
    expect(screen.getByText('Mac: \u2318+Shift+4')).toBeInTheDocument();
  });
});

describe('FeatureRequestSection', () => {
  const defaultProps = {
    useCase: '',
    expectedOutcome: '',
    onUseCaseChange: jest.fn(),
    onExpectedOutcomeChange: jest.fn(),
  };

  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('should render use case and expected outcome fields', () => {
    render(<FeatureRequestSection {...defaultProps} />);

    expect(screen.getByLabelText(/Use Case/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/Expected Outcome/i)).toBeInTheDocument();
  });

  it('should display info alert about context', () => {
    render(<FeatureRequestSection {...defaultProps} />);

    expect(
      screen.getByText(/The more context you provide, the better we can understand/i)
    ).toBeInTheDocument();
  });

  it('should display existing values in fields', () => {
    render(
      <FeatureRequestSection
        {...defaultProps}
        useCase="I want to export data"
        expectedOutcome="Data exports to CSV"
      />
    );

    expect(screen.getByDisplayValue('I want to export data')).toBeInTheDocument();
    expect(screen.getByDisplayValue('Data exports to CSV')).toBeInTheDocument();
  });

  it('should call onUseCaseChange when use case field changes', () => {
    render(<FeatureRequestSection {...defaultProps} />);

    const useCaseField = screen.getByLabelText(/Use Case/i);
    fireEvent.change(useCaseField, { target: { value: 'New use case' } });

    expect(defaultProps.onUseCaseChange).toHaveBeenCalledWith('New use case');
  });

  it('should call onExpectedOutcomeChange when expected outcome field changes', () => {
    render(<FeatureRequestSection {...defaultProps} />);

    const outcomeField = screen.getByLabelText(/Expected Outcome/i);
    fireEvent.change(outcomeField, { target: { value: 'New outcome' } });

    expect(defaultProps.onExpectedOutcomeChange).toHaveBeenCalledWith('New outcome');
  });
});

describe('detectModuleFromUrl', () => {
  it('should detect accounting module', () => {
    expect(detectModuleFromUrl('/accounting/invoices')).toBe('accounting');
    expect(detectModuleFromUrl('https://app.com/accounting/bills')).toBe('accounting');
  });

  it('should detect procurement module', () => {
    expect(detectModuleFromUrl('/procurement/rfqs')).toBe('procurement');
    expect(detectModuleFromUrl('/procurement/purchase-requests/123')).toBe('procurement');
  });

  it('should detect projects module', () => {
    expect(detectModuleFromUrl('/projects/list')).toBe('projects');
    expect(detectModuleFromUrl('/projects/123/charter')).toBe('projects');
  });

  it('should detect proposals module', () => {
    expect(detectModuleFromUrl('/proposals/new')).toBe('proposals');
    expect(detectModuleFromUrl('/proposals/enquiries/123')).toBe('proposals');
  });

  it('should detect materials module', () => {
    expect(detectModuleFromUrl('/materials/pipes')).toBe('materials');
    expect(detectModuleFromUrl('/materials/123/edit')).toBe('materials');
  });

  it('should detect documents module', () => {
    expect(detectModuleFromUrl('/documents')).toBe('documents');
    expect(detectModuleFromUrl('/documents/123')).toBe('documents');
  });

  it('should detect thermal module', () => {
    expect(detectModuleFromUrl('/thermal/calculators')).toBe('thermal');
    expect(detectModuleFromUrl('/thermal/flash-chamber')).toBe('thermal');
  });

  it('should detect hr module', () => {
    expect(detectModuleFromUrl('/hr/leaves')).toBe('hr');
    expect(detectModuleFromUrl('/hr/attendance')).toBe('hr');
  });

  it('should detect entities module', () => {
    expect(detectModuleFromUrl('/entities')).toBe('entities');
    expect(detectModuleFromUrl('/entities/vendors/123')).toBe('entities');
  });

  it('should detect dashboard module', () => {
    expect(detectModuleFromUrl('/dashboard')).toBe('dashboard');
    expect(detectModuleFromUrl('/dashboard/shapes')).toBe('dashboard');
  });

  it('should detect flow module', () => {
    expect(detectModuleFromUrl('/flow')).toBe('flow');
    expect(detectModuleFromUrl('/flow/tasks')).toBe('flow');
  });

  it('should return other for unrecognized paths', () => {
    expect(detectModuleFromUrl('/login')).toBe('other');
    expect(detectModuleFromUrl('/settings')).toBe('other');
    expect(detectModuleFromUrl('/')).toBe('other');
    expect(detectModuleFromUrl('')).toBe('other');
  });
});

describe('initialFormData', () => {
  it('should have correct default values', () => {
    expect(initialFormData.type).toBe('bug');
    expect(initialFormData.module).toBe('other');
    expect(initialFormData.title).toBe('');
    expect(initialFormData.description).toBe('');
    expect(initialFormData.stepsToReproduce).toBe('');
    expect(initialFormData.expectedBehavior).toBe('');
    expect(initialFormData.actualBehavior).toBe('');
    expect(initialFormData.consoleErrors).toBe('');
    expect(initialFormData.screenshotUrls).toEqual([]);
    expect(initialFormData.browserInfo).toBe('');
    expect(initialFormData.pageUrl).toBe('');
    expect(initialFormData.severity).toBeUndefined();
    expect(initialFormData.frequency).toBeUndefined();
    expect(initialFormData.impact).toBeUndefined();
  });
});

describe('MODULE_OPTIONS', () => {
  it('should contain all expected modules', () => {
    const moduleValues = MODULE_OPTIONS.map((opt) => opt.value);

    expect(moduleValues).toContain('accounting');
    expect(moduleValues).toContain('procurement');
    expect(moduleValues).toContain('projects');
    expect(moduleValues).toContain('proposals');
    expect(moduleValues).toContain('materials');
    expect(moduleValues).toContain('documents');
    expect(moduleValues).toContain('thermal');
    expect(moduleValues).toContain('hr');
    expect(moduleValues).toContain('entities');
    expect(moduleValues).toContain('dashboard');
    expect(moduleValues).toContain('flow');
    expect(moduleValues).toContain('other');
  });

  it('should have 12 module options', () => {
    expect(MODULE_OPTIONS).toHaveLength(12);
  });

  it('should have labels for all modules', () => {
    MODULE_OPTIONS.forEach((option) => {
      expect(option.label).toBeTruthy();
      expect(typeof option.label).toBe('string');
    });
  });
});

describe('SEVERITY_OPTIONS', () => {
  it('should contain all severity levels', () => {
    const severityValues = SEVERITY_OPTIONS.map((opt) => opt.value);

    expect(severityValues).toContain('critical');
    expect(severityValues).toContain('major');
    expect(severityValues).toContain('minor');
    expect(severityValues).toContain('cosmetic');
  });

  it('should have 4 severity options', () => {
    expect(SEVERITY_OPTIONS).toHaveLength(4);
  });

  it('should have labels and descriptions for all severities', () => {
    SEVERITY_OPTIONS.forEach((option) => {
      expect(option.label).toBeTruthy();
      expect(option.description).toBeTruthy();
    });
  });
});

describe('FREQUENCY_OPTIONS', () => {
  it('should contain all frequency levels', () => {
    const frequencyValues = FREQUENCY_OPTIONS.map((opt) => opt.value);

    expect(frequencyValues).toContain('always');
    expect(frequencyValues).toContain('often');
    expect(frequencyValues).toContain('sometimes');
    expect(frequencyValues).toContain('rarely');
    expect(frequencyValues).toContain('once');
  });

  it('should have 5 frequency options', () => {
    expect(FREQUENCY_OPTIONS).toHaveLength(5);
  });

  it('should have labels for all frequencies', () => {
    FREQUENCY_OPTIONS.forEach((option) => {
      expect(option.label).toBeTruthy();
    });
  });
});

describe('IMPACT_OPTIONS', () => {
  it('should contain all impact levels', () => {
    const impactValues = IMPACT_OPTIONS.map((opt) => opt.value);

    expect(impactValues).toContain('blocker');
    expect(impactValues).toContain('high');
    expect(impactValues).toContain('medium');
    expect(impactValues).toContain('low');
  });

  it('should have 4 impact options', () => {
    expect(IMPACT_OPTIONS).toHaveLength(4);
  });

  it('should have labels and descriptions for all impacts', () => {
    IMPACT_OPTIONS.forEach((option) => {
      expect(option.label).toBeTruthy();
      expect(option.description).toBeTruthy();
    });
  });
});
