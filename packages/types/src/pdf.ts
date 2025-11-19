/**
 * PDF Generation Types
 * Phase 6: BOM Reporting & Export
 *
 * Types for generating professional techno-commercial offer PDFs
 * from BOMs with complete cost breakdowns.
 */

import { Timestamp } from 'firebase/firestore';

/**
 * PDF Generation Options
 */
export interface PDFGenerationOptions {
  // BOM to generate PDF from
  bomId: string;

  // Company information
  companyName: string;
  companyAddress?: string;
  companyPhone?: string;
  companyEmail?: string;
  companyWebsite?: string;
  companyLogoUrl?: string;
  companyGSTIN?: string;
  companyPAN?: string;

  // Customer information
  customerName: string;
  customerAddress?: string;
  customerAttention?: string;
  customerEmail?: string;
  customerPhone?: string;

  // Quote metadata
  quoteNumber?: string; // Auto-generated if not provided
  quoteDate?: Timestamp;
  validUntil?: Timestamp;
  preparedBy?: string;

  // Display options
  showCostBreakdown?: boolean; // Show detailed cost breakdown
  showIndirectCosts?: boolean; // Show overhead, contingency, profit
  showItemDetails?: boolean; // Show item-level descriptions
  showMaterialCodes?: boolean; // Show material codes in items
  showServices?: boolean; // Show service items
  includeTermsAndConditions?: boolean;
  includePaymentTerms?: boolean;
  includeDeliveryTerms?: boolean;

  // Watermark (optional)
  watermark?: string; // e.g., "DRAFT", "CONFIDENTIAL"

  // Custom sections
  customNotes?: string;
  customTerms?: string[];
  paymentTerms?: string[];
  deliveryTerms?: string[];
}

/**
 * BOM Quote PDF Data
 * Complete data structure for rendering PDF template
 */
export interface BOMQuotePDFData {
  // Metadata
  quoteNumber: string;
  quoteDate: string; // Formatted date
  validUntil: string; // Formatted date
  preparedBy: string;
  generatedAt: string; // Formatted timestamp

  // Company information
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

  // Customer information
  customer: {
    name: string;
    address?: string;
    attention?: string;
    email?: string;
    phone?: string;
  };

  // BOM information
  bom: {
    bomCode: string;
    name: string;
    description?: string;
    category: string;
    projectName?: string;
  };

  // Items
  items: PDFBOMItem[];

  // Cost Summary
  summary: {
    totalWeight: string; // Formatted with unit
    itemCount: number;

    // Direct costs
    totalMaterialCost: string; // Formatted currency
    totalFabricationCost: string;
    totalServiceCost: string;
    totalDirectCost: string;

    // Indirect costs (Phase 4)
    overhead: string;
    contingency: string;
    profit: string;

    // Final total
    totalCost: string;
    currency: string;

    // Cost config reference (if available)
    costConfigName?: string;
  };

  // Display flags
  showCostBreakdown: boolean;
  showIndirectCosts: boolean;
  showItemDetails: boolean;
  showMaterialCodes: boolean;
  showServices: boolean;

  // Optional sections
  customNotes?: string;
  termsAndConditions?: string[];
  paymentTerms?: string[];
  deliveryTerms?: string[];
  watermark?: string;
}

/**
 * PDF BOM Item
 * Simplified item structure for PDF rendering
 */
export interface PDFBOMItem {
  itemNumber: string;
  name: string;
  description?: string;
  quantity: string; // Formatted with unit
  type: 'ASSEMBLY' | 'PART' | 'MATERIAL';
  componentType?: 'SHAPE' | 'BOUGHT_OUT';
  materialCode?: string;
  materialGrade?: string;

  // Calculated properties
  weight?: string; // Formatted with unit
  unitPrice?: string; // Formatted currency
  totalPrice?: string; // Formatted currency

  // Cost breakdown (if showCostBreakdown is true)
  materialCost?: string;
  fabricationCost?: string;
  serviceCost?: string;

  // Hierarchy
  level: number;
  isSubItem: boolean;
}

/**
 * PDF Generation Result
 */
export interface PDFGenerationResult {
  success: boolean;
  pdfUrl?: string; // Signed URL to download PDF
  pdfPath?: string; // Storage path in Firebase Storage
  expiresAt?: Timestamp; // When the signed URL expires
  error?: string;
  generatedAt: Timestamp;
  fileSize?: number; // Size in bytes
}

/**
 * PDF Generation Request
 * Sent to Firebase Function
 */
export interface PDFGenerationRequest {
  bomId: string;
  options: PDFGenerationOptions;
  userId: string;
}

/**
 * Default Terms and Conditions
 */
export const DEFAULT_TERMS_AND_CONDITIONS = [
  'This quotation is valid for 30 days from the date of issue.',
  'Prices are subject to change based on material cost fluctuations.',
  'All prices are in Indian Rupees (INR) unless otherwise specified.',
  'Delivery schedule will be confirmed upon receipt of purchase order.',
  'Any modifications to specifications may result in price adjustments.',
  'Applicable taxes (GST) will be charged as per government regulations.',
];

/**
 * Default Payment Terms
 */
export const DEFAULT_PAYMENT_TERMS = [
  '30% advance payment with purchase order',
  '40% payment before dispatch',
  '30% payment within 30 days of delivery',
  'Payment to be made via NEFT/RTGS/cheque',
];

/**
 * Default Delivery Terms
 */
export const DEFAULT_DELIVERY_TERMS = [
  'Delivery timeline: 8-12 weeks from receipt of advance payment',
  'Delivery location: As specified in purchase order',
  'Transportation: Ex-works (freight to be borne by customer)',
  'Installation and commissioning: Quoted separately if required',
];
