// In-App Notification Types

import { Timestamp } from './common';

/**
 * Notification type categories
 */
export type NotificationType =
  | 'user_approved'           // User account approved by admin
  | 'user_role_changed'       // User role updated
  | 'user_permissions_updated' // User permissions changed
  | 'project_assigned'        // User assigned to project
  | 'project_unassigned'      // User removed from project
  | 'user_status_changed'     // User status changed (active/inactive)
  | 'system_announcement';    // System-wide announcement

/**
 * Notification priority levels
 */
export type NotificationPriority = 'low' | 'medium' | 'high';

/**
 * Notification status
 */
export type NotificationStatus = 'unread' | 'read' | 'archived';

/**
 * Base notification interface
 */
export interface Notification {
  id: string;
  userId: string;              // Recipient user ID
  type: NotificationType;
  priority: NotificationPriority;
  status: NotificationStatus;

  // Content
  title: string;
  message: string;
  icon?: string;               // Material UI icon name (optional)

  // Action (optional - for clickable notifications)
  actionUrl?: string;          // URL to navigate to when clicked
  actionLabel?: string;        // Label for action button

  // Metadata
  createdBy?: string;          // Who triggered the notification (system if undefined)
  createdAt: Timestamp;
  readAt?: Timestamp;
  archivedAt?: Timestamp;

  // Related entities (for context)
  relatedProjectId?: string;
  relatedUserId?: string;
  relatedEntityId?: string;
}

/**
 * Notification creation input
 */
export interface CreateNotificationInput {
  userId: string;
  type: NotificationType;
  priority?: NotificationPriority;
  title: string;
  message: string;
  icon?: string;
  actionUrl?: string;
  actionLabel?: string;
  createdBy?: string;
  relatedProjectId?: string;
  relatedUserId?: string;
  relatedEntityId?: string;
}

/**
 * Notification update input
 */
export interface UpdateNotificationInput {
  status?: NotificationStatus;
  readAt?: Timestamp;
  archivedAt?: Timestamp;
}

/**
 * Notification filter options
 */
export interface NotificationFilters {
  status?: NotificationStatus | NotificationStatus[];
  type?: NotificationType | NotificationType[];
  priority?: NotificationPriority | NotificationPriority[];
  unreadOnly?: boolean;
  limit?: number;
  startAfter?: string; // For pagination
}

/**
 * Notification count summary
 */
export interface NotificationCounts {
  total: number;
  unread: number;
  high: number;     // High priority unread
  medium: number;   // Medium priority unread
  low: number;      // Low priority unread
}
