/**
 * Purchase Request Type Definitions
 *
 * All type definitions and interfaces for Purchase Request operations
 */

import type {
  PurchaseRequestRaisedFor,
  PurchaseRequestCategory,
  PurchaseRequestStatus,
  CatalogRef,
} from '@vapour/types';

export interface CreatePurchaseRequestInput {
  // Multi-tenancy
  tenantId?: string;

  // Classification
  raisedFor: PurchaseRequestRaisedFor;
  category: PurchaseRequestCategory;
  /** Pricing-only request — the resulting RFQ can never become a PO. */
  isBudgetary?: boolean;

  // Linkage — the service requires the triple matching `raisedFor`
  projectId?: string;
  projectName?: string;
  proposalId?: string;
  proposalNumber?: string;
  costCentreId?: string;
  costCentreCode?: string;

  // Header
  title: string;
  description: string;
  requiredBy?: Date;

  // Approval workflow
  approverId?: string;
  approverName?: string;

  // Bulk upload tracking
  isBulkUpload?: boolean;
  bulkUploadFileUrl?: string;

  // Line items
  items: CreatePurchaseRequestItemInput[];
}

export interface CreatePurchaseRequestItemInput {
  // No itemType here — a line inherits the PR's `category`, which the service
  // stamps onto every item via catalogKindToItemType().

  /**
   * Unified catalog linkage (Phase 2 facade — design 2026-06-15 §3.1).
   * Written alongside the legacy per-kind id fields, which stay for
   * back-compat until every consumer reads catalogRef.
   */
  catalogRef?: CatalogRef;

  // Item details
  description: string;
  specification?: string;

  // Quantity
  quantity: number;
  unit: string;

  // Material linkage (for MATERIAL items)
  materialId?: string;
  materialCode?: string;
  materialName?: string;

  // Bought-out linkage (for BOUGHT_OUT items) — separate bought_out_items collection
  boughtOutItemId?: string;
  boughtOutItemCode?: string;
  boughtOutItemName?: string;

  // Service linkage (for SERVICE items)
  serviceId?: string;
  serviceCode?: string;
  serviceName?: string;
  serviceCategory?: string;
  turnaroundDays?: number;
  testMethodStandard?: string;
  sampleRequirements?: string;

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

/**
 * Strip every catalog link from a line, keeping what the user typed.
 *
 * Used whenever the PR's category changes: a request is for one kind only, so
 * a material reference cannot survive a switch to bought-out. Shared by the
 * New and Edit forms so the two cannot drift (rule 32).
 */
export function clearCatalogLinks(
  item: CreatePurchaseRequestItemInput
): CreatePurchaseRequestItemInput {
  return {
    ...item,
    catalogRef: undefined,
    materialId: undefined,
    materialCode: undefined,
    materialName: undefined,
    boughtOutItemId: undefined,
    boughtOutItemCode: undefined,
    boughtOutItemName: undefined,
    serviceId: undefined,
    serviceCode: undefined,
    serviceName: undefined,
    serviceCategory: undefined,
    turnaroundDays: undefined,
    testMethodStandard: undefined,
    sampleRequirements: undefined,
  };
}

export interface UpdatePurchaseRequestInput {
  title?: string;
  description?: string;
  requiredBy?: Date;
}

export interface ListPurchaseRequestsFilters {
  tenantId?: string;
  projectId?: string;
  raisedFor?: PurchaseRequestRaisedFor;
  isBudgetary?: boolean;
  category?: PurchaseRequestCategory;
  status?: PurchaseRequestStatus;
  createdBy?: string;
  /** Maximum number of results to return. Default: 50. Max: 100. */
  limit?: number;
  /** Cursor for pagination - pass lastDocId from previous response */
  afterId?: string;
}

export interface PaginatedPurchaseRequestsResult {
  items: import('@vapour/types').PurchaseRequest[];
  /** ID of the last document - use as afterId for next page */
  lastDocId: string | null;
  /** True if there are more results after this page */
  hasMore: boolean;
}
