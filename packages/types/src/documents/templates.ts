/**
 * Document Management - Template Types
 *
 * Standard document templates for users to download and use
 */

import type { Timestamp } from 'firebase/firestore';

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
