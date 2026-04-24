/**
 * Offer Deviation Types
 *
 * Historic home of the Offer / OfferItem / OfferStatus / OfferComparisonData
 * types — those were unified under VendorQuote (see vendorQuote.ts). This file
 * now only exports the OfferDeviation shape used to tag technical mismatches
 * between a vendor quote and the PR/RFQ specification.
 */

/**
 * A single technical mismatch between a vendor offer and the PR/RFQ
 * specification documents (review #27). Used for buyer-facing review;
 * does not block PO creation — buyer decides whether to proceed,
 * clarify, or reject the offer.
 */
export type OfferDeviationCategory =
  | 'MATERIAL_SPEC' // Material grade / composition differs
  | 'QUANTITY' // Offer quantity ≠ RFQ quantity
  | 'MAKE_MODEL' // Different make/model quoted vs specified
  | 'DIMENSION' // Size / dimensions mismatch
  | 'MISSING_ITEM' // Offer is missing an item the spec requires
  | 'EXTRA_ITEM' // Offer includes items not in the spec
  | 'PERFORMANCE' // Rated capacity / performance doesn't meet spec
  | 'CERTIFICATION' // Missing test certificates or compliance markings
  | 'COMMERCIAL' // Commercial term (warranty, delivery) not matching RFQ
  | 'OTHER';

export type OfferDeviationSeverity = 'HIGH' | 'MEDIUM' | 'LOW';

export interface OfferDeviation {
  category: OfferDeviationCategory;
  severity: OfferDeviationSeverity;
  /** Which RFQ line this deviation relates to, if any. */
  rfqItemLineNumber?: number;
  /** Short human label, e.g. "Material grade", "Sheet thickness". */
  field: string;
  /** What the PR/RFQ spec required. */
  specValue?: string;
  /** What the vendor offer proposed. */
  offerValue?: string;
  /** One-sentence summary the UI surfaces prominently. */
  message: string;
  /** Suggested next action the buyer can take with the vendor. */
  recommendation?: string;
}
