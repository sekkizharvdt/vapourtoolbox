/**
 * FeedbackForm Types
 *
 * Shared types for the feedback form components.
 */

export type FeedbackType = 'bug' | 'feature' | 'general';

/**
 * Application modules for categorizing feedback
 */
export type FeedbackModule =
  | 'accounting'
  | 'procurement'
  | 'projects'
  | 'proposals'
  | 'materials'
  | 'documents'
  | 'thermal'
  | 'hr'
  | 'entities'
  | 'dashboard'
  | 'flow'
  | 'other';

/**
 * Bug severity levels
 */
export type FeedbackSeverity = 'critical' | 'major' | 'minor' | 'cosmetic';

/**
 * How often the bug occurs
 */
export type FeedbackFrequency = 'always' | 'often' | 'sometimes' | 'rarely' | 'once';

/**
 * Feature request impact/priority
 */
export type FeedbackImpact = 'blocker' | 'high' | 'medium' | 'low';

export interface FeedbackFormData {
  type: FeedbackType;
  module: FeedbackModule;
  title: string;
  description: string;
  stepsToReproduce: string;
  expectedBehavior: string;
  actualBehavior: string;
  consoleErrors: string;
  screenshotUrls: string[];
  browserInfo: string;
  pageUrl: string;
  // Bug-specific fields
  severity?: FeedbackSeverity;
  frequency?: FeedbackFrequency;
  // Feature-specific fields
  impact?: FeedbackImpact;
}

export const initialFormData: FeedbackFormData = {
  type: 'bug',
  module: 'other',
  title: '',
  description: '',
  stepsToReproduce: '',
  expectedBehavior: '',
  actualBehavior: '',
  consoleErrors: '',
  screenshotUrls: [],
  browserInfo: '',
  pageUrl: '',
  severity: undefined,
  frequency: undefined,
  impact: undefined,
};

/**
 * Module display configuration
 */
export const MODULE_OPTIONS: { value: FeedbackModule; label: string }[] = [
  { value: 'accounting', label: 'Accounting & Finance' },
  { value: 'procurement', label: 'Procurement' },
  { value: 'projects', label: 'Projects' },
  { value: 'proposals', label: 'Proposals & Enquiries' },
  { value: 'materials', label: 'Materials' },
  { value: 'documents', label: 'Documents' },
  { value: 'thermal', label: 'Thermal Calculators' },
  { value: 'hr', label: 'HR & Leaves' },
  { value: 'entities', label: 'Entities (Vendors/Customers)' },
  { value: 'dashboard', label: 'Dashboard' },
  { value: 'flow', label: 'Flow (Tasks)' },
  { value: 'other', label: 'Other / General' },
];

/**
 * Severity display configuration
 */
export const SEVERITY_OPTIONS: { value: FeedbackSeverity; label: string; description: string }[] = [
  { value: 'critical', label: 'Critical', description: 'System crash, data loss, security issue' },
  { value: 'major', label: 'Major', description: 'Feature unusable, significant workflow impact' },
  { value: 'minor', label: 'Minor', description: 'Feature works but with issues' },
  { value: 'cosmetic', label: 'Cosmetic', description: 'Visual/UI issue only' },
];

/**
 * Frequency display configuration
 */
export const FREQUENCY_OPTIONS: { value: FeedbackFrequency; label: string }[] = [
  { value: 'always', label: 'Always (100%)' },
  { value: 'often', label: 'Often (>50%)' },
  { value: 'sometimes', label: 'Sometimes (10-50%)' },
  { value: 'rarely', label: 'Rarely (<10%)' },
  { value: 'once', label: 'Happened once' },
];

/**
 * Impact display configuration
 */
export const IMPACT_OPTIONS: { value: FeedbackImpact; label: string; description: string }[] = [
  { value: 'blocker', label: 'Blocker', description: 'Cannot work without this' },
  { value: 'high', label: 'High', description: 'Significant productivity improvement' },
  { value: 'medium', label: 'Medium', description: 'Nice to have, moderate impact' },
  { value: 'low', label: 'Low', description: 'Minor convenience' },
];

/**
 * Detect module from URL path
 */
export function detectModuleFromUrl(url: string): FeedbackModule {
  if (url.includes('/accounting')) return 'accounting';
  if (url.includes('/procurement')) return 'procurement';
  if (url.includes('/projects')) return 'projects';
  if (url.includes('/proposals')) return 'proposals';
  if (url.includes('/materials')) return 'materials';
  if (url.includes('/documents')) return 'documents';
  if (url.includes('/thermal')) return 'thermal';
  if (url.includes('/hr')) return 'hr';
  if (url.includes('/entities')) return 'entities';
  if (url.includes('/dashboard')) return 'dashboard';
  if (url.includes('/flow')) return 'flow';
  return 'other';
}

export interface FeedbackTypeConfig {
  icon: React.ReactNode;
  label: string;
  color: 'error' | 'warning' | 'info';
  description: string;
}
