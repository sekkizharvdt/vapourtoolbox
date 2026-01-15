/**
 * Document Parsing Types
 *
 * Types for parsing documents (PDF/DOC) using AI to extract
 * structured data for Purchase Requests
 */

import { Timestamp } from 'firebase/firestore';

// ============================================================================
// DOCUMENT PARSING REQUEST/RESPONSE
// ============================================================================

/**
 * Supported document types for parsing
 */
export type ParseableDocumentType = 'pdf' | 'doc' | 'docx';

/**
 * Document parsing request
 */
export interface DocumentParsingRequest {
  // File information
  fileName: string;
  fileUrl: string; // Firebase Storage URL
  storagePath: string;
  mimeType: string;
  fileSize: number;

  // Context for better parsing
  context?: {
    projectName?: string;
    category?: 'SERVICE' | 'RAW_MATERIAL' | 'BOUGHT_OUT';
    existingEquipmentCodes?: string[]; // For matching
  };

  // User info
  userId: string;
}

/**
 * Parsed line item from document
 */
export interface ParsedLineItem {
  lineNumber: number;
  description: string;
  specification?: string;
  quantity: number;
  unit: string;
  equipmentCode?: string;
  makeModel?: string;
  technicalSpec?: string;
  deliveryLocation?: string;
  remarks?: string;

  // Confidence scores (0-1) for AI extraction
  confidence: {
    description: number;
    quantity: number;
    unit: number;
    overall: number;
  };

  // Original text snippet for reference
  sourceText?: string;
}

/**
 * Parsed PR header information
 */
export interface ParsedPRHeader {
  title?: string;
  description?: string;
  priority?: 'LOW' | 'MEDIUM' | 'HIGH' | 'URGENT';
  requiredBy?: string; // Date string, needs conversion

  // Detected metadata
  documentDate?: string;
  documentReference?: string;
  vendor?: string;
  customer?: string;

  // Confidence
  confidence: number;
}

/**
 * Document parsing result
 */
export interface DocumentParsingResult {
  success: boolean;

  // Parsed data
  header?: ParsedPRHeader;
  items: ParsedLineItem[];

  // Summary
  totalItemsFound: number;
  highConfidenceItems: number; // Items with confidence > 0.8
  lowConfidenceItems: number; // Items with confidence < 0.5

  // Warnings/Issues
  warnings?: string[];
  errors?: string[];

  // Processing info
  processingTimeMs: number;
  modelUsed: string;

  // Source document info
  sourceFileName: string;
  sourceFileSize: number;
  pageCount?: number;
}

/**
 * Document parsing job status
 */
export type DocumentParsingStatus = 'PENDING' | 'PROCESSING' | 'COMPLETED' | 'FAILED';

/**
 * Document parsing job record (stored in Firestore)
 */
export interface DocumentParsingJob {
  id: string;

  // Request info
  fileName: string;
  fileUrl: string;
  storagePath: string;
  mimeType: string;
  fileSize: number;

  // Status
  status: DocumentParsingStatus;
  progress?: number; // 0-100

  // Result (if completed)
  result?: DocumentParsingResult;

  // Error (if failed)
  error?: string;
  errorDetails?: string;

  // Context
  projectId?: string;
  projectName?: string;
  category?: string;

  // User
  requestedBy: string;
  requestedByName: string;
  requestedAt: Timestamp;

  // Completion
  completedAt?: Timestamp;

  // Timestamps
  createdAt: Timestamp;
  updatedAt: Timestamp;
}

// ============================================================================
// VALIDATION HELPERS
// ============================================================================

/**
 * Validate parsed line item
 */
export function validateParsedItem(item: ParsedLineItem): string[] {
  const errors: string[] = [];

  if (!item.description || item.description.trim().length < 3) {
    errors.push(`Line ${item.lineNumber}: Description is too short or empty`);
  }

  if (item.quantity <= 0) {
    errors.push(`Line ${item.lineNumber}: Quantity must be greater than 0`);
  }

  if (!item.unit || item.unit.trim().length === 0) {
    errors.push(`Line ${item.lineNumber}: Unit is required`);
  }

  return errors;
}

/**
 * Standard units for normalization
 */
export const STANDARD_UNITS: Record<string, string> = {
  // Count
  nos: 'NOS',
  no: 'NOS',
  pcs: 'NOS',
  pieces: 'NOS',
  ea: 'EA',
  each: 'EA',
  unit: 'UNIT',
  units: 'UNIT',
  set: 'SET',
  sets: 'SET',
  lot: 'LOT',
  lots: 'LOT',

  // Length
  m: 'MTR',
  mtr: 'MTR',
  meter: 'MTR',
  meters: 'MTR',
  metre: 'MTR',
  metres: 'MTR',
  mm: 'MM',
  cm: 'CM',
  ft: 'FT',
  feet: 'FT',
  inch: 'INCH',
  inches: 'INCH',

  // Weight
  kg: 'KG',
  kgs: 'KG',
  kilogram: 'KG',
  kilograms: 'KG',
  g: 'GM',
  gm: 'GM',
  gram: 'GM',
  grams: 'GM',
  ton: 'TON',
  tons: 'TON',
  mt: 'MT',

  // Volume
  l: 'LTR',
  ltr: 'LTR',
  liter: 'LTR',
  liters: 'LTR',
  litre: 'LTR',
  litres: 'LTR',
  ml: 'ML',

  // Area
  sqm: 'SQM',
  sqft: 'SQFT',

  // Time
  hr: 'HR',
  hrs: 'HR',
  hour: 'HR',
  hours: 'HR',
  day: 'DAY',
  days: 'DAY',
  month: 'MONTH',
  months: 'MONTH',
};

/**
 * Normalize unit string to standard format
 */
export function normalizeUnit(unit: string): string {
  const normalized = unit.toLowerCase().trim();
  return STANDARD_UNITS[normalized] || unit.toUpperCase();
}

// ============================================================================
// OFFER DOCUMENT PARSING
// ============================================================================

/**
 * Offer document parsing request
 */
export interface OfferParsingRequest {
  // File information
  fileName: string;
  fileUrl: string; // Firebase Storage URL
  storagePath: string;
  mimeType: string;
  fileSize: number;

  // Context for better parsing
  rfqId: string;
  rfqNumber: string;
  vendorId: string;
  vendorName: string;

  // RFQ items for matching
  rfqItems: {
    id: string;
    lineNumber: number;
    description: string;
    quantity: number;
    unit: string;
  }[];

  // User info
  userId: string;
}

/**
 * Parsed offer line item from document
 */
export interface ParsedOfferItem {
  lineNumber: number;

  // RFQ item matching
  matchedRfqItemId?: string; // ID of matched RFQ item
  matchConfidence: number; // 0-1 confidence of match

  // Item details
  description: string;
  quantity: number;
  unit: string;

  // Pricing (key extraction)
  unitPrice: number;
  amount: number; // quantity * unitPrice
  gstRate?: number;
  gstAmount?: number;

  // Delivery
  deliveryPeriod?: string;

  // Make/Model
  makeModel?: string;

  // Compliance
  meetsSpec: boolean;
  deviations?: string;

  // Notes
  vendorNotes?: string;

  // Confidence scores (0-1)
  confidence: {
    description: number;
    unitPrice: number;
    quantity: number;
    overall: number;
  };

  // Original text snippet for reference
  sourceText?: string;
}

/**
 * Parsed offer header information
 */
export interface ParsedOfferHeader {
  vendorOfferNumber?: string;
  vendorOfferDate?: string;
  validityDate?: string;

  // Financial totals
  subtotal?: number;
  taxAmount?: number;
  totalAmount?: number;
  currency?: string;

  // Terms
  paymentTerms?: string;
  deliveryTerms?: string;
  warrantyTerms?: string;

  // Other
  remarks?: string;

  // Confidence
  confidence: number;
}

/**
 * Offer document parsing result
 */
export interface OfferParsingResult {
  success: boolean;

  // Parsed data
  header?: ParsedOfferHeader;
  items: ParsedOfferItem[];

  // Summary
  totalItemsFound: number;
  matchedItems: number; // Items matched to RFQ items
  unmatchedItems: number; // Items not matched
  highConfidenceItems: number;
  lowConfidenceItems: number;

  // Financial summary
  calculatedSubtotal: number;
  calculatedTax: number;
  calculatedTotal: number;

  // Warnings/Issues
  warnings?: string[];
  errors?: string[];

  // Processing info
  processingTimeMs: number;
  modelUsed: string;

  // Source document info
  sourceFileName: string;
  sourceFileSize: number;
  pageCount?: number;
}

/**
 * Offer parsing job record (stored in Firestore)
 */
export interface OfferParsingJob {
  id: string;

  // Request info
  fileName: string;
  fileUrl: string;
  storagePath: string;
  mimeType: string;
  fileSize: number;

  // Context
  rfqId: string;
  rfqNumber: string;
  vendorId: string;
  vendorName: string;

  // Status
  status: DocumentParsingStatus;
  progress?: number;

  // Result (if completed)
  result?: OfferParsingResult;

  // Error (if failed)
  error?: string;
  errorDetails?: string;

  // User
  requestedBy: string;
  requestedByName: string;
  requestedAt: Timestamp;

  // Completion
  completedAt?: Timestamp;

  // Timestamps
  createdAt: Timestamp;
  updatedAt: Timestamp;
}
