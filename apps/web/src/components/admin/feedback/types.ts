import type { Timestamp } from 'firebase/firestore';

export type FeedbackType = 'bug' | 'feature' | 'general';
export type FeedbackStatus = 'new' | 'in_progress' | 'resolved' | 'closed' | 'wont_fix';

export interface FeedbackItem {
  id: string;
  type: FeedbackType;
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
  createdAt: Timestamp;
  updatedAt?: Timestamp;
}
