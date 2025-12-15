/**
 * Company Documents Types
 *
 * Types for company-wide document storage including:
 * - SOPs (Standard Operating Procedures)
 * - Company policies
 * - Templates (RFQ, Offer, PO, etc.)
 * - Standards and manuals
 */

import type { Timestamp } from 'firebase/firestore';

/**
 * Document category for organization
 */
export type CompanyDocumentCategory =
  | 'SOP' // Standard Operating Procedures
  | 'POLICY' // Company policies
  | 'TEMPLATE' // Document templates (RFQ, Offer, PO, etc.)
  | 'STANDARD' // Company standards
  | 'MANUAL' // User manuals, guides
  | 'OTHER'; // Other documents

/**
 * Template types for app-generated documents
 */
export type TemplateType =
  | 'RFQ'
  | 'OFFER'
  | 'PO'
  | 'INVOICE'
  | 'CONTRACT'
  | 'REPORT'
  | 'TRANSMITTAL'
  | 'OTHER';

/**
 * Company document record
 */
export interface CompanyDocument {
  id: string;
  title: string;
  description: string;
  category: CompanyDocumentCategory;

  // File information
  fileName: string;
  fileUrl: string;
  storageRef: string;
  fileSize: number;
  mimeType: string;
  fileExtension: string;

  // Version control
  version: number;
  isLatest: boolean;
  previousVersionId?: string;
  revisionNotes?: string;

  // Organization
  folder?: string;
  tags: string[];

  // Template-specific fields (for app-generated documents)
  isTemplate: boolean;
  templateType?: TemplateType;

  // Audit fields
  uploadedBy: string;
  uploadedByName: string;
  uploadedAt: Timestamp;
  updatedAt: Timestamp;
  updatedBy?: string;
  updatedByName?: string;

  // Soft delete
  isDeleted: boolean;
  deletedAt?: Timestamp;
  deletedBy?: string;
}

/**
 * Input for creating a new company document
 */
export interface CompanyDocumentInput {
  title: string;
  description: string;
  category: CompanyDocumentCategory;
  folder?: string;
  tags?: string[];
  isTemplate?: boolean;
  templateType?: TemplateType;
  revisionNotes?: string;
}

/**
 * Input for updating a company document
 */
export interface CompanyDocumentUpdate {
  title?: string;
  description?: string;
  category?: CompanyDocumentCategory;
  folder?: string;
  tags?: string[];
  isTemplate?: boolean;
  templateType?: TemplateType;
}

/**
 * Category display configuration
 */
export const COMPANY_DOCUMENT_CATEGORIES: Record<
  CompanyDocumentCategory,
  { label: string; description: string; icon: string }
> = {
  SOP: {
    label: 'SOPs',
    description: 'Standard Operating Procedures',
    icon: 'Assignment',
  },
  POLICY: {
    label: 'Policies',
    description: 'Company policies and guidelines',
    icon: 'Policy',
  },
  TEMPLATE: {
    label: 'Templates',
    description: 'Document templates for RFQ, Offers, PO, etc.',
    icon: 'FileCopy',
  },
  STANDARD: {
    label: 'Standards',
    description: 'Company standards and specifications',
    icon: 'Verified',
  },
  MANUAL: {
    label: 'Manuals',
    description: 'User manuals and guides',
    icon: 'MenuBook',
  },
  OTHER: {
    label: 'Other',
    description: 'Other company documents',
    icon: 'Description',
  },
};

/**
 * Template type display configuration
 */
export const TEMPLATE_TYPES: Record<TemplateType, { label: string; description: string }> = {
  RFQ: { label: 'RFQ Template', description: 'Request for Quotation template' },
  OFFER: { label: 'Offer Template', description: 'Vendor offer/quotation template' },
  PO: { label: 'PO Template', description: 'Purchase Order template' },
  INVOICE: { label: 'Invoice Template', description: 'Invoice template' },
  CONTRACT: { label: 'Contract Template', description: 'Contract/agreement template' },
  REPORT: { label: 'Report Template', description: 'Report template' },
  TRANSMITTAL: { label: 'Transmittal Template', description: 'Document transmittal template' },
  OTHER: { label: 'Other Template', description: 'Other document template' },
};
