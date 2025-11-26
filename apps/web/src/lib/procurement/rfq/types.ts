/**
 * RFQ Service Types
 *
 * Type definitions for RFQ operations
 */

// Re-export from @vapour/types
export type { RFQ, RFQItem, RFQStatus } from '@vapour/types';

// Import RFQStatus for use in this file
import type { RFQStatus } from '@vapour/types';

/**
 * Input for creating a new RFQ
 */
export interface CreateRFQInput {
  // Source PRs
  purchaseRequestIds: string[];

  // Header
  title: string;
  description: string;

  // Vendors invited
  vendorIds: string[];
  vendorNames: string[];

  // Terms and conditions
  paymentTerms?: string;
  deliveryTerms?: string;
  warrantyTerms?: string;
  otherTerms?: string[];

  // Timeline
  dueDate: Date;
  validityPeriod?: number; // Days
}

/**
 * Input for creating RFQ items
 */
export interface CreateRFQItemInput {
  // Source PR item
  purchaseRequestId: string;
  purchaseRequestItemId: string;

  // Item details (from PR)
  description: string;
  specification?: string;
  quantity: number;
  unit: string;

  // Project and equipment
  projectId?: string;
  equipmentId?: string;
  equipmentCode?: string;

  // Technical requirements
  technicalSpec?: string;
  drawingNumbers?: string[];
  makeModel?: string;

  // Delivery requirements
  requiredBy?: Date;
  deliveryLocation?: string;

  // Item-specific conditions
  conditions?: string;
}

/**
 * Filters for listing RFQs
 */
export interface ListRFQsFilters {
  status?: RFQStatus;
  projectId?: string;
  vendorId?: string;
  createdBy?: string;
  limit?: number;
}

/**
 * Input for updating an RFQ
 */
export interface UpdateRFQInput {
  title?: string;
  description?: string;
  vendorIds?: string[];
  vendorNames?: string[];
  paymentTerms?: string;
  deliveryTerms?: string;
  warrantyTerms?: string;
  otherTerms?: string[];
  dueDate?: Date;
  validityPeriod?: number;
}
