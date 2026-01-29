/**
 * Procurement Notification Type Definitions
 *
 * Types for in-app notifications in procurement workflow.
 */

import type { Timestamp } from 'firebase/firestore';

// ============================================================================
// NOTIFICATION TYPES (In-App Only)
// ============================================================================

export type ProcurementNotificationType =
  | 'PR_CREATED'
  | 'PR_SUBMITTED'
  | 'PR_APPROVED'
  | 'PR_REJECTED'
  | 'PR_COMMENTED'
  | 'RFQ_CREATED'
  | 'RFQ_REVISED'
  | 'OFFER_UPLOADED'
  | 'OFFER_EVALUATED'
  | 'PO_CREATED'
  | 'PO_PENDING_APPROVAL'
  | 'PO_APPROVED'
  | 'PO_REJECTED'
  | 'PO_ISSUED'
  | 'OA_RECEIVED'
  | 'PACKING_LIST_CREATED'
  | 'GOODS_SHIPPED'
  | 'GOODS_RECEIVED'
  | 'PAYMENT_REQUESTED'
  | 'PAYMENT_APPROVED'
  | 'WCC_ISSUED';

export interface ProcurementNotification {
  id: string;
  type: ProcurementNotificationType;

  // Target user
  userId: string;

  // Message
  title: string;
  message: string;

  // Link to entity
  entityType: string; // 'PURCHASE_REQUEST', 'RFQ', 'OFFER', 'PO', etc.
  entityId: string;
  linkUrl: string; // Where to navigate when clicked

  // Status
  read: boolean;
  readAt?: Timestamp;

  // Priority
  priority: 'LOW' | 'MEDIUM' | 'HIGH' | 'URGENT';

  // Metadata
  metadata?: Record<string, any>;

  // Timestamps
  createdAt: Timestamp;
}
