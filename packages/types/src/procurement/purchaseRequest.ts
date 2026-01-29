/**
 * Purchase Request Type Definitions
 *
 * Types for the initial request phase of procurement workflow.
 */

import type { Timestamp } from 'firebase/firestore';

// ============================================================================
// PURCHASE REQUEST TYPES
// ============================================================================

export type PurchaseRequestType = 'PROJECT' | 'BUDGETARY' | 'INTERNAL';
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
  number: string; // PR/YYYY/MM/XXXX

  // Classification
  type: PurchaseRequestType;
  category: PurchaseRequestCategory;

  // Project linkage (required only for type='PROJECT')
  projectId?: string;
  projectName?: string; // Denormalized

  // Header information
  title: string;
  description: string;
  priority: 'LOW' | 'MEDIUM' | 'HIGH' | 'URGENT';
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

export interface PurchaseRequestItem {
  id: string;
  purchaseRequestId: string;

  // Item details
  lineNumber: number;
  description: string;
  specification?: string;

  // Quantity
  quantity: number;
  unit: string; // e.g., 'pcs', 'kg', 'meter'

  // Material database linkage (optional)
  materialId?: string;
  materialCode?: string;
  materialName?: string;

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
