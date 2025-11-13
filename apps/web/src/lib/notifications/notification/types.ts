/**
 * Notification Service Types
 *
 * Type definitions for in-app notifications
 */

import type { ProcurementNotificationType } from '@vapour/types';

/**
 * Input for creating a new notification
 */
export interface CreateNotificationInput {
  type: ProcurementNotificationType;
  userId: string; // Target user to notify
  title: string;
  message: string;
  entityType: string; // e.g., 'PURCHASE_REQUEST', 'RFQ', 'PURCHASE_ORDER'
  entityId: string;
  linkUrl: string; // Where to navigate when clicked
  priority?: 'LOW' | 'MEDIUM' | 'HIGH' | 'URGENT';
  metadata?: Record<string, unknown>;
}

/**
 * Filters for querying notifications
 */
export interface GetNotificationsFilters {
  userId: string;
  read?: boolean; // Filter by read/unread
  priority?: 'LOW' | 'MEDIUM' | 'HIGH' | 'URGENT';
  limit?: number;
}

// Re-export from @vapour/types
export type { ProcurementNotification, ProcurementNotificationType } from '@vapour/types';
