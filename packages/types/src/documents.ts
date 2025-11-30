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

// ============================================================================
// DOCUMENT MANAGEMENT MODULE - MASTER DOCUMENT LIST
// ============================================================================

/**
 * Document Numbering Configuration per Project
 * Format: {PROJECT_CODE}-{DISCIPLINE}-{SEQUENCE}
 * Example: PRJ-001-01-005
 */
export interface DocumentNumberingConfig {
  id: string;
  projectId: string;

  // Numbering format
  separator: string; // "-" (fixed per user decision)
  sequenceDigits: number; // 3 (fixed: 001, 002, 003...)

  // Disciplines defined for this project
  disciplines: DisciplineCode[];

  // Auto-increment tracking per discipline
  sequenceCounters: Record<string, number>; // { "01": 5, "02": 12, "00": 3 }

  // Audit
  createdBy: string;
  createdAt: Timestamp;
  updatedAt: Timestamp;
}

/**
 * Discipline Code Definition
 * Can be customized per project
 * Special: "00" for client input files with sub-codes
 */
export interface DisciplineCode {
  code: string; // "01", "02", "03", etc. ("00" for client inputs)
  name: string; // "Process", "Mechanical", "Structural", etc.
  description: string;

  // Sub-codes for discipline (especially for "00" client inputs)
  subCodes?: DisciplineSubCode[];

  isActive: boolean;
  sortOrder: number; // Display order

  // Audit
  createdBy: string;
  createdAt: Timestamp;
}

/**
 * Sub-codes for disciplines (e.g., under "00" for client inputs)
 */
export interface DisciplineSubCode {
  subCode: string; // "A", "B", "C" or "01", "02", etc.
  name: string; // "Process Data", "Equipment List"
  description: string;
  isActive: boolean;
}

/**
 * Master Document Status Workflow
 * From assignment to final client acceptance
 */
export type MasterDocumentStatus =
  | 'DRAFT' // Initial state - not yet started
  | 'IN_PROGRESS' // User working on it
  | 'SUBMITTED' // Submitted to client
  | 'UNDER_REVIEW' // Client reviewing or has comments to resolve
  | 'APPROVED' // Client approved
  | 'ACCEPTED' // Final acceptance - no further revisions
  | 'ON_HOLD' // Temporarily paused
  | 'CANCELLED'; // Cancelled/not required

// Legacy status mapping for backward compatibility
export const LEGACY_STATUS_MAP: Record<string, MasterDocumentStatus> = {
  NOT_STARTED: 'DRAFT',
  INTERNAL_REVIEW: 'IN_PROGRESS',
  PM_APPROVED: 'IN_PROGRESS',
  CLIENT_REVIEW: 'UNDER_REVIEW',
  COMMENTED: 'UNDER_REVIEW',
  COMMENT_RESOLUTION: 'UNDER_REVIEW',
  RESUBMITTED: 'SUBMITTED',
};

/**
 * Master Document Entry in the Project's Master Document List
 * Central record for tracking document lifecycle
 */
export interface MasterDocumentEntry {
  id: string;
  projectId: string;

  // Document Numbering
  documentNumber: string; // Full number: "PRJ-001-01-005"
  projectCode: string; // "PRJ-001"
  disciplineCode: string; // "01"
  disciplineName: string; // "Process"
  subCode?: string; // For "00" discipline
  sequenceNumber: string; // "005"

  // Document Info
  documentTitle: string; // "Heat & Material Balance"
  documentType: string; // "P&ID", "Datasheet", "Drawing", "Calculation"
  description: string;
  category?: string; // "Technical", "Commercial", "Quality"

  // Status Tracking
  status: MasterDocumentStatus;
  currentRevision: string; // "R0", "R1", "R2", etc.
  latestDocumentId?: string; // Link to latest DocumentRecord

  // Document Linking (Dependencies)
  predecessors: DocumentLink[]; // Must be completed before this starts
  successors: DocumentLink[]; // Can start after this is completed
  relatedDocuments: DocumentLink[]; // Related but not dependent

  // Assignment
  assignedTo: string[]; // User IDs (can be multiple collaborators)
  assignedToNames: string[]; // Denormalized for display
  assignedBy: string; // Project Manager
  assignedByName: string;
  assignedDate: Timestamp;

  // Deadlines
  plannedStartDate?: Timestamp;
  dueDate?: Timestamp;
  actualStartDate?: Timestamp;
  actualCompletionDate?: Timestamp;

  // Input Files (from PM to assignee)
  inputFiles: DocumentReference[]; // Reference docs, client inputs, templates

  // Supply List (feeds to procurement)
  hasSupplyList: boolean;
  supplyItemCount: number;

  // Work List (activities)
  hasWorkList: boolean;
  workItemCount: number;

  // Visibility & Access
  visibility: 'CLIENT_VISIBLE' | 'INTERNAL_ONLY';

  // Submission Tracking
  submissionCount: number; // Total submissions to client
  lastSubmissionId?: string;
  lastSubmissionDate?: Timestamp;

  // Comments Tracking
  totalComments: number;
  openComments: number;
  resolvedComments: number;

  // Progress
  progressPercentage: number; // 0-100

  // Priority
  priority: 'LOW' | 'MEDIUM' | 'HIGH' | 'URGENT';

  // Tags
  tags: string[];

  // Notes
  notes?: string; // Internal notes

  // Audit
  createdBy: string;
  createdByName: string;
  createdAt: Timestamp;
  updatedAt: Timestamp;

  // Soft delete
  isDeleted: boolean;
  deletedBy?: string;
  deletedAt?: Timestamp;
}

/**
 * Document Link (Predecessor/Successor/Related)
 */
export interface DocumentLink {
  masterDocumentId: string;
  documentNumber: string; // For display
  documentTitle: string;
  linkType: 'PREREQUISITE' | 'SUCCESSOR' | 'RELATED';
  status: MasterDocumentStatus;

  // Denormalized for quick access
  currentRevision?: string;
  assignedToNames?: string[];

  createdAt: Timestamp;
}

/**
 * Document Reference (for input files, attachments, etc.)
 */
export interface DocumentReference {
  documentId?: string; // Link to DocumentRecord (if uploaded)
  fileName: string;
  fileUrl?: string;
  fileSize?: number;
  description?: string;
  uploadedBy?: string;
  uploadedAt?: Timestamp;
}

// ============================================================================
// DOCUMENT SUBMISSION SYSTEM
// ============================================================================

/**
 * Client Response Status for Submissions
 */
export type ClientReviewStatus =
  | 'PENDING' // Waiting for client review
  | 'UNDER_REVIEW' // Client reviewing
  | 'APPROVED' // Client approved (no comments)
  | 'APPROVED_WITH_COMMENTS' // Approved but has minor comments
  | 'REJECTED' // Rejected, major rework needed
  | 'CONDITIONALLY_APPROVED'; // Approved pending minor changes

/**
 * File Type for submission attachments
 * NATIVE: Original editable file (DWG, DOCX, XLSX, etc.)
 * PDF: PDF version for client viewing
 * SUPPORTING: Additional supporting documents
 */
export type SubmissionFileType = 'NATIVE' | 'PDF' | 'SUPPORTING';

/**
 * File attachment for a submission
 * Supports multiple files per submission (native + PDF)
 */
export interface SubmissionFile {
  id: string;
  fileType: SubmissionFileType;
  fileName: string;
  fileUrl: string;
  storagePath: string;
  fileSize: number;
  mimeType: string;
  isPrimary: boolean; // The main file for client viewing (usually PDF)
  documentRecordId?: string; // Link to DocumentRecord if created
  uploadedAt: Timestamp;
}

/**
 * Document Submission Record
 * Tracks each submission to client with revision history
 */
export interface DocumentSubmission {
  id: string;
  projectId: string;
  masterDocumentId: string;
  documentNumber: string; // Denormalized
  documentTitle: string;

  // Submission Info
  submissionNumber: number; // 1, 2, 3 (incremental per master doc)
  revision: string; // "R0", "R1", "R2", etc.
  documentId: string; // Link to primary DocumentRecord (backward compat)

  // Multiple files support
  files?: SubmissionFile[]; // All files in this submission
  primaryFileId?: string; // Quick reference to main file (usually PDF)

  // Submission
  submittedBy: string;
  submittedByName: string;
  submittedAt: Timestamp;
  submissionNotes?: string; // Cover notes from submitter

  // Client Response
  clientStatus: ClientReviewStatus;
  clientReviewedBy?: string;
  clientReviewedByName?: string;
  clientReviewedAt?: Timestamp;
  clientRemarks?: string; // General remarks from client

  // Comments
  commentCount: number;
  openCommentCount: number;
  resolvedCommentCount: number;
  closedCommentCount: number;

  // Comment Resolution Table
  crtGenerated: boolean;
  crtDocumentId?: string; // Link to exported CRT document
  crtGeneratedAt?: Timestamp;

  // Next Actions
  requiresResubmission: boolean;
  nextSubmissionId?: string; // Link to next submission (if resubmitted)
  previousSubmissionId?: string; // Link to previous submission

  // Approval Workflow (2-level: assignee resolves, PM closes)
  commentsResolvedBy?: string; // User who resolved comments
  commentsResolvedAt?: Timestamp;
  commentsApprovedBy?: string; // PM who approved resolutions
  commentsApprovedAt?: Timestamp;

  // Timestamps
  createdAt: Timestamp;
  updatedAt: Timestamp;
}

// ============================================================================
// COMMENT RESOLUTION SYSTEM
// ============================================================================

/**
 * Comment Severity Levels
 */
export type CommentSeverity = 'CRITICAL' | 'MAJOR' | 'MINOR' | 'SUGGESTION';

/**
 * Comment Status Workflow
 * OPEN → UNDER_REVIEW (assignee working) → RESOLVED (assignee done) → CLOSED (PM approved)
 */
export type CommentStatus = 'OPEN' | 'UNDER_REVIEW' | 'RESOLVED' | 'CLOSED';

/**
 * Comment Category
 */
export type CommentCategory =
  | 'TECHNICAL'
  | 'COMMERCIAL'
  | 'QUALITY'
  | 'SAFETY'
  | 'FORMATTING'
  | 'CLARIFICATION'
  | 'OTHER';

/**
 * Document Comment from Client
 */
export interface DocumentComment {
  id: string;
  projectId: string;
  submissionId: string;
  masterDocumentId: string;

  // Comment Identification
  commentNumber: string; // "C-001", "C-002", etc.
  commentText: string;

  // Classification
  severity: CommentSeverity;
  category: CommentCategory;

  // Location in Document (optional)
  pageNumber?: number;
  section?: string;
  lineItem?: string;

  // Client Info
  commentedBy: string; // Client user ID
  commentedByName: string;
  commentedAt: Timestamp;

  // Resolution Workflow (2-level)
  status: CommentStatus;

  // Level 1: Assignee Resolution
  resolutionText?: string; // User's response to comment
  resolvedBy?: string; // Assignee who resolved
  resolvedByName?: string;
  resolvedAt?: Timestamp;

  // Level 2: PM Approval
  pmApproved: boolean;
  pmApprovedBy?: string; // Project Manager
  pmApprovedByName?: string;
  pmApprovedAt?: Timestamp;
  pmRemarks?: string; // PM's notes on resolution

  // Client Acceptance (final)
  clientAccepted: boolean;
  clientAcceptedAt?: Timestamp;
  clientAcceptanceRemarks?: string;

  // Attachments (if needed)
  attachments: DocumentReference[];

  // Audit
  createdAt: Timestamp;
  updatedAt: Timestamp;
}

/**
 * Comment Resolution Table (CRT)
 * Exportable summary of all comments and resolutions
 */
export interface CommentResolutionTable {
  id: string;
  projectId: string;
  submissionId: string;
  masterDocumentId: string;

  // Document Info
  documentNumber: string;
  documentTitle: string;
  revision: string;
  submissionDate: Timestamp;

  // Comments (sorted by comment number)
  comments: DocumentComment[];

  // Summary Statistics
  totalComments: number;
  criticalComments: number;
  majorComments: number;
  minorComments: number;
  suggestionComments: number;

  openComments: number;
  underReviewComments: number;
  resolvedComments: number;
  closedComments: number;

  // Export Info
  exportedBy?: string;
  exportedByName?: string;
  exportedAt?: Timestamp;
  exportFormat?: 'PDF' | 'EXCEL';
  exportedDocumentId?: string; // Link to DocumentRecord of exported file

  // Generation
  generatedAt: Timestamp;
  createdAt: Timestamp;
  updatedAt: Timestamp;
}

// ============================================================================
// COMMENT RESOLUTION SHEET (Client Uploaded)
// ============================================================================

/**
 * Comment Resolution Sheet uploaded by client
 * Contains client feedback that can be manually entered as comments
 */
export interface CommentResolutionSheet {
  id: string;
  projectId: string;
  masterDocumentId: string;
  submissionId: string; // Which submission this CRS is for

  // Document Info (denormalized)
  documentNumber: string;
  documentTitle: string;
  revision: string;

  // File Info
  fileName: string;
  fileUrl: string;
  storagePath: string;
  fileSize: number;
  mimeType: string;

  // Status
  status: 'PENDING' | 'IN_PROGRESS' | 'COMPLETED'; // Entry progress
  commentsExtracted: number; // How many comments were entered from this sheet

  // Upload Info
  uploadedBy: string;
  uploadedByName: string;
  uploadedAt: Timestamp;

  // Processing Info (for future AI parsing)
  processedAt?: Timestamp;
  processedBy?: string;
  processingNotes?: string;

  // Audit
  createdAt: Timestamp;
  updatedAt: Timestamp;
}

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

// ============================================================================
// DOCUMENT TRANSMITTAL SYSTEM
// ============================================================================

/**
 * Document Transmittal Status
 */
export type TransmittalStatus = 'DRAFT' | 'GENERATED' | 'SENT' | 'ACKNOWLEDGED';

/**
 * Document Transmittal
 * Tracks bulk document submissions to clients
 */
export interface DocumentTransmittal {
  id: string;
  projectId: string;
  projectName: string;

  // Transmittal Info
  transmittalNumber: string; // Auto-generated (e.g., TR-001)
  transmittalDate: Timestamp;
  status: TransmittalStatus;

  // Recipient
  clientName: string;
  clientContact?: string;
  recipientEmail?: string;

  // Documents Included
  documentIds: string[]; // MasterDocument IDs
  documentCount: number;

  // Cover Notes
  subject?: string;
  coverNotes?: string;
  purposeOfIssue?: string;

  // Files
  transmittalPdfUrl?: string; // Generated PDF location
  transmittalPdfId?: string; // DocumentRecord ID
  zipFileUrl?: string; // ZIP file location
  zipFileSize?: number;

  // Acknowledgment
  acknowledgedBy?: string;
  acknowledgedByName?: string;
  acknowledgedAt?: Timestamp;
  acknowledgmentNotes?: string;

  // Audit
  createdBy: string;
  createdByName: string;
  createdAt: Timestamp;
  updatedAt: Timestamp;
  sentAt?: Timestamp;
}

/**
 * Transmittal Document Entry
 * Individual document in a transmittal
 */
export interface TransmittalDocumentEntry {
  masterDocumentId: string;
  documentNumber: string;
  documentTitle: string;
  disciplineCode: string;
  revision: string;
  submissionDate: Timestamp;
  status: MasterDocumentStatus;
  purposeOfIssue?: string;
  remarks?: string;

  // File references
  submissionId?: string;
  documentFileUrl?: string;
  crtFileUrl?: string;
}

// ============================================================================
// DOCUMENT TEMPLATES SYSTEM
// ============================================================================

/**
 * Template Category
 */
export type TemplateCategory =
  | 'DRAWING' // AutoCAD, SolidWorks, etc.
  | 'DOCUMENT' // Word, PDF
  | 'SPREADSHEET' // Excel
  | 'CALCULATION' // MathCAD, Excel
  | 'REPORT' // Word, PowerPoint
  | 'FORM' // Standardized forms
  | 'PROCEDURE' // SOPs, work instructions
  | 'OTHER';

/**
 * Template Applicability
 */
export type TemplateApplicability = 'COMPANY_WIDE' | 'PROJECT_SPECIFIC' | 'DISCIPLINE_SPECIFIC';

/**
 * Document Template
 * Stores standard templates for users to download and use
 */
export interface DocumentTemplate {
  id: string;

  // Template Info
  templateName: string;
  templateCode?: string; // "TPL-DWG-001"
  description: string;
  category: TemplateCategory;

  // File
  fileName: string;
  fileUrl: string; // Firebase Storage URL
  storageRef: string;
  fileSize: number;
  mimeType: string;
  fileExtension: string; // "docx", "xlsx", "dwg", "pdf"

  // Applicability
  applicability: TemplateApplicability;

  // If project-specific
  projectId?: string;
  projectName?: string;

  // If discipline-specific
  disciplineCodes?: string[]; // ["01", "02"] - applicable to these disciplines
  disciplineNames?: string[];

  // Version
  version: string; // "1.0", "1.1", "2.0"
  revisionHistory?: TemplateRevision[];

  // Usage Tracking
  downloadCount: number;
  lastDownloadedAt?: Timestamp;
  lastDownloadedBy?: string;

  // Status
  isActive: boolean;
  isLatest: boolean;

  // Tags
  tags: string[];

  // Instructions
  usageInstructions?: string; // How to use this template

  // Related Templates
  relatedTemplateIds?: string[];

  // Audit
  createdBy: string;
  createdByName: string;
  createdAt: Timestamp;
  updatedAt: Timestamp;

  // Soft delete
  isDeleted: boolean;
  deletedBy?: string;
  deletedAt?: Timestamp;
}

/**
 * Template Revision History
 */
export interface TemplateRevision {
  version: string;
  revisionNotes: string;
  revisedBy: string;
  revisedByName: string;
  revisedAt: Timestamp;
  previousFileUrl?: string; // Backup of previous version
}
