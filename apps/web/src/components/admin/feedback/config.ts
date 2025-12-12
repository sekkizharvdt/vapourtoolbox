import type { FeedbackType, FeedbackStatus } from './types';
import { BugReport, Lightbulb, ChatBubble } from '@mui/icons-material';
import { createElement } from 'react';

export const typeConfig: Record<
  FeedbackType,
  { label: string; icon: React.ReactNode; color: 'error' | 'info' | 'default' }
> = {
  bug: { label: 'Bug Report', icon: createElement(BugReport), color: 'error' },
  feature: { label: 'Feature Request', icon: createElement(Lightbulb), color: 'info' },
  general: { label: 'General Feedback', icon: createElement(ChatBubble), color: 'default' },
};

export const statusConfig: Record<
  FeedbackStatus,
  { label: string; color: 'default' | 'primary' | 'success' | 'error' | 'warning' }
> = {
  new: { label: 'New', color: 'primary' },
  in_progress: { label: 'In Progress', color: 'warning' },
  resolved: { label: 'Resolved', color: 'success' },
  closed: { label: 'Closed', color: 'default' },
  wont_fix: { label: "Won't Fix", color: 'error' },
};
