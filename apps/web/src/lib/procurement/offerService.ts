/**
 * Offer Service (Compatibility Shim)
 *
 * This file maintains backward compatibility with existing imports.
 * All functionality has been refactored into the offer/ module.
 *
 * @deprecated Import from '@/lib/procurement/offer' instead
 */

// Re-export everything from the modular structure
export type {
  Offer,
  OfferItem,
  OfferStatus,
  OfferComparisonData,
  CreateOfferInput,
  CreateOfferItemInput,
  UpdateOfferInput,
  EvaluateOfferInput,
  ListOffersFilters,
} from './offer';

export {
  createOffer,
  getOfferById,
  getOfferItems,
  updateOffer,
  getOffersByRFQ,
  listOffers,
  evaluateOffer,
  markOfferAsRecommended,
  getOfferComparison,
  selectOffer,
  rejectOffer,
  withdrawOffer,
} from './offer';
