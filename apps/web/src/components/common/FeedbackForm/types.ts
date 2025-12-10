/**
 * FeedbackForm Types
 *
 * Shared types for the feedback form components.
 */

export type FeedbackType = 'bug' | 'feature' | 'general';

export interface FeedbackFormData {
  type: FeedbackType;
  title: string;
  description: string;
  stepsToReproduce: string;
  expectedBehavior: string;
  actualBehavior: string;
  consoleErrors: string;
  screenshotUrls: string[];
  browserInfo: string;
  pageUrl: string;
}

export const initialFormData: FeedbackFormData = {
  type: 'bug',
  title: '',
  description: '',
  stepsToReproduce: '',
  expectedBehavior: '',
  actualBehavior: '',
  consoleErrors: '',
  screenshotUrls: [],
  browserInfo: '',
  pageUrl: '',
};

export interface FeedbackTypeConfig {
  icon: React.ReactNode;
  label: string;
  color: 'error' | 'warning' | 'info';
  description: string;
}
