/**
 * RFQ PDF Generation Types
 *
 * Types for generating RFQ PDFs to send to vendors.
 * Supports:
 * - Terms & Conditions templates (reusable)
 * - Per-vendor or combined PDFs
 * - Company letterhead with logo
 */

import { Timestamp } from 'firebase/firestore';

// ============================================================================
// TERMS & CONDITIONS TEMPLATES
// ============================================================================

/**
 * Terms Template Type
 * Categories of terms that can be templated
 */
export type TermsTemplateType =
  | 'GENERAL' // General terms & conditions
  | 'PAYMENT' // Payment terms
  | 'DELIVERY' // Delivery terms
  | 'WARRANTY' // Warranty terms
  | 'COMPLIANCE' // Compliance requirements
  | 'PENALTY' // Penalty clauses
  | 'INSURANCE' // Insurance requirements
  | 'CONFIDENTIALITY'; // NDA/Confidentiality

/**
 * Terms Template
 * Reusable template for terms and conditions
 */
export interface TermsTemplate {
  id: string;
  name: string;
  description?: string;
  type: TermsTemplateType;

  // Content - can be single text or list of items
  content: string[]; // Array of terms/conditions

  // Usage tracking
  isDefault: boolean; // If true, auto-selected for new RFQs
  isActive: boolean;
  usageCount: number; // How many times this template has been used

  // Categorization
  category?: 'SERVICE' | 'RAW_MATERIAL' | 'BOUGHT_OUT' | 'ALL';

  // Metadata
  createdBy: string;
  createdByName: string;
  createdAt: Timestamp;
  updatedAt: Timestamp;
  updatedBy: string;
}

/**
 * Default terms templates
 */
export const DEFAULT_RFQ_TERMS: Record<TermsTemplateType, string[]> = {
  GENERAL: [
    'All specifications mentioned in this RFQ are minimum requirements.',
    'Vendor must provide detailed technical specifications with the quotation.',
    'Prices should be inclusive of all applicable taxes unless stated otherwise.',
    'Quotation validity should be minimum 30 days from submission date.',
    'Any deviations from specifications must be clearly mentioned.',
    'Vendor must mention lead time for delivery.',
  ],
  PAYMENT: [
    '30% advance against proforma invoice',
    '60% before dispatch against submission of test certificates',
    '10% within 30 days of receipt and acceptance at site',
    'Payment will be made via NEFT/RTGS',
  ],
  DELIVERY: [
    'Delivery location: As mentioned in the RFQ',
    'Delivery should be Ex-works/FOR destination as applicable',
    'Packing should be suitable for long distance transportation',
    'All materials should be properly labeled with PO number and item details',
  ],
  WARRANTY: [
    'Minimum warranty period: 12 months from date of commissioning or 18 months from date of supply, whichever is earlier',
    'Warranty should cover manufacturing defects and material quality',
    'Replacement/repair during warranty period should be free of cost including transportation',
  ],
  COMPLIANCE: [
    'Materials should comply with mentioned IS/ASTM/ASME standards',
    'Mill test certificates to be provided for all materials',
    'Third party inspection can be arranged at vendor premises if required',
  ],
  PENALTY: [
    'Liquidated damages @ 0.5% per week of delay, maximum 5%',
    'Penalty clause for non-conformance to specifications',
  ],
  INSURANCE: [
    'Transit insurance to be arranged by vendor',
    'Insurance coverage should be for 110% of material value',
  ],
  CONFIDENTIALITY: [
    'All information shared is confidential and should not be disclosed to third parties',
    'Drawings and specifications are property of the buyer',
  ],
};

// ============================================================================
// RFQ PDF GENERATION
// ============================================================================

/**
 * RFQ PDF Generation Mode
 * Controls how PDFs are generated for vendors
 */
export type RFQPDFMode =
  | 'INDIVIDUAL' // One PDF per vendor
  | 'COMBINED' // One PDF for all vendors
  | 'BOTH'; // Generate both versions

/**
 * RFQ PDF Generation Options
 */
export interface RFQPDFGenerationOptions {
  // RFQ to generate PDF from
  rfqId: string;

  // Generation mode
  mode: RFQPDFMode;

  // Specific vendors (if mode is INDIVIDUAL or generating for subset)
  vendorIds?: string[];

  // Company information (from company settings)
  companyName: string;
  companyAddress?: string;
  companyPhone?: string;
  companyEmail?: string;
  companyWebsite?: string;
  companyLogoUrl?: string;
  companyGSTIN?: string;
  companyPAN?: string;

  // Terms (can be customized per generation)
  generalTerms?: string[];
  paymentTerms?: string[];
  deliveryTerms?: string[];
  warrantyTerms?: string[];
  complianceTerms?: string[];
  penaltyTerms?: string[];

  // Display options
  showItemSpecifications?: boolean;
  showDeliveryDates?: boolean;
  showEquipmentCodes?: boolean;

  // Watermark (optional)
  watermark?: string; // e.g., "DRAFT", "CONFIDENTIAL"

  // Additional notes
  customNotes?: string;

  // Contact person for queries
  contactPersonName?: string;
  contactPersonEmail?: string;
  contactPersonPhone?: string;
}

/**
 * RFQ PDF Data
 * Complete data structure for rendering RFQ PDF template
 */
export interface RFQPDFData {
  // Metadata
  rfqNumber: string;
  issueDate: string; // Formatted date
  dueDate: string; // Formatted date
  validityPeriod: string;
  generatedAt: string; // Formatted timestamp

  // Company information (letterhead)
  company: {
    name: string;
    address?: string;
    phone?: string;
    email?: string;
    website?: string;
    logoUrl?: string;
    gstin?: string;
    pan?: string;
  };

  // Vendor information (for individual PDFs)
  vendor?: {
    name: string;
    address?: string;
    contactPerson?: string;
    email?: string;
    phone?: string;
  };

  // For combined PDFs - list of vendors
  vendors?: Array<{
    name: string;
    email?: string;
  }>;

  // RFQ details
  rfq: {
    title: string;
    description?: string;
    projectNames: string[];
    purchaseRequestNumbers: string[];
  };

  // Line items
  items: RFQPDFItem[];

  // Terms sections
  generalTerms?: string[];
  paymentTerms?: string[];
  deliveryTerms?: string[];
  warrantyTerms?: string[];
  complianceTerms?: string[];
  penaltyTerms?: string[];

  // Contact information
  contact?: {
    name: string;
    email: string;
    phone?: string;
  };

  // Additional
  customNotes?: string;
  watermark?: string;

  // Display flags
  showItemSpecifications: boolean;
  showDeliveryDates: boolean;
  showEquipmentCodes: boolean;
  isIndividualVendor: boolean; // true = addressed to one vendor
}

/**
 * RFQ PDF Item
 * Simplified item structure for PDF rendering
 */
export interface RFQPDFItem {
  lineNumber: number;
  description: string;
  specification?: string;
  quantity: number;
  unit: string;

  // Technical requirements
  technicalSpec?: string;
  drawingNumbers?: string[];
  makeModel?: string;

  // Equipment linkage
  equipmentCode?: string;
  projectName?: string;

  // Delivery requirements
  requiredBy?: string; // Formatted date
  deliveryLocation?: string;

  // Item-specific conditions
  conditions?: string;
}

/**
 * RFQ PDF Generation Result
 */
export interface RFQPDFGenerationResult {
  success: boolean;

  // For INDIVIDUAL mode - multiple PDFs
  vendorPdfs?: Array<{
    vendorId: string;
    vendorName: string;
    pdfUrl: string;
    pdfPath: string;
  }>;

  // For COMBINED mode - single PDF
  combinedPdfUrl?: string;
  combinedPdfPath?: string;

  // Expiration
  expiresAt?: Timestamp;

  // Error handling
  error?: string;
  errors?: Array<{
    vendorId?: string;
    error: string;
  }>;

  // Metadata
  generatedAt: Timestamp;
  generatedBy: string;
  totalFiles: number;
}

/**
 * RFQ PDF Generation Request
 * Sent to Firebase Function
 */
export interface RFQPDFGenerationRequest {
  rfqId: string;
  options: RFQPDFGenerationOptions;
  userId: string;
}

// ============================================================================
// SAVED PDF RECORDS
// ============================================================================

/**
 * RFQ PDF Record
 * Stored in Firestore to track generated PDFs
 */
export interface RFQPDFRecord {
  id: string;
  rfqId: string;
  rfqNumber: string;

  // Generation info
  mode: RFQPDFMode;
  version: number; // PDF version (1, 2, 3... for revisions)

  // For individual PDFs
  vendorId?: string;
  vendorName?: string;

  // Storage
  pdfUrl: string;
  pdfPath: string;
  fileSize: number;
  expiresAt: Timestamp;

  // Terms used (for audit trail)
  termsSnapshot?: {
    general?: string[];
    payment?: string[];
    delivery?: string[];
    warranty?: string[];
  };

  // Tracking
  downloadCount: number;
  lastDownloadedAt?: Timestamp;

  // Metadata
  generatedBy: string;
  generatedByName: string;
  generatedAt: Timestamp;
}
