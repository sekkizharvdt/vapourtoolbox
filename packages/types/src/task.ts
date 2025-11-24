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
  | 'OFFER_UPLOADED' // Informational: Vendor offer received
  | 'PO_PENDING_APPROVAL' // Actionable: Approve/reject PO
  | 'PO_APPROVED' // Informational: Your PO was approved
  | 'PO_REJECTED' // Informational: Your PO was rejected
  | 'GOODS_RECEIVED' // Informational: Goods received for PO
  | 'PAYMENT_REQUESTED' // Actionable: Process payment
  | 'WCC_ISSUED' // Informational: Work completion certificate issued
  // General Tasks
  | 'TASK_ASSIGNED' // Actionable: Complete assigned task
  | 'TASK_TRANSFERRED' // Informational: Task transferred to you
  | 'TASK_DEADLINE_APPROACHING' // Informational: Task deadline soon
  | 'TASK_COMPLETED' // Informational: Task you assigned was completed
  // Accounting
  | 'INVOICE_APPROVAL_REQUIRED' // Actionable: Approve invoice
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
