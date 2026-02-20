/**
 * Document Management - Submission & Comment Resolution Types
 *
 * Submissions, comments, CRT, CRS
 */

import type { Timestamp } from 'firebase/firestore';
import type { DocumentReference } from './core';

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
