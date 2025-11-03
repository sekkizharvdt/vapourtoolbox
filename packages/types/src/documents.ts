/**
 * Document Management System Type Definitions
 *
 * Lightweight DMS for tracking all documents across modules
 * with project/equipment linking and version control
 */

import type { Timestamp } from 'firebase/firestore';

// ============================================================================
// MODULE AND DOCUMENT TYPES
// ============================================================================

export type DocumentModule =
  | 'PROCUREMENT'
  | 'ACCOUNTING'
  | 'PROJECTS'
  | 'ESTIMATION'
  | 'TIME_TRACKING'
  | 'GENERAL';

export type ProcurementDocumentType =
  | 'PR_CATALOGUE'
  | 'PR_DRAWING'
  | 'PR_SPECIFICATION'
  | 'PR_EXCEL_UPLOAD'
  | 'RFQ_PDF'
  | 'VENDOR_OFFER'
  | 'OFFER_SUPPORTING_DOC'
  | 'PO_PDF'
  | 'OA_FORM'
  | 'VENDOR_SIGNED_OA'
  | 'PACKING_LIST_PDF'
  | 'PACKING_INSTRUCTIONS'
  | 'RECEIPT_PHOTO'
  | 'TEST_CERTIFICATE'
  | 'QUALITY_REPORT'
  | 'WCC_PDF';

export type AccountingDocumentType =
  | 'INVOICE'
  | 'BILL'
  | 'PAYMENT_RECEIPT'
  | 'BANK_STATEMENT'
  | 'TAX_CERTIFICATE'
  | 'FINANCIAL_REPORT';

export type ProjectDocumentType =
  | 'PROJECT_PLAN'
  | 'TECHNICAL_DRAWING'
  | 'SPECIFICATION'
  | 'CONTRACT'
  | 'PROGRESS_REPORT'
  | 'MEETING_MINUTES';

export type EstimationDocumentType = 'BOQ' | 'COST_ESTIMATE' | 'PROPOSAL' | 'CLIENT_RFQ';

export type DocumentType =
  | ProcurementDocumentType
  | AccountingDocumentType
  | ProjectDocumentType
  | EstimationDocumentType
  | 'OTHER';

export type DocumentStatus = 'ACTIVE' | 'SUPERSEDED' | 'ARCHIVED' | 'DELETED';

// ============================================================================
// ENTITY TYPES (What the document is linked to)
// ============================================================================

export type DocumentEntityType =
  // Procurement entities
  | 'PURCHASE_REQUEST'
  | 'RFQ'
  | 'OFFER'
  | 'PURCHASE_ORDER'
  | 'PACKING_LIST'
  | 'GOODS_RECEIPT'
  | 'WORK_COMPLETION_CERTIFICATE'
  // Accounting entities
  | 'INVOICE'
  | 'BILL'
  | 'PAYMENT'
  | 'JOURNAL_ENTRY'
  // Project entities
  | 'PROJECT'
  | 'EQUIPMENT'
  | 'MILESTONE'
  // Estimation entities
  | 'ESTIMATE'
  | 'BOQ'
  // General
  | 'VENDOR'
  | 'CUSTOMER'
  | 'OTHER';

// ============================================================================
// MAIN DOCUMENT RECORD
// ============================================================================

export interface DocumentRecord {
  id: string;

  // File information
  fileName: string;
  fileUrl: string; // Firebase Storage URL
  storageRef: string; // Full storage path (e.g., /documents/{projectId}/...)
  fileSize: number; // Bytes
  mimeType: string; // e.g., 'application/pdf', 'image/jpeg'
  fileExtension: string; // e.g., 'pdf', 'jpg'

  // Categorization
  module: DocumentModule;
  documentType: DocumentType;

  // Multi-level linking
  projectId?: string;
  projectName?: string; // Denormalized
  projectCode?: string; // Denormalized

  equipmentId?: string; // Specific equipment/item in project
  equipmentCode?: string; // Denormalized
  equipmentName?: string; // Denormalized

  // Primary entity linkage
  entityType: DocumentEntityType;
  entityId: string; // ID of the PR, RFQ, PO, etc.
  entityNumber?: string; // Denormalized (PR-001, RFQ-001, etc.)

  // Version control
  version: number; // 1, 2, 3...
  isLatest: boolean; // true for current version, false for historical
  previousVersionId?: string; // Link to previous version
  nextVersionId?: string; // Link to newer version (if superseded)
  revisionNotes?: string; // Why this version was created

  // Metadata
  title?: string; // Human-readable title
  description?: string; // Description of the document
  tags: string[]; // ['critical', 'technical', 'vendor-xyz']

  // Organization
  folder?: string; // Virtual folder path (e.g., 'procurement/rfqs/2025')

  // Status
  status: DocumentStatus;

  // Access control (basic)
  visibility: 'PUBLIC' | 'PROJECT_TEAM' | 'RESTRICTED'; // For future use
  restrictedTo?: string[]; // User IDs who can access (if RESTRICTED)

  // Download tracking
  downloadCount: number;
  lastDownloadedAt?: Timestamp;
  lastDownloadedBy?: string;

  // Workflow
  uploadedBy: string;
  uploadedByName: string; // Denormalized
  uploadedAt: Timestamp;

  // Supersession tracking
  supersededBy?: string; // User who uploaded newer version
  supersededAt?: Timestamp;

  // Soft delete
  deletedBy?: string;
  deletedAt?: Timestamp;
  deletionReason?: string;

  // Timestamps
  createdAt: Timestamp;
  updatedAt: Timestamp;
}

// ============================================================================
// DOCUMENT UPLOAD REQUEST
// ============================================================================

export interface DocumentUploadRequest {
  // File (will be handled by the service)
  file: File;

  // Categorization
  module: DocumentModule;
  documentType: DocumentType;

  // Linking
  projectId?: string;
  equipmentId?: string;
  entityType: DocumentEntityType;
  entityId: string;

  // Metadata
  title?: string;
  description?: string;
  tags?: string[];
  folder?: string;

  // Version control (if creating new version)
  isNewVersion?: boolean;
  previousVersionId?: string;
  revisionNotes?: string;
}

// ============================================================================
// DOCUMENT SEARCH/FILTER
// ============================================================================

export interface DocumentSearchFilters {
  // Module/type filters
  module?: DocumentModule;
  documentType?: DocumentType;
  entityType?: DocumentEntityType;

  // Linkage filters
  projectId?: string;
  equipmentId?: string;
  entityId?: string;

  // Text search
  searchText?: string; // Search in fileName, title, description, tags

  // Tag filter
  tags?: string[];

  // Date range
  uploadedAfter?: Date;
  uploadedBefore?: Date;

  // Version filter
  onlyLatest?: boolean; // If true, only show latest versions

  // Status filter
  status?: DocumentStatus;

  // Uploader filter
  uploadedBy?: string;

  // Pagination
  limit?: number;
  offset?: number;
  orderBy?: 'uploadedAt' | 'fileName' | 'fileSize';
  orderDirection?: 'asc' | 'desc';
}

export interface DocumentSearchResult {
  documents: DocumentRecord[];
  totalCount: number;
  hasMore: boolean;
}

// ============================================================================
// DOCUMENT STATS
// ============================================================================

export interface DocumentStats {
  // Counts by module
  byModule: Record<DocumentModule, number>;

  // Counts by type
  byType: Record<string, number>;

  // Counts by project
  byProject: { projectId: string; projectName: string; count: number }[];

  // Total stats
  totalDocuments: number;
  totalSize: number; // Bytes
  totalDownloads: number;

  // Recent activity
  recentUploads: DocumentRecord[]; // Last 10 uploads
}

// ============================================================================
// DOCUMENT VERSION HISTORY
// ============================================================================

export interface DocumentVersionHistory {
  documentId: string;
  currentVersion: DocumentRecord;
  allVersions: DocumentRecord[]; // Sorted by version number descending
  totalVersions: number;
}

// ============================================================================
// EQUIPMENT DOCUMENT SUMMARY
// ============================================================================

/**
 * Summary of all documents for a specific equipment/item in a project
 * Used for the "complete document trail" view
 */
export interface EquipmentDocumentSummary {
  projectId: string;
  projectName: string;
  equipmentId: string;
  equipmentCode: string;
  equipmentName: string;

  // Document counts by phase
  purchaseRequestDocs: number;
  rfqDocs: number;
  offerDocs: number;
  purchaseOrderDocs: number;
  packingListDocs: number;
  receiptDocs: number;
  completionDocs: number;

  // Total
  totalDocuments: number;

  // All documents (sorted chronologically)
  documents: DocumentRecord[];

  // Timeline
  firstDocumentDate?: Timestamp;
  lastDocumentDate?: Timestamp;
}

// ============================================================================
// DOCUMENT ACTIVITY LOG
// ============================================================================

export type DocumentActivityType =
  | 'UPLOADED'
  | 'DOWNLOADED'
  | 'VIEWED'
  | 'UPDATED'
  | 'DELETED'
  | 'RESTORED'
  | 'VERSION_CREATED';

export interface DocumentActivity {
  id: string;
  documentId: string;

  activityType: DocumentActivityType;

  userId: string;
  userName: string; // Denormalized

  details?: string;
  metadata?: Record<string, any>;

  timestamp: Timestamp;
}
