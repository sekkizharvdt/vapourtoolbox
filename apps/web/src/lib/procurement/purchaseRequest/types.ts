/**
 * Purchase Request Type Definitions
 *
 * All type definitions and interfaces for Purchase Request operations
 */

import type {
  PurchaseRequestType,
  PurchaseRequestCategory,
  PurchaseRequestStatus,
} from '@vapour/types';

export interface CreatePurchaseRequestInput {
  // Classification
  type: PurchaseRequestType;
  category: PurchaseRequestCategory;

  // Project linkage
  projectId: string;
  projectName: string;

  // Header
  title: string;
  description: string;
  priority?: 'LOW' | 'MEDIUM' | 'HIGH' | 'URGENT';
  requiredBy?: Date;

  // Bulk upload tracking
  isBulkUpload?: boolean;
  bulkUploadFileUrl?: string;

  // Line items
  items: CreatePurchaseRequestItemInput[];
}

export interface CreatePurchaseRequestItemInput {
  // Item details
  description: string;
  specification?: string;

  // Quantity
  quantity: number;
  unit: string;

  // Material linkage
  materialId?: string;
  materialCode?: string;
  materialName?: string;

  // Equipment linkage
  equipmentId?: string;
  equipmentCode?: string;
  equipmentName?: string;

  // Estimated cost
  estimatedUnitCost?: number;

  // Technical requirements
  technicalSpec?: string;
  drawingNumbers?: string[];
  makeModel?: string;

  // Delivery
  requiredBy?: Date;
  deliveryLocation?: string;
}

export interface UpdatePurchaseRequestInput {
  title?: string;
  description?: string;
  priority?: 'LOW' | 'MEDIUM' | 'HIGH' | 'URGENT';
  requiredBy?: Date;
}

export interface ListPurchaseRequestsFilters {
  projectId?: string;
  type?: PurchaseRequestType;
  category?: PurchaseRequestCategory;
  status?: PurchaseRequestStatus;
  createdBy?: string;
  priority?: 'LOW' | 'MEDIUM' | 'HIGH' | 'URGENT';
  limit?: number;
}
