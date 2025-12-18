import type { Timestamp } from 'firebase/firestore';
import type {
  FeedbackModule,
  FeedbackSeverity,
  FeedbackFrequency,
  FeedbackImpact,
} from '@/components/common/FeedbackForm/types';

// Re-export for convenience
export type { FeedbackModule, FeedbackSeverity, FeedbackFrequency, FeedbackImpact };

export type FeedbackType = 'bug' | 'feature' | 'general';
export type FeedbackStatus = 'new' | 'in_progress' | 'resolved' | 'closed' | 'wont_fix';

export interface FeedbackItem {
  id: string;
  type: FeedbackType;
  module?: FeedbackModule;
  title: string;
  description: string;
  stepsToReproduce?: string;
  expectedBehavior?: string;
  actualBehavior?: string;
  consoleErrors?: string;
  screenshotUrls: string[];
  userId: string;
  userEmail: string;
  userName: string;
  pageUrl?: string;
  browserInfo?: string;
  status: FeedbackStatus;
  adminNotes?: string;
  resolutionNotes?: string;
  // Bug-specific fields
  severity?: FeedbackSeverity;
  frequency?: FeedbackFrequency;
  // Feature-specific fields
  impact?: FeedbackImpact;
  createdAt: Timestamp;
  updatedAt?: Timestamp;
}

/**
 * Statistics for feedback dashboard
 */
export interface FeedbackStats {
  total: number;
  byType: Record<FeedbackType, number>;
  byModule: Partial<Record<FeedbackModule, number>>;
  byStatus: Record<FeedbackStatus, number>;
  bySeverity: Partial<Record<FeedbackSeverity, number>>;
}
