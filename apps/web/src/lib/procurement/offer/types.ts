/**
 * Offer Service Types
 *
 * Type definitions for vendor offers and quotations
 */

// Re-export from @vapour/types
export type { Offer, OfferItem, OfferStatus, OfferComparisonData } from '@vapour/types';

/**
 * Input for creating a new offer
 */
export interface CreateOfferInput {
  // RFQ reference
  rfqId: string;
  rfqNumber: string;

  // Vendor
  vendorId: string;
  vendorName: string;

  // Vendor offer details
  vendorOfferNumber?: string;
  vendorOfferDate?: Date;

  // Documents
  offerFileUrl: string;
  additionalDocuments?: string[];

  // Financial summary
  subtotal: number;
  taxAmount: number;
  totalAmount: number;
  currency?: string;

  // Terms
  paymentTerms?: string;
  deliveryTerms?: string;
  validityDate?: Date;
  warrantyTerms?: string;
}

/**
 * Input for creating offer items
 */
export interface CreateOfferItemInput {
  // RFQ item reference
  rfqItemId: string;

  // Item details
  description: string;

  // Quoted quantity and pricing
  quotedQuantity: number;
  unit: string;
  unitPrice: number;

  // Tax
  gstRate?: number;

  // Delivery
  deliveryPeriod?: string;
  deliveryDate?: Date;

  // Make/model offered
  makeModel?: string;

  // Compliance
  meetsSpec: boolean;
  deviations?: string;

  // Notes
  vendorNotes?: string;
}

/**
 * Input for updating an offer
 */
export interface UpdateOfferInput {
  vendorOfferNumber?: string;
  vendorOfferDate?: Date;
  subtotal?: number;
  taxAmount?: number;
  totalAmount?: number;
  paymentTerms?: string;
  deliveryTerms?: string;
  validityDate?: Date;
  warrantyTerms?: string;
}

/**
 * Input for evaluating an offer
 */
export interface EvaluateOfferInput {
  evaluationScore?: number; // 0-100
  evaluationNotes?: string;
  isRecommended?: boolean;
  recommendationReason?: string;
  redFlags?: string[];
}

/**
 * Filters for listing offers
 */
export interface ListOffersFilters {
  rfqId?: string;
  vendorId?: string;
  status?: import('@vapour/types').OfferStatus;
  isRecommended?: boolean;
  limit?: number;
}
