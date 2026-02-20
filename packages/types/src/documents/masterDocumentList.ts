/**
 * Document Management - Master Document List Types
 *
 * Document numbering, disciplines, master document entries, links
 */

import type { Timestamp } from 'firebase/firestore';
import type { DocumentReference } from './core';

// ============================================================================
// DOCUMENT NUMBERING CONFIGURATION
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
