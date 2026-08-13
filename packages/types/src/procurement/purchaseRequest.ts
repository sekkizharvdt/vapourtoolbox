/**
 * Purchase Request Type Definitions
 *
 * Types for the initial request phase of procurement workflow.
 */

import type { Timestamp } from 'firebase/firestore';
import type { CatalogRef } from '../catalog';

// ============================================================================
// PURCHASE REQUEST TYPES
// ============================================================================

/**
 * What the request is raised for — drives which linkage the form asks for.
 *
 * Replaces the old `PurchaseRequestType` ('PROJECT' | 'BUDGETARY' | 'INTERNAL'),
 * which jammed two independent questions into one field: what the PR is for,
 * and whether it is a firm order or a price check. A budgetary quote for a
 * project could not say "project", so all nine budgetary PRs in the system
 * lost their project link. Budgetary is now `isBudgetary`, orthogonal to this.
 */
export type PurchaseRequestRaisedFor = 'PROJECT' | 'PROPOSAL' | 'INTERNAL';

/**
 * The one kind of thing a PR is for. A PR carries raw materials OR bought-out
 * items OR services, never a mix: a pump vendor quotes pumps, so a mixed PR
 * could never go out as a single RFQ. Every line item inherits this — items
 * have no per-line type question.
 *
 * Structurally identical to `CatalogKind`, so `catalogKindToItemType(category)`
 * is the canonical way to derive a line's `itemType`. Do not write a second
 * mapping helper.
 */
export type PurchaseRequestCategory = 'SERVICE' | 'RAW_MATERIAL' | 'BOUGHT_OUT';
export type PurchaseRequestStatus =
  | 'DRAFT'
  | 'SUBMITTED'
  | 'UNDER_REVIEW'
  | 'APPROVED'
  | 'REJECTED'
  | 'CONVERTED_TO_RFQ';

export interface PurchaseRequest {
  id: string;
  number: string; // PR/YYYY/XXXX

  // Multi-tenancy
  tenantId?: string;

  // Classification
  raisedFor: PurchaseRequestRaisedFor;
  category: PurchaseRequestCategory;

  /**
   * Pricing-only request: quotations may be collected, but the resulting RFQ
   * can never become a purchase order (`requireNonBudgetaryRFQ`). Independent
   * of `raisedFor` — a budgetary quote for a live project is the common case.
   */
  isBudgetary: boolean;

  // Linkage — exactly one of these triples is set, per `raisedFor`.
  // PROJECT: project ids. PROPOSAL: proposal ids. INTERNAL: the CC-ADMIN
  // cost centre, assigned automatically rather than asked for.
  projectId?: string;
  projectName?: string; // Denormalized
  proposalId?: string;
  proposalNumber?: string; // Denormalized
  costCentreId?: string;
  costCentreCode?: string; // Denormalized

  // Header information
  title: string;
  description: string;
  requiredBy?: Timestamp; // Target delivery date

  // Line items
  itemCount: number; // Denormalized count

  // Bulk upload tracking
  isBulkUpload: boolean;
  bulkUploadFileUrl?: string;

  // Workflow
  status: PurchaseRequestStatus;

  // Approval
  submittedBy: string;
  submittedByName: string; // Denormalized
  submittedAt?: Timestamp;

  // Selected approver (optional - if specified, creates task notification)
  approverId?: string;
  approverName?: string; // Denormalized

  reviewedBy?: string;
  reviewedByName?: string; // Denormalized
  reviewedAt?: Timestamp;
  reviewComments?: string;

  approvedBy?: string;
  approvedByName?: string; // Denormalized
  approvedAt?: Timestamp;
  approvalComments?: string;

  rejectionReason?: string;

  // Timestamps
  createdAt: Timestamp;
  updatedAt: Timestamp;
  createdBy: string;
  updatedBy: string;
}

export type PurchaseRequestItemType = 'MATERIAL' | 'BOUGHT_OUT' | 'SERVICE';

/**
 * A quantity change made downstream, recorded back on the PR line.
 *
 * A PR is terminal once converted to an RFQ, so it is never reopened — but the
 * engineer who raised it should still be able to see what was actually ordered
 * against their line, and why (feedback MesC9vYA). Append-only: a second change
 * adds an entry rather than overwriting the first.
 */
export interface PurchaseRequestItemQuantityChange {
  /** Where the change happened, e.g. "PO/2026/010". */
  documentNumber: string;
  documentId: string;
  previousQuantity: number;
  newQuantity: number;
  reason: string;
  changedByName: string;
  changedAt: Timestamp;
}

export interface PurchaseRequestItem {
  id: string;
  purchaseRequestId: string;

  /** Downstream quantity changes, newest last. Absent until one occurs. */
  quantityChanges?: PurchaseRequestItemQuantityChange[];

  /**
   * Item kind, stamped from the parent PR's `category` at save — never asked
   * per line, since a PR carries one kind only. Still persisted because the
   * RFQ vendor suggestion (`vendorCategoryMatch`), PO line creation, quote
   * comparison and material pricing all read it. Optional only because items
   * created before the field existed do not carry it.
   */
  itemType?: PurchaseRequestItemType;

  /**
   * Unified catalog linkage (Phase 2 facade — design 2026-06-15 §3.1).
   * Written alongside the legacy per-kind id fields below; those stay
   * readable for back-compat until every consumer reads catalogRef.
   */
  catalogRef?: CatalogRef;

  // Item details
  lineNumber: number;
  description: string;
  specification?: string;

  // Quantity
  quantity: number;
  unit: string; // e.g., 'pcs', 'kg', 'meter', 'per test', 'per day'

  // Material database linkage (optional — for MATERIAL items)
  materialId?: string;
  materialCode?: string;
  materialName?: string;

  // Bought-out database linkage (optional — for BOUGHT_OUT items).
  // Mirrors the boughtOutItemId convention used by the vendor-quote module
  // (vendorQuote.ts) so the two procurement flows reference bought-out items
  // the same way. Distinct collection from materials (bought_out_items).
  boughtOutItemId?: string;
  boughtOutItemCode?: string;
  boughtOutItemName?: string;

  // Service catalog linkage (optional — for SERVICE items)
  serviceId?: string;
  serviceCode?: string;
  serviceName?: string;
  serviceCategory?: string;
  turnaroundDays?: number;
  testMethodStandard?: string;
  sampleRequirements?: string;

  // Equipment linkage (optional)
  equipmentId?: string;
  equipmentCode?: string;
  equipmentName?: string;

  // Estimated cost
  estimatedUnitCost?: number;
  estimatedTotalCost?: number;

  // Technical requirements
  technicalSpec?: string;
  drawingNumbers?: string[];
  makeModel?: string;

  // Delivery
  requiredBy?: Timestamp;
  deliveryLocation?: string;

  // Documents attached to this item
  attachmentCount: number;

  // Status
  status: 'PENDING' | 'APPROVED' | 'REJECTED' | 'CONVERTED';
  comments?: string;

  // Timestamps
  createdAt: Timestamp;
  updatedAt: Timestamp;
}

// ============================================================================
// PURCHASE REQUEST ATTACHMENT TYPES
// ============================================================================

/**
 * Attachment type for Purchase Request documents
 */
export type PurchaseRequestAttachmentType =
  | 'TDS' // Technical Data Sheet
  | 'TECHNICAL_SPEC' // Technical Specification
  | 'DATASHEET' // Manufacturer Data Sheet
  | 'DRAWING' // Engineering Drawing
  | 'CERTIFICATE' // Quality/Test Certificate
  | 'OTHER'; // Other documents

/**
 * Labels for attachment types
 */
export const PR_ATTACHMENT_TYPE_LABELS: Record<PurchaseRequestAttachmentType, string> = {
  TDS: 'Technical Data Sheet',
  TECHNICAL_SPEC: 'Technical Specification',
  DATASHEET: 'Manufacturer Data Sheet',
  DRAWING: 'Engineering Drawing',
  CERTIFICATE: 'Quality/Test Certificate',
  OTHER: 'Other Document',
};

/**
 * Attachment document for a Purchase Request
 *
 * Attachments can be at PR level (general documents) or linked to specific line items.
 * These attachments are carried forward to RFQs when the PR is converted.
 */
export interface PurchaseRequestAttachment {
  id: string;

  // Parent reference
  purchaseRequestId: string;
  purchaseRequestItemId?: string; // Optional: if linked to specific line item

  // File details
  fileName: string;
  fileUrl: string; // gs:// URL
  storagePath: string; // Full path in Storage
  fileSize: number; // Bytes
  mimeType: string;

  // Classification
  attachmentType: PurchaseRequestAttachmentType;
  description?: string; // Optional description/notes

  // Metadata
  uploadedBy: string;
  uploadedByName: string;
  uploadedAt: Timestamp;
}
