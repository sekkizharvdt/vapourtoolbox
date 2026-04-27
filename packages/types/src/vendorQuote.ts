/**
 * Vendor Quote — Unified Quote Type
 *
 * Replaces the two earlier collections that modeled essentially the same
 * concept with different context:
 *
 * - `offers` (procurement) — vendor responses to an in-app RFQ
 * - `vendorOffers` (materials) — standing vendor price quotes
 *
 * The unified `VendorQuote` carries both via optional `rfqId` and an explicit
 * `sourceType` discriminator. An offline RFQ (phone / email / WhatsApp) is
 * represented with `rfqMode: 'OFFLINE'` — still rfqId-bound if you want, or
 * left unlinked as `sourceType: 'OFFLINE_RFQ'` with no rfqId.
 *
 * See PROCUREMENT-MATERIALS-AUDIT-2026-04-24.md for the unification rationale.
 */

import type { Timestamp } from 'firebase/firestore';
import type { CurrencyCode } from './common';
import type { OfferDeviation } from './procurement/offer';

/**
 * What kind of quote this is. Determines which fields are meaningful and where
 * it shows up in the UI.
 */
export type QuoteSourceType =
  /** Vendor reply to an in-app RFQ that we sent through the system. */
  | 'RFQ_RESPONSE'
  /** Vendor reply to an offline RFQ (phone, email, WhatsApp). May or may not be rfqId-linked. */
  | 'OFFLINE_RFQ'
  /** Vendor reached out with a quote without us asking. */
  | 'UNSOLICITED'
  /** Standing price from a vendor's catalog or rate card. */
  | 'STANDING_QUOTE';

/** Whether the RFQ this quote responds to was issued in-app or out-of-band. */
export type RFQMode = 'ONLINE' | 'OFFLINE';

/**
 * Unified lifecycle for both in-app offer responses and standing quotes.
 * Not every state applies to every sourceType — e.g. STANDING_QUOTE quotes
 * typically move DRAFT → UPLOADED → EVALUATED → ARCHIVED, skipping SELECTED
 * and PO_CREATED.
 */
export type QuoteStatus =
  /** Being created/edited; not yet submitted for review. */
  | 'DRAFT'
  /** Submitted (or captured) but not yet reviewed. */
  | 'UPLOADED'
  /** Reviewer is actively looking at this. */
  | 'UNDER_REVIEW'
  /** Scored / annotated. */
  | 'EVALUATED'
  /** Chosen as the winning quote for an RFQ. */
  | 'SELECTED'
  /** A PO has been created from this quote. */
  | 'PO_CREATED'
  /** Not chosen. */
  | 'REJECTED'
  /** Vendor withdrew the quote. */
  | 'WITHDRAWN'
  /** Historical record; no further action expected. */
  | 'ARCHIVED';

/**
 * Line item classification.
 *
 * `NOTE` covers footer-level entries that don't map to a master record —
 * discounts (negative unitPrice), freight, packing & forwarding, transportation,
 * insurance, erection-when-listed-separately, and free-text clarifications.
 * NOTE rows skip the master-record link requirement and are excluded from
 * GST per-line because tax handling for these is vendor-specific.
 */
export type QuoteItemType = 'MATERIAL' | 'SERVICE' | 'BOUGHT_OUT' | 'NOTE';

// ============================================================================
// VendorQuote — parent document
// ============================================================================

export interface VendorQuote {
  id: string;
  /** System-assigned number, format `Q-YYYY-NNNN`. Migrated quotes keep their old number. */
  number: string;

  /** Multi-tenancy — enforced by Firestore rules on create. */
  tenantId?: string;

  // --- Source / context ----------------------------------------------------

  sourceType: QuoteSourceType;
  /** Set when sourceType is RFQ_RESPONSE or OFFLINE_RFQ (if linked). */
  rfqId?: string;
  /** Denormalized from RFQ. */
  rfqNumber?: string;
  /** Only meaningful when rfqId is set. */
  rfqMode?: RFQMode;

  // --- Vendor --------------------------------------------------------------

  /** Entity ID if the vendor is in the entities master. Optional for unsolicited / standing quotes from unlisted vendors. */
  vendorId?: string;
  /** Always stored — free text or denormalized from entity. */
  vendorName: string;

  // --- Vendor's own reference ----------------------------------------------

  /** The vendor's reference number on their quote (e.g., "QT/2025/123"). */
  vendorOfferNumber?: string;
  /** Date on the vendor's quote document. */
  vendorOfferDate?: Timestamp;

  // --- Documents -----------------------------------------------------------

  fileUrl?: string;
  fileName?: string;
  additionalDocuments?: string[];
  /** True once line items have been captured (manually or via parser). */
  itemsParsed?: boolean;

  // --- Financial summary ---------------------------------------------------

  subtotal: number;
  taxAmount: number;
  totalAmount: number;
  currency: CurrencyCode;
  /** Absolute discount amount in `currency`, applied before tax. */
  discount?: number;

  // --- Terms (mainly RFQ-response but allowed on any) ---------------------

  paymentTerms?: string;
  deliveryTerms?: string;
  validityDate?: Timestamp;
  warrantyTerms?: string;
  remarks?: string;

  // --- Commercial cost components (RFQ-response, but harmless elsewhere) ---

  /** Legacy field name; surfaced as "Price Basis" in the UI. */
  exWorks?: string;
  transportation?: string;
  packingForwarding?: string;
  insurance?: string;
  /** Legacy field name; surfaced as "Erection & Commissioning" in the UI. */
  erectionAfterPurchase?: string;
  inspection?: string;

  // --- Deviations (RFQ-response only) -------------------------------------

  /** Technical deviations flagged against the PR/RFQ attachments. */
  deviations?: OfferDeviation[];
  deviationsCheckedAt?: Timestamp;

  // --- Lifecycle + evaluation ---------------------------------------------

  status: QuoteStatus;
  evaluationScore?: number; // 0-100
  evaluationNotes?: string;

  /** Flagged as recommended during comparison. */
  isRecommended: boolean;
  recommendationReason?: string;

  /** Concerns that should block or prompt extra scrutiny. */
  redFlags?: string[];

  // --- Summary counters (kept in sync by the service) ---------------------

  itemCount: number;
  /** Number of items whose price has been pushed to `materialPrices` / `serviceRates`. */
  acceptedCount: number;
  /** False when archived / no longer relevant. */
  isActive: boolean;

  // --- Audit ---------------------------------------------------------------

  createdBy: string;
  createdByName: string;
  createdAt: Timestamp;

  evaluatedBy?: string;
  evaluatedByName?: string;
  evaluatedAt?: Timestamp;

  updatedAt: Timestamp;
  updatedBy?: string;
}

// ============================================================================
// VendorQuoteItem — child line items
// ============================================================================

export interface VendorQuoteItem {
  id: string;
  quoteId: string;

  /** Set when this item traces back to a specific RFQ line. */
  rfqItemId?: string;

  itemType: QuoteItemType;
  lineNumber: number;
  description: string;

  // --- Master-data links --------------------------------------------------

  materialId?: string;
  materialCode?: string;
  materialName?: string;
  serviceId?: string;
  serviceCode?: string;
  boughtOutItemId?: string;
  /** Denormalized for display. */
  linkedItemName?: string;
  linkedItemCode?: string;

  // --- Pricing ------------------------------------------------------------

  quantity: number;
  unit: string;
  unitPrice: number;
  amount: number;
  gstRate?: number;
  gstAmount?: number;

  // --- Delivery (RFQ-response) -------------------------------------------

  deliveryPeriod?: string;
  deliveryDate?: Timestamp;

  // --- Make/model (RFQ-response) ------------------------------------------

  makeModel?: string;

  // --- Compliance (RFQ-response) ------------------------------------------

  meetsSpec?: boolean;
  /** Free-text list of deviations for this line. */
  deviations?: string;

  // --- Notes --------------------------------------------------------------

  vendorNotes?: string;
  notes?: string;
  evaluationNotes?: string;

  // --- Price acceptance (both flows) --------------------------------------

  priceAccepted: boolean;
  priceAcceptedAt?: Timestamp;
  priceAcceptedBy?: string;

  // --- Audit ---------------------------------------------------------------

  createdAt: Timestamp;
  updatedAt: Timestamp;
}
