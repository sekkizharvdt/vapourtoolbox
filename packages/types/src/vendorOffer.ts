/**
 * Vendor Offer Type Definitions
 *
 * Types for uploading vendor quotations and mapping line items
 * to materials, services, or bought-out items in the database.
 */

import type { Timestamp } from 'firebase/firestore';
import type { CurrencyCode } from './common';

// ============================================================================
// VENDOR OFFER TYPES
// ============================================================================

export type VendorOfferStatus = 'DRAFT' | 'REVIEWED' | 'ARCHIVED';

export type OfferItemType = 'MATERIAL' | 'SERVICE' | 'BOUGHT_OUT';

/**
 * Vendor Offer — a standalone quotation uploaded for price tracking.
 * Not tied to the RFQ→Offer procurement workflow.
 */
export interface VendorOffer {
  id: string;
  offerNumber: string; // VO-YYYY-NNNN (auto-generated)

  // Vendor (optional — free text or linked entity)
  vendorId?: string; // Entity ID if linked
  vendorName: string; // Always stored (free text or denormalized)

  // Offer metadata
  offerDate?: Timestamp; // Date on the vendor's quotation
  validityDate?: Timestamp; // Quote validity expiry
  currency: CurrencyCode; // Default INR
  remarks?: string;

  // Document
  fileUrl?: string; // Uploaded PDF/image in Firebase Storage
  fileName?: string;

  // Summary (computed from line items)
  totalAmount: number;
  itemCount: number;
  acceptedCount: number; // How many prices have been pushed to DB

  // Status
  status: VendorOfferStatus;
  isActive: boolean;

  // Audit
  createdAt: Timestamp;
  createdBy: string;
  createdByName: string;
  updatedAt: Timestamp;
  updatedBy: string;
}

/**
 * Line item within a vendor offer, optionally linked to a
 * material, service, or bought-out item.
 */
export interface VendorOfferItem {
  id: string;
  offerId: string; // Parent vendor offer

  lineNumber: number;

  // What this line item is
  itemType: OfferItemType;
  description: string; // Free text from offer

  // Link to database (optional — user maps manually)
  materialId?: string; // If itemType=MATERIAL
  serviceId?: string; // If itemType=SERVICE
  boughtOutItemId?: string; // If itemType=BOUGHT_OUT
  linkedItemName?: string; // Denormalized name for display
  linkedItemCode?: string; // Denormalized code for display

  // Pricing
  quantity: number;
  unit: string;
  unitPrice: number;
  amount: number; // quantity * unitPrice

  // Tax
  gstRate?: number;
  gstAmount?: number;

  // Price acceptance
  priceAccepted: boolean; // Has this been pushed to material price history?
  priceAcceptedAt?: Timestamp;
  priceAcceptedBy?: string;

  // Notes
  notes?: string;

  // Audit
  createdAt: Timestamp;
  updatedAt: Timestamp;
}
