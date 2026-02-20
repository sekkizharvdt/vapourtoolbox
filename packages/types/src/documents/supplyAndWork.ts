/**
 * Document Management - Supply List & Work List Types
 *
 * Supply items (feed to procurement) and work items (feed to task notifications)
 */

import type { Timestamp } from 'firebase/firestore';
import type { DocumentReference } from './core';

// ============================================================================
// SUPPLY LIST SYSTEM (Feeds to Procurement)
// ============================================================================

/**
 * Supply Item Type
 */
export type SupplyItemType = 'RAW_MATERIAL' | 'BOUGHT_OUT_ITEM' | 'SERVICE';

/**
 * Procurement Status for Supply Items
 */
export type SupplyProcurementStatus =
  | 'NOT_INITIATED'
  | 'PR_CREATED'
  | 'RFQ_ISSUED'
  | 'PO_PLACED'
  | 'DELIVERED'
  | 'COMPLETED'
  | 'CANCELLED';

/**
 * Supply Item linked to a Master Document
 * Used to generate Purchase Requests
 */
export interface SupplyItem {
  id: string;
  projectId: string;
  masterDocumentId: string;
  documentNumber: string; // Denormalized

  // Item Details
  itemName: string;
  description: string;
  itemType: SupplyItemType;

  // Specifications
  specification: string;
  drawingReference?: string;
  materialGrade?: string;

  // Quantity
  quantity: number;
  unit: string; // "EA", "KG", "MTR", "SET", etc.

  // Estimated Cost
  estimatedUnitCost?: number;
  estimatedTotalCost?: number;
  currency: string; // "INR", "USD", etc.

  // Delivery Requirements
  requiredByDate?: Timestamp;
  deliveryLocation?: string;

  // Procurement Linkage
  linkedPurchaseRequestId?: string;
  linkedPurchaseRequestNumber?: string;
  linkedRFQId?: string;
  linkedPOId?: string;

  procurementStatus: SupplyProcurementStatus;

  // Vendor Preference (optional)
  preferredVendorId?: string;
  preferredVendorName?: string;

  // Tags
  tags: string[];

  // Notes
  notes?: string;

  // Audit
  createdBy: string;
  createdByName: string;
  createdAt: Timestamp;
  updatedAt: Timestamp;

  isDeleted: boolean;
}

// ============================================================================
// WORK LIST SYSTEM (Feeds to Task Notifications)
// ============================================================================

/**
 * Work Activity Type
 */
export type WorkActivityType =
  | 'INSPECTION'
  | 'TRANSPORTATION'
  | 'FABRICATION'
  | 'ROLLING'
  | 'WELDING'
  | 'TESTING'
  | 'ASSEMBLY'
  | 'MACHINING'
  | 'PAINTING'
  | 'DOCUMENTATION'
  | 'REVIEW'
  | 'OTHER';

/**
 * Work Item Status
 */
export type WorkItemStatus = 'PENDING' | 'IN_PROGRESS' | 'COMPLETED' | 'CANCELLED';

/**
 * Work Item linked to a Master Document
 * Creates Task Notifications when assigned
 */
export interface WorkItem {
  id: string;
  projectId: string;
  masterDocumentId: string;
  documentNumber: string; // Denormalized

  // Activity Details
  activityName: string;
  activityType: WorkActivityType;
  description: string;

  // Assignment
  assignedTo?: string;
  assignedToName?: string;
  assignedBy?: string;
  assignedAt?: Timestamp;

  // Deadlines
  plannedStartDate?: Timestamp;
  dueDate?: Timestamp;

  // Status
  status: WorkItemStatus;

  // Task Integration
  linkedTaskId?: string; // Link to TaskNotification
  taskCreated: boolean;
  taskCreatedAt?: Timestamp;

  // Time Tracking
  estimatedHours?: number;
  actualHours?: number;

  // Dependencies
  dependsOnWorkItems?: string[]; // IDs of prerequisite work items

  // Location
  workLocation?: string; // "Workshop", "Site", "Office", etc.

  // Notes
  notes?: string;

  // Completion
  completedBy?: string;
  completedByName?: string;
  completedAt?: Timestamp;
  completionNotes?: string;

  // Attachments (photos, reports)
  attachments: DocumentReference[];

  // Audit
  createdBy: string;
  createdByName: string;
  createdAt: Timestamp;
  updatedAt: Timestamp;

  isDeleted: boolean;
}
