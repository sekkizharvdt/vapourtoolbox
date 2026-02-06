/**
 * Task-Notification System Types
 *
 * Unified system where notifications are actionable/acknowledgeable items
 * with optional time tracking integration
 */

import type { Timestamp } from 'firebase/firestore';

// ============================================================================
// TASK NOTIFICATION TYPES
// ============================================================================

/**
 * Task Notification Category
 * Categorizes the type of notification/task
 */
export type TaskNotificationCategory =
  // Procurement
  | 'PR_SUBMITTED' // Actionable: Review and approve/reject PR
  | 'PR_APPROVED' // Informational: Your PR was approved
  | 'PR_REJECTED' // Informational: Your PR was rejected
  | 'PR_COMMENTED' // Informational: Someone commented on your PR
  | 'RFQ_CREATED' // Informational: New RFQ created
  | 'RFQ_OFFER_RECEIVED' // Informational: Vendor offer received for RFQ
  | 'RFQ_READY_FOR_EVALUATION' // Actionable: All offers received, evaluate and select vendor
  | 'OFFER_UPLOADED' // Informational: Vendor offer received
  | 'PO_PENDING_APPROVAL' // Actionable: Approve/reject PO
  | 'PO_APPROVED' // Informational: Your PO was approved
  | 'PO_REJECTED' // Informational: Your PO was rejected
  | 'GOODS_RECEIVED' // Informational: Goods received for PO
  | 'GR_READY_FOR_PAYMENT' // Actionable: Review GR and approve payment
  | 'GR_PAYMENT_APPROVED' // Informational: Payment approved for GR
  | 'PAYMENT_REQUESTED' // Actionable: Process payment
  | 'WCC_ISSUED' // Informational: Work completion certificate issued
  // General Tasks
  | 'TASK_ASSIGNED' // Actionable: Complete assigned task
  | 'TASK_TRANSFERRED' // Informational: Task transferred to you
  | 'TASK_DEADLINE_APPROACHING' // Informational: Task deadline soon
  | 'TASK_COMPLETED' // Informational: Task you assigned was completed
  // Accounting
  | 'INVOICE_SUBMITTED' // Actionable: Review and approve/reject invoice
  | 'INVOICE_APPROVAL_REQUIRED' // Actionable: Approve invoice
  | 'INVOICE_APPROVED' // Informational: Your invoice was approved
  | 'INVOICE_REJECTED' // Informational: Your invoice was rejected
  | 'BILL_SUBMITTED' // Actionable: Review and approve/reject vendor bill
  | 'BILL_APPROVED' // Informational: Your bill was approved
  | 'BILL_REJECTED' // Informational: Your bill was rejected
  | 'PAYMENT_APPROVED' // Informational: Payment was approved
  | 'PAYMENT_COMPLETED' // Informational: Payment was completed
  // Projects
  | 'MILESTONE_DUE' // Actionable: Complete milestone
  | 'PROJECT_UPDATE_REQUIRED' // Actionable: Update project status
  | 'PROJECT_DELIVERABLE_DUE' // Actionable: Submit deliverable
  // Document Management
  | 'DOCUMENT_ASSIGNED' // Actionable: Work on assigned document
  | 'DOCUMENT_SUBMISSION_REQUIRED' // Actionable: Submit document for PM review
  | 'DOCUMENT_INTERNAL_REVIEW' // Actionable: PM to review document before client submission
  | 'DOCUMENT_APPROVED_FOR_CLIENT' // Informational: PM approved, ready for client
  | 'DOCUMENT_SUBMITTED_TO_CLIENT' // Informational: Document submitted to client
  | 'DOCUMENT_CLIENT_REVIEW_PENDING' // Informational: Awaiting client review
  | 'DOCUMENT_CLIENT_COMMENTED' // Actionable: Client provided comments, resolve them
  | 'DOCUMENT_COMMENTS_RESOLVED' // Actionable: PM to approve comment resolutions
  | 'DOCUMENT_RESUBMISSION_REQUIRED' // Actionable: Resubmit revised document
  | 'DOCUMENT_APPROVED_BY_CLIENT' // Informational: Client approved document
  | 'DOCUMENT_ACCEPTED_BY_CLIENT' // Informational: Client accepted (final)
  | 'DOCUMENT_PREDECESSOR_COMPLETED' // Informational: Predecessor complete, can start work
  | 'WORK_ITEM_ASSIGNED' // Actionable: Complete work item activity
  | 'SUPPLY_LIST_PR_REQUIRED' // Actionable: Create PR from supply list
  // Proposals
  | 'PROPOSAL_SUBMITTED' // Actionable: Review and approve/reject proposal
  | 'PROPOSAL_APPROVED' // Informational: Your proposal was approved
  | 'PROPOSAL_REJECTED' // Informational: Your proposal was rejected
  | 'PROPOSAL_CHANGES_REQUESTED' // Informational: Changes needed on proposal
  | 'ENQUIRY_ASSIGNED' // Actionable: Work on assigned enquiry
  // Feedback
  | 'FEEDBACK_RESOLUTION_CHECK' // Actionable: Verify fix with reporter, close or follow up
  | 'FEEDBACK_REOPENED' // Informational: Reporter requested follow-up on resolved feedback
  // HR / Leave Management
  | 'LEAVE_SUBMITTED' // Actionable: Review and approve/reject leave request
  | 'LEAVE_APPROVED' // Informational: Your leave request was approved
  | 'LEAVE_REJECTED' // Informational: Your leave request was rejected
  // HR / On-Duty Requests
  | 'ON_DUTY_SUBMITTED' // Actionable: Review and approve/reject on-duty request
  | 'ON_DUTY_APPROVED' // Informational: Your on-duty request was approved
  | 'ON_DUTY_REJECTED' // Informational: Your on-duty request was rejected
  | 'ON_DUTY_CANCELLED' // Informational: On-duty request was cancelled
  // HR / Travel Expenses
  | 'TRAVEL_EXPENSE_SUBMITTED' // Actionable: Review and approve/reject travel expense
  | 'TRAVEL_EXPENSE_APPROVED' // Informational: Your travel expense was approved
  | 'TRAVEL_EXPENSE_REJECTED' // Informational: Your travel expense was rejected
  | 'TRAVEL_EXPENSE_RETURNED' // Actionable: Review and revise travel expense
  | 'TRAVEL_EXPENSE_REIMBURSED'; // Informational: Your travel expense was reimbursed

/**
 * Task Notification Status
 */
export type TaskNotificationStatus =
  | 'pending' // Not yet acknowledged or started
  | 'acknowledged' // Informational item acknowledged
  | 'in_progress' // Actionable item being worked on (timer running)
  | 'completed'; // Item completed

/**
 * Task Notification Priority
 */
export type TaskNotificationPriority = 'LOW' | 'MEDIUM' | 'HIGH' | 'URGENT';

/**
 * Task Notification Type
 */
export type TaskNotificationType =
  | 'actionable' // Requires work/action with optional time tracking
  | 'informational'; // Just needs acknowledgement (no time tracking)

/**
 * Task Notification
 * Unified notification-task that can be actionable (with time tracking)
 * or informational (acknowledgement only)
 */
export interface TaskNotification {
  id: string;

  // Classification
  type: TaskNotificationType;
  category: TaskNotificationCategory;

  // Assignment
  userId: string; // Who this is assigned to
  assignedBy?: string; // Who created/assigned this
  assignedByName?: string;

  // Content
  title: string;
  message: string;
  priority: TaskNotificationPriority;

  // Linking to entities
  projectId?: string;
  equipmentId?: string;
  entityType: string; // 'PURCHASE_REQUEST', 'RFQ', 'TASK', etc.
  entityId: string; // ID of the linked entity
  linkUrl: string; // Where to navigate when clicked

  // Status
  status: TaskNotificationStatus;
  read: boolean; // Has user seen this?

  // Time Tracking (for actionable items)
  timeStarted?: Timestamp; // When user clicked "Start"
  timeCompleted?: Timestamp; // When work finished
  totalDuration?: number; // Total seconds spent (sum of all time entries)

  // Acknowledgement (for informational items)
  acknowledgedAt?: Timestamp; // When user acknowledged

  // Auto-completion
  autoCompletable: boolean; // Can system auto-complete this?
  autoCompletedAt?: Timestamp; // When system detected completion
  manuallyCompletedAt?: Timestamp; // When user manually marked complete
  completionConfirmed: boolean; // User confirmed auto-completion

  // Additional metadata
  metadata?: Record<string, any>;

  // Timestamps
  createdAt: Timestamp;
  updatedAt?: Timestamp;
}

// ============================================================================
// TIME ENTRY TYPES
// ============================================================================

/**
 * Time Entry
 * Records time spent on a task-notification
 */
export interface TimeEntry {
  id: string;

  // Links
  userId: string;
  taskNotificationId: string; // Links to TaskNotification

  // Time tracking
  startTime: Timestamp;
  endTime?: Timestamp;
  duration: number; // In seconds
  isActive: boolean; // Only one can be active per user

  // Pause/Resume support
  pausedAt?: Timestamp;
  pausedDuration?: number; // Total paused time in seconds
  resumedAt?: Timestamp;

  // Notes
  description?: string;
  notes?: string;

  // Timestamps
  createdAt: Timestamp;
  updatedAt?: Timestamp;
}

// ============================================================================
// INPUT/FILTER TYPES
// ============================================================================

/**
 * Create Task Notification Input
 */
export interface CreateTaskNotificationInput {
  // Classification
  type: TaskNotificationType;
  category: TaskNotificationCategory;

  // Assignment
  userId: string;
  assignedBy?: string;
  assignedByName?: string;

  // Content
  title: string;
  message: string;
  priority?: TaskNotificationPriority;

  // Linking
  projectId?: string;
  equipmentId?: string;
  entityType: string;
  entityId: string;
  linkUrl: string;

  // Auto-completion
  autoCompletable?: boolean;

  // Metadata
  metadata?: Record<string, any>;
}

/**
 * Task Notification Filters
 */
export interface TaskNotificationFilters {
  userId?: string;
  type?: TaskNotificationType;
  category?: TaskNotificationCategory;
  status?: TaskNotificationStatus;
  priority?: TaskNotificationPriority;
  projectId?: string;
  read?: boolean;
  limit?: number;
}

/**
 * Time Entry Filters
 */
export interface TimeEntryFilters {
  userId?: string;
  taskNotificationId?: string;
  isActive?: boolean;
  startDate?: Date;
  endDate?: Date;
  limit?: number;
}

// ============================================================================
// SUMMARY/STATS TYPES
// ============================================================================

/**
 * Task Notification Summary
 */
export interface TaskNotificationSummary {
  total: number;
  unread: number;
  pending: number;
  inProgress: number;
  completed: number;
  byPriority: {
    LOW: number;
    MEDIUM: number;
    HIGH: number;
    URGENT: number;
  };
  byType: {
    actionable: number;
    informational: number;
  };
}

/**
 * Time Tracking Summary
 */
export interface TimeTrackingSummary {
  totalTime: number; // Total seconds
  activeEntries: number;
  completedTasks: number;
  averageTaskDuration: number; // Average seconds per task
  byProject?: Record<string, number>; // Project ID -> total seconds
  byCategory?: Record<string, number>; // Category -> total seconds
}

/**
 * User Time Stats
 */
export interface UserTimeStats {
  userId: string;
  today: TimeTrackingSummary;
  thisWeek: TimeTrackingSummary;
  thisMonth: TimeTrackingSummary;
  currentActiveEntry?: TimeEntry;
  currentActiveTask?: TaskNotification;
}

// ============================================================================
// SLACK-LIKE TASK CHANNEL TYPES
// ============================================================================

/**
 * Default channel IDs (these are derived, not stored in DB)
 */
export type DefaultTaskChannelId =
  | 'general'
  | 'procurement'
  | 'documents'
  | 'accounting'
  | 'approvals'
  | 'enquiries'
  | 'proposals'
  | 'feedback'
  | 'hr';

/**
 * Task Channel
 * Represents a channel in the Slack-like task interface
 */
export interface TaskChannel {
  id: string;
  name: string;
  icon: string;
  description?: string;
  categories: TaskNotificationCategory[];
  isDefault: boolean;
}

/**
 * Mapping of default channels to task categories
 */
export const TASK_CHANNEL_DEFINITIONS: Record<DefaultTaskChannelId, TaskChannel> = {
  general: {
    id: 'general',
    name: 'General',
    icon: 'Hash',
    description: 'Project-wide announcements and updates',
    categories: ['MILESTONE_DUE', 'PROJECT_UPDATE_REQUIRED', 'PROJECT_DELIVERABLE_DUE'],
    isDefault: true,
  },
  procurement: {
    id: 'procurement',
    name: 'Procurement',
    icon: 'ShoppingCart',
    description: 'Purchase requests, RFQs, POs, and goods receipts',
    categories: [
      'PR_SUBMITTED',
      'PR_APPROVED',
      'PR_REJECTED',
      'PR_COMMENTED',
      'RFQ_CREATED',
      'OFFER_UPLOADED',
      'PO_PENDING_APPROVAL',
      'PO_APPROVED',
      'PO_REJECTED',
      'GOODS_RECEIVED',
      'WCC_ISSUED',
    ],
    isDefault: true,
  },
  documents: {
    id: 'documents',
    name: 'Documents',
    icon: 'FileText',
    description: 'Document reviews, submissions, and approvals',
    categories: [
      'DOCUMENT_ASSIGNED',
      'DOCUMENT_SUBMISSION_REQUIRED',
      'DOCUMENT_INTERNAL_REVIEW',
      'DOCUMENT_APPROVED_FOR_CLIENT',
      'DOCUMENT_SUBMITTED_TO_CLIENT',
      'DOCUMENT_CLIENT_REVIEW_PENDING',
      'DOCUMENT_CLIENT_COMMENTED',
      'DOCUMENT_COMMENTS_RESOLVED',
      'DOCUMENT_RESUBMISSION_REQUIRED',
      'DOCUMENT_APPROVED_BY_CLIENT',
      'DOCUMENT_ACCEPTED_BY_CLIENT',
      'DOCUMENT_PREDECESSOR_COMPLETED',
      'WORK_ITEM_ASSIGNED',
      'SUPPLY_LIST_PR_REQUIRED',
    ],
    isDefault: true,
  },
  accounting: {
    id: 'accounting',
    name: 'Accounting',
    icon: 'Calculator',
    description: 'Invoices, bills, payments, and financial tasks',
    categories: [
      'INVOICE_SUBMITTED',
      'INVOICE_APPROVAL_REQUIRED',
      'INVOICE_APPROVED',
      'INVOICE_REJECTED',
      'BILL_SUBMITTED',
      'BILL_APPROVED',
      'BILL_REJECTED',
      'PAYMENT_APPROVED',
      'PAYMENT_COMPLETED',
      'PAYMENT_REQUESTED',
    ],
    isDefault: true,
  },
  approvals: {
    id: 'approvals',
    name: 'Approvals',
    icon: 'CheckCircle',
    description: 'Cross-module approval tasks',
    categories: [], // Will contain approval-type tasks from other channels
    isDefault: true,
  },
  enquiries: {
    id: 'enquiries',
    name: 'Enquiries',
    icon: 'HelpCircle',
    description: 'Customer enquiries and follow-ups',
    categories: ['ENQUIRY_ASSIGNED'],
    isDefault: true,
  },
  proposals: {
    id: 'proposals',
    name: 'Proposals',
    icon: 'FileSignature',
    description: 'Proposal drafts, reviews, and approvals',
    categories: [
      'PROPOSAL_SUBMITTED',
      'PROPOSAL_APPROVED',
      'PROPOSAL_REJECTED',
      'PROPOSAL_CHANGES_REQUESTED',
    ],
    isDefault: true,
  },
  feedback: {
    id: 'feedback',
    name: 'Feedback',
    icon: 'MessageSquare',
    description: 'Bug reports and feature request follow-ups',
    categories: ['FEEDBACK_RESOLUTION_CHECK', 'FEEDBACK_REOPENED'],
    isDefault: true,
  },
  hr: {
    id: 'hr',
    name: 'HR',
    icon: 'Users',
    description: 'Leave requests, on-duty requests, approvals, and HR notifications',
    categories: [
      'LEAVE_SUBMITTED',
      'LEAVE_APPROVED',
      'LEAVE_REJECTED',
      'ON_DUTY_SUBMITTED',
      'ON_DUTY_APPROVED',
      'ON_DUTY_REJECTED',
      'ON_DUTY_CANCELLED',
      'TRAVEL_EXPENSE_SUBMITTED',
      'TRAVEL_EXPENSE_APPROVED',
      'TRAVEL_EXPENSE_REJECTED',
      'TRAVEL_EXPENSE_RETURNED',
      'TRAVEL_EXPENSE_REIMBURSED',
    ],
    isDefault: true,
  },
};

/**
 * Get channel ID from task category
 */
export function getChannelIdFromCategory(category: TaskNotificationCategory): DefaultTaskChannelId {
  for (const [channelId, channel] of Object.entries(TASK_CHANNEL_DEFINITIONS)) {
    if (channel.categories.includes(category)) {
      return channelId as DefaultTaskChannelId;
    }
  }
  // Default to general if category not mapped
  return 'general';
}

/**
 * Check if a category is an approval-type task
 */
export function isApprovalCategory(category: TaskNotificationCategory): boolean {
  const approvalCategories: TaskNotificationCategory[] = [
    'PR_SUBMITTED',
    'PO_PENDING_APPROVAL',
    'INVOICE_SUBMITTED',
    'INVOICE_APPROVAL_REQUIRED',
    'BILL_SUBMITTED',
    'PROPOSAL_SUBMITTED',
    'DOCUMENT_INTERNAL_REVIEW',
    'DOCUMENT_COMMENTS_RESOLVED',
    'LEAVE_SUBMITTED',
    'ON_DUTY_SUBMITTED',
    'TRAVEL_EXPENSE_SUBMITTED',
  ];
  return approvalCategories.includes(category);
}

/**
 * Project Channel (custom channels created per project)
 * Stored in projectChannels collection
 */
export interface ProjectChannel {
  id: string;
  projectId: string;
  name: string;
  icon?: string;
  description?: string;
  isDefault: boolean;
  createdBy: string;
  createdAt: Timestamp;
  updatedAt?: Timestamp;
}

/**
 * Task Workspace
 * Represents a project as a workspace in the Slack-like interface
 */
export interface TaskWorkspace {
  id: string; // Project ID or 'pre-sales'
  name: string;
  type: 'project' | 'pre-sales';
  channels: TaskChannel[];
  unreadCount?: number;
}

// ============================================================================
// THREAD & MENTION TYPES (For Phase C)
// ============================================================================

/**
 * Task Thread
 * Thread for discussions on a task
 */
export interface TaskThread {
  id: string;
  taskNotificationId: string;
  projectId?: string;
  channelId: string;
  messageCount: number;
  lastMessageAt: Timestamp;
  createdAt: Timestamp;
  updatedAt?: Timestamp;
}

/**
 * Task Message
 * Message in a thread
 */
export interface TaskMessage {
  id: string;
  threadId: string;
  userId: string;
  userName: string;
  userAvatar?: string;
  content: string;
  mentions: string[]; // userIds mentioned
  createdAt: Timestamp;
  editedAt?: Timestamp;
}

/**
 * Task Mention
 * Mention notification for @mentions
 */
export interface TaskMention {
  id: string;
  messageId: string;
  threadId: string;
  taskNotificationId: string;
  mentionedUserId: string;
  mentionedByUserId: string;
  mentionedByName: string;
  read: boolean;
  createdAt: Timestamp;
}

// ============================================================================
// MANUAL TASK TYPES (User-created tasks for team task tracking)
// ============================================================================

/**
 * Manual Task Status
 */
export type ManualTaskStatus = 'todo' | 'in_progress' | 'done' | 'cancelled';

/**
 * Manual Task Priority
 */
export type ManualTaskPriority = 'LOW' | 'MEDIUM' | 'HIGH' | 'URGENT';

/**
 * Manual Task
 * User-created task for team task tracking (separate from system notifications)
 */
export interface ManualTask {
  id: string;
  title: string;
  description?: string;
  createdBy: string;
  createdByName: string;
  assigneeId: string;
  assigneeName: string;
  status: ManualTaskStatus;
  priority: ManualTaskPriority;
  dueDate?: Timestamp;
  completedAt?: Timestamp;
  projectId?: string;
  projectName?: string;
  proposalId?: string;
  meetingId?: string;
  tags?: string[];
  entityId: string;
  createdAt: Timestamp;
  updatedAt?: Timestamp;
}

/**
 * Create Manual Task Input
 */
export interface CreateManualTaskInput {
  title: string;
  description?: string;
  assigneeId: string;
  assigneeName: string;
  priority?: ManualTaskPriority;
  dueDate?: Timestamp;
  projectId?: string;
  projectName?: string;
  proposalId?: string;
  meetingId?: string;
  tags?: string[];
}

/**
 * Manual Task Filters
 */
export interface ManualTaskFilters {
  assigneeId?: string;
  status?: ManualTaskStatus;
  priority?: ManualTaskPriority;
  projectId?: string;
  meetingId?: string;
  limit?: number;
}

// ============================================================================
// MEETING TYPES (Minutes of Meeting with action items)
// ============================================================================

/**
 * Meeting Status
 */
export type MeetingStatus = 'draft' | 'finalized';

/**
 * Meeting
 * Minutes of meeting record with attendees, notes, and action items
 */
export interface Meeting {
  id: string;
  title: string;
  date: Timestamp;
  duration?: number;
  location?: string;
  createdBy: string;
  createdByName: string;
  attendeeIds: string[];
  attendeeNames: string[];
  agenda?: string;
  notes?: string;
  status: MeetingStatus;
  finalizedAt?: Timestamp;
  projectId?: string;
  projectName?: string;
  entityId: string;
  createdAt: Timestamp;
  updatedAt?: Timestamp;
}

/**
 * Meeting Action Item
 * Row from the MoM table — becomes a ManualTask on finalization
 */
export interface MeetingActionItem {
  id: string;
  meetingId: string;
  description: string;
  action: string;
  assigneeId: string;
  assigneeName: string;
  dueDate?: Timestamp;
  priority: ManualTaskPriority;
  generatedTaskId?: string;
  createdAt: Timestamp;
}

/**
 * Create Meeting Input
 */
export interface CreateMeetingInput {
  title: string;
  date: Timestamp;
  duration?: number;
  location?: string;
  attendeeIds: string[];
  attendeeNames: string[];
  agenda?: string;
  notes?: string;
  projectId?: string;
  projectName?: string;
}

/**
 * Meeting Action Item Input (for creating action items in the MoM table)
 */
export interface MeetingActionItemInput {
  description: string;
  action: string;
  assigneeId: string;
  assigneeName: string;
  dueDate?: Timestamp;
  priority?: ManualTaskPriority;
}
