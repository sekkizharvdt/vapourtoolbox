/**
 * Offer (Vendor Quotation) Type Definitions
 *
 * Types for vendor quotations and offer comparison in procurement workflow.
 */

import type { Timestamp } from 'firebase/firestore';
import type { RFQ } from './rfq';

// ============================================================================
// OFFER (VENDOR QUOTATION) TYPES
// ============================================================================

export type OfferStatus =
  | 'UPLOADED'
  | 'UNDER_REVIEW'
  | 'EVALUATED'
  | 'SELECTED'
  | 'PO_CREATED'
  | 'REJECTED'
  | 'WITHDRAWN';

export interface Offer {
  id: string;
  number: string; // OFFER/YYYY/MM/XXXX

  // RFQ reference
  rfqId: string;
  rfqNumber: string; // Denormalized

  // Vendor
  vendorId: string;
  vendorName: string; // Denormalized

  // Vendor offer details
  vendorOfferNumber?: string;
  vendorOfferDate?: Timestamp;

  // Documents
  offerFileUrl: string; // Main offer PDF/image
  additionalDocuments?: string[]; // Supporting docs

  // Manual entry of offer details (AI parsing future)
  itemsParsed: boolean; // false until manually entered

  // Financial summary
  subtotal: number;
  taxAmount: number;
  totalAmount: number;
  currency: string; // Default 'INR'

  // Terms
  paymentTerms?: string;
  deliveryTerms?: string;
  validityDate?: Timestamp;
  warrantyTerms?: string;

  // Commercial cost components (for comparison)
  exWorks?: string; // e.g., "Included", "At buyer's expense"
  transportation?: string; // e.g., "Included in price", "Extra @ actual"
  packingForwarding?: string; // e.g., "Included", "At cost"
  insurance?: string; // e.g., "Transit insurance by vendor", "At buyer's expense"
  erectionAfterPurchase?: string; // e.g., "Not in scope", "Available at extra cost"

  // Evaluation
  status: OfferStatus;
  evaluationScore?: number; // 0-100
  evaluationNotes?: string;

  // Comparison
  isRecommended: boolean;
  recommendationReason?: string;

  // Red flags
  redFlags?: string[];

  // Workflow
  uploadedBy: string;
  uploadedByName: string; // Denormalized
  uploadedAt: Timestamp;

  evaluatedBy?: string;
  evaluatedByName?: string;
  evaluatedAt?: Timestamp;

  // Timestamps
  createdAt: Timestamp;
  updatedAt: Timestamp;
}

export interface OfferItem {
  id: string;
  offerId: string;

  // RFQ item reference
  rfqItemId: string;

  // Item details
  lineNumber: number;
  description: string;

  // Quoted quantity and pricing
  quotedQuantity: number;
  unit: string;
  unitPrice: number;
  amount: number;

  // Tax breakdown
  gstRate?: number;
  gstAmount?: number;

  // Delivery
  deliveryPeriod?: string; // e.g., "30 days"
  deliveryDate?: Timestamp;

  // Make/model offered
  makeModel?: string;

  // Compliance
  meetsSpec: boolean;
  deviations?: string;

  // Notes
  vendorNotes?: string;
  evaluationNotes?: string;

  // Timestamps
  createdAt: Timestamp;
  updatedAt: Timestamp;
}

// ============================================================================
// OFFER COMPARISON TYPES
// ============================================================================

// Comparison helper type
export interface OfferComparison {
  rfqId: string;
  offers: Offer[];
  itemComparisons: {
    rfqItemId: string;
    description: string;
    offers: {
      offerId: string;
      vendorName: string;
      unitPrice: number;
      totalPrice: number;
      deliveryPeriod?: string;
      meetsSpec: boolean;
      deviations?: string;
    }[];
    lowestPrice: number;
    recommendation?: string;
  }[];
  overallRecommendation?: string;
  selectedOfferId?: string;
  comparisonDate: Timestamp;
  comparedBy: string;
}

// Offer comparison statistics for summary view
export interface OfferComparisonStat {
  offerId: string;
  vendorName: string;
  totalAmount: number;
  meetsAllSpecs: boolean;
  hasDeviations: boolean;
  isRecommended: boolean;
  evaluationScore?: number;
  redFlags?: string[];
}

// Item-level offer details for comparison
export interface ItemOfferComparison {
  offerId: string;
  vendorName: string;
  unitPrice: number;
  totalPrice: number;
  deliveryPeriod?: string;
  meetsSpec: boolean;
  deviations?: string;
  makeModel?: string;
}

// Item comparison with all vendor offers
export interface ItemComparison {
  rfqItemId: string;
  description: string;
  quantity: number;
  unit: string;
  offers: ItemOfferComparison[];
  lowestPrice: number;
}

// Complete offer comparison data structure
export interface OfferComparisonData {
  rfq: RFQ | null;
  offers: Offer[];
  itemComparisons: ItemComparison[];
  offerStats: OfferComparisonStat[];
  lowestTotal: number;
}
