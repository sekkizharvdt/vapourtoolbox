/**
 * Notification Service
 *
 * In-app notification management
 *
 * Refactored from notificationService.ts (477 lines) into modular structure:
 * - types.ts: Type definitions and interfaces
 * - crud.ts: CRUD operations (create, read, update)
 * - helpers.ts: Specific notification helper functions
 */

// Export types
export type {
  CreateNotificationInput,
  GetNotificationsFilters,
  ProcurementNotification,
  ProcurementNotificationType,
} from './types';

// Export CRUD operations
export {
  createNotification,
  getUserNotifications,
  getUnreadNotificationCount,
  markNotificationAsRead,
  markAllNotificationsAsRead,
} from './crud';

// Export helper functions
export {
  notifyPRSubmitted,
  notifyPRApproved,
  notifyPRRejected,
  notifyPRCommented,
  notifyRFQCreated,
  notifyOfferUploaded,
  notifyPOPendingApproval,
  notifyPOApproved,
  notifyPORejected,
  notifyGoodsReceived,
  notifyPaymentRequested,
  notifyWCCIssued,
} from './helpers';
